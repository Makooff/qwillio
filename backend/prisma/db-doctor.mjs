/**
 * Diagnose — and optionally repair — a Prisma migration left in the "failed"
 * state in `_prisma_migrations`.
 *
 * Why this exists: a migration that errors mid-run leaves a row with no
 * `finished_at` and no `rolled_back_at`. From then on `prisma migrate deploy`
 * refuses to apply *anything* (P3009), so the schema silently freezes while
 * deploys keep succeeding. That happened here on 2026-07-26 and went unnoticed
 * for six weeks, until a pre-deploy hook was finally wired up.
 *
 * Resolving it means telling Prisma which way to record the failed attempt:
 *
 *   --applied      the objects are in the database, just not recorded
 *   --rolled-back  the objects are absent, the migration should be replayed
 *
 * Guessing wrong leaves the schema and its history disagreeing, which is worse
 * than the original failure. So this script does not guess: it reads the
 * migration's own SQL, asks `information_schema` whether each object exists,
 * and only then names a direction. A partial application (some objects present,
 * some not) is reported and left alone — that one needs a human.
 *
 *   node prisma/db-doctor.mjs           report only
 *   node prisma/db-doctor.mjs --heal    report, then resolve if unambiguous
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * The objects a migration creates, as (kind, name) pairs.
 *
 * Deliberately a regex pass over the SQL rather than a parser: these migrations
 * are Prisma-generated and use one quoted identifier per statement. Anything it
 * cannot classify is ignored, which makes the verdict conservative — an
 * unrecognised statement can only produce "unknown", never a wrong direction.
 */
export function objectsCreatedBy(sql) {
  const objects = [];
  const add = (kind, name, table) => objects.push({ kind, name, table });

  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)"/gi)) {
    add('table', m[1]);
  }
  for (const m of sql.matchAll(/CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)? "([^"]+)"/gi)) {
    add('index', m[1]);
  }
  for (const m of sql.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN(?: IF NOT EXISTS)? "([^"]+)"/gi)) {
    add('column', m[2], m[1]);
  }
  return objects;
}

async function exists(prisma, object) {
  const [row] = await (object.kind === 'table'
    ? prisma.$queryRaw`SELECT 1 AS hit FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${object.name}`
    : object.kind === 'column'
      ? prisma.$queryRaw`SELECT 1 AS hit FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${object.table} AND column_name = ${object.name}`
      : prisma.$queryRaw`SELECT 1 AS hit FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = ${object.name}`);
  return Boolean(row);
}

function readMigrationSql(name) {
  const dir = readdirSync(MIGRATIONS_DIR).find(d => d === name);
  if (!dir) return null;
  return readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
}

async function main(prisma, heal) {
  const failed = await prisma.$queryRaw`
    SELECT migration_name, started_at, logs
    FROM _prisma_migrations
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ORDER BY started_at`;

  if (failed.length === 0) {
    console.log('Aucune migration en echec. Rien a reparer.');
    console.log('Si migrate deploy refuse encore, la cause est ailleurs.');
    return;
  }

  console.log(`${failed.length} migration(s) en echec :\n`);

  for (const row of failed) {
    const name = row.migration_name;
    console.log(`  ${name}`);
    console.log(`  echouee le ${new Date(row.started_at).toISOString()}`);
    if (row.logs) console.log(`  erreur : ${String(row.logs).split('\n')[0]}`);

    const sql = readMigrationSql(name);
    if (!sql) {
      console.log('  VERDICT : fichier de migration introuvable dans le repo.');
      console.log('  Ne rien resoudre automatiquement. Intervention manuelle.\n');
      continue;
    }

    const objects = objectsCreatedBy(sql);
    if (objects.length === 0) {
      console.log('  VERDICT : aucun objet reconnu dans le SQL (pas de CREATE/ADD COLUMN).');
      console.log('  Ne rien resoudre automatiquement. Intervention manuelle.\n');
      continue;
    }

    const checks = [];
    for (const object of objects) {
      checks.push({ object, present: await exists(prisma, object) });
    }
    for (const c of checks) {
      const label = c.object.kind === 'column' ? `${c.object.table}.${c.object.name}` : c.object.name;
      console.log(`    ${c.present ? 'present ' : 'absent  '} ${c.object.kind} ${label}`);
    }

    const present = checks.filter(c => c.present).length;
    const direction =
      present === checks.length ? 'applied' : present === 0 ? 'rolled-back' : null;

    if (!direction) {
      // Some objects landed and some did not. Marking it either way lies about
      // the schema, and the replay would fail again on the objects that exist.
      console.log('\n  VERDICT : application PARTIELLE.');
      console.log('  Ni --applied ni --rolled-back n\'est correct ici.');
      console.log('  Il faut retirer a la main les objets deja crees, puis relancer.\n');
      continue;
    }

    console.log(`\n  VERDICT : ${direction}`);
    console.log(
      direction === 'applied'
        ? '  Les objets sont en base. La migration a reussi, seul son enregistrement manque.'
        : '  Aucun objet en base. La migration n\'a rien laisse, elle peut etre rejouee.'
    );

    if (!heal) {
      console.log('  Pour appliquer ce verdict : npm run db:heal\n');
      continue;
    }

    // `migrate resolve` only writes to _prisma_migrations. It never touches
    // application data, in either direction.
    console.log(`  Execution : prisma migrate resolve --${direction} ${name}`);
    execFileSync('npx', ['prisma', 'migrate', 'resolve', `--${direction}`, name], {
      stdio: 'inherit',
    });
    console.log('  Fait.\n');
  }

  if (heal) {
    console.log('Verifie maintenant avec : npm run db:status');
    console.log('Puis applique les migrations en attente : npm run db:deploy');
  }
}

// Importable for tests without opening a connection or running the report.
if (process.argv[1] && process.argv[1].endsWith('db-doctor.mjs')) {
  const prisma = new PrismaClient();
  main(prisma, process.argv.includes('--heal'))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
