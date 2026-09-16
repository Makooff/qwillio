/**
 * Les DEUX niveaux de réceptionniste, nommés et posés au même endroit.
 *
 * ## Ce que chacun est
 *
 * `base` est la chaîne d'aujourd'hui, à l'octet près: Deepgram transcrit,
 * le backend tient la boucle de tour (custom-LLM), Cartesia ou ElevenLabs
 * synthétise. Son `tuning` est VIDE, et c'est le point: un niveau qui
 * poserait ses propres curseurs ferait bouger la production le jour où on
 * nomme ce qui existe déjà. Nommer ne change rien, c'est la condition.
 *
 * `superagent` est le parole-à-parole: le modèle entend l'audio et répond en
 * audio, sans transcription ni synthèse intermédiaire. C'est un changement de
 * génération sur les deux choses qu'on cherche, la vitesse et le réalisme,
 * parce qu'il supprime deux étapes au lieu de les régler.
 *
 * ## Ce que `superagent` COÛTE, et qu'il faut dire avant de le vendre
 *
 * Sur ce chemin, Vapi appelle OpenAI directement: il n'y a pas de custom-LLM,
 * donc rien de ce que `llm-stream` ajoute à CHAQUE tour n'existe plus. En
 * clair, sur une ligne dédiée, l'agent perd la mémoire de l'appelant posée par
 * tour (`callerHistoryBlock`), la date posée par tour (`clockBlock`), la
 * reprise après coupure, les étages de modèle et le cache de préfixe. Le
 * PROMPT et les OUTILS, eux, voyagent: la discipline (nom épelé, « rien n'est
 * réservé », refus d'une date passée) tient, et l'agenda, le transfert et la
 * capture de lead marchent.
 *
 * Le prix aussi: le tableau de bord Vapi annonce 0,645 $ la minute pour
 * `gpt-realtime-2` contre 0,060 $ pour `gpt-realtime-mini-2025-12-15`, un
 * facteur dix, quand la recette par minute incluse va de 0,26 à 0,40 €.
 * `VOICE_REALTIME_MODEL` tranche, et il ne se DÉDUIT jamais (6quinvicies):
 * seuls les identifiants énumérés par l'API vivante existent.
 *
 * ## Ce que ce fichier ne fait PAS
 *
 * Il ne décide pas du moteur. `useSpeechToSpeech` reste seul à trancher, parce
 * qu'il porte la règle qui prime sur tout: une voix CLONÉE ramène au
 * classique, quel que soit le niveau demandé. Un client qui a enregistré sa
 * voix est venu chercher CETTE voix; la remplacer par celle d'OpenAI ne serait
 * pas une montée en gamme. Deux règles écrites à la main pour la même question
 * ont déjà divergé ici en moins d'un mois (6vicies): il n'y en a qu'une.
 *
 * Il ne pose pas non plus de curseur de latence au hasard. Les seuils
 * (`VOICE_REALTIME_BARGE_IN_VOICE_SECONDS`, `VOICE_START_WAIT_SECONDS`) se
 * touchent APRÈS un relevé de `voice:audit` sur un vrai appel, jamais avant:
 * c'est la leçon de 6duoquadragesies, et un réglage posé à l'aveugle dans une
 * table a l'air d'une décision.
 */
import { env } from '../../config/env';
import type { VoiceTuning } from './speech-plans';

export type VoiceTierId = 'base' | 'superagent';

export interface VoiceTier {
  id: VoiceTierId;
  /** Ce que le portail, les scripts et l'audit affichent. */
  label: string;
  /** Une phrase, la même partout. */
  summary: string;
  /** Le moteur DEMANDÉ, tel que `useSpeechToSpeech` le lit. */
  voiceMode: 'classic' | 'realtime';
  /** Les curseurs propres au niveau. Vide = ceux de l'environnement. */
  tuning: VoiceTuning;
}

export const VOICE_TIERS: Record<VoiceTierId, VoiceTier> = {
  base: {
    id: 'base',
    label: 'Standard',
    summary: 'Transcription, modèle texte, synthèse. La chaîne éprouvée, avec la mémoire de l\'appelant à chaque tour.',
    voiceMode: 'classic',
    /* VIDE, volontairement: voir l'en-tête. Nommer la chaîne existante ne doit
       pas la changer, sinon « base » n'est plus ce qui tourne aujourd'hui et
       la comparaison des deux niveaux ne mesure plus rien. */
    tuning: {},
  },
  superagent: {
    id: 'superagent',
    label: 'Superagent',
    summary: 'Parole-à-parole: le modèle entend et répond en audio, sans transcription ni synthèse. Plus rapide, plus naturel.',
    voiceMode: 'realtime',
    /* Le modèle est le SEUL curseur posé ici, et il est posé explicitement
       pour que l'audit puisse dire quel modèle ce niveau signifie. Sa valeur
       reste celle de l'environnement: la choisir ici en dur ferait d'un
       arbitrage de coût une constante de code. */
    get tuning(): VoiceTuning {
      return { realtimeModel: env.VOICE_REALTIME_MODEL };
    },
  },
};

/** Une valeur inconnue n'est pas un niveau: elle vaut « rien de choisi ». */
export function readTierId(value: unknown): VoiceTierId | null {
  return value === 'base' || value === 'superagent' ? value : null;
}

/** Ce que le profil porte, réduit à ce que la résolution lit. */
interface TierSource {
  voiceTier?: VoiceTierId | null;
  /** Le réglage HISTORIQUE, qui décidait du moteur avant que le niveau existe. */
  voiceMode?: 'auto' | 'realtime' | 'classic';
}

/**
 * Le niveau CHOISI pour ce client, ou `null` quand personne n'a choisi.
 *
 * L'ancien réglage devient un repli lu au MÊME endroit que le nouveau, jamais
 * une seconde règle lue ailleurs: c'est la leçon de 6duovicies, où deux
 * drapeaux décrivant la même chose (`disableRecordingNotice` et `recordCalls`)
 * ont fini par se contredire sur un sujet de conformité.
 */
export function requestedTier(profile: TierSource): VoiceTierId | null {
  const explicit = readTierId(profile.voiceTier);
  if (explicit) return explicit;
  if (profile.voiceMode === 'realtime') return 'superagent';
  if (profile.voiceMode === 'classic') return 'base';
  return null;
}

/**
 * Le mode à passer à `useSpeechToSpeech`. `auto` quand rien n'est choisi:
 * le réglage global décide alors, comme avant ce fichier.
 */
export function voiceModeFor(profile: TierSource): 'auto' | 'realtime' | 'classic' {
  const tier = requestedTier(profile);
  return tier ? VOICE_TIERS[tier].voiceMode : 'auto';
}

/** Les curseurs du niveau demandé. Rien de choisi: ceux de l'environnement. */
export function tuningFor(profile: TierSource): VoiceTuning {
  const tier = requestedTier(profile);
  return tier ? VOICE_TIERS[tier].tuning : {};
}

/**
 * Le niveau qui SERT, une fois le moteur tranché.
 *
 * Il peut différer du niveau demandé, et c'est voulu: une voix clonée ramène
 * au classique un client réglé en superagent. C'est cet écart-là qu'il faut
 * afficher et facturer, jamais le réglage (voir `setSpeechToSpeech`).
 */
export function servedTier(speechToSpeech: boolean): VoiceTier {
  return speechToSpeech ? VOICE_TIERS.superagent : VOICE_TIERS.base;
}
