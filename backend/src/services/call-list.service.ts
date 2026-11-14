import { prisma } from '../config/database';

/**
 * La liste d'appels du fondateur, et le journal de ce qui en sort.
 *
 * Deux choses distinctes vivent ici et il ne faut pas les confondre :
 *
 *   - LA LISTE : les fiches qu'il a choisies d'appeler (`Prospect.callListAt`).
 *     Elle se vide à la main, ou toute seule quand l'issue clôt la fiche.
 *   - LE JOURNAL : une ligne par appel passé (`ProspectCallLog`). Il ne se vide
 *     jamais : c'est la seule matière qui réponde à « qu'est-ce qui marche ».
 *
 * Aucun audio n'est enregistré. Le fondateur appelle depuis son propre
 * téléphone ; ce qui est consigné, c'est l'issue qu'il choisit et ce qu'il note.
 */

export const OUTCOMES = [
  'no_answer', 'voicemail', 'callback', 'refused', 'interested', 'meeting', 'wrong_number', 'do_not_call',
] as const;
export type Outcome = typeof OUTCOMES[number];

export const OBJECTIONS = [
  'already_handled', 'anti_ai', 'too_expensive', 'no_time', 'not_interested', 'other',
] as const;
export type Objection = typeof OBJECTIONS[number];

/** Quelqu'un a décroché et a parlé. Tout le reste est un appel dans le vide. */
const REACHED = new Set<Outcome>(['callback', 'refused', 'interested', 'meeting', 'do_not_call']);

/** Les issues qui sortent la fiche de la liste : il n'y a plus rien à y faire par téléphone. */
const CLOSES = new Set<Outcome>(['refused', 'meeting', 'wrong_number', 'do_not_call']);

/** Le statut que l'issue donne à la fiche. `null` : l'issue ne dit rien du statut. */
const STATUS_AFTER: Partial<Record<Outcome, string>> = {
  interested: 'interested',
  meeting: 'qualified',
  refused: 'rejected',
  do_not_call: 'rejected',
};

export function isOutcome(value: unknown): value is Outcome {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value);
}
export function isObjection(value: unknown): value is Objection {
  return typeof value === 'string' && (OBJECTIONS as readonly string[]).includes(value);
}

// ── Les chiffres ─────────────────────────────────────────────────────────────

export interface LogForStats {
  outcome: string;
  objection: string | null;
  createdAt: Date;
  niche: string | null;
}

export interface CallStats {
  calls: number;
  reached: number;
  meetings: number;
  /** Part des appels où quelqu'un a décroché, de 0 à 1. `null` sans appel. */
  reachRate: number | null;
  /** Part des appels qui finissent en rendez-vous. C'est le chiffre qui décide de tout. */
  meetingRate: number | null;
  byOutcome: Array<{ key: string; count: number }>;
  byObjection: Array<{ key: string; count: number }>;
  byWindow: Array<{ key: string; calls: number; reached: number; meetings: number }>;
  byNiche: Array<{ key: string; calls: number; reached: number; meetings: number }>;
}

/**
 * Les fenêtres du playbook : la camionnette, la pause, la fin de journée, et
 * le reste. Elles sont comptées dans le fuseau du COMMERCE appelé, pas dans
 * celui du serveur, qui tourne en UTC : un appel de 7 h 45 à Bruxelles serait
 * sinon rangé dans la nuit.
 */
const WINDOWS: Array<{ key: string; from: number; to: number }> = [
  { key: '07-09', from: 7, to: 9 },
  { key: '09-12', from: 9, to: 12 },
  { key: '12-14', from: 12, to: 14 },
  { key: '14-17', from: 14, to: 17 },
  { key: '17-19', from: 17, to: 19 },
];

function hourIn(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(date);
  return Number(hour);
}

function tally<T extends { calls: number; reached: number; meetings: number }>(row: T, outcome: string): void {
  row.calls += 1;
  if (REACHED.has(outcome as Outcome)) row.reached += 1;
  if (outcome === 'meeting') row.meetings += 1;
}

/** Pur : des lignes en entrée, des comptes en sortie. Testé sans base. */
export function computeStats(logs: LogForStats[], timeZone = 'Europe/Brussels'): CallStats {
  const outcomes = new Map<string, number>();
  const objections = new Map<string, number>();
  const windows = new Map(WINDOWS.map(w => [w.key, { key: w.key, calls: 0, reached: 0, meetings: 0 }]));
  const autres = { key: 'autre', calls: 0, reached: 0, meetings: 0 };
  const niches = new Map<string, { key: string; calls: number; reached: number; meetings: number }>();
  const total = { calls: 0, reached: 0, meetings: 0 };

  for (const log of logs) {
    tally(total, log.outcome);
    outcomes.set(log.outcome, (outcomes.get(log.outcome) ?? 0) + 1);
    if (log.objection) objections.set(log.objection, (objections.get(log.objection) ?? 0) + 1);

    const hour = hourIn(log.createdAt, timeZone);
    const slot = WINDOWS.find(w => hour >= w.from && hour < w.to);
    tally(slot ? windows.get(slot.key)! : autres, log.outcome);

    const niche = log.niche || 'inconnu';
    if (!niches.has(niche)) niches.set(niche, { key: niche, calls: 0, reached: 0, meetings: 0 });
    tally(niches.get(niche)!, log.outcome);
  }

  const sorted = (m: Map<string, number>) => [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

  return {
    calls: total.calls,
    reached: total.reached,
    meetings: total.meetings,
    reachRate: total.calls ? total.reached / total.calls : null,
    meetingRate: total.calls ? total.meetings / total.calls : null,
    byOutcome: sorted(outcomes),
    byObjection: sorted(objections),
    byWindow: [...windows.values(), ...(autres.calls ? [autres] : [])],
    byNiche: [...niches.values()].sort((a, b) => b.calls - a.calls),
  };
}

// ── La base ──────────────────────────────────────────────────────────────────

const LIST_FIELDS = {
  id: true, businessName: true, niche: true, city: true, phone: true, email: true, website: true,
  googleRating: true, googleReviewsCount: true, status: true, notes: true, callAttempts: true,
  lastContactDate: true, nextActionDate: true, callListAt: true, callOptedOut: true,
} as const;

export interface LogInput {
  outcome: unknown;
  objection?: unknown;
  note?: unknown;
  callbackAt?: unknown;
}

export type LogResult =
  | { ok: true; log: { id: string; outcome: string; objection: string | null; note: string | null; callbackAt: Date | null; createdAt: Date }; removedFromList: boolean }
  | { ok: false; status: 400 | 404; error: 'unknown_prospect' | 'invalid_outcome' | 'invalid_callback' };

class CallListService {
  /** Les fiches à appeler : les rappels dus d'abord, puis dans l'ordre d'ajout. */
  async list() {
    const prospects = await prisma.prospect.findMany({
      where: { callListAt: { not: null } },
      select: {
        ...LIST_FIELDS,
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { outcome: true, objection: true, note: true, callbackAt: true, createdAt: true },
        },
        _count: { select: { callLogs: true } },
      },
      orderBy: [{ nextActionDate: { sort: 'asc', nulls: 'last' } }, { callListAt: 'asc' }],
      take: 300,
    });

    return prospects.map(({ callLogs, _count, ...p }) => ({
      ...p,
      lastLog: callLogs[0] ?? null,
      logCount: _count.callLogs,
    }));
  }

  async setInList(prospectId: string, inList: boolean) {
    const found = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true, callListAt: true } });
    if (!found) return null;
    // Ré-ajouter une fiche déjà présente ne la renvoie pas en fin de liste.
    if (inList && found.callListAt) return { id: found.id, callListAt: found.callListAt };
    return prisma.prospect.update({
      where: { id: prospectId },
      data: { callListAt: inList ? new Date() : null },
      select: { id: true, callListAt: true },
    });
  }

  async logs(prospectId: string) {
    return prisma.prospectCallLog.findMany({
      where: { prospectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, outcome: true, objection: true, note: true, callbackAt: true, createdAt: true },
    });
  }

  /**
   * Consigne un appel et met la fiche à jour dans la MÊME transaction : une
   * ligne de journal sans le compteur d'appels, ou l'inverse, ferait mentir
   * l'un des deux écrans.
   */
  async log(prospectId: string, userId: string | null, input: LogInput): Promise<LogResult> {
    if (!isOutcome(input.outcome)) return { ok: false, status: 400, error: 'invalid_outcome' };
    const outcome = input.outcome;

    let callbackAt: Date | null = null;
    if (outcome === 'callback' && input.callbackAt) {
      const parsed = new Date(String(input.callbackAt));
      if (Number.isNaN(parsed.getTime())) return { ok: false, status: 400, error: 'invalid_callback' };
      callbackAt = parsed;
    }

    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true, status: true } });
    if (!prospect) return { ok: false, status: 404, error: 'unknown_prospect' };

    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 4000) : null;
    const objection = outcome === 'refused' && isObjection(input.objection) ? input.objection : null;
    const closes = CLOSES.has(outcome);
    const now = new Date();

    /* Un statut ne recule jamais : une fiche déjà « convertie » ne redevient
       pas « contactée » parce qu'on l'a rappelée pour autre chose. */
    const settled = ['converted', 'qualified'].includes(prospect.status);
    const nextStatus = settled
      ? prospect.status
      : STATUS_AFTER[outcome] ?? (prospect.status === 'new' ? 'contacted' : prospect.status);

    const [log] = await prisma.$transaction([
      prisma.prospectCallLog.create({
        data: { prospectId, userId, outcome, objection, note, callbackAt },
        select: { id: true, outcome: true, objection: true, note: true, callbackAt: true, createdAt: true },
      }),
      prisma.prospect.update({
        where: { id: prospectId },
        data: {
          status: nextStatus,
          lastContactDate: now,
          callAttempts: { increment: 1 },
          nextActionDate: outcome === 'callback' ? callbackAt : null,
          ...(closes ? { callListAt: null } : {}),
          /* « Ne me rappelez plus » est une opposition : elle se garde pour
             toujours et ferme aussi le moteur d'appels automatiques. */
          ...(outcome === 'do_not_call'
            ? { callOptedOut: true, callOptedOutAt: now, callOptOutSource: 'manual', eligibleForCall: false }
            : {}),
        },
      }),
    ]);

    return { ok: true, log, removedFromList: closes };
  }

  async stats(days: number): Promise<CallStats & { days: number }> {
    const span = Math.min(Math.max(Math.round(days) || 30, 1), 365);
    const since = new Date(Date.now() - span * 24 * 60 * 60 * 1000);
    const rows = await prisma.prospectCallLog.findMany({
      where: { createdAt: { gte: since } },
      select: { outcome: true, objection: true, createdAt: true, prospect: { select: { niche: true } } },
      take: 20000,
    });
    return {
      days: span,
      ...computeStats(rows.map(r => ({ outcome: r.outcome, objection: r.objection, createdAt: r.createdAt, niche: r.prospect?.niche ?? null }))),
    };
  }
}

export const callListService = new CallListService();
