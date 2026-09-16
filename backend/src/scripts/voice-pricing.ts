/**
 * Le prix de l'option superagent, calculé au lieu d'être supposé.
 *
 *   npm run voice:pricing
 *   npm run voice:pricing -- --model=gpt-realtime-mini-2025-12-15
 *
 * Ne lit aucune base et n'écrit rien: c'est une feuille de calcul qui vieillit
 * avec le code, pas un document à côté.
 */
import {
  ALL_PLANS, classicCost, eur, flatOptionPriceEur, inclusionCostEur, planMargin,
  REALTIME_RATES, revenuePerIncludedMinuteEur, superagentCost,
  surchargeToKeepMarginEur, USD_PER_EUR,
} from '../config/voice-economics';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const e = (v: number, d = 3) => `${v.toFixed(d)} €`;
const pct = (v: number) => `${(v * 100).toFixed(0)} %`;

function main() {
  const only = arg('model');
  const models = only ? [only] : Object.keys(REALTIME_RATES);

  console.log(`\nÉCONOMIE D'UNE MINUTE  (1 € = ${USD_PER_EUR} $)\n`);

  const classic = classicCost();
  console.log('CLASSIQUE, poste par poste:');
  for (const b of classic.breakdown) {
    console.log(`  ${b.poste.padEnd(14)} ${e(b.eurPerMinute, 4).padStart(9)}   ${b.source}`);
  }
  console.log(`  ${'TOTAL'.padEnd(14)} ${e(classic.eurPerMinute, 4).padStart(9)}`);
  console.log(`  (plans.ts annonce « ~0,15 €/min tout compris »: ${classic.eurPerMinute <= 0.15
    ? 'le calcul par poste est EN DESSOUS, donc la grille a été posée prudemment'
    : 'le calcul par poste est AU DESSUS, la grille sous-estime le coût'})\n`);

  console.log('MARGE PAR PALIER, sur une minute incluse en CLASSIQUE:');
  for (const plan of ALL_PLANS) {
    const m = planMargin(plan, classic.eurPerMinute);
    console.log(`  ${plan.name.padEnd(11)} recette ${e(m.revenueEurPerMinute).padStart(8)}` +
      `   marge ${e(m.marginEurPerMinute).padStart(8)}  (${pct(m.marginRatio)})`);
  }

  for (const model of models) {
    console.log(`\n${'─'.repeat(72)}\nSUPERAGENT avec ${model}\n`);
    const cost = superagentCost(model);
    if ('unknownRate' in cost) {
      console.log(`  IMPOSSIBLE À CALCULER: ${cost.unknownRate}.`);
      console.log('  Le tarif se lit sur le tableau de bord Vapi, qui est ce qui nous facture.');
      console.log('  Tant qu\'il n\'est pas relevé, aucun prix d\'option ne peut être posé.');
      continue;
    }

    for (const b of cost.breakdown) {
      console.log(`  ${b.poste.padEnd(14)} ${e(b.eurPerMinute, 4).padStart(9)}   ${b.source}`);
    }
    console.log(`  ${'TOTAL'.padEnd(14)} ${e(cost.eurPerMinute, 4).padStart(9)}`);

    const delta = surchargeToKeepMarginEur(model);
    if (typeof delta !== 'number') continue;
    console.log(`\n  SURCOÛT par minute vs classique: ${e(delta, 4)}`);
    console.log(`  C'est le supplément à la minute qui rend la marge INTACTE.\n`);

    console.log('  Si le superagent est SERVI sans supplément, la marge devient:');
    let perte = false;
    for (const plan of ALL_PLANS) {
      const m = planMargin(plan, cost.eurPerMinute);
      const flag = m.marginEurPerMinute < 0 ? '   ON PAIE POUR VENDRE' : '';
      if (m.marginEurPerMinute < 0) perte = true;
      console.log(`    ${plan.name.padEnd(11)} marge ${e(m.marginEurPerMinute).padStart(8)}  (${pct(m.marginRatio)})${flag}`);
    }

    console.log('\n  INCLURE le superagent dans le forfait coûte, au pire mois');
    console.log('  (toutes les minutes incluses passées en temps réel):');
    for (const plan of ALL_PLANS) {
      const c = inclusionCostEur(plan, model);
      if (typeof c !== 'number') continue;
      const part = c / plan.monthlyPriceEur;
      console.log(`    ${plan.name.padEnd(11)} ${`${c.toFixed(2)} €`.padStart(9)} par mois` +
        `   soit ${pct(part)} du prix du forfait`);
    }

    console.log('\n  OPTION FORFAITAIRE mensuelle (×3 sur le pire mois), pour les paliers');
    console.log('  qui ne l\'incluent pas:');
    for (const plan of ALL_PLANS) {
      const p = flatOptionPriceEur(plan, model);
      if (typeof p !== 'number') continue;
      console.log(`    ${plan.name.padEnd(11)} ${`+${p} €/mois`.padStart(12)}`);
    }

    if (perte) {
      console.log('\n  CONCLUSION: ce modèle coûte plus qu\'une minute ne rapporte.');
      console.log('  Aucun prix d\'option ne rattrape ça, et l\'inclure dans un forfait');
      console.log('  revient à payer pour chaque minute vendue.');
    } else {
      console.log('\n  CONCLUSION: le surcoût est petit devant la recette d\'une minute.');
      console.log('  L\'inclure haut de gamme est tenable, et l\'option se vend à la valeur');
      console.log('  plutôt qu\'au coût.');
    }
  }

  console.log(`\n${'─'.repeat(72)}`);
  console.log('Les tarifs fournisseurs vivent dans `config/voice-economics.ts`, chacun');
  console.log('avec sa source. Un tarif qui change se corrige là, et toute la grille suit.\n');
}

main();
