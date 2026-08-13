import { describe, it, expect } from 'vitest';
import {
  buildRealtimePlans,
  buildStartSpeakingPlan,
  buildStopSpeakingPlan,
  buildTranscriber,
  buildVoice,
} from '../speech-plans';

describe('buildTranscriber', () => {
  it('maps language to the right Deepgram code', () => {
    expect(buildTranscriber('fr').language).toBe('fr');
    expect(buildTranscriber('en').language).toBe('en-US');
  });

  it('keeps endpointing aggressive enough for the latency budget', () => {
    // Above ~250ms the caller feels the gap before the assistant answers.
    expect(buildTranscriber('en').endpointing).toBeLessThanOrEqual(250);
  });
});

describe('buildStopSpeakingPlan — barge-in', () => {
  const plan = buildStopSpeakingPlan();

  it('cuts on voice activity, not on a transcribed word', () => {
    // numWords > 0 means waiting for the transcriber, which is what makes an
    // interruption sound like stuttering.
    expect(plan.numWords).toBe(0);
  });

  it('requires real voiced audio so a cough does not cut the assistant', () => {
    expect(plan.voiceSeconds).toBeGreaterThan(0);
  });

  it('backs off long enough to avoid both parties talking over each other', () => {
    expect(plan.backoffSeconds).toBeGreaterThanOrEqual(1);
  });

  it('knows backchannels in both languages', () => {
    expect(plan.acknowledgementPhrases).toContain('mm-hmm');
    expect(plan.acknowledgementPhrases).toContain('d\'accord');
  });
});

describe('buildStartSpeakingPlan', () => {
  it('keeps the hard wait under the perceived-latency budget', () => {
    expect(buildStartSpeakingPlan('en').waitSeconds).toBeLessThan(0.3);
  });

  it('enables smart endpointing so the floor can stay low', () => {
    expect(buildStartSpeakingPlan('fr').smartEndpointingEnabled).toBe(true);
  });

  it('answers faster after a question mark than after an unfinished clause', () => {
    const plan = buildStartSpeakingPlan('en');
    expect(plan.transcriptionEndpointingPlan.onPunctuationSeconds).toBeLessThan(
      plan.transcriptionEndpointingPlan.onNoPunctuationSeconds
    );
  });

  it('uses the LiveKit turn model for English, with its wait curve', () => {
    const plan = buildStartSpeakingPlan('en');
    expect(plan.smartEndpointingPlan.provider).toBe('livekit');
    expect(plan.smartEndpointingPlan).toHaveProperty('waitFunction');
  });

  it('keeps the documented Vapi turn model for French by default', () => {
    // The English-only LiveKit model degraded French turn-taking once already
    // (see the comment in speech-plans.ts). Switching French back to LiveKit
    // must stay an explicit env opt-in (VOICE_FR_ENDPOINTING_PROVIDER), never
    // the silent default.
    const plan = buildStartSpeakingPlan('fr');
    expect(plan.smartEndpointingPlan.provider).toBe('vapi');
  });

  it('switches French to the LiveKit multilingual model on explicit env opt-in', async () => {
    const { env } = await import('../../../config/env');
    const previous = env.VOICE_FR_ENDPOINTING_PROVIDER;
    (env as { VOICE_FR_ENDPOINTING_PROVIDER: string }).VOICE_FR_ENDPOINTING_PROVIDER = 'livekit';
    try {
      const plan = buildStartSpeakingPlan('fr');
      expect(plan.smartEndpointingPlan.provider).toBe('livekit');
      expect(plan.smartEndpointingPlan).toHaveProperty('waitFunction');
    } finally {
      (env as { VOICE_FR_ENDPOINTING_PROVIDER: string }).VOICE_FR_ENDPOINTING_PROVIDER = previous;
    }
  });
});

describe('buildVoice', () => {
  const voice = buildVoice({ voiceId: 'voice_x' });

  it('pins the low-latency ElevenLabs model', () => {
    expect(voice.model).toBe('eleven_flash_v2_5');
  });

  it('streams the first chunk small so audio starts before the sentence ends', () => {
    expect(voice.chunkPlan.enabled).toBe(true);
    expect(voice.chunkPlan.minCharacters).toBeLessThanOrEqual(30);
  });

  it('keeps the fallback voices on the same fast model', () => {
    for (const fallback of voice.fallbackPlan.voices) {
      expect(fallback.model).toBe('eleven_flash_v2_5');
    }
  });
});

describe('buildRealtimePlans', () => {
  it('ships transcriber, start and stop plans together', () => {
    const plans = buildRealtimePlans('fr');
    expect(plans.transcriber).toBeDefined();
    expect(plans.startSpeakingPlan).toBeDefined();
    expect(plans.stopSpeakingPlan).toBeDefined();
  });

  it('does not carry the legacy interruption knobs', () => {
    // interruptionsEnabled / numWordsToInterruptAssistant are superseded by the
    // stop-speaking plan; shipping both makes the behaviour ambiguous.
    const plans = buildRealtimePlans('en') as Record<string, unknown>;
    expect(plans.interruptionsEnabled).toBeUndefined();
    expect(plans.numWordsToInterruptAssistant).toBeUndefined();
    expect(plans.responseDelaySeconds).toBeUndefined();
  });
});
