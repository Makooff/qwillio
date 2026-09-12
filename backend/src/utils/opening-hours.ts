import { zonedInstant } from './zoned-time';

/**
 * Les horaires d'ouverture, tels que le portail les enregistre.
 *
 * Le portail écrit `onboardingData.hours` sous la forme
 * `{ monday: { open, from, to }, … }`. Avant ce fichier, le profil d'appel
 * lisait ce champ dans une chaîne (`Horaires: ${hours}`), ce qui donnait
 * « Horaires: [object Object] » dans le prompt, et l'agenda proposait 9 h-17 h
 * tous les jours, dimanche compris: un rendez-vous a été pris un dimanche
 * chez un commerce fermé le dimanche (appel réel, 12/09/2026).
 *
 * UNE lecture, partagée par le prompt (`describeHours`), les créneaux
 * (`dayWindow`) et la réservation.
 */
export const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export interface DayHours { open: boolean; from: string; to: string }
export type WeekHours = Partial<Record<WeekDay, DayHours>>;

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** L'objet du portail, ou `null` s'il n'a pas cette forme. */
export function parseWeekHours(raw: unknown): WeekHours | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: WeekHours = {};
  for (const day of WEEK_DAYS) {
    const d = (raw as Record<string, unknown>)[day];
    if (!d || typeof d !== 'object') continue;
    const { open, from, to } = d as Record<string, unknown>;
    if (typeof open !== 'boolean') continue;
    const validFrom = typeof from === 'string' && TIME.test(from) ? from : '09:00';
    const validTo = typeof to === 'string' && TIME.test(to) ? to : '18:00';
    out[day] = { open, from: validFrom, to: validTo };
  }
  return Object.keys(out).length ? out : null;
}

/** Le jour de semaine d'une date, dans le fuseau de l'entreprise. */
export function weekDayOf(ymd: string, timezone: string): WeekDay {
  const noon = zonedInstant(ymd, '12:00', timezone);
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(noon).toLowerCase();
  return (WEEK_DAYS as readonly string[]).includes(name) ? (name as WeekDay) : 'monday';
}

export type DayWindow = { open: false } | { open: true; from: string; to: string };

/**
 * La fenêtre d'ouverture d'un jour donné. Un jour absent des horaires est
 * tenu pour ouvert aux heures par défaut: l'absence d'information ne doit pas
 * fermer un commerce.
 */
export function dayWindow(hours: WeekHours | null, ymd: string, timezone: string): DayWindow {
  const day = hours?.[weekDayOf(ymd, timezone)];
  if (!day) return { open: true, from: '09:00', to: '17:00' };
  if (!day.open) return { open: false };
  return { open: true, from: day.from, to: day.to };
}

/** Le prochain jour ouvert STRICTEMENT après `ymd`, sur deux semaines, ou `null`. */
export function nextOpenDay(hours: WeekHours | null, ymd: string, timezone: string): string | null {
  let cursor = ymd;
  for (let i = 0; i < 14; i++) {
    cursor = addDays(cursor, 1);
    if (dayWindow(hours, cursor, timezone).open) return cursor;
  }
  return null;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days, 12));
  return next.toISOString().slice(0, 10);
}

export function minutesOf(hhmm: string): number | null {
  const m = hhmm.match(TIME);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const DAY_NAMES: Record<'fr' | 'en' | 'nl', string[]> = {
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  nl: ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'],
};

/**
 * Les horaires en une phrase pour le prompt: « lundi-vendredi 09:00-18:00,
 * samedi-dimanche fermé ». Les jours consécutifs au même réglage sont
 * regroupés, pour que la ligne reste courte dans un prompt qui compte.
 */
export function describeHours(hours: WeekHours, lang: 'fr' | 'en' | 'nl'): string {
  const names = DAY_NAMES[lang] ?? DAY_NAMES.en;
  const closed = { fr: 'fermé', en: 'closed', nl: 'gesloten' }[lang] ?? 'closed';
  const label = (day: WeekDay) => {
    const d = hours[day];
    if (!d) return null;
    return d.open ? `${d.from}-${d.to}` : closed;
  };
  const groups: Array<{ from: number; to: number; text: string }> = [];
  WEEK_DAYS.forEach((day, i) => {
    const text = label(day);
    if (text === null) return;
    const last = groups[groups.length - 1];
    if (last && last.text === text && last.to === i - 1) last.to = i;
    else groups.push({ from: i, to: i, text });
  });
  return groups
    .map(g => `${g.from === g.to ? names[g.from] : `${names[g.from]}-${names[g.to]}`} ${g.text}`)
    .join(', ');
}
