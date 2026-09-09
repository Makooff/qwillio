/**
 * Donne une ligne du stock aux clients actifs qui n'en ont pas.
 *
 *   npm run phone:assign                      # diagnostic, n'attribue RIEN
 *   npm run phone:assign -- --confirm
 *   npm run phone:assign -- --email=x@y.z --confirm
 *
 * ── Pourquoi ce script existe ───────────────────────────────────────────────
 *
 * `ensureLine` n'est appelée qu'à UN endroit: `onboardClient`, c'est-à-dire au
 * moment où le client termine son inscription. Un client déjà installé ne
 * repasse jamais par là.
 *
 * La conséquence se voit au premier remplissage du stock: les numéros arrivent,
 * et personne ne les reçoit. Un client activé avant l'achat de la fournée reste
 * sur la ligne partagée (ou sans ligne) pour toujours, alors qu'un numéro belge
 * libre l'attend en base. C'est exactement l'état du compte de test avant le
 * premier appel entrant réel.
 *
 * ── Ce qu'il ne fait pas ────────────────────────────────────────────────────
 *
 * Il n'achète rien. Il ne fait qu'appeler `ensureLine`, la MÊME fonction que
 * l'inscription: le stock d'abord, l'achat automatique ensuite s'il est activé,
 * la ligne partagée en dernier recours. Écrire ici une seconde règle
 * d'attribution la ferait diverger de celle qui fait foi.
 *
 * Un client déjà servi n'est pas retouché: `ensureLine` rend `unchanged` sans
 * rappeler Vapi.
 */
import { prisma } from '../config/database';
import { phoneSetupService } from '../services/voice/phone-setup.service';
import { stockLevel } from '../services/voice/phone-stock.service';

function arg(name: string): string | undefined {
  return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const email = arg('email')?.trim().toLowerCase();

  const clients = await prisma.client.findMany({
    where: {
      /* Seuls les abonnés paient une ligne dédiée. Les autres restent sur la
         ligne partagée, et `ensureLine` le redirait de toute façon: les lister
         ici ne ferait qu'allonger la sortie d'un rappel inutile. */
      subscriptionStatus: 'active',
      ...(email ? { contactEmail: email } : {}),
    },
    select: {
      id: true,
      businessName: true,
      contactEmail: true,
      vapiPhoneNumber: true,
      vapiAssistantId: true,
      phoneSetupState: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (clients.length === 0) {
    console.log(
      email
        ? `\nAucun client actif avec l'adresse ${email}.\n`
        : '\nAucun client actif: rien à attribuer.\n',
    );
    return;
  }

  const level = await stockLevel();
  console.log(`\nStock: ${level.available} numéro(s) libre(s), ${level.assigned} attribué(s).\n`);
  console.log(`${clients.length} client(s) actif(s):\n`);

  /* Une ligne dédiée, c'est un numéro ET l'état qui va avec. Un client marqué
     `active` sans numéro est une incohérence qu'`ensureLine` corrige, donc il
     compte parmi ceux à traiter. */
  const served = clients.filter(c => c.phoneSetupState === 'active' && c.vapiPhoneNumber);
  const todo = clients.filter(c => !served.includes(c));

  for (const c of clients) {
    const line = c.vapiPhoneNumber ?? '—';
    const state = c.phoneSetupState ?? 'jamais configuré';
    const mark = served.includes(c) ? 'OK  ' : 'À FAIRE';
    console.log(`  ${mark} ${(c.businessName || c.contactEmail || c.id).padEnd(28)} ${line.padEnd(16)} ${state}`);
  }

  if (todo.length === 0) {
    console.log('\nChaque client actif a déjà sa ligne dédiée.\n');
    return;
  }

  if (!confirm) {
    console.log(
      `\nSIMULATION — rien n'a été attribué.\n` +
        `Relancer avec --confirm pour donner une ligne à ces ${todo.length} client(s).\n` +
        "Aucun achat: le stock est déjà payé. Si le stock est vide, chaque client\n" +
        "retombe sur la ligne partagée et le dit.\n",
    );
    return;
  }

  console.log('');
  for (const c of todo) {
    const outcome = await phoneSetupService.ensureLine(c.id);
    const who = c.businessName || c.contactEmail || c.id;
    if (outcome.state === 'active') {
      console.log(`  OK      ${who} — ligne dédiée ${outcome.number}`);
    } else if (outcome.state === 'shared') {
      console.log(`  PARTAGÉ ${who} — ${outcome.number ?? 'aucun numéro'} (${outcome.reason})`);
    } else {
      console.log(`  ÉCHEC   ${who} — ${outcome.reason}`);
    }
  }

  const after = await stockLevel();
  console.log(`\nStock: ${after.available} numéro(s) libre(s), ${after.assigned} attribué(s).\n`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
