/**
 * Crée un coupon Stripe et le code promo qui va avec.
 *
 *   npm run stripe:promo                                    # simulation
 *   npm run stripe:promo -- --code=QWILLIO-TEST --confirm
 *
 * ── À quoi ça sert, et pourquoi un coupon plutôt qu'un prix à 0 € ───────────
 *
 * Deux usages: une remise commerciale sur un prospect, et un compte de test qui
 * suit le VRAI parcours client sans qu'un euro bouge — même caisse, mêmes
 * webhooks, même conversion d'essai en payant, même attribution de ligne. C'est
 * ce qui en fait un test et pas une imitation.
 *
 * Un prix à 0 € créé pour l'occasion ferait la même chose en apparence, et
 * serait bien pire: il vivrait dans la liste des tarifs, où n'importe quel
 * chemin de code pourrait le choisir, et il n'expirerait jamais. Un coupon ne
 * s'applique qu'à qui présente le code.
 *
 * ── Les trois garde-fous, et pourquoi ils ne sont pas facultatifs ───────────
 *
 * Un coupon à 100 % « forever » qui fuite donne le produit gratuitement, pour
 * toujours, à qui le trouve. Les défauts ci-dessous font qu'une fuite coûte au
 * pire UN abonnement, et seulement pendant quelques jours:
 *
 *  - `max_redemptions: 1` — un seul compte peut s'en servir;
 *  - une expiration courte — un code oublié cesse de nuire tout seul;
 *  - un code EXPLICITE, jamais deviné — on ne crée pas « GRATUIT » par accident.
 *
 * Les trois se desserrent par option, en le disant. Aucun ne se desserre par
 * distraction.
 */
/* `stripe` s'importe TARD, dans la branche qui crée.
   Le SDK lève à la construction quand la clé manque, donc un import en tête
   ferait planter la SIMULATION avec une trace, sur un poste qui n'a pas de
   clé — c'est-à-dire précisément là où l'on veut relire ce qui serait créé
   avant de le créer. Une simulation qui exige la clé de production n'est pas
   une simulation. */
import { env } from '../config/env';

function arg(name: string): string | undefined {
  return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
}

/** Sept jours: assez pour un test, trop court pour être oublié utilement. */
const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Ce que Stripe accepte comme code, et rien d'autre.
 *
 * La contrainte est écrite dans le SDK lui-même
 * (`node_modules/stripe/types/PromotionCodesResource.d.ts`, champ `code`):
 *
 *   « Valid characters are lower case letters (a-z), upper case letters (A-Z),
 *     and digits (0-9). »
 *
 * Donc PAS de tiret, pas de point, pas d'espace. Ce n'est pas une préférence de
 * style: `QWILLIO-TEST-2026` est refusé par l'API, et l'exemple que ce script
 * donnait lui-même portait des tirets — il envoyait donc l'utilisateur droit
 * dans le mur, avec pour seule trace un message d'erreur de Stripe qui parle de
 * `code` sans dire quel caractère fâche.
 *
 * La vérification a lieu AVANT le moindre appel réseau, pour deux raisons: une
 * faute de frappe ne doit rien coûter, et surtout la création se fait en deux
 * temps (coupon puis code). Échouer au second temps laisserait un coupon à
 * 100 % orphelin dans le compte.
 */
const CODE_OK = /^[A-Za-z0-9]+$/;

export function checkCode(raw: string): { code: string; erreur: string | null } {
  const code = raw.trim().toUpperCase();
  if (!code) return { code, erreur: 'vide' };
  if (CODE_OK.test(code)) return { code, erreur: null };

  const fautifs = Array.from(new Set(code.split('').filter(c => !/[A-Za-z0-9]/.test(c))));
  const propose = code.replace(/[^A-Za-z0-9]/g, '');
  return {
    code,
    erreur:
      `Stripe n'accepte que des lettres et des chiffres dans un code promo. ` +
      `Caractère(s) refusé(s): ${fautifs.map(c => `« ${c} »`).join(', ')}.` +
      (propose ? ` Essayez --code=${propose}` : ''),
  };
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const { code, erreur: codeInvalide } = checkCode(arg('code') || '');
  const percent = Number(arg('percent') ?? 100);
  const redemptions = Number(arg('max') ?? 1);
  const days = Number(arg('days') ?? DEFAULT_EXPIRY_DAYS);

  if (!code) {
    console.error('\n--code= est obligatoire, et volontairement.');
    console.error('Un code promo se tape par un humain: il doit être choisi, pas engendré.');
    console.error('Exemple: npm run stripe:promo -- --code=QWILLIOTEST2026\n');
    process.exitCode = 1;
    return;
  }
  if (codeInvalide) {
    console.error(`\n${codeInvalide}\n`);
    process.exitCode = 1;
    return;
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    console.error(`\n--percent doit être entre 1 et 100 (reçu: ${arg('percent')}).\n`);
    process.exitCode = 1;
    return;
  }
  const expiresAt = Math.floor(Date.now() / 1000) + days * 86_400;
  /* « inconnu » et non « TEST » quand la clé manque: afficher TEST sur une
     absence ferait croire que `--confirm` est sans conséquence, alors que la
     même commande lancée sur Render toucherait de l'argent réel. */
  const mode = !env.STRIPE_SECRET_KEY
    ? 'inconnu (aucune clé sur ce poste)'
    : env.STRIPE_SECRET_KEY.startsWith('sk_live')
      ? 'LIVE (argent réel)'
      : 'TEST';

  console.log('\n── Ce qui serait créé ──');
  console.log(`  Mode          : ${mode}`);
  console.log(`  Code          : ${code}`);
  console.log(`  Remise        : ${percent} %${percent === 100 ? ' (gratuit)' : ''}`);
  console.log(`  Durée         : forever (toutes les échéances, tant que l'abonnement vit)`);
  console.log(`  Utilisations  : ${redemptions} maximum`);
  console.log(`  Expire le     : ${new Date(expiresAt * 1000).toISOString()} (dans ${days} j)`);

  if (percent === 100 && redemptions > 1) {
    console.log('\n  ⚠️  100 % avec plusieurs utilisations: chaque personne qui trouve ce code');
    console.log('      obtient le produit gratuitement, pour toujours. À n\'utiliser que si');
    console.log('      c\'est exactement ce que vous voulez.');
  }

  if (!confirm) {
    console.log('\nSimulation: rien n\'a été créé. Relancer avec --confirm.\n');
    return;
  }

  /* La clé n'est exigée QU'ICI. Relire ce qui serait créé ne demande aucun
     accès, et l'exiger interdirait la simulation partout sauf en production —
     l'endroit précis où l'on ne veut pas découvrir une faute de frappe. */
  if (!env.STRIPE_SECRET_KEY) {
    console.error('\nSTRIPE_SECRET_KEY absente: la création est impossible depuis ce poste.');
    console.error('La simulation ci-dessus reste valable; relancer avec --confirm là où la clé existe.\n');
    process.exitCode = 1;
    return;
  }

  /* Le coupon PUIS le code. Stripe sépare les deux: le coupon porte la remise,
     le code porte ce que l'humain tape. Un coupon sans code ne s'applique qu'à
     la main depuis le tableau de bord, ce qui ne teste pas le parcours. */
  const { stripe } = await import('../config/stripe');

  const coupon = await stripe.coupons.create({
    percent_off: percent,
    duration: 'forever',
    name: `${code} (${percent}%)`,
    max_redemptions: redemptions,
    redeem_by: expiresAt,
    metadata: { createdBy: 'stripe:promo', purpose: percent === 100 ? 'test-account' : 'commercial' },
  });

  /* Le second temps peut échouer alors que le premier a réussi: code déjà pris,
     caractère refusé qui aurait échappé au filtre. Sans ce rattrapage, chaque
     tentative ratée laisserait dans le compte un coupon à 100 % sans code —
     invisible dans le parcours, mais applicable à la main depuis le tableau de
     bord Stripe, ce qui est précisément le genre de chose qu'on ne veut pas
     laisser traîner. */
  let promo;
  try {
    promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      max_redemptions: redemptions,
      expires_at: expiresAt,
      metadata: { createdBy: 'stripe:promo' },
    });
  } catch (error) {
    await stripe.coupons.del(coupon.id).catch(() => {
      console.error(`⚠️  Coupon ${coupon.id} laissé derrière: à supprimer à la main dans Stripe.`);
    });
    throw error;
  }

  console.log(`\n✅ Code ${promo.code} créé (coupon ${coupon.id}, promo ${promo.id}).`);
  console.log('\nÀ faire ensuite, pour tester le vrai parcours:');
  console.log('  1. S\'inscrire normalement sur le site, saisir le code à la caisse.');
  console.log('  2. Depuis le portail de facturation, refaire un passage en caisse');
  console.log('     avec le même code: c\'est CE passage qui convertit l\'essai en payant.');
  console.log('  3. La ligne du stock est attribuée automatiquement à ce moment.');
  console.log('  4. `npm run phone:stock` pour confirmer, puis appeler.\n');
}

/* Exécution directe seulement, comme le harnais d'évals.
   Sans cette garde, importer le module pour tester `checkCode` LANCE le script:
   il écrit son aide sur la sortie d'erreur et pose `process.exitCode = 1` parce
   qu'aucun `--code` n'est passé. Vitest isole ses workers, donc la suite reste
   verte aujourd'hui, mais un test qui laisse le processus dans un état d'échec
   ne tient que par la grâce de son lanceur. */
if (require.main === module) {
  main().catch(err => {
    console.error('Création impossible:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
