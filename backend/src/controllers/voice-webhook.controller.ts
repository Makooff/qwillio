import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { storeError } from '../utils/error-store';
import { clientCallService } from '../services/client-call.service';
import { realtimeOrchestratorService, type VapiEvent } from '../services/voice/realtime-orchestrator.service';
import { callSessionStore } from '../services/voice/call-session.store';
import { voiceMetricsService } from '../services/voice/voice-metrics.service';
import { isVapiWebhookAuthorized } from '../utils/vapi-webhook-auth';

/**
 * Streaming webhook surface for the receptionist (Phase 2.1).
 *
 * The old handler awaited a `webhookLog` insert before dispatching, then awaited
 * the handler itself, for every event type including per-utterance transcripts.
 * Vapi holds the streaming channel against this endpoint, so that insert sat in
 * the audio path several times a second.
 *
 * The rule enforced here: **events the caller is waiting on are answered
 * inline; everything else acknowledges first and persists after.** Concretely,
 * `assistant-request` and tool calls compute their response before replying;
 * transcript, speech and status events return 200 immediately and mutate only
 * in-memory state.
 */

/** Event types that are pure telemetry — never worth a synchronous DB write. */
const HOT_PATH_EVENTS = new Set(['transcript', 'speech-update', 'conversation-update', 'status-update']);

/**
 * Log the event without blocking the response. Hot-path events are dropped
 * entirely: at several per second per call they would dominate the webhook_logs
 * table while telling us nothing the end-of-call report does not.
 */
function logEventAsync(source: string, messageType: string, payload: unknown): void {
  // Test against the raw Vapi message type, not the stored label — the label is
  // namespaced (`client_transcript`) and would never match the hot-path set.
  if (HOT_PATH_EVENTS.has(messageType)) return;
  setImmediate(() => {
    prisma.webhookLog
      .create({ data: { source, eventType: `client_${messageType}`, payload: payload as any, status: 'received' } })
      .catch(err => logger.debug(`[Voice] webhook log failed: ${err.message}`));
  });
}

export class VoiceWebhookController {
  /**
   * Single entry point for a client's receptionist: POST /webhooks/vapi/client/:clientId
   */
  async clientEvent(req: Request, res: Response) {
    if (!isVapiWebhookAuthorized(req)) {
      logger.warn('[Voice] webhook unauthorized (missing or invalid x-vapi-secret)');
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const clientId = req.params.clientId as string;
    const event = req.body as VapiEvent;
    const messageType: string = event.message?.type || event.type || 'unknown';

    logEventAsync('vapi', messageType, { clientId, ...event });

    try {
      switch (messageType) {
        // ── Caller is waiting: answer inline ──
        case 'assistant-request': {
          const assistant = await realtimeOrchestratorService.buildAssistantForCall(clientId, event);
          if (!assistant) {
            return res.status(404).json({ error: 'Unknown client' });
          }
          return res.json({ assistant });
        }

        case 'tool-calls':
        case 'function-call': {
          const results = await realtimeOrchestratorService.handleToolCalls(clientId, event);
          return res.json({ results });
        }

        // ── Caller is not waiting: acknowledge, then work ──
        case 'transcript':
          realtimeOrchestratorService.handleTranscript(event);
          return res.json({ received: true });

        case 'speech-update':
          realtimeOrchestratorService.handleSpeechUpdate(event);
          return res.json({ received: true });

        case 'call-start':
        case 'call-started':
        case 'status-update': {
          res.json({ received: true });
          // Fire-and-forget: nothing downstream of this changes what the caller
          // hears on this event.
          void realtimeOrchestratorService
            .handleStatusUpdate(clientId, event)
            .catch(err => logger.warn(`[Voice] status-update failed: ${err.message}`));
          return;
        }

        // Both parties are waiting on the destination, so it is answered
        // inline: the brief is built from memory and the SMS is not awaited.
        case 'transfer-destination-request': {
          const answer = await realtimeOrchestratorService.handleTransferRequest(clientId, event);
          void clientCallService
            .logTransfer(clientId, event.message?.call?.id || event.call?.id, 'initiated', event)
            .catch(err => logger.error(`[Voice] transfer log failed for ${clientId}:`, err));
          // No transfer number configured: an empty answer makes Vapi keep the
          // caller with the assistant rather than dropping the call.
          return res.json(answer ?? {});
        }

        case 'transfer-update': {
          res.json({ received: true });
          const vapiCallId = event.message?.call?.id || event.call?.id;
          const status = event.message?.status || event.status || 'initiated';
          void clientCallService
            .logTransfer(clientId, vapiCallId, status, event)
            .catch(err => logger.error(`[Voice] transfer log failed for ${clientId}:`, err));
          return;
        }

        case 'end-of-call-report': {
          res.json({ received: true });
          void this.finalize(clientId, event).catch(err => {
            logger.error(`[Voice] end-of-call processing failed for ${clientId}:`, err);
            storeError(err.message, err.stack || '', `/api/webhooks/vapi/client/${clientId}`);
          });
          return;
        }

        default:
          logger.debug(`[Voice] unhandled event: ${messageType}`);
          return res.json({ received: true });
      }
    } catch (error: any) {
      logger.error(`[Voice] webhook error (${messageType}) for client ${clientId}: ${error.message}`);
      storeError(error.message, error.stack || '', `/api/webhooks/vapi/client/${clientId}`);
      if (!res.headersSent) {
        return res.status(200).json({ received: true, error: 'handler failed' });
      }
      return;
    }
  }

  /**
   * Dedicated tool endpoint: POST /webhooks/vapi/tools/:clientId
   *
   * Tools point here rather than at the main event URL so the round-trip the
   * caller is actually waiting on never queues behind telemetry events.
   */
  async toolCall(req: Request, res: Response) {
    if (!isVapiWebhookAuthorized(req)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
    const clientId = req.params.clientId as string;
    const started = Date.now();

    try {
      const results = await realtimeOrchestratorService.handleToolCalls(clientId, req.body as VapiEvent);
      const elapsed = Date.now() - started;
      if (elapsed > 1_500) {
        logger.warn(`[Voice] slow tool round-trip for ${clientId}: ${elapsed}ms`);
      }
      return res.json({ results });
    } catch (error: any) {
      logger.error(`[Voice] tool call failed for ${clientId}: ${error.message}`);
      // A 200 with an empty result set keeps the model talking; a 500 makes
      // Vapi drop the turn and the caller hears silence.
      return res.json({ results: [] });
    }
  }

  /**
   * End-of-call: flush in-memory state, run the existing analysis pipeline,
   * then attach the real-time metrics to the row it created.
   */
  private async finalize(clientId: string, event: VapiEvent): Promise<void> {
    const finalized = await realtimeOrchestratorService.finalizeCall(clientId, event);
    if (!finalized) return;

    // Agrégation flotte avant tout court-circuit: un répondeur a quand même
    // coûté de l'argent, et une latence mesurée est une latence comptée.
    voiceMetricsService.record(
      finalized.metrics as { latency?: Record<string, unknown> } | null,
      finalized.billing as { costUsd?: number | null } | null,
    );

    const vapiCallId = event.message?.call?.id || event.call?.id;
    const recordingUrl = event.message?.recordingUrl || event.recordingUrl;
    const endedReason = event.message?.endedReason || event.endedReason || '';

    // Voicemail / no-answer: nothing to analyse, and paying GPT-4 to summarise
    // an empty transcript is pure waste.
    if (endedReason === 'voicemail' || endedReason === 'customer-did-not-answer') {
      logger.info(`[Voice] call ${vapiCallId} ended as ${endedReason} — skipping analysis`);
      return;
    }

    await clientCallService.handleClientCallCompleted(
      clientId,
      vapiCallId,
      finalized.transcript,
      finalized.durationSeconds,
      finalized.callerNumber ?? undefined,
      recordingUrl,
      finalized.voiceMode,
    );

    await realtimeOrchestratorService.persistMetrics(
      vapiCallId,
      finalized.metrics as Record<string, unknown> | null,
      finalized.billing as Record<string, unknown> | null,
    );

    // Caller memory last: it reads the ClientCall row the analysis just wrote.
    await realtimeOrchestratorService.persistMemory({
      clientId,
      vapiCallId,
      callerNumber: finalized.callerNumber,
      metrics: finalized.metrics as never,
    });
  }

  /** Liveness probe for the voice layer — used by the admin health panel. */
  async health(_req: Request, res: Response) {
    return res.json({
      liveCalls: callSessionStore.liveCount(),
      sharedCache: Boolean(env.REDIS_URL),
      endpointingMs: env.VOICE_ENDPOINTING_MS,
      startWaitSeconds: env.VOICE_START_WAIT_SECONDS,
      bargeInBackoffSeconds: env.VOICE_BARGE_IN_BACKOFF_SECONDS,
      // P50/P95/P99 par étage + coût moyen, fenêtre glissante depuis le boot.
      fleetMetrics: voiceMetricsService.summary(),
    });
  }
}

export const voiceWebhookController = new VoiceWebhookController();
