/**
 * « Mon téléphone d'abord » : les plages où le client veut décrocher lui-même.
 *
 * C'est le renvoi d'appel selon l'heure, vu de notre côté. Aucun réseau mobile
 * ne sait renvoyer « seulement le soir » : le client renvoie donc tous ses
 * appels vers Qwillio, et c'est Qwillio qui décide à l'arrivée. Dans la plage,
 * l'appel part vers son numéro de transfert sans conversation ; en dehors, la
 * réceptionniste décroche.
 *
 * Ce fichier est LA règle d'horaire. Le moteur vocal ne reçoit qu'un oui ou un
 * non (`humanFirstNow`) : deux calculs de plage, un de chaque côté du pont,
 * finiraient par ne plus tomber d'accord sur le fuseau ou sur minuit.
 */

export interface HumanFirstSchedule {
  enabled: boolean;
  /** Jours actifs, 0 = dimanche … 6 = samedi, comme `Date.getDay()`. */
  days: number[];
  /** Début et fin, « HH:MM », dans le fuseau du commerce. */
  from: string;
  to: string;
}

export const DEFAULT_HUMAN_FIRST: HumanFirstSchedule = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  from: '09:00',
  to: '17:00',
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Lit ce qui est stocké, et ne rend jamais une plage à moitié valide.
 *
 * Une heure illisible ou une liste de jours vide rend la plage ÉTEINTE plutôt
 * que réparée au hasard : une plage inventée détournerait des appels vers un
 * téléphone que personne n'attend de voir sonner.
 */
export function parseHumanFirst(raw: unknown): HumanFirstSchedule {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HUMAN_FIRST };
  const r = raw as Record<string, unknown>;
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const from = typeof r.from === 'string' && HHMM.test(r.from) ? r.from : '';
  const to = typeof r.to === 'string' && HHMM.test(r.to) ? r.to : '';
  const valid = days.length > 0 && !!from && !!to && from !== to;
  return {
    enabled: r.enabled === true && valid,
    days: days.length ? days : [...DEFAULT_HUMAN_FIRST.days],
    from: from || DEFAULT_HUMAN_FIRST.from,
    to: to || DEFAULT_HUMAN_FIRST.to,
  };
}

/** Le jour et l'heure MURALE dans le fuseau du commerce, quel que soit celui du serveur. */
function wallClock(now: Date, timeZone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/**
 * Sommes-nous, à cet instant, dans une plage où le client décroche lui-même ?
 *
 * Une plage qui passe minuit (22:00 → 06:00) appartient au jour où elle
 * COMMENCE : cochée le vendredi, elle couvre le vendredi soir et le samedi
 * avant 6 h. C'est ce que quelqu'un qui coche « vendredi » a en tête.
 *
 * Un fuseau illisible rend `false` : dans le doute la réceptionniste décroche,
 * ce qui coûte une conversation et jamais un appel perdu.
 */
export function humanFirstActive(raw: unknown, now: Date, timeZone: string): boolean {
  const schedule = parseHumanFirst(raw);
  if (!schedule.enabled) return false;

  let clock: { day: number; minute: number };
  try {
    clock = wallClock(now, timeZone);
  } catch {
    return false;
  }
  if (clock.day < 0 || Number.isNaN(clock.minute)) return false;

  const start = minutes(schedule.from);
  const end = minutes(schedule.to);

  if (start < end) {
    return schedule.days.includes(clock.day) && clock.minute >= start && clock.minute < end;
  }
  // La plage passe minuit : le soir du jour coché, ou le petit matin du lendemain.
  if (clock.minute >= start) return schedule.days.includes(clock.day);
  if (clock.minute < end) return schedule.days.includes((clock.day + 6) % 7);
  return false;
}
