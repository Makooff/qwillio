/**
 * GARDE DE SORTIE DU MODÈLE D'ANALYSE (20/09/2026).
 *
 * La sortie de `analyzeClientCallTranscript` était lueite aveuglément:
 * `JSON.parse(content)` rendu tel quel à la base. Un booléen en chaîne
 * (`"isLead": "true"`), un score hors échelle (`leadScore: 42`), une
 * énumération inconnue (`sentiment: "happy"`) passaient tels quels, et un
 * échec HTTP tombait dans un repli qui affirmait `leadScore: 3` — un score
 * inventé pour une analyse qui n'avait pas eu lieu.
 *
 * Ce module est PUR: aucune dépendance, aucun état. Chaque champ est validé
 * indépendamment, avec une valeur neutre bornée quand le modèle dévie:
 *   - booléens stricts: tout non-booléen vaut `false`;
 *   - score borné 0..10, entier, ou `null` — JAMAIS un score affirmé sans
 *     analyse;
 *   - énumérations par liste blanche, avec valeur neutre en repli;
 *   - tableaux filtrés (chaînes non vides) et bornés;
 *   - chaînes tronquées à une longueur raisonnable.
 */

const SENTIMENTS = new Set(['positive', 'neutral', 'negative']);
const OUTCOMES = new Set([
  'booking_made', 'info_provided', 'message_taken', 'transferred',
  'complaint', 'missed', 'other',
]);

export const LEAD_SCORE_MIN = 0;
export const LEAD_SCORE_MAX = 10;
export const MAX_TAGS = 10;
export const MAX_UNANSWERED_QUESTIONS = 3;

const LIMITS = {
  callerName: 200,
  email: 320,
  summary: 2000,
  bookingDate: 40,
  bookingTime: 40,
  bookingDetails: 1000,
  serviceType: 200,
  specialRequests: 1000,
} as const;

export interface SanitizedCallAnalysis {
  callerName: string | null;
  emailCollected: string | null;
  sentiment: string;
  outcome: string;
  summary: string;
  bookingRequested: boolean;
  bookingDate: string | null;
  bookingTime: string | null;
  bookingDetails: string | null;
  serviceType: string | null;
  partySize: number | null;
  specialRequests: string | null;
  isLead: boolean;
  leadScore: number | null;
  tags: string[];
  callbackPromised: boolean;
  unansweredQuestions: string[];
  /** Observées telles quelles: elles ont leur propre validateur en aval. */
  learningBehaviour?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Booléen strict: un « "true" », un 1 ou un « yes » ne sont pas un booléen. */
export function toStrictBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

/**
 * Score borné 0..10 ENTIER, ou null. Un 42 hors échelle, un NaN, une chaîne
 * ou null valent tous ABSENCE de score — l'UI porte l'échelle /10 et la base
 * ne doit jamais écrire un score que personne n'a produit.
 */
export function toLeadScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < LEAD_SCORE_MIN || value > LEAD_SCORE_MAX) return null;
  return Math.trunc(value);
}

function toBoundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function toEnum(value: unknown, allowed: Set<string>, fallback: string): string {
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}

/** Tableau de chaînes non vides, borné. Les parasites sont filtrés. */
function toStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * RELIRE LA SORTIE DU MODÈLE avant qu'elle ne touche la base.
 * `raw` est le résultat de `JSON.parse`: n'importe quoi peut y être.
 */
export function sanitizeAnalysisOutput(raw: unknown): SanitizedCallAnalysis {
  const source = isRecord(raw) ? raw : {};
  return {
    callerName: toBoundedString(source.callerName, LIMITS.callerName),
    emailCollected: toBoundedString(source.emailCollected, LIMITS.email),
    sentiment: toEnum(source.sentiment, SENTIMENTS, 'neutral'),
    outcome: toEnum(source.outcome, OUTCOMES, 'other'),
    summary: toBoundedString(source.summary, LIMITS.summary) ?? '',
    bookingRequested: toStrictBoolean(source.bookingRequested),
    bookingDate: toBoundedString(source.bookingDate, LIMITS.bookingDate),
    bookingTime: toBoundedString(source.bookingTime, LIMITS.bookingTime),
    bookingDetails: toBoundedString(source.bookingDetails, LIMITS.bookingDetails),
    serviceType: toBoundedString(source.serviceType, LIMITS.serviceType),
    partySize: (typeof source.partySize === 'number' && Number.isFinite(source.partySize) && source.partySize > 0)
      ? Math.trunc(source.partySize)
      : null,
    specialRequests: toBoundedString(source.specialRequests, LIMITS.specialRequests),
    isLead: toStrictBoolean(source.isLead),
    leadScore: toLeadScore(source.leadScore),
    tags: toStringArray(source.tags, MAX_TAGS),
    callbackPromised: toStrictBoolean(source.callbackPromised),
    unansweredQuestions: toStringArray(source.unansweredQuestions, MAX_UNANSWERED_QUESTIONS),
    learningBehaviour: source.learningBehaviour,
  };
}
