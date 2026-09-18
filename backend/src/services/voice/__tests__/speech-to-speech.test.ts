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
  it('retire le transcripteur sous `off`, et le garde dans la chaîne classique', async () => {
    /* `null` et non une clé absente: la mise à jour d'un assistant est un
       PATCH, donc taire la clé la CONSERVE chez Vapi. Ce test disait
       `not.toHaveProperty` et passait pendant qu'un assistant basculé en
       Superagent gardait Deepgram. Voir speech-plans.test.ts.
       Le retrait est passé sous `off` le 17/09: un appel réel a montré que Vapi
       a besoin du transcripteur pour entendre l'appelant en parole-à-parole. */
    const { buildRealtimePlans } = await load({
      VOICE_SPEECH_TO_SPEECH: 'on', VOICE_REALTIME_TRANSCRIBER: 'off',
    });
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
    /* Le plan d'ATTENTE ne dépend pas de ce drapeau-là: il suit le
       TRANSCRIPTEUR, qui est ici sur son défaut. Les deux se coupent
       séparément, sinon un essai ne dit pas lequel des deux a agi. */
    expect(plans.startSpeakingPlan).not.toBeNull();
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
    /* Sur la RÈGLE, pas sur une casse: la version d'avant exigeait « jamais de
       langue » en minuscules et serait tombée sur un simple renforcement. */
    expect((await blocks('fr')).model.messages[0].content).toMatch(/jamais de langue/i);
  });

  /**
   * ET ELLE NOMME LES DEUX MOMENTS OÙ ELLE LÂCHE (17/09/2026).
   *
   * « À la fin, quand il me dit au revoir, d'un coup il passe en anglais et il
   * me demande How can I help you. » Relevé aussi au MILIEU du même appel:
   * une phrase d'accueil posée en plein échange. Les deux disent la même
   * chose: quand le modèle perd le fil, il retombe sur son ouverture par
   * défaut, qui est anglaise. Une consigne posée une fois en tête d'un long
   * prompt ne tient pas ce moment-là, parce que c'est là que le début du
   * prompt pèse le moins.
   */
  it('couvre la fin d\'appel et le trou, les deux endroits où elle lâchait', async () => {
    const line = (await blocks('fr')).model.messages[0].content as string;
    expect(line).toMatch(/au revoir/);
    expect(line).toMatch(/perds le fil/);
    expect(line).toMatch(/How can I help you/);
  });

  /**
   * LE VOUVOIEMENT SE DIT SUR CE CHEMIN AUSSI (17/09/2026).
   *
   * « Des fois il me tutoie, il dit Attends, c'est pas normal. » La cause est
   * de forme: le bloc de discipline s'adresse au MODÈLE en « tu », comme une
   * consigne s'écrit, et il est posé AVANT le prompt métier qui porte la règle
   * de vouvoiement. Le modèle rend le registre qu'il lit en premier. C'est
   * 6quater, sur le chemin qui n'était pas couvert.
   */
  it('dit le vouvoiement, et dit POURQUOI les consignes le tutoient', async () => {
    const prompt = (await blocks('fr')).model.messages[0].content as string;
    expect(prompt).toMatch(/VOUS à l'appelant/);
    expect(prompt).toMatch(/attends/);
    /* Et il vient AVANT le prompt métier, sinon il ne corrige pas le registre
       que le modèle a déjà lu. */
    expect(prompt.indexOf('VOUS à l\'appelant')).toBeLessThan(prompt.indexOf('TOUR DE PAROLE'));
  });

  /**
   * L'HEURE DE L'APPELANT GAGNE CONTRE CELLE QUE LE MODÈLE A EN TÊTE
   * (18/09/2026).
   *
   * « 13 heures » dit deux fois par l'appelant, « 14 heures » dit trois fois
   * par l'agent — l'heure de son rendez-vous EXISTANT. La règle de DATE
   * (« tu gardes SON mois et SON jour ») était là depuis le 17; celle de
   * l'HEURE manquait, et c'est sur l'heure que le modèle a dérivé.
   *
   * Le fait vient de l'outil (`preferredTime`); ce bloc dit laquelle des deux
   * versions gagne, ce qu'un fait seul ne dit jamais (6novoquadragesies).
   */
  it("dit que l'heure de l'appelant gagne, et que sa correction gagne tout de suite", async () => {
    const prompt = (await blocks('fr')).model.messages[0].content as string;
    expect(prompt).toMatch(/nomme une HEURE, c'est CETTE heure/);
    expect(prompt).toMatch(/preferredTime/);
    /* Le cas exact, nommé, parce que c'est l'ancre qui a produit la dérive. */
    expect(prompt).toMatch(/treize heures.*jamais quatorze heures/);
    expect(prompt).toMatch(/correction GAGNE/);
  });

  /**
   * UN REFUS EST UN REFUS (18/09/2026).
   *
   * « Non, ce n'est pas ça, mais c'est pas grave, je rappellerai plus tard »,
   * puis « Non », puis « Laissez tomber, au revoir »: QUATRE relances après,
   * l'agent redemandait toujours l'orthographe du nom. C'est 6septies (le
   * repli clavier au deuxième numéro illisible) vu depuis l'appelant: insister
   * sur ce qui vient d'échouer ne change pas la cause.
   */
  it("arrête de demander quand l'appelant refuse, et raccroche sur au revoir", async () => {
    const prompt = (await blocks('fr')).model.messages[0].content as string;
    expect(prompt).toMatch(/QUAND IL DIT NON/);
    expect(prompt).toMatch(/laissez tomber/);
    expect(prompt).toMatch(/ARRETES de demander/);
    expect(prompt).toMatch(/endCall/);
  });

  it('les trois langues portent les mêmes règles', async () => {
    /* Une règle écrite dans une seule langue est une règle qu'un client
       flamand n'a pas: le même défaut y produirait le même appel. */
    expect((await blocks('en')).model.messages[0].content).toMatch(/WHEN THEY SAY NO/);
    expect((await blocks('en')).model.messages[0].content).toMatch(/names a TIME, that IS the time/);
    expect((await blocks('nl')).model.messages[0].content).toMatch(/ALS HIJ NEE ZEGT/);
    expect((await blocks('nl')).model.messages[0].content).toMatch(/is dat het uur/);
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

/**
 * L'INTERRUPTEUR DE TRANSCRIPTEUR EN PAROLE-À-PAROLE (17/09/2026).
 *
 * Le chemin temps réel retire le transcripteur, et le raisonnement se tient: le
 * modèle entend l'audio lui-même. Il n'a JAMAIS été vérifié sur un appel réel.
 *
 * Quatre appels réels disent autre chose: le seul où l'appelant a été
 * correctement entendu est celui où le transcripteur était encore là, conservé
 * par accident. Les trois suivants comptent 1, 1 puis 0 réplique de l'appelant,
 * et le propriétaire rapporte « il ne m'entend pas ».
 *
 * Corrélation n'est pas cause, d'où un interrupteur plutôt qu'un revirement.
 */
describe('parole-à-parole — le transcripteur, sous interrupteur', () => {
  it('est là par DÉFAUT: un appel réel a tranché', async () => {
    /* 17/09/2026, 08:15: transcripteur remis, 7 répliques de l'assistant et 3
       de l'appelant, conversation entière en français, `captureLead` appelé.
       Premier appel en parole-à-parole qui fait son travail. */
    const { buildRealtimePlans } = await load({});
    expect((buildRealtimePlans('fr', true) as any).transcriber).toBeTruthy();
  });

  it('se retire encore sous `off`, pour rejouer l\'ancien comportement', async () => {
    const { buildRealtimePlans } = await load({ VOICE_REALTIME_TRANSCRIBER: 'off' });
    expect((buildRealtimePlans('fr', true) as any).transcriber).toBeNull();
  });

  it('porte la langue quand il est là', async () => {
    const { buildRealtimePlans } = await load({ VOICE_REALTIME_TRANSCRIBER: 'on' });
    const tr = (buildRealtimePlans('fr', true) as any).transcriber;
    expect(tr).toBeTruthy();
    /* Et il porte la LANGUE, qui est la moitié de ce qu'on va vérifier: le
       transcript du portail rendait « Was that 2 goshola? » sur du français. */
    expect(tr.language ?? tr.languages).toBeDefined();
  });

  it('ne touche pas la chaîne classique, qui en a toujours un', async () => {
    const off = await load({});
    expect((off.buildRealtimePlans('fr', false) as any).transcriber).toBeTruthy();
    const on = await load({ VOICE_REALTIME_TRANSCRIBER: 'on' });
    expect((on.buildRealtimePlans('fr', false) as any).transcriber).toBeTruthy();
  });

  /**
   * LE PLAN D'ATTENTE LE SUIT, et ce test disait l'inverse (17/09/2026).
   *
   * Il exigeait que le plan reste retiré même avec un transcripteur, au motif
   * qu'un seul essai devait bouger à la fois. Le raisonnement de méthode était
   * bon, la conclusion a survécu à sa raison: le transcripteur est resté, donc
   * les mots qu'il fournit sont là, donc le plan qui les compte doit être là
   * aussi. Sans lui, Vapi applique son défaut de 0,4 s de silence et répond à
   * un blanc de réflexion, puis répond une seconde fois à la vraie fin de
   * phrase — treize répliques pour dix tours sur un appel réel de 108 s.
   *
   * L'interrupteur garde son rôle: `off` retire les DEUX d'un coup, ce qui
   * rejoue exactement l'ancien comportement, et c'est ce que vérifie le test
   * suivant.
   */
  it('emmène le plan d\'attente avec lui, dans les deux sens', async () => {
    const on = await load({ VOICE_REALTIME_TRANSCRIBER: 'on' });
    expect((on.buildRealtimePlans('fr', true) as any).startSpeakingPlan).not.toBeNull();

    const off = await load({ VOICE_REALTIME_TRANSCRIBER: 'off' });
    const plans = off.buildRealtimePlans('fr', true) as any;
    /* Sans transcripteur il n'y a aucun mot à compter, donc le plan n'a plus
       de sens — et `null`, jamais une clé tue: sur un PATCH, se taire CONSERVE
       (6sexquinquagesies). */
    expect(plans.transcriber).toBeNull();
    expect(plans.startSpeakingPlan).toBeNull();
  });
});
