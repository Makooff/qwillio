import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { routeIntent, type IntentDecision } from './intent-router';
import { callSessionStore } from './call-session.store';
import { moodPromptBlock } from './caller-mood';
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
/**
 * OpenAI only caches a prefix once it is long enough to be worth caching.
 * Below this the cache never engages and the bookkeeping is pure overhead.
 */
const MIN_CACHEABLE_PREFIX_CHARS = 4_000;

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

/**
 * Pull token counts out of the final `usage` chunk of a stream.
 *
 * Returns null for every other chunk, which is the overwhelming majority — the
 * check is a substring test before any JSON parsing so the hot path stays cheap.
 */
export function parseUsageChunk(chunk: string): { input: number; cached: number; output: number } | null {
  if (!chunk.includes('"usage"')) return null;
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
    try {
      const usage = JSON.parse(line.slice(6))?.usage;
      if (!usage) continue;
      return {
        input: usage.prompt_tokens ?? 0,
        cached: usage.prompt_tokens_details?.cached_tokens ?? 0,
        output: usage.completion_tokens ?? 0,
      };
    } catch {
      /* a partial chunk: the counts arrive whole in a later one */
    }
  }
  return null;
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
      // Order matters: mood is appended first so it lands after the stable
      // prefix, then the caching hint is attached to the finished request.
      const prepared = this.withCaching(this.withMood(request, vapiCallId, lang), vapiCallId);
      await this.proxy(prepared, plan.model, stream, vapiCallId);
      callSessionStore.markLatency(vapiCallId, 'llmEnd');
      logger.debug(`[VoiceLLM] ${plan.model} turn for ${clientId} in ${Date.now() - started}ms`);
    } catch (error) {
      logger.error(`[VoiceLLM] proxy failed for ${clientId}: ${(error as Error).message}`);
      emitLocal(stream, this.fallbackLine(lang), plan.model);
      callSessionStore.markLatency(vapiCallId, 'llmEnd');
    }
  }

  /**
   * Prepare the request for prompt caching (chantier 7).
   *
   * The system prompt is ~1,500 tokens and is replayed on every turn: a
   * twenty-turn call spends ~30,000 input tokens before the conversation
   * itself. OpenAI caches a request's stable *prefix*, so the only thing that
   * matters is that the leading messages are byte-identical from one turn to
   * the next.
   *
   * Two consequences shape the code around this:
   *  - the mood block is appended at the END (see `withMood`), never merged
   *    into the system prompt, because mutating the prefix mid-call would
   *    invalidate the cache on the exact turns it matters most;
   *  - `prompt_cache_key` is pinned to the call so concurrent calls for
   *    different clients do not fight over the same cache slot.
   *
   * The cache is a hint, not a contract: a miss simply costs what it costs
   * today. That is why nothing downstream depends on it having worked.
   */
  private withCaching(request: ChatCompletionRequest, vapiCallId: string | null): ChatCompletionRequest {
    const prefix = typeof request.messages?.[0]?.content === 'string' ? request.messages[0].content : '';
    if (prefix.length < MIN_CACHEABLE_PREFIX_CHARS) return request;
    return { ...request, prompt_cache_key: vapiCallId ?? undefined };
  }

  /**
   * Append the mood register as a trailing system message.
   *
   * Trailing, not merged into the opening system prompt, for two reasons: the
   * prompt is fixed at call-start and mood is discovered later, and keeping the
   * long prefix byte-identical across turns is what lets it be cached.
   */
  private withMood(request: ChatCompletionRequest, vapiCallId: string | null, lang: VoiceLanguage): ChatCompletionRequest {
    const mood = callSessionStore.get(vapiCallId)?.mood ?? 'neutral';
    const block = moodPromptBlock(mood, lang);
    if (!block) return request;
    return { ...request, messages: [...request.messages, { role: 'system', content: block }] };
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
        // `include_usage` makes OpenAI emit a final chunk carrying token counts
        // including `cached_tokens` — the only way to verify the cache is
        // actually engaging rather than assume it from the config.
        body: JSON.stringify({
          ...request,
          model,
          stream: true,
          stream_options: { include_usage: true },
        }),
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
        const text = decoder.decode(value, { stream: true });
        const usage = parseUsageChunk(text);
        if (usage) callSessionStore.recordTokens(vapiCallId, usage);
        stream.write(text);
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
