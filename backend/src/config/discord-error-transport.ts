/**
 * Winston transport that pipes ERROR-level logs to Discord with:
 *  - Deduplication (same error fingerprint doesn't spam — 1 notif per 10min per fingerprint)
 *  - Batch aggregation (collects errors for 5s, groups repeats into one message)
 *  - Rate limit circuit breaker (max 30 notifs/hour total to avoid Discord rate limits)
 *  - "Send to Claude" format (pre-formatted prompt the user can paste)
 */

import Transport from 'winston-transport';

const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 min per unique error
const BATCH_WINDOW_MS = 5 * 1000;        // 5s collect then flush
const HOURLY_CAP = 30;                   // max 30 Discord messages per hour

interface PendingError {
  message: string;
  stack?: string;
  service?: string;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

class ErrorBuffer {
  private pending: Map<string, PendingError> = new Map();
  private lastSentAt: Map<string, number> = new Map();
  private hourlyCount = 0;
  private hourlyResetAt = Date.now() + 3600_000;
  private flushTimer: NodeJS.Timeout | null = null;

  /**
   * Normalize an error message to a stable fingerprint so "Prisma.findMany() failed at X"
   * and "Prisma.findMany() failed at Y" are deduped together.
   */
  private fingerprint(message: string, service?: string): string {
    const normalized = message
      .replace(/['"`][^'"`]{0,120}['"`]/g, "''")       // remove literal strings
      .replace(/\b\d+\b/g, '#')                         // remove numbers
      .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')            // remove UUIDs/hex ids
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    return `${service ?? 'qwillio'}::${normalized}`;
  }

  add(entry: { message: string; stack?: string; service?: string }) {
    // Reset hourly window
    if (Date.now() > this.hourlyResetAt) {
      this.hourlyCount = 0;
      this.hourlyResetAt = Date.now() + 3600_000;
    }
    if (this.hourlyCount >= HOURLY_CAP) return; // circuit-break

    const fp = this.fingerprint(entry.message, entry.service);
    const lastSent = this.lastSentAt.get(fp) ?? 0;
    if (Date.now() - lastSent < DEDUP_WINDOW_MS) return; // already sent recently

    const now = new Date();
    const existing = this.pending.get(fp);
    if (existing) {
      existing.count++;
      existing.lastSeenAt = now;
    } else {
      this.pending.set(fp, {
        message: entry.message,
        stack: entry.stack,
        service: entry.service,
        count: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), BATCH_WINDOW_MS);
    }
  }

  private async flush() {
    this.flushTimer = null;
    const items = Array.from(this.pending.entries());
    this.pending.clear();

    for (const [fp, err] of items) {
      await this.sendToDiscord(err);
      this.lastSentAt.set(fp, Date.now());
      this.hourlyCount++;
    }
  }

  private async sendToDiscord(err: PendingError) {
    const webhook =
      process.env.DISCORD_WEBHOOK_ERRORS ||
      process.env.DISCORD_WEBHOOK_ALERTS ||
      process.env.DISCORD_WEBHOOK_SYSTEM ||
      process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) return;

    const svc = err.service ?? 'qwillio';
    const ts = err.lastSeenAt.toISOString();
    const countSuffix = err.count > 1 ? ` • **${err.count}×** in last ${BATCH_WINDOW_MS / 1000}s` : '';
    const stackTrimmed = (err.stack ?? '')
      .split('\n')
      .slice(0, 8)
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n');

    const messageBlock = err.message.length > 600 ? err.message.slice(0, 600) + '…' : err.message;

    // Discord content max 2000 chars. Budget carefully.
    const content = [
      `🚨 **Qwillio error** — \`${svc}\` • \`${ts}\`${countSuffix}`,
      '```',
      messageBlock,
      '```',
      stackTrimmed ? '```\n' + stackTrimmed.slice(0, 900) + '\n```' : '',
      '**Fix this**: copy the block above, paste to Claude with "fix and redeploy".',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.slice(0, 1990) }),
      });
    } catch {
      // swallow — don't recurse into logger
    }
  }
}

const buffer = new ErrorBuffer();

export class DiscordErrorTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super({ level: 'error', ...opts });
  }

  log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    // Only ERROR level. Winston should enforce this via `level: 'error'` but double-check.
    if (info.level !== 'error') return callback();

    const splat: unknown[] = info[Symbol.for('splat')] ?? [];
    let message = typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
    if (splat.length > 0) {
      const extra = splat
        .map((s) => {
          if (typeof s === 'string') return s;
          if (s instanceof Error) return s.message;
          try { return JSON.stringify(s); } catch { return String(s); }
        })
        .join(' ');
      message = `${message} ${extra}`;
    }

    const errInSplat = splat.find((s) => s instanceof Error) as Error | undefined;
    const stack = info.stack || errInSplat?.stack;

    buffer.add({
      message,
      stack,
      service: info.service,
    });

    callback();
  }
}
