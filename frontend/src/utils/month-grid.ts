/**
 * La grille d'un mois, semaine du LUNDI, pour le calendrier des rendez-vous.
 *
 * Tout est calculé dans le fuseau du navigateur, comme `dayLabel` sur la
 * page: un rendez-vous stocké à minuit Bruxelles s'affiche le jour où le
 * gérant le vit. Les cases hors du mois sont gardées pour que la grille
 * soit toujours faite de semaines entières.
 */

export interface DayCell {
  /** YYYY-MM-DD, la clé de regroupement. */
  iso: string;
  /** Le numéro du jour, sans zéro. */
  day: number;
  inMonth: boolean;
  isToday: boolean;
  /** 0 = lundi … 6 = dimanche. */
  weekday: number;
}

export const WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** YYYY-MM-DD dans le fuseau local, sans passer par l'UTC qui décale d'un jour le soir. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** « Septembre 2026 », majuscule au mois. */
export function monthLabel(d: Date): string {
  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Les bornes du mois, en YYYY-MM-DD, pour la requête. */
export function monthRange(d: Date): { from: string; to: string } {
  const first = firstOfMonth(d);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: isoDay(first), to: isoDay(last) };
}

export function monthGrid(month: Date, today = new Date()): DayCell[] {
  const first = firstOfMonth(month);
  /* getDay(): 0 = dimanche. On veut lundi en tête. */
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead);
  const todayIso = isoDay(today);
  const cells: DayCell[] = [];
  /* Autant de semaines qu'il faut pour couvrir le mois, jamais plus. */
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = isoDay(d);
    cells.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === first.getMonth(),
      isToday: iso === todayIso,
      weekday: i % 7,
    });
  }
  return cells;
}

/** « Mardi 15 septembre », majuscule au jour seulement. */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return '';
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
