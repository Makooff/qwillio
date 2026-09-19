import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LA LIGNE ÉTAIT MORTE ET PERSONNE NE LE SAVAIT (19/09/2026).
 *
 * Le solde Vapi est tombé à -0,06 en production. Vapi décrochait, annonçait à
 * l'appelant que la balance était vide, et raccrochait. Deux clients avec un
 * renvoi actif, donc des commerces injoignables, et aucun voyant nulle part.
 *
 * Le propriétaire l'a découvert en appelant son propre numéro, par hasard, en
 * voulant tester autre chose. Tous les appels entrants entre la panne et cette
 * découverte sont perdus, sans trace.
 *
 * `fallback-watch` existait pour le cas voisin (crédit OpenAI épuisé, tous les
 * tours en repli) et ne pouvait PAS voir celui-ci: il compte les tours que
 * notre backend a servis, et ici notre backend n'est jamais appelé. Un canari
 * qui se nourrit du trafic ne signale pas l'absence de trafic.
 */

const { notifyAlerts } = vi.hoisted(() => ({ notifyAlerts: vi.fn() }));

vi.mock('../../discord.service', () => ({ discordService: { notifyAlerts } }));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { deadCallWatchService, isSilentCall, DeadCallWatchService } = await import('../dead-call-watch.service');

const silent = (reason = 'assistant-ended-call') => ({ silent: true, reason, clientLabel: 'c1' });
const spoke = () => ({ silent: false, reason: 'customer-ended-call', clientLabel: 'c1' });

beforeEach(() => {
  vi.clearAllMocks();
  notifyAlerts.mockResolvedValue(undefined);
  deadCallWatchService.reset();
});

describe('ce qui compte comme un appel sans parole', () => {
  it('un transcript vide, quelle que soit sa forme', () => {
    expect(isSilentCall('')).toBe(true);
    expect(isSilentCall('   \n  ')).toBe(true);
    expect(isSilentCall(null)).toBe(true);
    expect(isSilentCall(undefined)).toBe(true);
  });

  it('un seul mot suffit à prouver que la chaîne a vécu', () => {
    expect(isSilentCall('Bonjour')).toBe(false);
  });

  it("la DURÉE n'entre pas dans la règle", () => {
    /* Un appel de trois minutes sans un mot est une panne tout aussi vraie
       (transcripteur muet). Exiger une durée courte la laisserait passer. */
    expect(isSilentCall('')).toBe(true);
  });
});

describe('la série alerte, un accident ne le fait pas', () => {
  it('deux appels muets ne disent rien: un faux numéro, ça arrive', () => {
    deadCallWatchService.record(silent());
    deadCallWatchService.record(silent());
    expect(notifyAlerts).not.toHaveBeenCalled();
    expect(deadCallWatchService.summary().streak).toBe(2);
  });

  it('au troisième, elle crie', () => {
    for (let i = 0; i < 3; i++) deadCallWatchService.record(silent());
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    expect(String(notifyAlerts.mock.calls[0][0])).toContain('LIGNE MUETTE');
  });

  it("un seul appel qui aboutit remet la série à zéro", () => {
    /* C'est ce retour à zéro qui distingue une panne d'une coïncidence. */
    deadCallWatchService.record(silent());
    deadCallWatchService.record(silent());
    deadCallWatchService.record(spoke());
    deadCallWatchService.record(silent());
    expect(notifyAlerts).not.toHaveBeenCalled();
    expect(deadCallWatchService.summary().streak).toBe(1);
  });
});

describe("l'alerte porte ce que le code ne pouvait pas deviner", () => {
  it('la raison BRUTE de Vapi, jamais interprétée', () => {
    /* 6nonies: c'est la raison qui décide de la réparation. Un solde épuisé se
       recharge, un assistant refusé se resynchronise. Et 6quinvicies interdit
       de deviner quels codes nomment une panne de facturation: on transporte,
       on ne classe pas. */
    for (let i = 0; i < 3; i++) deadCallWatchService.record(silent('pipeline-error-no-credits'));
    const message = String(notifyAlerts.mock.calls[0][0]);
    expect(message).toContain('pipeline-error-no-credits');
  });

  it("dit ce que l'appelant vit, pas seulement un compteur", () => {
    // « 3 appels muets » ne dit pas qu'un renvoi actif perd les appels.
    for (let i = 0; i < 3; i++) deadCallWatchService.record(silent());
    const message = String(notifyAlerts.mock.calls[0][0]);
    expect(message).toMatch(/renvoi/i);
    expect(message).toMatch(/solde/i);
  });

  it('survit à un Discord muet', () => {
    // Une alerte est un supplément: son échec ne casse pas la fin d'appel.
    notifyAlerts.mockRejectedValue(new Error('discord down'));
    expect(() => {
      for (let i = 0; i < 3; i++) deadCallWatchService.record(silent());
    }).not.toThrow();
  });
});

describe('la levée compte autant que l\'alerte', () => {
  it("annonce le retour dès qu'un appel aboutit", () => {
    /* Sans elle, personne ne sait que c'est fini, et la prochaine alerte se lit
       comme la même. */
    for (let i = 0; i < 3; i++) deadCallWatchService.record(silent());
    notifyAlerts.mockClear();
    deadCallWatchService.record(spoke());
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    expect(String(notifyAlerts.mock.calls[0][0])).toContain('répond de nouveau');
    expect(deadCallWatchService.summary().alerting).toBe(false);
  });

  it('ne se lève pas quand rien ne s\'était plaint', () => {
    deadCallWatchService.record(spoke());
    expect(notifyAlerts).not.toHaveBeenCalled();
  });

  it("n'alerte qu'une fois pendant que la panne dure", () => {
    const watch = new DeadCallWatchService();
    for (let i = 0; i < 10; i++) watch.record(silent());
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
  });
});

describe('le canari ATTEINT la fin d\'appel réelle', () => {
  /* La règle la plus chère de ce dépôt: un mécanisme construit, testé, et
     jamais branché sur le chemin qui sert n'existe pas (6quindecies, sept fois
     payée). Un canari non branché est pire que pas de canari: il donne
     l'impression que la panne serait signalée. */
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const WEBHOOK = stripComments(
    readFileSync(join(__dirname, '..', '..', '..', 'controllers', 'voice-webhook.controller.ts'), 'utf8'),
  );

  it('est appelé par le webhook de fin d\'appel', () => {
    expect(WEBHOOK).toMatch(/deadCallWatchService\.record\(/);
    expect(WEBHOOK).toMatch(/isSilentCall\(/);
  });

  it('est posé APRÈS la sortie répondeur', () => {
    /* Un appelant absent est un appel normal. Le compter ferait sonner
       l'alerte les nuits creuses, et une alerte qui crie pour rien s'apprend
       à être ignorée. */
    const repondeur = WEBHOOK.indexOf("endedReason === 'voicemail'");
    const canari = WEBHOOK.indexOf('deadCallWatchService.record(');
    expect(repondeur).toBeGreaterThanOrEqual(0);
    expect(canari).toBeGreaterThan(repondeur);
  });

  it("est posé AVANT l'analyse, qui coûte un appel de modèle et peut lever", () => {
    // Une panne de flotte doit être criée même si tout le reste échoue.
    const canari = WEBHOOK.indexOf('deadCallWatchService.record(');
    const analyse = WEBHOOK.indexOf('handleClientCallCompleted(');
    expect(analyse).toBeGreaterThan(canari);
  });
});
