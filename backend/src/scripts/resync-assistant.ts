/**
 * Forcer la resynchronisation d'un assistant, et DIRE ce que Vapi a répondu.
 *
 *   npm run voice:resync -- --email=a@b.com            # simulation
 *   npm run voice:resync -- --email=a@b.com --confirm  # écrit vraiment
 *   npm run voice:resync -- --confirm                  # tous les clients actifs
 *
 * ## Le trou que ça bouche
 *
 * `voice:doctor` LIT l'assistant distant et dit qu'il est périmé. Il ne dit
 * pas pourquoi la resynchronisation n'a pas eu lieu, et rien dans le dépôt ne
 * permettait de la relancer à la main: le seul déclencheur était un
 * enregistrement de réglage depuis le portail.
 *
 * Or ce chemin-là AVALE l'échec. `updateMySettings` attrape, écrit un
 * `logger.warn` et répond `success: true` (voir `vapi-error.ts`). Le client
 * enregistre, l'écran dit que c'est fait, l'assistant distant ne bouge pas, et
 * la seule trace est une ligne de journal sur Render que personne ne relit.
 * Un gérant qui sauve trois fois de suite obtient trois fois « enregistré » et
 * trois fois rien.
 *
 * Ce script refait exactement le même appel, sans le filet: l'erreur remonte
 * entière, avec le corps de la réponse, qui est la seule chose qui nomme le
 * champ fautif. C'est le pendant ÉCRIVANT de `voice:doctor`.
 *
 * ## Pourquoi une simulation par défaut
 *
 * Même convention que `phone:assign` et `voice:greetings`: sans `--confirm` on
 * annonce, on n'écrit pas. Une resynchronisation est idempotente, mais elle
 * POSTe chez Vapi pour chaque client, et lancer ça sur toute la flotte par
 * réflexe n'est pas un geste anodin.
 */
import { prisma } from '../config/database';
import { onboardingService } from '../services/onboarding.service';
import { classifyVapiError } from '../services/voice/vapi-error';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const confirm = process.argv.includes('--confirm');

async function main() {
  const email = arg('email')?.trim().toLowerCase();

  const clients = await prisma.client.findMany({
    where: {
      ...(email ? { contactEmail: email } : { subscriptionStatus: { in: ['active', 'trialing'] } }),
      /* Sans assistant distant, il n'y a rien à resynchroniser: c'est une
         CRÉATION qu'il faut, et elle appartient à l'inscription. Le dire plutôt
         que de tourner à vide sur ces fiches. */
      vapiAssistantId: { not: null },
    },
    select: { id: true, businessName: true, contactEmail: true, vapiAssistantId: true },
    take: 50,
  });

  if (clients.length === 0) {
    console.log(
      email
        ? `\nAucun client avec l'adresse ${email} et un assistant distant.\n`
        : '\nAucun client actif avec un assistant distant.\n',
    );
    return;
  }

  if (!confirm) {
    console.log(`\nSIMULATION. ${clients.length} assistant(s) seraient resynchronisés:\n`);
    for (const c of clients) console.log(`  ${c.businessName} (${c.contactEmail})`);
    console.log('\nRelancer avec --confirm pour écrire.\n');
    return;
  }

  let ok = 0;
  const echecs: string[] = [];

  for (const c of clients) {
    try {
      await onboardingService.syncVapiAssistant(c.id);
      console.log(`  OK      ${c.businessName}`);
      ok++;
    } catch (error) {
      /* Le corps de la réponse EN ENTIER, jamais tronqué: c'est lui qui nomme
         le champ refusé, et le couper fabriquerait une déduction fausse qui a
         l'air d'une lecture (voir 6quinvicies dans CLAUDE.md). */
      const failure = classifyVapiError(error);
      console.log(`  ÉCHEC   ${c.businessName}`);
      console.log(`          ${failure.kind === 'rejected' ? 'REFUSÉ' : 'incident passager'}` +
        `${failure.status ? ` (HTTP ${failure.status})` : ''}`);
      console.log(`          ${failure.detail}`);
      echecs.push(c.businessName);
    }
  }

  console.log(`\n${ok} resynchronisé(s), ${echecs.length} en échec.`);
  if (echecs.length) {
    /* Un refus vient de la charge, et la charge est construite par le même
       code pour tout le monde: un seul échec annonce la flotte entière. */
    console.log('Un REFUS porte sur la charge, donc sur tous les clients, pas seulement ceux-ci.');
    console.log('Lancer `npm run voice:validate` pour voir la charge complète soumise à Vapi.\n');
    process.exitCode = 1;
  } else {
    console.log('Vérifier avec `npm run voice:doctor`, qui relit l\'assistant DISTANT.\n');
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
