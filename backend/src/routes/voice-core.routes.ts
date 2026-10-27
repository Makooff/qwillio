import { Router } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { voiceCoreAuth } from '../middleware/voice-core.middleware';
import { realtimeContextService, shouldRecord } from '../services/voice/realtime-context.service';
import { twilioRecordingService } from '../services/voice/twilio-recording.service';
import { clientCallService } from '../services/client-call.service';
import { toolRuntimeService } from '../services/voice/tool-runtime.service';
import { callerMemoryService } from '../services/voice/caller-memory.service';
import { liveTranscripts } from '../services/voice/live-transcript.store';
import { knowledgePreset } from '../config/knowledge-presets';
import { entreesDepuisVapiConfig } from '../services/voice/portal-knowledge.service';
import {
  getPendingCaptureForRoom,
  linkCaptureToCall,
  persistCapture,
  persistRoomCapture,
} from '../services/voice/lead-capture-store.service';
import { normalizeLeadPhone } from '../services/lead-identity';
import { isPlaceholderName } from '../utils/spelled-name';
import { workerCalendarService } from '../services/voice/worker-calendar.service';
import {
  voiceCompletionInbox,
  type VoiceCompletionPayload,
} from '../services/voice/voice-completion-inbox.service';

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
import {persistCompletedVoiceMetadata} from '../services/voice/voice-core-metadata';
import { signRuntimeScope } from '../services/voice/learning-runtime-scope';
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

    // Scope comes from the authoritative client row selected by the called line.
    // It is NOT copied from line instructions, a caller marker or profile fallback.
    const learningClient = await prisma.client.findFirst({
      where: { id: client.id }, select: { id: true, businessType: true, country: true, agentLanguage: true },
    });
    return res.json({
      learningAssertion: learningClient ? signRuntimeScope(learningClient, appele,
        process.env.VOICE_CORE_API_KEY || '', process.env.LEARNING_RUNTIME_ENABLED === 'true') : null,
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
      where: { vapiCallId: salle, clientId: String(clientId) },
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

    /* LA PLACE DU DIRECT S'OUVRE ICI, et c'est le seul endroit où le store
       apprend à quel client appartient cette salle. Les lignes de transcript
       qui suivront ne portent que `{room, role, text}` : les faire porter le
       client obligerait à relire la fiche en base à chaque tour de parole,
       c'est-à-dire l'aller-retour que ce store existe pour supprimer. */
    liveTranscripts.ouvrir(salle, String(clientId));

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

    /* L'ENREGISTREMENT, MÊME QUAND LE PONT N'A PAS DONNÉ LE SID.

       Le pont lit `sip.twilio.callSid` dans les attributs de la salle. Quand
       l'attribut manque, il n'envoie rien et `demarrer` n'est jamais appelé:
       le client avait activé l'enregistrement, le prompt l'annonçait, et
       aucun audio n'existait. On retrouve alors l'appel en cours chez Twilio
       (`sidEnCours`) — l'appelant et l'instant suffisent, et sans SID on ne
       peut de toute façon rien faire d'autre. */
    void (async () => {
      try {
        const profil = await realtimeContextService.getClientProfile(String(clientId));
        if (profil && !shouldRecord(profil)) {
          logger.info(`[voice-core] ${clientId} a coupé l'enregistrement — appel non enregistré.`);
          return;
        }
        const sidAppel = twilioCallSid
          ? String(twilioCallSid)
          : await twilioRecordingService.sidEnCours(String(caller ?? ''), trunkNumber ? String(trunkNumber) : undefined);
        if (!sidAppel) return;
        const sid = await twilioRecordingService.demarrer(sidAppel);
        if (!sid) return;
        /* Le SID est rangé sur la fiche pour que la fin d'appel n'ait pas à
           redemander à Twilio ce qu'on savait déjà — et pour qu'un appel
           dont la remontée se perd garde quand même la trace de son audio,
           seul moyen de le purger plus tard. */
        // Merge on the stored JSON, not the /start snapshot: completion may
        // have committed its journal and metrics while Twilio was pending.
        const patch = JSON.stringify({ recordingSid: sid });
        const changed = await prisma.$executeRaw`
          UPDATE client_calls
          SET metadata = (CASE WHEN jsonb_typeof(metadata) = 'object'
            THEN metadata ELSE '{}'::jsonb END) || ${patch}::jsonb
          WHERE id = ${appel.id}::uuid AND client_id = ${String(clientId)}::uuid
            AND vapi_call_id = ${salle}
        `;
        if (changed !== 1) throw new Error('Recording metadata: room ownership or row mismatch');
      } catch (e) {
        logger.error(`[voice-core] enregistrement non démarré pour ${salle}: ${(e as Error).message}`);
      }
    })();
    return;
  } catch (error) {
    logger.error('[voice-core] appel en cours non affiché:', error);
    return res.status(500).json({ error: 'start_failed' });
  }
});

/**
 * POST /api/voice-core/calls/transcript — une ligne, pendant que ça se dit.
 *
 * RÉPOND 204 ET NE TOUCHE PAS LA BASE. `voice-core` coupe cette requête à
 * deux secondes et l'émet depuis la boucle de sa session, entre deux tours de
 * parole : tout ce qui traîne ici se paie en silence sur la ligne. Une ligne
 * perdue ne se rattrape pas et n'a pas à l'être — `POST /calls` renvoie le
 * transcript complet à la fin, et c'est lui qui fait foi.
 *
 * Une salle inconnue rend 204 elle aussi, délibérément. Ça arrive quand ce
 * processus a redémarré pendant l'appel : il n'y a rien à faire, et répondre
 * en erreur ferait journaliser une panne à chaque tour de parole d'un appel
 * qui, lui, se déroule parfaitement.
 */
router.post('/calls/transcript', (req, res) => {
  const { room, role, text } = req.body || {};
  if (!room || !text) return res.status(400).json({ error: 'missing_room_or_text' });
  liveTranscripts.ajouter(String(room), role === 'user' ? 'user' : 'assistant', String(text));
  return res.status(204).end();
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
 * LE TRAITEMENT D'UN APPEL TERMINÉ — déplacé hors de la requête, rendu
 * idempotent. C'est exactement le chemin que prenait l'ancien handler après
 * son 202, avec une seule différence : les étapes NON réversibles (analyse
 * GPT-4, fiche, alertes, quota via `handleClientCallCompleted`, qui fait un
 * `create`) ne tournent QUE si la fiche n'existe pas encore. Un essai qui a
 * créé la fiche puis échoué plus loin (métadonnées voix, mémoire, liaison de
 * capture) se reprend donc sans jamais analyser deux fois le même appel ni
 * créer deux fiches — la reprise de la boîte durable est sans double
 * side-effects après écriture de la fiche. Une panne entre un effet externe
 * et son enregistrement, ou un handler encore vivant après expiration du
 * bail, peut toutefois répéter cet effet : aucune garantie exactly-once.
 * Les étapes idempotentes retournent à chaque essai.
 */
// Retry time is not event time: old completions must stay behind identityResetAt.
function dateFinReelle(startedAt: unknown, duration: unknown): Date | null {
  if (typeof startedAt !== 'string' || !startedAt.trim()) return null;
  const start = new Date(startedAt).getTime();
  const seconds = Number(duration);
  const end = start + Math.max(0, Math.trunc(seconds)) * 1000;
  return Number.isFinite(start) && Number.isFinite(seconds) && Number.isFinite(end)
    && end <= Date.now() ? new Date(end) : null;
}

async function traiterAppelTermine(payload: VoiceCompletionPayload): Promise<void> {
  const salle = payload.room;
  const clientId = payload.clientId;
  const { transcript, caller, twilioCallSid, startedAt, brain, trunkNumber, latency } = payload;
  const finReelle = dateFinReelle(startedAt, payload.durationSeconds);
  const duree = Number.isFinite(Number(payload.durationSeconds))
    ? Math.max(0, Math.trunc(Number(payload.durationSeconds)))
    : 0;

  /* LE LEAD CAPTÉ PENDANT L'APPEL, lu dans la ligne durable que
     `captureLead` (Vapi) ou `POST /leads` (ce pont) a écrite. Sans cette
     lecture, le post-appel ne voit jamais les faits captés en direct : le
     nom dicté, le numéro de rappel et l'urgence disparaissaient de la
     fiche d'appel, et le filet des promesses reconstruisait un second
     lead — deux lignes, deux alertes, pour un seul appelant. Relue à
     chaque essai : un lien manqué à l'essai précédent se rattrape. */
  const deja = await prisma.clientCall.findUnique({
    where: { vapiCallId: salle },
    select: { id: true, status: true, clientId: true, metadata: true },
  });
  if (deja && deja.clientId !== clientId) throw new Error('Voice completion room tenant mismatch');
  /* Une fiche `in-progress` est le placeholder du décroché, PAS un appel
     déjà traité : la traiter comme un doublon sauterait transcript, résumé
     et lead sur chaque appel. `ended`, c'est la fermeture déterministe
     ci-dessous : la fiche a cessé d'être « en cours » mais l'analyse n'a
     PAS encore tourné — ce n'est pas davantage un appel traité. Tout autre
     statut signifie qu'un essai précédent a déjà créé la fiche — on ne
     re-analyse pas. */
  const dejaTraite = deja && deja.status !== 'in-progress' && deja.status !== 'ended';

  /* LA FERMETURE DÉTERMINISTE, indépendante de l'analyse. Dès que la
     remontée de fin est acceptée, la fiche « en cours » cesse de l'être AU
     PREMIER ESSAI — avant la lecture de la capture, avant l'appel Twilio,
     avant l'analyse GPT-4 qui met des secondes et peut échouer. Un appel
     raccroché ne reste donc jamais « en cours » sur le tableau de bord parce
     que l'analyse a dépassé un délai ou que la capture a levé : c'est le
     statut `ended`, terminal côté direct (la route live ne lit que
     `in-progress`), et la vraie fiche le remplace quelques lignes plus bas.
     Rejouée à chaque essai : un placeholder recréé entre-temps par un
     `/calls/start` retardataire est refermé, jamais laissé vivant. */
  if (!dejaTraite && deja?.status === 'in-progress') {
    await prisma.clientCall.updateMany({
      where: { vapiCallId: salle, clientId, status: 'in-progress' },
      data: { status: 'ended', endedAt: finReelle ?? new Date() },
    });
  }

  const captureLive = await getPendingCaptureForRoom(clientId, salle);

  if (!dejaTraite) {
    /* PAS DE SUPPRESSION. La fiche placeholder (même id, écrite au
       décroché) EST la fiche finale : le service la convertit en place via
       `upsert` — `handleClientCallCompleted` partage ce contrat. L'ancien
       delete-then-create faisait disparaître la fiche live pendant les
       secondes de l'analyse et perdait l'appel si l'essai mourait ici.
       La fenêtre de quelques millisecondes sans ligne n'existe plus. */

    /* L'ENREGISTREMENT, demandé à Twilio : seule la fin d'appel sait si le
       média s'est terminé. Une absence n'est PAS une anomalie — c'est
       l'état normal d'un client qui a coupé l'enregistrement.

       SANS LE SID DU PONT, on relit le `recordingSid` rangé au décroché: le
       lien vers l'audio n'existe que là, et sans lui un enregistrement bien
       présent chez Twilio n'arrive jamais au portail. */
    const sidRepli = !twilioCallSid
      ? (deja?.metadata as { recordingSid?: string } | null)?.recordingSid
      : undefined;
    const enregistrement = twilioCallSid
      ? await twilioRecordingService.delAppel(String(twilioCallSid))
      : sidRepli
        ? await twilioRecordingService.parSid(sidRepli)
        : null;

    const liveLead = captureLive
      ? {
          name: captureLive.content.contact?.name ?? null,
          email: captureLive.content.contact?.email ?? null,
          phone: captureLive.content.contact?.phone ?? null,
          reason: captureLive.content.reason ?? '',
          urgency: captureLive.content.urgency ?? 'normal',
          forPerson: captureLive.content.forPerson ?? null,
          callbackWhen: captureLive.content.callbackWhen ?? null,
        }
      : undefined;

    /* `voiceMode` RESTE NULL, volontairement. Le schéma dit « null =
       inconnu, donc jamais facturé », et les deux valeurs qu'il accepte
       ('realtime' | 'classic') décrivent le moteur Vapi, pas les cerveaux
       de `voice-core`. Le cerveau réel est dans `metadata`. */
    await clientCallService.handleClientCallCompleted(
      clientId,
      salle,
      typeof transcript === 'string' ? transcript : '',
      duree,
      caller,
      enregistrement?.url,
      null,
      /* Le lead durable lu plus haut : sa présence dit au filet des
         promesses qu'il n'a rien à rattraper, et ses faits priment sur ce
         que l'analyse du transcript a bien voulu en dire. */
      { liveLead, ...(finReelle ? { completedAt: finReelle } : {}) },
    );
  } else {
    // A completed row may precede a rolled-back counter/rescue transaction.
    // Reuse the persisted analysis journal instead of declaring it processed.
    await clientCallService.resumeClientCallCompletion(clientId, salle);
  }

  /* La capture durable trouve enfin sa fiche d'appel : la fiche porte le
     transcript, la capture le numéro de rappel. Idempotente : une capture
     déjà liée ne se re-li pas. */
  if (captureLive) {
    try {
      const appelCree = await prisma.clientCall.findUnique({
        where: { vapiCallId: salle, clientId },
        select: { id: true },
      });
      if (appelCree) {
        await linkCaptureToCall({ clientId, activityId: captureLive.id, clientCallId: appelCree.id });
      }
    } catch (error) {
      logger.warn(`[voice-core] capture live non reliée à l'appel ${salle}: ${(error as Error).message}`);
    }
  }

  /* Ce que le service ne sait pas écrire, parce que ça n'existe pas chez
     Vapi : d'où vient l'appel, quel cerveau a parlé, et ses latences.
     `startedAt` aussi : le service le déduit de `Date.now() - durée`, ce qui
     décale l'appel du temps qu'a mis cette requête. `voice-core` a l'heure
     exacte, autant s'en servir. Idempotent : réécrit les mêmes faits. */
  const debutReel = startedAt ? new Date(startedAt) : null;
  await persistCompletedVoiceMetadata(
    prisma, salle, clientId,
    debutReel && !Number.isNaN(debutReel.getTime()) ? debutReel : null,
    { brain: brain ?? null, trunkNumber: trunkNumber ?? null, latency: latency ?? null },
  );

  /* LA MÉMOIRE DE L'APPELANT, écrite à la fin de CHAQUE appel. Jamais
     bloquante : la mémoire est un confort, l'appel est déjà fini, et la
     fiche est écrite. */
  const fiche = await prisma.clientCall.findUnique({
    where: { vapiCallId: salle, clientId },
    select: { summary: true, outcome: true, nameCollected: true, emailCollected: true, endedAt: true, metadata: true },
  });
  await callerMemoryService
    .remember({
      clientId,
      callerNumber: caller ?? null,
      callId: salle,
      phase: 'completed',
      identitySource: 'analysis',
      occurredAt: finReelle ?? fiche?.endedAt ?? undefined,
      name: (fiche?.metadata as Record<string, unknown> | null)?.callerIdentityInherited === true ? null : fiche?.nameCollected ?? null,
      email: fiche?.emailCollected ?? null,
      summary: fiche?.summary ?? null,
      outcome: fiche?.outcome ?? null,
    })
    .catch((e: Error) => logger.warn(`[voice-core] mémoire d'appelant non écrite: ${e.message}`));

  logger.info(`[voice-core] appel enregistré : ${salle} (${duree}s, ${brain ?? 'cerveau inconnu'})`);
}

/* LE BATTEMENT DE REPRISE, démarré paresseusement au premier appel
   persisté : le drain immédiat rattrape les remontées laissées par un crash
   antérieur, puis l'intervalle `unref`'d de 30 s garde la file vide sans
   jamais retenir le processus ouvert. Deux drains ne se chevauchent pas. */
let arretInbox: (() => void) | null = null;
export function assurerRepriseInbox(): void {
  if (!arretInbox) arretInbox = voiceCompletionInbox.start(traiterAppelTermine);
}

/**
 * POST /api/voice-core/calls — l'appel terminé.
 *
 * PERSISTE AVANT DE RÉPONDRE. `voice-core` coupe sa remontée à 10 s et
 * l'émet depuis son `shutdown_callback` : répondre 202 avant d'avoir écrit,
 * c'est répondre pour une fiche qui disparaît si ce processus meurt dans
 * l'intervalle. La remontée validée entre D'ABORD dans la boîte durable
 * (`agent_crm_activities`, identité (client, room), verrou d'advisory
 * Postgres) ; le 202 signifie « conservé », pas seulement « reçu ».
 *
 * IDEMPOTENCE : une remontée déjà persistée rend 202 `pending` si le
 * traitement tourne encore, et 200 `already` si la pierre tombale est posée
 * — l'ancien contrat de rejeu, conservé. Le traitement lui-même passe par
 * `clientCallService.handleClientCallCompleted`, donc par le bouclier
 * anti-spam, l'analyse du transcript, le score de lead, la fiche CRM, le
 * quota du forfait et l'échéance de conservation — exactement le chemin d'un
 * appel Vapi. En cas d'échec, la charge utile survit dans la boîte et la
 * reprise (bail de 5 minutes, 5 essais, recul borné) reprend SANS jamais
 * ré-analyser un appel déjà fichié.
 */
router.post('/calls', async (req, res) => {
  const { room, caller, trunkNumber, clientId, brain, startedAt, durationSeconds, latency, transcript,
          twilioCallSid } = req.body || {};

  if (typeof room !== 'string' || !room.trim() || typeof clientId !== 'string' || !clientId.trim()) {
    return res.status(400).json({ error: 'missing_room_or_client' });
  }

  const salle = room;

  /* LA DERNIÈRE FRONTIÈRE AVANT LA BASE. Une charge malformée est rejetée
     ICI, sans avoir rien écrit — ni fiche, ni file. */
  let job: { id: string; already: boolean };
  try {
    job = await voiceCompletionInbox.enqueue({
      room: salle,
      clientId: String(clientId),
      caller, trunkNumber, brain, startedAt, durationSeconds, latency, transcript, twilioCallSid,
    } as VoiceCompletionPayload);
    assurerRepriseInbox();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid voice completion payload')) {
      return res.status(400).json({ error: 'invalid_completion_payload' });
    }
    logger.error('[voice-core] remontée non persistée:', error);
    return res.status(500).json({ error: 'record_failed' });
  }

  if (job.already) {
    try {
      const ligne = await prisma.agentCrmActivity.findFirst({
        where: { id: job.id, clientId, type: 'voice_completion' },
        select: { status: true },
      });
      if (!ligne) return res.status(500).json({ error: 'record_failed' });
      if (ligne.status === 'dead_letter') {
        return res.status(409).json({ error: 'completion_dead_letter', room: salle });
      }
      if (ligne.status === 'completed') {
        const appel = await prisma.clientCall.findUnique({
          where: { vapiCallId: salle, clientId },
          select: { id: true },
        });
        return res.status(200).json({ id: appel?.id ?? job.id, already: true });
      }
      return res.status(202).json({ room: salle, pending: true });
    } catch {
      logger.error('[voice-core] statut de reprise illisible');
      return res.status(500).json({ error: 'record_failed' });
    }
  }

  /* LA FERMETURE DURABLE, AVANT LE 202. Transcript, durée et endedAt sont
     écrits sur le placeholder MAINTENANT — pas après l'analyse, pas dans le
     traitement asynchrone. Une fiche `ended` avec son transcript survit à un
     crash du processus, reste visible en détail (la fiche n'est jamais
     effacée, le service la convertit en place), et un `/calls/start`
     retardataire ne peut pas la recréer en `in-progress` (l'upsert du
     décroché ne touche qu'une ligne existante). `updateMany` borné au statut
     `in-progress` : rejouée, elle ne réécrit rien. */
  try {
    const dureeBrute = Number(durationSeconds);
    await prisma.clientCall.updateMany({
      where: { vapiCallId: salle, clientId: String(clientId), status: 'in-progress' },
      data: {
        status: 'ended',
        endedAt: dateFinReelle(startedAt, durationSeconds) ?? new Date(),
        durationSeconds: Number.isFinite(dureeBrute) ? Math.max(0, Math.trunc(dureeBrute)) : 0,
        ...(typeof transcript === 'string' ? { transcript } : {}),
      },
    });

    if (enCours.has(salle)) return res.status(202).json({ room: salle, pending: true });
    enCours.add(salle);
    /* Le direct s'arrête ici : le transcript complet est dans la boîte, et
       le garder en mémoire ferait afficher « en cours » un appel raccroché. */
    liveTranscripts.terminer(salle);
    res.status(202).json({ room: salle, accepted: true });
  } catch (error) {
    enCours.delete(salle);
    logger.error('[voice-core] remontée refusée:', error);
    return res.status(500).json({ error: 'record_failed' });
  }

  /* À partir d'ici la réponse est partie. Plus rien ne doit remonter à
     l'appelant, et rien ne doit sortir de ce bloc : une exception non
     rattrapée dans un handler déjà répondu tue le processus. Un échec ici
     laisse la charge dans la boîte : le recul borné et le battement de
     reprise s'en chargent. */
  try {
    await voiceCompletionInbox.runOne(job.id, traiterAppelTermine);
  } catch (error) {
    logger.error(`[voice-core] traitement de l'appel ${salle} échoué, reprise programmée:`, error);
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
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== ymd.trim() ? null : d;
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
    /* L'AGENDA RÉEL DU WORKER, pas une lecture base seule : les réservations
       confirmées ET les indisponibilités du calendrier connecté du client
       (Google/Outlook), fusionnées dans son fuseau — une base seule
       proposerait un créneau déjà pris, et l'index unique le refuserait à
       l'appelant en ligne. */
    const slots = await workerCalendarService.takenSlots(clientId, dateEnJour(jour));
    return res.json({ slots });
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
    /* Le nom relu et épelé par l'appelant PENDANT la réservation est la
       meilleure preuve d'identité qui existe — mais UNIQUEMENT quand le
       worker a transporté la preuve explicite (booléen + orthographe
       cohérente). Sans elle, la réservation reste une simple écriture
       d'agenda et n'écrit rien dans la mémoire d'appelant. */
    const nomConfirme = orthographeConfirmee(
      typeof name === 'string' && name.trim() ? name.trim() : null,
      req.body?.nom_confirme, req.body?.orthographe);
    if (nomConfirme && caller) {
      try {
        await callerMemoryService.remember({
          clientId: String(clientId),
          callerNumber: String(caller),
          phase: 'capture',
          identitySource: 'confirmed',
          name: nomConfirme,
        });
      } catch (error) {
        logger.warn(`[voice-core] mémoire de réservation confirmée non écrite: ${(error as Error).message}`);
      }
    }
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
 * La capture est IDEMPOTENTE par room : chaque relecture corrigée
 * (`voice-core` réémet la fiche quand l'appelant corrige un chiffre) met à
 * jour la MÊME ligne `pending`, les faits les plus récents gagnant et
 * l'ancien contenu partant en `revisions`. Sans room, chaque émission crée
 * sa ligne : sans identité d'appel il n'y a rien à dédoublonner, et fusionner
 * à l'aveugle fusionnerait des appelants différents.
 *
 * La mémoire d'appelant suit, en tache de fond : c'est un supplement, et un
 * supplement ne doit jamais faire echouer la fiche qu'il enrichit.
 */
router.post('/leads', async (req, res) => {
  const { clientId, caller, telephone: rappelDicte, name, reason, email, adresse, pourQui, quand, urgence, room } =
    req.body || {};
  if (!clientId) return res.status(400).json({ error: 'bad_client' });

  try {
    const profil = await realtimeContextService.getClientProfile(String(clientId));
    // New workers distinguish the SIP caller from a dictated callback. Old
    // workers put the callback in `caller`: only a scoped call row can recover
    // their transport identity. Never create a caller profile under a callback.
    const transportContract = Object.prototype.hasOwnProperty.call(req.body, 'telephone');
    const normalisePhone = (value: unknown) => typeof value === 'string'
      ? normalizeLeadPhone(value, profil?.country ?? null) : null;
    const telephone = normalisePhone(transportContract ? rappelDicte : caller)
      ?? (transportContract ? normalisePhone(caller) : null);
    const ligne = transportContract ? null : room
      ? await prisma.clientCall.findUnique({
          where: { vapiCallId: String(room), clientId: String(clientId) },
          select: { callerNumber: true },
        })
      : null;
    const transport = normalisePhone(transportContract ? caller : ligne?.callerNumber);
    const captureAt = new Date();

    /* Le nom subit la MÊME garde que chez Vapi : « le client » ou le nom de
       l'agent ou du commerce, entendus dans l'accueil, ne sont pas des noms
       d'appelant — les laisser passer polluerait le CRM et la mémoire. */
    const nom = typeof name === 'string' && name.trim()
      && !isPlaceholderName(name, [profil?.agentName ?? '', profil?.businessName ?? ''])
      ? name.trim().slice(0, 120)
      : null;
    /* Calculé AVANT le contenu durable : la fiche de lead porte elle-même
       l'orthographe confirmée quand la preuve tient, pour que le post-appel
       n'ait jamais à la deviner ni à la dégrader. */
    const epellee = orthographeConfirmee(nom, req.body?.nom_confirme, req.body?.orthographe);

    const contenu = {
      source: 'voice-core',
      vapiCallId: room ? String(room) : null,
      callerNumber: transport,
      capturedAt: captureAt.toISOString(),
      contact: {
        name: epellee ?? nom,
        email: typeof email === 'string' && email.trim()
          ? email.trim().toLowerCase().slice(0, 255)
          : null,
        phone: telephone ? String(telephone).slice(0, 40) : null,
        address: typeof adresse === 'string' && adresse.trim()
          ? adresse.trim().slice(0, 255)
          : null,
      },
      reason: typeof reason === 'string' ? reason.trim().slice(0, 500) : '',
      /* `voice-core` parle francais, le CRM attend low|normal|high. */
      urgency: urgence === 'urgente' ? 'high' : urgence === 'faible' ? 'low' : 'normal',
      forPerson: pourQui ? String(pourQui).slice(0, 40) : null,
      callbackWhen: quand ? String(quand).slice(0, 40) : null,
      language: profil?.language ?? 'fr',
      businessName: profil?.businessName ?? null,
    };

    const salle = room ? String(room) : null;
    const resultat = salle
      ? await persistRoomCapture({
          clientId: String(clientId),
          room: salle,
          buildContent: () => contenu,
        })
      : await persistCapture({ clientId: String(clientId), content: contenu });

    // Finish this best-effort write before acknowledging the capture: a caller
    // can hang up and ring back immediately. The durable lead already exists.
    /* `confirmed` UNIQUEMENT sur preuve explicite (booléen + orthographe
       cohérente) : toute autre capture reste `capture`, et rien d'autre ne
       peut écrire la source `confirmed`. */
    if (transport) await callerMemoryService
      .remember({
        clientId: String(clientId),
        callerNumber: transport,
        callbackNumber: telephone,
        callId: salle ?? undefined,
        phase: 'capture',
        identitySource: epellee ? 'confirmed' : 'capture',
        occurredAt: captureAt,
        name: epellee ?? nom,
        email: contenu.contact.email,
        summary: contenu.reason || null,
        outcome: 'lead',
        request: contenu.reason ? {
          text: contenu.reason, callbackWhen: contenu.callbackWhen, forPerson: contenu.forPerson,
        } : undefined,
      })
      .catch(() => logger.warn('[voice-core] memoire d’appelant non ecrite'));
    res.status(201).json({ id: resultat.id, updated: resultat.updated });
    return;
  } catch (error) {
    logger.error('[voice-core] lead refuse:', error);
    return res.status(500).json({ error: 'lead_failed' });
  }
});

/** Les trois genres que `voice-core` sait classer. */
type Genre = 'regle' | 'equipe' | 'faq';

/** Une entree telle que `voice-core` la consomme (cf. connaissance.Entree). */
interface EntreeVocal {
  id: string;
  genre: Genre;
  titre: string;
  contenu: string;
  mots_cles: string[];
  priorite: number;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * La PREUVE STRICTE d'une orthographe confirmée par l'appelant. Le worker
 * (patch dédié, hors de ce dépôt) ne transporte aujourd'hui que le nom :
 * cette exigence de deux champs cohérents — `nom_confirme === true` ET
 * `orthographe` correspondant au nom dicté — empêche qu'une simple capture,
 * une réservation ou une affirmation du modèle soit promue « confirmée ».
 * Renvoie l'orthographe exacte quand la preuve tient, sinon `null`.
 */
export function orthographeConfirmee(
  nomDicte: string | null,
  nomConfirme: unknown,
  orthographe: unknown,
): string | null {
  if (!nomDicte || nomConfirme !== true || typeof orthographe !== 'string') return null;
  const epelle = orthographe.trim().slice(0, 120);
  if (!epelle) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-'.]/g, '');
  return norm(epelle) === norm(nomDicte) ? epelle : null;
}

/**
 * Les entrees du portail, au format que `voice-core` consomme.
 *
 * LA CONVERSION ELLE-MEME VIT AILLEURS. Elle est dans
 * `services/voice/portal-knowledge.service`, parce que `business-memory.service`
 * lit les memes donnees pour le chemin temps reel. Deux copies d'une regle
 * finissent toujours par diverger : celle-ci n'est qu'un renommage des champs,
 * pour passer de `KnowledgeEntry` a `EntreeVocal` sans toucher ni l'un ni
 * l'autre contrat.
 *
 * Ce module ne fabrique AUCUN libelle : ils viennent du preset du metier, via
 * `entreesDepuisVapiConfig`.
 */
export function entreesDepuisConfig(
  cfg: Record<string, unknown> | null | undefined,
  businessType?: string | null,
): EntreeVocal[] {
  return entreesDepuisVapiConfig(cfg, businessType).map((e) => ({
    id: e.id,
    genre: e.kind,
    titre: e.title,
    contenu: e.content,
    mots_cles: e.keywords,
    priorite: e.priority,
  }));
}

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

  // Le repli cote voix est la chaine `"local"` (client inconnu : appel de test,
  // numero non rattache). Or `businessKnowledge.clientId` est un `@db.Uuid` :
  // Prisma refuse le cast et rend un 500 que le worker lit comme « connaissance
  // indisponible ». On repond donc une base VIDE, ce qui est la verite pour un
  // client qu'on ne connait pas, sans faire echouer la requete.
  if (!UUID_RE.test(clientId)) {
    return res.json({ entries: [], client_inconnu: true });
  }

  try {
    const entrees = await prisma.businessKnowledge.findMany({
      where: { clientId, isActive: true },
      select: { id: true, kind: true, title: true, content: true, keywords: true, priority: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 500,
    });

    const depuisTable: EntreeVocal[] = entrees.map((e) => ({
      id: e.id,
      genre: e.kind as Genre,
      titre: e.title,
      contenu: e.content,
      mots_cles: e.keywords ?? [],
      priorite: e.priority,
    }));

    // Le second magasin : ce que le client a rempli dans son portail et qui
    // n'a jamais de ligne en base. Voir `entreesDepuisConfig`.
    //
    // On lit AUSSI `businessType` : c'est lui qui choisit le preset, donc les
    // libelles. Un client « cabinet dentaire » doit lire « Consultations et
    // controles », pas « Carte ».
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { vapiConfig: true, businessType: true },
    });
    const cfg = (client?.vapiConfig && typeof client.vapiConfig === 'object'
      ? (client.vapiConfig as Record<string, unknown>)
      : {});

    // Les libelles viennent du preset du METIER, et c'est `entreesDepuisConfig`
    // qui s'en charge : il delegue a `portal-knowledge.service`, ou la
    // conversion est ecrite une fois et partagee avec `business-memory`.
    const depuisConfig = entreesDepuisConfig(cfg, client?.businessType);

    return res.json({ entries: [...depuisTable, ...depuisConfig] });
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
      callerMemoryService.get(clientId, caller),
      prisma.clientCall.count({ where: { clientId, callerNumber: { in: formes } } }),
      prisma.clientBooking.findFirst({
        where: {
          clientId,
          customerPhone: { in: formes },
          status: 'confirmed',
          bookingDate: { gte: aujourd },
        },
        select: { customerName: true, createdAt: true },
      }),
    ]);

    if (memoire?.isBlocked) {
      return res.json({ appels: 0, nom: null, nom_verifie: false, identitySource: null,
        dernier_motif: null, rdv: false,
        preferences: [], email: null, profil: null, demandes: [],
        telephone_rappel: null, bloque: true });
    }
    return res.json({
      appels: Math.max(appels, memoire?.totalCalls ?? 0),
      nom: memoire?.knownName || (memoire?.identityResetAt && (!rdv?.createdAt || rdv.createdAt.toISOString() <= memoire.identityResetAt) ? null : rdv?.customerName) || null,
      /* Le nom relu et épelé par l'appelant (source `confirmed`) voyage avec
         sa provenance : le worker sait s'il peut dire « bonjour Jean-Luc »
         ou seulement « vous avez déjà appelé ». `nom_verifie` n'est vrai QUE
         pour la source la plus fiable — jamais pour une simple analyse. */
      nom_verifie: memoire?.identitySource === 'confirmed' && memoire?.knownName != null,
      identitySource: memoire?.identitySource ?? null,
      dernier_motif: memoire?.lastSummary || null,
      rdv: Boolean(rdv),
      preferences: memoire?.preferences ?? [],
      email: memoire?.email ?? null,
      profil: memoire?.profileSummary ?? null,
      demandes: memoire?.openRequests ?? [],
      telephone_rappel: memoire?.callbackNumber ?? null,
      bloque: false,
    });
  } catch (error) {
    logger.error('[voice-core] historique appelant illisible:', error);
    return res.status(500).json({ error: 'caller_failed' });
  }
});

export default router;
