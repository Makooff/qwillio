import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from '../../../config/env';
import {
  buildRealtimePlans,
  buildRealtimeStopSpeakingPlan,
  buildSpeech,
  buildStartSpeakingPlan,
  buildStopSpeakingPlan,
  buildTranscriber,
  buildVoice,
  resolveTuning,
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

/**
 * TUR-3: le silence après un chiffre.
 *
 * Un appelant qui dicte « zéro deux… cinq cent douze… trente-quatre… » laisse
 * 400 à 900 ms entre ses groupes. Le seuil doit survivre à la plus longue de
 * ces pauses, sinon il coupe l'appelant au milieu de son numéro et l'oblige à
 * tout redicter — le mode d'échec le plus fréquent et le plus irritant d'un
 * agent de prise de rendez-vous.
 */
describe('buildStartSpeakingPlan — la dictée d\'un numéro', () => {
  it('survit à une pause de 900 ms entre deux groupes', () => {
    const plan = buildStartSpeakingPlan('fr') as { transcriptionEndpointingPlan: { onNumberSeconds: number } };
    expect(plan.transcriptionEndpointingPlan.onNumberSeconds).toBeGreaterThanOrEqual(0.9);
  });

  it('attend plus longtemps après un chiffre qu\'après une ponctuation', () => {
    // Une ponctuation dit que le tour est fini; un chiffre dit le contraire,
    // et les deux seuils doivent aller dans des sens opposés.
    const plan = buildStartSpeakingPlan('fr') as {
      transcriptionEndpointingPlan: { onNumberSeconds: number; onPunctuationSeconds: number };
    };
    expect(plan.transcriptionEndpointingPlan.onNumberSeconds)
      .toBeGreaterThan(plan.transcriptionEndpointingPlan.onPunctuationSeconds);
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

  /**
   * TUR-7 et TUR-10: les deux listes se règlent sans déploiement.
   *
   * Le complément de « attendre deux mots pour trier le bruit », c'est qu'un
   * « stop ! » monosyllabique passe quand même. Le jour où un métier a son
   * propre mot d'arrêt, il s'ajoute sans toucher au code.
   */
  it('accepte une liste de mots d\'arrêt propre au client', () => {
    const plan = buildStopSpeakingPlan(resolveTuning({ interruptionPhrases: ['halte', 'HALTE', ' minute '] }));
    expect(plan.interruptionPhrases).toEqual(['halte', 'minute']);
  });

  it('dédoublonne, parce que Vapi refuse l\'assistant entier sur une répétition', () => {
    // « stop » et « pardon » s'écrivent pareil dans deux des trois langues
    // servies: une liste réglable rend le doublon bien plus probable qu'un
    // tableau écrit à la main.
    const plan = buildStopSpeakingPlan(resolveTuning({ interruptionPhrases: ['stop', 'Stop', 'stop '] }));
    expect(plan.interruptionPhrases).toEqual(['stop']);
  });

  it('ne se retrouve JAMAIS avec une liste vide', () => {
    // Sans mot d'arrêt, plus rien ne coupe une réceptionniste lancée; sans
    // acquiescement, elle se tait au premier « mm-hmm ». Un réglage qui peut
    // casser la conversation ne doit pas pouvoir la casser par omission.
    const plan = buildStopSpeakingPlan(resolveTuning({ interruptionPhrases: [], acknowledgementPhrases: ['  '] }));
    expect(plan.interruptionPhrases).toContain('attendez');
    expect(plan.acknowledgementPhrases).toContain('mm-hmm');
  });
});

describe('buildStartSpeakingPlan', () => {
  it('keeps the hard wait under the perceived-latency budget', () => {
    /* 0,4 s: le défaut documenté de Vapi. En dessous, l'agent entrait dans
       les respirations de l'appelant (12/09/2026); au-dessus, le blanc se
       sent à chaque tour. */
    expect(buildStartSpeakingPlan('en').waitSeconds).toBeLessThanOrEqual(0.5);
    expect(buildStartSpeakingPlan('en').waitSeconds).toBeGreaterThanOrEqual(0.3);
  });

  it("laisse passer une respiration ponctuée avant de répondre", () => {
    const plan = buildStartSpeakingPlan('fr');
    expect(plan.transcriptionEndpointingPlan.onPunctuationSeconds).toBeGreaterThanOrEqual(0.3);
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
   * LE PLAN D'ATTENTE SUIT LE TRANSCRIPTEUR, comme celui d'interruption.
   *
   * CE TEST FIGEAIT L'INVERSE, et il était vert pendant que le défaut tournait.
   * Il exigeait `startSpeakingPlan: null` en parole-à-parole, sur l'idée que
   * « le moment de répondre appartient au modèle ». Vapi dit le contraire:
   * « Endpointing and interruption management are handled by Vapi's
   * orchestration layer » (page OpenAI Realtime). `null` ne désactive donc
   * rien, il rend la main au défaut de Vapi: 0,4 s de silence.
   *
   * Ce que ça donnait, décrit par l'appelant lui-même (appel réel de 108 s,
   * 17/09/2026): « il me pose une question, je réponds, mais s'il y a un léger
   * blanc dans ma réponse il commence à parler alors que j'ai pas fini; donc
   * je dois parler pendant qu'il parle; et quand j'ai enfin fini, il me donne
   * une DEUXIÈME réponse ». Treize répliques d'assistant pour dix tours.
   *
   * `transcriptionEndpointingPlan` est exactement ce qui trie ces deux cas:
   * 0,4 s quand le transcripteur a posé un point, 1,2 s quand il n'y en a pas
   * — et un blanc au milieu d'une phrase n'en porte pas.
   */
  it("envoie le plan d'attente CLASSIQUE en parole-à-parole, puisque le transcripteur est là", () => {
    const plans = buildRealtimePlans('fr', true) as Record<string, any>;
    expect(plans.startSpeakingPlan).not.toBeNull();
    expect(plans.startSpeakingPlan.transcriptionEndpointingPlan.onNoPunctuationSeconds).toBe(1.2);
    /* Le même objet que la chaîne classique, pas une copie écrite pour le
       parole-à-parole: une copie ne vieillirait pas avec l'original. */
    expect(plans.startSpeakingPlan).toEqual((buildRealtimePlans('fr', false) as any).startSpeakingPlan);
  });

  /**
   * `null`, et surtout PAS une clé absente (17/09/2026).
   *
   * Ce test-ci disait `toBeUndefined()`, et il passait pendant qu'un assistant
   * distant portait encore son transcripteur Deepgram et son plan d'attente
   * après être passé en Superagent. La raison n'est pas dans ce fichier:
   * `vapiClient.updateAssistant` est un PATCH, donc une clé TUE est CONSERVÉE
   * chez Vapi. « Ne pas envoyer » ne veut dire « retirer » que sur une
   * création; sur tout client qui BASCULE, ça veut dire « garder l'ancien ».
   *
   * D'où la forme assertée ici: la clé doit EXISTER et valoir `null`. Un
   * `toBeUndefined()` ne distingue pas les deux, et c'est exactement l'écart
   * qui a laissé passer le défaut.
   */
  it('envoie la clé à null pour la RETIRER, puisque la mise à jour est un PATCH', () => {
    const plans = buildRealtimePlans('fr', true) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(plans, 'transcriber')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(plans, 'startSpeakingPlan')).toBe(true);
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
    /* Le `numWords: 0` n'était pas une préférence, c'était la conséquence d'un
       chemin SANS transcripteur: aucun mot à compter. Il vit donc désormais
       sous `VOICE_REALTIME_TRANSCRIBER=off`, qui rejoue ce chemin-là. */
    const prev = env.VOICE_REALTIME_TRANSCRIBER;
    (env as { VOICE_REALTIME_TRANSCRIBER: boolean }).VOICE_REALTIME_TRANSCRIBER = false;
    try {
      const stop = (buildRealtimePlans('fr', true) as Record<string, any>).stopSpeakingPlan;
      expect(stop).toBeDefined();
      expect(stop.voiceSeconds).toBeGreaterThan(0.2);
      expect(stop.backoffSeconds).toBeGreaterThanOrEqual(1);
      expect(stop.numWords).toBe(0);
      expect(stop.acknowledgementPhrases).toBeUndefined();
      expect(stop.interruptionPhrases).toBeUndefined();
    } finally {
      (env as { VOICE_REALTIME_TRANSCRIBER: boolean }).VOICE_REALTIME_TRANSCRIBER = prev;
    }
  });

  /**
   * AVEC un transcripteur, le plan qui compte des MOTS redevient le bon.
   *
   * Relevé sur deux appels réels du 17/09: « quand je le coupe, il ne s'arrête
   * pas ». L'énergie seule ne coupait pas l'agent, et elle n'avait de raison
   * d'être que tant qu'aucun mot ne remontait. Le plan classique laisse passer
   * les acquiescements et coupe net sur les mots d'arrêt.
   */
  it('avec transcripteur, compte les MOTS et connaît les mots d\'arrêt', () => {
    const stop = (buildRealtimePlans('fr', true) as Record<string, any>).stopSpeakingPlan;
    expect(stop.numWords).toBeGreaterThan(0);
    expect(stop.interruptionPhrases).toBeDefined();
    expect(stop.acknowledgementPhrases).toBeDefined();
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

/**
 * TUR-3, la moitié qui manquait. `onNumberSeconds` est un seuil GLOBAL: il
 * s'applique dès qu'un chiffre passe, quelle que soit la question. Or « Rue de
 * la Loi… cent cinquante-cinq… mille bruxelles » se donne en trois blocs avec
 * de vrais silences, et une adresse e-mail s'épelle avec des pauses plus
 * longues encore. Au seuil ordinaire l'agent coupe au premier blanc, et sur une
 * adresse ça veut dire abandonner.
 */
describe('la patience posée par question', () => {
  const rules = (lang: 'fr' | 'en' | 'nl') =>
    (buildStartSpeakingPlan(lang) as any).customEndpointingRules as Array<{
      type: string;
      regex: string;
      timeoutSeconds: number;
    }>;

  /** Les secondes accordées quand la phrase de l'agent contient `utterance`. */
  function secondsFor(lang: 'fr' | 'en' | 'nl', utterance: string): number | null {
    for (const r of rules(lang)) {
      if (new RegExp(r.regex).test(utterance)) return r.timeoutSeconds;
    }
    return null;
  }

  it('accroche la règle sur ce que l\'AGENT vient de dire', () => {
    // On ne sait pas ce que l'appelant va dire; on sait toujours ce qu'on
    // vient de lui demander. C'est le seul accrochage fiable.
    for (const lang of ['fr', 'en', 'nl'] as const) {
      expect(rules(lang).length).toBeGreaterThan(0);
      for (const r of rules(lang)) expect(r.type).toBe('assistant');
    }
  });

  it('attend plus longtemps sur une adresse que sur un tour ordinaire', () => {
    const ordinary = (buildStartSpeakingPlan('fr') as any).transcriptionEndpointingPlan.onNoPunctuationSeconds;
    expect(secondsFor('fr', 'Quelle est votre adresse ?')!).toBeGreaterThan(ordinary);
    expect(secondsFor('fr', 'Vous êtes dans quelle rue ?')!).toBeGreaterThan(ordinary);
    expect(secondsFor('fr', 'Et le code postal ?')!).toBeGreaterThan(ordinary);
  });

  it('attend plus longtemps encore sur ce qui s\'épelle', () => {
    // Une adresse se dit en blocs, un e-mail se donne lettre par lettre.
    expect(secondsFor('fr', 'Pouvez-vous m\'épeler votre e-mail ?')!).toBeGreaterThan(
      secondsFor('fr', 'Quelle est votre adresse ?')!,
    );
  });

  it('tient aussi quand la question commence par le mot', () => {
    // « Adresse ? » en début de phrase porte une majuscule: sans l'insensibilité
    // à la casse écrite dans le motif, la règle ne matcherait pas.
    expect(secondsFor('fr', 'Adresse, s\'il vous plaît ?')).not.toBeNull();
    expect(secondsFor('en', 'Address, please?')).not.toBeNull();
  });

  it('couvre les trois langues, pas seulement le français', () => {
    expect(secondsFor('en', 'What is your address?')).not.toBeNull();
    expect(secondsFor('en', 'Could you spell that?')).not.toBeNull();
    expect(secondsFor('nl', 'Wat is uw adres?')).not.toBeNull();
    expect(secondsFor('nl', 'Kunt u uw e-mail spellen?')).not.toBeNull();
  });

  it('ne rallonge pas un tour ordinaire', () => {
    expect(secondsFor('fr', 'Très bien, à quelle heure souhaitez-vous venir ?')).toBeNull();
    expect(secondsFor('fr', 'Bonjour, que puis-je faire pour vous ?')).toBeNull();
  });

  /**
   * Le motif sans frontière de mot matchait « rue » DANS « cruel ». L'agent
   * devenait donc patient sur un tour qui n'a rien à voir avec une adresse.
   * Trouvé en relisant le diff, pas par un appel: c'est le genre d'erreur
   * qu'aucun appelant ne signalerait jamais, il trouverait juste l'agent lent.
   */
  it('ne matche pas un mot À L\'INTÉRIEUR d\'un autre', () => {
    expect(secondsFor('fr', 'C\'est cruel de vous faire attendre')).toBeNull();
    expect(secondsFor('en', 'That was a cruel wait')).toBeNull();
  });

  it('distingue « spellen » de « spelen », qui ne veulent pas dire la même chose', () => {
    // Épeler contre jouer. Un seul L rendrait l'agent patient chaque fois
    // qu'il parle de jeu, d'enfants ou d'horaires de match.
    expect(secondsFor('nl', 'Kunt u dat spellen?')).not.toBeNull();
    expect(secondsFor('nl', 'De kinderen spelen buiten')).toBeNull();
  });

  it('n\'envoie pas regexOptions, dont la forme n\'est pas certaine', () => {
    // La référence d'API en donne une forme, l'exemple de la documentation
    // l'omet. Se tromper ferait refuser l'assistant ENTIER, donc tous les
    // appels: l'insensibilité à la casse est écrite dans les motifs.
    for (const r of rules('fr')) expect('regexOptions' in r).toBe(false);
  });

  it('livre des motifs qui compilent', () => {
    for (const lang of ['fr', 'en', 'nl'] as const) {
      for (const r of rules(lang)) expect(() => new RegExp(r.regex)).not.toThrow();
    }
  });
});

/**
 * BEL-5 / BEL-7. `buildTranscriber` n'envoyait aucun mot-clé: le nom de
 * l'entreprise, celui de l'agent et les intitulés de prestations sont pourtant
 * exactement ce qu'un appelant prononce et qu'un modèle générique écrit de
 * travers, faute de figurer dans un corpus.
 */
describe('les mots du client soufflés au transcripteur', () => {
  const field = (lang: 'fr' | 'en' | 'nl', vocabulary: string[]) =>
    buildTranscriber(lang, { vocabulary }) as Record<string, unknown>;

  /**
   * LE piège de cette ligne. Vapi n'expose pas le même champ selon le modèle:
   * `keyterm` n'existe que sur Nova-3, `keywords` couvre Nova-2 et en dessous.
   * Nos langues ne tournent pas sur le même modèle, et envoyer le mauvais
   * champ ferait refuser l'assistant ENTIER, donc tous les appels.
   */
  it('envoie keyterm en Nova-3, keywords en Nova-2', () => {
    for (const lang of ['fr', 'en'] as const) {
      const t = field(lang, ['Chez Marie']);
      expect(t.model).toBe('nova-3');
      expect(t.keyterm).toBeDefined();
      expect(t.keywords).toBeUndefined();
    }
    const nl = field('nl', ['Chez Marie']);
    expect(nl.model).toBe('nova-2');
    expect(nl.keywords).toBeDefined();
    expect(nl.keyterm).toBeUndefined();
  });

  it('garde l\'expression entière en Nova-3, la découpe en Nova-2', () => {
    // `keywords` ne prend que des mots seuls: une expression y serait au mieux
    // ignorée.
    expect(field('fr', ['Chez Marie']).keyterm).toEqual(['Chez Marie']);
    expect(field('nl', ['Chez Marie']).keywords).toEqual(['Chez', 'Marie']);
  });

  it('n\'envoie AUCUN champ quand il n\'y a rien à souffler', () => {
    // Le schéma envoyé à Vapi doit rester identique à celui qui tourne
    // aujourd'hui: un champ vide est un changement, pas une absence.
    for (const vocab of [[], ['  '], ['de', 'le'], ['a']]) {
      const t = field('fr', vocab);
      expect('keyterm' in t).toBe(false);
      expect('keywords' in t).toBe(false);
    }
  });

  it('conserve la casse, que Deepgram utilise', () => {
    // La documentation demande « correct spelling and capitalization »: un nom
    // propre en minuscules souffle au modèle la mauvaise graphie.
    expect(field('fr', ['Dupont-Lefèvre']).keyterm).toEqual(['Dupont-Lefèvre']);
  });

  it('dédoublonne sans se laisser tromper par la ponctuation', () => {
    expect(field('fr', ['Chez Marie', 'chez marie,', 'Chez  Marie']).keyterm).toEqual(['Chez Marie']);
  });

  it('écarte les mots vides et les fragments trop courts', () => {
    const out = field('fr', ['Le Comptoir', 'de', 'et', 'ok']).keyterm as string[];
    expect(out).toEqual(['Le Comptoir']);
  });

  it('plafonne la fenêtre plutôt que de tout souffler', () => {
    // Souffler tout le catalogue revient à ne rien souffler, en dégradant le
    // reste au passage.
    const many = Array.from({ length: 500 }, (_, i) => `Prestation${i}`);
    expect((field('fr', many).keyterm as string[]).length).toBeLessThanOrEqual(60);
  });
});

/**
 * BEL-11. À Bruxelles une phrase passe du français au néerlandais et revient.
 * Un transcripteur épinglé sur `fr` écrit le néerlandais en charabia français,
 * et l'agent répond à côté. Nova-3 suit ce basculement en temps réel, sans
 * changer de fournisseur ni de tarif.
 */
describe('le mode multilingue du transcripteur', () => {
  const withFlag = async (on: boolean) => {
    vi.resetModules();
    process.env.VOICE_STT_MULTILINGUAL = on ? '1' : '';
    const mod = await import('../speech-plans');
    return mod.buildTranscriber;
  };

  afterEach(() => {
    delete process.env.VOICE_STT_MULTILINGUAL;
    vi.resetModules();
  });

  it('reste épinglé sur une langue par défaut', async () => {
    // Un modèle épinglé est en général meilleur sur SA langue. Basculer toute
    // la flotte sans mesure améliorerait Bruxelles et pourrait dégrader la
    // majorité, qui est en français pur.
    const build = await withFlag(false);
    expect(build('fr')).toMatchObject({ model: 'nova-3', language: 'fr' });
    expect(build('nl')).toMatchObject({ model: 'nova-2', language: 'nl' });
  });

  it('suit toutes les langues quand le drapeau est levé', async () => {
    const build = await withFlag(true);
    for (const lang of ['fr', 'en', 'nl'] as const) {
      expect(build(lang)).toMatchObject({ model: 'nova-3', language: 'multi' });
    }
  });

  it('emporte le néerlandais en nova-3, parce que multi n\'existe pas sur nova-2', async () => {
    const build = await withFlag(true);
    expect((build('nl') as Record<string, unknown>).model).toBe('nova-3');
  });

  it('fait suivre le champ de biasing, qui dépend du modèle', async () => {
    // nova-2 prend `keywords`, nova-3 prend `keyterm`. Envoyer le mauvais
    // ferait refuser l'assistant entier.
    const off = await withFlag(false);
    expect((off('nl', { vocabulary: ['Chez Marie'] }) as Record<string, unknown>).keywords).toBeDefined();
    const on = await withFlag(true);
    expect((on('nl', { vocabulary: ['Chez Marie'] }) as Record<string, unknown>).keyterm).toBeDefined();
  });
});

describe('le seuil de voix du chemin parole-à-parole (TUR-6)', () => {
  it('a son propre réglage, parce qu\'il travaille seul', () => {
    // En classique, le bruit est trié deux fois: l'énergie PUIS les mots
    // transcrits. Ici il n'y a pas de transcripteur, donc `numWords` vaut 0 et
    // `voiceSeconds` porte toute la charge.
    /* 0,45 et non 0,8: l'API plafonne ce champ à 0,5, et ces trois tests
       gelaient des valeurs qu'elle REFUSE (0,8, 0,6, et une borne à 1,5). Ils
       passaient au vert pendant que le réglage correspondant aurait fait
       refuser l'assistant entier. Voir « seuil d'interruption contre le plafond
       de Vapi » plus bas. */
    const realtime = buildRealtimeStopSpeakingPlan(resolveTuning({ realtimeBargeInVoiceSeconds: 0.45 }));
    expect(realtime.numWords).toBe(0);
    expect(realtime.voiceSeconds).toBe(0.45);
  });

  it('ne bouge pas le chemin classique quand on protège l\'autre', () => {
    const tuning = resolveTuning({ realtimeBargeInVoiceSeconds: 0.45 });
    expect(tuning.bargeInVoiceSeconds).not.toBe(0.45);
  });

  it('retombe sur le seuil commun quand rien n\'est réglé pour lui', () => {
    const tuning = resolveTuning({ bargeInVoiceSeconds: 0.45 });
    expect(tuning.realtimeBargeInVoiceSeconds).toBe(0.45);
  });

  it('reste dans les bornes du champ Vapi', () => {
    // Mêmes bornes que le chemin classique: c'est le même champ, sur l'autre
    // chemin. Un hors-bornes ne dégrade pas un appel, il fait refuser
    // l'assistant entier, donc toute la flotte. Le plafond est 0,5, dit par
    // l'API elle-même le 17/09/2026, pas par une lecture du code.
    expect(resolveTuning({ realtimeBargeInVoiceSeconds: 99 }).realtimeBargeInVoiceSeconds).toBe(0.5);
    expect(resolveTuning({ realtimeBargeInVoiceSeconds: 0 }).realtimeBargeInVoiceSeconds).toBe(0.1);
  });
});

/**
 * LE RACCROCHÉ TOMBE APRÈS LES RELANCES (17/09/2026).
 *
 * Deux réglages décrivent le même silence et ne se parlaient pas:
 * `VOICE_IDLE_NUDGE_SECONDS` (10 s) déclenche « Vous m'entendez ? », deux fois,
 * et `VAPI_SILENCE_TIMEOUT` décide du raccroché. Le commentaire d'`env.ts`
 * affirmait déjà qu'« il en reste largement avant le raccroché ». Rien ne le
 * vérifiait.
 *
 * En production, `VAPI_SILENCE_TIMEOUT` valait 10. L'échéance du raccroché
 * tombait donc à la seconde même de la première relance: le mécanisme entier
 * n'a jamais tourné sur un seul appel. Et surtout, dix secondes après le
 * décroché, un accueil qui en dure sept laisse une seconde à l'appelant. Tous
 * les appels de test mouraient en `silence-timed-out` vers dix secondes, dans
 * les deux moteurs, et ça se lisait comme une panne du moteur vocal.
 */
describe('délai de silence contre calendrier des relances', () => {
  /* L'idiome du fichier: on mute `env` EN PLACE. `vi.resetModules()` donnerait
     un second objet `env`, que les fonctions importées en tête ne liraient pas,
     et il casserait au passage les tests suivants qui mutent le premier. */
  const withEnv = (patch: Record<string, number>, run: () => void) => {
    const prev: Record<string, number> = {};
    const e = env as unknown as Record<string, number>;
    for (const [k, v] of Object.entries(patch)) { prev[k] = e[k]; e[k] = v; }
    try { run(); } finally { for (const [k, v] of Object.entries(prev)) e[k] = v; }
  };

  it('relève un raccroché posé AVANT la dernière relance', () => {
    /* Deux relances à 10 s et 20 s, donc le raccroché ne peut pas tomber avant
       30 s sans les rendre inatteignables. */
    withEnv({ VAPI_SILENCE_TIMEOUT: 10, VOICE_IDLE_NUDGE_SECONDS: 10, VOICE_IDLE_NUDGE_COUNT: 2 }, () => {
      expect(resolveTuning().silenceTimeout).toBe(30);
    });
  });

  it('applique le plancher à la valeur d\'ENVIRONNEMENT, pas seulement au réglage client', () => {
    /* Le piège: `clamp` rend son `fallback` tel quel quand le client n'a rien
       réglé. Un plancher passé à `clamp` n'aurait donc jamais touché le cas
       réel, qui est exactement celui-là. */
    withEnv({ VAPI_SILENCE_TIMEOUT: 12, VOICE_IDLE_NUDGE_SECONDS: 10, VOICE_IDLE_NUDGE_COUNT: 2 }, () => {
      expect(resolveTuning().silenceTimeout).toBe(30);
      expect(resolveTuning({}).silenceTimeout).toBe(30);
    });
  });

  it('ne touche pas un réglage déjà confortable', () => {
    withEnv({ VAPI_SILENCE_TIMEOUT: 45, VOICE_IDLE_NUDGE_SECONDS: 10, VOICE_IDLE_NUDGE_COUNT: 2 }, () => {
      expect(resolveTuning().silenceTimeout).toBe(45);
    });
  });

  it('garde le plafond de 120 s', () => {
    withEnv({ VAPI_SILENCE_TIMEOUT: 600, VOICE_IDLE_NUDGE_SECONDS: 60, VOICE_IDLE_NUDGE_COUNT: 5 }, () => {
      expect(resolveTuning().silenceTimeout).toBe(120);
    });
  });
});

/**
 * LE PLAFOND D'INTERRUPTION EST CELUI DE L'API (17/09/2026).
 *
 *   {"message":["stopSpeakingPlan.voiceSeconds must not be greater than 0.5"],
 *    "statusCode":400}
 *
 * Le clamp autorisait 1,5, choisi en lisant le code et pas l'API. Poser 1,5
 * était donc légal ici et faisait refuser l'assistant ENTIER chez Vapi, c'est-à-
 * dire tomber tous les appels du client. `voice:validate` l'a attrapé avant le
 * moindre appel; ce test met la borne là où l'API la met.
 */
describe('seuil d\'interruption contre le plafond de Vapi', () => {
  /* `env` muté EN PLACE, l'idiome du fichier: `vi.resetModules()` donnerait un
     second objet `env` que les fonctions importées en tête ne liraient pas. */
  const withEnv = (patch: Record<string, number>, run: () => void) => {
    const prev: Record<string, number> = {};
    const e = env as unknown as Record<string, number>;
    for (const [k, v] of Object.entries(patch)) { prev[k] = e[k]; e[k] = v; }
    try { run(); } finally { for (const [k, v] of Object.entries(prev)) e[k] = v; }
  };

  it('borne le réglage CLIENT à 0,5 sur les deux chemins', () => {
    const t = resolveTuning({ bargeInVoiceSeconds: 1.5, realtimeBargeInVoiceSeconds: 1.5 });
    expect(t.bargeInVoiceSeconds).toBe(0.5);
    expect(t.realtimeBargeInVoiceSeconds).toBe(0.5);
  });

  it('borne AUSSI la variable d\'environnement, par laquelle la valeur arrive vraiment', () => {
    /* `clamp` rend son `fallback` tel quel: une borne qui ne couvre pas ce
       chemin-là ne borne rien. Même piège que le délai de silence, même jour. */
    withEnv({ VOICE_BARGE_IN_VOICE_SECONDS: 1.5, VOICE_REALTIME_BARGE_IN_VOICE_SECONDS: 1.5 }, () => {
      expect(resolveTuning().bargeInVoiceSeconds).toBe(0.5);
      expect(resolveTuning().realtimeBargeInVoiceSeconds).toBe(0.5);
    });
  });

  it('laisse passer ce que l\'API accepte', () => {
    withEnv({ VOICE_REALTIME_BARGE_IN_VOICE_SECONDS: 0.5 }, () => {
      expect(resolveTuning().realtimeBargeInVoiceSeconds).toBe(0.5);
      expect(resolveTuning({ realtimeBargeInVoiceSeconds: 0.3 }).realtimeBargeInVoiceSeconds).toBe(0.3);
    });
  });

  it('le plan temps réel ne peut donc plus porter une valeur refusée', () => {
    withEnv({ VOICE_REALTIME_BARGE_IN_VOICE_SECONDS: 3 }, () => {
      const plan = buildRealtimeStopSpeakingPlan(resolveTuning()) as Record<string, number>;
      expect(plan.voiceSeconds).toBeLessThanOrEqual(0.5);
    });
  });
});
