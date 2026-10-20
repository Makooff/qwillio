import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';

// Execute only the real bootstrap prelude. Never import server: it listens,
// seeds and schedules unrelated work. Prisma and migrations are inert doubles.
describe('voice completion bootstrap wiring', () => {
  it('waits for DB and migrations before starting recovery without an HTTP completion', async () => {
    const source = readFileSync('src/server.ts', 'utf8');
    const start = source.indexOf('async function runBootstrap()');
    const end = source.indexOf('/* Reprendre la fenêtre de latence', start);
    expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
    const code = ts.transpileModule(source.slice(start, end) + '\n}', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    let releaseDb!: () => void; let releaseSchema!: () => void;
    const db = new Promise<void>(r => { releaseDb = r; });
    const schema = new Promise<void>(r => { releaseSchema = r; });
    const recover = vi.fn(); const migrations = vi.fn(() => schema);
    const logger = { info: vi.fn(), warn: vi.fn() };
    const run = new Function('prisma', 'logger', 'applyPendingMigrations', 'assurerRepriseInbox',
      code + '; return runBootstrap();');
    const running = run({ user: { count: () => db } }, logger, migrations, recover);
    expect(recover).not.toHaveBeenCalled(); expect(migrations).not.toHaveBeenCalled();
    releaseDb(); await Promise.resolve(); await Promise.resolve();
    expect(migrations).toHaveBeenCalledTimes(1); expect(recover).not.toHaveBeenCalled();
    releaseSchema(); await running;
    expect(recover).toHaveBeenCalledTimes(1);
  });
});
