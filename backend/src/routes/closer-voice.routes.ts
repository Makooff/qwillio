/**
 * Twilio Voice browser-dial integration for the Closer Dashboard.
 *
 * Flow:
 *   1. Frontend hits POST /api/closer/voice/token (JWT-authed) and
 *      receives a short-lived Twilio Access Token. The browser SDK
 *      (@twilio/voice-sdk) registers a Device with that token.
 *   2. Closer clicks "Appeler" → browser calls device.connect({ params })
 *      → Twilio hits POST /api/closer/voice/twiml (NO auth, signed by
 *      Twilio) and we return TwiML that <Dial>s the prospect with
 *      `record="record-from-answer"`.
 *   3. Twilio hits POST /api/closer/voice/status-callback at each call
 *      lifecycle event → we upsert a row in `calls` linked to the closer.
 *   4. When the recording is ready, Twilio hits POST
 *      /api/closer/voice/recording-callback with `RecordingSid` +
 *      `RecordingUrl` → we attach those to the Call row.
 *   5. GET /api/closer/voice/calls/:prospectId returns recordings to
 *      the closer UI.
 *
 * Notes on auth:
 *   - /token is JWT + closer-only.
 *   - /twiml, /status-callback, /recording-callback are public webhooks
 *     hit by Twilio. We validate them with twilio.validateRequest().
 *   - /calls/:prospectId is JWT + closer-only.
 */
import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { authMiddleware, closerMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// ─── Public webhooks (Twilio → us) ───────────────────────────
// These three sub-routes accept Twilio's `application/x-www-form-urlencoded`
// callbacks. We validate the signature so attackers can't forge calls.
const publicRouter = Router();

function verifyTwilioRequest(req: Request, res: Response): boolean {
  const sig = req.header('X-Twilio-Signature') || '';
  const url = `${env.API_BASE_URL.replace(/\/$/, '')}${req.originalUrl}`;
  const ok = twilio.validateRequest(env.TWILIO_AUTH_TOKEN, sig, url, req.body || {});
  if (!ok) {
    logger.warn(`[closer-voice] Twilio signature invalid for ${url}`);
    res.status(403).type('text/plain').send('Invalid signature');
    return false;
  }
  return true;
}

/**
 * TwiML callback — Twilio hits this when the browser SDK initiates a
 * call. We return TwiML telling Twilio who to dial and to record the
 * call. The browser passed `To` and `prospectId` as custom params.
 */
publicRouter.post('/twiml', async (req: Request, res: Response) => {
  if (!verifyTwilioRequest(req, res)) return;

  const to         = String(req.body?.To || '').trim();
  const prospectId = String(req.body?.prospectId || '').trim();
  const closerId   = String(req.body?.closerId || '').trim();

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const tw = new VoiceResponse();

  if (!to || !env.TWILIO_PHONE_NUMBER) {
    tw.say('Configuration incomplete. Please contact support.');
    res.type('text/xml').send(tw.toString());
    return;
  }

  const recordingCallback = `${env.API_BASE_URL.replace(/\/$/, '')}/api/closer/voice/recording-callback`;
  const statusCallback    = `${env.API_BASE_URL.replace(/\/$/, '')}/api/closer/voice/status-callback`;

  const dial = tw.dial({
    callerId:                env.TWILIO_PHONE_NUMBER,
    record:                  env.TWILIO_RECORDING_ENABLED ? 'record-from-answer-dual' : undefined,
    recordingStatusCallback: env.TWILIO_RECORDING_ENABLED ? recordingCallback : undefined,
    recordingStatusCallbackEvent: env.TWILIO_RECORDING_ENABLED ? ['completed'] : undefined,
    answerOnBridge:          true,
    timeout:                 30,
  } as any);
  dial.number(
    {
      statusCallback:      statusCallback,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    } as any,
    to,
  );

  // Pre-create a Call row so we can link the recording back.
  if (prospectId) {
    try {
      const startedAt = new Date();
      await prisma.call.create({
        data: {
          prospectId,
          phoneNumber: to,
          direction:   'closer_browser',
          status:      'initiated',
          startedAt,
          closerId:    closerId || null,
          twilioNumberUsed: env.TWILIO_PHONE_NUMBER,
        },
      });
    } catch (err: any) {
      logger.warn(`[closer-voice] failed to pre-create Call: ${err?.message}`);
    }
  }

  res.type('text/xml').send(tw.toString());
});

/** Status callback — fires on initiated/ringing/answered/completed. */
publicRouter.post('/status-callback', async (req: Request, res: Response) => {
  if (!verifyTwilioRequest(req, res)) return;

  const callSid       = String(req.body?.CallSid || '');
  const parentCallSid = String(req.body?.ParentCallSid || '');
  const status        = String(req.body?.CallStatus || '');
  const duration      = parseInt(String(req.body?.CallDuration || '0'), 10) || 0;
  const to            = String(req.body?.To || '');

  // The child leg (Number we dialed) carries ParentCallSid; the parent
  // leg has no ParentCallSid. We persist on the child leg because that
  // is the leg whose recording we own.
  try {
    if (parentCallSid && callSid && to) {
      // Find the most recent initiated row for this destination, no SID yet.
      const pending = await prisma.call.findFirst({
        where: { phoneNumber: to, direction: 'closer_browser', twilioCallSid: null, status: 'initiated' },
        orderBy: { startedAt: 'desc' },
      });
      const data: any = {
        status,
        twilioCallSid: callSid,
      };
      if (status === 'completed') {
        data.endedAt = new Date();
        data.durationSeconds = duration;
      }
      if (pending) {
        await prisma.call.update({ where: { id: pending.id }, data });
      } else {
        // Parent missed our pre-create — log a stub so the recording
        // callback has somewhere to attach.
        await prisma.call.create({
          data: {
            phoneNumber: to,
            direction:   'closer_browser',
            status,
            startedAt:   new Date(),
            twilioCallSid: callSid,
            durationSeconds: status === 'completed' ? duration : null,
            endedAt: status === 'completed' ? new Date() : null,
          },
        });
      }
    }
  } catch (err: any) {
    logger.warn(`[closer-voice] status-callback failed: ${err?.message}`);
  }

  res.status(204).end();
});

/** Recording callback — fires once the recording is ready on Twilio. */
publicRouter.post('/recording-callback', async (req: Request, res: Response) => {
  if (!verifyTwilioRequest(req, res)) return;

  const callSid      = String(req.body?.CallSid || '');
  const recordingSid = String(req.body?.RecordingSid || '');
  const recordingUrl = String(req.body?.RecordingUrl || '');
  const duration     = parseInt(String(req.body?.RecordingDuration || '0'), 10) || 0;

  if (!callSid || !recordingSid) {
    res.status(400).end();
    return;
  }

  try {
    await prisma.call.updateMany({
      where: { twilioCallSid: callSid },
      data: {
        recordingSid,
        recordingUrl: recordingUrl ? `${recordingUrl}.mp3` : null,
        durationSeconds: duration > 0 ? duration : undefined,
      },
    });
    logger.info(`[closer-voice] recording attached: ${recordingSid} → call ${callSid}`);
  } catch (err: any) {
    logger.warn(`[closer-voice] recording-callback failed: ${err?.message}`);
  }

  res.status(204).end();
});

// ─── Authenticated routes (closer browser → us) ──────────────
const privateRouter = Router();
privateRouter.use(authMiddleware);
privateRouter.use(closerMiddleware);

/** Generate a short-lived Twilio Voice Access Token for the browser SDK. */
privateRouter.post('/token', (req: AuthRequest, res: Response) => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_API_KEY_SID || !env.TWILIO_API_KEY_SECRET || !env.TWILIO_TWIML_APP_SID) {
    return res.status(503).json({
      error: 'Twilio Voice non configuré (TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID requis)',
    });
  }

  const identity = `closer_${req.userId || 'unknown'}`;
  const AccessToken = (twilio as any).jwt.AccessToken;
  const VoiceGrant  = AccessToken.VoiceGrant;

  const token = new AccessToken(
    env.TWILIO_ACCOUNT_SID,
    env.TWILIO_API_KEY_SID,
    env.TWILIO_API_KEY_SECRET,
    { identity, ttl: 3600 },
  );
  const grant = new VoiceGrant({
    outgoingApplicationSid: env.TWILIO_TWIML_APP_SID,
    incomingAllow:          false,
  });
  token.addGrant(grant);

  res.json({
    identity,
    token:    token.toJwt(),
    callerId: env.TWILIO_PHONE_NUMBER,
  });
});

/** List recorded calls for a prospect, newest first. */
privateRouter.get('/calls/:prospectId', async (req: AuthRequest, res: Response) => {
  const prospectId = String(req.params?.prospectId || '');
  if (!prospectId) return res.status(400).json({ error: 'prospectId manquant' });

  try {
    const calls = await prisma.call.findMany({
      where: { prospectId, direction: 'closer_browser' },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id:              true,
        startedAt:       true,
        endedAt:         true,
        durationSeconds: true,
        status:          true,
        recordingUrl:    true,
        recordingSid:    true,
        twilioCallSid:   true,
        closerId:        true,
      },
    });
    res.json({ items: calls });
  } catch (err: any) {
    logger.error('[closer-voice] list calls failed:', err);
    res.status(500).json({ error: err?.message || 'Échec' });
  }
});

router.use('/', publicRouter);
router.use('/', privateRouter);

export default router;
