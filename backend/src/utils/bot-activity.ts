/**
 * In-memory bot activity tracker — stores recent real actions for dashboard display
 */

export interface BotAction {
  message: string;
  timestamp: string;
}

interface ScheduledJob {
  name: string;
  cronExpr: string; // simplified for next-fire calculation
  intervalMs: number; // approximate interval for sorting
}

// All cron jobs with their approximate intervals (used to compute "next action")
const CRON_JOBS: ScheduledJob[] = [
  { name: 'Synchronisation CRM', cronExpr: '*/15 * * * *', intervalMs: 15 * 60_000 },
  { name: 'Validation téléphones Twilio', cronExpr: '*/10 * * * *', intervalMs: 10 * 60_000 },
  { name: 'Appel sortant prospect', cronExpr: '*/20 13-23 * * 1-5', intervalMs: 20 * 60_000 },
  { name: 'Nettoyage appels bloqués', cronExpr: '*/15 * * * *', intervalMs: 15 * 60_000 },
  { name: 'Traitement rappels & follow-ups', cronExpr: '0 * * * *', intervalMs: 60 * 60_000 },
  { name: 'Séquences follow-up email', cronExpr: '*/30 * * * *', intervalMs: 30 * 60_000 },
  { name: 'Facturation retards paiement', cronExpr: '15 * * * *', intervalMs: 60 * 60_000 },
  { name: 'Rappels rendez-vous clients', cronExpr: '30 * * * *', intervalMs: 60 * 60_000 },
  { name: 'Prospection quotidienne', cronExpr: '0 8 * * 1-5', intervalMs: 24 * 60 * 60_000 },
  { name: 'Scraping Google Maps Apify', cronExpr: '0 2 * * *', intervalMs: 24 * 60 * 60_000 },
  { name: 'Analyse A/B test scripts', cronExpr: '0 6 * * *', intervalMs: 24 * 60 * 60_000 },
  { name: 'Optimisation horaires d\'appel', cronExpr: '0 4 * * *', intervalMs: 24 * 60 * 60_000 },
  { name: 'Re-scoring prospects', cronExpr: '0 3 * * *', intervalMs: 24 * 60 * 60_000 },
  { name: 'Reset quota appels', cronExpr: '1 0 * * *', intervalMs: 24 * 60 * 60_000 },
  { name: 'Agrégation analytics', cronExpr: '55 23 * * *', intervalMs: 24 * 60 * 60_000 },
  { name: 'Self-learning scripts IA', cronExpr: '0 1 * * 0', intervalMs: 7 * 24 * 60 * 60_000 },
  { name: 'Intelligence appels analyse', cronExpr: '0 2 * * 0', intervalMs: 7 * 24 * 60 * 60_000 },
  { name: 'Apprentissage niches IA', cronExpr: '0 1 * * 0', intervalMs: 7 * 24 * 60 * 60_000 },
  { name: 'Optimisation assistants IA', cronExpr: '0 0 * * 0', intervalMs: 7 * 24 * 60 * 60_000 },
];

const MAX_ACTIONS = 30;
let actions: BotAction[] = [];

export function trackAction(message: string) {
  actions.unshift({ message, timestamp: new Date().toISOString() });
  if (actions.length > MAX_ACTIONS) actions.length = MAX_ACTIONS;
}

export function getLastAction(): BotAction | null {
  return actions[0] || null;
}

export function getPreviousAction(): BotAction | null {
  return actions[1] || null;
}

export function getRecentActions(limit = 10): BotAction[] {
  return actions.slice(0, limit);
}

/**
 * Compute the next cron job that will fire, based on current time.
 * Uses a simple heuristic: for each job, compute the next fire time
 * from its cron expression and pick the soonest.
 */
export function getNextScheduledAction(): { name: string; inMinutes: number } | null {
  const now = new Date();
  const nowMin = now.getMinutes();
  const nowHour = now.getHours(); // UTC
  const nowDay = now.getDay(); // 0=Sun

  let soonest: { name: string; inMinutes: number } | null = null;

  for (const job of CRON_JOBS) {
    const mins = getMinutesUntilNext(job.cronExpr, nowMin, nowHour, nowDay);
    if (mins !== null && (soonest === null || mins < soonest.inMinutes)) {
      soonest = { name: job.name, inMinutes: mins };
    }
  }

  return soonest;
}

/**
 * Simple next-fire calculator for common cron patterns.
 * Handles: *\/N, specific minute, hour ranges, day-of-week filters.
 */
function getMinutesUntilNext(expr: string, nowMin: number, nowHour: number, nowDay: number): number | null {
  const parts = expr.split(' ');
  if (parts.length < 5) return null;

  const [minPart, hourPart, , , dowPart] = parts;

  // Check day-of-week filter
  if (dowPart !== '*') {
    const allowedDays = parseDowRange(dowPart);
    if (!allowedDays.includes(nowDay)) {
      // Find next allowed day
      let daysUntil = 0;
      for (let d = 1; d <= 7; d++) {
        if (allowedDays.includes((nowDay + d) % 7)) { daysUntil = d; break; }
      }
      if (daysUntil === 0) return null;
      // Return approximate minutes until start of that day
      return daysUntil * 24 * 60;
    }
  }

  // Parse hour range
  let hourStart = 0, hourEnd = 23;
  if (hourPart !== '*') {
    if (hourPart.includes('-')) {
      const [s, e] = hourPart.split('-').map(Number);
      hourStart = s; hourEnd = e;
    } else if (hourPart.includes('/')) {
      // */N hours — simplified
    } else {
      hourStart = hourEnd = parseInt(hourPart);
    }
  }

  // Parse minute pattern
  let intervalMin = 0;
  let specificMin = -1;
  if (minPart.startsWith('*/')) {
    intervalMin = parseInt(minPart.slice(2));
  } else if (minPart !== '*') {
    specificMin = parseInt(minPart);
  }

  // Calculate next fire
  if (intervalMin > 0) {
    // Repeating every N minutes within hour range
    if (nowHour < hourStart) {
      return (hourStart - nowHour) * 60 - nowMin;
    }
    if (nowHour > hourEnd) {
      return (24 - nowHour + hourStart) * 60 - nowMin;
    }
    // Within range — next interval
    const nextMin = Math.ceil((nowMin + 1) / intervalMin) * intervalMin;
    if (nextMin < 60) return nextMin - nowMin;
    // Next hour
    if (nowHour + 1 <= hourEnd) return 60 - nowMin;
    return (24 - nowHour + hourStart) * 60 - nowMin;
  }

  if (specificMin >= 0) {
    // Fires at specific minute of specific hour(s)
    if (hourPart === '*' || hourPart.includes('/')) {
      // Every hour at :specificMin
      if (nowMin < specificMin) return specificMin - nowMin;
      return 60 - nowMin + specificMin;
    }
    // Specific hour
    if (nowHour < hourStart) return (hourStart - nowHour) * 60 + (specificMin - nowMin);
    if (nowHour === hourStart && nowMin < specificMin) return specificMin - nowMin;
    // Already passed today — next day
    return (24 - nowHour + hourStart) * 60 + (specificMin - nowMin);
  }

  // Wildcard minute at specific hour
  if (minPart === '*' && hourPart !== '*') {
    if (nowHour < hourStart) return (hourStart - nowHour) * 60 - nowMin;
    if (nowHour <= hourEnd) return 1;
    return (24 - nowHour + hourStart) * 60;
  }

  return null;
}

function parseDowRange(dow: string): number[] {
  if (dow.includes('-')) {
    const [s, e] = dow.split('-').map(Number);
    const days: number[] = [];
    for (let d = s; d <= e; d++) days.push(d);
    return days;
  }
  if (dow.includes(',')) return dow.split(',').map(Number);
  return [parseInt(dow)];
}
