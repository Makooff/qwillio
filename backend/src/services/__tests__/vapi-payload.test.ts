import { describe, it, expect } from 'vitest';
import { buildVapiCallPayload } from '../vapi-payload';

const input = {
  assistantId: 'asst_1',
  customerNumber: '+15551234567',
  customerName: 'Acme Dental',
  systemPrompt: 'You are Ashley.',
  voiceId: 'voice_x',
  firstMessage: 'Hi, this is Ashley.',
};

describe('buildVapiCallPayload', () => {
  it('maps the dynamic inputs into the right slots', () => {
    const p = buildVapiCallPayload(input);
    expect(p.assistantId).toBe('asst_1');
    expect(p.customer).toEqual({ number: '+15551234567', name: 'Acme Dental' });
    expect(p.assistantOverrides.model.messages).toEqual([{ role: 'system', content: 'You are Ashley.' }]);
    expect(p.assistantOverrides.voice.voiceId).toBe('voice_x');
    expect(p.assistantOverrides.firstMessage).toBe('Hi, this is Ashley.');
  });

  it('pins the human-tuned voice + latency config', () => {
    const v = buildVapiCallPayload(input).assistantOverrides.voice;
    expect(v.provider).toBe('11labs');
    expect(v.model).toBe('eleven_flash_v2_5');
    /* 0,22 laissait le modèle Flash avaler des syllabes: la voix était
       expressive et mal comprise. Le défaut remonte à 0,45, et un plancher à
       0,35 empêche un personnage de redescendre sous le seuil d'articulation
       (voir `speech-plans.buildVoice`). */
    expect(v.stability).toBe(0.45);
    expect(v.similarityBoost).toBe(0.65);
    expect(v.style).toBe(0.70);
    expect(v.useSpeakerBoost).toBe(true);
    expect(v.fallbackPlan.voices).toHaveLength(2);
  });

  it('always enables Twilio voicemail detection and a silent end-call', () => {
    const o = buildVapiCallPayload(input).assistantOverrides;
    expect(o.voicemailDetection).toMatchObject({ provider: 'twilio', enabled: true, machineDetectionTimeout: 6 });
    expect(o.endCallFunctionEnabled).toBe(true);
    expect(o.endCallMessage).toBe('');
    expect(o.backgroundSound).toBe('office');
  });

  it('drives barge-in from the stop-speaking plan, not the legacy flags', () => {
    const o = buildVapiCallPayload(input).assistantOverrides as Record<string, any>;
    // Outbound calls now share the inbound receptionist's turn-taking tuning.
    // Des mots, pas du bruit: voir `buildStopSpeakingPlan`. Les appels
    // sortants partagent la tolérance au bruit des appels entrants.
    expect(o.stopSpeakingPlan.numWords).toBeGreaterThan(0);
    expect(o.startSpeakingPlan.smartEndpointingEnabled).toBe(true);
    expect(o.transcriber.provider).toBe('deepgram');
    // The superseded trio must be gone: shipping both makes the behaviour
    // ambiguous, and Vapi resolves the conflict in an undocumented order.
    expect(o.interruptionsEnabled).toBeUndefined();
    expect(o.numWordsToInterruptAssistant).toBeUndefined();
    expect(o.responseDelaySeconds).toBeUndefined();
  });
});
