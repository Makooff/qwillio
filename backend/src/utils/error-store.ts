// In-memory circular buffer of last 100 errors — self-healing monitor
export interface StoredError {
  id: string;
  timestamp: string;
  message: string;
  stack: string;
  route?: string;
  resolved: boolean;
}

const errorStore: StoredError[] = [];
const MAX_ERRORS = 100;

export function storeError(message: string, stack: string, route?: string) {
  const entry: StoredError = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    message,
    stack: stack || '',
    route: route || '',
    resolved: false,
  };
  errorStore.unshift(entry);
  if (errorStore.length > MAX_ERRORS) errorStore.pop();
}

export function getErrors(since?: string): StoredError[] {
  if (!since) return errorStore.slice(0, 50);
  return errorStore.filter(e => e.timestamp > since);
}

export function markResolved(id: string) {
  const e = errorStore.find(e => e.id === id);
  if (e) e.resolved = true;
}
