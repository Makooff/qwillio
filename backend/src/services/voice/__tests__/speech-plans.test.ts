import { describe, it, expect } from 'vitest';
import {
  buildRealtimePlans,
  buildSpeech,
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

describe('fallbacks fournisseurs — opt-in strict', () => {
  // Un champ inconnu rejette l'assistant ENTIER chez Vapi: tant que les
  // variables d'env sont vides, le schéma doit être identique à l'existant.
  it('sans env, aucun champ de fallback ne part vers Vapi', () => {
    const t = buildTranscriber('fr') as Record<string, unknown>;
    expect(t.fallbackPlan).toBeUndefined();
  });

  it('le secours Deepgram parle le vocabulaire de Deepgram, pas du BCP-47', async () => {
    // Le defaut signale en production: `fr-FR` n'existe pas chez Deepgram, qui
    // attend `fr`. Vapi rejetait alors l'assistant ENTIER, donc AUCUN appel ne
    // demarrait, avec un message qui ne parlait ni de langue ni de secours.
    const { env } = await import('../../../config/env');
    const prev = env.VOICE_STT_FALLBACK_PROVIDER;
    (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = 'deepgram';
    try {
      const t = buildTranscriber('fr') as { fallbackPlan?: { transcribers: Array<Record<string, string>> } };
      expect(t.fallbackPlan?.transcribers).toEqual([
        { provider: 'deepgram', model: 'nova-2', language: 'fr' },
      ]);
      // Le modele est DECLARE: sans lui, Vapi retombe sur son defaut, et c'est
      // ce defaut implicite qui decidait des langues acceptees.
      const nl = buildTranscriber('nl') as { fallbackPlan?: { transcribers: Array<Record<string, string>> } };
      expect(nl.fallbackPlan?.transcribers[0].language).toBe('nl');
    } finally {
      (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = prev;
    }
  });

  it('avec env, le transcriber déclare son secours dans la bonne langue', async () => {
    const { env } = await import('../../../config/env');
    const prev = env.VOICE_STT_FALLBACK_PROVIDER;
    (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = 'google';
    try {
      const t = buildTranscriber('nl') as { fallbackPlan?: { transcribers: Array<{ provider: string; language: string }> } };
      expect(t.fallbackPlan?.transcribers).toEqual([{ provider: 'google', language: 'nl-NL' }]);
    } finally {
      (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = prev;
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

describe('secours desactivables par appel', () => {
  // Les appels navigateur (test du portail, configuration a la voix) paient le
  // demarrage des secours en attente visible. Les vrais appels entrants les
  // gardent: une ligne muette coute un client. D'ou un drapeau par appel, et
  // non une variable d'environnement qui aurait retire les deux a la fois.
  it('le transcripteur n\'emporte plus son secours quand on le refuse', async () => {
    const { env } = await import('../../../config/env');
    const prevStt = env.VOICE_STT_FALLBACK_PROVIDER;
    (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = 'deepgram';
    try {
      expect((buildTranscriber('fr') as Record<string, unknown>).fallbackPlan).toBeDefined();
      expect((buildTranscriber('fr', { fallbacks: false }) as Record<string, unknown>).fallbackPlan).toBeUndefined();
    } finally {
      (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = prevStt;
    }
  });

  it('les plans temps reel transmettent le refus au transcripteur', async () => {
    const { env } = await import('../../../config/env');
    const prevStt = env.VOICE_STT_FALLBACK_PROVIDER;
    (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = 'deepgram';
    try {
      const plans = buildRealtimePlans('fr', false, { fallbacks: false }) as { transcriber?: Record<string, unknown> };
      expect(plans.transcriber?.fallbackPlan).toBeUndefined();
      // Sans le drapeau, rien ne change pour les vrais appels.
      const real = buildRealtimePlans('fr', false) as { transcriber?: Record<string, unknown> };
      expect(real.transcriber?.fallbackPlan).toBeDefined();
    } finally {
      (env as { VOICE_STT_FALLBACK_PROVIDER: string }).VOICE_STT_FALLBACK_PROVIDER = prevStt;
    }
  });

  it('les modeles de secours suivent la meme regle', async () => {
    const { env } = await import('../../../config/env');
    const prev = env.VOICE_LLM_FALLBACK_MODELS;
    (env as { VOICE_LLM_FALLBACK_MODELS: string[] }).VOICE_LLM_FALLBACK_MODELS = ['gpt-4o-mini'];
    try {
      // `classic` explicite: le mode parole-a-parole n'a pas de modeles de
      // secours a declarer, il n'y aurait donc rien a mesurer ici.
      const base = {
        lang: 'fr' as const, systemPrompt: 'x', tools: [],
        character: { voiceId: 'v', gender: 'f' as const },
        voiceMode: 'classic' as const,
      };
      expect((buildSpeech(base).model as Record<string, unknown>).fallbackModels).toEqual(['gpt-4o-mini']);
      expect((buildSpeech({ ...base, fallbacks: false }).model as Record<string, unknown>).fallbackModels).toBeUndefined();
    } finally {
      (env as { VOICE_LLM_FALLBACK_MODELS: string[] }).VOICE_LLM_FALLBACK_MODELS = prev;
    }
  });
});
