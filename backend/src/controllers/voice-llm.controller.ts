import { Request, Response } from 'express';
import { logger } from '../config/logger';
import { llmStreamService, type ChatCompletionRequest } from '../services/voice/llm-stream.service';
import { realtimeContextService } from '../services/voice/realtime-context.service';
import { callSessionStore } from '../services/voice/call-session.store';
import { isVapiWebhookAuthorized } from '../utils/vapi-webhook-auth';

/**
 * OpenAI-compatible streaming endpoint Vapi calls when a client is on the
 * custom-LLM path. See services/voice/llm-stream.service.ts for the policy.
 *
 * The only job here is transport: authenticate, open the SSE channel with the
 * headers that keep proxies from buffering it, and hand the socket to the
 * service. Any buffering between here and Vapi would erase the entire point.
 */

export class VoiceLlmController {
  async chatCompletions(req: Request, res: Response) {
    if (!isVapiWebhookAuthorized(req)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const clientId = req.params.clientId as string;
    const body = req.body as ChatCompletionRequest;

    if (!body || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: 'messages[] required' });
    }

    // Vapi passes the call id through so we can attribute deflection stats.
    const vapiCallId =
      (req.headers['x-call-id'] as string | undefined) ??
      (body.call as { id?: string } | undefined)?.id ??
      null;

    // Language decides which phrase lists the router uses. The live session
    // already knows it; the cached profile is the fallback after a restart.
    const session = callSessionStore.get(vapiCallId);
    const lang = session?.language ?? (await realtimeContextService.getClientProfile(clientId))?.language ?? 'en';

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Render sits behind a proxy that will otherwise buffer the whole response.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
    const stream = {
      write: (chunk: string) => {
        if (!closed) res.write(chunk);
      },
      end: () => {
        if (!closed) {
          closed = true;
          res.end();
        }
      },
    };

    // The caller hung up mid-turn: stop writing into a dead socket.
    req.on('close', () => {
      closed = true;
    });

    try {
      await llmStreamService.handle(clientId, vapiCallId, lang, body, stream);
    } catch (error) {
      logger.error(`[VoiceLLM] unhandled error for ${clientId}: ${(error as Error).message}`);
    } finally {
      stream.end();
    }
  }
}

export const voiceLlmController = new VoiceLlmController();
