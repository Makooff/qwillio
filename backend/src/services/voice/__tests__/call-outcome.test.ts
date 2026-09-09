import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { readEndedReason, transferFunnel } = await import('../call-outcome');

beforeEach(() => transferFunnel.reset());

/**
 * Le défaut réparé: `logTransfer` écrivait `failedReason: 'No answer'` en dur.
 * Occupé, refusé, numéro faux et boîte vocale produisaient donc tous la même
 * phrase, fausse trois fois sur quatre — alors que c'est cette distinction qui
 * décide de la suite.
 */
describe('lire un endedReason Vapi', () => {
  it('distingue occupé de sans réponse, ce que « No answer » confondait', () => {
    expect(readEndedReason('call.forwarding.operator-busy').cause).toBe('busy');
    expect(readEndedReason('call.forwarding.no-answer').cause).toBe('no_answer');
  });

  it('distingue un numéro faux d\'un poste qui ne répond pas', () => {
    // Le premier se corrige dans les réglages du client, le second se rappelle.
    expect(readEndedReason('twilio-reported-customer-misdialed').cause).toBe('misdialed');
    expect(readEndedReason('customer-did-not-answer').cause).toBe('no_answer');
  });

  it('ne compte pas comme un échec un appelant qui raccroche de lui-même', () => {
    // Rappeler quelqu'un qui vient de raccrocher est au mieux inutile.
    for (const r of [
      'customer-ended-call-before-warm-transfer',
      'customer-ended-call-after-warm-transfer-attempt',
      'customer-ended-call-during-transfer',
    ]) {
      expect(readEndedReason(r).cause).toBe('caller_hung_up');
      expect(readEndedReason(r).transferFailed).toBe(false);
    }
  });

  it('compte la boîte vocale comme un échec: l\'urgence y est morte', () => {
    expect(readEndedReason('voicemail').transferFailed).toBe(true);
  });

  it('rend un équivalent SIP lisible là où le libellé ne l\'est pas', () => {
    expect(readEndedReason('call.forwarding.operator-busy').sipEquivalent).toBe(486);
    expect(readEndedReason('call.in-progress.error-providerfault-outbound-sip-480-temporarily-unavailable').sipEquivalent).toBe(480);
  });

  it('n\'invente pas de code là où il n\'y en a pas', () => {
    // Un pont qui casse n'a pas de cause téléphonique: prétendre le contraire
    // ferait chercher un problème de ligne là où il n'y en a pas.
    expect(readEndedReason('call.in-progress.error-transfer-failed').sipEquivalent).toBeNull();
    expect(readEndedReason('twilio-failed-to-connect-call').sipEquivalent).toBeNull();
  });

  it('rend toujours une lecture, jamais null', () => {
    for (const r of ['', null, undefined, '   ']) {
      expect(readEndedReason(r as never).cause).toBe('other');
    }
  });

  it('range un libellé inconnu en « other » plutôt que de le deviner', () => {
    // Vapi ajoute des valeurs à cette énumération. Une heuristique sur le texte
    // rangerait un jour un succès parmi les échecs.
    const r = readEndedReason('libelle-que-vapi-ajoutera-en-2027');
    expect(r.cause).toBe('other');
    expect(r.transferFailed).toBe(false);
    // Le libellé brut est conservé: c'est tout ce qu'on sait de lui.
    expect(r.label).toBe('libelle-que-vapi-ajoutera-en-2027');
  });

  it('ne compte pas une fin d\'appel ordinaire comme un transfert raté', () => {
    expect(readEndedReason('customer-ended-call').transferFailed).toBe(false);
    expect(readEndedReason('assistant-ended-call').transferFailed).toBe(false);
  });
});

/**
 * L'entonnoir répond à une question et une seule: « le numéro marche mais
 * personne ne décroche » ou « le numéro est faux ».
 */
describe('l\'entonnoir des transferts', () => {
  it('compte un pont abouti à tous les étages', () => {
    transferFunnel.attempt();
    transferFunnel.settle(readEndedReason('assistant-forwarded-call'));
    expect(transferFunnel.summary()).toMatchObject({ attempted: 1, ringing: 1, answered: 1, completed: 1 });
  });

  it('un poste occupé a SONNÉ, il n\'a pas décroché', () => {
    transferFunnel.attempt();
    transferFunnel.settle(readEndedReason('call.forwarding.operator-busy'));
    expect(transferFunnel.summary()).toMatchObject({ attempted: 1, ringing: 1, answered: 0, completed: 0 });
  });

  it('un numéro faux n\'a jamais sonné', () => {
    transferFunnel.attempt();
    transferFunnel.settle(readEndedReason('twilio-reported-customer-misdialed'));
    expect(transferFunnel.summary()).toMatchObject({ attempted: 1, ringing: 0, answered: 0, completed: 0 });
  });

  it('une boîte vocale décroche mais n\'aboutit pas', () => {
    transferFunnel.attempt();
    transferFunnel.settle(readEndedReason('voicemail'));
    expect(transferFunnel.summary()).toMatchObject({ ringing: 1, answered: 1, completed: 0 });
  });

  it('ventile par cause, ce qui est la moitié utile du tableau', () => {
    transferFunnel.settle(readEndedReason('call.forwarding.operator-busy'));
    transferFunnel.settle(readEndedReason('call.forwarding.operator-busy'));
    transferFunnel.settle(readEndedReason('voicemail'));
    expect(transferFunnel.summary().byCause).toEqual({ busy: 2, voicemail: 1 });
  });

  it('rend une copie, pas son état interne', () => {
    transferFunnel.attempt();
    const snapshot = transferFunnel.summary();
    snapshot.attempted = 999;
    snapshot.byCause.busy = 999;
    expect(transferFunnel.summary().attempted).toBe(1);
    expect(transferFunnel.summary().byCause.busy).toBeUndefined();
  });
});
