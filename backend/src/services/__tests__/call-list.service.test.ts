import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m: any = {
    prospect: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    prospectCallLog: { create: vi.fn(), findMany: vi.fn() },
  };
  m.$transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops));
  return m;
});
vi.mock('../../config/database', () => ({ prisma: prismaMock }));

import { callListService, computeStats } from '../call-list.service';

const at = (iso: string) => new Date(iso);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.prospect.findUnique.mockResolvedValue({ id: 'p1', status: 'new', callListAt: null });
  prismaMock.prospect.update.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
  prismaMock.prospectCallLog.create.mockImplementation(async ({ data }: any) => ({ id: 'l1', createdAt: new Date(), ...data }));
});

describe('consigner un appel', () => {
  it('refuse une issue inconnue et une fiche inconnue', async () => {
    expect(await callListService.log('p1', null, { outcome: 'bof' })).toMatchObject({ ok: false, error: 'invalid_outcome' });
    prismaMock.prospect.findUnique.mockResolvedValue(null);
    expect(await callListService.log('nope', null, { outcome: 'no_answer' })).toMatchObject({ ok: false, status: 404 });
  });

  it('compte l\'appel et laisse la fiche dans la liste quand personne ne décroche', async () => {
    const r = await callListService.log('p1', 'u1', { outcome: 'no_answer', note: '  sonne dans le vide ' });
    expect(r).toMatchObject({ ok: true, removedFromList: false });
    const data = prismaMock.prospect.update.mock.calls[0][0].data;
    expect(data.callAttempts).toEqual({ increment: 1 });
    expect(data.status).toBe('contacted');
    expect(data).not.toHaveProperty('callListAt');
    expect(prismaMock.prospectCallLog.create.mock.calls[0][0].data).toMatchObject({ note: 'sonne dans le vide', userId: 'u1' });
  });

  it('garde l\'objection sur un refus, et sort la fiche de la liste', async () => {
    const r = await callListService.log('p1', null, { outcome: 'refused', objection: 'anti_ai' });
    expect(r).toMatchObject({ ok: true, removedFromList: true });
    expect(prismaMock.prospectCallLog.create.mock.calls[0][0].data.objection).toBe('anti_ai');
    const data = prismaMock.prospect.update.mock.calls[0][0].data;
    expect(data.status).toBe('rejected');
    expect(data.callListAt).toBeNull();
  });

  it('ignore une objection posée sur autre chose qu\'un refus', async () => {
    await callListService.log('p1', null, { outcome: 'interested', objection: 'anti_ai' });
    expect(prismaMock.prospectCallLog.create.mock.calls[0][0].data.objection).toBeNull();
  });

  it('pose la date de rappel, et refuse une date illisible', async () => {
    await callListService.log('p1', null, { outcome: 'callback', callbackAt: '2026-11-20T08:00:00.000Z' });
    expect(prismaMock.prospect.update.mock.calls[0][0].data.nextActionDate).toEqual(at('2026-11-20T08:00:00.000Z'));
    expect(await callListService.log('p1', null, { outcome: 'callback', callbackAt: 'demain' }))
      .toMatchObject({ ok: false, error: 'invalid_callback' });
  });

  it('enregistre « ne me rappelez plus » comme une opposition définitive', async () => {
    await callListService.log('p1', null, { outcome: 'do_not_call' });
    const data = prismaMock.prospect.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ callOptedOut: true, callOptOutSource: 'manual', eligibleForCall: false, callListAt: null });
  });

  it('ne fait jamais reculer un statut acquis', async () => {
    prismaMock.prospect.findUnique.mockResolvedValue({ id: 'p1', status: 'converted' });
    await callListService.log('p1', null, { outcome: 'no_answer' });
    expect(prismaMock.prospect.update.mock.calls[0][0].data.status).toBe('converted');
  });
});

describe('la liste', () => {
  it('ne renvoie pas en fin de liste une fiche déjà présente', async () => {
    const since = at('2026-11-10T10:00:00Z');
    prismaMock.prospect.findUnique.mockResolvedValue({ id: 'p1', callListAt: since });
    expect(await callListService.setInList('p1', true)).toEqual({ id: 'p1', callListAt: since });
    expect(prismaMock.prospect.update).not.toHaveBeenCalled();
  });

  it('retire une fiche', async () => {
    prismaMock.prospect.findUnique.mockResolvedValue({ id: 'p1', callListAt: new Date() });
    await callListService.setInList('p1', false);
    expect(prismaMock.prospect.update.mock.calls[0][0].data.callListAt).toBeNull();
  });
});

describe('les chiffres', () => {
  const logs = [
    { outcome: 'no_answer', objection: null, createdAt: at('2026-11-16T06:45:00Z'), niche: 'home_services' }, // 7 h 45 à Bruxelles
    { outcome: 'meeting', objection: null, createdAt: at('2026-11-16T07:10:00Z'), niche: 'home_services' },   // 8 h 10
    { outcome: 'refused', objection: 'anti_ai', createdAt: at('2026-11-16T11:30:00Z'), niche: 'auto' },      // 12 h 30
    { outcome: 'refused', objection: 'anti_ai', createdAt: at('2026-11-16T13:30:00Z'), niche: 'auto' },      // 14 h 30
    { outcome: 'voicemail', objection: null, createdAt: at('2026-11-16T21:00:00Z'), niche: null },           // 22 h
  ];

  it('compte les appels, les décrochés et les rendez-vous', () => {
    const s = computeStats(logs);
    expect(s).toMatchObject({ calls: 5, reached: 3, meetings: 1 });
    expect(s.reachRate).toBeCloseTo(0.6);
    expect(s.meetingRate).toBeCloseTo(0.2);
  });

  it('range les appels dans les fenêtres de Bruxelles, pas dans celles du serveur', () => {
    const s = computeStats(logs);
    const w = Object.fromEntries(s.byWindow.map(x => [x.key, x]));
    expect(w['07-09']).toMatchObject({ calls: 2, reached: 1, meetings: 1 });
    expect(w['12-14']).toMatchObject({ calls: 1, reached: 1 });
    expect(w['14-17']).toMatchObject({ calls: 1 });
    expect(w['autre']).toMatchObject({ calls: 1, reached: 0 });
  });

  it('classe les objections et les métiers par fréquence', () => {
    const s = computeStats(logs);
    expect(s.byObjection[0]).toEqual({ key: 'anti_ai', count: 2 });
    expect(s.byNiche.map(n => n.key)).toEqual(['home_services', 'auto', 'inconnu']);
  });

  it('ne divise pas par zéro sans appel', () => {
    expect(computeStats([])).toMatchObject({ calls: 0, reachRate: null, meetingRate: null });
  });
});
