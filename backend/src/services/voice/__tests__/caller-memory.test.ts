import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const upsert = vi.fn();
const invalidateCaller = vi.fn();

// The service writes inside prisma.$transaction; run the callback against a
// tx object exposing the same callerMemory stubs so legacy assertions on the
// upsert/findUnique calls still observe the write path.
const tx = {
  callerMemory: { findUnique, upsert },
  $queryRaw: vi.fn(async () => [{ locked: '' }]),
};
const transaction = vi.fn(async (fn: unknown) => (fn as (t: unknown) => unknown)(tx));

vi.mock('../../../config/database', () => ({
  prisma: {
    callerMemory: { findUnique, upsert },
    $transaction: transaction,
  },
}));

vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { invalidateCaller: (...a: unknown[]) => invalidateCaller(...a) },
}));

const { callerMemoryService } = await import('../caller-memory.service');

/** The `update` half of the upsert call, which is where the merge logic lives. */
const updateArg = () => upsert.mock.calls[0][0].update;
const createArg = () => upsert.mock.calls[0][0].create;

describe('callerMemoryService.remember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({});
    findUnique.mockResolvedValue(null);
  });

  it('does nothing without a caller number — there is no key to remember against', async () => {
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: null, name: 'Julien' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('creates a first memory with a call count of one', async () => {
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233', name: 'Julien', summary: 'Wanted a table' });
    expect(createArg()).toMatchObject({ knownName: 'Julien', totalCalls: 1, lastSummary: 'Wanted a table' });
  });

  it('never erases a known name with a null from a call where it was not restated', async () => {
    findUnique.mockResolvedValue({ knownName: 'Julien', email: 'j@x.com', profileSummary: null, preferences: [] });
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233', name: null, email: null });
    expect(updateArg().knownName).toBe('Julien');
    expect(updateArg().email).toBe('j@x.com');
  });

  it('prefers the newly captured name over the stored one', async () => {
    findUnique.mockResolvedValue({ knownName: 'J.', email: null, profileSummary: null, preferences: [] });
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233', name: 'Julien Martin' });
    expect(updateArg().knownName).toBe('Julien Martin');
  });

  it('prepends the newest call to the rolling summary', async () => {
    findUnique.mockResolvedValue({ knownName: null, email: null, profileSummary: 'Older context', preferences: [] });
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233', summary: 'Newest call' });
    expect(updateArg().profileSummary).toBe('Newest call | Older context');
  });

  it('keeps the summary bounded — it is injected into every future prompt', async () => {
    findUnique.mockResolvedValue({ knownName: null, email: null, profileSummary: 'x'.repeat(900), preferences: [] });
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233', summary: 'Newest' });
    expect(updateArg().profileSummary.length).toBeLessThanOrEqual(400);
    // The newest call survives the trim; the oldest context is what is dropped.
    expect(updateArg().profileSummary.startsWith('Newest')).toBe(true);
  });

  it('increments the call count rather than overwriting it', async () => {
    findUnique.mockResolvedValue({ knownName: null, email: null, profileSummary: null, preferences: [] });
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233' });
    expect(updateArg().totalCalls).toEqual({ increment: 1 });
  });

  it('deduplicates preferences case-insensitively, newest first', async () => {
    findUnique.mockResolvedValue({ knownName: null, email: null, profileSummary: null, preferences: ['Window seat', 'No nuts'] });
    await callerMemoryService.remember({
      clientId: 'c1',
      callerNumber: '+33600112233',
      preferences: ['window seat', 'Early morning'],
    });
    expect(updateArg().preferences).toEqual(['window seat', 'Early morning', 'No nuts']);
  });

  it('invalidates the cached history so the next call sees the update', async () => {
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233', name: 'Julien' });
    expect(invalidateCaller).toHaveBeenCalledWith('c1', '+33600112233');
  });

  it('swallows a write failure — memory must never break a finished call', async () => {
    upsert.mockRejectedValue(new Error('deadlock'));
    await expect(
      callerMemoryService.remember({ clientId: 'c1', callerNumber: '+33600112233', name: 'Julien' })
    ).resolves.toBeUndefined();
  });
});

describe('callerMemoryService.get', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null without a number', async () => {
    expect(await callerMemoryService.get('c1', null)).toBeNull();
  });

  it('returns null instead of throwing when the lookup fails', async () => {
    findUnique.mockRejectedValue(new Error('timeout'));
    expect(await callerMemoryService.get('c1', '+33600112233')).toBeNull();
  });
});

/**
 * LA CLÉ DE LA MÉMOIRE EST NORMALISÉE À L'ÉCRITURE (19/09/2026).
 *
 * Retour du propriétaire: « quand je dis bonjour, j'ai un rendez-vous avec vous
 * mais je ne sais plus la date, lui sait déjà; sa mémoire liée au numéro, le
 * prénom et le nom, déjà chargés, pour qu'il n'aille pas chercher. »
 *
 * Le code faisait l'inverse, et pour une raison de FORME. `captureLead` écrit
 * la mémoire sous `dictated.e164 ?? session.callerNumber`: le second est passé
 * par `normalizeNumber`, donc des chiffres seuls, le premier est de l'E.164,
 * donc avec un « + ». La lecture, elle, interroge la clé UNIQUE avec le numéro
 * de la ligne appelante, toujours sous sa forme chiffres.
 *
 * Donc: un appelant qui DICTE un numéro de rappel voit son nom classé sous
 * « +32… », une clé que rien ne relit jamais. Au rappel suivant l'agent ne le
 * reconnaît pas et redemande tout. C'est le mode d'échec de `phoneForms`, sur
 * la seule table à clé unique, où un `in` n'est pas possible à l'écriture.
 */
describe('callerMemoryService.remember — la clé', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({});
    findUnique.mockResolvedValue(null);
  });

  it('écrit sous les CHIFFRES, même quand le numéro arrive en E.164', async () => {
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+32475123456', name: 'Jean-Luc de la Forge' });
    expect(createArg()).toMatchObject({ callerNumber: '32475123456' });
    expect(upsert.mock.calls[0][0].where.clientId_callerNumber.callerNumber).toBe('32475123456');
  });

  it('cherche l\'existant sous la MÊME clé que celle qu\'il écrit', async () => {
    /* Sans ça, la lecture d'avant-fusion et l'écriture désignent deux lignes:
       l'agent écraserait un nom connu par un null à chaque appel. */
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+32475123456', name: 'X' });
    expect(findUnique.mock.calls[0][0].where.clientId_callerNumber.callerNumber).toBe('32475123456');
  });

  it('ignore ce qui ne porte aucun chiffre exploitable — la canonicalisation stricte filtre', async () => {
    /* `canonicalCallerNumber` exige 8-15 chiffres: sans clé fiable, aucune
       ligne n'est écrite plutôt qu'une ligne que rien ne relira. */
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: 'anonymous', name: 'X' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('vide le cache sous les DEUX écritures quand elles diffèrent', async () => {
    /* Une lecture antérieure a pu poser une entrée de cache sous la forme
       reçue; ne vider que la forme normalisée la laisserait servir un nom
       périmé pour le reste de la vie du processus. */
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '+32475123456', name: 'X' });
    const keys = invalidateCaller.mock.calls.map(c => c[1]);
    expect(keys).toContain('32475123456');
    expect(keys).toContain('+32475123456');
  });

  it('ne vide que les deux formes canoniques, dédupliquées', async () => {
    /* La forme chiffres et la forme E.164 peuvent toutes deux avoir servi de
       clé de cache; quand raw égale la forme chiffres, il ne reste que ces
       deux formes distinctes — jamais deux invalidations pour la même. */
    await callerMemoryService.remember({ clientId: 'c1', callerNumber: '32475123456', name: 'X' });
    expect(invalidateCaller).toHaveBeenCalledTimes(2);
    const keys = invalidateCaller.mock.calls.map(c => c[1]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
