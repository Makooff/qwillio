import { detectTimezone } from '../config/scheduling';

/**
 * L'heure d'un rendez-vous se lit dans le FUSEAU DE L'ENTREPRISE, jamais
 * dans celui du serveur.
 *
 * Relevé le 12/09/2026 sur un appel réel: « neuf heures » demandé, rendez-vous
 * posé à 15 h dans l'agenda. Six heures d'écart, c'est exactement New York →
 * Bruxelles: l'agenda et les créneaux libres faisaient `setHours(9)` sur une
 * `Date`, c'est-à-dire 9 h dans le fuseau du PROCESSUS, puis envoyaient
 * l'instant à Google. Le client belge recevait un rendez-vous américain, et
 * la liste des créneaux libres, calculée de la même façon, comparait des
 * heures qui n'étaient pas les siennes.
 *
 * Aucune bibliothèque de fuseaux dans le dépôt: `Intl` suffit. L'instant est
 * cherché par itération, ce qui absorbe les changements d'heure.
 */
export function zonedInstant(ymd: string, hhmm: string, timezone: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  // Première estimation: comme si le fuseau était UTC.
  let guess = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  /* Deux passes: la première corrige du décalage courant, la seconde rattrape
     le cas où l'estimation tombait de l'autre côté d'un changement d'heure. */
  for (let i = 0; i < 2; i++) {
    const wall = wallClock(new Date(guess), timezone);
    const wantMinutes = Date.UTC(y, mo - 1, d, h, mi) / 60000;
    guess -= (wall - wantMinutes) * 60000;
  }
  return new Date(guess);
}

/** L'heure murale de `date` dans `timezone`, en minutes depuis l'époque « comme si UTC ». */
function wallClock(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0');
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) / 60000;
}

/** `YYYY-MM-DD` d'un jour stocké à midi UTC (`parseDate`), sans passer par le fuseau du serveur. */
export function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * LE fuseau d'une entreprise. Une seule règle, pour l'agenda, les créneaux et
 * le profil d'appel: deux règles écrites à la main divergent (6vicies), et
 * elles avaient divergé, le profil disant « Europe/Paris » quand l'agenda
 * disait « Europe/Brussels » ou « America/New_York ».
 */
export function businessTimezone(client: {
  onboardingData?: unknown;
  country?: string | null;
  city?: string | null;
  agentLanguage?: string | null;
}): string {
  const onboarding = (client.onboardingData && typeof client.onboardingData === 'object'
    ? client.onboardingData
    : {}) as { timezone?: unknown };
  if (typeof onboarding.timezone === 'string' && onboarding.timezone.trim()) return onboarding.timezone.trim();
  const country = String(client.country ?? '').toUpperCase();
  if (country) return detectTimezone(client.city ?? null, country);
  return client.agentLanguage === 'fr' || client.agentLanguage === 'nl' ? 'Europe/Brussels' : 'America/New_York';
}
