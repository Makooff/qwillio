import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// @ts-expect-error — plain .mjs ops script, no types
import { objectsCreatedBy } from '../../prisma/db-doctor.mjs';

type Obj = { kind: string; name: string; table?: string };

const migration = (name: string) =>
  readFileSync(join(__dirname, '../../prisma/migrations', name, 'migration.sql'), 'utf8');

describe('objectsCreatedBy', () => {
  it('reads the migration that is actually blocking production', () => {
    // The verdict for 20260611000000_add_password_reset is decided entirely by
    // these three objects, so a parser miss here picks the wrong direction.
    const objects: Obj[] = objectsCreatedBy(migration('20260611000000_add_password_reset'));
    expect(objects).toEqual([
      { kind: 'index', name: 'users_reset_token_key', table: undefined },
      { kind: 'column', name: 'reset_token', table: 'users' },
      { kind: 'column', name: 'reset_token_expiry', table: 'users' },
    ]);
  });

  it('finds tables, columns and indexes in the same file', () => {
    const objects: Obj[] = objectsCreatedBy(migration('20260717000000_add_spam_detection'));
    expect(objects.some(o => o.kind === 'table' && o.name === 'spam_numbers')).toBe(true);
    expect(objects.some(o => o.kind === 'column' && o.name === 'is_spam')).toBe(true);
  });

  it('attributes each added column to its own table', () => {
    const objects: Obj[] = objectsCreatedBy(`
      ALTER TABLE "users" ADD COLUMN "a" TEXT;
      ALTER TABLE "clients" ADD COLUMN "b" TEXT;
    `);
    expect(objects).toEqual([
      { kind: 'column', name: 'a', table: 'users' },
      { kind: 'column', name: 'b', table: 'clients' },
    ]);
  });

  it('handles IF NOT EXISTS and lowercase SQL', () => {
    const objects: Obj[] = objectsCreatedBy(
      'create table if not exists "t" (id text);\ncreate unique index if not exists "i" on "t"(id);'
    );
    expect(objects.map(o => o.name)).toEqual(['t', 'i']);
  });

  it('ignores statements it cannot classify rather than guessing', () => {
    // An unrecognised statement must not become a phantom object: the verdict
    // is "all present" or "none present", and a phantom would force a wrong
    // partial reading.
    expect(objectsCreatedBy('UPDATE "users" SET "x" = 1; DROP INDEX "old_idx";')).toEqual([]);
  });

  it('returns nothing for an empty migration', () => {
    expect(objectsCreatedBy('-- nothing here\n')).toEqual([]);
  });
});
