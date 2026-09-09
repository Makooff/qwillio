import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Rétention des données d'appel (roadmap 2.2).
 *
 * Le contrat testé: la politique publiée (90 j) devient vraie — passé la
 * rétention, le CONTENU personnel disparaît (transcript, identité, audio chez
 * Vapi) mais la LIGNE reste (facturation, stats), et rien n'est vidé en local
 * tant que l'audio distant n'a pas été réellement supprimé.
 */
const {
  clientFindMany, clientCallFindMany, clientCallUpdate, clientCallUpdateMany,
  callerMemoryDeleteMany, callerMemoryUpdateMany, callerMemoryFindUnique, callerMemoryUpdate,
  callUpdateMany, prospectUpdateMany,
} = vi.hoisted(() => ({
  clientFindMany: vi.fn(), clientCallFindMany: vi.fn(), clientCallUpdate: vi.fn(),
  clientCallUpdateMany: vi.fn(), callerMemoryDeleteMany: vi.fn(), callerMemoryUpdateMany: vi.fn(),
  callerMemoryFindUnique: vi.fn(), callerMemoryUpdate: vi.fn(),
  callUpdateMany: vi.fn(), prospectUpdateMany: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    client: { findMany: clientFindMany },
    clientCall: { findMany: clientCallFindMany, update: clientCallUpdate, updateMany: clientCallUpdateMany },
    callerMemory: {
      deleteMany: callerMemoryDeleteMany,
      updateMany: callerMemoryUpdateMany,
      findUnique: callerMemoryFindUnique,
      update: callerMemoryUpdate,
    },
    call: { updateMany: callUpdateMany },
    prospect: { updateMany: prospectUpdateMany },
  },
}));

import {
  dataRetentionService,
  resolveRetentionDays,
  retainUntilFor,
  cutoffFor,
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
} from '../data-retention.service';
import { env } from '../../config/env';

describe('resolveRetentionDays', () => {
  it('null ou absent = le défaut promis par la politique (90 j)', () => {
    expect(resolveRetentionDays(null)).toBe(DEFAULT_RETENTION_DAYS);
    expect(resolveRetentionDays(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(DEFAULT_RETENTION_DAYS).toBe(90);
  });

  it('borne entre 30 j et 5 ans, quel que soit ce que le client demande', () => {
    expect(resolveRetentionDays(1)).toBe(MIN_RETENTION_DAYS);
    expect(resolveRetentionDays(999_999)).toBe(MAX_RETENTION_DAYS);
    expect(resolveRetentionDays(180)).toBe(180);
    expect(resolveRetentionDays(NaN)).toBe(DEFAULT_RETENTION_DAYS);
  });
});

describe('cutoffFor', () => {
  it('recule d\'exactement N jours', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    expect(cutoffFor(90, now).toISOString()).toBe('2026-05-15T12:00:00.000Z');
  });
});

describe('purgeExpiredCallData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientCallUpdateMany.mockResolvedValue({ count: 0 });
    callerMemoryDeleteMany.mockResolvedValue({ count: 0 });
    callerMemoryUpdateMany.mockResolvedValue({ count: 0 });
    callUpdateMany.mockResolvedValue({ count: 0 });
    prospectUpdateMany.mockResolvedValue({ count: 0 });
    clientCallFindMany.mockResolvedValue([]);
  });

  it('purge le contenu mais jamais la ligne: updateMany, pas deleteMany', async () => {
    clientFindMany.mockResolvedValue([{ id: 'c1', retentionDays: null, businessName: 'A' }]);
    clientCallUpdateMany.mockResolvedValue({ count: 3 });

    const report = await dataRetentionService.purgeExpiredCallData(new Date('2026-08-13T12:00:00Z'));

    expect(report.clientCallsPurged).toBe(3);
    const data = clientCallUpdateMany.mock.calls[0][0].data;
    expect(data.transcript).toBeNull();
    expect(data.recordingUrl).toBeNull();
    expect(data.callerNumber).toBeNull();
    // La durée et le coût ne sont pas touchés: la ligne survit pour les stats.
    expect(data).not.toHaveProperty('durationSeconds');
    expect(data).not.toHaveProperty('status');
  });

  it('supprime l\'audio chez Vapi AVANT de vider la ligne, et garde la ligne en cas d\'échec distant', async () => {
    clientFindMany.mockResolvedValue([{ id: 'c1', retentionDays: 90, businessName: 'A' }]);
    clientCallFindMany.mockResolvedValue([
      { id: 'call_ok', vapiCallId: 'vapi_ok' },
      { id: 'call_ko', vapiCallId: 'vapi_ko' },
    ]);
    const originalKey = env.VAPI_PRIVATE_KEY;
    (env as { VAPI_PRIVATE_KEY: string }).VAPI_PRIVATE_KEY = 'key';
    const fetchMock = vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (url: string) =>
      ({ ok: String(url).includes('vapi_ok'), status: String(url).includes('vapi_ok') ? 200 : 500 })) as never);

    try {
      const report = await dataRetentionService.purgeExpiredCallData(new Date('2026-08-13T12:00:00Z'));
      // Seule la ligne dont l'audio distant est parti est vidée localement.
      expect(clientCallUpdate).toHaveBeenCalledTimes(1);
      expect(clientCallUpdate.mock.calls[0][0].where).toEqual({ id: 'call_ok' });
      expect(report.vapiDeletions).toBe(1);
      expect(report.vapiDeletionFailures).toBe(1);
    } finally {
      fetchMock.mockRestore();
      (env as { VAPI_PRIVATE_KEY: string }).VAPI_PRIVATE_KEY = originalKey;
    }
  });

  it('supprime entièrement la mémoire d\'appelant expirée', async () => {
    clientFindMany.mockResolvedValue([{ id: 'c1', retentionDays: null, businessName: 'A' }]);
    callerMemoryDeleteMany.mockResolvedValue({ count: 4 });
    const report = await dataRetentionService.purgeExpiredCallData();
    expect(report.callerMemoriesDeleted).toBe(4);
    expect(callerMemoryDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clientId: 'c1' }) })
    );
  });

  /**
   * Deux défauts trouvés en relisant ce service, et le premier est sérieux.
   *
   * La purge faisait `deleteMany({ lastCallAt: { lt: cutoff } })` sans regarder
   * `isBlocked`. Une opposition — « ne me rappelez jamais » — vieille de plus
   * de trois mois disparaissait donc toute seule, et l'appelant redevenait
   * rappelable. C'est l'inverse exact de ce qu'il avait demandé.
   *
   * Et `block()` crée une ligne SANS `lastCallAt`. En SQL un NULL ne matche
   * aucune comparaison: ces lignes-là n'étaient jamais échues, donc leur
   * personnel restait indéfiniment.
   */
  describe('la mémoire d\'appelant, bloquée ou non', () => {
    beforeEach(() => {
      clientFindMany.mockResolvedValue([{ id: 'c1', retentionDays: null, businessName: 'A' }]);
    });

    it('ne supprime QUE les lignes non bloquées', async () => {
      await dataRetentionService.purgeExpiredCallData();
      expect(callerMemoryDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isBlocked: false }) }),
      );
    });

    it('garde l\'opposition et n\'en vide que le personnel', async () => {
      callerMemoryUpdateMany.mockResolvedValue({ count: 2 });
      const report = await dataRetentionService.purgeExpiredCallData();
      expect(report.callerMemoriesAnonymised).toBe(2);

      const call = callerMemoryUpdateMany.mock.calls.at(-1)![0];
      expect(call.where.isBlocked).toBe(true);
      // Le numéro et le drapeau restent: c'est le minimum pour ne pas rappeler.
      expect(call.data.callerNumber).toBeUndefined();
      expect(call.data.isBlocked).toBeUndefined();
      // Tout le reste tombe.
      for (const field of ['knownName', 'email', 'profileSummary', 'lastSummary']) {
        expect(call.data[field]).toBeNull();
      }
      expect(call.data.preferences).toEqual([]);
    });

    it('rattrape les lignes sans date d\'appel, que `lt` ne matchait jamais', async () => {
      await dataRetentionService.purgeExpiredCallData();
      const where = callerMemoryDeleteMany.mock.calls.at(-1)![0].where;
      // `block()` n'écrit pas de lastCallAt: sans repli sur createdAt, ces
      // lignes ne sont échues à aucun moment.
      expect(where.OR).toEqual(
        expect.arrayContaining([expect.objectContaining({ lastCallAt: null })]),
      );
    });

    it('sépare l\'échéance de la forme par un AND explicite', async () => {
      // Deux `OR` fondus en un videraient des lignes non échues. Même piège
      // que la requête d'appels, déjà payé une fois.
      await dataRetentionService.purgeExpiredCallData();
      const where = callerMemoryUpdateMany.mock.calls.at(-1)![0].where;
      expect(Array.isArray(where.AND)).toBe(true);
      expect(where.AND).toHaveLength(2);
      expect(where.OR).toBeUndefined();
    });
  });

  it('purge aussi le monde outbound (Call + Prospect.callTranscript) à la rétention par défaut', async () => {
    clientFindMany.mockResolvedValue([]);
    callUpdateMany.mockResolvedValue({ count: 7 });
    prospectUpdateMany.mockResolvedValue({ count: 2 });
    const report = await dataRetentionService.purgeExpiredCallData();
    expect(report.outboundCallsPurged).toBe(7);
    expect(report.prospectTranscriptsPurged).toBe(2);
  });
});

describe('eraseCaller — droit du sujet de données', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientCallFindMany.mockResolvedValue([]);
    clientCallUpdateMany.mockResolvedValue({ count: 2 });
    callerMemoryDeleteMany.mockResolvedValue({ count: 1 });
    callerMemoryUpdate.mockResolvedValue({});
    callerMemoryFindUnique.mockResolvedValue({ isBlocked: false });
  });

  it('vide les appels ET supprime la mémoire, toujours scopé au client', async () => {
    const result = await dataRetentionService.eraseCaller('c1', '+32470000000');
    expect(result).toEqual({ calls: 2, memoryDeleted: true, optOutKept: false });
    expect(clientCallUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'c1', callerNumber: '+32470000000' } })
    );
    expect(callerMemoryDeleteMany).toHaveBeenCalledWith({ where: { clientId: 'c1', callerNumber: '+32470000000' } });
  });

  /**
   * Le même défaut que la purge, sur le chemin de l'effacement à la demande.
   * Supprimer la ligne entière effacerait le « ne me rappelez jamais » avec le
   * reste: l'appelant aurait exercé un droit et récolté exactement ce qu'il
   * refusait. Un numéro sur une liste d'opposition ne peut pas lui nuire, il
   * ne sert qu'à ne pas l'appeler.
   */
  it('garde l\'opposition, et n\'efface que le reste', async () => {
    callerMemoryFindUnique.mockResolvedValue({ isBlocked: true });

    const result = await dataRetentionService.eraseCaller('c1', '+32470000000');

    expect(result).toEqual({ calls: 2, memoryDeleted: false, optOutKept: true });
    // La ligne n'est PAS supprimée…
    expect(callerMemoryDeleteMany).not.toHaveBeenCalled();
    // …mais tout ce qui n'est pas nécessaire pour ne pas rappeler tombe.
    const data = callerMemoryUpdate.mock.calls.at(-1)![0].data;
    for (const field of ['knownName', 'email', 'profileSummary', 'lastSummary']) {
      expect(data[field]).toBeNull();
    }
    expect(data.preferences).toEqual([]);
    // Ni le numéro ni le drapeau ne sont touchés: ils SONT l'opposition.
    expect(data.callerNumber).toBeUndefined();
    expect(data.isBlocked).toBeUndefined();
  });

  it('supprime bien la ligne quand il n\'y a aucune opposition à honorer', async () => {
    callerMemoryFindUnique.mockResolvedValue(null);
    const result = await dataRetentionService.eraseCaller('c1', '+32470000000');
    expect(result.optOutKept).toBe(false);
    expect(callerMemoryUpdate).not.toHaveBeenCalled();
  });
});

/**
 * LEG-4: chaque enregistrement porte sa date limite.
 *
 * La purge la recalculait à chaque passage depuis le réglage COURANT du client.
 * Un enregistrement ne portait donc aucune échéance, et « jusqu'à quand
 * gardez-vous cet appel » n'avait pas de réponse vérifiable — ce que la CNIL
 * demande précisément de pouvoir montrer.
 */
describe('la date limite portée par l\'appel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientFindMany.mockResolvedValue([{ id: 'c1', retentionDays: 90, businessName: 'Chez Marie' }]);
    clientCallFindMany.mockResolvedValue([]);
    clientCallUpdateMany.mockResolvedValue({ count: 0 });
    callerMemoryDeleteMany.mockResolvedValue({ count: 0 });
    callUpdateMany.mockResolvedValue({ count: 0 });
    prospectUpdateMany.mockResolvedValue({ count: 0 });
  });

  it('est posée à l\'écriture, bornée comme le réglage', () => {
    const now = new Date('2026-09-09T12:00:00Z');
    const jour = 86_400_000;

    expect(retainUntilFor(90, now).getTime() - now.getTime()).toBe(90 * jour);
    // Un réglage aberrant est ramené dans les bornes AVANT d'être daté: une
    // échéance à dix ans écrite en base serait bien plus difficile à rattraper
    // qu'un réglage aberrant qui n'a jamais servi.
    expect(retainUntilFor(10_000, now).getTime() - now.getTime()).toBe(MAX_RETENTION_DAYS * jour);
    expect(retainUntilFor(1, now).getTime() - now.getTime()).toBe(MIN_RETENTION_DAYS * jour);
    expect(retainUntilFor(null, now).getTime() - now.getTime()).toBe(DEFAULT_RETENTION_DAYS * jour);
  });

  it('efface au PREMIER des deux termes échus', async () => {
    const now = new Date('2026-09-09T12:00:00Z');
    await dataRetentionService.purgeExpiredCallData(now);

    const where = clientCallFindMany.mock.calls[0][0].where;
    // Les deux termes, et un OR entre eux: le calcul courant permet de
    // RACCOURCIR, la date posée empêche de PROLONGER ce qui est déjà
    // enregistré. Les deux vont dans le sens de l'appelant.
    expect(where.OR).toEqual([
      { createdAt: { lt: cutoffFor(90, now) } },
      { retainUntil: { lte: now } },
    ]);
  });

  it('ne fond pas l\'échéance et la forme de la ligne dans un même OR', async () => {
    const now = new Date('2026-09-09T12:00:00Z');
    await dataRetentionService.purgeExpiredCallData(now);

    // Les fondre effacerait des appels NON échus dont la ligne a la bonne
    // forme, c'est-à-dire à peu près tous.
    const where = clientCallUpdateMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toEqual([
      { createdAt: { lt: cutoffFor(90, now) } },
      { retainUntil: { lte: now } },
    ]);
    expect(where.OR).toBeUndefined();
  });
});
