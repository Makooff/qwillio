import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyCartesiaVoices,
  applyAssignedVoices,
  getCartesiaVoices,
  getAssignedVoices,
  listCharacters,
} from '../voice-characters';

/**
 * ── CE QUE CES TESTS EMPÊCHENT DE REVENIR ───────────────────────────────────
 *
 * Les dix personnages du site parlaient tous avec le même timbre, et
 * l'étiquette de provenance manquait : un identifiant Cartesia était présenté
 * à une table de traduction ElevenLabs, qui n'y trouvait rien et servait la
 * voix par défaut — une seule, masculine, pour cinq femmes et cinq hommes.
 *
 * Le second piège est plus vicieux : `loadOrBootstrap` reversait TOUT ce que
 * la base contenait dans la table ElevenLabs. La panne revenait donc à chaque
 * redémarrage — ce qui explique qu'un redéploiement n'ait jamais rien changé,
 * et pourquoi « ça a été corrigé » ne se voyait pas.
 */

const CARTESIA = '7c58f4a4-a72c-42fa-a503-41b9408820f3'; // UUID nu
const ELEVEN = 'EL.antoni';

describe('voix — les deux fournisseurs sont séparés', () => {
  beforeEach(() => {
    applyAssignedVoices({});
    applyCartesiaVoices({});
  });

  it('range un identifiant Cartesia dans la table Cartesia', () => {
    applyCartesiaVoices({ marie: CARTESIA });
    expect(getCartesiaVoices().marie).toBe(CARTESIA);
  });

  it('ne range JAMAIS un Cartesia dans la table ElevenLabs', () => {
    /* Le cœur du défaut : un identifiant Cartesia dans la table ElevenLabs est
       un identifiant que `buildVoice` traduira comme de l'ElevenLabs, ne
       trouvera pas, et remplacera par la voix par défaut. */
    applyCartesiaVoices({ marie: CARTESIA });
    expect(getAssignedVoices()).toEqual({});
  });

  it('pose l’identifiant ET la provenance sur la fiche du personnage', () => {
    /* Les deux ensemble, jamais l'un sans l'autre : c'est leur séparation qui
       produisait un identifiant muet sur son origine. */
    applyCartesiaVoices({ marie: CARTESIA });

    const marie = listCharacters().find(c => c.id === 'marie');
    expect(marie?.voiceId).toBe(CARTESIA);
    expect(marie?.voiceProvider).toBe('cartesia');
  });

  it('laisse les autres personnages sans provenance Cartesia', () => {
    // Une assignation partielle ne doit pas étiqueter tout le catalogue.
    applyCartesiaVoices({ marie: CARTESIA });
    const lucas = listCharacters().find(c => c.id === 'lucas');
    expect(lucas?.voiceProvider).toBeUndefined();
  });

  it('ignore un identifiant qui ne correspond à aucun personnage', () => {
    // Pas de fiche fantôme dans le catalogue.
    applyCartesiaVoices({ personnage_inexistant: CARTESIA });
    expect(listCharacters().some(c => c.id === 'personnage_inexistant')).toBe(false);
  });

  it('une assignation ElevenLabs ne porte pas la provenance Cartesia', () => {
    // Symétrique du défaut : les deux tables ne doivent pas se contaminer.
    applyAssignedVoices({ marie: ELEVEN });
    expect(getAssignedVoices().marie).toBe(ELEVEN);
    expect(getCartesiaVoices()).toEqual({});
  });

  it('remplace une assignation précédente au lieu de la cumuler', () => {
    applyCartesiaVoices({ marie: CARTESIA });
    const autre = 'b56a7171-86f0-42b6-b3fa-a316794aa4e0';
    applyCartesiaVoices({ marie: autre });
    expect(getCartesiaVoices()).toEqual({ marie: autre });
  });

  it('rend les dix personnages, cinq femmes et cinq hommes', () => {
    // Le catalogue lui-même : s'il perd un genre, l'appariement ne peut plus
    // honorer la règle « jamais la voix de l'autre genre ».
    const personnages = listCharacters();
    expect(personnages).toHaveLength(10);
    expect(personnages.filter(c => c.gender === 'f')).toHaveLength(5);
    expect(personnages.filter(c => c.gender === 'm')).toHaveLength(5);
  });
});
