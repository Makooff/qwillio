// Actual PostgreSQL/WASM execution, isolated in-memory databases only.
// Does not validate multi-instance networking or the deployed production schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../prisma/migrations/20261030000000_booking_slot_unique_strict/migration.sql', import.meta.url), 'utf8');
const schema = `CREATE TABLE client_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  booking_date timestamp(3) NOT NULL,
  booking_time text,
  status text NOT NULL DEFAULT 'confirmed'
)`;
const client = '11111111-1111-4111-8111-111111111111';
async function database(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(schema);
  return db;
}
async function booking(db, { owner = client, day = '2026-11-12', time = '14:30', status = 'confirmed' } = {}) {
  return db.query('INSERT INTO client_bookings (client_id, booking_date, booking_time, status) VALUES ($1,$2,$3,$4)', [owner, day, time, status]);
}
async function indexes(db) {
  const { rows } = await db.query(`SELECT i.indisvalid, i.indisunique, i.indisready
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'client_bookings_slot_unique'
      AND i.indrelid = 'client_bookings'::regclass`);
  return rows;
}

test('historical duplicates block migration without changing bookings', async t => {
  const db = await database(t);
  await booking(db);
  await booking(db);
  const before = (await db.query('SELECT id FROM client_bookings ORDER BY id')).rows;
  await assert.rejects(db.exec(migration), /Résolution manuelle requise/);
  assert.deepEqual((await db.query('SELECT id FROM client_bookings ORDER BY id')).rows, before);
  assert.deepEqual(await indexes(db), []);
});

test('clean database receives a valid, ready, unique index', async t => {
  const db = await database(t);
  await booking(db);
  await db.exec(migration);
  assert.deepEqual(await indexes(db), [{ indisvalid: true, indisunique: true, indisready: true }]);
});

test('duplicate confirmed slot is rejected by PostgreSQL with 23505', async t => {
  const db = await database(t);
  await db.exec(migration);
  await booking(db);
  await assert.rejects(booking(db), error => error.code === '23505');
});

test('cancelled, timeless and other-tenant bookings do not block the slot', async t => {
  const db = await database(t);
  await db.exec(migration);
  await booking(db);
  for (const data of [
    { status: 'cancelled' },
    { time: null },
    { time: null },
    { owner: '22222222-2222-4222-8222-222222222222' },
  ]) await assert.doesNotReject(booking(db, data));
});

test('migration replay preserves a valid index', async t => {
  const db = await database(t);
  await db.exec(migration);
  await assert.doesNotReject(db.exec(migration));
  assert.deepEqual(await indexes(db), [{ indisvalid: true, indisunique: true, indisready: true }]);
});

test('invalid index state is rebuilt, without a simulated production crash', async t => {
  const db = await database(t);
  await db.exec(migration);
  // Only this disposable WASM catalogue is altered, never any real database.
  await db.exec("UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'client_bookings_slot_unique'::regclass");
  await db.exec(migration);
  assert.deepEqual(await indexes(db), [{ indisvalid: true, indisunique: true, indisready: true }]);
});

test('same-named non-unique index cannot silently satisfy the migration', async t => {
  const db = await database(t);
  await db.exec('CREATE INDEX client_bookings_slot_unique ON client_bookings (client_id, booking_date, booking_time)');
  await assert.rejects(db.exec(migration), /non unique ou invalide/);
});

test('same-named index on another relation cannot satisfy the migration', async t => {
  const db = await database(t);
  await db.exec('CREATE TABLE unrelated (id int); CREATE UNIQUE INDEX client_bookings_slot_unique ON unrelated(id)');
  await assert.rejects(db.exec(migration), /introuvable, non unique ou invalide/);
});
