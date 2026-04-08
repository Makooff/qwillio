/**
 * In-memory rolling log store — last 500 entries, accessible via admin API
 */

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
  stack?: string;
}

const MAX_ENTRIES = 500;
let counter = 0;
const store: LogEntry[] = [];

export function addLog(entry: Omit<LogEntry, 'id'>) {
  store.push({ id: ++counter, ...entry });
  if (store.length > MAX_ENTRIES) store.shift();
}

export function getLogs(opts: { since?: number; level?: string; search?: string; limit?: number }): LogEntry[] {
  let result = opts.since != null ? store.filter(e => e.id > opts.since!) : [...store];
  if (opts.level && opts.level !== 'all') result = result.filter(e => e.level === opts.level);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter(e => e.message.toLowerCase().includes(q) || (e.stack ?? '').toLowerCase().includes(q));
  }
  const limit = opts.limit ?? 200;
  return result.slice(-limit);
}

export function clearLogs() {
  store.length = 0;
  counter = 0;
}

export function getLastId(): number {
  return counter;
}
