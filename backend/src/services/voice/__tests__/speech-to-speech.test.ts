import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Le mode parole-à-parole, tenu par ses règles.
 *
 * L'enjeu n'est pas cosmétique: Vapi rejette l'assistant ENTIER sur une clé ou
 * une voix inconnue, et le même assembleur sert l'appel entrant réel, l'appel
 * test et la démo. Une erreur ici ne dégrade pas la voix, elle coupe la ligne.
 */

const CHARACTER_F = { voiceId: 'el-marie', gender: 'f' as const, stability: 0.4, similarityBoost: 0.6, style: 0.7 };
const CHARACTER_M = { voiceId: 'el-lucas', gender: 'm' as const };

/** Les six voix d'OpenAI que les modèles temps réel NE servent PAS. */
const REFUSED_BY_REALTIME = ['ash', 'ballad', 'coral', 'fable', 'onyx', 'nova'];

async function load(envPatch: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(envPatch)) process.env[k] = v;
  return import('../speech-plans');
}

const ORIGINAL = { ...process.env };
beforeEach(() => { vi.resetModules(); });
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('parole-à-parole', () => {
  it('remplace le modèle ET la voix quand il est actif', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const { model, voice, speechToSpeech } = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F,
    });

    expect(speechToSpeech).toBe(true);
    expect(model.model).toMatch(/realtime/);
    // La voix vient d'OpenAI: garder ElevenLabs ici ferait rejeter l'assistant.
    expect(voice.provider).toBe('openai');
    expect(REFUSED_BY_REALTIME).not.toContain(voice.voiceId);
  });

  it('donne une voix différente selon le genre du personnage', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const f = buildSpeech({ lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F });
    const m = buildSpeech({ lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_M });
    // Le personnage ne choisit plus le timbre exact, mais il choisit encore
    // qui répond: perdre aussi le genre viderait le carrousel de son sens.
    expect(f.voice.voiceId).not.toBe(m.voice.voiceId);
  });

  it('ne sort JAMAIS de la liste fermée des voix temps réel', async () => {
    /* Vapi rejette l'assistant ENTIER sur une voix inconnue, et six voix
       d'OpenAI (ash, ballad, coral, fable, onyx, nova) ne sont pas servies par
       les modèles temps réel. L'appel meurt alors sans rien dire d'autre que
       « Meeting has ended » côté navigateur: la panne la plus coûteuse à
       diagnostiquer du chemin vocal. Ces deux valeurs se figent donc ici. */
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const f = buildSpeech({ lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F });
    const m = buildSpeech({ lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_M });
    expect(f.voice).toEqual({ provider: 'openai', voiceId: 'marin' });
    expect(m.voice).toEqual({ provider: 'openai', voiceId: 'cedar' });
  });

  /**
   * La règle qui protège la promesse produit: un client qui a enregistré SA
   * voix a demandé précisément celle-là. La remplacer par celle d'OpenAI, si
   * naturelle soit-elle, n'est pas une amélioration, c'est la perte de ce
   * qu'il était venu chercher. Automatique, jamais un réglage à ne pas oublier.
   */
  it('s’efface devant une voix clonée', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const { voice, speechToSpeech } = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F, hasCustomVoice: true,
    });
    expect(speechToSpeech).toBe(false);
    expect(voice.provider).toBe('11labs');
    expect(voice.voiceId).toBe('el-marie');
  });

  /**
   * L'ordre de priorité, qui est tout l'intérêt du réglage par client.
   *
   * Il faut pouvoir comparer les deux chaînes sur UN compte sans engager la
   * production entière, dans les deux sens: allumer chez soi quand le global
   * est éteint, et éteindre chez un client quand le global est allumé.
   */
  it('laisse le réglage du client l’emporter sur le global, dans les deux sens', async () => {
    const { buildSpeech: whenGlobalOff } = await load({ VOICE_SPEECH_TO_SPEECH: 'off' });
    expect(whenGlobalOff({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F, voiceMode: 'realtime',
    }).speechToSpeech).toBe(true);

    const { buildSpeech: whenGlobalOn } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    expect(whenGlobalOn({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F, voiceMode: 'classic',
    }).speechToSpeech).toBe(false);

    // `auto` ne décide de rien: il rend la main au réglage global.
    expect(whenGlobalOn({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F, voiceMode: 'auto',
    }).speechToSpeech).toBe(true);
  });

  /* La voix clonée passe avant un `realtime` explicite. Sinon un réglage posé
     une fois retirerait sans bruit la voix que le client a enregistrée. */
  it('fait passer la voix CLONÉE avant un realtime explicite', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const { speechToSpeech, voice } = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [],
      character: { ...CHARACTER_F, voiceCloned: true },
      voiceMode: 'realtime', hasCustomVoice: true,
    });
    expect(speechToSpeech).toBe(false);
    expect(voice.provider).toBe('11labs');
  });

  /**
   * Et une voix de BIBLIOTHÈQUE, elle, ne bloque plus le temps réel.
   *
   * Ce test épingle la correction d'un défaut qui rendait le sélecteur de mode
   * inopérant: `hasCustomVoice` vaut vrai pour n'importe quelle voix choisie,
   * pas seulement pour un enregistrement. Dès qu'un client passait par le
   * sélecteur de voix, le mode Direct ne s'activait donc plus jamais, quoi
   * qu'affiche le bouton. Symptôme rapporté deux fois: « je n'entends aucune
   * différence quand je change de mode ».
   *
   * Une voix de bibliothèque est une préférence, pas un enregistrement: un
   * choix explicite de temps réel l'emporte, et cette voix n'est simplement pas
   * utilisée. Ce qui ne peut pas être remplacé, c'est la voix du client.
   */
  it("laisse un realtime explicite l'emporter sur une voix de bibliothèque", async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const { speechToSpeech, voice } = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F,
      voiceMode: 'realtime', hasCustomVoice: true,
    });
    expect(speechToSpeech).toBe(true);
    expect(voice.provider).toBe('openai');
  });

  it("en `auto`, une voix choisie continue de faire pencher vers le classique", async () => {
    // Elle n'a pas été demandée pour rien, et le classique est le seul mode
    // qui la serve.
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const { speechToSpeech } = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F,
      voiceMode: 'auto', hasCustomVoice: true,
    });
    expect(speechToSpeech).toBe(false);
  });

  it('se coupe entièrement depuis Render, sans redéploiement', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'off' });
    const { model, voice, speechToSpeech } = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F,
    });
    expect(speechToSpeech).toBe(false);
    expect(model.model).not.toMatch(/realtime/);
    expect(voice.provider).toBe('11labs');
  });

  /* Le modèle entend l'audio lui-même. Lui adjoindre un transcripteur, c'est
     payer une étape dont plus personne ne lit la sortie et rendre la latence
     à ce qu'elle était. */
  it('retire le transcripteur, et le garde dans la chaîne classique', async () => {
    const { buildRealtimePlans } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    /* `null` et non une clé absente: la mise à jour d'un assistant est un
       PATCH, donc taire la clé la CONSERVE chez Vapi. Ce test disait
       `not.toHaveProperty` et passait pendant qu'un assistant basculé en
       Superagent gardait Deepgram. Voir speech-plans.test.ts. */
    expect((buildRealtimePlans('fr', true) as any).transcriber).toBeNull();
    expect((buildRealtimePlans('fr', false) as any).transcriber).toBeTruthy();
  });

  /**
   * Le détecteur de fin de tour doit suivre la LANGUE.
   *
   * Le modèle de LiveKit n'existe qu'en anglais. L'employer en français, c'est
   * faire juger la complétude d'une phrase française par la syntaxe d'une
   * autre langue: elle coupe la parole, ou elle laisse un blanc. Les deux
   * défauts qu'on entend comme « robotique ». Ce test est là parce que
   * l'erreur était invisible: le code marchait, il devinait simplement mal.
   */
  it('choisit le détecteur de fin de tour selon la langue', async () => {
    const { buildStartSpeakingPlan } = await load({});
    expect(buildStartSpeakingPlan('en').smartEndpointingPlan.provider).toBe('livekit');
    expect(buildStartSpeakingPlan('fr').smartEndpointingPlan.provider).toBe('vapi');
    // `waitFunction` module la courbe de LiveKit: elle n'a pas de sens ailleurs.
    expect(buildStartSpeakingPlan('fr').smartEndpointingPlan).not.toHaveProperty('waitFunction');
  });

  /* Les outils survivent au changement de mode: sans eux la réceptionniste ne
     peut plus consulter l'agenda ni transférer, c'est-à-dire plus travailler. */
  it('garde les outils et la consigne système', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const tools = [{ type: 'function', function: { name: 'checkAvailability' } }];
    const { model } = buildSpeech({
      lang: 'fr', systemPrompt: 'CONSIGNE', tools, character: CHARACTER_F,
    });
    expect(model.tools).toEqual(tools);
    /* La consigne du métier est PRÉSERVÉE, précédée de la ligne de langue que
       ce mode est seul à porter (voir « la langue est dite au modèle » plus
       bas): en parole-à-parole, plus aucun transcripteur ni aucune voix ne dit
       au modèle en quelle langue écouter ni répondre. */
    expect(model.messages[0].role).toBe('system');
    expect(model.messages[0].content).toContain('CONSIGNE');
    expect(model.messages[0].content).toMatch(/^LANGUE: tu parles FRANÇAIS/);
  });

  /* Le LLM personnalisé n'a de sens que dans la chaîne classique: en
     parole-à-parole il n'y a pas de tour de texte à intercepter. Le laisser
     passer enverrait Vapi chercher un modèle sur une URL qui ne parle pas
     l'audio. */
  it('ignore le LLM personnalisé en parole-à-parole, l’honore sinon', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const s2s = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F,
      customLlmUrl: 'https://api.example.com/llm',
    });
    expect(s2s.model.provider).toBe('openai');
    expect(s2s.model).not.toHaveProperty('url');

    const { buildSpeech: build2 } = await load({ VOICE_SPEECH_TO_SPEECH: 'off' });
    const classic = build2({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F,
      customLlmUrl: 'https://api.example.com/llm',
    });
    expect(classic.model.provider).toBe('custom-llm');
    expect(classic.model.url).toBe('https://api.example.com/llm');
  });
});


/**
 * Le mode direct ne s'établit pas, et ces deux tests épinglent les gardes
 * posées pendant qu'on cherche pourquoi.
 *
 * Constaté le 25/08 sur un appareil où le mode classique fonctionne dans la
 * même minute, avec le même micro et le même navigateur.
 */
describe('temps réel hors service — les gardes', () => {
  it("`auto` NE résout PLUS en temps réel par défaut", async () => {
    /* C'est le point grave: avec l'ancien défaut, `auto` valait temps réel, et
       tous les clients sont en `auto`. Le moteur qui ne se connecte pas était
       donc celui de TOUS les appels entrants réels, sans que personne ne l'ait
       choisi. Un moteur qui échoue à s'établir ne peut pas être le défaut. */
    const { useSpeechToSpeech } = await load({});
    delete process.env.VOICE_SPEECH_TO_SPEECH;
    const fresh = await load({});
    expect(fresh.useSpeechToSpeech({ voiceMode: 'auto' })).toBe(false);
    // Le choix EXPLICITE reste possible: c'est ce qui permet de le réparer.
    expect(useSpeechToSpeech({ voiceMode: 'realtime' })).toBe(true);
  });

  it("le plan d'interruption temps réel se coupe sans redéploiement", async () => {
    /* Second suspect, et il est de nous: la seule présence d'un
       `stopSpeakingPlan` peut faire prendre le tour de parole à
       l'orchestration de Vapi plutôt qu'au modèle, qui est le seul à entendre
       l'audio en parole-à-parole. Les deux hypothèses doivent se tester une à
       la fois, sans déploiement entre les deux essais. */
    const on = await load({ VOICE_REALTIME_STOP_PLAN: 'on' });
    expect((on.buildRealtimePlans('fr', true) as any).stopSpeakingPlan).toBeDefined();

    const off = await load({ VOICE_REALTIME_STOP_PLAN: 'off' });
    const plans = off.buildRealtimePlans('fr', true) as any;
    /* « off » veut dire « rends la main au défaut de Vapi ». Sur un PATCH,
       seule une valeur `null` le dit: une clé absente laissait en place le plan
       CLASSIQUE de la synchronisation précédente, c'est-à-dire ni le nôtre ni
       celui de Vapi, et le drapeau ne faisait donc rien sur un client basculé. */
    expect(plans.stopSpeakingPlan).toBeNull();
    expect(plans.startSpeakingPlan).toBeNull();
    // Ce qui ne dépend pas du transcripteur reste servi dans les deux cas.
    expect(plans.silenceTimeoutSeconds).toBeDefined();
  });
});

/**
 * LA LANGUE EN PAROLE-À-PAROLE (17/09/2026).
 *
 * En classique elle est dite deux fois sans qu'on y pense: au transcripteur
 * (`language: fr`) et à la voix. Le temps réel n'a ni l'un ni l'autre, donc plus
 * rien ne disait au modèle en quelle langue écouter ni répondre. Premier appel
 * réel: l'appelant dit « allô », le transcript écrit « Hello? », et l'assistant
 * rend « Dentalics » puis « receptionist to Sid and Alex ».
 *
 * Un prompt écrit en français n'est PAS une consigne de langue: il décrit le
 * métier, pas le canal audio. D'où une ligne explicite, et seulement ici.
 */
describe('parole-à-parole — la langue est dite au modèle', () => {
  const blocks = async (lang: 'fr' | 'en' | 'nl') => {
    const { realtimeSpeechBlocks } = await load({});
    return realtimeSpeechBlocks({
      lang, gender: 'm', systemPrompt: 'Tu es Lucas.', tools: [], temperature: 0.7,
      realtimeModel: 'gpt-realtime-mini-2025-12-15',
    }) as any;
  };

  it('nomme la langue, dans la langue, pour les trois', async () => {
    expect((await blocks('fr')).model.messages[0].content).toMatch(/LANGUE: tu parles FRANÇAIS/);
    expect((await blocks('en')).model.messages[0].content).toMatch(/LANGUAGE: you speak ENGLISH/);
    expect((await blocks('nl')).model.messages[0].content).toMatch(/TAAL: je spreekt NEDERLANDS/);
  });

  it('la pose en TÊTE, là où un prompt long se lit vraiment', async () => {
    const content = (await blocks('fr')).model.messages[0].content as string;
    expect(content.indexOf('LANGUE:')).toBe(0);
    // Et le prompt du métier suit, il n'est pas remplacé.
    expect(content).toContain('Tu es Lucas.');
  });

  it("interdit de changer de langue, ce que le modèle faisait en mésentendant", async () => {
    expect((await blocks('fr')).model.messages[0].content).toMatch(/jamais de langue/);
  });

  it('ne coûte RIEN au prompt de la chaîne classique', async () => {
    /* Le prompt partagé est rejoué à chaque tour sur le chemin custom-LLM, où
       il est déjà à son plafond, et où la langue est déjà dite deux fois. */
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'off' });
    const { model, speechToSpeech } = buildSpeech({
      lang: 'fr', systemPrompt: 'Tu es Lucas.', tools: [],
      character: { voiceId: 'v1', gender: 'm' }, voiceMode: 'classic',
    }) as any;
    expect(speechToSpeech).toBe(false);
    expect(JSON.stringify(model)).not.toMatch(/LANGUE:/);
  });
});

/**
 * LE PLAFOND DE JETONS NE SE PARTAGE PAS ENTRE LES DEUX CHEMINS (17/09/2026).
 *
 * `VOICE_MAX_COMPLETION_TOKENS` vaut 120, et c'est juste en classique: la sortie
 * y est du TEXTE, 120 jetons font une à deux phrases. En parole-à-parole la
 * sortie est de l'AUDIO, et le même 120 ne laisse passer qu'une poignée de mots.
 *
 * Trois appels réels d'affilée: l'assistant ne finissait jamais sa phrase
 * d'accueil. Un texte FIXE, donc tronqué au même endroit à chaque appel, sans
 * rapport avec le bruit, l'appelant ou la langue — c'est ce qui a fini par le
 * désigner. Posé à 4096, l'accueil passe entier du premier coup.
 */
describe('parole-à-parole — son propre plafond de jetons', () => {
  it('ne prend PAS le plafond du texte', async () => {
    const { realtimeSpeechBlocks } = await load({});
    const { env } = await import('../../../config/env');
    const { model } = realtimeSpeechBlocks({
      lang: 'fr', gender: 'm', systemPrompt: 'P', tools: [], temperature: 0.7,
      realtimeModel: 'gpt-realtime-mini-2025-12-15',
    }) as any;
    expect(model.maxTokens).toBe(env.VOICE_REALTIME_MAX_TOKENS);
    expect(model.maxTokens).not.toBe(env.VOICE_MAX_COMPLETION_TOKENS);
    // Et il est large: la longueur d'un tour se tient par le prompt, pas en
    // coupant au milieu d'un mot.
    expect(model.maxTokens).toBeGreaterThanOrEqual(4096);
  });

  it('la chaîne classique garde ses 120, qui y sont le bon réglage', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'off' });
    const { env } = await import('../../../config/env');
    const { model } = buildSpeech({
      lang: 'fr', systemPrompt: 'P', tools: [],
      character: { voiceId: 'v1', gender: 'm' }, voiceMode: 'classic',
    }) as any;
    expect(env.VOICE_MAX_COMPLETION_TOKENS).toBe(120);
    expect(model.maxTokens).toBe(120);
  });

  it('refuse un plafond trop bas, pour que la régression ne se repose pas', async () => {
    /* 120 est exactement la valeur qui a cassé le mode pendant trois appels, et
       elle se lisait comme un réglage raisonnable. Le plancher la rattrape. */
    await load({ VOICE_REALTIME_MAX_TOKENS: '120' });
    const { env } = await import('../../../config/env');
    expect(env.VOICE_REALTIME_MAX_TOKENS).toBeGreaterThanOrEqual(256);
  });
});
