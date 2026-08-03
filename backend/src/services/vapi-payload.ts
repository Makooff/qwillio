import { env } from '../config/env';
import { buildRealtimePlans, buildVoice } from './voice/speech-plans';

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
      // Same real-time tuning as the inbound receptionist: outbound prospects
      // hang up on a robot just as fast as inbound callers do. The legacy
      // `responseDelaySeconds` / `interruptionsEnabled` / `numWordsToInterrupt`
      // trio is superseded by the start- and stop-speaking plans.
      voice: buildVoice({ voiceId: input.voiceId }),
      backgroundSound: 'office',
      ...buildRealtimePlans('en'),
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
