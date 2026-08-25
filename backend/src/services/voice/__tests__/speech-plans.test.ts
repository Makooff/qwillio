import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';
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

  it('attend des MOTS, pour que le bruit ambiant ne la coupe pas', () => {
    /* Ce test disait l'inverse (`numWords === 0`), au nom de l'instantanéité.
       Le terrain a tranché: « elle arrête de parler dès qu'elle entend un peu
       de bruit ». Une porte ou une radio valent une activité vocale, jamais un
       mot transcrit, et c'est la seule frontière qui sépare les deux. */
    expect(plan.numWords).toBeGreaterThan(0);
    // Au delà de 3, l'interruption volontaire se fait attendre à l'oreille.
    expect(plan.numWords).toBeLessThanOrEqual(3);
  });

  it("exige assez d'audio voisé pour qu'une porte ne la coupe pas", () => {
    /* Ce test se contentait de « > 0 », et il passait au vert avec le défaut
       de Vapi, 0,2 s, qui coupait sur une toux. Les deux règles ne sont PAS en
       série: celle-ci agit seule, sur l'énergie, sans passer par le
       transcripteur, donc `numWords` ne la couvre pas. C'est le déclencheur
       qui restait ouvert après la correction précédente. */
    expect(plan.voiceSeconds).toBeGreaterThan(0.2);
    // Au delà d'une demi-seconde, l'interruption volontaire s'entend traîner.
    expect(plan.voiceSeconds).toBeLessThanOrEqual(0.6);
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

  it('sert le modèle choisi, et le MÊME que l\'aperçu du sélecteur', () => {
    /* Ce test figeait `eleven_flash_v2_5`, le plus rapide et le plus plat.
       Deux retours de suite sur le même mot (« ça articule trop, pas assez
       naturel ») l'ont fait passer à `turbo`. Ce qui compte ici n'est plus la
       valeur mais l'accord: l'aperçu du sélecteur synthétise sur la même
       variable, sinon on auditionne une voix et l'appelant en entend une
       autre. Retour arrière par `VOICE_TTS_MODEL`, sans déploiement. */
    expect(voice.model).toBe(env.VOICE_TTS_MODEL);
  });

  it('rend au synthétiseur de quoi faire une PHRASE', () => {
    /* Ce test exigeait l'inverse (≤ 30 caractères), au nom du premier son.
       Le terrain a tranché: « ça parle trop haché, ça articule trop ». Un
       fragment sans contexte ne peut pas être prononcé naturellement, quelle
       que soit la vitesse à laquelle il part. */
    expect(voice.chunkPlan.enabled).toBe(true);
    expect(voice.chunkPlan.minCharacters).toBeGreaterThanOrEqual(40);
    // Au delà d'une phrase entière, on attendrait le point pour rien.
    expect(voice.chunkPlan.minCharacters).toBeLessThanOrEqual(120);
  });

  it('ne coupe qu\'aux FINS DE PHRASE', () => {
    // La virgule était une frontière: une phrase de trois virgules partait en
    // quatre morceaux, chacun terminé comme une fin. C'est le « haché ».
    expect(voice.chunkPlan.punctuationBoundaries).toEqual(['.', '!', '?']);
  });

  it('plafonne le style, qui rendait la diction théâtrale', () => {
    expect(voice.style).toBeLessThanOrEqual(0.45);
  });

  it('keeps the fallback voices on the same model', () => {
    // Une voix de secours d'un autre grain s'entendrait au basculement.
    for (const fallback of voice.fallbackPlan.voices) {
      expect(fallback.model).toBe(env.VOICE_TTS_MODEL);
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

  /**
   * LE DÉFAUT LE PLUS COÛTEUX DE CE FICHIER, et il ne se voyait pas.
   *
   * En parole-à-parole le transcripteur est retiré, à raison. Mais les deux
   * plans de parole étaient TOUJOURS envoyés, alors qu'ils comptent des mots:
   * `numWords`, `acknowledgementPhrases`, `interruptionPhrases`, et un plan
   * nommé `transcriptionEndpointingPlan`. Sans transcripteur, aucune de ces
   * conditions ne peut être remplie: la réceptionniste n'entend rien, ne
   * répond pas, et le délai de silence raccroche.
   *
   * Symptôme rapporté en mode Direct: « il ne m'entend pas quand je parle, et
   * ça raccroche vite ».
   */
  it("N'ENVOIE AUCUNE CONDITION EN MOTS en parole-à-parole", () => {
    const plans = buildRealtimePlans('fr', true) as Record<string, unknown>;
    expect(plans.transcriber).toBeUndefined();
    expect(plans.startSpeakingPlan).toBeUndefined();
  });

  /**
   * La correction ci-dessus retirait les DEUX plans, et elle allait trop loin.
   *
   * Un plan sur deux est fait de mots, l'autre pas. `voiceSeconds` et
   * `backoffSeconds` se mesurent sur l'audio: ils n'ont jamais eu besoin d'un
   * transcripteur. Les retirer laissait le seuil de bruit au défaut de Vapi,
   * 0,2 s, d'où le défaut suivant, rapporté en mode Direct: « il s'arrête de
   * parler alors que je ne parle pas ».
   */
  it('règle quand même le seuil de BRUIT, qui lui ne compte pas de mots', () => {
    const plans = buildRealtimePlans('fr', true) as Record<string, unknown>;
    const stop = plans.stopSpeakingPlan as Record<string, unknown>;
    expect(stop).toBeDefined();
    expect(stop.voiceSeconds).toBeGreaterThan(0.2);
    expect(stop.backoffSeconds).toBeGreaterThanOrEqual(1);
    // Rien qui attende un transcript: c'est ce qui rendait la réceptionniste
    // sourde. Le zéro est donc délibéré, et il doit le rester.
    expect(stop.numWords).toBe(0);
    expect(stop.acknowledgementPhrases).toBeUndefined();
    expect(stop.interruptionPhrases).toBeUndefined();
  });

  it('garde tout ce qui ne dépend PAS du transcripteur', () => {
    // Les repères de temps, eux, restent valables: ils se comptent en
    // secondes, pas en mots.
    const plans = buildRealtimePlans('fr', true) as Record<string, unknown>;
    expect(plans.silenceTimeoutSeconds).toBeDefined();
    expect(plans.maxDurationSeconds).toBeDefined();
    expect(plans.messagePlan).toBeDefined();
    expect(plans.firstMessageMode).toBe('assistant-speaks-first');
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
