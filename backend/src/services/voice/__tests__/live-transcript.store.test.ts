import { describe, it, expect, beforeEach } from 'vitest';
import { liveTranscripts } from '../live-transcript.store';

/**
 * Ce que le gérant voit pendant que l'appel a lieu.
 *
 * La fiche « en cours » existe depuis le décroché ; ce store est ce qui la
 * remplit. Il vit en mémoire, et c'est la même décision que `call-session.store`
 * a prise pour les mêmes raisons : écrire en base une phrase qui sera réécrite
 * en entier trente secondes plus tard, c'est la payer deux fois.
 *
 * Deux choses comptent ici, et une seule est fonctionnelle : que les lignes
 * arrivent, et que PERSONNE ne lise l'appel d'un autre client.
 */
describe('liveTranscripts', () => {
  beforeEach(() => liveTranscripts.vider());

  it("garde les lignes d'un appel ouvert, dans l'ordre", () => {
    liveTranscripts.ouvrir('salle-1', 'client-A');
    liveTranscripts.ajouter('salle-1', 'assistant', 'Qwillio Resto, bonjour !');
    liveTranscripts.ajouter('salle-1', 'user', 'Je voudrais une table.');

    const lignes = liveTranscripts.lignes('salle-1', 'client-A');
    expect(lignes.map(l => l.text)).toEqual([
      'Qwillio Resto, bonjour !',
      'Je voudrais une table.',
    ]);
    expect(lignes[0].role).toBe('assistant');
  });

  it("ne rend RIEN à un autre client", () => {
    /* LA GARDE QUI COMPTE. La salle est un identifiant devinable — elle
       contient le numéro appelé — et cette route est servie par client. Sans
       ce cloisonnement, demander la bonne salle suffirait à écouter l'appel
       d'un concurrent. */
    liveTranscripts.ouvrir('salle-1', 'client-A');
    liveTranscripts.ajouter('salle-1', 'user', 'mon numéro de carte est…');
    expect(liveTranscripts.lignes('salle-1', 'client-B')).toEqual([]);
    expect(liveTranscripts.lignes('salle-1', '')).toEqual([]);
  });

  it("jette une ligne dont la salle n'a jamais été ouverte", () => {
    /* C'est le cas d'un redémarrage du processus pendant un appel : on n'a
       plus le client de cette salle, donc on ne peut plus décider qui a le
       droit de lire. On préfère perdre le direct que de l'attribuer au
       hasard. */
    expect(liveTranscripts.ajouter('inconnue', 'user', 'Bonjour')).toBe(false);
    expect(liveTranscripts.lignes('inconnue', 'client-A')).toEqual([]);
  });

  it('ignore le vide sans ouvrir de place', () => {
    liveTranscripts.ouvrir('salle-1', 'client-A');
    expect(liveTranscripts.ajouter('salle-1', 'user', '   ')).toBe(false);
    expect(liveTranscripts.ajouter('', 'user', 'Bonjour')).toBe(false);
    expect(liveTranscripts.lignes('salle-1', 'client-A')).toEqual([]);
  });

  it("un rejeu du décroché n'efface pas ce qui a été dit", () => {
    /* `voice-core` poste `calls/start` en tâche de fond et peut le rejouer.
       Un rejeu qui vide le transcript ferait disparaître la conversation de
       l'écran au milieu de l'appel. */
    liveTranscripts.ouvrir('salle-1', 'client-A');
    liveTranscripts.ajouter('salle-1', 'user', 'Bonjour');
    liveTranscripts.ouvrir('salle-1', 'client-A');
    expect(liveTranscripts.lignes('salle-1', 'client-A')).toHaveLength(1);
  });

  it('borne un appel qui ne finit pas, en gardant la fin', () => {
    /* Un appel de trente minutes à un tour toutes les cinq secondes en fait
       360. Au-delà, ce qui compte est ce qui est en train de se dire. */
    liveTranscripts.ouvrir('salle-1', 'client-A');
    for (let i = 0; i < 500; i++) liveTranscripts.ajouter('salle-1', 'user', `ligne ${i}`);
    const lignes = liveTranscripts.lignes('salle-1', 'client-A');
    expect(lignes.length).toBeLessThanOrEqual(400);
    expect(lignes[lignes.length - 1].text).toBe('ligne 499');
  });

  it("la fin d'appel referme le direct", () => {
    /* Sinon le tableau de bord afficherait « en cours » un appel raccroché,
       avec son transcript, à côté de la fiche terminée du même appel. */
    liveTranscripts.ouvrir('salle-1', 'client-A');
    liveTranscripts.ajouter('salle-1', 'user', 'Bonjour');
    liveTranscripts.terminer('salle-1');
    expect(liveTranscripts.lignes('salle-1', 'client-A')).toEqual([]);
  });

  it('tient deux appels en même temps sans les mélanger', () => {
    liveTranscripts.ouvrir('salle-1', 'client-A');
    liveTranscripts.ouvrir('salle-2', 'client-B');
    liveTranscripts.ajouter('salle-1', 'user', 'chez A');
    liveTranscripts.ajouter('salle-2', 'user', 'chez B');
    expect(liveTranscripts.lignes('salle-1', 'client-A').map(l => l.text)).toEqual(['chez A']);
    expect(liveTranscripts.lignes('salle-2', 'client-B').map(l => l.text)).toEqual(['chez B']);
  });
});
