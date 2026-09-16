/**
 * Rendre un numéro INCONNU de la réceptionniste, pour pouvoir retester.
 *
 *   npm run caller:forget -- --number=32475123456            # dit ce qu'il sait
 *   npm run caller:forget -- --number=32475123456 --confirm  # l'oublie
 *   npm run caller:forget -- --number=… --email=a@b.com --confirm
 *
 * ## Pourquoi ça existe
 *
 * Le script d'appel test commence par un appelant INCONNU, et c'est le seul
 * moment où trois choses se déclenchent: l'épellation demandée d'office, le
 * refus de réserver sans nom, et la relecture des lettres. Ce sont exactement
 * les trois qui ont cassé en production (6quadragesies, 6octotrigesies). Or le
 * premier appel test rend le numéro CONNU, donc le deuxième ne peut plus les
 * exercer, et on n'a en général qu'un ou deux numéros sous la main.
 *
 * `needsCallerSpelling` s'éteint dès que `getCallerHistory` rend un nom, et ce
 * nom vient de TROIS sources: une réservation confirmée à venir, la mémoire
 * d'appelant, ou le nom d'un appel passé. Les oublier toutes les trois est la
 * seule façon de retrouver un appelant neuf.
 *
 * ## Ce que ça n'efface PAS, et c'est délibéré
 *
 * Pas le transcript, pas le résumé, pas l'enregistrement, pas les métriques de
 * latence: `voice:audit` les lit, et effacer l'appel qu'on vient de mesurer
 * ferait perdre la mesure avec. Ce n'est donc pas l'effacement RGPD
 * (`DELETE /my-dashboard/callers/:number`, qui lui efface tout): c'est une
 * remise à zéro de l'IDENTITÉ, le strict nécessaire pour que l'agent ne
 * reconnaisse plus personne.
 *
 * Pas les réservations non plus: les annuler supprime l'événement Google et
 * cette règle vit déjà dans le portail, avec son bouton. Le script les NOMME
 * et laisse le geste là où il est écrit une fois.
 *
 * Une OPPOSITION est conservée, même règle qu'à la purge (6decies): un
 * « ne me rappelez jamais » ne disparaît pas parce qu'on voulait retester.
 */
import { prisma } from '../config/database';
import { realtimeContextService } from '../services/voice/realtime-context.service';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const confirm = process.argv.includes('--confirm');

async function main() {
  const raw = arg('number')?.trim();
  const email = arg('email')?.trim().toLowerCase();

  if (!raw) {
    console.log('\nIl faut un numéro: --number=32475123456\n');
    process.exitCode = 1;
    return;
  }

  /* La MÊME forme que la base: `normalizeNumber` ne garde que les chiffres,
     parce que ce numéro sert de CLÉ (attribution, mémoire d'appelant). Saisi
     avec un « + » ou des espaces, il ne matcherait rien et le script dirait
     « rien à oublier » sur un numéro parfaitement connu. */
  const number = raw.replace(/\D/g, '');
  if (!number) {
    console.log(`\n"${raw}" ne contient aucun chiffre.\n`);
    process.exitCode = 1;
    return;
  }

  const clients = await prisma.client.findMany({
    where: {
      ...(email ? { contactEmail: email } : { subscriptionStatus: { in: ['active', 'trialing'] } }),
    },
    select: { id: true, businessName: true, contactEmail: true },
    take: 50,
  });

  if (clients.length === 0) {
    console.log(email ? `\nAucun client avec l'adresse ${email}.\n` : '\nAucun client actif.\n');
    return;
  }

  console.log(`\nNuméro ${number}\n`);
  let touched = 0;

  for (const client of clients) {
    const [memory, calls, bookings] = await Promise.all([
      prisma.callerMemory.findUnique({
        where: { clientId_callerNumber: { clientId: client.id, callerNumber: number } },
        select: { knownName: true, totalCalls: true, isBlocked: true },
      }),
      prisma.clientCall.findMany({
        where: {
          clientId: client.id,
          callerNumber: number,
          OR: [{ callerName: { not: null } }, { nameCollected: { not: null } }],
        },
        select: { id: true, callerName: true, nameCollected: true },
      }),
      prisma.clientBooking.findMany({
        where: {
          clientId: client.id,
          customerPhone: number,
          status: 'confirmed',
          bookingDate: { gte: new Date() },
        },
        select: { id: true, customerName: true, bookingDate: true },
      }),
    ]);

    if (!memory && calls.length === 0 && bookings.length === 0) continue;
    touched++;

    console.log(`${client.businessName} (${client.contactEmail})`);
    if (memory) {
      console.log(`  mémoire d'appelant: ${memory.knownName ?? 'sans nom'}, ${memory.totalCalls} appel(s)` +
        `${memory.isBlocked ? ' — OPPOSITION, conservée' : ''}`);
    }
    for (const c of calls) console.log(`  appel passé nommé: ${c.nameCollected ?? c.callerName}`);
    for (const b of bookings) {
      console.log(`  RÉSERVATION à venir: ${b.customerName} le ${b.bookingDate.toISOString().slice(0, 10)}` +
        '  (à annuler dans Rendez-vous: le nom d\'une réservation confirmée prime sur tout le reste)');
    }

    if (!confirm) continue;

    if (memory?.isBlocked) {
      /* L'opposition reste, le personnel part: même arbitrage que la purge de
         rétention. Un numéro sur une liste d'opposition ne peut pas nuire à
         son porteur, il ne sert qu'à ne pas l'appeler. */
      await prisma.callerMemory.update({
        where: { clientId_callerNumber: { clientId: client.id, callerNumber: number } },
        data: { knownName: null, profileSummary: null, lastSummary: null },
      });
    } else if (memory) {
      await prisma.callerMemory.deleteMany({ where: { clientId: client.id, callerNumber: number } });
    }

    if (calls.length) {
      /* Le NOM seulement. Le transcript, le résumé, l'enregistrement et les
         métriques restent: c'est ce que `voice:audit` relit. */
      await prisma.clientCall.updateMany({
        where: { clientId: client.id, callerNumber: number },
        data: { callerName: null, nameCollected: null },
      });
    }

    /* L'historique est servi depuis un cache d'une minute: sans ça, un appel
       passé dans la foulée retrouverait le nom qu'on vient d'effacer. */
    await realtimeContextService.invalidateCaller(client.id, number);
    console.log('  oublié.');
  }

  if (touched === 0) {
    console.log('Inconnu partout: cet appelant est déjà neuf, tu peux appeler.\n');
    return;
  }

  console.log(confirm
    ? '\nFait. Les réservations à venir, si le script en a nommé, restent à annuler dans Rendez-vous.\n'
    : '\nSIMULATION. Relancer avec --confirm pour oublier.\n');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
