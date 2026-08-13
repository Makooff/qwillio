/**
 * Ce que la loi autorise, par pays, avant de composer un numéro.
 *
 * Le moteur sortant ne connaissait qu'une règle, mondiale: « pas d'opt-out
 * enregistré ». Depuis le **11 août 2026** cette règle est illégale en France,
 * et elle reste correcte en Belgique: une règle unique serait donc soit
 * illégale d'un côté, soit inutilement bridée de l'autre. D'où ce module, qui
 * répond à trois questions distinctes pour un pays donné.
 *
 * Sources et raisonnement détaillés: `docs/ETAT-DE-LART-2026.md` §1.
 */

export type OutboundCountry = 'FR' | 'BE' | 'US';

/** Fenêtre locale autorisée, en heures pleines [début, fin[. */
interface Window {
  startHour: number;
  endHour: number;
}

interface CountryRule {
  timeZone: string;
  /** Le consentement préalable est-il obligatoire pour appeler ? */
  requiresPriorConsent: boolean;
  /** Jours de la semaine autorisés (0 = dimanche, comme `Date.getDay`). */
  allowedWeekdays: number[];
  windows: Window[];
  /** Interdiction d'appeler les jours fériés. */
  excludesPublicHolidays: boolean;
  /** Plafond de sollicitations du même prospect par le même professionnel. */
  maxCallsPerMonth: number | null;
  /** Délai de carence après un refus exprimé pendant l'appel, en jours. */
  cooldownAfterRefusalDays: number | null;
}

export const COUNTRY_RULES: Record<OutboundCountry, CountryRule> = {
  /**
   * France — loi n° 2025-594, applicable depuis le 11/08/2026 (fin de Bloctel,
   * bascule opt-out → opt-in), et décret n° 2022-1313 pour les jours et
   * horaires, en vigueur depuis le 01/03/2023.
   */
  FR: {
    timeZone: 'Europe/Paris',
    requiresPriorConsent: true,
    allowedWeekdays: [1, 2, 3, 4, 5],
    // La coupure de midi fait partie du décret: elle n'est pas une commodité.
    windows: [{ startHour: 10, endHour: 13 }, { startHour: 14, endHour: 20 }],
    excludesPublicHolidays: true,
    maxCallsPerMonth: 4,
    cooldownAfterRefusalDays: 60,
  },

  /**
   * Belgique — le régime reste l'OPT-OUT: appel autorisé sauf inscription sur
   * la liste « Ne m'appelez plus ! ». Les deux pays ont donc divergé le
   * 11/08/2026.
   *
   * ⚠️ Les bornes horaires ci-dessous sont un choix PRUDENT de notre part, pas
   * la transcription d'un décret belge équivalent au décret français. Elles
   * sont volontairement plus étroites que ce que la loi belge impose, pour que
   * l'erreur, s'il y en a une, soit du côté de la retenue. À confirmer par un
   * juriste avant tout élargissement.
   */
  BE: {
    timeZone: 'Europe/Brussels',
    requiresPriorConsent: false,
    allowedWeekdays: [1, 2, 3, 4, 5],
    windows: [{ startHour: 9, endHour: 20 }],
    excludesPublicHolidays: true,
    maxCallsPerMonth: null,
    cooldownAfterRefusalDays: null,
  },

  /** États-Unis — hors périmètre de l'analyse UE, comportement historique. */
  US: {
    timeZone: 'America/New_York',
    requiresPriorConsent: false,
    allowedWeekdays: [1, 2, 3, 4, 5],
    windows: [{ startHour: 9, endHour: 20 }],
    excludesPublicHolidays: false,
    maxCallsPerMonth: null,
    cooldownAfterRefusalDays: null,
  },
};

export function isSupportedCountry(country: string | null | undefined): country is OutboundCountry {
  return country === 'FR' || country === 'BE' || country === 'US';
}

export function requiresPriorConsent(country: string | null | undefined): boolean {
  // Un pays inconnu est traité comme exigeant le consentement: on ne compose
  // pas un numéro dont on ne sait pas quelle loi le protège.
  if (!isSupportedCountry(country)) return true;
  return COUNTRY_RULES[country].requiresPriorConsent;
}

/**
 * Dimanche de Pâques (Meeus/Jones/Butcher). Trois fériés français et belges en
 * dépendent, et ils se déplacent chaque année: les coder en dur condamnerait
 * la table à devenir fausse au 1er janvier suivant.
 */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const addDays = (month: number, day: number, year: number, offset: number) => {
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** Jours fériés légaux, au format `MM-JJ`, pour l'année considérée. */
export function publicHolidays(country: OutboundCountry, year: number): Set<string> {
  if (country === 'US') return new Set();

  const easter = easterSunday(year);
  const common = [
    '01-01', // Jour de l'an
    '05-01', // Fête du Travail
    '07-14', // (FR) Fête nationale — ignoré côté BE ci-dessous
    '08-15', // Assomption
    '11-01', // Toussaint
    '12-25', // Noël
    addDays(easter.month, easter.day, year, 1),  // Lundi de Pâques
    addDays(easter.month, easter.day, year, 39), // Ascension
    addDays(easter.month, easter.day, year, 50), // Lundi de Pentecôte
  ];

  if (country === 'FR') {
    return new Set([...common, '05-08', '11-11']); // Victoire 1945, Armistice
  }
  // Belgique: pas de 14 juillet, mais fête nationale le 21 juillet et
  // Armistice le 11 novembre.
  return new Set([...common.filter(d => d !== '07-14'), '07-21', '11-11']);
}

/** Date et heure LOCALES du pays, extraites sans dépendance externe. */
function localParts(at: Date, timeZone: string): { weekday: number; hour: number; monthDay: string; year: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map(p => [p.type, p.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdays[parts.weekday as string] ?? 0,
    // `hour12: false` rend minuit sous la forme « 24 » sur certains runtimes.
    hour: Number(parts.hour) % 24,
    monthDay: `${parts.month}-${parts.day}`,
    year: Number(parts.year),
  };
}

export interface WindowVerdict {
  allowed: boolean;
  /** Motif du refus, destiné aux logs — jamais affiché à un appelant. */
  reason?: 'weekend' | 'public_holiday' | 'outside_hours' | 'unknown_country';
}

/**
 * Peut-on composer MAINTENANT, au regard des jours et horaires ?
 *
 * `hasConsent` n'est pas un détail de confort: le décret français prévoit
 * explicitement que l'encadrement des jours et horaires **ne s'applique pas**
 * lorsque le consommateur a donné son consentement exprès et préalable. Un
 * prospect qui a demandé à être rappelé peut donc l'être hors fenêtre.
 */
export function isWithinCallingWindow(
  country: string | null | undefined,
  at: Date,
  hasConsent = false,
): WindowVerdict {
  if (!isSupportedCountry(country)) return { allowed: false, reason: 'unknown_country' };
  const rule = COUNTRY_RULES[country];

  if (hasConsent && country === 'FR') return { allowed: true };

  const { weekday, hour, monthDay, year } = localParts(at, rule.timeZone);

  if (!rule.allowedWeekdays.includes(weekday)) return { allowed: false, reason: 'weekend' };
  if (rule.excludesPublicHolidays && publicHolidays(country, year).has(monthDay)) {
    return { allowed: false, reason: 'public_holiday' };
  }
  const inWindow = rule.windows.some(w => hour >= w.startHour && hour < w.endHour);
  return inWindow ? { allowed: true } : { allowed: false, reason: 'outside_hours' };
}

/** Plafond mensuel de sollicitations, `null` si le pays n'en fixe pas. */
export function maxCallsPerMonth(country: string | null | undefined): number | null {
  if (!isSupportedCountry(country)) return null;
  return COUNTRY_RULES[country].maxCallsPerMonth;
}
