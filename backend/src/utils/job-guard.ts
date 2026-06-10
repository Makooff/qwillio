import { logger } from '../config/logger';

/**
 * Reliability wrapper for in-process cron jobs.
 *
 * On a sleep-prone host (Render free tier) a cold start can make a normally
 * fast job run long; the next tick then fires while the previous run is still
 * in flight, causing concurrent runs that double-process the same prospects,
 * calls or reminders. JobGuard serializes each named job (skips overlapping
 * ticks), captures errors, and records run metadata for observability.
 */
export interface JobRun {
  running: boolean;
  runs: number;
  skips: number;
  lastStart?: number;
  lastEnd?: number;
  lastDurationMs?: number;
  lastError?: string | null;
}

export class JobGuard {
  private state = new Map<string, JobRun>();

  private get(name: string): JobRun {
    let s = this.state.get(name);
    if (!s) {
      s = { running: false, runs: 0, skips: 0 };
      this.state.set(name, s);
    }
    return s;
  }

  /** Run `fn` unless a previous run of the same job is still executing. */
  async run(name: string, fn: () => Promise<void>): Promise<void> {
    const s = this.get(name);
    if (s.running) {
      s.skips++;
      logger.warn(`[job] "${name}" still running — skipping overlapping tick (skips=${s.skips})`);
      return;
    }

    s.running = true;
    s.lastStart = Date.now();
    try {
      await fn();
      s.lastError = null;
    } catch (err: unknown) {
      s.lastError = err instanceof Error ? err.message : String(err);
      logger.error(`[job] "${name}" failed:`, err);
    } finally {
      s.lastEnd = Date.now();
      s.lastDurationMs = s.lastEnd - (s.lastStart ?? s.lastEnd);
      s.running = false;
      s.runs++;
    }
  }

  /** Immutable snapshot of every tracked job — handy for an admin/health view. */
  snapshot(): Record<string, JobRun> {
    return Object.fromEntries(
      [...this.state.entries()].map(([name, s]) => [name, { ...s }]),
    );
  }
}

export const jobGuard = new JobGuard();
