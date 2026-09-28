import { Router } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { voiceCoreAuth } from '../middleware/voice-core.middleware';
import { realtimeContextService } from '../services/voice/realtime-context.service';
import { clientCallService } from '../services/client-call.service';
import { toolRuntimeService } from '../services/voice/tool-runtime.service';

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
      business: profil.businessName,
      businessType: profil.businessType,
      agent: ligne?.agentName || profil.agentName,
      language: profil.language,
      notes: consignes,
      greeting: ligne?.greeting || null,
      transferNumber: ligne?.transferNumber || profil.transferNumber || null,
      transferMode: profil.transferMode || 'always',
      forwardingType: profil.forwardingType || null,
      lines: [...new Set(lignes)],
      phoneNumber: profil.inboundNumber,
    });
  } catch (error) {
    logger.error('[voice-core] contexte illisible:', error);
    return res.status(500).json({ error: 'context_failed' });
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
  const { room, caller, trunkNumber, clientId, brain, startedAt, durationSeconds, latency, transcript } =
    req.body || {};

  if (!room || !clientId) {
    return res.status(400).json({ error: 'missing_room_or_client' });
  }

  const salle = String(room);

  try {
    if (enCours.has(salle)) return res.status(202).json({ room: salle, pending: true });

    /* La room LiveKit est l'identifiant naturel : une room, un appel. */
    const deja = await prisma.clientCall.findUnique({
      where: { vapiCallId: salle },
      select: { id: true },
    });
    if (deja) return res.status(200).json({ id: deja.id, already: true });

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

    await clientCallService.handleClientCallCompleted(
      String(clientId),
      salle,
      typeof transcript === 'string' ? transcript : '',
      duree,
      caller ? String(caller) : undefined,
      /* `recordingUrl` : l'enregistrement est celui de Twilio, et `voice-core`
         n'en connaît pas l'URL. À brancher séparément, côté Twilio. */
      undefined,
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
  };
}

const CHAMPS = {
  id: true, clientId: true, bookingDate: true, bookingTime: true,
  customerPhone: true, customerName: true, serviceType: true, status: true,
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
  const { clientId, day, slot, caller, name, service } = req.body || {};
  const jour = jourEnDate(day);
  const heure = typeof slot === 'string' && /^\d{2}:\d{2}$/.test(slot) ? slot : null;
  if (!clientId || !jour || !heure || !name) {
    return res.status(400).json({ error: 'missing_booking_fields' });
  }

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

export default router;
