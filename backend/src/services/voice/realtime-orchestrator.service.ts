import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { realtimeContextService } from './realtime-context.service';
import { callSessionStore } from './call-session.store';
import { buildRealtimePlans, buildVoice } from './speech-plans';
import { buildVoiceTools } from './voice-tools';
import { buildFirstMessage, buildSystemPrompt } from './system-prompt';
import { routeIntent } from './intent-router';
import { businessMemoryService } from './business-memory.service';
import { callerMemoryService } from './caller-memory.service';
import { toolRuntimeService, type ToolCallInput, type ToolCallResult } from './tool-runtime.service';
import { resolveCharacter } from '../../config/voice-characters';

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

class RealtimeOrchestratorService {
  /**
   * `assistant-request` — Vapi asks what assistant to run for an inbound call.
   *
   * This is the latency-critical path nobody thinks about: the caller has
   * already heard the line connect and is waiting for a voice. Everything
   * needed comes from the context cache, so the common case is zero database
   * round-trips.
   */
  async buildAssistantForCall(clientId: string, event: VapiEvent) {
    const started = Date.now();
    const callerNumber = callerNumberOf(event);
    const vapiCallId = callIdOf(event);

    const { profile, caller } = await realtimeContextService.getCallContext(clientId, callerNumber);
    if (!profile) {
      logger.error(`[Voice] assistant-request for unknown client ${clientId}`);
      return null;
    }

    // Only the highest-priority entries go into the prompt; the rest stay
    // reachable through lookupKnowledge so a large knowledge base does not
    // become a per-turn token bill.
    const knowledgeBlock = profile.hasKnowledgeBase
      ? businessMemoryService.promptBlock(await businessMemoryService.all(clientId), profile.language)
      : '';

    if (vapiCallId) {
      callSessionStore.start({ vapiCallId, clientId, callerNumber, language: profile.language });
    }

    const character = resolveCharacter({
      characterId: profile.characterId,
      isFrench: profile.language === 'fr',
      country: profile.country,
    });

    // Custom-LLM moves the turn loop into this backend, which is what lets the
    // intent router actually skip the model on a backchannel and route the rest
    // to the cheapest model that can answer. Opt-in per client, because it also
    // puts this service in the audio path of every turn.
    const model = profile.customLlm
      ? {
          provider: 'custom-llm',
          url: `${env.API_BASE_URL}/api/webhooks/vapi/llm/${clientId}`,
          model: env.VAPI_MODEL,
          temperature: 0.6,
          maxTokens: env.VOICE_MAX_COMPLETION_TOKENS,
          messages: [{ role: 'system', content: buildSystemPrompt(profile, caller, knowledgeBlock) }],
          tools: buildVoiceTools(profile),
        }
      : {
          provider: 'openai',
          model: env.VAPI_MODEL,
          temperature: 0.6,
          // Cap the completion: a receptionist turn that runs past ~60 tokens is
          // a monologue, and long completions are the other half of TTS latency.
          maxTokens: env.VOICE_MAX_COMPLETION_TOKENS,
          messages: [{ role: 'system', content: buildSystemPrompt(profile, caller, knowledgeBlock) }],
          tools: buildVoiceTools(profile),
        };

    const assistant = {
      name: `Receptionist - ${profile.businessName}`,
      model,
      voice: buildVoice({
        voiceId: character.voiceId,
        stability: character.stability,
        similarityBoost: character.similarityBoost,
        style: character.style,
      }),
      firstMessage: buildFirstMessage(profile, caller),
      ...buildRealtimePlans(profile.language),
      serverUrl: `${env.API_BASE_URL}/api/webhooks/vapi/client/${clientId}`,
      recordingEnabled: true,
      endCallFunctionEnabled: true,
      backgroundSound: 'office',
    };

    logger.info(
      `[Voice] assistant-request for ${profile.businessName} built in ${Date.now() - started}ms ` +
        `(known caller: ${caller.previousCalls > 0})`
    );
    return assistant;
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
        if (session && msg.turn !== 0) callSessionStore.recordBargeIn(session.vapiCallId);
      } else if (msg.status === 'stopped') {
        // Opens the turn: everything downstream is measured from this instant.
        callSessionStore.markLatency(vapiCallId, 'callerSpeechEnd');
      }
      return;
    }

    if (msg.role === 'assistant' && msg.status === 'started') {
      // Closes TTS and the turn — the caller is hearing audio now.
      callSessionStore.markLatency(vapiCallId, 'assistantSpeechStart');
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
    }

    return { transcript, durationSeconds, callerNumber: callerNumberOf(event), metrics };
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
  async persistMetrics(vapiCallId: string, metrics: Record<string, unknown> | null): Promise<void> {
    if (!metrics) return;
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
            realtime: metrics,
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
