import { describe, it, expect, vi } from 'vitest';

/**
 * La promesse du banc d'essai tient en une phrase: montrer ce qui SERAIT arrivé
 * sans que ça arrive. Ces tests portent sur cette phrase, pas sur l'écran.
 *
 * Le risque n'est pas théorique: le banc emprunte le profil d'un VRAI client,
 * avec son agenda et ses coordonnées. Une frontière mal placée met un faux
 * rendez-vous devant un vrai client, ou un SMS d'essai sur son téléphone, et le
 * jour où ça arrive c'est la confiance dans l'outil qui tombe avec.
 */

vi.mock('../../../config/env', () => ({
  env: { API_BASE_URL: 'https://api.test' },
}));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const { voiceLabService, isWritingTool, describeEffect, simulatedResult, labToolMode } =
  await import('../voice-lab.service');

describe('la frontière entre lire et écrire', () => {
  it("ne laisse PAS s'exécuter ce qui écrit ou envoie", () => {
    /* La frontière n'est pas « dangereux ou non », elle est « laisse une trace
       chez quelqu'un d'autre ». Prendre un rendez-vous écrit en base, synchronise
       un agenda ET envoie un SMS: trois traces, dont deux chez l'appelant. */
    expect(isWritingTool('bookAppointment')).toBe(true);
    expect(isWritingTool('captureLead')).toBe(true);
  });

  it('laisse les LECTURES se faire pour de bon', () => {
    /* Entendre l'agent proposer les vrais créneaux du client est tout l'intérêt
       du banc: des créneaux inventés testeraient une conversation qui n'aura
       jamais lieu. Et une lecture ne coûte rien à personne. */
    expect(isWritingTool('checkAvailability')).toBe(false);
    expect(isWritingTool('lookupBooking')).toBe(false);
    expect(isWritingTool('lookupKnowledge')).toBe(false);
    expect(labToolMode('checkAvailability')).toBe('real');
    expect(labToolMode('bookAppointment')).toBe('simulated');
  });

  it("nomme les effets INVISIBLES, ceux qu'on ne peut pas tester autrement", () => {
    /* C'est la demande d'origine: « ce que je ne peux pas tester, comme
       l'intégration SMS ». Un moniteur qui dirait seulement « rendez-vous créé »
       laisserait croire que rien d'autre ne se déclenche. */
    const effect = describeEffect('bookAppointment', { date: '2026-09-01', time: '14:00', name: 'Marie' });
    expect(effect).toMatch(/SMS/i);
    expect(effect).toMatch(/Agenda/i);
    expect(effect).toMatch(/Marie/);

    expect(describeEffect('captureLead', { name: 'Paul' })).toMatch(/CRM/i);
    // Une lecture doit dire qu'elle n'écrit rien: c'est ce qui rassure sur le
    // reste de la liste.
    expect(describeEffect('checkAvailability', {})).toMatch(/aucune écriture/i);
  });

  it("répond à l'agent comme un SUCCÈS, sinon on teste ses excuses", () => {
    /* Un outil simulé qui renverrait une erreur ferait partir la conversation
       sur un incident: on jugerait alors la façon dont l'agent gère une panne,
       pas sa façon de prendre un rendez-vous. */
    const said = simulatedResult('bookAppointment', { date: '2026-09-01', time: '14:00' });
    expect(said).not.toMatch(/error|sorry|cannot/i);
    expect(said).toMatch(/2026-09-01/);
  });
});

describe('la session', () => {
  it('vit en mémoire et ne touche aucune base', () => {
    // Aucun import de Prisma dans ce service: perdre la trace d'un essai coûte
    // de le refaire, jamais une donnée.
    const s = voiceLabService.open('client_1');
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(voiceLabService.get(s.id)?.clientId).toBe('client_1');
  });

  it('garde la FIN des évènements quand un essai déborde', () => {
    /* Un essai qui produit deux cents évènements est un essai qui boucle, et
       c'est la fin qui montre où ça a dérapé. */
    const s = voiceLabService.open('client_2');
    for (let i = 0; i < 260; i++) {
      voiceLabService.record(s.id, { kind: 'tool', name: `t${i}`, mode: 'real', wouldHave: '' });
    }
    const events = voiceLabService.get(s.id)!.events;
    expect(events.length).toBeLessThanOrEqual(200);
    expect(events[events.length - 1].name).toBe('t259');
  });

  it('adresse chaque session à SA propre route de rappel', () => {
    /* Deux essais ouverts en même temps ne doivent pas mélanger leurs
       moniteurs: c'est l'identifiant dans l'URL qui les sépare. */
    const a = voiceLabService.open('c');
    const b = voiceLabService.open('c');
    expect(voiceLabService.webhookUrl(a.id)).not.toBe(voiceLabService.webhookUrl(b.id));
    expect(voiceLabService.webhookUrl(a.id)).toContain('/api/webhooks/lab/');
  });

  it('ignore une session inconnue plutôt que de lever', () => {
    // Une session expirée pendant qu'un appel se termine ne doit pas faire
    // échouer le webhook: l'appel, lui, est encore en cours.
    expect(voiceLabService.get('inexistante')).toBeNull();
    expect(() => voiceLabService.record('inexistante', {
      kind: 'call', name: 'x', mode: 'real', wouldHave: '',
    })).not.toThrow();
  });
});
