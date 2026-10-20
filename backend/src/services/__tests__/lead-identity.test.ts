import { describe, it, expect } from 'vitest';
import {
  LEAD_STATUSES,
  normalizeLeadPhone,
  leadIdentityKey,
  groupLeadCalls,
  resolveGroupStatus,
  clampLeadPage,
  leadPhoneFilterMatches,
  type LeadCallLike,
} from '../lead-identity';

const BE = 'BE';
const FR = 'FR';

function call(partial: Partial<LeadCallLike> & { id: string }): LeadCallLike {
  return {
    callerNumber: null,
    callerName: null,
    nameCollected: null,
    phoneCollected: null,
    emailCollected: null,
    leadScore: null,
    tags: [],
    metadata: null,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    ...partial,
  };
}

describe('normalizeLeadPhone', () => {
  it('keeps the country prefix of an international number (no last-9 truncation)', () => {
    expect(normalizeLeadPhone('+32477012345', BE)).toBe('+32477012345');
    expect(normalizeLeadPhone('+33612345678', FR)).toBe('+33612345678');
  });

  it('parses a Belgian national mobile with the BE context', () => {
    expect(normalizeLeadPhone('0475 12 34 56', BE)).toBe('+32475123456');
  });

  it('parses a French national mobile with the FR context, not BE', () => {
    expect(normalizeLeadPhone('0612345678', FR)).toBe('+33612345678');
    // The historical bug: BE context turned a French local into +32 6...
    expect(normalizeLeadPhone('0612345678', BE)).toBe('+32612345678');
  });

  it('does not double-prefix digits that already carry a country code', () => {
    expect(normalizeLeadPhone('32477012345', BE)).toBe('+32477012345');
  });

  it('returns null for empty or unparseable input', () => {
    expect(normalizeLeadPhone('', BE)).toBeNull();
    expect(normalizeLeadPhone(null, BE)).toBeNull();
    expect(normalizeLeadPhone('12', BE)).toBeNull();
  });

  it('never turns letter-junk into an identity (« +abc… » must not merge)', () => {
    expect(normalizeLeadPhone('+abc3247701', BE)).toBeNull();
    expect(normalizeLeadPhone('callme-back', FR)).toBeNull();
  });

  it('rejects letters even when the stripped digits form a valid number', () => {
    /* '+abc32477123456' strips to 11 valid digits — the old code parsed it and
       merged it with a real identity. Alphabetic junk must be rejected BEFORE
       the international parser ever sees the digits. */
    expect(normalizeLeadPhone('+abc32477123456', BE)).toBeNull();
    expect(normalizeLeadPhone('+abc33612345678', FR)).toBeNull();
  });

  it('falls back to BE for an unknown country string instead of throwing', () => {
    expect(() => normalizeLeadPhone('0475123456', 'XX')).not.toThrow();
    expect(normalizeLeadPhone('0475123456', 'XX')).toBe(normalizeLeadPhone('0475123456', BE));
    expect(normalizeLeadPhone('0475123456', 'belgium')).toBe(normalizeLeadPhone('0475123456', BE));
    expect(normalizeLeadPhone('0612345678', 'fr')).toBe('+33612345678');
  });

  it('reads a numeric international number irrespective of the tenant country', () => {
    /* A BE transport number stored by the carrier must not be re-interpreted
       through a FR tenant (and vice versa). */
    expect(normalizeLeadPhone('32477012345', FR)).toBe('+32477012345');
    expect(normalizeLeadPhone('33612345678', BE)).toBe('+33612345678');
  });
});

describe('leadIdentityKey', () => {
  it('groups by callerNumber transport identity', () => {
    const a = call({ id: 'a', callerNumber: '+32477012345', callerName: 'Anna' });
    const b = call({ id: 'b', callerNumber: '32477012345', callerName: 'Anna corrigée' });
    expect(leadIdentityKey(a, BE)).toBe(leadIdentityKey(b, BE));
  });

  it('prefers callerNumber over phoneCollected when both exist', () => {
    const c = call({ id: 'c', callerNumber: '+32477012345', phoneCollected: '+33123456789' });
    expect(leadIdentityKey(c, BE)).toBe('phone:+32477012345');
  });

  it('falls back to phoneCollected only when no callerNumber', () => {
    const c = call({ id: 'c', callerNumber: null, phoneCollected: '+32477012345' });
    expect(leadIdentityKey(c, BE)).toBe('phone:+32477012345');
  });

  it('keeps unknown callers as per-call identities (never merges anonymous)', () => {
    const a = call({ id: 'a', callerNumber: null, phoneCollected: null, callerName: 'Appelant inconnu' });
    const b = call({ id: 'b', callerNumber: null, phoneCollected: null, callerName: 'Appelant inconnu' });
    expect(leadIdentityKey(a, BE)).not.toBe(leadIdentityKey(b, BE));
    expect(leadIdentityKey(a, BE)).toBe('anon:a');
  });

  it('does not collide across countries for the same national digits', () => {
    const be = call({ id: 'x', callerNumber: '+32475123456' });
    const fr = call({ id: 'y', callerNumber: '+33751234567' });
    expect(leadIdentityKey(be, BE)).not.toBe(leadIdentityKey(fr, FR));
  });
});

describe('groupLeadCalls', () => {
  it('groups repeated calls from the same number into one lead, preserving all call ids', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', callerName: 'Test A', createdAt: new Date('2026-10-01T10:00:00Z'), leadScore: 9 }),
      call({ id: 'c2', callerNumber: '32477012345', callerName: 'Test A B', createdAt: new Date('2026-10-03T10:00:00Z'), leadScore: 4 }),
    ];
    const groups = groupLeadCalls(calls, BE);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.callIds).toEqual(['c1', 'c2']);
    expect(g.callCount).toBe(2);
    expect(g.firstInteractionAt).toEqual(new Date('2026-10-01T10:00:00Z'));
    expect(g.lastInteractionAt).toEqual(new Date('2026-10-03T10:00:00Z'));
  });

  it('keeps the LATEST VALID score, not the maximum', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', createdAt: new Date('2026-10-01T10:00:00Z'), leadScore: 9 }),
      call({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-03T10:00:00Z'), leadScore: 4 }),
      call({ id: 'c3', callerNumber: '+32477012345', createdAt: new Date('2026-10-04T10:00:00Z'), leadScore: 42 }),
    ];
    const g = groupLeadCalls(calls, BE)[0];
    expect(g.leadScore).toBe(4);
  });

  it('uses a stable latest canonical name and keeps anonymous out', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', callerName: 'Appelant inconnu', createdAt: new Date('2026-10-01T10:00:00Z') }),
      call({ id: 'c2', callerNumber: '+32477012345', callerName: 'Marie Dupont', nameCollected: 'Marie', createdAt: new Date('2026-10-03T10:00:00Z') }),
    ];
    const g = groupLeadCalls(calls, BE)[0];
    expect(g.name).toBe('Marie Dupont');
  });

  it('unions tags across calls without dropping the manual status tag', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', tags: ['urgent'], createdAt: new Date('2026-10-01T10:00:00Z') }),
      call({ id: 'c2', callerNumber: '+32477012345', tags: ['converted', 'rappel'], createdAt: new Date('2026-10-03T10:00:00Z') }),
    ];
    const g = groupLeadCalls(calls, BE)[0];
    expect(g.tags).toContain('urgent');
    expect(g.tags).toContain('converted');
    expect(g.tags).toContain('rappel');
    expect(resolveGroupStatus(calls)).toBe('converted');
  });

  it('keeps anonymous calls as separate groups', () => {
    const calls = [
      call({ id: 'c1', callerNumber: null, phoneCollected: null, callerName: null }),
      call({ id: 'c2', callerNumber: null, phoneCollected: null, callerName: null }),
    ];
    expect(groupLeadCalls(calls, BE)).toHaveLength(2);
  });

  it('exposes contactId only on exact E.164 match', () => {
    const calls = [call({ id: 'c1', callerNumber: '+32477012345' })];
    const contacts = new Map([['+32477012345', 'contact-1']]);
    const g = groupLeadCalls(calls, BE, contacts)[0];
    expect(g.contactId).toBe('contact-1');
    const g2 = groupLeadCalls(calls, BE, new Map())[0];
    expect(g2.contactId).toBeNull();
  });

  it('sorts by last interaction desc with stable tie-break', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477000001', createdAt: new Date('2026-10-01T10:00:00Z') }),
      call({ id: 'c2', callerNumber: '+32477000002', createdAt: new Date('2026-10-05T10:00:00Z') }),
      call({ id: 'c3', callerNumber: '+32477000003', createdAt: new Date('2026-10-05T09:00:00Z') }),
    ];
    const groups = groupLeadCalls(calls, BE);
    expect(groups.map(g => g.callIds[0])).toEqual(['c2', 'c3', 'c1']);
  });
});

describe('resolveGroupStatus', () => {
  it('a newer call without any status does not reset a manual status set on an older call', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', createdAt: new Date('2026-10-01T10:00:00Z'), tags: ['lost'], metadata: { manualStatus: { status: 'lost', updatedAt: '2026-10-02T00:00:00Z' } } }),
      call({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-05T10:00:00Z'), tags: [] }),
    ];
    expect(resolveGroupStatus(calls)).toBe('lost');
  });

  it('falls back to new when nothing is set', () => {
    expect(resolveGroupStatus([call({ id: 'c1' })])).toBe('new');
  });

  it('prefers the latest MANUAL decision over a legacy tag on a newer call', () => {
    /* Une décision manuelle posée sur un vieil appel doit survivre à un tag
       legacy (statut ancien stocké en tag) posé sur un appel PLUS RÉCENT. */
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', createdAt: new Date('2026-10-01T10:00:00Z'), tags: ['converted'], metadata: { manualStatus: { status: 'lost', updatedAt: '2026-10-02T00:00:00Z' } } }),
      call({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-05T10:00:00Z'), tags: ['new'] }),
    ];
    expect(resolveGroupStatus(calls)).toBe('lost');
  });

  it('picks the manual status with the newest manual timestamp', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', createdAt: new Date('2026-10-01T10:00:00Z'), metadata: { manualStatus: { status: 'lost', updatedAt: '2026-10-03T00:00:00Z' } } }),
      call({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-05T10:00:00Z'), metadata: { manualStatus: { status: 'converted', updatedAt: '2026-10-02T00:00:00Z' } } }),
    ];
    expect(resolveGroupStatus(calls)).toBe('lost');
  });
});

describe('groupLeadCalls — notes', () => {
  it('takes the most recent note, not the first non-empty one', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', createdAt: new Date('2026-10-01T10:00:00Z'), metadata: { clientNotes: 'ancienne' } }),
      call({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-03T10:00:00Z'), metadata: { clientNotes: 'récente' } }),
    ];
    expect(groupLeadCalls(calls, BE)[0].notes).toBe('récente');
  });

  it('a deliberate clear (empty string) wins and does not resurrect older notes', () => {
    /* L'utilisateur a EFFACÉ sa note (chaîne vide délibérée). L'ancien code
       sautait la valeur vide et ramenait la note précédente — une resurrection. */
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', createdAt: new Date('2026-10-01T10:00:00Z'), metadata: { clientNotes: 'ancienne' } }),
      call({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-03T10:00:00Z'), metadata: { clientNotes: '' } }),
    ];
    expect(groupLeadCalls(calls, BE)[0].notes).toBe('');
  });

  it('notes stay null when no call ever carried any', () => {
    const calls = [
      call({ id: 'c1', callerNumber: '+32477012345', createdAt: new Date('2026-10-01T10:00:00Z'), metadata: {} }),
      call({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-03T10:00:00Z'), metadata: null }),
    ];
    expect(groupLeadCalls(calls, BE)[0].notes).toBeNull();
  });
});

describe('clampLeadPage', () => {
  it('clamps page and limit to sane bounds', () => {
    expect(clampLeadPage(0, 20)).toEqual({ page: 1, limit: 20 });
    expect(clampLeadPage(3, 0)).toEqual({ page: 3, limit: 1 });
    expect(clampLeadPage(2, 500)).toEqual({ page: 2, limit: 100 });
    expect(clampLeadPage(NaN, NaN)).toEqual({ page: 1, limit: 20 });
  });
});

describe('leadPhoneFilterMatches', () => {
  it('matches national and international writings of the same number', () => {
    expect(leadPhoneFilterMatches('+32475123456', '0475 12 34 56', BE)).toBe(true);
    expect(leadPhoneFilterMatches('+32475123456', '+32 475 12 34 56', BE)).toBe(true);
    expect(leadPhoneFilterMatches('+32475123456', '32475123456', BE)).toBe(true);
  });

  it('does not leak unrelated numbers or anonymous groups', () => {
    expect(leadPhoneFilterMatches('+32475123456', '+33612345678', BE)).toBe(false);
    expect(leadPhoneFilterMatches(null, '0475123456', BE)).toBe(false);
  });

  it('does not match the same suffix in another country', () => {
    // FR +33 6 12 34 56 78 vs BE +32 475 ... — last-9 style collision guard
    expect(leadPhoneFilterMatches('+33612345678', '0612345678', BE)).toBe(false);
    expect(leadPhoneFilterMatches('+33612345678', '0612345678', FR)).toBe(true);
  });

  it('a non-blank filter without digits matches nothing (typo guard)', () => {
    expect(leadPhoneFilterMatches('+32477012345', 'abc', BE)).toBe(false);
    expect(leadPhoneFilterMatches('+32477012345', '+', BE)).toBe(false);
    expect(leadPhoneFilterMatches(null, 'abc', BE)).toBe(false);
  });
});

describe('LEAD_STATUSES', () => {
  it('exposes the canonical enum', () => {
    expect([...LEAD_STATUSES]).toEqual(['new', 'contacted', 'converted', 'lost']);
  });
});
