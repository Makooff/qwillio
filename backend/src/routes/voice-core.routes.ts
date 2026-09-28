import { Router } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { voiceCoreAuth } from '../middleware/voice-core.middleware';
import { realtimeContextService, shouldRecord } from '../services/voice/realtime-context.service';
import { twilioRecordingService } from '../services/voice/twilio-recording.service';
import { clientCallService } from '../services/client-call.service';
import { toolRuntimeService } from '../services/voice/tool-runtime.service';
import { callerMemoryService } from '../services/voice/caller-memory.service';

/**
 * Le pont vers `qwillio-voice-core` — /api/voice-core/*
 *
 * Deux routes, et c'est tout le contrat. `voice-core` n'écrit JAMAIS dans
 * cette base : deux processus qui écrivent le même agenda avec deux logiques
 * de verrouillage produisent des doubles réservations qu'aucun des deux ne
 * voit. Tout passe par ici.
 *
 *   GET  /api/voice-core/context/by-number/:trunkNumber   au décroché
 *   POST /api/voice-core/calls                            en fin d'appel
 *
 * ADDITIF, au sens strict : aucune route existante n'est modifiée, aucune
 * colonne n'est ajoutée, et rien dans ce fichier ne s'exécute tant qu'un
 * numéro ne pointe pas vers `voice-core` dans la console Twilio. La bascule
 * se fait numéro par numéro, et revenir en arrière, c'est remettre l'ancienne
 * URI d'origination sur ce numéro-là. Aucun code à redéployer.
 */

const router = Router();
router.use(voiceCoreAuth);

/**
 * Les écritures d'un même numéro.
 *
 * Le même téléphone s'écrit `+32460258033` chez Twilio, `32460258033` dans un
 * import et `0460258033` quand le client le tape lui-même. Une égalité exacte
 * ratait le client sans rien dire — la requête réussissait et ne trouvait
 * rien : l'agent décrochait alors sur le profil générique, au nom de
 * « Qwillio », chez un client qui paie pour son propre nom.
 */
export function ecrituresDuNumero(brut: string): string[] {
  const chiffres = (brut || '').replace(/\D/g, '');
  if (!chiffres) return [];
  const formes = new Set<string>([brut.trim(), chiffres, `+${chiffres}`]);
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

/** GET /api/voice-core/context/by-number/:trunkNumber — le profil au décroché. */
router.get('/context/by-number/:trunkNumber', async (req, res) => {
  const appele = String(req.params.trunkNumber || '');
  const formes = ecrituresDuNumero(appele);
  if (!formes.length) return res.status(400).json({ error: 'bad_number' });

  try {
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { vapiPhoneNumber: { in: formes } },
          { phoneNumbers: { some: { number: { in: formes }, isActive: true } } },
        ],
      },
      select: { id: true },
    });
    if (!client) return res.status(404).json({ error: 'unknown_number' });

    /* On NE RECONSTRUIT PAS le profil ici. `realtimeContextService` est déjà
       la source de vérité du portail et de l'agent Vapi : une seconde lecture
       écrite à la main divergerait de la première au premier réglage ajouté,
       et l'écart ne se verrait qu'en appel. */
    const profil = await realtimeContextService.getClientProfile(client.id);
    if (!profil) return res.status(404).json({ error: 'unknown_client' });

    /* LA SURCHARGE PAR LIGNE. Un client peut avoir « Boutique Ixelles » et
       « Ligne urgences », chacune avec son agent, ses consignes et son numéro
       de transfert. L'ignorer ferait répondre l'atelier au nom de la boutique
       — et le produit vend déjà cette distinction. */
    const ligne = await prisma.clientPhoneNumber.findFirst({
      where: { clientId: client.id, number: { in: formes }, isActive: true },
      select: { agentName: true, greeting: true, instructions: true, transferNumber: true },
    });

    /* Les consignes de la ligne S'AJOUTENT à celles du client, elles ne les
       remplacent pas : c'est ce que dit le schéma, et un client qui règle une
       ligne ne veut pas perdre ses consignes générales. */
    const consignes = [profil.instructions, ligne?.instructions]
      .filter((x): x is string => Boolean(x && x.trim()))
      .join('\n');

    /* TOUTES les lignes qui aboutissent à l'IA. Ce n'est pas décoratif : sans
       cette liste, `voice-core` transfère vers une ligne renvoyée vers lui, et
       l'appelant entend la réceptionniste en boucle pendant qu'on facture les
       minutes. Voir `transfer-loop.ts`, même garde-fou des deux côtés. */
    const lignes = [
      profil.inboundNumber,
      ...(profil.inboundLines || []).map((l: { number: string }) => l.number),
    ].filter((n): n is string => Boolean(n));

    return res.json({
      clientId: profil.clientId,
      /* L'ENREGISTREMENT SE DIT PAR CLIENT, PAS PAR WORKER.
         `voice-core` avait son propre VC_RECORDING, un booléen d'environnement
         valable pour tout le monde à la fois: un client qui coupe
         l'enregistrement dans son portail restait enregistré, et un client qui
         l'accepte n'entendait rien annoncer. Le réglage voyage donc avec le
         profil, comme la langue et les horaires, et c'est LUI qui décide à la
         fois de la notice dite à l'appelant et du démarrage de
         l'enregistrement. Un seul prédicat pour les deux: `shouldRecord`. */
      enregistrement: shouldRecord(profil),
      business: profil.businessName,
      businessType: profil.businessType,
      agent: ligne?.agentName || profil.agentName,
      language: profil.language,
      notes: consignes,
      greeting: ligne?.greeting || null,
      transferNumber: ligne?.transferNumber || profil.transferNumber || null,
      transferMode: profil.transferMode || 'always',
      forwardingType: profil.forwardingType || null,

      /* LES HORAIRES DU CLIENT, et ils ne passaient pas (28/09/2026).
         `voice-core` décidait avec une table écrite en dur dans `storage.py` —
         lundi-vendredi 9 h-18 h, samedi 9 h-13 h — qui ne sont les horaires de
         personne. Un client règle ses heures dans le portail, l'écran les
         affiche, l'agenda les respecte, et l'agent proposait mercredi 9 h chez
         un commerce fermé le mercredi.
         C'est l'incident du 12/09 (rendez-vous pris un dimanche chez un
         commerce fermé le dimanche) réapparu dans le nouveau moteur, pour la
         même raison : les horaires n'étaient lus nulle part. */
      openingHours: profil.weekHours || null,
      /* La FORME PARLÉE des mêmes horaires, déjà construite ici. L'agent la
         dit à voix haute ; la reconstruire côté Python aurait donné deux
         phrases différentes pour les mêmes heures. */
      openingHoursSpoken: profil.openingHours || null,
      /* Le fuseau de l'entreprise, la même règle que l'agenda et les créneaux :
         `businessTimezone`. Un agent qui calcule « demain » dans un autre
         fuseau se trompe de jour une nuit sur deux. */
      timezone: profil.timezone || null,
      services: profil.services || [],
      bookingEnabled: profil.bookingEnabled !== false,
      lines: [...new Set(lignes)],
      phoneNumber: profil.inboundNumber,
    });
  } catch (error) {
    logger.error('[voice-core] contexte illisible:', error);
    return res.status(500).json({ error: 'context_failed' });
  }
});

/**
 * POST /api/voice-core/calls/start — l'appel qui commence.
 *
 * Pour que le gérant voie l'appel PENDANT qu'il a lieu, et pas trois minutes
 * après. La colonne `status` de `ClientCall` vaut `in-progress` par défaut :
 * le schéma attendait cette ligne depuis le début.
 *
 * On NE passe PAS par un websocket. `emitEvent` diffuse à tous les navigateurs
 * connectés sans filtrer par client : y mettre un numéro d'appelant le
 * montrerait au tableau de bord de tous les autres. La ligne en base est lue
 * par le client concerné, et par lui seul.
 *
 * Elle ne bloque jamais le décroché : `voice-core` l'appelle sans l'attendre.
 */
router.post('/calls/start', async (req, res) => {
  const { clientId, room, caller, trunkNumber, brain, twilioCallSid } = req.body || {};
  if (!clientId || !room) return res.status(400).json({ error: 'missing_room_or_client' });

  try {
    const salle = String(room);
    const appel = await prisma.clientCall.upsert({
      where: { vapiCallId: salle },
      create: {
        clientId: String(clientId),
        vapiCallId: salle,
        callerNumber: caller ? String(caller) : null,
        direction: 'inbound',
        status: 'in-progress',
        startedAt: new Date(),
        metadata: { source: 'voice-core', room: salle, brain: brain ?? null,
                    trunkNumber: trunkNumber ?? null, live: true },
      },
      /* Un rejeu ne réécrit rien : si la fiche existe déjà, l'appel est plus
         avancé que ce message-ci. */
      update: {},
      select: { id: true, metadata: true },
    });

    /* L'ENREGISTREMENT DÉMARRE ICI, PAS SUR LE TRUNK.

       Le trunk sait enregistrer tout seul, et c'est justement le piège: son
       réglage vaut pour tous les clients qui passent par lui. Démarré ici, il
       n'existe QUE pour un client qui l'accepte — pour celui qui a coupé,
       l'enregistrement n'a jamais lieu, ce qui n'est pas la même chose que de
       l'effacer après coup.

       Au décroché et pas en fin d'appel, évidemment: on n'enregistre pas le
       passé. Et sans attendre — la réponse est déjà ce que `voice-core`
       attend pour afficher l'appel en cours, et un enregistrement qui tarde
       d'une seconde vaut mieux qu'un décroché qui tarde d'une seconde. */
    res.status(201).json({ id: appel.id });

    if (twilioCallSid) {
      void (async () => {
        try {
          const profil = await realtimeContextService.getClientProfile(String(clientId));
          if (profil && !shouldRecord(profil)) {
            logger.info(`[voice-core] ${clientId} a coupé l'enregistrement — appel non enregistré.`);
            return;
          }
          const sid = await twilioRecordingService.demarrer(String(twilioCallSid));
          if (!sid) return;
          /* Le SID est rangé sur la fiche pour que la fin d'appel n'ait pas à
             redemander à Twilio ce qu'on savait déjà — et pour qu'un appel
             dont la remontée se perd garde quand même la trace de son audio,
             seul moyen de le purger plus tard. */
          await prisma.clientCall.update({
            where: { id: appel.id },
            data: {
              metadata: {
                ...((appel.metadata as Record<string, unknown> | null) ?? {}),
                recordingSid: sid,
              },
            },
          });
        } catch (e) {
          logger.error(`[voice-core] enregistrement non démarré pour ${salle}: ${(e as Error).message}`);
        }
      })();
    }
    return;
  } catch (error) {
    logger.error('[voice-core] appel en cours non affiché:', error);
    return res.status(500).json({ error: 'start_failed' });
  }
});

/* LES APPELS EN COURS DE TRAITEMENT, en mémoire.
 *
 * Deuxième verrou, devant celui de la base. `handleClientCallCompleted` met
 * plusieurs secondes (analyse GPT-4), et pendant ce temps aucune ligne
 * n'existe encore : deux remontées du même appel qui se croisent passeraient
 * toutes les deux la vérification en base et créeraient deux fiches, donc
 * deux fois les minutes facturées.
 *
 * En mémoire et non en base parce que c'est un verrou de quelques secondes :
 * il n'a pas à survivre à un redémarrage, et s'il disparaît la vérification
 * en base reprend la main. */
const enCours = new Set<string>();

/**
 * POST /api/voice-core/calls — l'appel terminé.
 *
 * NE FAIT PAS l'écriture lui-même. Il passe l'appel à
 * `clientCallService.handleClientCallCompleted`, c'est-à-dire exactement le
 * chemin que prend déjà un appel Vapi en fin de course. C'est ce qui branche
 * `voice-core` sur ce qui existe : le bouclier anti-spam, l'analyse du
 * transcript, le nom confirmé de l'appelant, le score de lead, la fiche CRM,
 * la réservation de rattrapage, les alertes, le quota du forfait, et
 * l'échéance de conservation (LEG-4). Une écriture directe dans `ClientCall`
 * — ce que faisait la première version — remplissait le tableau de bord de
 * lignes vides : pas de résumé, pas de sentiment, pas de lead, pas de date
 * limite. Deux chemins d'écriture pour la même table finissent toujours par
 * diverger, et c'est le nouveau qui perd, parce que personne ne le regarde.
 *
 * RÉPOND AVANT DE TRAVAILLER. L'analyse appelle GPT-4 ; `voice-core` coupe sa
 * remontée à 10 s et l'émet depuis son `shutdown_callback`, donc une réponse
 * synchrone lui ferait journaliser « remontée perdue » sur un appel
 * parfaitement enregistré, et retarderait d'autant la fermeture du worker.
 * Le prix : si ce processus meurt dans l'intervalle, la fiche est perdue. Le
 * même prix qu'aujourd'hui quand la requête échoue, et `voice-core` écrit la
 * charge utile dans son log dans les deux cas.
 */
router.post('/calls', async (req, res) => {
  const { room, caller, trunkNumber, clientId, brain, startedAt, durationSeconds, latency, transcript,
          twilioCallSid } = req.body || {};

  if (!room || !clientId) {
    return res.status(400).json({ error: 'missing_room_or_client' });
  }

  const salle = String(room);

  try {
    if (enCours.has(salle)) return res.status(202).json({ room: salle, pending: true });

    /* La room LiveKit est l'identifiant naturel : une room, un appel.
       MAIS une fiche `in-progress` n'est PAS un appel déjà traité : c'est le
       placeholder posé au décroché pour que le gérant voie l'appel en direct.
       Le confondre avec un doublon ferait sauter tout le traitement de fin
       d'appel — transcript, résumé, lead — sur CHAQUE appel. */
    const deja = await prisma.clientCall.findUnique({
      where: { vapiCallId: salle },
      select: { id: true, status: true },
    });
    if (deja && deja.status !== 'in-progress') {
      return res.status(200).json({ id: deja.id, already: true });
    }

    enCours.add(salle);
    res.status(202).json({ room: salle, accepted: true });
  } catch (error) {
    logger.error('[voice-core] remontée refusée:', error);
    return res.status(500).json({ error: 'record_failed' });
  }

  /* À partir d'ici la réponse est partie. Plus rien ne doit remonter à
     l'appelant, et rien ne doit sortir de ce bloc : une exception non
     rattrapée dans un handler déjà répondu tue le processus. */
  try {
    const duree = Number.isFinite(Number(durationSeconds))
      ? Math.max(0, Math.trunc(Number(durationSeconds)))
      : 0;

    /* Le placeholder s'efface juste avant que le service écrive la vraie
       fiche. `handleClientCallCompleted` fait un `create`, pas un `upsert` —
       le laisser en place le ferait échouer sur la contrainte d'unicité de
       `vapiCallId`. La fenêtre est de quelques millisecondes et l'appel est
       terminé : personne ne regarde cette ligne à cet instant. */
    await prisma.clientCall.deleteMany({
      where: { vapiCallId: salle, status: 'in-progress' },
    });

    const enregistrement = twilioCallSid
      ? await twilioRecordingService.delAppel(String(twilioCallSid))
      : null;

    await clientCallService.handleClientCallCompleted(
      String(clientId),
      salle,
      typeof transcript === 'string' ? transcript : '',
      duree,
      caller ? String(caller) : undefined,
      /* L'ENREGISTREMENT, s'il y en a eu un.

         Demandé à Twilio plutôt que déduit du SID posé au décroché: seule la
         fin d'appel sait si l'enregistrement s'est terminé, et une URL rendue
         pour un média encore en traitement répondrait 404 au portail — pire
         qu'une absence d'URL, qui elle au moins se dit. `delAppel` rend null
         dans ce cas, et la ligne reste simplement sans audio.

         Une absence ici n'est PAS une anomalie: c'est l'état normal d'un
         client qui a coupé l'enregistrement. */
      enregistrement?.url,
      /* `voiceMode` RESTE NULL, volontairement. Le schéma dit « null =
         inconnu, donc jamais facturé », et les deux valeurs qu'il accepte
         ('realtime' | 'classic') décrivent le moteur Vapi, pas les cerveaux
         de `voice-core`. Écrire 'realtime' ici parce que `VC_BRAIN=realtime`
         facturerait l'option Superagent à des clients qui ne l'ont pas
         achetée. Le cerveau réel est dans `metadata` ; la règle de
         facturation est une décision produit, elle se prendra en la voyant,
         pas par effet de bord d'un nom qui se ressemble. */
      null,
    );

    /* Ce que le service ne sait pas écrire, parce que ça n'existe pas chez
       Vapi : d'où vient l'appel, quel cerveau a parlé, et ses latences.
       `startedAt` aussi : le service le déduit de `Date.now() - durée`, ce qui
       décale l'appel du temps qu'a mis cette requête. `voice-core` a l'heure
       exacte, autant s'en servir. */
    const debutReel = startedAt ? new Date(String(startedAt)) : null;
    await prisma.clientCall.update({
      where: { vapiCallId: salle },
      data: {
        ...(debutReel && !Number.isNaN(debutReel.getTime()) ? { startedAt: debutReel } : {}),
        metadata: {
          source: 'voice-core',
          room: salle,
          brain: brain ?? null,
          trunkNumber: trunkNumber ?? null,
          latency: latency ?? null,
        },
      },
    });

    /* LA MÉMOIRE DE L'APPELANT, écrite à la fin de CHAQUE appel.

       Elle vivait dans `realtime-orchestrator.persistMemory`, que `voice-core`
       ne traverse plus. Résultat, jusqu'ici: seule la capture d'un lead en
       laissait une trace. Un appelant qui réservait, ou qui posait une
       question et raccrochait, repartait sans rien — et au rappel suivant
       l'agent redemandait son nom et son motif comme au premier jour, alors
       que `GET /caller` était là, prêt à les lui donner. Lire une mémoire que
       presque personne n'alimente, c'est la même chose que ne pas en avoir.

       Ordre des champs repris tel quel de l'ancienne route, y compris son
       correctif du 13/09: `nameCollected` porte le nom CONFIRMÉ (réservation
       relue, mémoire), le lead capté en cours d'appel porte le nom ENTENDU.
       L'ordre inverse réécrivait un nom approximatif à chaque appel.

       Jamais bloquant: la mémoire est un confort, l'appel est déjà fini, et la
       fiche est écrite. */
    const fiche = await prisma.clientCall.findUnique({
      where: { vapiCallId: salle },
      select: { summary: true, outcome: true, nameCollected: true, emailCollected: true },
    });
    void callerMemoryService
      .remember({
        clientId: String(clientId),
        callerNumber: caller ? String(caller) : null,
        name: fiche?.nameCollected ?? null,
        email: fiche?.emailCollected ?? null,
        summary: fiche?.summary ?? null,
        outcome: fiche?.outcome ?? null,
      })
      .catch((e: Error) => logger.warn(`[voice-core] mémoire d'appelant non écrite: ${e.message}`));

    logger.info(`[voice-core] appel enregistré : ${salle} (${duree}s, ${brain ?? 'cerveau inconnu'})`);
  } catch (error) {
    /* La réponse est déjà partie : `voice-core` croit la remontée passée, et
       elle l'est — c'est le traitement qui a échoué. Ce log est la seule
       trace, d'où le niveau et la charge utile complète. */
    logger.error(`[voice-core] traitement de l'appel ${salle} échoué:`, error);
  } finally {
    enCours.delete(salle);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   LES RENDEZ-VOUS

   `voice-core` tenait les siens dans un fichier SQLite posé à côté du worker.
   Ça marche en démonstration et nulle part ailleurs : le rendez-vous
   n'apparaît pas au tableau de bord, n'entre pas dans l'agenda Google du
   client, ne déclenche ni SMS de confirmation, ni rappel la veille, ni fiche
   CRM — et il disparaît avec le portable qui l'héberge. Le gérant, lui, a
   entendu « c'est noté ».

   Ces routes ramènent l'écriture ICI, dans la table que le portail affiche et
   que la réconciliation d'agenda balaie déjà.

   PARTAGE DES RÔLES, et il est net. `voice-core` décide : quel jour, quel
   créneau, quel nom — il a les horaires, la borne d'horizon, le jour de
   fermeture, et la relecture épelée du nom. Ces routes ENREGISTRENT, et
   déclenchent ce qui suit un enregistrement. Elles ne reparsent pas une date
   et ne rejugent pas un créneau : deux avis sur la même question finissent
   par diverger, et c'est le second qu'on ne relit pas.

   MIDI UTC pour `bookingDate`, comme `parseDate` de `tool-runtime.service`.
   Ce n'est pas un détail esthétique : l'index unique anti-double-réservation
   porte sur (client, date, heure), et une date posée à minuit ne se heurterait
   pas à une date posée à midi. Deux conventions, deux rendez-vous, même
   créneau.
   ══════════════════════════════════════════════════════════════════════════ */

/** `YYYY-MM-DD` → l'instant que la plateforme stocke pour ce jour-là. */
function jourEnDate(ymd: unknown): Date | null {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null;
  const d = new Date(`${ymd.trim()}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** L'inverse, pour rendre à `voice-core` la forme qu'il manipule. */
function dateEnJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** La forme d'un rendez-vous côté `voice-core` (son dataclass `Booking`). */
function enBooking(b: {
  id: string; clientId: string; bookingDate: Date; bookingTime: string | null;
  customerPhone: string | null; customerName: string; serviceType: string | null; status: string;
  customerEmail?: string | null; partySize?: number | null; specialRequests?: string | null;
}) {
  return {
    id: b.id,
    clientId: b.clientId,
    day: dateEnJour(b.bookingDate),
    slot: b.bookingTime || '',
    caller: b.customerPhone || '',
    name: b.customerName,
    service: b.serviceType || '',
    status: b.status,
    /* Les trois détails RENVOYÉS, pas seulement acceptés. `voice-core` relit
       la réservation qu'il vient d'écrire pour la relire à voix haute et pour
       la retrouver au rappel ; les taire ici ferait dire « c'est noté » sur
       un nombre de couverts que l'agent ne saurait plus. */
    email: b.customerEmail || '',
    partySize: b.partySize ?? 0,
    notes: b.specialRequests || '',
  };
}

const CHAMPS = {
  id: true, clientId: true, bookingDate: true, bookingTime: true,
  customerPhone: true, customerName: true, serviceType: true, status: true,
  customerEmail: true, partySize: true, specialRequests: true,
} as const;

/** Postgres refuse le doublon par l'index partiel : c'est le seul juge. */
function estCreneauPris(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'P2002';
}

/** GET /api/voice-core/bookings/day — les créneaux DÉJÀ PRIS ce jour-là. */
router.get('/bookings/day', async (req, res) => {
  const clientId = String(req.query.clientId || '');
  const jour = jourEnDate(req.query.day);
  if (!clientId || !jour) return res.status(400).json({ error: 'bad_client_or_day' });

  try {
    const pris = await prisma.clientBooking.findMany({
      where: { clientId, bookingDate: jour, status: 'confirmed', bookingTime: { not: null } },
      select: { bookingTime: true },
    });
    return res.json({ slots: pris.map((p) => p.bookingTime).filter(Boolean) });
  } catch (error) {
    logger.error('[voice-core] créneaux illisibles:', error);
    return res.status(500).json({ error: 'slots_failed' });
  }
});

/** GET /api/voice-core/bookings/caller — les rendez-vous de ce numéro. */
router.get('/bookings/caller', async (req, res) => {
  const clientId = String(req.query.clientId || '');
  const caller = String(req.query.caller || '');
  if (!clientId || !caller) return res.status(400).json({ error: 'bad_client_or_caller' });

  try {
    /* Les DEUX écritures du numéro, comme `findCallerBookings`: le portail en
       enregistre une, Twilio en présente une autre. */
    const formes = ecrituresDuNumero(caller);
    const bs = await prisma.clientBooking.findMany({
      where: { clientId, customerPhone: { in: formes }, status: 'confirmed' },
      select: CHAMPS,
      orderBy: [{ bookingDate: 'asc' }, { bookingTime: 'asc' }],
      take: 20,
    });
    return res.json({ bookings: bs.map(enBooking) });
  } catch (error) {
    logger.error('[voice-core] rendez-vous de l\'appelant illisibles:', error);
    return res.status(500).json({ error: 'caller_bookings_failed' });
  }
});

/** GET /api/voice-core/bookings/upcoming — les rendez-vous à venir du client. */
router.get('/bookings/upcoming', async (req, res) => {
  const clientId = String(req.query.clientId || '');
  if (!clientId) return res.status(400).json({ error: 'bad_client' });
  const limite = Math.min(300, Math.max(1, Number(req.query.limit) || 300));

  try {
    const bs = await prisma.clientBooking.findMany({
      where: { clientId, status: 'confirmed', bookingDate: { gte: new Date(Date.now() - 86_400_000) } },
      select: CHAMPS,
      orderBy: [{ bookingDate: 'asc' }, { bookingTime: 'asc' }],
      take: limite,
    });
    return res.json({ bookings: bs.map(enBooking) });
  } catch (error) {
    logger.error('[voice-core] rendez-vous à venir illisibles:', error);
    return res.status(500).json({ error: 'upcoming_failed' });
  }
});

/**
 * POST /api/voice-core/bookings — le rendez-vous, et tout ce qui le suit.
 *
 * L'écriture est synchrone et son résultat est rendu : l'agent a déjà la
 * phrase « c'est noté » en bouche, il doit savoir si c'est vrai. L'agenda et
 * le SMS partent APRÈS, sans être attendus — la réservation existe, la ligne
 * en base fait foi, et un agenda Google lent ne doit pas tenir un appelant en
 * ligne. C'est exactement l'ordre qu'applique `bookAppointment`.
 */
router.post('/bookings', async (req, res) => {
  const { clientId, day, slot, caller, name, service, email, partySize, notes } =
    req.body || {};
  const jour = jourEnDate(day);
  const heure = typeof slot === 'string' && /^\d{2}:\d{2}$/.test(slot) ? slot : null;
  if (!clientId || !jour || !heure || !name) {
    return res.status(400).json({ error: 'missing_booking_fields' });
  }

  /* LES TROIS DÉTAILS, VALIDÉS ICI ET NON EN AMONT.
     `customer_email`, `party_size` et `special_requests` existent dans
     `client_bookings` depuis le début et la voix ne les remplissait pas : le
     restaurant recevait une table sans couverts, le salon un rendez-vous sans
     adresse à qui écrire. Ils arrivent d'un modèle de langue, donc ils sont
     bornés ici — c'est la dernière frontière avant la base, et la seule que
     rien ne contourne. `partySize` est un entier de colonne : un « 200 » dicté
     par erreur, ou un flottant, casserait l'écriture au lieu du rendez-vous. */
  const courriel = typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(email.trim())
    ? email.trim().toLowerCase().slice(0, 255)
    : null;
  const couverts = Number.isInteger(Number(partySize)) && Number(partySize) > 0
    ? Math.min(Number(partySize), 500)
    : null;
  const demandes = typeof notes === 'string' && notes.trim()
    ? notes.trim().slice(0, 500)
    : null;

  let cree;
  try {
    cree = await prisma.clientBooking.create({
      data: {
        clientId: String(clientId),
        bookingDate: jour,
        bookingTime: heure,
        customerName: String(name),
        customerPhone: caller ? String(caller) : null,
        serviceType: service ? String(service) : null,
        customerEmail: courriel,
        partySize: couverts,
        specialRequests: demandes,
        status: 'confirmed',
      },
      select: CHAMPS,
    });
  } catch (error) {
    /* LE CRÉNEAU VIENT D'ÊTRE PRIS. Ce n'est pas une panne, c'est deux
       personnes qui appellent pour le même mardi 14 h. L'agent doit en
       proposer un autre, pas s'excuser d'une erreur technique. */
    if (estCreneauPris(error)) return res.status(409).json({ error: 'slot_taken' });
    logger.error('[voice-core] réservation refusée:', error);
    return res.status(500).json({ error: 'booking_failed' });
  }

  res.status(201).json({ booking: enBooking(cree) });

  /* Après la réponse. Rien ici ne doit pouvoir sortir : le handler a déjà
     répondu, et une exception non rattrapée tuerait le processus. */
  void (async () => {
    try {
      await toolRuntimeService.syncBookingToCalendar(String(clientId), cree.id);
    } catch (error) {
      logger.warn(`[voice-core] agenda non synchronisé (${cree.id}): ${(error as Error).message}`);
    }
    try {
      if (!cree.customerPhone) return;
      const profil = await realtimeContextService.getClientProfile(String(clientId));
      if (!profil) return;
      await toolRuntimeService.sendBookingSms(
        profil, cree.id, cree.customerPhone, cree.customerName,
        cree.bookingDate, heure, cree.serviceType,
      );
    } catch (error) {
      logger.warn(`[voice-core] SMS de confirmation non parti (${cree.id}): ${(error as Error).message}`);
    }
  })();
});

/** PATCH /api/voice-core/bookings/:id — déplacer. */
router.patch('/bookings/:id', async (req, res) => {
  const { clientId, day, slot } = req.body || {};
  const jour = jourEnDate(day);
  const heure = typeof slot === 'string' && /^\d{2}:\d{2}$/.test(slot) ? slot : null;
  if (!clientId || !jour || !heure) return res.status(400).json({ error: 'missing_booking_fields' });

  try {
    /* `updateMany` avec le clientId dans le WHERE, jamais `update` sur le
       seul id : un identifiant deviné ne doit pas déplacer le rendez-vous
       d'un autre commerce. */
    const touche = await prisma.clientBooking.updateMany({
      where: { id: String(req.params.id), clientId: String(clientId), status: 'confirmed' },
      data: { bookingDate: jour, bookingTime: heure, calendarSyncedAt: null },
    });
    if (!touche.count) return res.status(404).json({ error: 'unknown_booking' });

    const maj = await prisma.clientBooking.findUnique({
      where: { id: String(req.params.id) },
      select: CHAMPS,
    });
    res.json({ booking: maj ? enBooking(maj) : null });

    void toolRuntimeService
      .syncBookingToCalendar(String(clientId), String(req.params.id))
      .catch((e) => logger.warn(`[voice-core] agenda non resynchronisé: ${e.message}`));
    return;
  } catch (error) {
    if (estCreneauPris(error)) return res.status(409).json({ error: 'slot_taken' });
    logger.error('[voice-core] déplacement refusé:', error);
    return res.status(500).json({ error: 'reschedule_failed' });
  }
});

/**
 * POST /api/voice-core/bookings/:id/cancel — annuler.
 *
 * On passe le statut à `cancelled`, on ne supprime pas : l'index unique est
 * PARTIEL (restreint aux `confirmed`), donc l'annulation libère le créneau
 * d'elle-même, et la trace reste pour le gérant.
 */
router.post('/bookings/:id/cancel', async (req, res) => {
  const { clientId } = req.body || {};
  if (!clientId) return res.status(400).json({ error: 'bad_client' });

  try {
    const touche = await prisma.clientBooking.updateMany({
      where: { id: String(req.params.id), clientId: String(clientId), status: 'confirmed' },
      data: { status: 'cancelled' },
    });
    if (!touche.count) return res.status(404).json({ error: 'unknown_booking' });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('[voice-core] annulation refusée:', error);
    return res.status(500).json({ error: 'cancel_failed' });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   CE QUI RESTAIT DANS SQLITE

   Les rendez-vous sont partis les premiers. Restaient les leads, la base de
   connaissance, le journal des lacunes et la memoire d'appelant — tous les
   quatre dans `voice-core.db`, un fichier pose a cote du worker.

   Tant qu'il existe, le worker n'est pas sans etat : il lui faut un disque,
   donc une instance unique, donc un plan, donc une region. Et le jour ou l'on
   met deux workers pour absorber les appels simultanes, deux SQLite divergent
   sans que personne le voie.

   Ces quatre routes finissent le travail. Apres elles, le worker est du calcul
   pur : il se deploie n'importe ou, se duplique, se redeploie sans rien
   perdre — et le choix de l'hebergeur redevient une question de prix,
   revisable, au lieu d'une decision d'architecture.

   Les quatre tables existaient DEJA dans ce schema. SQLite etait l'echafaudage
   qui a permis a `voice-core` d'exister avant le pont.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/voice-core/leads — la fiche de rappel.
 *
 * Ecrit une `AgentCrmActivity` de type `lead_capture`, exactement comme le
 * fait `captureLead` pour Vapi : c'est la ligne durable ET la charge utile que
 * la synchro CRM externe draine. Ecrire ailleurs aurait produit des leads que
 * le CRM ne voit pas — precisement l'ecart que ce pont existe pour fermer.
 *
 * La memoire d'appelant suit, en tache de fond : c'est un supplement, et un
 * supplement ne doit jamais faire echouer la fiche qu'il enrichit.
 */
router.post('/leads', async (req, res) => {
  const { clientId, caller, name, reason, email, adresse, pourQui, quand, urgence, room } =
    req.body || {};
  if (!clientId) return res.status(400).json({ error: 'bad_client' });

  try {
    const profil = await realtimeContextService.getClientProfile(String(clientId));
    const telephone = caller ? String(caller) : null;

    const activite = await prisma.agentCrmActivity.create({
      data: {
        clientId: String(clientId),
        type: 'lead_capture',
        status: 'pending',
        content: {
          source: 'voice-core',
          vapiCallId: room ? String(room) : null,
          capturedAt: new Date().toISOString(),
          contact: {
            name: name ? String(name) : null,
            email: email ? String(email) : null,
            phone: telephone,
            address: adresse ? String(adresse) : null,
          },
          reason: reason ? String(reason) : '',
          /* `voice-core` parle francais, le CRM attend low|normal|high. */
          urgency: urgence === 'urgente' ? 'high' : urgence === 'faible' ? 'low' : 'normal',
          forPerson: pourQui ? String(pourQui).slice(0, 40) : null,
          callbackWhen: quand ? String(quand).slice(0, 40) : null,
          language: profil?.language ?? 'fr',
          businessName: profil?.businessName ?? null,
        },
      },
      select: { id: true },
    });

    res.status(201).json({ id: activite.id });

    void callerMemoryService
      .remember({
        clientId: String(clientId),
        callerNumber: telephone,
        name: name ? String(name) : null,
        email: email ? String(email) : null,
        summary: reason ? String(reason) : null,
        outcome: 'lead',
      })
      .catch((e: Error) => logger.warn(`[voice-core] memoire d'appelant non ecrite: ${e.message}`));
    return;
  } catch (error) {
    logger.error('[voice-core] lead refuse:', error);
    return res.status(500).json({ error: 'lead_failed' });
  }
});

/**
 * GET /api/voice-core/knowledge — ce que le commerce sait.
 *
 * Lu UNE FOIS au decroche, pas par tour : un acces reseau au milieu d'un tour
 * est une latence que l'appelant entend.
 *
 * On ne rend PAS `embedding`. `voice-core` fait une recherche lexicale en
 * microsecondes la ou l'ancien lancait un aller-retour d'embedding sur un tour
 * que l'appelant attend ; transporter le vecteur serait payer le poids d'une
 * fonctionnalite qu'on a delibrement retiree.
 */
router.get('/knowledge', async (req, res) => {
  const clientId = String(req.query.clientId || '');
  if (!clientId) return res.status(400).json({ error: 'bad_client' });

  try {
    const entrees = await prisma.businessKnowledge.findMany({
      where: { clientId, isActive: true },
      select: { id: true, kind: true, title: true, content: true, keywords: true, priority: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 500,
    });
    return res.json({
      entries: entrees.map((e) => ({
        id: e.id,
        genre: e.kind,
        titre: e.title,
        contenu: e.content,
        mots_cles: e.keywords ?? [],
        priorite: e.priority,
      })),
    });
  } catch (error) {
    logger.error('[voice-core] connaissance illisible:', error);
    return res.status(500).json({ error: 'knowledge_failed' });
  }
});

/**
 * POST /api/voice-core/knowledge-gaps — la question restee sans reponse.
 *
 * Regroupee par empreinte, avec le nombre de fois qu'elle a ete posee et la
 * formulation la plus recente — dans les mots de l'appelant, seul moment ou
 * elle existe. Sans ca, l'agent promet de faire remonter la question et la
 * question s'arrete la : le gerant ne l'apprend pas, la base ne grossit pas,
 * et l'appelant suivant repose la meme question pour la meme absence de
 * reponse.
 *
 * `upsert` sur (clientId, fingerprint), qui est l'index unique du schema :
 * c'est la base qui compte, pas nous.
 */
router.post('/knowledge-gaps', async (req, res) => {
  const { clientId, empreinte, question, langue } = req.body || {};
  if (!clientId || !empreinte || !question) {
    return res.status(400).json({ error: 'missing_gap_fields' });
  }

  try {
    await prisma.knowledgeGap.upsert({
      where: {
        clientId_fingerprint: { clientId: String(clientId), fingerprint: String(empreinte) },
      },
      create: {
        clientId: String(clientId),
        fingerprint: String(empreinte),
        question: String(question).slice(0, 500),
        language: ['fr', 'en', 'nl'].includes(String(langue)) ? String(langue) : 'fr',
        source: 'voice-core',
      },
      update: {
        askedCount: { increment: 1 },
        /* La formulation la PLUS RECENTE remplace l'ancienne : c'est celle
           qui dit le mieux comment les gens posent la question aujourd'hui. */
        question: String(question).slice(0, 500),
        lastAskedAt: new Date(),
      },
    });
    return res.status(204).end();
  } catch (error) {
    logger.error('[voice-core] lacune non notee:', error);
    return res.status(500).json({ error: 'gap_failed' });
  }
});

/**
 * GET /api/voice-core/caller — ce qu'on sait deja de ce numero.
 *
 * Sert au bloc d'ouverture : saluer par le prenom, savoir qu'un rendez-vous
 * est a venir, ne pas redemander ce qui a deja ete donne. Le site le promet en
 * toutes lettres.
 *
 * Le nom vient de la MEMOIRE d'appelant d'abord, des reservations ensuite :
 * la memoire porte le nom confirme (relu, epele), la reservation porte ce qui
 * a ete tape. Quand les deux existent, c'est le confirme qui gagne.
 */
router.get('/caller', async (req, res) => {
  const clientId = String(req.query.clientId || '');
  const caller = String(req.query.caller || '');
  if (!clientId || !caller) return res.status(400).json({ error: 'bad_client_or_caller' });

  try {
    const formes = ecrituresDuNumero(caller);
    const aujourd = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

    const [memoire, appels, rdv] = await Promise.all([
      prisma.callerMemory.findFirst({
        where: { clientId, callerNumber: { in: formes } },
        select: { knownName: true, totalCalls: true, lastSummary: true },
      }),
      prisma.clientCall.count({ where: { clientId, callerNumber: { in: formes } } }),
      prisma.clientBooking.findFirst({
        where: {
          clientId,
          customerPhone: { in: formes },
          status: 'confirmed',
          bookingDate: { gte: aujourd },
        },
        select: { customerName: true },
      }),
    ]);

    return res.json({
      appels: Math.max(appels, memoire?.totalCalls ?? 0),
      nom: memoire?.knownName || rdv?.customerName || null,
      dernier_motif: memoire?.lastSummary || null,
      rdv: Boolean(rdv),
    });
  } catch (error) {
    logger.error('[voice-core] historique appelant illisible:', error);
    return res.status(500).json({ error: 'caller_failed' });
  }
});

export default router;
