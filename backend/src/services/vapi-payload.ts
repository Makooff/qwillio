import { env } from '../config/env';

/**
 * Builds the Vapi `createCall` payload. Extracted from vapi.service so the
 * (previously duplicated) ~50 lines of static call config live in one tested
 * place. Only the dynamic per-call values are passed in — the rest (voice
 * tuning, voicemail detection, fallbacks) is identical for every call.
 */
export interface VapiCallPayloadInput {
  assistantId: string;
  customerNumber: string;
  customerName: string;
  systemPrompt: string;
  voiceId: string;
  firstMessage: string;
}

export function buildVapiCallPayload(input: VapiCallPayloadInput) {
  return {
    assistantId: input.assistantId,
    phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
    customer: {
      number: input.customerNumber,
      name: input.customerName,
    },
    assistantOverrides: {
      model: {
        provider: 'openai',
        model: env.VAPI_MODEL,
        messages: [{ role: 'system', content: input.systemPrompt }],
      },
      voice: {
        provider: '11labs',
        voiceId: input.voiceId,
        model: 'eleven_flash_v2_5', // <300ms latency → sounds more human (quick reactions)
        stability: 0.22,        // low = natural pitch variation, not flat
        similarityBoost: 0.65,  // less "clean" = more human
        style: 0.70,            // high expressiveness
        useSpeakerBoost: true,
        optimizeStreamingLatency: env.VAPI_OPTIMIZE_LATENCY,
        speed: 1.0, // natural pace
        fallbackPlan: {
          voices: [
            { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_1 || '9BWtsMINqrJLrRacOk9x' }, // Aria
            { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_2 || 'EXAVITQu4vr4xnSDxMaL' }, // Sarah
          ],
        },
      },
      backgroundSound: 'office',
      silenceTimeoutSeconds: env.VAPI_SILENCE_TIMEOUT,
      maxDurationSeconds: env.VAPI_MAX_DURATION,
      responseDelaySeconds: 0.2, // faster turn-taking
      interruptionsEnabled: true,
      numWordsToInterruptAssistant: Math.round(env.VAPI_INTERRUPTION_THRESHOLD / 50),
      firstMessage: input.firstMessage,
      // ── Voicemail / answering machine detection ──
      // Twilio AMD detects machine on pickup (up to 6s). If detected, VAPI
      // invokes endCallFunction automatically — no minutes wasted, no message left.
      voicemailDetection: {
        provider: 'twilio',
        enabled: true,
        machineDetectionTimeout: 6,
        machineDetectionSpeechThreshold: 2400,
        machineDetectionSpeechEndThreshold: 1200,
        machineDetectionSilenceTimeout: 5000,
      },
      endCallFunctionEnabled: true,
      endCallMessage: '', // don't leave a message on voicemail
    },
  };
}
