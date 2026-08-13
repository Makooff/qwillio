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
  callerMemoryDeleteMany, callUpdateMany, prospectUpdateMany,
} = vi.hoisted(() => ({
  clientFindMany: vi.fn(), clientCallFindMany: vi.fn(), clientCallUpdate: vi.fn(),
  clientCallUpdateMany: vi.fn(), callerMemoryDeleteMany: vi.fn(),
  callUpdateMany: vi.fn(), prospectUpdateMany: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    client: { findMany: clientFindMany },
    clientCall: { findMany: clientCallFindMany, update: clientCallUpdate, updateMany: clientCallUpdateMany },
    callerMemory: { deleteMany: callerMemoryDeleteMany },
    call: { updateMany: callUpdateMany },
    prospect: { updateMany: prospectUpdateMany },
  },
}));

import {
  dataRetentionService,
  resolveRetentionDays,
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
  });

  it('vide les appels ET supprime la mémoire, toujours scopé au client', async () => {
    const result = await dataRetentionService.eraseCaller('c1', '+32470000000');
    expect(result).toEqual({ calls: 2, memoryDeleted: true });
    expect(clientCallUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'c1', callerNumber: '+32470000000' } })
    );
    expect(callerMemoryDeleteMany).toHaveBeenCalledWith({ where: { clientId: 'c1', callerNumber: '+32470000000' } });
  });
});
