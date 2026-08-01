import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { routeIntent, type IntentDecision } from './intent-router';
import { callSessionStore } from './call-session.store';
import type { VoiceLanguage } from './speech-plans';

/**
 * Custom-LLM streaming endpoint (closes the Phase 3 loop).
 *
 * Until now the intent router only *measured* deflectable turns: Vapi owned the
 * turn loop, so every utterance reached GPT-4o regardless of what the router
 * decided. Declaring `model.provider: 'custom-llm'` moves that loop here — Vapi
 * calls this service with an OpenAI-shaped chat-completion request and streams
 * whatever we emit straight into the TTS.
 *
 * That buys three things at once:
 *
 *  1. **Latency.** A deflected turn ("mhm", "ok") answers from memory in under
 *     a millisecond instead of a ~400 ms round-trip to OpenAI.
 *  2. **Cost.** A deflected turn replays no prompt at all. A turn that still
 *     needs a model is routed to the cheapest one that can handle it.
 *  3. **Intelligence.** Full GPT-4o is reserved for turns that carry business
 *     intent, so the expensive model is never spent on chit-chat.
 *
 * The trade it makes is real and deliberate: this service is now in the audio
 * path of every turn. It is therefore gated per client (`vapiConfig.customLlm`),
 * and every failure mode falls back to a spoken line rather than silence.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  [key: string]: unknown;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  tools?: unknown[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

/** What the controller needs to write to the wire. */
export interface StreamHandle {
  write(chunk: string): void;
  end(): void;
}

/**
 * Model tiers. `mini` handles everything conversational; `full` is reserved for
 * turns carrying business intent, where a wrong answer costs a booking.
 */
const TIER = {
  full: () => env.VAPI_MODEL,
  mini: () => env.VOICE_SMALL_MODEL,
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
/** Ceiling on time-to-first-token before we speak a fallback instead. */
const FIRST_TOKEN_TIMEOUT_MS = 4_000;

function sseChunk(id: string, model: string, delta: Record<string, unknown>, finish: string | null): string {
  return `data: ${JSON.stringify({
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`;
}

/**
 * Emit a complete assistant turn as SSE without calling any model. Used for
 * deflected turns and for the fallback line.
 */
function emitLocal(stream: StreamHandle, text: string, model: string): void {
  const id = `chatcmpl-local-${Date.now()}`;
  stream.write(sseChunk(id, model, { role: 'assistant', content: text }, null));
  stream.write(sseChunk(id, model, {}, 'stop'));
  stream.write('data: [DONE]\n\n');
  stream.end();
}

/** Last thing the caller actually said, ignoring tool plumbing. */
function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return '';
}

/** How many caller turns have already happened — drives the first-turn rules. */
function callerTurnIndex(messages: ChatMessage[]): number {
  return Math.max(0, messages.filter(m => m.role === 'user').length - 1);
}

class LlmStreamService {
  /**
   * Decide how a turn is answered. Split out from the streaming so the policy
   * is testable without a network.
   */
  plan(request: ChatCompletionRequest, lang: VoiceLanguage) {
    const utterance = lastUserMessage(request.messages || []);
    const decision = routeIntent(utterance, lang, { turnIndex: callerTurnIndex(request.messages || []) });

    // A tool result in flight always needs the model: it has to turn
    // "FREE at 10:00, 11:00" into a sentence.
    const awaitingToolResult = (request.messages || []).some(m => m.role === 'tool');

    if (decision.handledLocally && !awaitingToolResult) {
      return { mode: 'local' as const, decision, model: TIER.mini(), reply: decision.reply };
    }

    // The expensive model is earned, not defaulted to. It is spent on turns
    // where a wrong answer costs a booking: explicit business intent, a tool
    // result to narrate, or an utterance long enough to be a real request.
    // What is left — short, unmatched, conversational ("is it raining there?",
    // "how are you") — is exactly what the cheap tier is good at.
    const needsFull = awaitingToolResult || decision.businessIntent || decision.wordCount > 5;
    return {
      mode: 'proxy' as const,
      decision,
      model: needsFull ? TIER.full() : TIER.mini(),
      reply: '',
    };
  }

  /**
   * Handle one chat-completion request from Vapi, writing SSE into `stream`.
   */
  async handle(
    clientId: string,
    vapiCallId: string | null,
    lang: VoiceLanguage,
    request: ChatCompletionRequest,
    stream: StreamHandle,
  ): Promise<void> {
    const started = Date.now();
    callSessionStore.markLatency(vapiCallId, 'llmStart');
    const plan = this.plan(request, lang);

    if (plan.mode === 'local') {
      callSessionStore.recordDeflection(vapiCallId);
      logger.debug(`[VoiceLLM] deflected (${plan.decision.kind}) for ${clientId} — no model call`);
      // A deflected turn still closes the LLM stage: it is a real turn that
      // took sub-millisecond instead of a round-trip, and omitting it would
      // flatter the median rather than reflect it.
      callSessionStore.markLatency(vapiCallId, 'llmFirstDelta');
      // An empty reply is the correct answer to a backchannel: the caller said
      // "mhm", a human receptionist says nothing and keeps listening.
      emitLocal(stream, plan.reply, plan.model);
      callSessionStore.markLatency(vapiCallId, 'llmEnd');
      return;
    }

    try {
      await this.proxy(request, plan.model, stream, vapiCallId);
      callSessionStore.markLatency(vapiCallId, 'llmEnd');
      logger.debug(`[VoiceLLM] ${plan.model} turn for ${clientId} in ${Date.now() - started}ms`);
    } catch (error) {
      logger.error(`[VoiceLLM] proxy failed for ${clientId}: ${(error as Error).message}`);
      emitLocal(stream, this.fallbackLine(lang), plan.model);
      callSessionStore.markLatency(vapiCallId, 'llmEnd');
    }
  }

  /**
   * Relay OpenAI's stream through untouched. Deltas are forwarded byte-for-byte
   * so the first token reaches the synthesiser as fast as it would have without
   * this hop.
   */
  private async proxy(
    request: ChatCompletionRequest,
    model: string,
    stream: StreamHandle,
    vapiCallId: string | null,
  ): Promise<void> {
    const controller = new AbortController();
    const firstTokenTimer = setTimeout(() => controller.abort(), FIRST_TOKEN_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENAI_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, model, stream: true }),
      });
    } catch (error) {
      clearTimeout(firstTokenTimer);
      throw error;
    }

    if (!response.ok || !response.body) {
      clearTimeout(firstTokenTimer);
      throw new Error(`OpenAI responded ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sawFirstChunk = false;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!sawFirstChunk) {
          // First bytes arrived: the turn is alive, the deadline no longer
          // applies to the rest of the completion. This is also the moment the
          // LLM stage closes — everything after is generation, not waiting.
          clearTimeout(firstTokenTimer);
          callSessionStore.markLatency(vapiCallId, 'llmFirstDelta');
          sawFirstChunk = true;
        }
        stream.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      clearTimeout(firstTokenTimer);
      reader.releaseLock?.();
    }

    if (!sawFirstChunk) throw new Error('OpenAI stream closed without a token');
    stream.end();
  }

  /** Spoken when the model is unreachable. Never mentions a technical fault. */
  private fallbackLine(lang: VoiceLanguage): string {
    return lang === 'fr'
      ? 'Pardon, je vous ai mal entendu. Vous pouvez répéter ?'
      : 'Sorry, I did not catch that. Could you say it again?';
  }
}

export const llmStreamService = new LlmStreamService();
export type { IntentDecision };
