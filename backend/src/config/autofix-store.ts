/**
 * In-memory store for proposed fixes waiting for user approval.
 * Flow: Claude scheduled task detects error → proposes fix → stores here →
 * sends Discord notif with approve/reject URLs → user clicks → Claude applies on next run.
 */

import { randomBytes } from 'crypto';

export type FixStatus = 'pending' | 'approved' | 'rejected' | 'applied';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ProposedFix {
  id: string;              // short random id (also used in approval URL)
  errorFingerprint: string; // normalized error signature for dedup
  errorMessage: string;
  errorStack?: string;
  riskLevel: RiskLevel;
  title: string;            // short human-readable summary
  filePath?: string;        // file to edit (e.g. backend/src/services/foo.ts)
  diff?: string;            // proposed git-style diff
  reasoning: string;        // why this fix
  status: FixStatus;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;      // 'user' or 'auto'
}

const MAX_ENTRIES = 100;
const TTL_MS = 7 * 24 * 3600 * 1000; // 7 days
const store: Map<string, ProposedFix> = new Map();

function generateToken(): string {
  return randomBytes(12).toString('base64url'); // 16 chars, URL-safe
}

export function proposeFix(input: Omit<ProposedFix, 'id' | 'status' | 'createdAt' | 'updatedAt'>): ProposedFix {
  // Dedup: if an unresolved fix for the same fingerprint already exists, return it
  for (const existing of store.values()) {
    if (existing.errorFingerprint === input.errorFingerprint && existing.status === 'pending') {
      return existing;
    }
  }

  const fix: ProposedFix = {
    ...input,
    id: generateToken(),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.set(fix.id, fix);

  // Cap store size — evict oldest applied/rejected entries
  if (store.size > MAX_ENTRIES) {
    const sorted = Array.from(store.values()).sort(
      (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()
    );
    for (const entry of sorted) {
      if (entry.status !== 'pending') {
        store.delete(entry.id);
        if (store.size <= MAX_ENTRIES) break;
      }
    }
  }

  return fix;
}

export function getFix(id: string): ProposedFix | undefined {
  const fix = store.get(id);
  if (fix && Date.now() - fix.createdAt.getTime() > TTL_MS) {
    store.delete(id);
    return undefined;
  }
  return fix;
}

export function updateStatus(id: string, status: FixStatus, approvedBy?: string): ProposedFix | undefined {
  const fix = store.get(id);
  if (!fix) return undefined;
  fix.status = status;
  fix.updatedAt = new Date();
  if (approvedBy) fix.approvedBy = approvedBy;
  return fix;
}

export function listFixes(opts: { status?: FixStatus; limit?: number } = {}): ProposedFix[] {
  const all = Array.from(store.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const filtered = opts.status ? all.filter(f => f.status === opts.status) : all;
  return filtered.slice(0, opts.limit ?? 50);
}
