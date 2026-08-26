import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { realtimeContextService, shouldRecord, type ClientVoiceProfile } from './realtime-context.service';
import { callSessionStore } from './call-session.store';
import { buildRealtimePlans, buildSpeech, useSpeechToSpeech } from './speech-plans';
import { buildVoiceTools } from './voice-tools';
import { buildSystemPrompt, firstMessageVariants } from './system-prompt';
import { greetingAudioService } from './greeting-audio.service';
import { routeIntent } from './intent-router';
import { assessMood } from './caller-mood';
import { availabilitySpeculator, detectDate } from './availability-speculator';
import { warmTransferService } from './warm-transfer.service';
import { businessMemoryService } from './business-memory.service';
import { callerMemoryService } from './caller-memory.service';
import { toolRuntimeService, type ToolCallInput, type ToolCallResult } from './tool-runtime.service';
import { resolveCharacter } from '../../config/voice-characters';
import { type LineAgent } from './inbound-routing.service';

/**
 * Real-time call orchestrator (Phases 1, 2, 3).
 *
 * One entry point per streaming event. Every handler here is written against a
 * single constraint: **the HTTP response must not wait on anything the caller
 * is not waiting on**. Vapi holds the streaming channel open against this
 * webhook, so a 300 ms Postgres write inside a `transcript` handler is 300 ms
 * of back-pressure on the audio path.
 *
 * The split:
 *   - `assistant-request` / tool calls → the caller IS waiting. Do the work,
 *     respond, keep it under the budget.
 *   - transcript / speech / status     → the caller is NOT waiting. Update
 *     in-memory state, return immediately, persist at end of call.
 */

export interface VapiEvent {
  message?: Record<string, any>;
  [key: string]: any;
}

/** Pull the message body out of Vapi's two historical envelope shapes. */
function unwrap(event: VapiEvent): Record<string, any> {
  return event.message ?? event ?? {};
}

function callIdOf(event: VapiEvent): string | null {
  const msg = unwrap(event);
  return msg.call?.id ?? event.call?.id ?? null;
}

function callerNumberOf(event: VapiEvent): string | null {
  const msg = unwrap(event);
  return msg.call?.customer?.number ?? event.call?.customer?.number ?? null;
}

/**
 * L'agent du client, coiffé de ce que la ligne redéfinit.
 *
 * Les consignes s'AJOUTENT au lieu de remplacer: une ligne dit ce qui lui est
 * propre (« ici on ne prend que les urgences »), pas tout ce que l'entreprise a
 * déjà écrit. Tous les autres champs remplacent, parce qu'un nom ou une voix ne
 * se cumulent pas.
 */
export function applyLineAgent(profile: ClientVoiceProfile, line: LineAgent): ClientVoiceProfile {
  return {
    ...profile,
    ...(line.agentName ? { agentName: line.agentName } : {}),
    ...(line.transferNumber ? { transferNumber: line.transferNumber } : {}),
    ...(line.characterId ? { characterId: line.characterId } : {}),
    ...(line.instructions
      ? { instructions: [profile.instructions, line.instructions].filter(Boolean).join('\n') }
      : {}),
    /* Le nom d'entreprise prend le libellé de la ligne quand il existe: c'est
       ce qui fait dire « Boutique Ixelles » plutôt que le nom générique, et
       c'est la seule chose que l'appelant entend tout de suite. */
    ...(line.label ? { businessName: line.label } : {}),
  };
}

class RealtimeOrchestratorService {
  /**
   * `assistant-request` — Vapi asks what assistant to run for an inbound call.
   *
   * This is the latency-critical path nobody thinks about: the caller has
   * already heard the line connect and is waiting for a voice. Everything
   * needed comes from the context cache, so the common case is zero database
   * round-trips.
   */
  async buildAssistantForCall(clientId: string, event: VapiEvent, line?: LineAgent) {
    const started = Date.now();
    const callerNumber = callerNumberOf(event);
    const vapiCallId = callIdOf(event);

    const { profile: base, caller } = await realtimeContextService.getCallContext(clientId, callerNumber);
    if (!base) {
      logger.error(`[Voice] assistant-request for unknown client ${clientId}`);
      return null;
    }

    /* La ligne composée peut porter son propre agent, en SURCHARGE.
       Appliquée ici plutôt que dans le contexte, parce que le contexte est mis
       en cache PAR CLIENT: y injecter une surcharge de ligne servirait l'agent
       de la boutique d'Ixelles au prochain appel arrivé sur la ligne des
       urgences. La fusion est donc faite après le cache, à chaque appel. */
    const profile = line ? applyLineAgent(base, line) : base;

    // Only the highest-priority entries go into the prompt; the rest stay
    // reachable through lookupKnowledge so a large knowledge base does not
    // become a per-turn token bill.
    const knowledgeBlock = profile.hasKnowledgeBase
      ? businessMemoryService.promptBlock(await businessMemoryService.all(clientId), profile.language)
      : '';

    if (vapiCallId) {
      callSessionStore.start({ vapiCallId, clientId, callerNumber, language: profile.language });

      /* Un appel qui en croise un autre est le cas que la vente promet de tenir
         (« la ligne ne sonne jamais occupé »), et c'est aussi le seul qui puisse
         un jour buter sur la concurrence du compte Vapi, laquelle est partagée
         par toute la flotte. Il se journalise donc explicitement: sans cette
         ligne, le premier appelant refusé serait aussi le premier à l'apprendre. */
      const simultaneous = callSessionStore.liveCountFor(clientId);
      if (simultaneous > 1) {
        logger.info(
          `[Voice] ${simultaneous} appels simultanés pour ${profile.businessName} ` +
            `(${callSessionStore.liveCount()} sur l'instance)`
        );
      }
    }

    const character = resolveCharacter({
      characterId: profile.characterId,
      isFrench: profile.language === 'fr',
      country: profile.country,
      customVoice: profile.customVoice,
    });

    /* Le modèle et la voix viennent d'un seul endroit (`buildSpeech`), partagé
       avec l'appel test et la démo: c'est ce qui garantit que la réceptionniste
       est la même partout.
       Custom-LLM ramène la boucle de tour dans ce backend, ce qui permet au
       routeur d'intention de sauter le modèle sur un simple acquiescement.
       Il ne vaut que pour la chaîne classique: en parole-à-parole, le modèle
       tient la conversation lui-même et il n'y a pas de tour de texte à
       intercepter. */
    const { model, voice, speechToSpeech } = buildSpeech({
      lang: profile.language,
      systemPrompt: buildSystemPrompt(profile, caller, knowledgeBlock),
      tools: buildVoiceTools(profile),
      character,
      hasCustomVoice: !!profile.customVoice,
      voiceMode: profile.voiceMode,
      ttsProvider: profile.ttsProvider,
      customLlmUrl: profile.customLlm
        ? `${env.API_BASE_URL}/api/webhooks/vapi/llm/${clientId}`
        : undefined,
    });

    /* Le mode retenu est consigné sur la session dès qu'il est connu: c'est
       lui qui sera facturé, et non le réglage du client. L'écart entre les deux
       est réel — une voix clonée ramène au classique un client réglé en temps
       réel — et c'est précisément l'écart qui produirait une surfacturation. */
    callSessionStore.setSpeechToSpeech(vapiCallId, speechToSpeech);

    // Après `buildSpeech`: l'accueil dépend du mode retenu.
    /* L'accueil de la ligne passe devant celui calculé: le client l'a écrit
       pour CETTE ligne, et c'est la première seconde de l'appel. */
    const firstMessage = line?.greeting
      || (await this.resolveFirstMessage(profile, caller.knownName, speechToSpeech));

    const assistant = {
      name: `Receptionist - ${profile.businessName}`,
      model,
      voice,
      firstMessage,
      ...buildRealtimePlans(profile.language, speechToSpeech),
      serverUrl: `${env.API_BASE_URL}/api/webhooks/vapi/client/${clientId}`,
      // Suit la notice du premier message: un appel enregistré est un appel
      // annoncé comme tel, et réciproquement. Voir `shouldRecord`.
      recordingEnabled: shouldRecord(profile),
      endCallFunctionEnabled: true,
      backgroundSound: env.VOICE_BACKGROUND_SOUND,
    };

    logger.info(
      `[Voice] assistant-request for ${profile.businessName} built in ${Date.now() - started}ms ` +
        `(known caller: ${caller.previousCalls > 0})`
    );
    return assistant;
  }

  /**
   * The opening line, as a pre-synthesised audio URL when one exists.
   *
   * A recognised caller is greeted by name, which is worth far more than the
   * saved TTS milliseconds — those greetings cannot be pre-generated because
   * they depend on who is ringing, so they stay text.
   */
  private async resolveFirstMessage(
    profile: ClientVoiceProfile,
    knownName: string | null,
    /* En parole-à-parole, l'accueil pré-synthétisé est un piège: il a été
       fabriqué avec la voix ElevenLabs du personnage, alors que la suite de
       l'appel sera dite par le modèle. L'appelant entendrait une voix
       l'accueillir et une autre lui répondre. On renonce donc aux quelques
       millisecondes gagnées et on laisse le modèle dire lui-même sa phrase. */
    speechToSpeech = false,
  ): Promise<string> {
    const variants = firstMessageVariants(profile, knownName);
    const pick = Math.floor(Math.random() * variants.length);

    if (!knownName && !speechToSpeech) {
      const audio = await greetingAudioService.available(profile.clientId);
      // Match on the exact text: a greeting generated before a rename would
      // otherwise introduce the agent under the old name.
      const hit = audio.find(a => a.variant === pick && a.text === variants[pick]);
      if (hit) return hit.url;
    }
    return variants[pick];
  }

  /**
   * `status-update` / `call-start`. Creates the session if `assistant-request`
   * did not (outbound calls, or a process that restarted mid-call).
   */
  async handleStatusUpdate(clientId: string, event: VapiEvent): Promise<void> {
    const msg = unwrap(event);
    const vapiCallId = callIdOf(event);
    if (!vapiCallId) return;

    const status = msg.status ?? event.status;
    if (status !== 'in-progress' && msg.type !== 'call-start' && msg.type !== 'call-started') return;

    if (!callSessionStore.get(vapiCallId)) {
      const profile = await realtimeContextService.getClientProfile(clientId);
      callSessionStore.start({
        vapiCallId,
        clientId,
        callerNumber: callerNumberOf(event),
        language: profile?.language ?? 'en',
      });
    }
  }

  /**
   * `transfer-destination-request` — Vapi asks where to send the caller.
   *
   * Both parties are waiting on this answer, so it reads memory only: the brief
   * is built from the transcript buffer, and the SMS is fired without being
   * awaited.
   */
  async handleTransferRequest(clientId: string, event: VapiEvent) {
    const vapiCallId = callIdOf(event);
    const profile = await realtimeContextService.getClientProfile(clientId);
    if (!profile?.transferNumber) return null;

    const brief = warmTransferService.brief(profile, vapiCallId);
    warmTransferService.notify(profile, brief);
    logger.info(`[Voice] warm transfer for ${profile.businessName}: ${brief.reason}`);

    return { destination: warmTransferService.destination(profile, brief) };
  }

  /**
   * `transcript`. In-memory only — no database write. Interim transcripts are
   * dropped entirely; only finals are worth keeping.
   *
   * Returns the intent decision so the caller can log deflection stats. The
   * decision itself does not (and must not) block the response.
   */
  handleTranscript(event: VapiEvent) {
    const msg = unwrap(event);
    const vapiCallId = callIdOf(event);
    const role: 'user' | 'assistant' = msg.role === 'assistant' ? 'assistant' : 'user';
    const text: string = msg.transcript ?? event.transcript ?? '';
    const isFinal = (msg.transcriptType ?? 'final') === 'final';

    if (!isFinal || !text.trim()) return null;

    const session = callSessionStore.get(vapiCallId);
    callSessionStore.appendTranscript(vapiCallId, role, text);
    if (role !== 'user' || !session) return null;

    // Closes the STT stage: the caller stopped talking, this is the transcript.
    callSessionStore.markLatency(vapiCallId, 'transcriptFinal');

    // Mood is read from the opening turns and only ever escalates: a caller who
    // opened angry stays handled carefully even if their third sentence is
    // neutral, because the anger was paused, not resolved.
    const assessed = assessMood(text, session.language, session.callerTurns - 1, session.mood);
    if (assessed.mood !== session.mood) {
      callSessionStore.setMood(vapiCallId, assessed.mood);
      logger.info(`[Voice] caller mood → ${assessed.mood} (${assessed.signals.join(', ')})`);
    }

    // The caller just named a day: start the calendar read now rather than
    // waiting for the model to ask for it. Reads only, capped per call, and a
    // failure is silent — the real tool call runs the normal path.
    const spokenDate = detectDate(text, session.language);
    if (spokenDate) {
      availabilitySpeculator.speculate(session.clientId, vapiCallId, spokenDate);
    }

    // Phase 3: classify the caller's turn. On the custom-LLM path the decision
    // is what actually skips the model (see llm-stream.service); on Vapi's own
    // OpenAI path it only feeds the deflection stats, because Vapi owns the
    // turn loop there.
    const decision = routeIntent(text, session.language, { turnIndex: session.callerTurns - 1 });
    if (decision.handledLocally) {
      callSessionStore.recordDeflection(vapiCallId);
      logger.debug(`[Voice] turn deflected (${decision.kind}): ${decision.reason}`);
    }
    return decision;
  }

  /**
   * `speech-update`. Used only to count barge-ins: the assistant being cut off
   * mid-utterance is the strongest signal that pacing is wrong for this client.
   */
  handleSpeechUpdate(event: VapiEvent): void {
    const msg = unwrap(event);
    const vapiCallId = callIdOf(event);

    if (msg.role === 'user') {
      if (msg.status === 'started') {
        const session = callSessionStore.get(vapiCallId);
        // Only counts as a barge-in if the assistant currently holds the floor,
        // which Vapi signals by sending the user speech-start while an assistant
        // utterance is open.
        // The store decides whether this was a real interruption or just the
        // caller talking through a backchannel.
        if (session && msg.turn !== 0) callSessionStore.recordBargeIn(session.vapiCallId);
      } else if (msg.status === 'stopped') {
        // Opens the turn: everything downstream is measured from this instant.
        callSessionStore.markLatency(vapiCallId, 'callerSpeechEnd');
      }
      return;
    }

    if (msg.role === 'assistant') {
      if (msg.status === 'started') {
        // Closes TTS and the turn — the caller is hearing audio now.
        callSessionStore.markLatency(vapiCallId, 'assistantSpeechStart');
        callSessionStore.assistantStartedSpeaking(vapiCallId);
      } else if (msg.status === 'stopped') {
        callSessionStore.assistantStoppedSpeaking(vapiCallId);
      }
    }
  }

  /**
   * `tool-calls` / `function-call`. The caller is on the line waiting, so this
   * runs the tools concurrently and returns as soon as the slowest one is done.
   */
  async handleToolCalls(clientId: string, event: VapiEvent): Promise<ToolCallResult[]> {
    const msg = unwrap(event);
    const vapiCallId = callIdOf(event);

    const raw: any[] =
      msg.toolCalls ??
      msg.toolCallList ??
      (msg.functionCall ? [{ id: msg.functionCall.id, function: msg.functionCall }] : []);

    const calls: ToolCallInput[] = raw
      .map(entry => {
        const fn = entry.function ?? entry;
        let args = fn.arguments ?? fn.parameters ?? {};
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch {
            args = {};
          }
        }
        return {
          toolCallId: entry.id ?? entry.toolCallId ?? fn.id ?? 'unknown',
          name: fn.name ?? '',
          args: args as Record<string, any>,
        };
      })
      .filter(c => c.name);

    if (!calls.length) return [];

    return Promise.all(calls.map(call => toolRuntimeService.execute(clientId, vapiCallId, call)));
  }

  /**
   * `end-of-call-report`. The one place we write. Everything accumulated in
   * memory is flushed in a single transaction-free batch, and the heavy
   * transcript analysis is handed off to the existing pipeline afterwards.
   *
   * Returns the session metrics so the caller can decide what to do next.
   */
  async finalizeCall(clientId: string, event: VapiEvent) {
    const msg = unwrap(event);
    const vapiCallId = callIdOf(event);
    if (!vapiCallId) return null;

    const session = callSessionStore.end(vapiCallId);
    availabilitySpeculator.release(vapiCallId);
    // Vapi's report is authoritative; our buffer is the fallback when the
    // process restarted mid-call and lost the session.
    const transcript: string = msg.transcript || event.transcript || session?.transcript.join('\n') || '';
    const durationSeconds: number = msg.call?.duration ?? msg.durationSeconds ?? event.call?.duration ?? 0;

    if (session) {
      // Vapi's own numbers, when present, sit next to ours rather than
      // replacing them: disagreement between the two is itself a signal.
      session.latency.attachVendorMetrics(msg.performanceMetrics ?? msg.performance ?? null);
    }

    const metrics = session
      ? {
          callerTurns: session.callerTurns,
          deflectedTurns: session.deflectedTurns,
          bargeIns: session.bargeIns,
          hardBargeIns: session.hardBargeIns,
          mood: session.mood,
          tokens: session.tokens,
          toolCalls: session.toolCalls,
          bookingId: session.bookingId,
          lead: session.lead,
          leadActivityId: session.leadActivityId,
          medianTurnLatencyMs: median(session.turnLatencies),
          latency: session.latency.snapshot(),
        }
      : null;

    if (metrics) {
      logger.info(
        `[Voice] call ${vapiCallId} ended — ${metrics.callerTurns} turns, ` +
          `${metrics.deflectedTurns} deflected, ${metrics.bargeIns} barge-ins`
      );
      // Per-stage line: this is what says WHICH stage owns a slow call.
      logger.info(`[Voice] call ${vapiCallId} latency — ${session!.latency.summaryLine()}`);
      const { input, cached, output } = session!.tokens;
      if (input > 0) {
        const hitRate = Math.round((cached / input) * 100);
        logger.info(`[Voice] call ${vapiCallId} tokens — in ${input} (cache ${hitRate}%), out ${output}`);
      }
    }

    /* Le coût RÉEL de l'appel, tel que Vapi le facture.
     *
     * Sans lui, toute décision de tarif repose sur des tarifs publics
     * additionnés à la main, c'est-à-dire sur une estimation. Vapi envoie le
     * montant et son détail par fournisseur dans ce même rapport: il ne coûte
     * rien à prendre, et il vaut mieux que n'importe quel calcul.
     *
     * Le mode de voix l'accompagne, sinon les deux chaînes se mélangent dans
     * la moyenne et le chiffre ne répond plus à la seule question qui compte:
     * combien coûte la minute en parole-à-parole PLUTÔT qu'en classique. */
    /* Le mode facturé vient de la SESSION, c'est-à-dire de la décision prise au
       moment de construire l'assistant, et non d'une re-déduction du réglage à
       la fin de l'appel. Les deux divergent pour de bon: une voix clonée ramène
       au classique un client réglé en « temps réel », et un client qui change
       de mode en cours de mois ferait recalculer ses appels passés au nouveau
       tarif. Le temps réel se vendant au supplément, cet écart n'est plus une
       imprécision, c'est une erreur de facture.

       Le repli sur le profil ne sert qu'au cas où le processus a redémarré
       pendant l'appel: la session vit en mémoire. Il reste juste dans
       l'immense majorité des cas, et il vaut mieux qu'un `null`. */
    const profile = await realtimeContextService.getClientProfile(clientId).catch(() => null);
    const decided = session?.speechToSpeech;
    const voiceMode = typeof decided === 'boolean'
      ? (decided ? 'realtime' : 'classic')
      : profile
        ? (useSpeechToSpeech({
            hasCustomVoice: !!profile.customVoice,
            clonedVoice: profile.customVoice?.cloned,
            voiceMode: profile.voiceMode,
          })
            ? 'realtime' : 'classic')
        : null;
    const billing = {
      costUsd: typeof msg.cost === 'number' ? msg.cost : null,
      costBreakdown: msg.costBreakdown ?? msg.costs ?? null,
      durationSeconds,
      voiceMode,
      /* D'où vient le mode: une facture contestée doit pouvoir se relire. */
      voiceModeSource: typeof decided === 'boolean' ? 'session' : profile ? 'profile' : 'unknown',
    };

    return { transcript, durationSeconds, callerNumber: callerNumberOf(event), metrics, billing, voiceMode };
  }

  /**
   * Fold the finished call into the caller's persistent memory, and link the
   * lead activity created mid-call to the ClientCall row that now exists.
   */
  async persistMemory(input: {
    clientId: string;
    vapiCallId: string;
    callerNumber: string | null;
    metrics: { lead: { name: string | null; email: string | null; reason: string } | null; leadActivityId?: string | null } | null;
  }): Promise<void> {
    try {
      const call = await prisma.clientCall.findUnique({
        where: { vapiCallId: input.vapiCallId },
        select: { id: true, summary: true, outcome: true, nameCollected: true, emailCollected: true },
      });

      await callerMemoryService.remember({
        clientId: input.clientId,
        callerNumber: input.callerNumber,
        name: input.metrics?.lead?.name ?? call?.nameCollected ?? null,
        email: input.metrics?.lead?.email ?? call?.emailCollected ?? null,
        summary: call?.summary ?? input.metrics?.lead?.reason ?? null,
        outcome: call?.outcome ?? null,
      });

      // The lead activity was written mid-call, before the ClientCall row
      // existed. Link them now so the follow-up has the transcript — merging
      // into the existing content, never replacing it: that payload is what the
      // CRM sync reads.
      if (input.metrics?.leadActivityId && call?.id) {
        const activity = await prisma.agentCrmActivity.findUnique({
          where: { id: input.metrics.leadActivityId },
          select: { content: true },
        });
        if (activity) {
          await prisma.agentCrmActivity.update({
            where: { id: input.metrics.leadActivityId },
            data: {
              content: {
                ...((activity.content as Record<string, unknown>) || {}),
                clientCallId: call.id,
                callSummary: call.summary ?? null,
              } as Prisma.InputJsonObject,
            },
          });
        }
      }
    } catch (error) {
      logger.warn(`[Voice] memory persist failed for ${input.vapiCallId}: ${(error as Error).message}`);
    }
  }

  /**
   * Attach the per-call metrics to the persisted ClientCall row. Runs after the
   * existing analysis pipeline has created it, so the row already exists.
   */
  async persistMetrics(
    vapiCallId: string,
    metrics: Record<string, unknown> | null,
    /* Séparé des métriques: celles-ci n'existent que si la session vivait
       encore en mémoire. Le coût, lui, arrive dans le rapport de Vapi et doit
       être gardé même après un redémarrage du processus. */
    billing?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!metrics && !billing) return;
    try {
      const existing = await prisma.clientCall.findUnique({
        where: { vapiCallId },
        select: { id: true, metadata: true },
      });
      if (!existing) return;
      await prisma.clientCall.update({
        where: { id: existing.id },
        data: {
          metadata: {
            ...((existing.metadata as Record<string, unknown>) || {}),
            ...(metrics ? { realtime: metrics } : {}),
            ...(billing ? { billing } : {}),
          } as Prisma.InputJsonObject,
        },
      });
    } catch (error) {
      logger.warn(`[Voice] failed to persist metrics for ${vapiCallId}: ${(error as Error).message}`);
    }
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export const realtimeOrchestratorService = new RealtimeOrchestratorService();
