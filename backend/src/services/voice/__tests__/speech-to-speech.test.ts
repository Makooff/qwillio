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
  it('fait passer la voix clonée avant un realtime explicite', async () => {
    const { buildSpeech } = await load({ VOICE_SPEECH_TO_SPEECH: 'on' });
    const { speechToSpeech, voice } = buildSpeech({
      lang: 'fr', systemPrompt: 'p', tools: [], character: CHARACTER_F,
      voiceMode: 'realtime', hasCustomVoice: true,
    });
    expect(speechToSpeech).toBe(false);
    expect(voice.provider).toBe('11labs');
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
    expect(buildRealtimePlans('fr', true)).not.toHaveProperty('transcriber');
    expect(buildRealtimePlans('fr', false)).toHaveProperty('transcriber');
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
    expect(model.messages[0]).toEqual({ role: 'system', content: 'CONSIGNE' });
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
