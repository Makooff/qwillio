import winston from 'winston';
import Transport from 'winston-transport';
import { env } from './env';
import { addLog } from './log-store';
// addLogToDb intentionally not imported — DB persistence disabled to avoid 42P01 race
import { DiscordErrorTransport } from './discord-error-transport';

/**
 * Custom transport — captures logs in the in-memory ring buffer (fast,
 * 500 entries) AND persists info+ entries to Postgres (bot_log) with
 * 7-day retention. DB write is fire-and-forget.
 */
class MemoryTransport extends Transport {
  log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    // Capture splat (extra arguments passed to logger.error/warn/info)
    const splat: unknown[] = info[Symbol.for('splat')] ?? [];
    let message = typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
    if (splat.length > 0) {
      const extra = splat.map((s) => {
        if (typeof s === 'string') return s;
        if (s instanceof Error) return s.message;
        try { return JSON.stringify(s); } catch { return String(s); }
      }).join(' ');
      message = `${message} ${extra}`;
    }

    // Capture stack from Error objects in splat or info
    const errInSplat = splat.find((s) => s instanceof Error) as Error | undefined;
    const stack = info.stack || errInSplat?.stack;

    const entry = {
      timestamp: info.timestamp || new Date().toISOString(),
      level: info.level as 'error' | 'warn' | 'info' | 'debug',
      message,
      service: info.service,
      stack,
    };

    addLog(entry);

    // DB persistence intentionally disabled: it ran into 42P01 races at boot
    // (the bot_log table is created lazily but error events surfaced even
    // through the tableReady guard via Prisma's $on('error') queue). The
    // 500-entry in-memory ring buffer is sufficient for /admin/logs use.
    // To re-enable, uncomment below AND ensure the table exists before any
    // logger call (e.g. via a Prisma migration, not a runtime $executeRaw).
    // if (entry.level !== 'debug') {
    //   addLogToDb(entry).catch(() => { /* never crash on logging */ });
    // }

    callback();
  }
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'qwillio' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new MemoryTransport(),
    // Pipes ERROR-level logs to Discord (dedup + rate-limited, only in prod by default)
    ...(env.NODE_ENV === 'production' || process.env.DISCORD_ERRORS_ENABLED === 'true'
      ? [new DiscordErrorTransport()]
      : []),
  ],
});
