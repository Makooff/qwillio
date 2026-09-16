/**
 * Poser le NIVEAU de réceptionniste d'un client, et le faire ARRIVER.
 *
 *   npm run voice:tier                                              # état de la flotte
 *   npm run voice:tier -- --email=a@b.com --tier=superagent         # simulation
 *   npm run voice:tier -- --email=a@b.com --tier=superagent --confirm
 *   npm run voice:tier -- --email=a@b.com --tier=auto --confirm     # retire le choix
 *   npm run voice:tier -- --email=a@b.com --option=on --confirm     # vend l'option
 *   npm run voice:tier -- --email=a@b.com --option=off --confirm    # la retire
 *
 * ## L'option, et pourquoi elle est ici
 *
 * Le Superagent est INCLUS à partir de Pro (`planAllows`). En dessous il
 * s'achète, et ce droit-là vit sur la fiche client (`superagentOption`), pas
 * dans `vapiConfig`: ce JSON est celui que le PUT du portail fusionne,
 * c'est-à-dire ce que le client écrit lui-même. Un droit facturé qui vivrait
 * là serait accordable depuis le navigateur de celui qui doit le payer.
 *
 * Poser le niveau sans le droit ne sert à rien: la résolution le ramène au
 * classique (`entitledTier`). Les deux gestes sont donc au même endroit, et le
 * script refuse la combinaison impossible plutôt que de l'écrire.
 *
 * ## Pourquoi un script et pas seulement un champ
 *
 * Écrire `voiceTier` en base ne change RIEN à l'appel suivant tant que deux
 * autres gestes n'ont pas eu lieu: le profil est servi depuis un cache, et
 * l'assistant DISTANT garde la configuration figée à la dernière
 * synchronisation. C'est le mode d'échec que ce dépôt a payé six fois: un
 * réglage enregistré, un écran qui dit « enregistré », et un appelant qui
 * entend l'ancienne configuration pour toujours.
 *
 * Les trois gestes sont donc ici, dans l'ordre: écrire, vider le cache,
 * resynchroniser. Et la resynchronisation est faite SANS filet, contrairement
 * au portail qui attrape l'erreur et répond quand même `success: true`
 * (`vapi-error.ts`): un refus de Vapi s'affiche ici avec le corps de sa
 * réponse, seule chose qui nomme le champ fautif.
 *
 * ## Ce que `superagent` change vraiment
 *
 * Le moteur passe en parole-à-parole: plus de transcription ni de synthèse,
 * donc plus de custom-LLM. Tout ce que `llm-stream` ajoute à chaque tour
 * (mémoire de l'appelant, date, reprise après coupure, étages de modèle, cache
 * de préfixe) ne s'applique plus; le prompt et les outils, si. Le script le
 * redit avant d'écrire, parce que c'est la moitié qu'on oublie en comparant
 * deux moteurs à l'oreille.
 */
import { prisma } from '../config/database';
import { onboardingService } from '../services/onboarding.service';
import { realtimeContextService } from '../services/voice/realtime-context.service';
import { classifyVapiError } from '../services/voice/vapi-error';
import { readTierId, requestedTier, VOICE_TIERS } from '../services/voice/voice-tiers';
import { lowestPlanFor, planAllows, superagentAllowed } from '../config/plan-features';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const confirm = process.argv.includes('--confirm');

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const raw = arg('tier')?.trim().toLowerCase() ?? null;
  const optionArg = arg('option')?.trim().toLowerCase() ?? null;
  if (optionArg && optionArg !== 'on' && optionArg !== 'off') {
    console.log(`\n"${optionArg}" n'est pas une valeur d'option. Valeurs: on, off.\n`);
    process.exitCode = 1;
    return;
  }
  const option = optionArg === null ? null : optionArg === 'on';

  const clients = await prisma.client.findMany({
    where: {
      ...(email ? { contactEmail: email } : { subscriptionStatus: { in: ['active', 'trialing'] } }),
    },
    select: {
      id: true, businessName: true, contactEmail: true, planType: true,
      vapiAssistantId: true, vapiConfig: true, superagentOption: true,
    },
    take: 50,
  });

  if (clients.length === 0) {
    console.log(email ? `\nAucun client avec l'adresse ${email}.\n` : '\nAucun client actif.\n');
    return;
  }

  /* Sans `--tier`, on ne fait que LIRE. Un script qui écrit par défaut est un
     script qu'on lance pour regarder et qui change la production. */
  if (!raw && option === null) {
    console.log('\nNIVEAU ET DROIT, PAR CLIENT\n');
    for (const c of clients) {
      const cfg = (c.vapiConfig as any) || {};
      const tier = requestedTier({ voiceTier: readTierId(cfg.voiceTier), voiceMode: cfg.voiceMode });
      const how = readTierId(cfg.voiceTier) ? 'choisi'
        : cfg.voiceMode === 'realtime' || cfg.voiceMode === 'classic' ? `hérité de voiceMode=${cfg.voiceMode}`
        : 'rien de choisi (réglage global)';
      /* Le droit se dit AVEC le niveau: un « Superagent » posé sans droit est
         servi en classique, et c'est exactement l'écart qu'il faut voir ici
         plutôt que sur une facture ou dans un appel. */
      const droit = planAllows(c.planType, 'superagent') ? `inclus (${c.planType})`
        : c.superagentOption ? 'option achetée'
        : 'NON AUTORISÉ';
      console.log(`  ${(tier ? VOICE_TIERS[tier].label : 'auto').padEnd(12)} ${droit.padEnd(18)} ` +
        `${c.businessName} (${c.contactEmail})  ${how}`);
    }
    console.log(`\nPour changer: --tier=base | superagent | auto, --option=on | off, puis --confirm.`);
    console.log(`Le Superagent est inclus à partir de ${lowestPlanFor('superagent')}.\n`);
    return;
  }

  const tier = !raw || raw === 'auto' ? null : readTierId(raw);
  if (raw && raw !== 'auto' && !tier) {
    console.log(`\n"${raw}" n'est pas un niveau. Valeurs: base, superagent, auto.\n`);
    process.exitCode = 1;
    return;
  }

  const cible = tier ? VOICE_TIERS[tier] : null;
  if (raw) {
    console.log(`\n${cible ? `${cible.label}: ${cible.summary}` : 'auto: le réglage global décide.'}`);
  }
  if (option !== null) {
    console.log(`\nOption Superagent: ${option ? 'ACCORDÉE' : 'RETIRÉE'} (droit facturé, sur la fiche client).`);
  }

  /* La combinaison impossible se refuse ICI plutôt que de s'écrire: poser
     « superagent » sur un client qui n'y a pas droit produit un réglage que la
     résolution ramène au classique, donc un écran qui dit une chose et un
     appelant qui en entend une autre. */
  if (tier === 'superagent' && option !== true) {
    const sans = clients.filter(c => !superagentAllowed(c));
    if (sans.length) {
      console.log(`\nCes client(s) n'ont PAS droit au Superagent (inclus à partir de ${lowestPlanFor('superagent')}):`);
      for (const c of sans) console.log(`  ${c.businessName} (${c.contactEmail}) — forfait ${c.planType}`);
      console.log('\nAjouter --option=on pour leur vendre l\'option, ou changer leur forfait.\n');
      process.exitCode = 1;
      return;
    }
  }

  if (tier === 'superagent') {
    console.log(
      'Rappel: en parole-à-parole, Vapi appelle OpenAI directement. La mémoire de\n' +
      "l'appelant, la date et la reprise après coupure, qui sont ajoutées à chaque\n" +
      'tour par le backend, ne sont plus appliquées. Le prompt et les outils, si.',
    );
  }

  if (!confirm) {
    console.log(`\nSIMULATION. ${clients.length} client(s) seraient modifiés:\n`);
    for (const c of clients) console.log(`  ${c.businessName} (${c.contactEmail})`);
    console.log('\nRelancer avec --confirm pour écrire.\n');
    return;
  }

  let ok = 0;
  const echecs: string[] = [];

  for (const c of clients) {
    const cfg = ((c.vapiConfig as any) || {}) as Record<string, unknown>;
    /* Fusion SUPERFICIELLE, comme le PUT du portail: `vapiConfig` porte la base
       de connaissances, la voix et le mode sans enregistrement, et le remplacer
       en entier les effacerait en silence (6sexies). */
    await prisma.client.update({
      where: { id: c.id },
      data: {
        /* Le niveau ne bouge que s'il a été demandé: `--option=on` seul accorde
           un droit sans toucher au réglage du client. */
        ...(raw ? { vapiConfig: { ...cfg, voiceTier: tier } as any } : {}),
        ...(option !== null ? { superagentOption: option } : {}),
      },
    });
    /* Le profil est servi depuis un cache: sans ça, l'ancien moteur répond
       pendant tout le TTL, et c'est le mauvais qu'on jugerait à l'appel test. */
    await realtimeContextService.invalidateClient(c.id);

    if (!c.vapiAssistantId) {
      /* Pas d'assistant distant: sur une ligne partagée l'assistant est bâti à
         l'appel, donc le niveau prend effet tout seul. Le dire plutôt que de
         laisser croire à un oubli. */
      console.log(`  ÉCRIT   ${c.businessName} (pas d'assistant distant: bâti à l'appel)`);
      ok++;
      continue;
    }

    try {
      await onboardingService.syncVapiAssistant(c.id);
      console.log(`  OK      ${c.businessName}`);
      ok++;
    } catch (error) {
      const failure = classifyVapiError(error);
      console.log(`  ÉCHEC   ${c.businessName}`);
      console.log(`          ${failure.kind === 'rejected' ? 'REFUSÉ' : 'incident passager'}` +
        `${failure.status ? ` (HTTP ${failure.status})` : ''}`);
      console.log(`          ${failure.detail}`);
      echecs.push(c.businessName);
    }
  }

  console.log(`\n${ok} client(s) à jour, ${echecs.length} en échec.`);
  if (echecs.length) {
    console.log('Un REFUS porte sur la charge, donc sur tous les clients de ce niveau.');
    console.log('Lancer `npm run voice:validate`, seule chose qui soumette la charge à Vapi.\n');
    process.exitCode = 1;
  } else {
    console.log('Vérifier avec `npm run voice:doctor`, qui relit l\'assistant DISTANT,');
    console.log('puis passer un appel et lire `npm run voice:audit`.\n');
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
