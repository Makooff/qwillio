/**
 * Libère le verrou d'avis que `prisma migrate` a laissé coincé.
 *
 *   npm run db:unlock            # diagnostic, ne touche à RIEN
 *   npm run db:unlock -- --confirm
 *
 * ── Pourquoi ce script existe ───────────────────────────────────────────────
 *
 * `prisma migrate` prend `pg_advisory_lock(72707369)` avant d'appliquer quoi
 * que ce soit. Ce verrou appartient à la SESSION, pas à la transaction: il
 * n'est relâché que lorsque la session se termine. Derrière le pooler Neon,
 * les connexions survivent au processus qui les a ouvertes — un `migrate` tué
 * en cours de route laisse donc une session qui tient le verrou pour
 * toujours, et TOUS les déploiements suivants échouent en P1002.
 *
 * C'est arrivé le 07/09: vingt-deux migrations passées, puis deux échecs
 * identiques à la suite. Relancer ne sert alors à rien, ce qui est
 * exactement ce qui rend la panne déroutante.
 *
 * ── Ce que le script refuse de faire ────────────────────────────────────────
 *
 * Il ne coupe QUE les sessions qui tiennent ce verrou précis. Terminer une
 * session au hasard sur une base de production coupe des requêtes de clients
 * en cours; le filtre sur `objid` est ce qui sépare une réparation d'un
 * incident.
 */
import { prisma } from '../config/database';

/** L'identifiant que Prisma verrouille, lisible dans le message d'erreur P1002. */
const PRISMA_MIGRATE_LOCK_ID = 72707369;

interface LockRow {
  pid: string;
  objid: string;
  granted: boolean;
  application_name: string | null;
  state: string | null;
  backend_start: string | null;
  state_change: string | null;
  query: string | null;
}

async function main() {
  const confirm = process.argv.includes('--confirm');

  /* `::text` partout: `pid` et `objid` reviennent en types que JSON ne sait
     pas sérialiser tels quels, et on ne fait qu'afficher. */
  const locks = await prisma.$queryRaw<LockRow[]>`
    SELECT l.pid::text          AS pid,
           l.objid::text        AS objid,
           l.granted            AS granted,
           a.application_name   AS application_name,
           a.state              AS state,
           a.backend_start::text AS backend_start,
           a.state_change::text  AS state_change,
           left(a.query, 120)   AS query
      FROM pg_locks l
      LEFT JOIN pg_stat_activity a ON a.pid = l.pid
     WHERE l.locktype = 'advisory'
     ORDER BY l.pid
  `;

  if (locks.length === 0) {
    console.log(
      "\nAucun verrou d'avis en cours: ce n'est donc pas ça qui bloque.\n" +
        'Si le déploiement échoue encore en P1002, la cause est ailleurs\n' +
        '(base injoignable, connexion saturée).\n',
    );
    return;
  }

  console.log(`\n${locks.length} verrou(x) d'avis en cours:\n`);
  for (const l of locks) {
    const mine = l.objid === String(PRISMA_MIGRATE_LOCK_ID);
    console.log(
      `  pid ${l.pid.padEnd(8)} objid ${l.objid.padEnd(12)}` +
        `${l.granted ? 'tenu   ' : 'attente'} ${l.state ?? '?'}` +
        `${mine ? '   <- VERROU DE MIGRATION PRISMA' : ''}`,
    );
    if (l.backend_start) console.log(`      session ouverte depuis ${l.backend_start}`);
    if (l.query) console.log(`      dernière requête: ${l.query}`);
  }

  const stuck = locks.filter(l => l.objid === String(PRISMA_MIGRATE_LOCK_ID) && l.granted);

  if (stuck.length === 0) {
    console.log(
      `\nAucune session ne TIENT le verrou de migration (${PRISMA_MIGRATE_LOCK_ID}).\n` +
        "Rien à libérer: relancer le déploiement devrait suffire.\n",
    );
    return;
  }

  if (!confirm) {
    console.log(
      `\n${stuck.length} session(s) tiennent le verrou de migration et bloquent tout déploiement.\n` +
        `SIMULATION — rien n'a été coupé.\n` +
        `Relancer avec --confirm pour terminer ces sessions (pid ${stuck.map(s => s.pid).join(', ')}).\n` +
        `Elles n'exécutent plus de migration: seul le verrou survit.\n`,
    );
    return;
  }

  for (const s of stuck) {
    try {
      await prisma.$queryRawUnsafe(`SELECT pg_terminate_backend(${Number(s.pid)})`);
      console.log(`  session ${s.pid} terminée, verrou relâché.`);
    } catch (e) {
      console.error(`  session ${s.pid}: ${(e as Error).message}`);
    }
  }

  console.log('\nRelancer le déploiement Render: la migration devrait passer.\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
