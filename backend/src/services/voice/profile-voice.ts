import { resolveCharacter } from '../../config/voice-characters';
import {
  assistantModelBlock,
  buildVoice,
  cartesiaChoice,
  customLlmUrlFor,
  realtimeSpeechBlocks,
  resolveTuning,
  useSpeechToSpeech,
  type VoiceTuning,
} from './speech-plans';
import { servedTier, tuningFor, voiceModeFor, type VoiceTier } from './voice-tiers';
import type { ClientVoiceProfile } from './realtime-context.service';

/**
 * LA voix d'un client, résolue une seule fois, pour tous ceux qui l'envoient.
 *
 * ── Le trou que ceci bouche ────────────────────────────────────────────────
 *
 * Trois endroits construisaient la voix d'un client, et deux seulement lisaient
 * tout: l'appel entrant (`buildSpeech`) et l'accueil pré-enregistré
 * (`voiceSignatureFor`) passaient la voix choisie dans le portail, le clone, le
 * catalogue d'origine et la synthèse par client. La SYNCHRONISATION de
 * l'assistant enregistré — celui qui décroche sur une ligne dédiée — résolvait
 * le personnage SANS `customVoice` et appelait `buildVoice` sans `cloned`,
 * `voiceProvider` ni `ttsProvider`.
 *
 * Conséquence, relevée le 12/09/2026: un client choisit une voix Cartesia dans
 * le portail, l'écran dit enregistré, l'accueil pré-enregistré est bien dit par
 * cette voix, et l'assistant distant repart sur la voix ElevenLabs par défaut
 * du personnage à la sauvegarde suivante. Une voix qui accueille, une autre qui
 * répond: exactement 6bis, depuis l'autre côté. Un clone subissait le même
 * sort. « J'avais choisi des voix Cartesia et maintenant c'est ElevenLabs »:
 * le choix était enregistré, il n'atteignait pas l'assistant qui décroche.
 *
 * C'est la famille 6quindecies, et la règle qui en sort est celle de 6vicies:
 * tout ce qui décrit comment l'agent PARLE part par UNE fonction, et les
 * écritures la partagent. Deux résolutions écrites à la main divergent, et
 * elles ont divergé.
 */
export interface ProfileVoice {
  /** Le bloc `voice` tel que l'assistant l'envoie à Vapi. */
  block: ReturnType<typeof buildVoice>;
  /** La même voix, réduite à ce qui identifie un enregistrement d'accueil. */
  signature: {
    provider: '11labs' | 'cartesia';
    voiceId: string;
    model: string;
    /** Pourquoi ce fournisseur: voir `cartesiaChoice`. */
    why: string;
  };
  /**
   * Le moteur retenu pour ce profil, par la MÊME fonction que l'appel.
   *
   * Il vivait dans `buildSpeech`, donc seul l'assistant bâti à l'appel savait
   * répondre à la question. Les deux écritures de `onboarding.service.ts`
   * envoyaient un `false` écrit en dur, et l'assistant ENREGISTRÉ (le seul qui
   * décroche sur une ligne dédiée) restait classique quoi que le client ait
   * choisi. Il est résolu ici parce que c'est ici que le personnage est déjà
   * résolu: la voix CLONÉE prime sur le niveau, et c'est le même objet qui le
   * sait.
   */
  speechToSpeech: boolean;
  /** Le niveau qui SERT, une fois le clone pris en compte. */
  tier: VoiceTier;
  /** Le genre du personnage: la voix du temps réel s'y accroche. */
  gender: 'f' | 'm';
  /** Les curseurs du niveau DEMANDÉ, à passer aux plans. */
  tuning: VoiceTuning;
}

export function voiceForProfile(profile: ClientVoiceProfile): ProfileVoice {
  const character = resolveCharacter({
    characterId: profile.characterId,
    isFrench: profile.language === 'fr',
    country: profile.country,
    customVoice: profile.customVoice,
  });

  const inputs = {
    voiceId: character.voiceId,
    cloned: character.voiceCloned,
    voiceProvider: character.voiceProvider,
    ttsProvider: profile.ttsProvider,
  };

  const decision = cartesiaChoice(inputs);
  const block = buildVoice({
    ...inputs,
    stability: character.stability,
    similarityBoost: character.similarityBoost,
    style: character.style,
    lang: profile.language,
  });

  /* La règle du moteur n'est pas réécrite ici: `useSpeechToSpeech` reste seul
     à trancher, y compris la priorité de la voix clonée. Ce fichier ne fait
     que lui donner les mêmes entrées que l'appel entrant. */
  const speechToSpeech = useSpeechToSpeech({
    hasCustomVoice: !!profile.customVoice,
    clonedVoice: character.voiceCloned,
    voiceMode: voiceModeFor(profile),
  });

  return {
    block,
    speechToSpeech,
    gender: character.gender,
    tier: servedTier(speechToSpeech),
    tuning: tuningFor(profile),
    signature: {
      provider: block.provider === 'cartesia' ? 'cartesia' : '11labs',
      voiceId: block.voiceId,
      model: block.model,
      why: decision.why,
    },
  };
}

/**
 * Cet appel a-t-il besoin d'un BRIEF d'ouverture ?
 *
 * La question derrière: `llm-stream` tourne-t-il ? C'est lui qui repose à
 * chaque tour ce que le prompt FIGÉ de l'assistant enregistré ne peut pas
 * porter (la mémoire de l'appelant, la date, la reprise après coupure). Deux
 * chemins lui échappent, et pour la même raison de fond, Vapi appelant alors
 * OpenAI lui-même:
 *
 *  - le parole-à-parole, par construction (6quaterquadragesies);
 *  - un client dont `customLlm` est explicitement éteint.
 *
 * Écrite ICI parce que c'est le fichier qui tranche déjà le moteur, et qu'une
 * seconde règle posée près de l'appelant aurait divergé de celle-ci en moins
 * d'un mois (6vicies). Voir `call-brief.ts` pour ce que le brief contient.
 */
export function needsCallBrief(profile: ClientVoiceProfile): boolean {
  return voiceForProfile(profile).speechToSpeech || !profile.customLlm;
}

/**
 * Le couple modèle + voix de l'assistant ENREGISTRÉ, pour un profil donné.
 *
 * UNE fonction pour les DEUX écritures de `onboarding.service.ts`. Elles
 * assemblaient chacune la leur, et toutes les deux en classique: `false` écrit
 * en dur dans `buildRealtimePlans`, `assistantModelBlock` appelé directement.
 * Conséquence exacte, vérifiable sur n'importe quel compte: un client réglé en
 * parole-à-parole gardait la chaîne classique tant qu'il avait une ligne
 * DÉDIÉE, puisque c'est l'assistant enregistré qui décroche alors
 * (6quindecies / 6tervicies). Le mécanisme existait, le réglage s'enregistrait,
 * l'écran disait enregistré, et l'appelant entendait l'autre moteur.
 *
 * Sur une ligne PARTAGÉE (les essais), l'assistant est bâti à l'appel par
 * `buildSpeech`: c'est le seul chemin où le temps réel fonctionnait déjà.
 * Les deux chemins passent maintenant par la même décision.
 */
export function assistantSpeechForProfile(
  profile: ClientVoiceProfile,
  opts: { clientId: string; systemPrompt: string; tools: any[]; temperature: number },
): { model: any; voice: any; speechToSpeech: boolean; tier: VoiceTier } {
  const resolved = voiceForProfile(profile);

  if (resolved.speechToSpeech) {
    return {
      ...realtimeSpeechBlocks({
        /* La langue du PROFIL, la même source que l'appel (6vicies): une
           seconde règle écrite ici aurait divergé en moins d'un mois. */
        lang: profile.language,
        gender: resolved.gender,
        systemPrompt: opts.systemPrompt,
        tools: opts.tools,
        temperature: opts.temperature,
        realtimeModel: resolveTuning(resolved.tuning).realtimeModel,
      }),
      speechToSpeech: true,
      tier: resolved.tier,
    };
  }

  return {
    /* `profile.customLlm` porte déjà le défaut d'environnement: le relire ici
       ferait une seconde règle pour la même question. */
    model: assistantModelBlock({
      customLlmUrl: profile.customLlm ? customLlmUrlFor(opts.clientId) : undefined,
      systemPrompt: opts.systemPrompt,
      tools: opts.tools,
      temperature: opts.temperature,
    }),
    voice: resolved.block,
    speechToSpeech: false,
    tier: resolved.tier,
  };
}
