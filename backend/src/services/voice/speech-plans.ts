import { env } from '../../config/env';
import { buildIdleMessagePlan } from './conversational-repair';

/**
 * Real-time speech plans for the Vapi pipeline.
 *
 * The legacy config drove turn-taking with `interruptionsEnabled` +
 * `numWordsToInterruptAssistant` + `responseDelaySeconds`. Those are coarse:
 * they only decide *whether* the assistant can be cut off, never *how fast* the
 * outbound audio actually stops, and the fixed response delay added latency on
 * every single turn regardless of whether the caller had finished talking.
 *
 * This module replaces them with the three plans that own perceived latency:
 *
 *  - `transcriber`    — how fast a final transcript is emitted (endpointing).
 *  - `startSpeakingPlan` — how long we wait before answering (smart endpointing
 *                          predicts end-of-utterance instead of timing out).
 *  - `stopSpeakingPlan`  — how aggressively outbound audio is killed on barge-in.
 *
 * Budget for perceived latency (< 400 ms) on a plain turn:
 *   endpointing ~150 ms + startSpeaking wait ~120 ms + LLM first token ~90 ms
 *   + TTS TTFB ~75 ms (ElevenLabs Flash v2.5, streaming).
 */

export type VoiceLanguage = 'fr' | 'en';

/** Deepgram language codes we actually ship. */
const DEEPGRAM_LANG: Record<VoiceLanguage, string> = { fr: 'fr', en: 'en-US' };

/**
 * Transcriber tuned for conversational endpointing rather than transcription
 * accuracy on long-form audio. `endpointing` is the silence (ms) after speech
 * before a final transcript is flushed — the single biggest lever on turn
 * latency. 150 ms is aggressive but safe when smart endpointing is on, because
 * the start-speaking plan re-checks whether the sentence sounded finished.
 */
export function buildTranscriber(lang: VoiceLanguage) {
  return {
    provider: 'deepgram',
    model: 'nova-3',
    language: DEEPGRAM_LANG[lang],
    smartFormat: true,
    // Emit interim results so the orchestrator can react (barge-in bookkeeping,
    // filler timing) before the final transcript lands.
    endpointing: env.VOICE_ENDPOINTING_MS,
  };
}

/**
 * When the assistant is allowed to START talking.
 *
 * `waitSeconds` is the floor — a hard pause after the caller stops. Smart
 * endpointing runs on top: it predicts whether the utterance is semantically
 * complete ("I'd like to book a" → keep waiting; "I'd like to book" → answer),
 * so we can keep the floor low without cutting people off mid-sentence.
 *
 * The two on-punctuation rules are the escape hatches: a question mark means
 * the caller clearly handed over the turn (answer sooner), while a number still
 * being dictated ("zero four seven…") means wait longer.
 */
export function buildStartSpeakingPlan(lang: VoiceLanguage) {
  return {
    waitSeconds: env.VOICE_START_WAIT_SECONDS,
    smartEndpointingEnabled: true,
    smartEndpointingPlan: {
      provider: 'livekit',
      // LiveKit turn detector only ships an English model; French falls back to
      // Vapi's built-in endpointing, which is why the wait floor stays non-zero.
      ...(lang === 'en' ? { waitFunction: '2000 / (1 + exp(-10 * (x - 0.5)))' } : {}),
    },
    transcriptionEndpointingPlan: {
      onPunctuationSeconds: 0.1,
      onNoPunctuationSeconds: 1.0,
      onNumberSeconds: 0.5,
    },
  };
}

/**
 * When the assistant must STOP talking — the surgical barge-in.
 *
 * `numWords: 0` means we do not wait for a word to be transcribed at all: the
 * VAD alone cuts the audio, which is what makes an interruption feel instant
 * instead of stuttering over the caller. `voiceSeconds` is the guard against
 * that being too twitchy — the caller must actually produce ~200 ms of voiced
 * audio, so a cough or a "mhm" backchannel does not derail the assistant.
 *
 * `backoffSeconds` is the silence the assistant keeps after being cut off
 * before it may speak again. Too low and the two talk over each other in a
 * loop (the "saturation" failure mode); 1 s is the smallest value that reliably
 * yields the floor.
 */
export function buildStopSpeakingPlan() {
  return {
    numWords: 0,
    voiceSeconds: env.VOICE_BARGE_IN_VOICE_SECONDS,
    backoffSeconds: env.VOICE_BARGE_IN_BACKOFF_SECONDS,
    acknowledgementPhrases: [
      'i understand', 'ok', 'okay', 'right', 'yeah', 'yes', 'uh-huh', 'mm-hmm',
      'd\'accord', 'ouais', 'oui', 'hm', 'mhm', 'je vois', 'très bien',
    ],
    // Unique — Vapi rejects the whole assistant on a duplicate
    // ("stopSpeakingPlan.All interruptionPhrases's elements must be unique"),
    // and 'stop' is the same word in both languages.
    interruptionPhrases: [
      'stop', 'wait', 'hold on', 'excuse me', 'actually', 'no no',
      'attendez', 'attends', 'non non', 'pardon', 'en fait',
    ],
  };
}

/**
 * Voice config optimised for time-to-first-audio-byte.
 *
 * ElevenLabs Flash v2.5 is the ~75 ms TTFB model. `chunkPlan` controls how
 * early we hand text to the synthesiser: a 20-character first chunk means the
 * caller hears audio while the LLM is still streaming the rest of the sentence.
 * Keeping the minimum small is the whole point — raising it trades perceived
 * latency for marginally better prosody.
 */
export function buildVoice(opts: {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}) {
  return {
    provider: '11labs',
    voiceId: opts.voiceId,
    model: 'eleven_flash_v2_5',
    /* Plancher de stabilité.
     *
     * 0,22 était le défaut, et sous ~0,35 le modèle Flash articule mal: il
     * gagne en expressivité ce qu'il perd en diction, avec des syllabes
     * avalées et des mots écrasés. Un personnage peut demander plus bas, on
     * remonte quand même: une réceptionniste qu'on ne comprend pas ne remplit
     * aucun de ses rôles. */
    stability: Math.max(0.35, opts.stability ?? 0.45),
    similarityBoost: opts.similarityBoost ?? 0.65,
    style: opts.style ?? 0.7,
    useSpeakerBoost: true,
    optimizeStreamingLatency: env.VAPI_OPTIMIZE_LATENCY,
    speed: 1.0,
    chunkPlan: {
      enabled: true,
      minCharacters: env.VOICE_TTS_MIN_CHUNK_CHARS,
      // Only the boundaries Vapi accepts. An em dash and an ellipsis look like
      // obvious sentence breaks and are not on the list, and one unknown value
      // rejects the entire assistant:
      // "voice.chunkPlan.each value in punctuationBoundaries must be one of…".
      punctuationBoundaries: ['.', '!', '?', ',', ';', ':'],
      formatPlan: { enabled: true, numberToDigitsCutoff: 2025 },
    },
    fallbackPlan: {
      voices: [
        { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_1, model: 'eleven_flash_v2_5' },
        { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_2, model: 'eleven_flash_v2_5' },
      ],
    },
  };
}

/**
 * Les voix du modèle temps réel.
 *
 * La liste est courte et FERMÉE: Vapi rejette l'assistant entier sur une voix
 * inconnue, et six voix d'OpenAI (ash, ballad, coral, fable, onyx, nova) ne
 * sont pas servies par les modèles temps réel. `marin` et `cedar` sont les deux
 * qui leur sont propres, et de loin les plus naturelles.
 *
 * Le personnage choisi ne détermine donc plus le timbre exact, seulement le
 * genre. C'est la contrepartie honnête du mode: le modèle fabrique sa voix, il
 * n'en emprunte pas une.
 */
const REALTIME_VOICE: Record<'f' | 'm', string> = { f: 'marin', m: 'cedar' };

/**
 * Le mode parole-à-parole s'applique-t-il à CE client ?
 *
 * Une voix clonée l'emporte toujours. Un client qui a enregistré la sienne a
 * demandé précisément cette voix-là; la remplacer par celle d'OpenAI, si
 * naturelle soit-elle, ne serait pas une amélioration mais la perte de ce
 * qu'il était venu chercher. La règle est automatique, jamais un réglage à ne
 * pas oublier.
 */
export function useSpeechToSpeech(opts: { hasCustomVoice?: boolean }): boolean {
  return env.VOICE_SPEECH_TO_SPEECH && !opts.hasCustomVoice;
}

/**
 * Le couple modèle + voix, choisi d'un seul endroit.
 *
 * Les trois appelants (l'appel entrant réel, l'appel test du tableau de bord,
 * la démo publique) assemblaient chacun leur `model` et leur `voice`. Trois
 * copies d'un choix, c'est trois occasions de diverger, et le client a déjà
 * demandé que la réceptionniste soit la même partout. Le branchement vit ici.
 */
export function buildSpeech(opts: {
  lang: VoiceLanguage;
  systemPrompt: string;
  tools: any[];
  character: { voiceId: string; gender: 'f' | 'm'; stability?: number; similarityBoost?: number; style?: number };
  hasCustomVoice?: boolean;
  /** L'option « LLM personnalisé » de l'appel entrant, qui ramène la boucle ici. */
  customLlmUrl?: string;
  temperature?: number;
}): { model: any; voice: any; speechToSpeech: boolean } {
  const speechToSpeech = useSpeechToSpeech({ hasCustomVoice: opts.hasCustomVoice });

  if (speechToSpeech) {
    return {
      speechToSpeech,
      model: {
        provider: 'openai',
        model: env.VOICE_REALTIME_MODEL,
        temperature: opts.temperature ?? 0.6,
        maxTokens: env.VOICE_MAX_COMPLETION_TOKENS,
        messages: [{ role: 'system', content: opts.systemPrompt }],
        tools: opts.tools,
      },
      voice: { provider: 'openai', voiceId: REALTIME_VOICE[opts.character.gender] },
    };
  }

  return {
    speechToSpeech,
    model: {
      ...(opts.customLlmUrl
        ? { provider: 'custom-llm', url: opts.customLlmUrl }
        : { provider: 'openai' }),
      model: env.VAPI_MODEL,
      temperature: opts.temperature ?? 0.6,
      // Cap the completion: a receptionist turn that runs past ~60 tokens is
      // a monologue, and long completions are the other half of TTS latency.
      maxTokens: env.VOICE_MAX_COMPLETION_TOKENS,
      messages: [{ role: 'system', content: opts.systemPrompt }],
      tools: opts.tools,
    },
    voice: buildVoice({
      voiceId: opts.character.voiceId,
      stability: opts.character.stability,
      similarityBoost: opts.character.similarityBoost,
      style: opts.character.style,
    }),
  };
}

/**
 * Backchannels — the assistant saying "mm-hmm" WHILE the caller is talking.
 *
 * This is the largest remaining humanity gap, and it is independent of latency:
 * an agent that stays perfectly silent through a twenty-second explanation and
 * then answers instantly still reads as a machine, because humans acknowledge
 * continuously.
 *
 * The words deliberately do NOT overlap with `stopSpeakingPlan.acknowledgementPhrases`
 * beyond what is unavoidable. That list tells Vapi "if the CALLER says this,
 * it is not an interruption"; this one is what the ASSISTANT emits. Sharing a
 * vocabulary is fine — they are evaluated on different audio streams — but the
 * assistant's set is kept short and low-energy on purpose: a backchannel that
 * carries meaning ("yes", "oui") reads as agreement to whatever was just said,
 * which is a promise nobody made.
 */
export function buildBackchannelPlan(lang: VoiceLanguage) {
  return {
    enabled: env.VOICE_BACKCHANNEL_ENABLED,
    // Non-committal by design: never "yes", never "d'accord".
    words:
      lang === 'fr'
        ? ['mm-hmm', 'hm-hm', 'mhm', 'je vois']
        : ['mm-hmm', 'uh-huh', 'right', 'i see'],
    // How long the caller must have been talking before the first one fires.
    // Below this the caller is still forming a sentence and an interjection
    // sounds like an interruption rather than attention.
    responseFrequencySeconds: env.VOICE_BACKCHANNEL_FREQUENCY_SECONDS,
    startDelaySeconds: env.VOICE_BACKCHANNEL_START_DELAY_SECONDS,
  };
}

/**
 * The full real-time block shared by inbound receptionist assistants and
 * outbound call overrides. Everything here is latency- or interruption-related;
 * business config (prompt, tools, first message) is layered on by the caller.
 */
export function buildRealtimePlans(lang: VoiceLanguage, speechToSpeech = false) {
  return {
    /* Le modèle parole-à-parole entend l'audio lui-même: lui adjoindre un
       transcripteur, c'est payer une étape dont plus personne ne lit la
       sortie, et fixer la latence sur elle. Vapi le documente comme inutile
       dans ce mode. */
    ...(speechToSpeech ? {} : { transcriber: buildTranscriber(lang) }),
    startSpeakingPlan: buildStartSpeakingPlan(lang),
    stopSpeakingPlan: buildStopSpeakingPlan(),
    backchannelingEnabled: env.VOICE_BACKCHANNEL_ENABLED,
    // No backchannelPlan here. Vapi rejects the whole assistant with
    // "assistant.property backchannelPlan should not exist", which took down
    // every call — the test call AND the real inbound ones, since both are
    // built from this. `backchannelingEnabled` alone is accepted, and the
    // phrase list it used to carry is kept in buildBackchannelPlan for the day
    // the API accepts one again.
    // Nudge long before the hang-up deadline below: they are different events.
    messagePlan: buildIdleMessagePlan(lang, env.VOICE_IDLE_NUDGE_SECONDS, env.VOICE_IDLE_NUDGE_COUNT),
    // Streams the first message as soon as the channel is up instead of waiting
    // for the model to be primed.
    firstMessageMode: 'assistant-speaks-first',
    backgroundDenoisingEnabled: true,
    silenceTimeoutSeconds: env.VAPI_SILENCE_TIMEOUT,
    maxDurationSeconds: env.VAPI_MAX_DURATION,
  };
}
