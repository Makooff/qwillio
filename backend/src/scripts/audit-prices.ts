/**
 * Compare ce que le SITE annonce à ce que STRIPE prélèverait — `npm run stripe:prices`.
 *
 * Ce sont deux objets sans lien: `config/plans.ts` décide de l'affichage, un
 * objet Price chez Stripe décide du prélèvement, et rien ne les tenait ensemble.
 * Le 09/09, la caisse annonçait « Qwillio Pro, 1297,00 € par mois » sous une
 * page qui affichait 599 €: `STRIPE_PRICE_PRO_MONTHLY` pointait un prix d'une
 * tarification précédente, et cette variable court-circuite le tarif du code
 * sans rien vérifier.
 *
 * Un client aurait signé pour 599 et payé 1297. Ce script existe pour que la
 * question « quel montant serait réellement prélevé ? » se pose en dix secondes
 * au lieu de se découvrir sur un relevé bancaire.
 *
 * LECTURE SEULE: il n'écrit rien, ne crée aucun prix, ne corrige rien. Il dit
 * quoi corriger et où.
 */
import { env } from '../config/env';
import { PLANS, annualPriceEur, type PlanId, type BillingPeriod } from '../config/plans';

const PERIODES: BillingPeriod[] = ['monthly', 'annual'];

function euros(centimes: number | null | undefined): string {
  return `${((centimes ?? 0) / 100).toLocaleString('fr-BE', { minimumFractionDigits: 2 })} €`;
}

/** La variable d'environnement qui court-circuite le tarif du code, si elle est posée. */
function override(planId: PlanId): { nom: string; valeur: string } {
  const nom = PLANS[planId].stripePriceEnv;
  return { nom, valeur: (env as unknown as Record<string, string>)[nom] || '' };
}

async function main() {
  if (!env.STRIPE_SECRET_KEY) {
    console.error('\nSTRIPE_SECRET_KEY absente: ce script lit les prix chez Stripe, il lui faut la clé.');
    console.error('À lancer là où la clé existe, typiquement le shell Render.\n');
    process.exitCode = 1;
    return;
  }

  const mode = env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE (argent réel)' : 'TEST';
  console.log(`\n── Prix Stripe contre config/plans.ts ──`);
  console.log(`  Mode: ${mode}\n`);

  const { stripe } = await import('../config/stripe');
  let fautes = 0;

  for (const planId of Object.keys(PLANS) as PlanId[]) {
    const plan = PLANS[planId];
    const env_ = override(planId);

    for (const periode of PERIODES) {
      const attendu = Math.round((periode === 'annual' ? annualPriceEur(plan) : plan.monthlyPriceEur) * 100);
      const intervalleAttendu = periode === 'annual' ? 'year' : 'month';

      /* La MÊME résolution que la production, sinon on auditerait autre chose
         que ce qui est vendu: la variable d'environnement d'abord (mensuel
         seulement), la clé de recherche ensuite. */
      let priceId = '';
      let source = '';
      if (periode === 'monthly' && env_.valeur) {
        priceId = env_.valeur;
        source = env_.nom;
      } else {
        const lookupKey = `qwillio_${planId}_${periode}_eur`;
        const trouve = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
        priceId = trouve.data[0]?.id || '';
        source = `lookup_key ${lookupKey}`;
      }

      const etiquette = `${plan.name.padEnd(11)} ${periode === 'annual' ? 'annuel ' : 'mensuel'}`;

      if (!priceId) {
        /* Pas une faute: le prix sera CRÉÉ depuis config/plans.ts au premier
           passage en caisse, donc au bon montant par construction. */
        console.log(`  ${etiquette}  ${euros(attendu).padStart(12)}  (aucun prix encore créé, il le sera au bon montant)`);
        continue;
      }

      try {
        const price = await stripe.prices.retrieve(priceId);
        const ecarts: string[] = [];
        if (price.unit_amount !== attendu) ecarts.push(`prélève ${euros(price.unit_amount)}`);
        if (price.currency !== 'eur') ecarts.push(`devise ${price.currency}`);
        if (price.recurring?.interval !== intervalleAttendu) {
          ecarts.push(`période ${price.recurring?.interval ?? 'aucune'}`);
        }
        if (!price.active) ecarts.push('prix inactif');

        if (ecarts.length) {
          fautes += 1;
          console.log(`  ${etiquette}  ${euros(attendu).padStart(12)}  ✗ ${ecarts.join(', ')}`);
          console.log(`      ${priceId} (${source})`);
        } else {
          console.log(`  ${etiquette}  ${euros(attendu).padStart(12)}  ✓`);
        }
      } catch (error) {
        fautes += 1;
        console.log(`  ${etiquette}  ${euros(attendu).padStart(12)}  ✗ introuvable chez Stripe`);
        console.log(`      ${priceId} (${source}) — ${(error as Error).message}`);
      }
    }
  }

  console.log('');
  if (!fautes) {
    console.log('Tous les prix correspondent à ce que le site annonce.\n');
    return;
  }

  console.log(`${fautes} écart(s). La caisse est REFUSÉE sur ces plans tant qu'ils durent:`);
  console.log('un client paierait un montant que la page ne lui a pas annoncé.\n');
  console.log('Deux façons de corriger, au choix:');
  console.log('  1. Retirer la variable STRIPE_PRICE_<PLAN>_MONTHLY sur Render. Le prix sera');
  console.log('     alors créé depuis config/plans.ts, donc juste par construction.');
  console.log('  2. La faire pointer vers un prix Stripe au bon montant.');
  console.log('\nUn abonnement DÉJÀ en cours garde son ancien prix: seuls les nouveaux suivent.\n');
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error('Audit impossible:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
