import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { isPlaceholderName } from '../../utils/spelled-name';

export type IdentitySource = 'analysis' | 'capture' | 'confirmed';
export interface MemoryFact { value: string; source: IdentitySource; at: string; callId: string | null }
export interface MemoryRequest { text: string; callbackWhen: string | null; forPerson: string | null; at: string; callId: string | null }
export interface MemoryEnvelope {
  version: 1;
  identity: { name: MemoryFact | null; email: MemoryFact | null };
  /** Une demande d'appel reste ouverte jusqu'à satisfaction; 30 jours à la vue. */
  engagements: { openRequests: MemoryRequest[] };
  /** Le numéro de rappel dicté est un fait contact, jamais une clé d'écriture. */
  contact: { callbackNumber: MemoryFact | null };
  meta: { lastCallId: string | null; completedCalls: string[]; preferencesAt: string | null; summaryAt: string | null; summaryCallId: string | null;
    /* Marqueur d'effacement de l'identité de test: tout fait capturé AVANT
       cette borne n'est plus servi, même confirmé, et ne peut pas être
       rafraîchi par un événement retardé arrivé après. Les appels et les
       réservations ne sont pas touchés: seule la mémoire d'appelant porte
       la borne. */
    identityResetAt: string | null };
}
/** Un fait 'analysis' non confirmé périme: servir un nom d'il y a 6 mois fabule des erreurs. */
export const MEMORY_FACT_TTL_DAYS = 90;
/** Une demande ouverte de plus d'un mois a été traitée ou oubliée par l'appelant. */
export const MEMORY_REQUEST_TTL_DAYS = 30;
export interface CallerMemoryInput {
  clientId: string; callerNumber: string | null;
  name?: string | null; email?: string | null; summary?: string | null; outcome?: string | null;
  preferences?: string[]; removePreferences?: string[];
  callId?: string; phase?: 'capture' | 'completed'; identitySource?: IdentitySource;
  occurredAt?: Date; callbackNumber?: string | null;
  request?: { text: string; callbackWhen?: string | null; forPerson?: string | null };
}
export const memoryObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function memoryText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || null;
}
export function canonicalCallerNumber(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  const raw = value.trim().replace(/[\s().-]/g, '');
  const digits = raw.startsWith('00') ? raw.slice(2) : raw.replace(/^\+/, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  const phone = parsePhoneNumberFromString(`+${digits}`);
  return phone?.country && phone.isValid() ? phone.number.slice(1) : null;
}
export function memoryTimestamp(value: unknown, now = new Date()): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time > now.getTime()) return null;
  const canonical = new Date(time).toISOString();
  return canonical === value.replace(/(?<!\.\d{3})Z$/, '.000Z') ? canonical : null;
}
export function readMemoryFact(value: unknown, now = new Date()): MemoryFact | null {
  const f = memoryObject(value);
  if (!['analysis', 'capture', 'confirmed'].includes(String(f.source))) return null;
  const text = memoryText(f.value, 255);
  const at = memoryTimestamp(f.at, now);
  return text && at ? { value: text, at, source: f.source as IdentitySource, callId: memoryText(f.callId, 255) } : null;
}
export function memoryEnvelope(value: unknown, now = new Date()): MemoryEnvelope {
  const e = memoryObject(value);
  const active = e.version === 1 ? e : {};
  const identity = memoryObject(active.identity);
  const engagements = memoryObject(active.engagements);
  const contact = memoryObject(active.contact);
  const meta = memoryObject(active.meta);
  return {
    version: 1,
    identity: { name: readMemoryFact(identity.name, now), email: readMemoryFact(identity.email, now) },
    engagements: {
      openRequests: Array.isArray(engagements.openRequests)
        ? engagements.openRequests.slice(0, 20).flatMap(r => readMemoryRequest(r, now) ?? []) : [],
    },
    contact: { callbackNumber: readMemoryFact(contact.callbackNumber, now) },
    meta: {
      lastCallId: memoryText(meta.lastCallId, 255),
      completedCalls: Array.isArray(meta.completedCalls) ? [...new Set(meta.completedCalls.flatMap(v => memoryText(v, 255) ?? []))].slice(-128) : [],
      preferencesAt: memoryTimestamp(meta.preferencesAt, now), summaryAt: memoryTimestamp(meta.summaryAt, now),
      summaryCallId: memoryText(meta.summaryCallId, 255),
      identityResetAt: memoryTimestamp(meta.identityResetAt, now),
    },
  };
}
export function readMemoryRequest(value: unknown, now = new Date()): MemoryRequest | null {
  const r = memoryObject(value);
  const text = memoryText(r.text, 200);
  const at = memoryTimestamp(r.at, now);
  if (!text || !at) return null;
  return {
    text, at,
    callbackWhen: memoryText(r.callbackWhen, 120),
    forPerson: memoryText(r.forPerson, 120),
    callId: memoryText(r.callId, 255),
  };
}
/** Un fait confirmé/capture est durable; 'analysis' seulement TTL. */
export function isFactStale(fact: MemoryFact | null, now: Date): boolean {
  if (!fact) return false;
  if (fact.source !== 'analysis') return false;
  return now.getTime() - Date.parse(fact.at) > MEMORY_FACT_TTL_DAYS * 24 * 60 * 60 * 1000;
}
export function isRequestStale(request: MemoryRequest, now: Date): boolean {
  return now.getTime() - Date.parse(request.at) > MEMORY_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000;
}
export function validMemoryName(value: unknown): string | null {
  const name = memoryText(value, 120);
  return name && !isPlaceholderName(name) ? name : null;
}
export function validMemoryEmail(value: unknown): string | null {
  const email = memoryText(value, 255)?.toLowerCase() ?? null;
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}
export function mergeIdentityFact(previous: MemoryFact | null, value: string | null, input: CallerMemoryInput, at: Date): MemoryFact | null {
  if (!value) return previous;
  const source = input.identitySource ?? 'analysis';
  const rank = { analysis: 0, capture: 1, confirmed: 2 };
  if (previous && (Date.parse(previous.at) > at.getTime() || rank[previous.source] > rank[source])) return previous;
  return { value, source, at: at.toISOString(), callId: memoryText(input.callId, 255) };
}
export function callerMemoryView(value: unknown, _now = new Date()) {
  const row = memoryObject(value);
  const now = _now instanceof Date && Number.isFinite(_now.getTime()) ? _now : new Date();
  const facts = memoryEnvelope(row.facts, now);
  const rawEnvelope = memoryObject(row.facts);
  const rawIdentity = rawEnvelope.version === 1 ? memoryObject(rawEnvelope.identity) : {};
  const isBlocked = row.isBlocked === true;
  // Fait servi: null s'il n'existe pas OU s'il est périmé. Ne pas retomber
  // sur row.knownName dans ce dernier cas — c'en est la copie dénormalisée.
  const resetAt = facts.meta.identityResetAt;
  const afterReset = (at: string | null | undefined) => !resetAt || (!!at && at > resetAt);
  const nameFact = afterReset(facts.identity.name?.at) ? facts.identity.name : null;
  const servedName = isFactStale(nameFact, now) ? null : nameFact;
  const emailFact = afterReset(facts.identity.email?.at) ? facts.identity.email : null;
  const servedEmail = isFactStale(emailFact, now) ? null : emailFact;
  const knownName = validMemoryName(servedName?.value ?? (!resetAt && rawIdentity.name == null ? row.knownName : null));
  const email = validMemoryEmail(servedEmail?.value ?? (!resetAt && rawIdentity.email == null ? row.email : null));
  const callbackFact = afterReset(facts.contact.callbackNumber?.at) ? facts.contact.callbackNumber : null;
  const openRequests = facts.engagements.openRequests
    .filter(r => afterReset(r.at) && !isRequestStale(r, now)).slice(0, 5)
    .map(({ text, callbackWhen, forPerson }) => ({ text, callbackWhen, forPerson }));
  return {
    knownName: isBlocked ? null : knownName,
    email: isBlocked ? null : email,
    identityResetAt: resetAt,
    profileSummary: isBlocked || !afterReset(facts.meta.summaryAt) ? null : memoryText(row.profileSummary ?? row.lastSummary, 600),
    preferences: isBlocked || !afterReset(facts.meta.preferencesAt) ? [] : Array.isArray(row.preferences)
      ? row.preferences.slice(0, 100).flatMap(p => memoryText(p, 120) ?? []).slice(0, 6) : [],
    openRequests: isBlocked ? [] : openRequests,
    callbackNumber: isBlocked || isFactStale(callbackFact, now) ? null : callbackFact?.value ?? null,
    isBlocked,
    identitySource: isBlocked ? null : servedName?.source ?? null,
  };
}
