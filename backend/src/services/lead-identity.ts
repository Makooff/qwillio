import { parsePhoneNumberFromString, isSupportedCountry, type CountryCode } from 'libphonenumber-js/max';

/**
 * Lead identity — the server-side answer to « one person, one row ».
 *
 * The dashboard used to paginate raw `ClientCall` rows, so a caller who
 * spelled several test names appeared once per call, and the frontend
 * « merge » re-identified people by the last 9 digits, colliding BE and FR.
 * These helpers define the ONLY grouping rule:
 *
 *  - `callerNumber` (transport identity) groups, normalized to E.164 with the
 *    TENANT's country. The country prefix is preserved; there is no last-9.
 *  - `phoneCollected` (what the AI heard) is a fallback used ONLY when no
 *    transport number exists.
 *  - Anything unknown/anonymous stays a PER-CALL identity: it is never merged
 *    by name, and placeholder names are never treated as evidence.
 *
 * Pure functions, no Prisma — the database boundary stays in the service so
 * these remain unit-testable without mocks.
 */

export const LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const ANONYMOUS_NAMES: ReadonlySet<string> = new Set([
  'appelant inconnu',
  'contact inconnu',
  'unknown caller',
  'anonymous',
  'unknown',
]);

export interface LeadCallLike {
  id: string;
  callerNumber?: string | null;
  callerName?: string | null;
  nameCollected?: string | null;
  phoneCollected?: string | null;
  emailCollected?: string | null;
  summary?: string | null;
  leadScore?: number | null;
  bookingRequested?: boolean | null;
  bookingDetails?: string | null;
  sentiment?: string | null;
  durationSeconds?: number | null;
  status?: string | null;
  tags?: string[] | null;
  metadata?: unknown;
  createdAt: Date;
}

export interface LeadGroup {
  /** Stable row id: the most recent call of the group (compat with the old
      per-call contract; callers that need history use `callIds`). */
  id: string;
  identityKey: string;
  /** Canonical E.164 of the grouped number, or null for anonymous rows. */
  phone: string | null;
  phoneCollected: string | null;
  name: string | null;
  email: string | null;
  summary: string | null;
  leadScore: number | null;
  status: LeadStatus;
  tags: string[];
  notes: string | null;
  bookingRequested: boolean;
  bookingDetails: string | null;
  sentiment: string | null;
  durationSeconds: number | null;
  callIds: string[];
  callCount: number;
  firstInteractionAt: Date;
  lastInteractionAt: Date;
  contactId: string | null;
}

/**
 * E.164 with the tenant country as context; null when nothing reliable.
 *
 * Strict parsing via libphonenumber (`isPossible`, not the loose digit-stripping
 * of `toE164`): garbage such as `+abc32477…` fails to parse and stays null, so
 * it can never become a grouping key that collides with a real number.
 *
 * Order matters:
 *  - explicit international (`+` / `00`) is parsed as-is, any country;
 *  - bare digits that already carry a known country code (32/33/1) are read as
 *    international IRRESPECTIVE of the tenant country — a BE transport number
 *    must not be re-interpreted through a FR tenant (and vice versa);
 *  - everything else is read as national in the tenant country's context.
 *
 * `isPossible` rather than `isValid`: the old BE behaviour of turning a French
 * « 06… » national into +32 6… is preserved on purpose (historical data exists
 * in that shape), while short junk like « 12 » stays null.
 */
export function normalizeLeadPhone(raw: string | null | undefined, country?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || !/^\+?[\d\s.\-()]+$/.test(s)) return null;
  const candidateCountry = country?.trim().toUpperCase();
  const defaultCountry: CountryCode = candidateCountry && isSupportedCountry(candidateCountry) ? candidateCountry as CountryCode : 'BE';

  const tryIntl = (digits: string): string | null => {
    if (digits.length < 8 || digits.length > 15) return null;
    const pn = parsePhoneNumberFromString(`+${digits}`);
    return pn && pn.isPossible() ? pn.number : null;
  };

  if (s.startsWith('+')) return tryIntl(s.replace(/\D/g, ''));
  const compact = s.replace(/[\s.\-()]/g, '');
  if (/^\d+$/.test(compact)) {
    if (compact.startsWith('00')) return tryIntl(compact.slice(2));
    /* Bare digits already carrying a calling code: recognized on their own,
       whatever the tenant country. Without this, `32477012345` stored by a BE
       carrier would be re-read through a FR tenant and never dedup. */
    if ((compact.startsWith('32') || compact.startsWith('33') || compact.startsWith('1')) && compact.length >= 10 && compact.length <= 12) {
      const intl = tryIntl(compact);
      if (intl) return intl;
    }
    const pn = parsePhoneNumberFromString(compact, defaultCountry);
    return pn && pn.isPossible() ? pn.number : null;
  }
  /* Anything containing letters or other junk never becomes an identity. */
  return null;
}

/**
 * Grouping key for one call. `phone:<e164>` when a reliable number exists
 * (transport first, collected as fallback); `anon:<callId>` otherwise — a
 * per-call identity that never merges with anything.
 */
export function leadIdentityKey(call: LeadCallLike, country?: string | null): string {
  const transport = call.callerNumber ? normalizeLeadPhone(call.callerNumber, country) : null;
  if (transport) return `phone:${transport}`;
  if (call.callerNumber) return `anon:${call.id}`; // present but unparseable: do not guess
  const collected = call.phoneCollected ? normalizeLeadPhone(call.phoneCollected, country) : null;
  if (collected) return `phone:${collected}`;
  return `anon:${call.id}`;
}

function metadataOf(call: LeadCallLike): Record<string, unknown> {
  return typeof call.metadata === 'object' && call.metadata !== null
    ? (call.metadata as Record<string, unknown>)
    : {};
}

function isValidScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 10;
}

function isAnonymousName(name: string | null | undefined): boolean {
  if (!name) return true;
  return ANONYMOUS_NAMES.has(name.trim().toLowerCase());
}

/**
 * The manual status of a group: the most recent deliberate decision across
 * its calls. A `metadata.manualStatus` wins over a legacy status tag, and a
 * newer call that carries nothing NEVER resets an older manual decision —
 * the status lives at group level, not per call.
 */
export function resolveGroupStatus(calls: LeadCallLike[]): LeadStatus {
  const sorted = [...calls].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let decision: { status: LeadStatus; at: number } | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const manual = metadataOf(sorted[i]).manualStatus;
    if (
      typeof manual === 'object' && manual !== null &&
      typeof (manual as Record<string, unknown>).status === 'string' &&
      (LEAD_STATUSES as readonly string[]).includes((manual as Record<string, unknown>).status as string)
    ) {
      const fact = manual as Record<string, unknown>;
      const parsed = typeof fact.updatedAt === 'string' ? Date.parse(fact.updatedAt) : NaN;
      const at = Number.isFinite(parsed) ? parsed : sorted[i].createdAt.getTime();
      if (!decision || at > decision.at) decision = { status: fact.status as LeadStatus, at };
    }
  }
  if (decision) return decision.status;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const tag = (sorted[i].tags || []).find(t => (LEAD_STATUSES as readonly string[]).includes(t));
    if (tag) return tag as LeadStatus;
  }
  return 'new';
}

/**
 * Group lead calls by identity. `contacts` maps a normalized E.164 to a
 * Contact id; a row only gets a `contactId` on EXACT normalized equality.
 */
export function groupLeadCalls(
  calls: LeadCallLike[],
  country?: string | null,
  contacts?: ReadonlyMap<string, string>,
): LeadGroup[] {
  const buckets = new Map<string, LeadCallLike[]>();
  for (const call of calls) {
    const key = leadIdentityKey(call, country);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(call);
    else buckets.set(key, [call]);
  }

  const groups: LeadGroup[] = [];
  for (const [identityKey, members] of buckets) {
    const sorted = [...members].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const latest = sorted[sorted.length - 1];

    // Latest valid score wins — never an invented max.
    let leadScore: number | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const score = sorted[i].leadScore;
      if (typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 10) { leadScore = score; break; }
    }

    // Stable name: the most recent non-placeholder observation.
    let name: string | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const candidate = sorted[i].callerName || sorted[i].nameCollected;
      if (!isAnonymousName(candidate)) { name = candidate as string; break; }
    }

    const tags: string[] = [];
    for (const m of sorted) for (const t of m.tags || []) if (!tags.includes(t)) tags.push(t);

    let notes: string | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const n = metadataOf(sorted[i]).clientNotes;
      if (typeof n === 'string') { notes = n; break; }
    }

    const first = sorted[0];
    const phone = identityKey.startsWith('phone:') ? identityKey.slice('phone:'.length) : null;
    const newestFirst = [...sorted].reverse();
    const callback = newestFirst.map(c => normalizeLeadPhone(c.phoneCollected, country)).find(Boolean) ?? phone;
    const email = newestFirst.find(c => c.emailCollected?.trim())?.emailCollected ?? null;

    groups.push({
      id: latest.id,
      identityKey,
      phone,
      phoneCollected: callback,
      name,
      email,
      summary: latest.summary || null,
      leadScore,
      status: resolveGroupStatus(sorted),
      tags,
      notes,
      bookingRequested: Boolean(latest.bookingRequested),
      bookingDetails: latest.bookingDetails || null,
      sentiment: latest.sentiment || null,
      durationSeconds: latest.durationSeconds ?? null,
      callIds: sorted.map(m => m.id),
      callCount: sorted.length,
      firstInteractionAt: first.createdAt,
      lastInteractionAt: latest.createdAt,
      contactId: phone && contacts?.has(phone) ? contacts.get(phone)! : null,
    });
  }

  // Most recent interaction first; the identity key breaks ties so the order
  // is fully deterministic.
  groups.sort((a, b) => {
    const diff = b.lastInteractionAt.getTime() - a.lastInteractionAt.getTime();
    return diff !== 0 ? diff : a.identityKey.localeCompare(b.identityKey);
  });
  return groups;
}

/** Clamp pagination BEFORE slicing; totals count groups globally. */
export function clampLeadPage(page?: number, limit?: number): { page: number; limit: number } {
  const p = !Number.isFinite(page) ? 1 : Math.max(1, Math.floor(page as number));
  const l = !Number.isFinite(limit) ? 20 : Math.max(1, Math.floor(limit as number));
  return { page: p, limit: Math.min(l, 100) };
}

/**
 * Does a group's identity number match the `?phone=` filter? Both the
 * national writing (tenant country) and the international one match; a number
 * from ANOTHER country with coincidentally similar digits does not, and
 * anonymous groups never match — no leakage into a filtered view.
 */
export function leadPhoneFilterMatches(
  identityPhone: string | null,
  filterRaw: string,
  country?: string | null,
): boolean {
  if (!identityPhone) return false;
  const filter = String(filterRaw || '').trim();
  if (!filter) return true;
  const identityDigits = identityPhone.replace(/\D/g, '');
  const filterDigits = filter.replace(/\D/g, '');
  /* A filter that is non-blank but carries NO digits (« abc », « + ») can only
     be a typo: matching everything would leak the whole book into a filtered
     view. Nothing matches it — anonymous groups included. */
  if (!filterDigits) return false;
  if (identityDigits === filterDigits) return true;
  const filterE164 = normalizeLeadPhone(filter, country);
  if (filterE164 && filterE164.replace(/\D/g, '') === identityDigits) return true;
  // National comparison only when the number really belongs to the tenant's
  // calling code — otherwise a FR number would « match » a BE national shape.
  const cc = country ? { BE: '32', FR: '33', US: '1' }[country.toUpperCase()] : undefined;
  if (cc && identityDigits.startsWith(cc)) {
    const national = `0${identityDigits.slice(cc.length)}`;
    if (filterDigits === national || filterDigits === identityDigits.slice(cc.length)) return true;
  }
  return false;
}
