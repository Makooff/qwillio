import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Neon serverless drops idle connections after ~5 min and its pooler
// behaves like PgBouncer in transaction mode. We:
//   - append `pgbouncer=true` so Prisma disables prepared statements that
//     break under transaction pooling,
//   - keep `connection_limit` generous (15) since PgBouncer already manages
//     a large server-side pool — a small client pool just causes timeouts
//     under concurrent cron jobs ("connection limit: 3" was the bottleneck),
//   - extend `pool_timeout` so concurrent queries don't bail in 10s,
//   - set a short `connect_timeout` so a dead connection fails quickly.
const rawUrl = process.env.DATABASE_URL || '';
const neonParams = 'pgbouncer=true&connect_timeout=10&connection_limit=15&pool_timeout=30';
const dbUrl = rawUrl.includes('neon.tech') && !rawUrl.includes('pgbouncer=true')
  ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}${neonParams}`
  : rawUrl;

const basePrisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
  datasources: { db: { url: dbUrl } },
});

basePrisma.$on('error', (e: any) => {
  const msg: string = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
  // Neon idle disconnects and engine-transition noise — Prisma auto-reconnects, suppress.
  // Also suppress boot-time `bot_log does not exist` (42P01) — the log table is
  // created lazily and any writes that race past the tableReady guard fall through
  // to here. These are non-fatal: the addLogToDb caller already swallows them.
  if (
    msg.includes('kind: Closed') ||
    msg.includes('connection closed') ||
    msg.includes('Error { kind: Closed') ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Engine is not yet connected') ||
    msg.includes("Can't reach database server") ||
    msg.includes('Connection refused') ||
    msg.includes('ECONNRESET') ||
    msg.includes('P1001') ||
    msg.includes('P1008') ||
    msg.includes('relation "bot_log" does not exist') ||
    msg.includes('42P01')
  ) return;
  logger.error('Prisma error:', e);
});

basePrisma.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});

// ═══ Retry middleware for transient Neon disconnections ═══
// When Neon kills an idle connection, the first query fails with "Server has
// closed the connection". Prisma then marks the connection dead internally
// and the NEXT query on the pool uses a fresh one — so a simple retry with
// a small delay is enough. We do NOT call $disconnect() here because it
// affects every in-flight query globally and surfaces as
// "Engine is not yet connected" on concurrent requests.
const RETRYABLE_ERRORS = [
  'Server has closed the connection',
  'kind: Closed',
  'connection closed',
  'Connection refused',
  'ECONNRESET',
  'Engine is not yet connected',
  'Timed out fetching a new connection from the connection pool',
  "Can't reach database server",
];
const MAX_RETRIES = 12;
// "Can't reach database server" usually means Neon compute is cold-starting
// (up to 30s on the free plan). Give those much longer backoffs than transient
// pool/connection hiccups, which recover in <500ms.
const COLDSTART_PATTERNS = ["Can't reach database server", 'Connection refused', 'ECONNRESET'];

/**
 * COMBIEN DE REPLIS CE PROCESSUS A PAYÉS, et combien de temps ils ont coûté en
 * pure attente.
 *
 * Le journal de repli est passé en `info` le 19/09 précisément parce qu'il
 * était muet: « une requête pouvait payer 250 ms plus un aller-retour sans
 * laisser la moindre trace, et pourquoi cet outil a mis six secondes restait
 * sans réponse ». Mais un journal se lit dans Render, à la main, en connaissant
 * l'heure de l'appel — donc le fait existait toujours sans que personne ne
 * l'ouvre, ce qui est le défaut de forme qui revient sans cesse ici
 * (6unsexagesies).
 *
 * Ce compteur est PROCESSUS-LARGE, et il le reste: une extension Prisma ne sait
 * pas quel appel est en vol. La différence entre deux relevés dit donc « ce
 * processus a payé N replis pendant cet appel », et avec deux appels simultanés
 * elle les compte pour les deux. L'audit le dit plutôt que de faire semblant:
 * un chiffre honnête et large vaut mieux qu'un chiffre précis et faux.
 */
const dbRetryTally = { count: 0, waitedMs: 0, coldStarts: 0 };

export function dbRetrySnapshot(): { count: number; waitedMs: number; coldStarts: number } {
  return { ...dbRetryTally };
}

const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          return await query(args);
        } catch (error: any) {
          const msg = error?.message || '';
          const isRetryable = RETRYABLE_ERRORS.some(e => msg.includes(e));
          if (isRetryable && attempt < MAX_RETRIES) {
            const isColdStart = COLDSTART_PATTERNS.some(e => msg.includes(e));
            /* LES DEUX BRANCHES SONT PLAFONNÉES (19/09/2026).
             *
             * Le repli transitoire ne l'était pas: `250 * 2^attempt` sur douze
             * essais monte à 512 SECONDES au dernier, et la somme de la série
             * dépasse dix-sept minutes pour UNE requête. La branche démarrage à
             * froid, elle, plafonnait bien à 10 s — l'asymétrie n'était pas un
             * choix, les deux commentaires décrivent la même intention.
             *
             * Ce que ça change là où ça compte: ces requêtes tournent AUSSI sur
             * le chemin d'un appel en cours, où un appelant attend et où la
             * cible d'un outil est 1,5 s. 4 s est la dernière valeur que la
             * séquence documentée ci-dessus nomme, donc le plafond ne raccourcit
             * aucun repli prévu: il ne coupe que la queue qui s'emballe. */
            const backoff = isColdStart
              ? Math.min(10000, 1000 * Math.pow(2, attempt))
              : Math.min(4000, 250 * Math.pow(2, attempt));
            /* Compté AVANT l'attente: un processus tué pendant le repli aurait
               quand même payé la requête perdue, et ne pas la compter ferait
               disparaître le pire cas — celui qu'on cherche. */
            dbRetryTally.count++;
            dbRetryTally.waitedMs += backoff;
            if (isColdStart) dbRetryTally.coldStarts++;
            /* VISIBLE DÈS LE PREMIER ESSAI. Le premier repli était en `debug`,
             * donc muet en production: une requête pouvait payer 250 ms plus un
             * aller-retour sans laisser la moindre trace, et « pourquoi cet
             * outil a mis six secondes » restait sans réponse. C'est le défaut
             * de forme qui revient tout le temps ici: le fait existe, personne
             * ne le lit. */
            logger[attempt >= 1 ? 'warn' : 'info'](
              `[prisma] ${isColdStart ? 'cold-start' : 'transient'} DB error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms: ${msg.slice(0, 120)}`,
            );
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          throw error;
        }
      }
    },
  },
}) as unknown as PrismaClient;

export { prisma, basePrisma };
