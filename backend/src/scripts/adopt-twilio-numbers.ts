/**
 * Récupère dans le stock les numéros Twilio qui n'y sont pas.
 *
 *   npm run phone:adopt            # diagnostic, ne touche à RIEN
 *   npm run phone:adopt -- --confirm
 *
 * ── Pourquoi ce script existe ───────────────────────────────────────────────
 *
 * Un numéro peut être acheté chez Twilio sans arriver dans le stock, et il y a
 * exactement deux façons d'y parvenir:
 *
 *   1. l'achat depuis la CONSOLE Twilio, qui ne connaît évidemment pas notre
 *      base (c'est arrivé le 07/09 avec +32460207490, au bout de la checklist
 *      de conformité qui propose « Select and buy number » à la dernière
 *      étape);
 *   2. `phone:buy` interrompu entre l'achat et l'écriture en base — la ligne
 *      est facturée, la transaction ne l'a jamais enregistrée.
 *
 * Dans les deux cas le résultat est le même et c'est le pire: une ligne payée
 * tous les mois, que le stock ignore, que personne ne se verra attribuer. Ce
 * script la rattrape au lieu d'obliger à racheter.
 *
 * Il répare aussi le cas voisin: une ligne DÉJÀ dans le stock mais sans
 * `vapiNumberId`, c'est-à-dire achetée puis jamais importée chez Vapi. Le
 * stock refuse de l'attribuer (elle sonnerait dans le vide), donc elle reste
 * bloquée jusqu'à ce que l'import soit rejoué.
 *
 * ── Ce qu'il ne fait pas ────────────────────────────────────────────────────
 *
 * Il n'achète rien et ne libère rien. Il ne fait que réconcilier ce que Twilio
 * possède déjà avec ce que la base en sait.
 */
import { prisma } from '../config/database';
import { env } from '../config/env';
import { vapiClient } from '../config/vapi';

interface TwilioNumber {
  sid: string;
  phoneNumber: string;
  friendlyName?: string;
  capabilities?: { voice?: boolean };
}

function twilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants.');
  }
  const twilio = require('twilio');
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

/**
 * Déclare le numéro chez Vapi et rend son identifiant.
 *
 * Le même appel que `phone:buy`: la paire clé d'API / secret est préférée au
 * jeton de compte, qui ouvre tout le compte Twilio.
 */
async function importToVapi(number: string): Promise<string> {
  const imported = (await vapiClient.importTwilioNumber({
    number,
    twilioAccountSid: env.TWILIO_ACCOUNT_SID,
    ...(env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET
      ? { twilioApiKey: env.TWILIO_API_KEY_SID, twilioApiSecret: env.TWILIO_API_KEY_SECRET }
      : { twilioAuthToken: env.TWILIO_AUTH_TOKEN }),
    name: `Qwillio stock ${number}`,
  })) as { id?: string };

  if (!imported?.id) throw new Error('Vapi a répondu sans identifiant.');
  return imported.id;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const client = twilioClient();

  /* Ce que Twilio nous facture réellement, par opposition à ce que la base
     croit savoir. C'est la seule source qui fasse foi sur la propriété. */
  const owned: TwilioNumber[] = await client.incomingPhoneNumbers.list({ limit: 200 });

  if (owned.length === 0) {
    console.log('\nAucun numéro sur le compte Twilio: rien à récupérer.\n');
    return;
  }

  const rows = await prisma.phoneNumberStock.findMany({
    select: { id: true, number: true, vapiNumberId: true, twilioSid: true },
  });
  const byNumber = new Map(rows.map(r => [r.number, r]));

  /* Deux anomalies distinctes, réparées par le même geste (l'import Vapi) mais
     qui ne se racontent pas pareil: l'une est un numéro que la base ignore,
     l'autre un numéro qu'elle connaît mais qu'elle refuse d'attribuer. */
  const missing = owned.filter(n => !byNumber.has(n.phoneNumber));
  const unimported = owned.filter(n => {
    const row = byNumber.get(n.phoneNumber);
    return row && !row.vapiNumberId;
  });

  console.log(`\n${owned.length} numéro(s) sur le compte Twilio, ${rows.length} ligne(s) en stock.\n`);

  if (missing.length === 0 && unimported.length === 0) {
    console.log('Tout concorde: chaque numéro Twilio est en stock et importé chez Vapi.\n');
    return;
  }

  if (missing.length > 0) {
    console.log(`${missing.length} numéro(s) ABSENT(S) du stock (facturés, jamais attribuables):`);
    for (const n of missing) {
      const voice = n.capabilities?.voice === false ? '  [SANS LA VOIX]' : '';
      console.log(`  ${n.phoneNumber.padEnd(16)} ${n.sid}${voice}`);
    }
    console.log('');
  }

  if (unimported.length > 0) {
    console.log(`${unimported.length} numéro(s) en stock mais NON IMPORTÉ(S) chez Vapi:`);
    for (const n of unimported) console.log(`  ${n.phoneNumber}`);
    console.log('');
  }

  if (!confirm) {
    console.log(
      "SIMULATION — rien n'a été modifié.\n" +
        'Relancer avec --confirm pour les importer chez Vapi et les ranger dans le stock.\n' +
        "Aucun achat n'est fait: ces numéros sont déjà payés.\n",
    );
    return;
  }

  let repaired = 0;

  for (const n of missing) {
    try {
      const vapiNumberId = await importToVapi(n.phoneNumber);
      await prisma.phoneNumberStock.create({
        data: {
          number: n.phoneNumber,
          country: 'BE',
          numberType: 'mobile',
          twilioSid: n.sid,
          vapiNumberId,
          bundleSid: env.TWILIO_BE_BUNDLE_SID || null,
          status: 'available',
          notes: 'Récupéré par phone:adopt (acheté hors du script).',
        },
      });
      repaired++;
      console.log(`  OK   ${n.phoneNumber} rangé dans le stock, libre.`);
    } catch (e) {
      /* On n'écrit PAS de ligne sans identifiant Vapi ici: elle rejoindrait
         aussitôt la catégorie « en stock mais injoignable », qui est
         exactement ce que ce script est censé résorber. */
      console.error(`  ÉCHEC ${n.phoneNumber} — ${(e as Error).message}`);
    }
  }

  for (const n of unimported) {
    const row = byNumber.get(n.phoneNumber)!;
    try {
      const vapiNumberId = await importToVapi(n.phoneNumber);
      await prisma.phoneNumberStock.update({
        where: { id: row.id },
        data: { vapiNumberId, notes: null, ...(row.twilioSid ? {} : { twilioSid: n.sid }) },
      });
      repaired++;
      console.log(`  OK   ${n.phoneNumber} importé chez Vapi, désormais attribuable.`);
    } catch (e) {
      console.error(`  ÉCHEC ${n.phoneNumber} — ${(e as Error).message}`);
    }
  }

  const [available, assigned] = await Promise.all([
    prisma.phoneNumberStock.count({ where: { clientId: null, status: { not: 'retired' } } }),
    prisma.phoneNumberStock.count({ where: { clientId: { not: null } } }),
  ]);

  console.log(`\n${repaired} ligne(s) réparée(s). Stock: ${available} libre(s), ${assigned} attribué(s).\n`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
