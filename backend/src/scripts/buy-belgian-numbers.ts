/**
 * Achète une fournée de numéros belges et la range dans le stock.
 *
 *   npm run phone:buy                 # simulation, n'achète RIEN
 *   npm run phone:buy -- --confirm    # achète pour de vrai
 *   npm run phone:buy -- --count=5 --confirm
 *
 * ── Ce que fait chaque numéro, dans l'ordre ─────────────────────────────────
 *
 *   1. acheté chez TWILIO, sous le dossier réglementaire de Qwillio
 *      (`TWILIO_BE_BUNDLE_SID` + `TWILIO_BE_ADDRESS_SID`), jamais au nom d'un
 *      client;
 *   2. importé chez VAPI, qui l'exploite sans le posséder;
 *   3. écrit dans `phone_number_stock`, libre, en attente d'un client.
 *
 * Les trois doivent réussir pour qu'une ligne soit attribuable. Si l'import
 * Vapi échoue, le numéro est quand même enregistré (il est acheté, donc
 * facturé: l'oublier en base le rendrait invisible et inutilisable) mais
 * SANS `vapiNumberId`, et le stock refusera de l'attribuer.
 *
 * ── Pourquoi la simulation est le défaut ────────────────────────────────────
 *
 * Chaque exécution réussie engage une dépense récurrente. Le même principe que
 * `PHONE_AUTO_PROVISION` et `ALLOW_DEGRADED_BOOT`: une dépense ne part jamais
 * d'un défaut de code, elle part d'un geste explicite.
 */
import { prisma } from '../config/database';
import { env } from '../config/env';
import { vapiClient } from '../config/vapi';

/**
 * Les types que Twilio expose par pays, et ce qu'ils coûtent À L'APPELANT.
 *
 * `local` d'abord: géographique (02 Bruxelles, 03 Anvers…), facturé comme un
 * appel normal. `mobile` (04xx) reste acceptable. `national` est le piège: en
 * Belgique c'est la plage 078, SURTAXÉE pour l'appelant, ce qui annule la
 * raison même d'avoir un numéro belge — il n'est proposé ici que parce qu'un
 * compte peut n'avoir que celui-là, et le choisir doit alors être un geste
 * conscient.
 */
const TYPES = ['local', 'mobile', 'national', 'tollFree'] as const;
type NumberType = (typeof TYPES)[number];

interface Args {
  count: number;
  confirm: boolean;
  type: NumberType;
  areaCode?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
  const rawCount = Number(get('count') ?? 10);
  /* Une borne haute volontaire: une faute de frappe sur `--count` ne doit pas
     pouvoir acheter cent lignes. */
  const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 1), 25) : 10;

  /* `mobile` par défaut, et non `local`: Twilio ne propose PAS de numéro local
     en Belgique sur ce compte (`AvailablePhoneNumbers/BE/Local` répond 404,
     vérifié le 07/09). Garder `local` par défaut ferait échouer chaque fournée
     une première fois pour rien. Le mobile belge (04xx) est facturé
     normalement à l'appelant, ce qui préserve la raison d'être du numéro. */
  const rawType = get('type') ?? 'mobile';
  const type = TYPES.find(t => t.toLowerCase() === rawType.toLowerCase());
  if (!type) {
    console.error(`--type inconnu: « ${rawType} ». Attendu: ${TYPES.join(', ')}.`);
    process.exit(1);
  }

  return { count, confirm: argv.includes('--confirm'), type, areaCode: get('area') };
}

function twilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants.');
  }
  const twilio = require('twilio');
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

interface Bought {
  number: string;
  twilioSid: string;
  vapiNumberId: string | null;
  error?: string;
}

/**
 * Ce que Twilio propose RÉELLEMENT en Belgique pour ce compte.
 *
 * La ressource pays porte un `subresourceUris` qui nomme les types
 * disponibles. C'est la seule source qui fasse autorité: la documentation
 * décrit ce que Twilio vend en général, pas ce que ce compte peut acheter.
 */
async function printAvailableTypes(client: any): Promise<void> {
  try {
    const country = await client.availablePhoneNumbers('BE').fetch();
    const types = Object.keys(country?.subresourceUris ?? {});
    if (types.length === 0) {
      console.error(
        'Twilio ne déclare AUCUN type de numéro pour la Belgique sur ce compte.\n' +
          "C'est un blocage côté compte (pays non ouvert), à régler avec le support Twilio.",
      );
      return;
    }
    console.error(`\nTypes réellement disponibles en Belgique: ${types.join(', ')}.`);
    console.error('Relancer avec par exemple: npm run phone:buy -- --type=mobile');
    console.error(
      'À savoir avant de choisir: « national » en Belgique, c\'est la plage 078,\n' +
        "SURTAXÉE pour l'appelant — elle annule la raison d'avoir un numéro belge.\n" +
        '« mobile » (04xx) reste facturé normalement et fait un repli acceptable.',
    );
  } catch (e) {
    console.error(`Impossible de lister les types disponibles: ${(e as Error).message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!env.TWILIO_BE_BUNDLE_SID || !env.TWILIO_BE_ADDRESS_SID) {
    console.error(
      "TWILIO_BE_BUNDLE_SID et TWILIO_BE_ADDRESS_SID sont requis: sans le dossier\n" +
        "réglementaire approuvé, Twilio refuse tout achat de numéro belge.\n" +
        'Ils se lisent dans la console Twilio, Regulatory Compliance → Bundles / Addresses.',
    );
    process.exit(1);
  }

  const client = twilioClient();

  let available: { phoneNumber: string }[];
  try {
    const country = client.availablePhoneNumbers('BE');
    available = await country[args.type].list({
      voiceEnabled: true,
      limit: args.count,
      ...(args.areaCode ? { areaCode: args.areaCode } : {}),
    });
  } catch (e) {
    /* Une trace brute de RestException n'apprend rien à qui lit la sortie.
       Les trois causes qui arrivent réellement ici se disent en une phrase, et
       aucune ne se corrige dans le code. */
    const err = e as { status?: number; code?: number; message?: string };

    if (err.status === 401 || err.code === 20003) {
      console.error(
        "\nTwilio refuse l'authentification (20003).\n" +
          "Si le message parle d'un compte « not active », c'est un compte d'essai\n" +
          'épuisé ou suspendu, PAS un problème de clés: un compte d\'essai ne peut de\n' +
          "toute façon pas acheter de numéro réglementé belge.\n" +
          'À faire: passer le compte en payant (Upgrade dans la console Twilio).\n' +
          `\nMessage de Twilio: ${err.message ?? 'inconnu'}\n`,
      );
      process.exit(1);
    }

    if (err.status === 404 || err.code === 20404) {
      /* Le type demandé n'existe pas pour ce pays sur ce compte. Plutôt que
         de laisser deviner lequel essayer, on demande à Twilio la liste et on
         l'affiche: une exécution suffit alors à trancher. */
      console.error(`\nTwilio ne propose pas de numéro « ${args.type} » en Belgique sur ce compte (20404).`);
      await printAvailableTypes(client);
      process.exit(1);
    }

    throw e;
  }

  if (available.length === 0) {
    console.error("Aucun numéro belge local disponible chez Twilio pour ces critères.");
    process.exit(1);
  }

  /* Un numéro déjà en stock ne se rachète pas: la liste de Twilio ignore ce
     que nous possédons, et une deuxième ligne pour un même numéro serait une
     double facturation. */
  const known = new Set(
    (await prisma.phoneNumberStock.findMany({ select: { number: true } })).map(r => r.number),
  );
  const candidates = available
    .map((n: { phoneNumber: string }) => n.phoneNumber)
    .filter((n: string) => !known.has(n))
    .slice(0, args.count);

  console.log(`\n${candidates.length} numéro(s) belge(s) « ${args.type} » retenus:`);
  candidates.forEach((n: string) => console.log(`  ${n}`));

  if (!args.confirm) {
    console.log(
      `\nSIMULATION — rien n'a été acheté.\n` +
        `Relancer avec --confirm pour acheter ces ${candidates.length} numéros ` +
        `(dépense récurrente: 1,25 $ par mois et par ligne au tarif belge mobile).\n`,
    );
    return;
  }

  const results: Bought[] = [];

  for (const phoneNumber of candidates) {
    try {
      const bought = await client.incomingPhoneNumbers.create({
        phoneNumber,
        bundleSid: env.TWILIO_BE_BUNDLE_SID,
        addressSid: env.TWILIO_BE_ADDRESS_SID,
        friendlyName: 'Qwillio — stock',
      });

      let vapiNumberId: string | null = null;
      let error: string | undefined;

      try {
        /* La paire clé d'API / secret est préférée au jeton de compte: elle est
           révocable seule, alors que le jeton ouvre tout le compte Twilio. */
        const imported = (await vapiClient.importTwilioNumber({
          number: phoneNumber,
          twilioAccountSid: env.TWILIO_ACCOUNT_SID,
          ...(env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET
            ? { twilioApiKey: env.TWILIO_API_KEY_SID, twilioApiSecret: env.TWILIO_API_KEY_SECRET }
            : { twilioAuthToken: env.TWILIO_AUTH_TOKEN }),
          name: `Qwillio stock ${phoneNumber}`,
        })) as { id?: string };
        vapiNumberId = imported?.id ?? null;
        if (!vapiNumberId) error = 'Vapi a répondu sans identifiant.';
      } catch (e) {
        error = `Import Vapi échoué: ${(e as Error).message}`;
      }

      await prisma.phoneNumberStock.create({
        data: {
          number: phoneNumber,
          country: 'BE',
          numberType: args.type,
          twilioSid: bought.sid,
          vapiNumberId,
          bundleSid: env.TWILIO_BE_BUNDLE_SID,
          status: 'available',
          ...(error ? { notes: error } : {}),
        },
      });

      results.push({ number: phoneNumber, twilioSid: bought.sid, vapiNumberId, error });
      console.log(`  ${vapiNumberId ? 'OK  ' : 'PART'} ${phoneNumber}${error ? ` — ${error}` : ''}`);
    } catch (e) {
      console.error(`  ÉCHEC ${phoneNumber} — ${(e as Error).message}`);
    }
  }

  const usable = results.filter(r => r.vapiNumberId).length;
  const partial = results.length - usable;

  console.log(
    `\n${usable} numéro(s) prêt(s) à être attribués.` +
      (partial > 0
        ? `\n${partial} acheté(s) chez Twilio mais NON importé(s) chez Vapi: facturés et ` +
          `inutilisables tant que l'import n'est pas rejoué (voir la colonne notes).`
        : ''),
  );

  const [available_, assigned] = await Promise.all([
    prisma.phoneNumberStock.count({ where: { status: 'available' } }),
    prisma.phoneNumberStock.count({ where: { status: 'assigned' } }),
  ]);
  console.log(`Stock: ${available_} libre(s), ${assigned} attribué(s).\n`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
