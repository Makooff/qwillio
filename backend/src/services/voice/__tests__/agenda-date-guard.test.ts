import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'agenda refuse une date PASSÉE en nommant le jour d'aujourd'hui.
 *
 * Appel réel du 12/09/2026: le modèle demande les créneaux du 17 juin. Lui
 * répondre « aucun créneau » le ferait proposer le 18 juin; il s'est trompé
 * de mois, pas de créneau, et la seule chose qui lui manque est la date du
 * jour. Et un jour libre est rendu AVEC son jour de semaine: « lundi 17
 * juin » annoncé pour un jour qui n'était pas un lundi.
 */
const { getProfile, freeSlots } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  freeSlots: vi.fn(),
}));

vi.mock('../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: vi.fn(() => ({ callerNumber: null })),
    recordToolCall: vi.fn(),
    heldSlots: vi.fn(() => []),
    recordLead: vi.fn(),
    markLeadActivity: vi.fn(),
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember: vi.fn() } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({
  availabilitySpeculator: { freeSlots, take: vi.fn(), speculate: vi.fn() },
}));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const { toolRuntimeService } = await import('../tool-runtime.service');

const profile = {
  clientId: 'c1', businessName: 'Demtalix', language: 'fr', country: 'BE',
  timezone: 'Europe/Brussels', bookingEnabled: true, calendarConnected: true,
};

async function check(args: Record<string, unknown>) {
  const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'checkAvailability', args, toolCallId: 't1' } as never);
  return out.result;
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  freeSlots.mockResolvedValue(['09:00', '10:30']);
});

describe('checkAvailability — la date', () => {
  it('refuse une date passée et nomme le jour d\'aujourd\'hui', async () => {
    const out = String(await check({ date: '2024-06-17' }));
    expect(out).toMatch(/^DATE PASSEE/);
    expect(out).toContain('Nous sommes le ');
    expect(freeSlots).not.toHaveBeenCalled();
  });

  it('rend un jour libre AVEC son jour de semaine', async () => {
    const out = String(await check({ date: '2099-09-16' }));
    expect(out).toMatch(/^LIBRE le mercredi 16 septembre 2099 \(2099-09-16\)/);
  });
});
