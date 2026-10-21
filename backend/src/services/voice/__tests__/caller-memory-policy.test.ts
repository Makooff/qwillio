import { describe, expect, it } from 'vitest';
import { callerMemoryView, canonicalCallerNumber, memoryEnvelope, mergeIdentityFact, type CallerMemoryInput } from '../caller-memory-policy';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-20T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY).toISOString();

const input = (over: Partial<CallerMemoryInput> = {}): CallerMemoryInput =>
  ({ clientId: 'c1', callerNumber: '32475123456', ...over });

const rowWithFact = (fact: unknown) => ({
  knownName: null, email: null, profileSummary: null, preferences: [], facts: {
    version: 1,
    identity: { name: fact, email: null },
  },
});

describe('canonicalCallerNumber — téléphone valide et pays identifié', () => {
  it.each(['+3245123456', '+80012345678', '+99912345678', 'anonymous', '0475123456', '+32abc475123456', '+32475123456 ext 2'])('rejette %s sans fabriquer une clé', value => {
    expect(canonicalCallerNumber(value)).toBeNull();
  });
  it.each(['32475123456', '+32475123456', '0032475123456', '+32 (475) 12-34-56'])('canonicalise %s vers les chiffres internationaux', value => {
    expect(canonicalCallerNumber(value)).toBe('32475123456');
  });
});

describe('dates persistées strictes', () => {
  it.each(['2026-02-30T12:00:00.000Z', '2026-10-20', '2099-01-01T00:00:00.000Z'])('ne sert pas le calendrier invalide ou futur %s', at => {
    const fact = { value: 'Invalid', source: 'confirmed', at, callId: null };
    const row = { knownName: 'Invalid', email: 'bad@example.com', facts: {
      version: 1, identity: { name: fact, email: { ...fact, value: 'bad@example.com' } },
      contact: { callbackNumber: { ...fact, value: '33612345678' } },
      engagements: { openRequests: [{ text: 'Invalid', at }] },
    } };
    expect(callerMemoryView(row, now)).toMatchObject({ knownName: null, email: null, callbackNumber: null, openRequests: [] });
  });
});

describe('expiration — la vue ne sert que ce qui est encore valide', () => {
  it('un fait analysis de plus de 90 jours n\'est plus servi', () => {
    const stale = { value: 'Julien', source: 'analysis', at: daysAgo(91), callId: 'c1' };
    expect(callerMemoryView(rowWithFact(stale), now).knownName).toBeNull();
  });

  it('un fait analysis de 89 jours est encore servi', () => {
    const fresh = { value: 'Julien', source: 'analysis', at: daysAgo(89), callId: 'c1' };
    expect(callerMemoryView(rowWithFact(fresh), now).knownName).toBe('Julien');
  });

  it('un fait confirmé ne périme jamais', () => {
    const confirmed = { value: 'Julien Martin', source: 'confirmed', at: daysAgo(400), callId: 'c1' };
    expect(callerMemoryView(rowWithFact(confirmed), now).knownName).toBe('Julien Martin');
  });

  it('une ligne legacy sans enveloppe garde son nom (grand-père)', () => {
    const legacy = { knownName: 'Julien', email: null, profileSummary: null, preferences: [], facts: null };
    expect(callerMemoryView(legacy, now).knownName).toBe('Julien');
  });

  it('une demande de plus de 30 jours disparaît de la vue', () => {
    const row = {
      knownName: null, email: null, profileSummary: null, preferences: [], facts: {
        version: 1, identity: { name: null, email: null },
        engagements: { openRequests: [
          { text: 'Ancien', callbackWhen: null, forPerson: null, at: daysAgo(31), callId: null },
          { text: 'Récent', callbackWhen: null, forPerson: null, at: daysAgo(2), callId: null },
        ] },
      },
    };
    const view = callerMemoryView(row, now);
    expect(view.openRequests.map(r => r.text)).toEqual(['Récent']);
  });

  it('une ligne bloquée ne sert rien, même frais', () => {
    const fresh = { value: 'Julien', source: 'confirmed', at: daysAgo(1), callId: 'c1' };
    expect(callerMemoryView({ ...rowWithFact(fresh), isBlocked: true }, now).knownName).toBeNull();
  });
});

describe('memoryEnvelope — tolérance des données réelles', () => {
  it('reconstruit une enveloppe vide depuis null/garbage', () => {
    for (const garbage of [null, undefined, 'x', [1], { version: 2 }]) {
      const e = memoryEnvelope(garbage);
      expect(e.version).toBe(1);
      expect(e.identity.name).toBeNull();
    }
  });

  it('ignore une demande mal formée mais garde les autres', () => {
    const e = memoryEnvelope({
      version: 1, identity: { name: null, email: null },
      engagements: { openRequests: [{ nope: 1 }, { text: 'Ok', at: daysAgo(1), callId: null }] },
    });
    expect(e.engagements.openRequests).toHaveLength(1);
    expect(e.engagements.openRequests[0].text).toBe('Ok');
  });
});

describe('mergeIdentityFact — rang et fraîcheur', () => {
  const at = new Date('2026-10-20T12:00:00Z');
  it('une source plus forte gagne même plus ancienne en date', () => {
    const prev = mergeIdentityFact(null, 'Julien', input({ identitySource: 'analysis' }), at);
    const next = mergeIdentityFact(prev, 'Julien Martin', input({ identitySource: 'confirmed' }), at);
    expect(next?.value).toBe('Julien Martin');
  });
  it('une source plus faible ne rétrograde pas un fait confirmé', () => {
    const prev = mergeIdentityFact(null, 'Julien Martin', input({ identitySource: 'confirmed' }), at);
    const next = mergeIdentityFact(prev, 'Gilles', input({ identitySource: 'analysis' }), at);
    expect(next?.value).toBe('Julien Martin');
  });
});
