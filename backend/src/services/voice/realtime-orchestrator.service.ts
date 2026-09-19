import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { webhookServer } from './webhook-identity';
import { realtimeContextService, shouldRecord, type ClientVoiceProfile } from './realtime-context.service';
import { callSessionStore } from './call-session.store';
import { buildRealtimePlans, buildSpeech, useSpeechToSpeech, customLlmUrlFor } from './speech-plans';
import { fitAssistantName } from './vapi-limits';
import { buildVoiceTools } from './voice-tools';
import { buildSystemPrompt, firstMessageVariants, ensureDisclosure, hasAiDisclosure } from './system-prompt';
import { greetingAudioService } from './greeting-audio.service';
import { routeIntent } from './intent-router';
import { assessMood, moodPromptBlock, type CallerMood } from './caller-mood';
import { availabilitySpeculator, detectDate } from './availability-speculator';
import { warmTransferService } from './warm-transfer.service';
import { forwardingProofService } from './forwarding-proof.service';
import { businessMemoryService } from './business-memory.service';
import { callerMemoryService } from './caller-memory.service';
import { toolRuntimeService, type ToolCallInput, type ToolCallResult } from './tool-runtime.service';
import { resolveCharacter } from '../../config/voice-characters';
import { callerIdentity, type LineAgent } from './inbound-routing.service';
import { isSelfCall, hangUpSelfCall, controlUrlOf } from './self-call-guard';
import { needsCallBrief } from './profile-voice';
import { callBrief } from './call-brief';
import { vapiClient } from '../../config/vapi';
import { voiceModeFor } from './voice-tiers';

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

/**
 * Le numéro de l'appelant, ou `null` quand il ne désigne personne.
 *
 * Passe par `callerIdentity` plutôt que de lire `customer.number` directement:
 * sur un appel renvoyé, certains opérateurs y mettent le numéro de la ligne qui
 * renvoie, c'est-à-dire celui du commerce. Écrire une mémoire d'appelant ou une
 * OPPOSITION sous ce numéro-là les appliquerait à tous les appelants du client
 * d'un coup (REL-11). Ici, un numéro faux est pire qu'un numéro absent.
 */
function callerNumberOf(event: VapiEvent): string | null {
  return callerIdentity(event).number;
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
    /* DEUX magasins, un seul bloc.
       `businessKnowledge` porte la FAQ et les règles, saisies ligne par ligne;
       `knowledgeFields` porte les champs nommés du métier, saisis dans le
       formulaire. Ce chemin ne lisait que le premier, alors que le prompt de
       l'assistant enregistré lisait les deux: un client remplissait « Mutuelles
       acceptées » et s'entendait répondre qu'on ne savait pas, sur ce chemin-là
       seulement, sans que rien ne le signale.
       Les champs nommés passent EN PREMIER: ils décrivent l'entreprise, la FAQ
       répond à des questions, et c'est la description qui cadre les réponses. */
    const entries = profile.hasKnowledgeBase
      ? businessMemoryService.promptBlock(await businessMemoryService.all(clientId), profile.language)
      : '';
    const knowledgeBlock = [profile.knowledgeFields, entries].filter(Boolean).join('\n\n');

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
      /* Le NIVEAU du client, pas le réglage brut: `voiceModeFor` fait primer
         `voiceTier` et garde l'ancien `voiceMode` en repli. Lire le champ nu
         ici ferait marcher le niveau sur une ligne dédiée et pas sur la ligne
         partagée des essais, c'est-à-dire précisément là où on l'essaie. */
      voiceMode: voiceModeFor(profile),
      ttsProvider: profile.ttsProvider,
      customLlmUrl: profile.customLlm ? customLlmUrlFor(clientId) : undefined,
    });

    /* Le mode retenu est consigné sur la session dès qu'il est connu: c'est
       lui qui sera facturé, et non le réglage du client. L'écart entre les deux
       est réel — une voix clonée ramène au classique un client réglé en temps
       réel — et c'est précisément l'écart qui produirait une surfacturation. */
    callSessionStore.setSpeechToSpeech(vapiCallId, speechToSpeech);

    // Après `buildSpeech`: l'accueil dépend du mode retenu.
    /* L'accueil de la ligne passe devant celui calculé: le client l'a écrit
       pour CETTE ligne, et c'est la première seconde de l'appel.
       Mais il ne peut pas faire sauter l'annonce IA (LEG-1): l'article 50 de
       l'AI Act vise le FOURNISSEUR du système, pas le commerçant qui l'utilise,
       et un champ de texte libre de 400 caractères le remplaçait en entier. On
       complète donc sa phrase au lieu de l'écarter. */
    const custom = line?.greeting ? ensureDisclosure(line.greeting, profile) : null;
    if (custom?.added.length) {
      logger.info(
        `[Voice] accueil de ligne complété pour ${profile.businessName}: ${custom.added.join(', ')} ajouté(s)`,
      );
    }
    const firstMessage = custom?.text
      ?? (await this.resolveFirstMessage(profile, caller.knownName, speechToSpeech));

    /* Le booléen que le plan demande, consigné sur CHAQUE appel: sans lui,
       « l'annonce a-t-elle été faite » ne se répond qu'en réécoutant l'audio,
       c'est-à-dire jamais. Faux ne peut plus arriver que si quelqu'un a éteint
       la conformité pour toute la flotte, ce qui mérite exactement ce niveau
       d'alerte. */
    const disclosed = hasAiDisclosure(firstMessage, profile.language);
    callSessionStore.setDisclosure(vapiCallId, disclosed);
    if (!disclosed) {
      logger.error(
        `[Voice] CRITIQUE: appel ${vapiCallId} démarré SANS annonce IA (${profile.businessName}). ` +
          'AI Act art. 50: l\'obligation pèse sur nous, pas sur le client. Vérifier VOICE_COMPLIANCE_GREETING.',
      );
    }

    const assistant = {
      /* Le nom passe par la BORNE, comme partout ailleurs (6octies).
         Il ne le faisait pas ici, et c'est le seul chemin qui échappe à
         `vapiClient`: cet assistant n'est pas créé par l'API, il est rendu en
         réponse à `assistant-request`, donc `fitAssistantLabel`, appliqué dans
         `config/vapi.ts` sur create et update, ne le voyait jamais.
         Or ce chemin sert précisément les clients de la LIGNE PARTAGÉE — ceux
         d'essai, qui n'ont pas de numéro dédié et dont le numéro n'épingle donc
         aucun assistant. « Receptionist - » fait quinze caractères: toute
         entreprise dont le nom en dépasse vingt-cinq franchissait la limite de
         quarante, et un nom trop long ne dégrade pas l'assistant, il le fait
         refuser en entier. Le premier appel d'essai, sur le nom du commerce. */
      name: fitAssistantName('Receptionist', profile.businessName),
      model,
      voice,
      firstMessage,
      /* Les mots du client soufflés au transcripteur (BEL-5 / BEL-7): son nom,
         celui de l'agent et les intitulés de prestations. Ce sont ceux qu'un
         appelant prononce et qu'un modèle générique écrit de travers, parce
         qu'ils ne figurent dans aucun corpus. Ils sont déjà en mémoire, la
         liste ne coûte donc aucune requête sur le chemin de l'appel. */
      ...buildRealtimePlans(profile.language, speechToSpeech, {
        vocabulary: [profile.businessName, profile.agentName, ...(profile.services ?? [])],
      }),
      server: webhookServer(`${env.API_BASE_URL}/api/webhooks/vapi/client/${clientId}`),
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
      const audio = await greetingAudioService.available(profile);
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
      /* Notre propre transfert, revenu par le renvoi du client (occupé):
         raccroché, pas décroché. Voir `self-call-guard.ts`. */
      if (isSelfCall(event, { dedicated: profile?.inboundNumber ?? null, shared: env.VAPI_PHONE_NUMBER || null })) {
        await hangUpSelfCall(event, clientId, url => vapiClient.endCall(url));
        return;
      }
      callSessionStore.start({
        vapiCallId,
        clientId,
        callerNumber: callerNumberOf(event),
        language: profile?.language ?? 'en',
      });
      /* L'adresse de CONTRÔLE, retenue: c'est par elle que passe tout ce qu'on
         dira au modèle après l'accueil, et tous les événements ne la portent
         pas. Le brief la lit sur l'événement qu'il tient; ce qui vient plus
         tard n'a que celle-ci. */
      callSessionStore.noteControlUrl(vapiCallId, controlUrlOf(event));
      /* Pendant que l'accueil se dit, les lectures que le PREMIER tour et la
         réservation paieraient sinon sur le chemin de la réponse: l'historique
         de l'appelant (trois requêtes) et l'expéditeur SMS du client. Sans
         await, et sans conséquence si ça rate: le tour les relira. */
      warmCallerContext(clientId, callerNumberOf(event));
      /* Ce que le prompt FIGÉ de l'assistant enregistré ne peut pas porter, et
         que `llm-stream` ne reposera pas sur ce chemin: la date réelle et la
         mémoire de l'appelant. Voir `call-brief.ts` et `needsCallBrief`. Sans
         await, et sans conséquence si ça rate: l'appelant écoute l'accueil. */
      if (profile && needsCallBrief(profile)) void postCallBrief(clientId, event, profile);
    }

    /* Un appel qui arrive PAR le renvoi est la seule preuve que le renvoi
       marche (REL-10). Elle se relève ici parce que c'est le seul endroit qui
       voie à la fois le client résolu et les en-têtes de l'appel. Sans await:
       l'appelant est en ligne, et une colonne d'installation ne vaut pas un
       aller-retour de base de données sur le chemin de la réponse. */
    void forwardingProofService.noteInboundCall(clientId, event);
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

    if (!text.trim()) return null;

    /* La PARTIELLE ne sert qu'à une chose: lancer la lecture d'agenda pendant
       que l'appelant parle encore.
     *
     * « mardi » apparaît au transcript bien avant que l'appelant ait fini sa
     * phrase, et la lecture Google prend 400 à 900 ms. Attendre la finale,
     * c'est-à-dire le silence de fin de tour, revenait à jeter tout le temps
     * de parole qui restait: la spéculation partait au moment précis où le
     * modèle allait de toute façon la demander.
     *
     * Rien d'autre ne se fait ici. Le transcript, l'humeur, les marques de
     * latence et le routage d'intention se posent tous sur du TEXTE DÉFINITIF:
     * une partielle se réécrit au mot suivant, et un tour compté deux fois ou
     * une humeur assise sur une demi-phrase seraient des données fausses, pas
     * des données précoces. La lecture d'agenda est la seule chose qui puisse
     * se tromper sans conséquence, parce qu'elle ne fait que LIRE. */
    if (!isFinal) {
      const partialSession = callSessionStore.get(vapiCallId);
      if (role === 'user' && partialSession) {
        const early = detectDate(text, partialSession.language);
        if (early) availabilitySpeculator.speculate(partialSession.clientId, vapiCallId, early);
      }
      return null;
    }

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
      /* ET ON LE DIT AU MODÈLE, ce qui n'était pas fait sur ce chemin-ci.
         `moodPromptBlock` n'avait qu'UN consommateur, `llm-stream`, qui le
         repose à chaque tour — et qui ne tourne pas en parole-à-parole
         (6quaterquadragesies). L'humeur y était donc mesurée, escaladée,
         journalisée, et jamais lue: un appelant énervé recevait exactement le
         même accueil qu'un appelant calme. Encore un fait produit que personne
         n'ouvre, et celui-là s'entend.
         Même canal que le brief d'ouverture, le seul qui ait été VU atteindre
         un appel réel sur ce chemin. Borné par construction: l'humeur ne fait
         que MONTER et ne compte que trois niveaux, donc au plus deux envois par
         appel, et aucun sur un appel ordinaire. */
      void postMoodNudge(session.clientId, vapiCallId, assessed.mood, session.language);
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

    /* Le tour de modèle qui vient de se fermer a répondu par un outil: son
       premier son viendra du tour SUIVANT. Dit au tracker avant d'exécuter,
       pour que TTFA ne mesure pas l'agenda (16/09/2026). */
    callSessionStore.markLatency(vapiCallId, 'toolTurn');

    /* La session en mémoire ne survit ni à un redémarrage ni à une seconde
       instance. Sans elle, lookupBooking ne connaît plus le numéro de
       l'appelant et ne retrouve pas sa réservation (« aucune réservation sous
       ce nom », appel réel du 12/09/2026, pendant un déploiement), et le SMS
       de confirmation n'a plus de destinataire. L'événement porte le numéro:
       la session se refait ici, comme `handleStatusUpdate` l'aurait faite. */
    if (vapiCallId && !callSessionStore.get(vapiCallId)) {
      const profile = await realtimeContextService.getClientProfile(clientId);
      callSessionStore.start({
        vapiCallId,
        clientId,
        callerNumber: callerNumberOf(event),
        language: profile?.language ?? 'en',
      });
      logger.info(`[Realtime] session recréée sur tool-calls pour ${vapiCallId}`);
    }

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
          /* L'AUTRE sens de l'interruption: l'agent qui coupe l'appelant.
             Consigné par appel parce que le taux ne se calcule qu'après, sur
             une population — et c'est le taux qui règle l'endpointing. */
          falseCuts: session.falseCuts,
          mood: session.mood,
          tokens: session.tokens,
          /* Le modèle qui a servi, par tour: la réponse à « quel modèle
             tourne vraiment », lue dans le flux d'OpenAI et non dans l'env. */
          models: session.models,
          /* Les tours partis en repli, avec la raison: « Pardon, je vous ai mal
             entendu » trois fois de suite (13/09) n'a de sens qu'avec elle. */
          llmFailures: session.llmFailures,
          /* Le brief d'ouverture: parti, refusé, ou jamais tenté. Sans cette
             ligne, « il ne me reconnaît pas » ne distingue pas un brief qui
             n'est pas parti d'un modèle qui l'ignore. */
          callBrief: session.callBrief,
          /* Le bloc d'humeur: posé, refusé, ou rien à poser. Même raison que
             la ligne au-dessus — sans elle, « il m'a parlé comme un robot
             alors que j'étais énervé » ne distingue pas le bloc qui n'est pas
             parti du bloc parti que le modèle ignore. */
          moodNudge: session.moodNudge,
          toolCalls: session.toolCalls,
          bookingId: session.bookingId,
          /* Le rendez-vous ANNULE en direct: sans lui, le post-appel relit la
             transcription, y voit un rendez-vous et le RECREE, a la date que
             l'appelant venait de liberer. */
          cancelledBookingId: session.cancelledBookingId,
          lead: session.lead,
          leadActivityId: session.leadActivityId,
          medianTurnLatencyMs: median(session.turnLatencies),
          latency: session.latency.snapshot(),
          /* L'annonce IA, consignée sur la ligne de l'appel: c'est la seule
             forme dans laquelle elle est vérifiable après coup (LEG-1). */
          disclosureSpoken: session.disclosureSpoken,
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
      const served = Object.entries(session!.models).map(([m, n]) => `${m} ×${n}`);
      if (served.length) logger.info(`[Voice] call ${vapiCallId} modèles servis — ${served.join(', ')}`);
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
            voiceMode: voiceModeFor(profile),
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

    /* Ce client accepte-t-il d'être enregistré (LEG-5) ?
       Rendu ICI parce que le profil est déjà chargé, et parce que le seul
       autre endroit qui le sait est la construction de l'assistant, en début
       d'appel. Sans ce drapeau, la fin d'appel écrit l'URL que Vapi lui donne,
       quelle qu'elle soit.
       `true` quand le profil est illisible: le doute penche du côté où l'on
       garde une preuve, jamais du côté où l'on en fabrique une en cachette. */
    const recordingAllowed = profile ? shouldRecord(profile) : true;

    return {
      transcript,
      durationSeconds,
      callerNumber: callerNumberOf(event),
      metrics,
      billing,
      voiceMode,
      recordingAllowed,
    };
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
        /* `nameCollected` d'abord: il porte le nom CONFIRMÉ (réservation
           relue, mémoire), le lead capté en cours d'appel porte le nom
           ENTENDU. L'ordre inverse réécrivait « Jean Lucas » dans la mémoire
           à chaque appel, et l'agent le redisait à l'appel suivant (13/09). */
        name: call?.nameCollected ?? input.metrics?.lead?.name ?? null,
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

/**
 * Préchauffe les caches que le premier tour de modèle et `bookAppointment`
 * liraient sinon sur le chemin critique (16/09/2026, « il est lent »).
 * Exporté pour le test; jamais attendu par l'appelant.
 */
export function warmCallerContext(clientId: string, callerNumber: string | null): void {
  void realtimeContextService.getCallerHistory(clientId, callerNumber).catch(() => {});
  void toolRuntimeService.warmSmsSender(clientId).catch(() => {});
}

/**
 * Pose le brief d'ouverture dans la conversation, pour les appels dont le
 * prompt est figé et que `llm-stream` ne rattrape pas (`needsCallBrief`).
 *
 * Un historique illisible ne fait pas sauter le brief: la DATE reste posée, et
 * c'est elle qui a coûté le plus cher (6novovicies, 6octoquadragesies). Elle
 * est calculée ici, donc elle ne dépend ni du gabarit de Vapi ni d'un cache.
 *
 * Jamais attendu par l'appelant. Un refus est journalisé en warn avec le corps
 * de la réponse: c'est la seule chose que le code ne peut pas deviner, et
 * `add-message` n'a pas encore été vu tenir sur un appel réel — un mécanisme
 * qui n'a jamais atteint un appel n'est pas prouvé (6quinquetrigesies).
 */
/**
 * LE BLOC D'HUMEUR, posé dans la conversation quand l'humeur CHANGE.
 *
 * `moodPromptBlock` décrit comment parler à quelqu'un d'énervé ou de pressé:
 * phrases courtes, pas d'enthousiasme, ne pas redemander ce qui a déjà été
 * dit, proposer un humain tôt. Il n'avait qu'UN consommateur, `llm-stream`,
 * qui ne tourne pas en parole-à-parole ni chez un client dont `customLlm` est
 * éteint. Sur ces chemins, `assessMood` tournait à chaque tour, escaladait,
 * écrivait dans les journaux, et rien ne le lisait.
 *
 * `needsCallBrief` est LA lecture de « `llm-stream` tourne-t-il ? », et c'est
 * volontairement la même que celle du brief d'ouverture: deux règles écrites
 * à la main pour la même question divergent en moins d'un mois (6vicies). Sur
 * le chemin custom-LLM, poser le bloc ici le ferait compter DEUX fois.
 *
 * Ne lève jamais, et n'est jamais attendu: l'appelant est en ligne, et
 * `handleTranscript` est du côté où il n'attend rien.
 */
async function postMoodNudge(
  clientId: string,
  vapiCallId: string | null,
  mood: CallerMood,
  lang: ClientVoiceProfile['language'],
): Promise<void> {
  const block = moodPromptBlock(mood, lang);
  /* `neutral` rend une chaîne vide, et c'est l'état normal: rien à dire de
     plus que ce que le prompt porte déjà. Rien n'est noté non plus, sinon
     tous les appels porteraient une ligne qui ne veut rien dire. */
  if (!block) return;

  const profile = await realtimeContextService.getClientProfile(clientId).catch(() => null);
  if (!profile || !needsCallBrief(profile)) return;

  const controlUrl = callSessionStore.controlUrlFor(vapiCallId);
  if (!controlUrl) {
    callSessionStore.noteMoodNudge(vapiCallId, 'SANS ADRESSE DE CONTROLE');
    logger.warn(`[Voice] humeur ${mood} non posée pour ${clientId}: aucune adresse de contrôle retenue`);
    return;
  }

  try {
    await vapiClient.addMessage(controlUrl, { role: 'system', content: block });
    callSessionStore.noteMoodNudge(vapiCallId, `pose (${mood})`);
    logger.info(`[Voice] humeur ${mood} posée pour ${clientId}`);
  } catch (error) {
    callSessionStore.noteMoodNudge(vapiCallId, `REFUSE: ${(error as Error).message}`);
    logger.warn(`[Voice] humeur ${mood} refusée pour ${clientId}: ${(error as Error).message}`);
  }
}

export async function postCallBrief(
  clientId: string,
  event: VapiEvent,
  profile: ClientVoiceProfile,
): Promise<void> {
  const controlUrl = controlUrlOf(event);
  if (!controlUrl) {
    callSessionStore.noteCallBrief(callIdOf(event), "SANS ADRESSE DE CONTROLE");
    logger.warn(`[Voice] brief non pose pour ${clientId}: l'evenement ne porte pas d'adresse de controle`);
    return;
  }
  const caller = await realtimeContextService
    .getCallerHistory(clientId, callerNumberOf(event))
    .catch(() => null);
  const bookings = caller?.upcomingBookings?.length ?? 0;
  /* LE NOM EST DIT DANS LE RELEVÉ, et il ne l'était pas (18/09/2026).
     « Il ne me reconnaît pas alors que je suis déjà client et qu'il a mon
     numéro. » La note ne portait que des COMPTES, donc elle ne distinguait pas
     les deux pannes OPPOSÉES, qui ne se réparent pas au même endroit:
       - le nom est là et le modèle redemande quand même → conflit de consignes,
         ça se règle dans le prompt FIGÉ (qui ordonnait « demande-les »);
       - le nom est absent malgré 22 appels et un rendez-vous → c'est
         `getCallerHistory` qu'il faut aller lire, et rien dans le prompt n'y
         changera quoi que ce soit.
     C'est la raison même pour laquelle cette note existe (6novoquinquagesies):
     un retour du propriétaire ne tranche pas entre deux causes opposées, un
     relevé si. Elle ne le faisait qu'à moitié.
     Le nom vient d'un appelant, donc il ne part pas brut dans un relevé: c'est
     `callerHistoryBlock` qui le sanitise pour le prompt, et ici on n'en garde
     que la présence et la forme courte. */
  const named = caller?.knownName ? `nom: ${caller.knownName.slice(0, 40)}` : 'SANS NOM CONNU';
  try {
    await vapiClient.addMessage(controlUrl, { role: 'system', content: callBrief(profile, caller) });
    callSessionStore.noteCallBrief(callIdOf(event), `pose (${named}, ${caller?.previousCalls ?? 0} appels, ${bookings} rdv)`);
    logger.info(`[Voice] brief pose pour ${clientId} (${named}, ${caller?.previousCalls ?? 0} appels, ${bookings} rdv)`);
  } catch (error) {
    callSessionStore.noteCallBrief(callIdOf(event), `REFUSE: ${(error as Error).message}`);
    logger.warn(`[Voice] brief refuse pour ${clientId}: ${(error as Error).message}`);
  }
}
