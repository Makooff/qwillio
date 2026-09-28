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
 * Il répare aussi le cas voisin: une ligne DÉJÀ dans le stock mais rattachée à
 * rien, c'est-à-dire achetée puis jamais acheminée. Le stock refuse de
 * l'attribuer (elle sonnerait dans le vide), donc elle reste bloquée jusqu'à
 * ce que le rattachement soit rejoué.
 *
 * ── LA DESTINATION A CHANGÉ (28/09/2026) ────────────────────────────────────
 *
 * Ce script déclarait les numéros chez VAPI. Le cœur vocal a remplacé Vapi, et
 * il reçoit ses appels par le trunk Elastic SIP de Twilio: un numéro adopté
 * ici y est donc désormais RATTACHÉ, ce qui le retire de Vapi du même geste —
 * Twilio n'achemine un numéro que vers un seul destinataire.
 *
 * Et il pose une garde qui manquait: un numéro déjà tenu par un client (il a
 * sa ligne dans `client_phone_numbers`) entre dans le stock en `assigned`, PAS
 * en `available`. Sans elle, adopter la ligne d'un client la rendrait
 * attribuable à un autre — et le premier perdrait son numéro sans que rien ne
 * le dise.
 *
 * ── Ce qu'il ne fait pas ────────────────────────────────────────────────────
 *
 * Il n'achète rien et ne libère rien. Il ne fait que réconcilier ce que Twilio
 * possède déjà avec ce que la base en sait.
 *
 * Il ne touche pas non plus à un numéro rattaché à un AUTRE trunk: celui-là
 * sert quelque chose qu'on ne connaît pas d'ici, et le déplacer couperait une
 * ligne pour réparer une statistique.
 */
import { prisma } from '../config/database';
import { env } from '../config/env';
import { twilioTrunkClient } from '../config/twilio-trunk';

interface TwilioNumber {
  sid: string;
  phoneNumber: string;
  friendlyName?: string;
  capabilities?: { voice?: boolean };
  /** Le trunk SIP qui achemine ce numéro, `TK...`, ou vide. */
  trunkSid?: string | null;
}

function twilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants.');
  }
  const twilio = require('twilio');
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

/**
 * Rattache le numéro au trunk Elastic SIP, et rend le SID du trunk.
 *
 * Le même geste que `phone:buy`, et par SID: on tient déjà le `PN...` de
 * Twilio, donc on ne rouvre pas la question des écritures (+32, 0032, 0…).
 *
 * Déjà rattaché à CE trunk: rien à faire, on rend le SID. Rattaché à un
 * AUTRE: on refuse — ce numéro sert ailleurs.
 */
async function rattacherAuTrunk(n: TwilioNumber, dejaLa: Set<string>): Promise<string> {
  const trunk = env.TWILIO_SIP_TRUNK_SID;
  if (!trunk) throw new Error('TWILIO_SIP_TRUNK_SID manquant.');

  if (dejaLa.has(n.sid)) return trunk;
  if (n.trunkSid && n.trunkSid !== trunk) {
    throw new Error(`déjà rattaché au trunk ${n.trunkSid}, laissé en place.`);
  }

  await twilioTrunkClient().trunking.v1.trunks(trunk).phoneNumbers.create({ phoneNumberSid: n.sid });
  dejaLa.add(n.sid);
  return trunk;
}

/**
 * Les SID des numéros DÉJÀ rattachés au trunk, demandés au trunk lui-même.
 *
 * On ne se fie PAS au `trunkSid` de la liste des numéros: celle-ci sort de
 * l'API par défaut, qui ne voit pas les rattachements d'un trunk régional et
 * rend donc un `trunkSid` vide pour un numéro pourtant rattaché. Le croire
 * ferait retenter un rattachement déjà fait — et échouer là où tout va bien.
 *
 * `--trunk-fait` rend l'ensemble VIDE sans appeler l'API: c'est la porte de
 * sortie quand le rattachement a été fait à la main dans la console et que
 * l'API régionale, elle, refuse encore de répondre. On prend alors l'opérateur
 * au mot, et on se contente d'écrire le stock.
 */
async function sidsSurLeTrunk(trunkFait: boolean): Promise<Set<string> | 'tous'> {
  const trunk = env.TWILIO_SIP_TRUNK_SID;
  if (!trunk) throw new Error('TWILIO_SIP_TRUNK_SID manquant.');
  if (trunkFait) return 'tous';
  const lignes = await twilioTrunkClient()
    .trunking.v1.trunks(trunk)
    .phoneNumbers.list({ limit: 200 });
  return new Set<string>(lignes.map((l: { sid: string }) => l.sid));
}

/**
 * Les écritures d'un même numéro belge, CONVERSION NATIONALE COMPRISE.
 *
 * Volontairement pas `utils/phone-forms`: celui-ci ne retire que ce qui n'est
 * pas un chiffre, donc `0460258033` et `+32460258033` n'y sont PAS la même
 * chose. C'est sans conséquence là où il sert, et grave ici: une
 * correspondance ratée fait entrer en « libre » un numéro qu'un client tient
 * déjà, et le prochain client à activer prendrait sa ligne.
 *
 * Même règle que `ecrituresDuNumero` côté pont, recopiée plutôt qu'importée:
 * le fichier qui la porte est une route Express, et un script d'exploitation
 * n'a pas à démarrer un serveur pour comparer deux numéros.
 */
function ecrituresDuNumero(brut: string): string[] {
  const chiffres = String(brut || '').replace(/\D/g, '');
  if (!chiffres) return [];
  const formes = new Set<string>([String(brut).trim(), chiffres, `+${chiffres}`]);
  if (chiffres.startsWith('0')) {
    formes.add(`32${chiffres.slice(1)}`);
    formes.add(`+32${chiffres.slice(1)}`);
  }
  if (chiffres.startsWith('32')) {
    formes.add(`0${chiffres.slice(2)}`);
    formes.add(chiffres.slice(2));
  }
  return [...formes].filter(Boolean);
}

/**
 * Les numéros que des clients tiennent DÉJÀ, sous toutes leurs écritures.
 *
 * `client_phone_numbers` est la table que le cœur vocal lit au décroché: une
 * ligne qui s'y trouve appartient à quelqu'un, quoi que le stock en pense.
 */
async function lignesDesClients(): Promise<Map<string, string>> {
  const lignes = await prisma.clientPhoneNumber.findMany({
    where: { isActive: true },
    select: { number: true, clientId: true },
  });
  const par = new Map<string, string>();
  for (const l of lignes) {
    for (const forme of ecrituresDuNumero(l.number)) par.set(forme, l.clientId);
  }
  return par;
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
    select: { id: true, number: true, sipTrunkSid: true, twilioSid: true },
  });
  const byNumber = new Map(rows.map(r => [r.number, r]));

  /* Deux anomalies distinctes, réparées par le même geste (l'import Vapi) mais
     qui ne se racontent pas pareil: l'une est un numéro que la base ignore,
     l'autre un numéro qu'elle connaît mais qu'elle refuse d'attribuer. */
  const missing = owned.filter(n => !byNumber.has(n.phoneNumber));
  const nonAchemines = owned.filter(n => {
    const row = byNumber.get(n.phoneNumber);
    return row && !row.sipTrunkSid;
  });

  /* Les numéros qu'un client tient déjà: ils entreront en `assigned`. */
  const tenus = await lignesDesClients();
  const proprietaire = (numero: string): string | null => {
    for (const forme of ecrituresDuNumero(numero)) {
      const id = tenus.get(forme);
      if (id) return id;
    }
    return null;
  };

  console.log(`\n${owned.length} numéro(s) sur le compte Twilio, ${rows.length} ligne(s) en stock.\n`);

  if (missing.length === 0 && nonAchemines.length === 0) {
    console.log('Tout concorde: chaque numéro Twilio est en stock et acheminé vers le trunk.\n');
    return;
  }

  if (missing.length > 0) {
    console.log(`${missing.length} numéro(s) ABSENT(S) du stock (facturés, jamais attribuables):`);
    for (const n of missing) {
      const voice = n.capabilities?.voice === false ? '  [SANS LA VOIX]' : '';
      const a = proprietaire(n.phoneNumber);
      const tenu = a ? `  [TENU PAR ${a} — entrera en assigned]` : '';
      const ailleurs = n.trunkSid && n.trunkSid !== env.TWILIO_SIP_TRUNK_SID
        ? `  [SUR LE TRUNK ${n.trunkSid} — sera laissé en place]` : '';
      console.log(`  ${n.phoneNumber.padEnd(16)} ${n.sid}${voice}${tenu}${ailleurs}`);
    }
    console.log('');
  }

  if (nonAchemines.length > 0) {
    console.log(`${nonAchemines.length} numéro(s) en stock mais NON ACHEMINÉ(S) vers le trunk:`);
    for (const n of nonAchemines) console.log(`  ${n.phoneNumber}`);
    console.log('');
  }

  if (!confirm) {
    console.log(
      "SIMULATION — rien n'a été modifié.\n" +
        'Relancer avec --confirm pour les rattacher au trunk SIP et les ranger dans le stock.\n' +
        "Aucun achat n'est fait: ces numéros sont déjà payés.\n",
    );
    return;
  }

  const trunkFait = process.argv.includes('--trunk-fait');
  let surLeTrunk: Set<string>;
  try {
    const vu = await sidsSurLeTrunk(trunkFait);
    if (vu === 'tous') {
      /* Un ensemble qui contient tout: chaque numéro est considéré déjà
         rattaché, donc aucun appel de trunking ne sera fait. */
      surLeTrunk = { has: () => true, add: () => undefined } as unknown as Set<string>;
      console.log('--trunk-fait: rattachement supposé fait dans la console, seul le stock est écrit.\n');
    } else {
      surLeTrunk = vu;
      console.log(`${vu.size} numéro(s) déjà rattaché(s) au trunk ${env.TWILIO_SIP_TRUNK_SID}.\n`);
    }
  } catch (e) {
    console.error(
      `\nLe trunk ${env.TWILIO_SIP_TRUNK_SID} est injoignable — ${(e as Error).message}\n` +
        "Si les numéros sont déjà rattachés dans la console Twilio (onglet Numbers du trunk),\n" +
        'relancer avec  --confirm --trunk-fait  pour n\'écrire que le stock.\n',
    );
    return;
  }

  let repaired = 0;

  for (const n of missing) {
    try {
      const sipTrunkSid = await rattacherAuTrunk(n, surLeTrunk);
      const clientId = proprietaire(n.phoneNumber);
      await prisma.phoneNumberStock.create({
        data: {
          number: n.phoneNumber,
          country: 'BE',
          numberType: 'mobile',
          twilioSid: n.sid,
          sipTrunkSid,
          bundleSid: env.TWILIO_BE_BUNDLE_SID || null,
          /* UN NUMÉRO QUE QUELQU'UN TIENT DÉJÀ N'EST PAS LIBRE. L'écrire
             `available` le rendrait attribuable à un second client, qui
             prendrait la ligne du premier — sans que rien ne le dise, et en
             appel seulement. */
          ...(clientId
            ? { status: 'assigned', clientId, assignedAt: new Date() }
            : { status: 'available' }),
          notes: 'Récupéré par phone:adopt (acheté hors du script).',
        },
      });
      repaired++;
      console.log(
        `  OK   ${n.phoneNumber} rangé dans le stock, ${clientId ? `attribué à ${clientId}` : 'libre'}.`,
      );
    } catch (e) {
      /* On n'écrit PAS de ligne sans acheminement ici: elle rejoindrait
         aussitôt la catégorie « en stock mais injoignable », qui est
         exactement ce que ce script est censé résorber. */
      console.error(`  ÉCHEC ${n.phoneNumber} — ${(e as Error).message}`);
    }
  }

  for (const n of nonAchemines) {
    const row = byNumber.get(n.phoneNumber)!;
    try {
      const sipTrunkSid = await rattacherAuTrunk(n, surLeTrunk);
      await prisma.phoneNumberStock.update({
        where: { id: row.id },
        data: { sipTrunkSid, notes: null, ...(row.twilioSid ? {} : { twilioSid: n.sid }) },
      });
      repaired++;
      console.log(`  OK   ${n.phoneNumber} rattaché au trunk, désormais attribuable.`);
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
