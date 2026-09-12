import { resolveCharacter } from '../../config/voice-characters';
import { buildVoice, cartesiaChoice } from './speech-plans';
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

  return {
    block,
    signature: {
      provider: block.provider === 'cartesia' ? 'cartesia' : '11labs',
      voiceId: block.voiceId,
      model: block.model,
      why: decision.why,
    },
  };
}
