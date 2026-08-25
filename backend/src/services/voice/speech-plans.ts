import { env } from '../../config/env';
import { buildIdleMessagePlan } from './conversational-repair';
import { CARTESIA_LANG, cartesiaVoiceFor } from './cartesia.service';

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

export type VoiceLanguage = 'fr' | 'en' | 'nl';

/** Deepgram language codes we actually ship. */
const DEEPGRAM_LANG: Record<VoiceLanguage, string> = { fr: 'fr', en: 'en-US', nl: 'nl' };

/* Le néerlandais tourne sur nova-2: nova-3 est documenté anglais d'abord
 * (le multilingue passe par `language: 'multi'`, un mode différent), tandis
 * que nova-2 supporte `nl` nommément. Un WER mesuré sur de vrais appels
 * flamands décidera d'un éventuel passage à nova-3 multi. */
const DEEPGRAM_MODEL: Record<VoiceLanguage, string> = { fr: 'nova-3', en: 'nova-3', nl: 'nova-2' };

/**
 * Transcriber tuned for conversational endpointing rather than transcription
 * accuracy on long-form audio. `endpointing` is the silence (ms) after speech
 * before a final transcript is flushed — the single biggest lever on turn
 * latency. 150 ms is aggressive but safe when smart endpointing is on, because
 * the start-speaking plan re-checks whether the sentence sounded finished.
 */
/** Codes BCP-47 pour les transcripteurs de secours non-Deepgram. */
const FALLBACK_STT_LANG: Record<VoiceLanguage, string> = { fr: 'fr-FR', en: 'en-US', nl: 'nl-NL' };

/**
 * Le secours, décrit dans le vocabulaire du FOURNISSEUR qu'il vise.
 *
 * Ce plan posait `fr-FR` / `nl-NL` quel que soit le fournisseur. Chez Deepgram,
 * ces codes n'existent pas: il attend `fr` et `nl`, et il n'accepte de région
 * que là où il en publie une (`en-US`, `fr-CA`). Vapi validait donc l'assistant
 * ENTIER et le rejetait:
 *
 *   assistant.transcriber.fallbackPlan.each value in transcribers.language must
 *   be one of the following values for the default nova-2 model: en, …
 *
 * Conséquence: aucun appel ne démarrait, et le message ne parlait ni de langue
 * ni de secours. C'est le défaut signalé (« l'appel test ne marche pas »), et il
 * ne se voyait que sur les comptes où `VOICE_STT_FALLBACK_PROVIDER` est posé,
 * puisque sans elle le champ n'est pas envoyé du tout.
 *
 * Le modèle est déclaré explicitement plutôt que laissé au défaut de Vapi: le
 * message d'erreur ci-dessus vient précisément de ce défaut implicite, et un
 * jour où Vapi changera de modèle par défaut, ce plan changerait de langue
 * acceptée sans que rien ici ne bouge.
 */
function fallbackTranscriber(provider: string, lang: VoiceLanguage) {
  return provider === 'deepgram'
    ? { provider, model: 'nova-2', language: DEEPGRAM_LANG[lang] }
    : { provider, language: FALLBACK_STT_LANG[lang] };
}

/**
 * Les secours coûtent leur DÉMARRAGE, et tous les appels ne les valent pas.
 *
 * Un plan de secours déclare un second fournisseur que Vapi doit préparer avant
 * de répondre. Sur un appel téléphonique, ce prix est juste: si Deepgram tombe
 * pendant qu'un client appelle, personne ne décroche, et quelques centaines de
 * millisecondes valent mieux qu'une ligne muette.
 *
 * Sur un appel NAVIGATEUR (le test du portail, la configuration à la voix), le
 * calcul s'inverse: le gérant est devant son écran, il voit l'attente, et si ça
 * échoue il rappuie. Mesure relevée sur iPhone: création 2,4 s, liaison 4,3 s,
 * dont une part revient à ce démarrage-là.
 *
 * D'où ce drapeau, et non une variable d'environnement: le réglage global
 * aurait retiré les secours aux VRAIS appels par la même occasion.
 */
export interface SpeechOptions {
  /** `false` sur les appels navigateur: on paie l'attente, pas le risque. */
  fallbacks?: boolean;
}

export function buildTranscriber(lang: VoiceLanguage, opts: SpeechOptions = {}) {
  return {
    provider: 'deepgram',
    model: DEEPGRAM_MODEL[lang],
    language: DEEPGRAM_LANG[lang],
    smartFormat: true,
    // Emit interim results so the orchestrator can react (barge-in bookkeeping,
    // filler timing) before the final transcript lands.
    endpointing: env.VOICE_ENDPOINTING_MS,
    /* Panne Deepgram = panne totale tant qu'aucun secours n'est déclaré.
       Opt-in par env (voir le commentaire dans env.ts): le champ n'existe pas
       du tout tant que la variable est vide, pour que le schéma envoyé à Vapi
       reste identique à celui qui tourne aujourd'hui. */
    ...(env.VOICE_STT_FALLBACK_PROVIDER && opts.fallbacks !== false
      ? {
          fallbackPlan: {
            transcribers: [fallbackTranscriber(env.VOICE_STT_FALLBACK_PROVIDER, lang)],
          },
        }
      : {}),
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
    /* Le détecteur de fin de tour, choisi par LANGUE.
     *
     * Le commentaire précédent disait que le français « retombait » sur la
     * détection interne de Vapi. C'était faux: le code posait `livekit` dans
     * les deux cas, et le modèle de LiveKit n'existe qu'en anglais. Le
     * français tournait donc sur un détecteur entraîné sur une autre langue —
     * autrement dit, sur la syntaxe qui décide si la phrase est finie, il
     * devinait. C'est exactement ce qui produit les deux défauts qu'on ressent
     * comme « robotique »: elle coupe la parole, ou elle laisse un blanc.
     *
     * Vapi documente son propre modèle comme celui à employer hors anglais.
     * `waitFunction` reste réservée à LiveKit, dont elle module la courbe.
     *
     * LiveKit a depuis publié un modèle de tour multilingue (français inclus).
     * `VOICE_FR_ENDPOINTING_PROVIDER=livekit` permet de le valider sur de
     * vrais appels; le défaut reste `vapi`, le choix documenté ci-dessus, et
     * le retour arrière est un set d'env, pas un déploiement. Le néerlandais
     * suit la même règle que le français: détecteur Vapi, seul documenté
     * hors anglais. */
    smartEndpointingPlan:
      lang === 'en' || (lang === 'fr' && env.VOICE_FR_ENDPOINTING_PROVIDER === 'livekit')
        ? { provider: 'livekit', waitFunction: '2000 / (1 + exp(-10 * (x - 0.5)))' }
        : { provider: 'vapi' },
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
 * `numWords` décide de CE QUI a le droit de la couper.
 *
 * À 0, la seule activité vocale suffit: l'interruption est instantanée, et
 * c'était le réglage. Retour de terrain: « elle arrête de parler dès qu'elle
 * entend un peu de bruit ». Une porte, une radio, une conversation à côté
 * produisent tous de l'activité vocale, et 200 ms de garde ne les distinguent
 * pas d'une syllabe. Sur un appel entrant, l'appelant est rarement au calme:
 * la réceptionniste passait son temps à se taire.
 *
 * Attendre deux mots TRANSCRITS trie à la source: le bruit ne produit pas de
 * mots, une phrase en produit. Le coût est de 200 à 300 ms sur l'interruption
 * volontaire, sous le seuil où l'on se sent ignoré, et le gain est qu'elle
 * finit ses phrases. `voiceSeconds` reste la garde du chemin sans transcript.
 *
 * `backoffSeconds` is the silence the assistant keeps after being cut off
 * before it may speak again. Too low and the two talk over each other in a
 * loop (the "saturation" failure mode); 1 s is the smallest value that reliably
 * yields the floor.
 */
/**
 * Le même plan, mais SANS un seul mot dedans.
 *
 * En parole-à-parole il n'y a pas de transcripteur, donc plus rien ne compte
 * les mots: `numWords`, `acknowledgementPhrases` et `interruptionPhrases`
 * attendent une sortie qui n'existe pas. C'est pour cette raison que le plan
 * entier avait été retiré de ce mode, et le tour de parole revenait alors à la
 * détection d'énergie seule, réglée par le défaut de Vapi. D'où le défaut qui
 * revient: elle se tait au moindre bruit.
 *
 * `voiceSeconds` et `backoffSeconds`, eux, ne lisent aucun transcript: ils se
 * mesurent sur l'audio. Les envoyer seuls rend donc le seuil de bruit réglable
 * en temps réel aussi, sans réintroduire l'attente de mots qui rendait la
 * réceptionniste sourde.
 */
export function buildRealtimeStopSpeakingPlan() {
  return {
    /* 0 explicitement: c'est le chemin « énergie seule », le seul disponible
       sans transcripteur. Ce n'est pas un oubli de `VOICE_BARGE_IN_WORDS`. */
    numWords: 0,
    voiceSeconds: env.VOICE_BARGE_IN_VOICE_SECONDS,
    backoffSeconds: env.VOICE_BARGE_IN_BACKOFF_SECONDS,
  };
}

export function buildStopSpeakingPlan() {
  return {
    numWords: env.VOICE_BARGE_IN_WORDS,
    voiceSeconds: env.VOICE_BARGE_IN_VOICE_SECONDS,
    backoffSeconds: env.VOICE_BARGE_IN_BACKOFF_SECONDS,
    acknowledgementPhrases: [
      'i understand', 'ok', 'okay', 'right', 'yeah', 'yes', 'uh-huh', 'mm-hmm',
      'd\'accord', 'ouais', 'oui', 'hm', 'mhm', 'je vois', 'très bien',
      // NL — 'ja' et 'oké' sont les backchannels flamands les plus fréquents.
      'ja', 'jaja', 'oké', 'begrepen', 'ik snap het',
    ],
    // Unique — Vapi rejects the whole assistant on a duplicate
    // ("stopSpeakingPlan.All interruptionPhrases's elements must be unique"),
    // and 'stop' is the same word in all three languages ('pardon' too:
    // FR = NL, so it appears once and serves both).
    interruptionPhrases: [
      'stop', 'wait', 'hold on', 'excuse me', 'actually', 'no no',
      'attendez', 'attends', 'non non', 'pardon', 'en fait',
      'wacht', 'wacht even', 'nee nee', 'eigenlijk', 'sorry hoor',
    ],
  };
}

/**
 * Voice config optimised for time-to-first-audio-byte.
 *
 * ElevenLabs Flash v2.5 est le modèle à ~75 ms de premier octet. `chunkPlan`
 * décide de la quantité de texte remise au synthétiseur d'un coup.
 *
 * CE COMMENTAIRE DISAIT L'INVERSE, et il se trompait sur le prix. Il défendait
 * un premier morceau de 20 caractères, en jugeant la perte de prosodie
 * « marginale ». Elle ne l'est pas: à 20 caractères, coupés en plus à chaque
 * virgule, le synthétiseur reçoit des fragments sans contexte. Il ne sait ni où
 * poser l'accent, ni comment terminer sa courbe mélodique, et il sur-articule
 * pour compenser. Retour de terrain, sur toutes les voix: « ça parle trop
 * haché, ça articule trop, ça sonne pas naturel ».
 *
 * On rend donc au synthétiseur de quoi faire une phrase, et on ne coupe plus
 * qu'aux fins de phrase. Le coût est de quelques dizaines de millisecondes sur
 * le premier son, une fois par tour de parole; le gain est qu'on entend une
 * personne plutôt qu'un enchaînement de morceaux.
 */
/**
 * Les réglages d'un personnage, tels qu'ils sont RÉELLEMENT servis.
 *
 * Extrait de `buildVoice` parce qu'un second appelant en avait besoin, et que
 * son absence était un défaut à elle seule: l'aperçu du sélecteur synthétisait
 * les valeurs BRUTES du personnage, sans plancher ni plafond, et sur un autre
 * modèle. Le client auditionnait donc une voix, et ses appelants en
 * entendaient une autre, plus plate. C'est la façon la plus sûre de rendre un
 * choix de voix impossible, et ça explique une partie du « ça sonne pas comme
 * ce que j'ai écouté ».
 *
 * Plancher de stabilité: sous ~0,35 le modèle articule mal, syllabes avalées
 * et mots écrasés. Plafond de style: un personnage reste plus expressif qu'un
 * autre, aucun ne monte au niveau théâtral.
 */
export function resolveVoiceTuning(opts: {
  stability?: number;
  similarityBoost?: number;
  style?: number;
}) {
  return {
    stability: Math.max(0.35, opts.stability ?? 0.45),
    similarityBoost: opts.similarityBoost ?? 0.65,
    style: Math.min(env.VOICE_TTS_STYLE_CAP, opts.style ?? 0.4),
  };
}

/**
 * La découpe du texte remise au synthétiseur, commune aux deux fournisseurs.
 *
 * Extraite de `buildVoice` quand Cartesia est arrivé: c'est le seul réglage de
 * rendu que les deux acceptent, et le laisser en double aurait fait diverger
 * deux copies de la même décision.
 */
function buildChunkPlan() {
  return {
    enabled: true,
    minCharacters: env.VOICE_TTS_MIN_CHUNK_CHARS,
    // Only the boundaries Vapi accepts. An em dash and an ellipsis look like
    // obvious sentence breaks and are not on the list, and one unknown value
    // rejects the entire assistant:
    // "voice.chunkPlan.each value in punctuationBoundaries must be one of…".
    /* FINS DE PHRASE SEULEMENT. La virgule, le point-virgule et les deux
       points étaient dans cette liste: une phrase de trois virgules partait
       donc en quatre morceaux synthétisés séparément, chacun terminé comme
       s'il était la fin de quelque chose. C'est précisément ce qui s'entend
       comme « haché ». */
    punctuationBoundaries: ['.', '!', '?'],
    formatPlan: { enabled: true, numberToDigitsCutoff: 2025 },
  };
}

/**
 * Cartesia doit-il servir CETTE voix-ci ?
 *
 * Trois conditions, et chacune évite une panne différente:
 *
 *  - le fournisseur est demandé (`VOICE_TTS_PROVIDER=cartesia`);
 *  - la voix n'est pas un CLONE. Un clone existe chez ElevenLabs et nulle part
 *    ailleurs: le servir par Cartesia ne donnerait pas une voix approchante,
 *    il donnerait la voix de quelqu'un d'autre;
 *  - le timbre a une correspondance chez Cartesia. Sans elle, on garde
 *    ElevenLabs plutôt que de servir un timbre au hasard, et la bascule peut
 *    donc se faire voix par voix, à l'oreille.
 *
 * Exportée parce que l'aperçu du sélecteur pose exactement la même question, et
 * doit y répondre pareil: sinon on auditionne une voix et l'appelant en entend
 * une autre.
 */
export function useCartesia(opts: { voiceId: string; cloned?: boolean }): string | null {
  if (env.VOICE_TTS_PROVIDER !== 'cartesia') return null;
  if (opts.cloned) return null;
  return cartesiaVoiceFor(opts.voiceId);
}

export function buildVoice(opts: {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  /** La langue de l'appel: Cartesia la veut sur le bloc voix. */
  lang?: VoiceLanguage;
  /** Une voix clonée ne quitte jamais ElevenLabs. Voir `useCartesia`. */
  cloned?: boolean;
}) {
  const cartesiaVoiceId = useCartesia(opts);
  if (cartesiaVoiceId) {
    return {
      provider: 'cartesia',
      voiceId: cartesiaVoiceId,
      model: env.CARTESIA_MODEL,
      language: CARTESIA_LANG[opts.lang ?? 'fr'],
      /* Les champs ElevenLabs (stability, style, similarityBoost, speed,
         useSpeakerBoost) N'EXISTENT PAS sur ce bloc, et Vapi rejette
         l'assistant entier sur un champ inconnu. Ce n'est pas un oubli: le
         timbre de Sonic se choisit en choisissant la voix.
         `chunkPlan` est accepté des deux côtés et sert la même chose: rendre
         une PHRASE au synthétiseur plutôt que des fragments. */
      chunkPlan: buildChunkPlan(),
      /* Le filet. Si Cartesia ne répond pas, la ligne repart sur la voix
         ElevenLabs d'origine plutôt que de rester muette. C'est ce qui rend la
         bascule essayable sur de vrais appels entrants. */
      fallbackPlan: {
        voices: [
          { provider: '11labs', voiceId: opts.voiceId, model: env.VOICE_TTS_MODEL },
          { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_1, model: env.VOICE_TTS_MODEL },
        ],
      },
    };
  }

  return {
    provider: '11labs',
    voiceId: opts.voiceId,
    model: env.VOICE_TTS_MODEL,
    ...resolveVoiceTuning(opts),
    useSpeakerBoost: true,
    optimizeStreamingLatency: env.VAPI_OPTIMIZE_LATENCY,
    speed: env.VOICE_SPEECH_SPEED,
    chunkPlan: buildChunkPlan(),
    fallbackPlan: {
      voices: [
        { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_1, model: env.VOICE_TTS_MODEL },
        { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_2, model: env.VOICE_TTS_MODEL },
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
export function useSpeechToSpeech(opts: {
  hasCustomVoice?: boolean;
  /** `auto` suit le réglage global; les deux autres l'emportent. */
  voiceMode?: 'auto' | 'realtime' | 'classic';
}): boolean {
  // La voix clonée passe avant TOUT, y compris un `realtime` explicite: le
  // client a enregistré cette voix-là, la lui retirer n'est pas un réglage.
  if (opts.hasCustomVoice) return false;
  if (opts.voiceMode === 'realtime') return true;
  if (opts.voiceMode === 'classic') return false;
  /* `auto` quand l'option est VENDUE (supplément posé) vaut « non ».
     Le défaut global met tout le monde en temps réel; laisser `auto` y
     résoudre reviendrait à facturer un supplément à des clients qui n'ont
     jamais rien choisi, et à le leur apprendre par la facture. Un supplément
     ne peut être dû que par un choix explicite. */
  if (env.VOICE_REALTIME_SURCHARGE_EUR > 0) return false;
  return env.VOICE_SPEECH_TO_SPEECH;
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
  /** Le mode choisi pour ce client; `auto` suit le réglage global. */
  voiceMode?: 'auto' | 'realtime' | 'classic';
  /** L'option « LLM personnalisé » de l'appel entrant, qui ramène la boucle ici. */
  customLlmUrl?: string;
  temperature?: number;
  /** Voir `SpeechOptions`: `false` sur les appels navigateur. */
  fallbacks?: boolean;
}): { model: any; voice: any; speechToSpeech: boolean } {
  const speechToSpeech = useSpeechToSpeech({ hasCustomVoice: opts.hasCustomVoice, voiceMode: opts.voiceMode });

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
      /* Modèles de secours, opt-in par env, et seulement sur le chemin où
         Vapi tient lui-même la boucle: sur custom-llm c'est CE backend qui
         est le fournisseur, un fallback déclaré ici n'aurait pas de sens. */
      ...(!opts.customLlmUrl && opts.fallbacks !== false && env.VOICE_LLM_FALLBACK_MODELS.length
        ? { fallbackModels: env.VOICE_LLM_FALLBACK_MODELS }
        : {}),
    },
    voice: buildVoice({
      voiceId: opts.character.voiceId,
      stability: opts.character.stability,
      similarityBoost: opts.character.similarityBoost,
      style: opts.character.style,
      lang: opts.lang,
      /* Une voix clonée ne quitte pas ElevenLabs, et c'est ici qu'on le sait:
         `hasCustomVoice` est déjà ce qui décide du moteur juste au dessus. */
      cloned: opts.hasCustomVoice,
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
export function buildRealtimePlans(lang: VoiceLanguage, speechToSpeech = false, opts: SpeechOptions = {}) {
  return {
    /* Le modèle parole-à-parole entend l'audio lui-même: lui adjoindre un
       transcripteur, c'est payer une étape dont plus personne ne lit la
       sortie, et fixer la latence sur elle. Vapi le documente comme inutile
       dans ce mode. */
    ...(speechToSpeech ? {} : { transcriber: buildTranscriber(lang, opts) }),
    /* LES DEUX PLANS DE PAROLE SUPPOSENT UN TRANSCRIPTEUR. Sans lui, ils ne
       peuvent pas être satisfaits, et c'est une panne, pas une dégradation.
       Regardez de quoi ils sont faits: `numWords`, `acknowledgementPhrases`,
       `interruptionPhrases`, et un plan littéralement nommé
       `transcriptionEndpointingPlan`. Tout cela compte des MOTS.
       En parole-à-parole le transcripteur est retiré, à raison: le modèle
       entend l'audio lui-même. Mais on continuait d'envoyer les deux plans.
       La réceptionniste attendait donc des mots qui n'arrivaient jamais, ne
       répondait pas, et le délai de silence raccrochait. Retour de terrain, en
       mode Direct: « il ne m'entend pas quand je parle, et ça raccroche vite ».
       Le passage de `numWords` de 0 à 2, fait pour la protéger du bruit, a
       aggravé ce cas précis: à 0, la seule activité vocale pouvait encore
       l'interrompre sans transcript.
       La correction d'alors retirait les deux plans, et elle allait trop loin.
       Un plan sur deux est fait de mots, l'autre pas: `voiceSeconds` et
       `backoffSeconds` se mesurent sur l'audio et n'ont jamais eu besoin d'un
       transcripteur. Les retirer laissait le seuil de bruit au défaut de Vapi,
       0,2 s, et c'est le défaut qui revient: « il s'arrête de parler alors que
       je ne parle pas ». On envoie donc, en parole-à-parole, la partie du plan
       qui s'entend, et rien de ce qui se compte. */
    ...(speechToSpeech
      ? {
          /* Ce qui reste envoyable sans transcripteur: le seuil de bruit.
             `startSpeakingPlan` n'a pas d'équivalent, il est fait de règles de
             ponctuation et de fin de phrase; en parole-à-parole, le moment de
             répondre appartient au modèle. Le moment de SE TAIRE, lui, se
             mesure sur l'audio, et le laisser au défaut de Vapi (0,2 s) est
             précisément ce qui la fait taire au moindre bruit. */
          stopSpeakingPlan: buildRealtimeStopSpeakingPlan(),
        }
      : {
          startSpeakingPlan: buildStartSpeakingPlan(lang),
          stopSpeakingPlan: buildStopSpeakingPlan(),
        }),
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
