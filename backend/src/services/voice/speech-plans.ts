import { env } from '../../config/env';
import { customLlmPathToken } from '../../utils/vapi-webhook-auth';
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
 * Le modèle et la langue à envoyer, selon qu'on suit une langue ou toutes
 * (BEL-11).
 *
 * En mode multilingue, Nova-3 suit un basculement de langue EN COURS DE
 * PHRASE, ce qui est la norme à Bruxelles et ce qu'aucun réglage épinglé ne
 * peut faire: sur `language: 'fr'`, le néerlandais ressort en charabia
 * français et l'agent répond à côté.
 *
 * Le néerlandais y passe de nova-2 à nova-3, forcément: `multi` n'existe pas
 * sur nova-2. C'est un effet de bord assumé du drapeau, pas une décision
 * séparée, et c'est pour ça que les deux ne se règlent pas indépendamment.
 */
function deepgramFor(lang: VoiceLanguage): { model: string; language: string } {
  if (env.VOICE_STT_MULTILINGUAL) return { model: 'nova-3', language: 'multi' };
  return { model: DEEPGRAM_MODEL[lang], language: DEEPGRAM_LANG[lang] };
}

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
  /**
   * Les mots propres à CE client, à souffler au transcripteur (BEL-5 / BEL-7).
   *
   * Nom de l'entreprise, nom de l'agent, intitulés de prestations: ce sont
   * exactement les mots qu'un appelant prononce et qu'un modèle générique
   * écrit de travers, parce qu'ils ne figurent dans aucun corpus. Absent ou
   * vide, aucun champ n'est envoyé et le schéma reste celui d'aujourd'hui.
   */
  vocabulary?: string[];
}

/**
 * Le plafond de la fenêtre de biasing.
 *
 * Deepgram dégrade au-delà d'une centaine de termes, et la documentation de
 * Vapi le dit autrement: « start with minimal boosting, focus on uncommon
 * domain-specific terms ». Souffler tout le catalogue d'un client reviendrait
 * à ne rien souffler du tout, en dégradant le reste au passage.
 */
const MAX_KEYTERMS = 60;

/** Les mots trop courants pour valoir un boost, et trop courts pour aider. */
const VOCAB_STOPWORDS = new Set([
  'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'au', 'aux',
  'the', 'and', 'of', 'for', 'to', 'a', 'an',
  'van', 'de', 'het', 'een', 'en',
]);

/**
 * Nettoie une liste de termes: sans doublon, sans ponctuation, sans mot vide.
 *
 * La casse est CONSERVÉE: la documentation de Vapi demande explicitement
 * « ensuring correct spelling and capitalization », un nom propre écrit en
 * minuscules soufflant au modèle la mauvaise graphie.
 */
function cleanVocabulary(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    if (typeof raw !== 'string') continue;
    // La ponctuation d'abord: « Chez Marie, » et « Chez Marie » sont un doublon
    // que le dédoublonnage ne verrait pas autrement.
    const term = raw.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (term.length < 3) continue;
    if (VOCAB_STOPWORDS.has(term.toLowerCase())) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= MAX_KEYTERMS) break;
  }
  return out;
}

/**
 * Le champ de biasing, choisi PAR MODÈLE. C'est le piège de cette ligne.
 *
 * Vapi n'expose pas le même champ selon le modèle Deepgram: `keyterm` accepte
 * des expressions et n'existe que sur Nova-3; `keywords` ne prend que des mots
 * SEULS et couvre Nova-2, Nova-1, Enhanced et Base. Or nos langues ne tournent
 * pas toutes sur le même modèle — français et anglais en Nova-3, néerlandais
 * en Nova-2. Envoyer le mauvais champ ferait refuser l'assistant entier, donc
 * tous les appels de la flotte.
 *
 * D'où la découpe en mots sur Nova-2: « Chez Marie » y devient deux entrées,
 * parce qu'une expression y serait au mieux ignorée.
 */
export function buildVocabularyField(model: string, terms: string[]): Record<string, string[]> {
  const clean = cleanVocabulary(terms);
  // Rien à souffler: pas de champ du tout, pour que le schéma envoyé reste
  // identique à celui qui tourne aujourd'hui.
  if (!clean.length) return {};

  if (model.startsWith('nova-3')) return { keyterm: clean };

  const words = cleanVocabulary(clean.flatMap(t => t.split(' ')));
  return words.length ? { keywords: words } : {};
}

/**
 * Les réglages de rendu, RENDUS PARAMÉTRABLES.
 *
 * Jusqu'ici chacun de ces curseurs se lisait directement dans `env`, donc
 * l'essayer demandait de poser une variable sur Render et d'attendre un
 * redéploiement. Deux moteurs ne se comparent pas comme ça: on compare deux
 * souvenirs séparés d'un quart d'heure.
 *
 * Un champ absent vaut la valeur d'environnement, ce qui garantit que la
 * production ne change pas d'un iota tant que personne ne passe rien: c'est la
 * condition pour que ce banc d'essai ne coûte rien à ceux qui ne s'en servent
 * pas.
 */
export interface VoiceTuning {
  ttsModel?: string;
  cartesiaModel?: string;
  speed?: number;
  styleCap?: number;
  minChunkChars?: number;
  bargeInWords?: number;
  bargeInVoiceSeconds?: number;
  /** Le même seuil sur le chemin parole-à-parole, où il travaille seul. */
  realtimeBargeInVoiceSeconds?: number;
  backoffSeconds?: number;
  silenceTimeout?: number;
  /** Les mots qui coupent tout de suite. Absents, ceux de l'environnement. */
  interruptionPhrases?: string[];
  /** Les mots qui ne coupent pas. Absents, ceux de l'environnement. */
  acknowledgementPhrases?: string[];
  realtimeModel?: string;
  llmModel?: string;
  temperature?: number;
  /**
   * LE MOMENT OÙ L'ON DÉCIDE QUE L'APPELANT A FINI, propre au niveau.
   *
   * Ces trois seuils étaient lus directement dans l'environnement par
   * `buildStartSpeakingPlan`, donc IDENTIQUES sur les deux moteurs. Or ils ont
   * été calibrés le 12/09/2026 contre la chaîne CLASSIQUE, qui ajoute sa
   * propre latence APRÈS que le seuil ait parlé: 941 ms de modèle plus 342 ms
   * de synthèse, mesurés (6quinquinquagesies). Le parole-à-parole supprime ces
   * deux étapes: le son part environ 300 ms après la décision.
   *
   * Conséquence, et c'est ce que l'appelant vit: à seuil ÉGAL, l'agent temps
   * réel pose sa voix sur la sienne à peu près une seconde plus tôt. « Je dis
   * bonjour et juste après il pose une question alors que j'ai pas fini ma
   * phrase » (17/09/2026) est exactement ce cas, et il tape sur le seuil de
   * PONCTUATION: « Bonjour » est une phrase complète, le transcripteur y met
   * un point, donc ce sont 0,4 s qui s'appliquent et jamais les 1,2 s du
   * seuil sans ponctuation.
   *
   * Un seuil calibré contre une chaîne ne vaut pas pour une autre chaîne. Ils
   * sont donc par NIVEAU, avec `base` vide pour que nommer ne change rien.
   */
  startWaitSeconds?: number;
  endpointingPunctuationSeconds?: number;
  endpointingNoPunctuationSeconds?: number;
}

/**
 * Les bornes, appliquées ICI et pas à l'écran.
 *
 * Un banc d'essai qui accepte n'importe quel nombre fabrique des assistants que
 * Vapi rejette, et l'essai échoue alors pour une raison qui n'a rien à voir
 * avec ce qu'on voulait entendre. Les bornes sont donc celles du domaine, pas
 * celles d'un champ de formulaire.
 */
const clamp = (v: number | undefined, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/**
 * Le plafond de `stopSpeakingPlan.voiceSeconds`, tel que l'API VIVANTE le dit.
 *
 * Pas une valeur de confort: au-delà, Vapi répond 400 et refuse l'assistant en
 * entier, donc tous les appels du client tombent (6octies). Relevé le 17/09/2026
 * par `npm run voice:validate`, sur les trois variantes temps réel à la fois:
 * « stopSpeakingPlan.voiceSeconds must not be greater than 0.5 ».
 */
const VOICE_SECONDS_MAX = 0.5;

export function resolveTuning(t: VoiceTuning = {}) {
  return {
    ttsModel: t.ttsModel || env.VOICE_TTS_MODEL,
    cartesiaModel: t.cartesiaModel || env.CARTESIA_MODEL,
    speed: clamp(t.speed, 0.8, 1.2, env.VOICE_SPEECH_SPEED),
    styleCap: clamp(t.styleCap, 0, 1, env.VOICE_TTS_STYLE_CAP),
    minChunkChars: Math.round(clamp(t.minChunkChars, 10, 200, env.VOICE_TTS_MIN_CHUNK_CHARS)),
    bargeInWords: Math.round(clamp(t.bargeInWords, 0, 5, env.VOICE_BARGE_IN_WORDS)),
    /* LE PLAFOND EST CELUI DE L'API, ET IL VAUT 0,5 (17/09/2026).
     *
     *   {"message":["stopSpeakingPlan.voiceSeconds must not be greater than 0.5"],
     *    "statusCode":400}
     *
     * Il valait 1,5 ici, choisi en lisant le code et pas l'API. Poser 1,5 était
     * donc légal chez nous et faisait refuser l'assistant ENTIER chez Vapi,
     * c'est-à-dire tomber tous les appels du client — le mode d'échec de
     * 6octies, atteint par un réglage que ce fichier présentait comme valide.
     * `npm run voice:validate` l'a attrapé avant le moindre appel, ce pour quoi
     * il existe; le plafond est maintenant au bon endroit pour que le script
     * n'ait plus à rattraper celui-là.
     *
     * Les DEUX chemins prennent la même borne, et le commentaire d'avant avait
     * raison sur le principe: c'est le même champ Vapi, et ce qui diffère est
     * la charge qu'il porte, pas ce que l'API accepte. Il avait juste le mauvais
     * nombre.
     *
     * Le plafond s'applique AUSSI à la valeur d'environnement, et il le faut:
     * `clamp` rend son `fallback` tel quel, donc une variable posée à 1,5 le
     * traversait sans être bornée. C'est le même piège que le délai de silence,
     * relevé le même jour: une borne qui ne couvre pas le chemin par lequel la
     * valeur arrive vraiment ne borne rien. */
    bargeInVoiceSeconds: Math.min(VOICE_SECONDS_MAX, clamp(
      t.bargeInVoiceSeconds, 0.1, VOICE_SECONDS_MAX, env.VOICE_BARGE_IN_VOICE_SECONDS,
    )),
    realtimeBargeInVoiceSeconds: Math.min(VOICE_SECONDS_MAX, clamp(
      t.realtimeBargeInVoiceSeconds ?? t.bargeInVoiceSeconds,
      0.1, VOICE_SECONDS_MAX,
      env.VOICE_REALTIME_BARGE_IN_VOICE_SECONDS,
    )),
    backoffSeconds: clamp(t.backoffSeconds, 0.3, 3, env.VOICE_BARGE_IN_BACKOFF_SECONDS),
    /* Le raccroché tombe APRÈS les relances, jamais avant ni en même temps.
     *
     * Deux réglages décrivent le même silence et ne se parlaient pas:
     * `VOICE_IDLE_NUDGE_SECONDS` (10 s) déclenche « Vous m'entendez ? », deux
     * fois, et `VAPI_SILENCE_TIMEOUT` décide du raccroché. Le commentaire de
     * `env.ts` l'affirme déjà — « il en reste largement avant le raccroché » —
     * mais rien ne le VÉRIFIAIT.
     *
     * Relevé le 17/09/2026: `VAPI_SILENCE_TIMEOUT` valait 10 en production.
     * Donc l'échéance du raccroché tombait à la seconde même de la première
     * relance, et le mécanisme de relance n'a JAMAIS tourné sur un seul appel.
     * Pire, et c'est ce qui se voyait: dix secondes après le décroché, un
     * accueil qui en dure sept ou huit laisse une seconde à l'appelant pour
     * parler. Tous les appels de test mouraient en `silence-timed-out` autour
     * de dix secondes, en parole-à-parole comme en classique, et ça se lisait
     * comme une panne du moteur vocal.
     *
     * Le plancher est donc le CALENDRIER des relances, pas une constante:
     * chaque relance a besoin de sa fenêtre, plus une dernière avant de
     * raccrocher. Un réglage qui désactive silencieusement une autre
     * fonctionnalité n'est pas un réglage, c'est un piège.
     *
     * Le plancher s'applique APRÈS `clamp`, et il faut y faire attention:
     * `clamp` rend son `fallback` TEL QUEL quand le client n'a rien réglé, donc
     * lui passer un plancher plus haut n'aurait rien changé au cas réel, celui
     * où la valeur vient justement de l'environnement. */
    silenceTimeout: Math.round(Math.min(120, Math.max(
      env.VOICE_IDLE_NUDGE_SECONDS * (env.VOICE_IDLE_NUDGE_COUNT + 1),
      clamp(t.silenceTimeout, 10, 120, env.VAPI_SILENCE_TIMEOUT),
    ))),
    /* Par client, puis par environnement, puis le code. Jamais une liste vide:
       sans mot d'arrêt plus rien ne coupe une réceptionniste lancée, et sans
       acquiescement elle se tait au premier « mm-hmm ». Un réglage qui peut
       casser la conversation ne doit pas pouvoir la casser par omission. */
    interruptionPhrases: phraseList(t.interruptionPhrases, env.VOICE_INTERRUPTION_PHRASES, DEFAULT_INTERRUPTION_PHRASES),
    acknowledgementPhrases: phraseList(t.acknowledgementPhrases, env.VOICE_ACKNOWLEDGEMENT_PHRASES, DEFAULT_ACKNOWLEDGEMENT_PHRASES),
    /* Bornes larges: ce sont des secondes de patience, et se tromper vers le
       haut coûte de la vivacité quand se tromper vers le bas coupe la parole.
       L'asymétrie est volontaire, comme celle de la marge de `call-audit`. */
    startWaitSeconds: clamp(t.startWaitSeconds, 0, 3, env.VOICE_START_WAIT_SECONDS),
    endpointingPunctuationSeconds: clamp(t.endpointingPunctuationSeconds, 0.1, 3, env.VOICE_ENDPOINTING_PUNCTUATION_SECONDS),
    endpointingNoPunctuationSeconds: clamp(t.endpointingNoPunctuationSeconds, 0.1, 4, env.VOICE_ENDPOINTING_NO_PUNCTUATION_SECONDS),
    realtimeModel: t.realtimeModel || env.VOICE_REALTIME_MODEL,
    llmModel: t.llmModel || env.VAPI_MODEL,
    temperature: clamp(t.temperature, 0, 1.2, 0.6),
  };
}

export type ResolvedTuning = ReturnType<typeof resolveTuning>;

export function buildTranscriber(lang: VoiceLanguage, opts: SpeechOptions = {}) {
  const deepgram = deepgramFor(lang);
  return {
    provider: 'deepgram',
    model: deepgram.model,
    language: deepgram.language,
    smartFormat: true,
    // Emit interim results so the orchestrator can react (barge-in bookkeeping,
    // filler timing) before the final transcript lands.
    endpointing: env.VOICE_ENDPOINTING_MS,
    /* Les mots propres au client, soufflés au transcripteur (BEL-5 / BEL-7).
       Le nom de l'entreprise et les intitulés de prestations sont exactement
       ce qu'un appelant prononce et qu'un modèle générique écrit de travers,
       faute de figurer dans un corpus. Le CHAMP dépend du modèle: voir
       `buildVocabularyField`. */
    ...buildVocabularyField(deepgram.model, opts.vocabulary ?? []),
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
/**
 * Le mode PATIENT, décidé par ce que l'agent vient de demander (TUR-3).
 *
 * `onNumberSeconds` est un seuil global: il s'applique dès qu'un chiffre passe,
 * quelle que soit la question. Or une adresse et une adresse e-mail ne se
 * dictent pas comme un numéro. « Rue de la Loi… cent cinquante-cinq… mille
 * bruxelles » se donne en trois blocs séparés par de vrais silences, et une
 * adresse e-mail s'épelle lettre par lettre avec des pauses plus longues
 * encore. Au seuil ordinaire, l'agent coupe au premier blanc et l'appelant
 * recommence — ce qui, sur une adresse, veut dire abandonner.
 *
 * `customEndpointingRules` de type `assistant` fait matcher la règle sur la
 * dernière phrase de L'AGENT, pas sur celle de l'appelant. C'est exactement le
 * bon accrochage: on ne sait pas ce que l'appelant va dire, mais on sait
 * toujours ce qu'on vient de lui demander. Vapi documente ce champ pour ce cas
 * précis, « data collection scenarios, such as gathering phone numbers or
 * addresses, or for spelling tasks ».
 *
 * ## Deux précautions
 *
 * Pas de `regexOptions`: la référence d'API en donne bien la forme
 * (`[{ enabled, type: 'ignore-case' }]`) mais l'exemple de la documentation
 * l'omet, et se tromper sur la forme d'un champ ferait refuser l'assistant
 * ENTIER, donc tous les appels. L'insensibilité à la casse est donc écrite
 * dans les motifs eux-mêmes, ce qui ne coûte rien et ne dépend de personne.
 *
 * Et les motifs sont ancrés sur des mots que l'agent emploie en POSANT la
 * question, jamais sur des mots qu'il pourrait dire en passant. « adresse »
 * dans « je note votre adresse » allonge un tour pour rien, ce qui est le
 * moindre mal; l'inverse — ne pas matcher quand on demande — est le défaut
 * qu'on répare.
 */
const PATIENT_SLOTS: Record<VoiceLanguage, Array<{ regex: string; seconds: number }>> = {
  fr: [
    /* L'adresse postale: trois blocs, de vrais silences entre eux.
       Les frontières de mot ne sont pas décoratives: sans elles, `rue` matche
       dans « c'est CRUel de vous faire attendre », et l'agent devient patient
       sur un tour qui n'a rien à voir. Vérifié, c'était le cas. */
    { regex: '\\b([Aa]dresse|[Rr]ue|[Cc]ode postal)\\b', seconds: 2.5 },
    // L'e-mail et l'épellation: lettre par lettre, les pauses les plus longues.
    { regex: '\\b([Ee]-?mail|[Cc]ourriel|lettre par lettre)\\b|[ÉEé]pel(er|ez)\\b', seconds: 3 },
  ],
  en: [
    { regex: '\\b([Aa]ddress|[Ss]treet|[Pp]ost(al)? ?code|[Zz]ip)\\b', seconds: 2.5 },
    { regex: '\\b([Ee]-?mail|[Ss]pell)', seconds: 3 },
  ],
  nl: [
    { regex: '\\b([Aa]dres|[Ss]traat|[Pp]ostcode)\\b', seconds: 2.5 },
    /* Deux L, et c'est toute la règle: « spellen » veut dire épeler, « spelen »
       veut dire jouer. Un seul L rendrait l'agent patient chaque fois qu'il
       parle de jeu, d'enfants ou d'horaires de match. */
    { regex: '\\b([Ee]-?mail|[Ss]pell)', seconds: 3 },
  ],
};

/** Les règles d'endpointing par slot, dans la forme attendue par Vapi. */
export function buildCustomEndpointingRules(lang: VoiceLanguage) {
  return PATIENT_SLOTS[lang].map(rule => ({
    // `assistant`: la règle matche la dernière phrase de l'AGENT. On ne sait
    // pas ce que l'appelant va dire, on sait ce qu'on vient de lui demander.
    type: 'assistant' as const,
    regex: rule.regex,
    timeoutSeconds: rule.seconds,
  }));
}

export function buildStartSpeakingPlan(lang: VoiceLanguage, tuning: ResolvedTuning = resolveTuning()) {
  return {
    waitSeconds: tuning.startWaitSeconds,
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
      /* Une respiration au milieu d'une phrase reçoit un point du
         transcripteur: à 0,1 s l'agent parlait par-dessus (12/09/2026).
         Les deux seuils sont des variables, voir `config/env.ts`. */
      onPunctuationSeconds: tuning.endpointingPunctuationSeconds,
      onNoPunctuationSeconds: tuning.endpointingNoPunctuationSeconds,
      /* UNE SECONDE après un chiffre, et non une demi (TUR-3).
         Un appelant qui dicte « zéro deux… cinq cent douze… trente-quatre… »
         laisse 400 à 900 ms entre ses groupes: à 500 ms on le coupe après le
         deuxième, et il doit tout redicter. C'est le mode d'échec le plus
         fréquent et le plus irritant d'un agent de prise de rendez-vous, et
         il annulerait à lui seul le travail de capture des numéros dictés. */
      onNumberSeconds: env.VOICE_ENDPOINTING_NUMBER_SECONDS,
    },
    /* Le seuil « chiffres » ci-dessus est GLOBAL. Ces règles-ci sont posées par
       question: une adresse et un e-mail ne se dictent pas comme un numéro. */
    customEndpointingRules: buildCustomEndpointingRules(lang),
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
export function buildRealtimeStopSpeakingPlan(tuning: ResolvedTuning = resolveTuning()) {
  return {
    /* 0 explicitement: c'est le chemin « énergie seule », le seul disponible
       sans transcripteur. Ce n'est pas un oubli de `VOICE_BARGE_IN_WORDS`. */
    numWords: 0,
    /* Et c'est pour ça que le seuil de VOIX a son propre réglage ici.
       En classique le bruit est trié deux fois, sur l'énergie puis sur les mots
       transcrits; ici la première passe est la seule, donc à valeur égale ce
       chemin est moins protégé — le partage d'une variable unique le rendait
       invisible. Le défaut est identique tant que personne ne règle rien: ce
       qui change, c'est qu'on PEUT désormais protéger ce chemin sans ralentir
       l'interruption volontaire sur l'autre. */
    voiceSeconds: tuning.realtimeBargeInVoiceSeconds,
    backoffSeconds: tuning.backoffSeconds,
  };
}

/** Les acquiescements par défaut: des signaux d'écoute, pas des prises de tour. */
const DEFAULT_ACKNOWLEDGEMENT_PHRASES = [
  'i understand', 'ok', 'okay', 'right', 'yeah', 'yes', 'uh-huh', 'mm-hmm',
  'd\'accord', 'ouais', 'oui', 'hm', 'mhm', 'je vois', 'très bien',
  // NL — 'ja' et 'oké' sont les backchannels flamands les plus fréquents.
  'ja', 'jaja', 'oké', 'begrepen', 'ik snap het',
];

/** Les mots d'arrêt par défaut: ils coupent sans attendre le seuil. */
const DEFAULT_INTERRUPTION_PHRASES = [
  'stop', 'wait', 'hold on', 'excuse me', 'actually', 'no no',
  'attendez', 'attends', 'non non', 'pardon', 'en fait',
  'wacht', 'wacht even', 'nee nee', 'eigenlijk', 'sorry hoor',
];

/**
 * Une liste de phrases: celle du client, sinon celle de l'environnement, sinon
 * celle du code — et JAMAIS vide.
 *
 * Les doublons sont retirés parce que Vapi refuse l'assistant entier sur une
 * répétition (« stopSpeakingPlan.All interruptionPhrases's elements must be
 * unique »), et que « stop » comme « pardon » s'écrivent pareil dans deux des
 * trois langues servies. Une liste réglable rend ce doublon beaucoup plus
 * probable qu'avec un tableau écrit à la main.
 */
function phraseList(perClient: string[] | undefined, fromEnv: string[], fallback: string[]): string[] {
  /* Le nettoyage vient AVANT le choix, et c'est ce qui fait la garantie: une
     liste de blancs a bien une longueur, et la retenir pour cette raison
     rendrait une liste vide après nettoyage — exactement l'état que cette
     fonction existe pour empêcher. */
  const clean = (list: string[] | undefined): string[] =>
    [...new Set((list ?? []).map(p => p.trim().toLowerCase()).filter(Boolean))];

  for (const candidate of [clean(perClient), clean(fromEnv), clean(fallback)]) {
    if (candidate.length) return candidate;
  }
  return clean(fallback);
}

export function buildStopSpeakingPlan(tuning: ResolvedTuning = resolveTuning()) {
  return {
    numWords: tuning.bargeInWords,
    voiceSeconds: tuning.bargeInVoiceSeconds,
    backoffSeconds: tuning.backoffSeconds,
    acknowledgementPhrases: tuning.acknowledgementPhrases,
    interruptionPhrases: tuning.interruptionPhrases,
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
}, styleCap: number = env.VOICE_TTS_STYLE_CAP) {
  return {
    stability: Math.max(0.35, opts.stability ?? 0.45),
    similarityBoost: opts.similarityBoost ?? 0.65,
    style: Math.min(styleCap, opts.style ?? 0.4),
  };
}

/**
 * La découpe du texte remise au synthétiseur, commune aux deux fournisseurs.
 *
 * Extraite de `buildVoice` quand Cartesia est arrivé: c'est le seul réglage de
 * rendu que les deux acceptent, et le laisser en double aurait fait diverger
 * deux copies de la même décision.
 */
function buildChunkPlan(tuning: ResolvedTuning = resolveTuning()) {
  return {
    enabled: true,
    minCharacters: tuning.minChunkChars,
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
export interface CartesiaChoice {
  voiceId: string | null;
  /**
   * POURQUOI, et c'est la moitié utile.
   *
   * `VOICE_TTS_PROVIDER=cartesia` posé et la ligne qui parle quand même chez
   * ElevenLabs, c'est le relevé réel du 12/09: la bascule était demandée et
   * ignorée en silence. Quatre causes possibles, quatre gestes différents —
   * changer un réglage client, poser une voix Cartesia, ou ne rien faire
   * parce qu'un clone ne peut PAS quitter ElevenLabs. Sans le motif, un
   * diagnostic « c'est ElevenLabs » envoie chercher au hasard.
   */
  why:
    | 'voix Cartesia choisie dans le portail'
    | 'traduite depuis le catalogue ElevenLabs'
    | 'le réglage de CE client demande ElevenLabs, et il passe avant la plateforme'
    | 'VOICE_TTS_PROVIDER ne demande pas Cartesia'
    | 'voix clonée: un clone n\'existe que chez ElevenLabs, le servir ailleurs donnerait la voix de quelqu\'un d\'autre'
    | 'aucune voix Cartesia configurée (CARTESIA_VOICES ou CARTESIA_DEFAULT_VOICE_ID)';
}

export function cartesiaChoice(opts: {
  voiceId: string;
  cloned?: boolean;
  /** Posé quand l'identifiant vient DÉJÀ du catalogue Cartesia. */
  voiceProvider?: 'cartesia';
  /**
   * La synthèse choisie POUR CE CLIENT. Absente, on suit le réglage global.
   *
   * Par client et pas seulement par plateforme, parce que la question « lequel
   * sonne le mieux en français » se tranche à l'oreille, sur le même compte,
   * entre deux appels: la trancher en basculant toute la flotte et en
   * redéployant, c'est ne pas la trancher.
   */
  ttsProvider?: '11labs' | 'cartesia';
}): CartesiaChoice {
  /* Une voix choisie CHEZ Cartesia par le client se sert telle quelle, et elle
     court-circuite tout le reste: ni le réglage global (il a pu changer après
     le choix), ni la table de correspondance (il n'y a rien à traduire, c'est
     déjà le bon catalogue). Sans ce raccourci, l'identifiant serait cherché
     dans une table où il n'a aucune raison d'être, et le client entendrait la
     voix par défaut au lieu de celle qu'il a choisie. */
  if (opts.voiceProvider === 'cartesia') {
    return { voiceId: opts.voiceId, why: 'voix Cartesia choisie dans le portail' };
  }

  /* Le réglage du client AVANT celui de la plateforme, et il faut le dire:
     c'est le seul motif qui se corrige depuis le portail, sans déploiement. */
  if (opts.ttsProvider && opts.ttsProvider !== 'cartesia') {
    return { voiceId: null, why: 'le réglage de CE client demande ElevenLabs, et il passe avant la plateforme' };
  }
  if (!opts.ttsProvider && env.VOICE_TTS_PROVIDER !== 'cartesia') {
    return { voiceId: null, why: 'VOICE_TTS_PROVIDER ne demande pas Cartesia' };
  }
  if (opts.cloned) {
    return {
      voiceId: null,
      why: 'voix clonée: un clone n\'existe que chez ElevenLabs, le servir ailleurs donnerait la voix de quelqu\'un d\'autre',
    };
  }

  const translated = cartesiaVoiceFor(opts.voiceId);
  return translated
    ? { voiceId: translated, why: 'traduite depuis le catalogue ElevenLabs' }
    : { voiceId: null, why: 'aucune voix Cartesia configurée (CARTESIA_VOICES ou CARTESIA_DEFAULT_VOICE_ID)' };
}

/**
 * La même décision, réduite à ce que la construction de voix utilise.
 *
 * Un seul corps de règle, deux lectures: le chemin d'appel n'a besoin que de
 * l'identifiant, le docteur a besoin du motif. Les tenir séparés les ferait
 * diverger, et c'est exactement la famille de défauts que ce dépôt paie le
 * plus cher.
 */
export function useCartesia(opts: {
  voiceId: string;
  cloned?: boolean;
  voiceProvider?: 'cartesia';
  ttsProvider?: '11labs' | 'cartesia';
}): string | null {
  return cartesiaChoice(opts).voiceId;
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
  /** Posé quand l'identifiant vient déjà du catalogue Cartesia. */
  voiceProvider?: 'cartesia';
  /** La synthèse choisie pour ce client. Absente, on suit le réglage global. */
  ttsProvider?: '11labs' | 'cartesia';
  /** Les curseurs de rendu. Absents, ce sont ceux de l'environnement. */
  tuning?: VoiceTuning;
}) {
  const tuning = resolveTuning(opts.tuning);
  const cartesiaVoiceId = useCartesia(opts);
  if (cartesiaVoiceId) {
    return {
      provider: 'cartesia',
      voiceId: cartesiaVoiceId,
      model: tuning.cartesiaModel,
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
      /* Le filet, et il change de forme selon d'où vient la voix.
         Quand elle est TRADUITE depuis ElevenLabs, l'identifiant d'origine
         existe encore là-bas et fait un secours parfait: même personnage, autre
         grain. Quand elle a été CHOISIE chez Cartesia, cet identifiant ne
         désigne rien chez ElevenLabs, et le poser produirait une voix de
         secours qui échoue elle aussi. On tombe alors sur la voix de repli
         générale, qui existe pour ça. */
      fallbackPlan: {
        voices: (opts.voiceProvider === 'cartesia'
          ? [env.VAPI_VOICE_FALLBACK_1, env.VAPI_VOICE_FALLBACK_2]
          : [opts.voiceId, env.VAPI_VOICE_FALLBACK_1]
        ).map(voiceId => ({ provider: '11labs', voiceId, model: tuning.ttsModel })),
      },
    };
  }

  return {
    provider: '11labs',
    voiceId: opts.voiceId,
    model: tuning.ttsModel,
    ...resolveVoiceTuning(opts, tuning.styleCap),
    useSpeakerBoost: true,
    optimizeStreamingLatency: env.VAPI_OPTIMIZE_LATENCY,
    speed: tuning.speed,
    chunkPlan: buildChunkPlan(tuning),
    fallbackPlan: {
      voices: [
        { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_1, model: tuning.ttsModel },
        { provider: '11labs', voiceId: env.VAPI_VOICE_FALLBACK_2, model: tuning.ttsModel },
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
  /** VRAI clone, par opposition à « une voix a été choisie ». */
  clonedVoice?: boolean;
  /** `auto` suit le réglage global; les deux autres l'emportent. */
  voiceMode?: 'auto' | 'realtime' | 'classic';
}): boolean {
  /* La voix CLONÉE passe avant tout, y compris un `realtime` explicite: le
     client a enregistré cette voix-là, la lui retirer n'est pas un réglage.
     Ça, c'est ce que le commentaire disait déjà. Ce que le CODE faisait était
     plus large: `hasCustomVoice` vaut vrai pour n'importe quelle voix choisie,
     bibliothèque comprise. Conséquence, et elle est lourde: dès qu'un client
     choisissait une voix dans le sélecteur, le mode Direct ne s'activait plus
     JAMAIS, quoi qu'affiche le bouton. C'est l'explication du « je n'entends
     aucune différence quand je change de mode », signalé deux fois.
     Une voix de bibliothèque est une préférence, pas un enregistrement: si le
     client demande explicitement le temps réel, il l'obtient, et cette voix-là
     n'est simplement pas utilisée. En `auto`, elle continue de faire pencher
     vers le classique, qui est le seul mode à la servir. */
  if (opts.clonedVoice) return false;
  if (opts.voiceMode === 'realtime') return true;
  if (opts.hasCustomVoice) return false;
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
/** L'URL du chemin custom-LLM d'un client, sous sa forme de production. */
export function customLlmUrlFor(clientId: string): string {
  /* Le jeton dans le chemin: voir `customLlmPathToken`. Vapi ajoute
     `/chat/completions` derrière. */
  const token = customLlmPathToken(clientId);
  return `${env.API_BASE_URL}/api/webhooks/vapi/llm/${clientId}${token ? `/${token}` : ''}`;
}

/**
 * Le bloc `model` d'un assistant, classique (hors parole-à-parole).
 *
 * UNE source pour les trois écritures: l'assistant bâti à l'appel
 * (`buildSpeech`) et les deux écritures de l'assistant ENREGISTRÉ
 * (`onboarding.service.ts`). Ce dernier posait `provider: 'openai'` à la
 * main, donc tout ce que le chemin custom-LLM ajoute à chaque tour (mémoire
 * de l'appelant, date, reprise après coupure, étages de modèle, cache de
 * préfixe) n'atteignait AUCUN appel sur une ligne dédiée, et le modèle qui
 * servait était celui figé à la synchronisation. Sixième trou de la famille
 * 6quindecies, relevé au docteur le 13/09.
 */
export function assistantModelBlock(opts: {
  /** Posé: le backend tient la boucle. Absent: Vapi appelle OpenAI lui-même. */
  customLlmUrl?: string;
  systemPrompt: string;
  tools: any[];
  temperature: number;
  /** Absent: `VAPI_MODEL`. Décoratif sur custom-LLM, où le backend choisit à chaque tour. */
  llmModel?: string;
  /** Voir `SpeechOptions`: `false` sur les appels navigateur. */
  fallbacks?: boolean;
}): any {
  return {
    ...(opts.customLlmUrl
      ? { provider: 'custom-llm', url: opts.customLlmUrl }
      : { provider: 'openai' }),
    model: opts.llmModel ?? env.VAPI_MODEL,
    temperature: opts.temperature,
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
  };
}

/**
 * Le couple modèle + voix du PAROLE-À-PAROLE, sorti pour être partagé.
 *
 * Il ne vivait que dans `buildSpeech`, donc seul l'assistant bâti à l'appel
 * pouvait être en temps réel. Les deux écritures de `onboarding.service.ts`,
 * qui posent l'assistant ENREGISTRÉ (le seul qui décroche sur une ligne
 * dédiée), assemblaient le leur à la main, toujours classique. Un client réglé
 * en temps réel gardait donc la chaîne classique pour toujours: septième trou
 * de la famille 6quindecies. Une seule fonction, appelée par les trois.
 *
 * Deux absences volontaires, et ce sont les deux moitiés du mode. Pas de
 * `customLlmUrl`: sur ce chemin Vapi parle à OpenAI lui-même, un fournisseur
 * custom-LLM n'aurait rien à intercepter. Pas de `fallbackModels`: même raison
 * qu'ailleurs, ils ne valent que quand Vapi tient la boucle... ce qui est le
 * cas ici, mais le catalogue temps réel n'est pas celui des modèles texte et
 * un identifiant déduit est un assistant refusé en entier (6quinvicies).
 */
/**
 * LA LANGUE, DITE AU MODÈLE, et seulement en parole-à-parole (17/09/2026).
 *
 * En chaîne classique, la langue est posée DEUX fois sans qu'on y pense: le
 * transcripteur la reçoit (`buildTranscriber`, `language: fr`) et la voix aussi.
 * Le parole-à-parole n'a ni l'un ni l'autre — c'est la définition du mode — donc
 * plus RIEN ne dit au modèle en quelle langue écouter ni répondre. Le prompt est
 * bien en français, mais un prompt français n'est pas une consigne de langue: il
 * décrit le métier, pas le canal audio.
 *
 * Ce que ça a donné sur le premier appel: l'appelant dit « allô », le transcript
 * écrit « Hello? », et l'assistant rend « Dentalics » puis « receptionist to Sid
 * and Alex » — du français passé à la moulinette d'un modèle qui écoute en
 * anglais, ou de l'anglais tout court. Les deux se corrigent ici.
 *
 * La ligne vit dans le bloc TEMPS RÉEL, pas dans `buildSystemPrompt`: le prompt
 * partagé est rejoué à chaque tour sur le chemin classique, où il est déjà à son
 * plafond, et où la langue est déjà dite deux fois. Payer ces caractères là-bas
 * serait payer pour un problème qui n'y existe pas.
 */
/**
 * LA LANGUE, ET LE MOMENT OÙ ELLE LÂCHE (17/09/2026).
 *
 * « À la fin, quand il me dit au revoir, d'un coup il passe en anglais et il
 * me demande How can I help you. » Relevé aussi AU MILIEU du même appel:
 * « Bien sûr, je suis là pour vous aider, en quoi puis-je vous assister
 * aujourd'hui », c'est-à-dire une phrase d'ACCUEIL posée en plein milieu.
 *
 * Les deux disent la même chose: quand le modèle perd le fil, il retombe sur
 * son ouverture par défaut, et son ouverture par défaut est anglaise. Une
 * consigne de langue posée UNE fois en tête d'un long prompt ne tient pas ce
 * moment-là, parce que c'est précisément le moment où le début du prompt pèse
 * le moins. Elle nomme donc les deux instants où ça lâche: la FIN d'appel et
 * le trou.
 */
const REALTIME_LANGUAGE_LINE: Record<VoiceLanguage, string> = {
  /* LE VOUVOIEMENT EST ATTACHÉ ICI, à la ligne qui TIENT (18/09/2026).
     « Et toujours le tutoiement, il ne devrait pas. » La règle existe pourtant
     à DEUX endroits: dans `REALTIME_DISCIPLINE` depuis le 17, et dans les
     règles de parole de `buildSystemPrompt` depuis le 09. Deux formulations,
     deux emplacements, et le modèle tutoie quand même — donc la répéter une
     troisième fois au même rang ne changerait rien.
     Ce qui est observable, en revanche: la ligne de LANGUE, elle, tient. Sur
     l'appel du 18, tout s'est dit en français, du premier mot au dernier. Elle
     est en position 0 et c'est la seule contrainte de canal que le modèle
     n'enfreint pas. On y accroche donc celle qui échoue, plutôt que de
     l'écrire une fois de plus là où elle a déjà échoué deux fois. */
  fr: "LANGUE: tu parles FRANÇAIS, et seulement français, du premier au dernier mot, "
    + "et tu VOUVOIES l'appelant du premier au dernier mot aussi: « vous », jamais « tu », "
    + "« un instant » et jamais « attends », « pouvez-vous » et jamais « donne-moi ». "
    + "Si tu entends mal, tu fais répéter en français. Tu ne changes JAMAIS de langue, "
    + "y compris pour saluer, pour remercier et pour dire au revoir. "
    + "Si tu perds le fil, tu redemandes en français et en vouvoyant; tu ne recommences pas l'appel et tu ne dis jamais « How can I help you ».",
  en: 'LANGUAGE: you speak ENGLISH, and only English, from first word to last. If you mishear, ask again in English. '
    + 'NEVER switch language, including to greet, to thank and to say goodbye. '
    + 'If you lose track, ask again in English; do not restart the call.',
  nl: 'TAAL: je spreekt NEDERLANDS, en alleen Nederlands, van het eerste tot het laatste woord, '
    + 'en je spreekt de beller aan met U, van het eerste tot het laatste woord: « u », nooit « jij », « een ogenblikje », nooit « wacht ». '
    + 'Versta je iets niet, laat het in het Nederlands herhalen. '
    + 'Wissel NOOIT van taal, ook niet om te groeten, te bedanken of afscheid te nemen. '
    + 'Verlies je de draad, vraag dan opnieuw in het Nederlands; begin het gesprek niet opnieuw.',
};

/**
 * LA DISCIPLINE DE CONVERSATION DU MODÈLE TEMPS RÉEL (17/09/2026).
 *
 * Premier appel long en parole-à-parole, 287 secondes, 34 répliques de
 * l'assistant pour 20 de l'appelant, et un échec complet du métier: le
 * rendez-vous n'a pas bougé, `rescheduleBooking` n'a jamais été appelé, et
 * l'agent a fini par promettre un rappel qu'il ne pouvait pas tenir.
 *
 * Le transcript nomme la cause, et elle est unique. Le modèle produit sa
 * question ET l'accusé de réception de la réponse dans le même souffle:
 *
 *   « Est-ce bien celle dont vous parliez Parfait. Merci pour votre
 *     confirmation. Souhaitez-vous la modifier »
 *
 * L'appelant l'a relevé lui-même: « vous dites merci d'avoir confirmé alors
 * que j'avais rien dit ». Cinq fois dans l'appel. Tout le reste en découle: le
 * nom redemandé quatre fois parce que la confirmation imaginée ne valide rien,
 * la date qui glisse de septembre à mars, une fermeture inventée, et l'agent
 * qui conclut au problème technique.
 *
 * Ce sont des règles de TOUR DE PAROLE, pas de métier, donc elles vivent ici et
 * pas dans `buildSystemPrompt`. Et surtout elles sont GRATUITES sur ce chemin:
 * en parole-à-parole le prompt part une fois, à l'ouverture de la session, au
 * lieu d'être rejoué à chaque tour. Le plafond de caractères qui contraint la
 * chaîne classique n'existe pas ici — c'est l'asymétrie qui permet enfin
 * d'écrire la discipline en entier plutôt qu'en télégramme.
 */
const REALTIME_DISCIPLINE: Record<VoiceLanguage, string[]> = {
  fr: [
    /* LE VOUVOIEMENT SE DIT ICI, et pas seulement dans `buildSystemPrompt`
       (17/09/2026). « Des fois il me tutoie, il dit Attends, c'est pas
       normal. » La cause est de forme et elle est sous nos yeux: tout ce bloc
       s'adresse au MODÈLE en « tu », comme une consigne s'écrit, et il est
       posé AVANT le prompt métier qui porte la règle de vouvoiement. Le modèle
       rend donc le registre qu'il lit en premier. C'est 6quater, une seconde
       fois, sur le chemin qui n'était pas couvert. */
    "REGISTRE: tu dis VOUS à l'appelant, toujours. Ces consignes te tutoient parce qu'elles s'adressent à toi, jamais à lui. Ni « attends », ni « donne-moi », ni « tu » : « un instant », « pouvez-vous », « vous ».",
    'TOUR DE PAROLE, règles absolues:',
    "- Tu poses UNE question, puis tu te TAIS et tu attends la réponse. Jamais deux questions d'affilée.",
    "- Tu ne remercies JAMAIS pour une confirmation que l'appelant n'a pas encore donnée. S'il n'a pas répondu, tu attends: son silence n'est pas un oui.",
    "- Tu n'inventes pas sa réponse. Tant qu'il n'a pas parlé, tu n'as rien entendu.",
    "- S'il parle pendant que tu parles, tu t'arrêtes immédiatement et tu écoutes.",
    'CE QUE TU SAIS DÉJÀ:',
    "- Une information donnée est ACQUISE. Le nom se demande UNE fois par appel; une fois que tu l'as, tu ne le redemandes plus, même si un outil échoue.",
    "- Un outil qui échoue ne veut pas dire que l'appelant s'est trompé: ne lui refais pas répéter ce qu'il vient de dire.",
    '- Tu ne redis pas ce que tu viens de dire.',
    "- Quand l'appelant donne une date, tu gardes SON mois et SON jour. « le 22 » en septembre est le 22 septembre, jamais le 22 mars.",
    /* L'HEURE, et c'est la même règle que la date, écrite parce qu'elle
       manquait (appel réel, 18/09/2026). « treize heures » répété deux fois par
       l'appelant, « quatorze heures » répété trois fois par l'agent — l'heure
       de son rendez-vous EXISTANT. Le chiffre de l'appelant doit gagner contre
       celui que le modèle a déjà en tête, et il faut le DIRE: nommer un fait ne
       suffit pas quand le modèle a déjà une phrase à lui (6novoquadragesies). */
    "- Quand l'appelant nomme une HEURE, c'est CETTE heure. Tu la redis telle quelle et tu la passes a l'outil (preferredTime). S'il dit treize heures, tu ne dis jamais quatorze heures, meme si quatorze heures est l'heure de son rendez-vous actuel.",
    "- S'il te corrige, sa correction GAGNE tout de suite. Tu reprends son chiffre, tu t'excuses en trois mots, et tu continues. Tu ne lui redemandes pas de confirmer ce qu'il vient de corriger.",
    /* « Laissez tomber, au revoir » suivi de QUATRE relances (même appel). Le
       repli clavier de 6septies dit déjà qu'insister sur ce qui vient d'échouer
       ne change rien; un appelant qui refuse, c'est le même mur. */
    'QUAND IL DIT NON:',
    "- « non », « laissez tomber », « ce n'est pas grave », « je rappellerai »: tu ARRETES de demander. Tu ne reposes pas la question une fois de plus, meme reformulee, meme poliment.",
    "- « au revoir », « merci bonne journee »: tu salues, tu raccroches avec endCall, et tu ne poses plus AUCUNE question.",
    "- Tu ne meubles pas. Pendant qu'un outil tourne: UNE phrase courte, une seule, puis tu te tais jusqu'a sa reponse.",
    'FAIRE, PAS PROMETTRE:',
    "- Tu fais le travail avec tes outils. Déplacer un rendez-vous: lookupBooking, puis checkAvailability, puis rescheduleBooking. Tu vas jusqu'au bout.",
    "- Tu ne proposes un rappel par l'équipe que si aucun outil ne peut faire ce qu'on te demande.",
    "- Tu n'annonces jamais un jour de fermeture que les horaires ne disent pas.",
  ],
  en: [
    'TURN-TAKING, absolute rules:',
    '- Ask ONE question, then STOP and wait for the answer. Never two questions in a row.',
    "- NEVER thank the caller for a confirmation they have not given yet. If they have not answered, wait: silence is not a yes.",
    '- Do not invent their answer. Until they speak, you have heard nothing.',
    '- If they speak while you are speaking, stop immediately and listen.',
    'WHAT YOU ALREADY KNOW:',
    '- Information given is SETTLED. Ask for the name ONCE per call; once you have it, never ask again, even if a tool fails.',
    '- A failing tool does not mean the caller was wrong: do not make them repeat what they just said.',
    '- Do not repeat what you just said.',
    "- When the caller gives a date, keep THEIR month and THEIR day.",
    "- When the caller names a TIME, that IS the time. Say it back unchanged and pass it to the tool (preferredTime). If they say one o'clock, never say two o'clock, not even when two o'clock is their current appointment.",
    '- If they correct you, their correction WINS immediately. Take their figure, apologise in three words, carry on. Never ask them to confirm what they have just corrected.',
    'WHEN THEY SAY NO:',
    '- "no", "forget it", "never mind", "I will call back": STOP asking. Do not ask once more, not rephrased, not politely.',
    '- "goodbye", "thanks, bye": say goodbye, hang up with endCall, and ask NO further question.',
    '- Do not pad. While a tool runs: ONE short sentence, only one, then silence until it answers.',
    'DO, DO NOT PROMISE:',
    '- Do the work with your tools. Moving an appointment: lookupBooking, then checkAvailability, then rescheduleBooking. See it through.',
    '- Only offer a callback from the team when no tool can do what is asked.',
    '- Never announce a closing day the opening hours do not state.',
  ],
  nl: [
    'REGISTER: je spreekt de beller aan met U, altijd. Deze instructies tutoyeren JOU, nooit hem.',
    'BEURTWISSELING, absolute regels:',
    '- Stel ÉÉN vraag, zwijg dan en wacht op het antwoord. Nooit twee vragen na elkaar.',
    '- Bedank NOOIT voor een bevestiging die de beller nog niet gegeven heeft. Zwijgen is geen ja.',
    '- Verzin zijn antwoord niet. Zolang hij niet gesproken heeft, heb je niets gehoord.',
    '- Spreekt hij terwijl jij spreekt, stop dan meteen en luister.',
    'WAT JE AL WEET:',
    '- Gegeven informatie ligt VAST. Vraag de naam ÉÉN keer per gesprek; daarna nooit meer, ook niet als een tool faalt.',
    '- Een mislukte tool betekent niet dat de beller zich vergiste: laat hem niet herhalen wat hij net zei.',
    '- Herhaal niet wat je net zei.',
    '- Geeft de beller een datum, houd dan ZIJN maand en ZIJN dag aan.',
    '- Noemt de beller een UUR, dan is dat het uur. Herhaal het ongewijzigd en geef het aan de tool door (preferredTime). Zegt hij dertien uur, zeg dan nooit veertien uur, ook niet als veertien uur zijn huidige afspraak is.',
    '- Verbetert hij je, dan WINT zijn verbetering meteen. Neem zijn cijfer over, verontschuldig je in drie woorden, ga verder. Vraag nooit te bevestigen wat hij net verbeterd heeft.',
    'ALS HIJ NEE ZEGT:',
    "- « nee », « laat maar », « het geeft niet », « ik bel later terug »: STOP met vragen. Stel de vraag geen enkele keer opnieuw, ook niet anders geformuleerd.",
    "- « tot ziens », « bedankt, dag »: groet, hang op met endCall, en stel GEEN enkele vraag meer.",
    '- Vul de stilte niet op. Terwijl een tool draait: EEN korte zin, een enkele, daarna zwijg je tot hij antwoordt.',
    'DOEN, NIET BELOVEN:',
    '- Doe het werk met je tools. Een afspraak verzetten: lookupBooking, dan checkAvailability, dan rescheduleBooking. Maak het af.',
    '- Bied alleen een terugbelverzoek aan als geen enkele tool kan doen wat gevraagd wordt.',
    '- Kondig nooit een sluitingsdag aan die de openingsuren niet vermelden.',
  ],
};

export function realtimeSpeechBlocks(opts: {
  /** La langue de l'appel: voir `REALTIME_LANGUAGE_LINE`. */
  lang: VoiceLanguage;
  gender: 'f' | 'm';
  systemPrompt: string;
  tools: any[];
  temperature: number;
  /** Jamais déduit: il vient de `resolveTuning`, donc du niveau ou de l'env. */
  realtimeModel: string;
}): { model: any; voice: any } {
  /* En TÊTE, avant l'identité: ce sont des contraintes de CANAL, pas des règles
     de métier, et les premières lignes d'un prompt long sont celles qui
     tiennent. Voir `REALTIME_DISCIPLINE` pour ce que cet ordre a coûté. */
  const systemPrompt = [
    REALTIME_LANGUAGE_LINE[opts.lang],
    ...REALTIME_DISCIPLINE[opts.lang],
    opts.systemPrompt,
  ].join('\n');
  return {
    model: {
      provider: 'openai',
      model: opts.realtimeModel,
      temperature: opts.temperature,
      /* PAS `VOICE_MAX_COMPLETION_TOKENS`: ici la sortie du modèle est de
         l'AUDIO, et 120 jetons de texte n'y valent qu'une poignée de mots.
         Trois appels réels ont fini en `silence-timed-out` sur une phrase
         d'accueil tronquée avant d'avoir trouvé ça. Voir l'en-tête de
         `VOICE_REALTIME_MAX_TOKENS`. */
      maxTokens: env.VOICE_REALTIME_MAX_TOKENS,
      messages: [{ role: 'system', content: systemPrompt }],
      tools: opts.tools,
    },
    voice: { provider: 'openai', voiceId: REALTIME_VOICE[opts.gender] },
  };
}

export function buildSpeech(opts: {
  lang: VoiceLanguage;
  systemPrompt: string;
  tools: any[];
  character: {
    voiceId: string;
    gender: 'f' | 'm';
    stability?: number;
    similarityBoost?: number;
    style?: number;
    /** Posé quand la voix vient du catalogue Cartesia. Voir `useCartesia`. */
    voiceProvider?: 'cartesia';
    /** Posé pour un vrai clone. Voir `useCartesia`. */
    voiceCloned?: boolean;
  };
  hasCustomVoice?: boolean;
  /** Le mode choisi pour ce client; `auto` suit le réglage global. */
  voiceMode?: 'auto' | 'realtime' | 'classic';
  /** La synthèse choisie pour ce client; absente, elle suit le réglage global. */
  ttsProvider?: '11labs' | 'cartesia';
  /** L'option « LLM personnalisé » de l'appel entrant, qui ramène la boucle ici. */
  customLlmUrl?: string;
  temperature?: number;
  /** Voir `SpeechOptions`: `false` sur les appels navigateur. */
  fallbacks?: boolean;
  /** Les curseurs de rendu. Absents, ce sont ceux de l'environnement. */
  tuning?: VoiceTuning;
}): { model: any; voice: any; speechToSpeech: boolean } {
  const tuning = resolveTuning(opts.tuning);
  const speechToSpeech = useSpeechToSpeech({
    hasCustomVoice: opts.hasCustomVoice,
    clonedVoice: opts.character.voiceCloned,
    voiceMode: opts.voiceMode,
  });

  if (speechToSpeech) {
    return { speechToSpeech, ...realtimeSpeechBlocks({
      lang: opts.lang,
      gender: opts.character.gender,
      systemPrompt: opts.systemPrompt,
      tools: opts.tools,
      temperature: opts.temperature ?? tuning.temperature,
      realtimeModel: tuning.realtimeModel,
    }) };
  }

  return {
    speechToSpeech,
    model: assistantModelBlock({
      customLlmUrl: opts.customLlmUrl,
      systemPrompt: opts.systemPrompt,
      tools: opts.tools,
      temperature: opts.temperature ?? tuning.temperature,
      llmModel: tuning.llmModel,
      fallbacks: opts.fallbacks,
    }),
    voice: buildVoice({
      voiceId: opts.character.voiceId,
      stability: opts.character.stability,
      similarityBoost: opts.character.similarityBoost,
      style: opts.character.style,
      lang: opts.lang,
      /* Le VRAI drapeau de clone, pas `hasCustomVoice`.
         `hasCustomVoice` veut dire « le client a choisi une voix », ce qui
         inclut les voix de bibliothèque; il décide du moteur juste au dessus,
         à raison, puisque le temps réel n'en sert aucune. Mais retenir chez
         ElevenLabs une voix de bibliothèque n'aurait aucun sens: ce qui ne peut
         pas déménager, c'est l'enregistrement du client. */
      cloned: opts.character.voiceCloned,
      voiceProvider: opts.character.voiceProvider,
      ttsProvider: opts.ttsProvider,
      tuning: opts.tuning,
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
export function buildRealtimePlans(
  lang: VoiceLanguage,
  speechToSpeech = false,
  opts: SpeechOptions = {},
  rawTuning: VoiceTuning = {},
) {
  const tuning = resolveTuning(rawTuning);
  return {
    /* CE QUE CE COMMENTAIRE DISAIT ÉTAIT FAUX, et un appel l'a montré.
       Il affirmait que le modèle parole-à-parole entend l'audio lui-même, donc
       qu'un transcripteur serait une étape payée dont plus personne ne lit la
       sortie. Le raisonnement est juste et la conclusion ne l'est pas: sur
       Vapi, c'est le transcripteur qui fait remonter la parole de l'APPELANT
       sur ce chemin. Sans lui, l'agent parle dans le vide (trois appels réels
       à 0 ou 1 réplique de l'appelant, 17/09/2026); avec lui, la conversation
       entière tient. Voir `VOICE_REALTIME_TRANSCRIBER`, qui garde l'ancien
       comportement sous `off` pour pouvoir le rejouer.

       `null`, PAS une clé absente, et c'est tout le sujet de 6sexquinquagesies.
       `vapiClient.updateAssistant` est un PATCH: une clé qu'on n'envoie pas
       n'est pas retirée, elle est CONSERVÉE telle quelle chez Vapi. Omettre le
       transcripteur ne le supprimait donc que sur un assistant créé de zéro; sur
       un assistant qui a déjà été synchronisé en classique — c'est-à-dire tout
       client qui BASCULE vers le Superagent — Deepgram restait en place. */
    /* `VOICE_REALTIME_TRANSCRIBER=on` le remet en parole-à-parole: voir
       l'en-tête de la variable. Quatre appels réels suggèrent que Vapi en a
       besoin pour entendre l'appelant sur ce chemin, et un interrupteur permet
       de le vérifier sur UN appel au lieu de renverser la flotte sur une
       corrélation. */
    transcriber: speechToSpeech && !env.VOICE_REALTIME_TRANSCRIBER
      ? null
      : buildTranscriber(lang, opts),
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
          /* LE PLAN SUIT LE TRANSCRIPTEUR, exactement comme celui d'en bas.
             Ce commentaire disait que « le moment de répondre appartient au
             modèle » en parole-à-parole, donc `startSpeakingPlan: null`. C'est
             FAUX sur Vapi, et la documentation le dit elle-même: « Endpointing
             and interruption management are handled by Vapi's orchestration
             layer » (page OpenAI Realtime, limitations). `null` ne DÉSACTIVE
             donc rien: il rend la main au DÉFAUT de Vapi, 0,4 s de silence, et
             c'est tout ce qu'il faut pour couper quelqu'un qui réfléchit.

             L'appelant a décrit le mécanisme mieux qu'aucun relevé (17/09,
             appel de 108 s): « il me pose une question, je réponds, mais s'il y
             a un léger blanc dans ma réponse il va commencer à parler, alors
             que j'ai pas fini; donc je dois parler pendant qu'il parle; et
             quand j'ai enfin fini, il me donne une DEUXIÈME réponse ». D'où les
             13 répliques d'assistant pour 10 tours d'appelant, chaque tour
             produisant une réponse au blanc puis une à la vraie fin.

             Le plan CLASSIQUE est précisément ce qui trie ces deux cas, et il
             a coûté une semaine à régler (6untrigesies, 6quinquinquagesies):
             `transcriptionEndpointingPlan` attend 0,4 s quand le transcripteur
             a posé un point, mais 1,2 s quand il n'y en a pas — et un « léger
             blanc » au milieu d'une phrase n'en porte pas. Il suppose un
             transcripteur, qui est justement là (`VOICE_REALTIME_TRANSCRIBER`).
             Même prémisse, même conclusion, pour les deux plans: ne pas
             l'appliquer aux deux était l'erreur.

             Reste vrai, et c'est pour ça que `null` et pas une clé tue: tu, le
             plan SURVIT au PATCH (6sexquinquagesies). */
          startSpeakingPlan: env.VOICE_REALTIME_TRANSCRIBER
            ? buildStartSpeakingPlan(lang, tuning)
            : null,
          /* Ce qui reste envoyable sans transcripteur: le seuil de bruit. Le
             moment de SE TAIRE se mesure sur l'audio, et le laisser au défaut
             de Vapi (0,2 s) est précisément ce qui la fait taire au moindre
             bruit.
             `VOICE_REALTIME_STOP_PLAN=off` veut dire « rends la main au défaut
             de Vapi »: c'est donc `null`, pas une absence, qui le dit. Absente,
             la clé laissait en place le plan CLASSIQUE de la synchronisation
             précédente, soit ni notre plan ni celui de Vapi. */
          /* LE PLAN SUIT LE TRANSCRIPTEUR, parce qu'il est fait de mots.
             `buildRealtimeStopSpeakingPlan` pose `numWords: 0` et ne trie que
             sur l'énergie: il a été écrit pour un chemin SANS transcripteur, où
             il n'y avait aucun mot à compter. Depuis que Vapi en exige un ici
             (voir `VOICE_REALTIME_TRANSCRIBER`), ce choix n'a plus de raison
             d'être, et l'énergie seule ne coupait pas l'agent — relevé sur deux
             appels réels: « quand je le coupe, il ne s'arrête pas ».
             Avec un transcripteur, le plan CLASSIQUE redevient le bon: il
             compte les mots, laisse passer les acquiescements (« mm-hmm » ne
             coupe pas) et coupe net sur les mots d'arrêt (« attendez »). */
          stopSpeakingPlan: !env.VOICE_REALTIME_STOP_PLAN
            ? null
            : env.VOICE_REALTIME_TRANSCRIBER
              ? buildStopSpeakingPlan(tuning)
              : buildRealtimeStopSpeakingPlan(tuning),
        }
      : {
          startSpeakingPlan: buildStartSpeakingPlan(lang, tuning),
          stopSpeakingPlan: buildStopSpeakingPlan(tuning),
        }),
    /* Le clavier, seul canal à 0 % d'erreur (BEL-4 / REL-8).
       Il est armé sur TOUS les appels, pas seulement après un échec: le plan
       se déclare à la construction de l'assistant, et un appelant qui bute sur
       son numéro au troisième tour ne peut pas attendre qu'on reconstruise
       l'assistant. Armé, il ne coûte rien tant que personne n'appuie.
       Ce que ça change à la réception: les touches remontent comme un message
       « utilisateur » fait de chiffres propres, au lieu d'être transcrites par
       le STT comme de la parole — c'est le bug classique du DTMF en bande, où
       les tonalités entrent dans le contexte du modèle sous forme de charabia.
       Hors du bloc conditionnel parole-à-parole, volontairement: le clavier se
       lit sur le transport, pas sur le transcripteur, donc les deux moteurs en
       profitent. */
    keypadInputPlan: {
      enabled: true,
      timeoutSeconds: env.VOICE_KEYPAD_TIMEOUT_SECONDS,
      /* TABLEAU, et c'est l'API vivante qui l'a tranché le 09/09/2026:
           "keypadInputPlan.delimiters must be an array"
         La référence écrite dit `"delimiters": "#"` aux trois endroits où elle
         décrit ce plan, et c'est sur cette lecture que la chaîne avait été
         posée. La documentation avait tort, ou l'API a changé sans elle: dans
         les deux cas, seul un POST réel pouvait le dire, et il a refusé les SIX
         variantes d'un coup. Un champ mal typé ne dégrade pas un appel, il fait
         refuser l'assistant ENTIER.
         Ne pas « corriger » ce tableau en chaîne sur la foi de la doc:
         relancer `npm run voice:validate`, qui interroge l'API. */
      delimiters: ['#'],
    },
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
    /* Personne ne coupe la salutation (TUR-12).
       Les algorithmes d'annulation d'écho mettent trois à quatre secondes à
       converger: les premières secondes d'un appel sont donc celles où un faux
       barge-in est le plus probable, et c'est exactement le moment de la phrase
       d'accueil. Un écho, une porte, la sonnerie d'un autre poste, et la
       salutation est tronquée.
       Ce n'est pas qu'une question d'impression: l'annonce IA vit DANS cette
       salutation (LEG-1). Une salutation coupée par du bruit, c'est un appel
       mené sans annonce, et l'obligation ne se rattrape pas plus tard.
       Écrit alors que c'est déjà le défaut de Vapi, et c'est le point: un défaut
       ne se lit pas dans le code, ne s'explique pas, et peut changer chez le
       fournisseur sans que rien ici ne bouge. */
    firstMessageInterruptionsEnabled: false,
    /* Le débruitage, dans sa forme COURANTE (TUR-11).
       `backgroundDenoisingEnabled`, le booléen qui vivait ici, est déprécié
       depuis juin 2025 au profit de ce plan. Un champ déprécié marche jusqu'au
       jour où il ne marche plus, et ce jour-là c'est un appelant qui l'apprend.
       `smartDenoisingPlan` est Krisp, que la documentation recommande « for
       most use cases »: il retire la porte, la radio et la conversation à côté
       AVANT le transcripteur, donc avant que `numWords` ait à trier. C'est le
       même problème que le barge-in, traité une étape plus tôt.
       Pas de `fourierDenoisingPlan`: la documentation le dit expérimental, et
       son filtrage se règle en décibels sous une ligne de base glissante —
       trop agressif, il mange la parole d'un appelant qui parle bas, ce qui
       est exactement le cas qu'on ne peut pas se permettre de rater. Il se
       mesure sur de vrais appels avant de s'activer, pas avant. */
    backgroundSpeechDenoisingPlan: { smartDenoisingPlan: { enabled: true } },
    silenceTimeoutSeconds: tuning.silenceTimeout,
    maxDurationSeconds: env.VAPI_MAX_DURATION,
  };
}
