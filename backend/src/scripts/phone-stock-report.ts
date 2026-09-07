/**
 * L'état du stock de numéros, en dix secondes.
 *
 *   npm run phone:stock
 *
 * Répond à trois questions qu'on se pose avant de racheter une fournée: combien
 * en reste-t-il, qui tient quoi, et y a-t-il des numéros achetés mais
 * inutilisables (facturés chez Twilio sans avoir été importés chez Vapi).
 */
import { prisma } from '../config/database';
import { env } from '../config/env';

async function main() {
  const rows = await prisma.phoneNumberStock.findMany({
    orderBy: [{ status: 'asc' }, { purchasedAt: 'asc' }],
    select: {
      number: true,
      status: true,
      vapiNumberId: true,
      assignedAt: true,
      notes: true,
      client: { select: { businessName: true } },
    },
  });

  if (rows.length === 0) {
    console.log("\nStock vide: aucun numéro acheté. `npm run phone:buy` pour une première fournée.\n");
    return;
  }

  /* Sur le propriétaire, comme la prise: un numéro sans client est
     attribuable, même s'il porte encore l'étiquette `assigned` (ce que laisse
     la suppression d'un client). */
  const available = rows.filter(r => !r.client && r.status !== 'retired');
  const assigned = rows.filter(r => r.client);
  /* Acheté donc facturé, mais sans identifiant Vapi: il ne sonnera chez
     personne et le stock refusera de l'attribuer. C'est la seule anomalie que
     ce rapport doit rendre impossible à manquer. */
  const orphans = rows.filter(r => !r.vapiNumberId && r.status !== 'retired');

  console.log(`\n${available.length} libre(s) · ${assigned.length} attribué(s) · ${rows.length} au total`);
  if (available.length < env.PHONE_STOCK_LOW_THRESHOLD) {
    console.log(`STOCK BAS (seuil ${env.PHONE_STOCK_LOW_THRESHOLD}) — racheter une fournée: npm run phone:buy`);
  }
  console.log('');

  for (const r of rows) {
    const holder = r.client?.businessName ? ` → ${r.client.businessName}` : '';
    const broken = r.vapiNumberId ? '' : '  [NON IMPORTÉ CHEZ VAPI]';
    /* L'étiquette affichée suit le propriétaire et non la colonne `status`,
       sinon un numéro rendu par la suppression d'un client s'afficherait
       « assigned » sans nom en face, ce qui se lit comme une anomalie alors
       qu'il est bel et bien réattribuable. */
    const label = r.status === 'retired' ? 'retired' : r.client ? 'assigned' : 'available';
    console.log(`  ${r.number.padEnd(16)} ${label.padEnd(10)}${holder}${broken}`);
    if (r.notes) console.log(`      ${r.notes}`);
  }

  if (orphans.length > 0) {
    console.log(
      `\n${orphans.length} numéro(s) acheté(s) chez Twilio mais non importé(s) chez Vapi: ` +
        `facturés sans être joignables.`,
    );
  }
  console.log('');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
