import { prisma } from '../config/database';
import { clientLocale } from '../utils/client-locale';

/* Les résumés arrivaient en anglais à un gérant francophone: le modèle
   d'analyse répond dans la langue de la consigne, et la consigne est écrite
   en anglais. La langue du CLIENT est dite, en clair. */
const ANALYSIS_LANGUAGE: Record<'fr' | 'en' | 'nl', string> = { fr: 'French', en: 'English', nl: 'Dutch' };
import { logger } from '../config/logger';
import { retainUntilFor } from './data-retention.service';
import { discordService } from './discord.service';
import { smsService } from './sms.service';
import { callNotificationService } from './call-notification.service';
import { googleCalendarService } from './google-calendar.service';
import { spamDetectionService } from './spam-detection.service';
import { knowledgeGapService } from './voice/knowledge-gap.service';
import { readEndedReason, transferFunnel } from './voice/call-outcome';
import { todayIso } from './voice/clock';
import { isPlaceholderName } from '../utils/spelled-name';
import { businessTimezone } from '../utils/zoned-time';
import { rescuePromise, type PromiseFacts } from './voice/promise-rescue';
import type { LeadForAlert } from './voice/lead-alert.service';
import { analysisDateRule, parseAnalysisDate } from '../utils/analysis-date';

export class ClientCallService {

  /**
   * Le nom sous lequel l'appelant est DÉJÀ connu: la réservation prise ou
   * déplacée pendant l'appel d'abord (nom relu et épelé), puis la dernière
   * réservation de ce numéro, puis la mémoire d'appelant. `null` si rien:
   * le nom entendu par l'analyse reste alors le seul disponible.
   */
  private async knownCallerName(clientId: string, callerNumber: string | undefined, liveBookingId: string | null): Promise<string | null> {
    try {
      if (liveBookingId) {
        const live = await prisma.clientBooking.findFirst({ where: { id: liveBookingId, clientId }, select: { customerName: true } });
        if (live?.customerName?.trim()) return live.customerName.trim();
      }
      if (!callerNumber) return null;
      const booked = await prisma.clientBooking.findFirst({
        where: { clientId, customerPhone: callerNumber, status: 'confirmed' },
        orderBy: { updatedAt: 'desc' },
        select: { customerName: true },
      });
      if (booked?.customerName?.trim()) return booked.customerName.trim();
      const memory = await prisma.callerMemory.findUnique({
        where: { clientId_callerNumber: { clientId, callerNumber } },
        select: { knownName: true },
      });
      return memory?.knownName?.trim() || null;
    } catch (error) {
      logger.warn(`[ClientCall] nom connu illisible pour ${callerNumber ?? '?'}: ${(error as Error).message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE INCOMING CALL COMPLETED - Processes end-of-call report
  // from VAPI for a client's AI receptionist
  // ═══════════════════════════════════════════════════════════
  async handleClientCallCompleted(
    clientId: string,
    vapiCallId: string,
    transcript: string,
    duration: number,
    callerNumber?: string,
    recordingUrl?: string,
    /* Le moteur réellement utilisé, décidé à la construction de l'assistant.
       `undefined` reste `null` en base: un mode inventé serait un mode
       facturé. */
    voiceMode?: string | null,
    extra: { liveBookingId?: string | null; liveCancelledBookingId?: string | null; liveLead?: unknown } = {},
  ): Promise<{ rescuedLead: LeadForAlert | null }> {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      logger.error(`Client not found for call processing: ${clientId}`);
      return { rescuedLead: null };
    }

    // Spam shield (all plans): score the call before we spend anything else on
    // it. Runs before the insert so repeat-frequency counts only prior calls.
    const spam = await spamDetectionService.classifyInboundCall({
      clientId,
      callerNumber,
      transcript,
      durationSeconds: duration,
    });

    /* Le nom CONFIRMÉ pendant l'appel prime sur le nom ENTENDU par le
       modèle d'analyse: la réservation dit « Jean-Luc de la forge » (relu,
       épelé), le transcript dit « Jean Lucas », et le portail affichait le
       second (13/09). Même source pour la fiche d'appel et le contact CRM.
       Il est lu AVANT l'analyse et lui est dit: sinon le résumé (« Jean Lucas
       a appelé pour… ») garde le nom entendu alors que la fiche porte le bon. */
    const known = spam.isSpam ? null : await this.knownCallerName(clientId, callerNumber, extra.liveBookingId ?? null);

    // A spam call skips the GPT-4 transcript analysis entirely (cost saver).
    // A real call gets the full treatment as before.
    const analysis = spam.isSpam
      ? this.emptyAnalysis()
      : await this.analyzeClientCallTranscript(transcript, client, known);
    if (known) analysis.callerName = known;

    /* LE NOM DE L'AGENT N'EST PAS CELUI DE L'APPELANT (19/09/2026).
     *
     * L'analyse lit le TRANSCRIPT, qui porte toujours l'accueil (« Demtalix,
     * bonjour. Je suis Marc, votre assistant IA »). Sur un appel de quatre
     * secondes ou l'appelant n'a RIEN dit, le seul nom propre disponible est
     * celui de l'agent: elle a rendu « Marc », et ces deux colonnes l'ont
     * ecrit sans garde.
     *
     * Ce qui suit est une chaine: `getCallerHistory` lit `nameCollected`, le
     * brief d'ouverture annonce « il s'appelle probablement Marc De La Foi » a
     * chaque appel, le modele reserve sous ce nom, et `lookupBooking` ne
     * retrouve plus le vrai. Releve sur un compte reel: TROIS rendez-vous au
     * nom de l'agent.
     *
     * C'est la meme famille que le nom bidon de 6quadragesies, mais la liste
     * statique ne pouvait pas l'attraper: « Marc » est un prenom valide, et ce
     * qui le disqualifie est QUI il designe. La garde recoit donc les noms de
     * ce client-la. */
    if (analysis.callerName && isPlaceholderName(analysis.callerName, [client.agentName ?? '', client.businessName ?? ''])) {
      logger.warn(
        `[ClientCall] nom d'appelant ecarte pour ${client.businessName}: `
          + `« ${analysis.callerName} » designe l'agent ou le commerce, pas l'appelant`,
      );
      analysis.callerName = '';
    }

    /* LA DATE QUE LE MODÈLE A ÉCRITE, RELUE UNE FOIS, ici, pour les deux
       écritures qui suivent (la fiche d'appel et la réservation de
       rattrapage). Elles faisaient chacune `new Date(analysis.bookingDate)`,
       sans format, sans borne, sans rien: une année inventée passait telle
       quelle, et une réservation datée du passé est invisible partout
       (calendrier du portail, `lookupBooking`, `rescheduleBooking`, qui ne
       lisent que les rendez-vous à venir). Voir `utils/analysis-date.ts`. */
    const bookingDay = analysis.bookingRequested
      ? parseAnalysisDate(analysis.bookingDate, todayIso(businessTimezone(client)))
      : null;

    // Create client call record
    const clientCall = await prisma.clientCall.create({
      data: {
        clientId,
        vapiCallId,
        callerNumber: callerNumber || null,
        callerName: analysis.callerName || null,
        direction: 'inbound',
        startedAt: new Date(Date.now() - duration * 1000),
        endedAt: new Date(),
        durationSeconds: duration,
        status: 'completed',
        voiceMode: voiceMode ?? null,
        transcript,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        outcome: spam.isSpam ? 'spam' : analysis.outcome,
        recordingUrl,
        emailCollected: analysis.emailCollected || null,
        nameCollected: analysis.callerName || null,
        phoneCollected: callerNumber || null,
        bookingRequested: analysis.bookingRequested,
        bookingDate: bookingDay?.ok ? bookingDay.date : null,
        bookingDetails: analysis.bookingDetails || null,
        isLead: analysis.isLead,
        leadScore: analysis.leadScore,
        isSpam: spam.isSpam,
        spamScore: spam.score,
        spamReasons: spam.reasons,
        tags: spam.isSpam ? ['spam', ...spam.reasons] : (analysis.tags || []),
        /* L'échéance est posée MAINTENANT, pas recalculée à chaque purge
           (LEG-4): sans elle, « jusqu'à quand gardez-vous cet appel » n'a pas
           de réponse vérifiable, ce qui est précisément ce que la CNIL demande
           de pouvoir montrer. Elle ne prolonge rien: la purge efface au premier
           des deux termes échus, celui-ci ou le réglage courant. */
        retainUntil: retainUntilFor(client.retentionDays),
      },
    });

    // Spam call: no booking, no SMS, no lead follow-up. Record the hit so the
    // number can be auto-blocklisted, notify, and stop here.
    if (spam.isSpam) {
      await spamDetectionService.registerSpamHit(clientId, callerNumber, spam.reasons);
      logger.info(
        `🛡️ Spam call blocked for ${client.businessName}: ${callerNumber || 'unknown'} (score ${spam.score}, ${spam.reasons.join(',')})`,
      );
      discordService
        .notify(
          `🛡️ SPAM CALL — ${client.businessName}\nFrom: ${callerNumber || 'unknown'}\nScore: ${spam.score}/100\nReasons: ${spam.reasons.join(', ')}`,
        )
        .catch(() => {});
      // Spam is NOT counted as a real call: it does not touch totalCallsMade or
      // lastCallDate, so it never eats into the client's quota. "Spam doesn't
      // count against you" is a selling point of the shield.
      /* Un appel de spam n'a rien promis a personne: aucun rattrapage. */
      return { rescuedLead: null };
    }

    /* ── Ce que l'agent n'a pas su dire, retenu pour la prochaine fois ──
       Après le court-circuit spam, volontairement: un robot qui pose des
       questions n'a pas à dicter ce que le gérant doit documenter.
       `void` et non `await`: c'est un supplément. Perdre une question coûte de
       la reposer; faire échouer cette fonction coûterait la transcription,
       l'analyse, le CRM et l'alerte de l'appel. */
    if (analysis.unansweredQuestions?.length) {
      const lang = client.agentLanguage === 'nl' ? 'nl' : client.agentLanguage === 'en' ? 'en' : 'fr';
      for (const question of analysis.unansweredQuestions.slice(0, 3)) {
        if (typeof question !== 'string') continue;
        void knowledgeGapService.record({ clientId, question, language: lang, source: 'transcript' });
      }
    }

    // ── CRM: l'appel devient un contact et une ligne de son historique ──
    //
    // Le CRM existait, cloisonné par client, avec ses routes et son écran, et
    // RIEN ne le remplissait: `createOrMerge` n'avait aucun appelant. Un client
    // ouvrait ses contacts et trouvait une page vide, quel que soit le nombre
    // d'appels reçus. C'est ici que le lien manquait, et nulle part ailleurs:
    // c'est le seul endroit du dépôt où une ligne `clientCall` est créée.
    //
    // Après le court-circuit spam, volontairement: un robot qui appelle ne doit
    // pas se retrouver dans le carnet d'adresses du client.
    //
    // Best-effort et isolé: un CRM qui échoue ne doit pas faire perdre l'appel,
    // sa réservation ni sa notification, qui sont le produit.
    try {
      const { crmDedupService } = await import('./crm-dedup.service');
      const contactId = await crmDedupService.createOrMerge(clientId, {
        // `name` est obligatoire côté schéma, et l'IA ne récupère pas toujours
        // un prénom. Le numéro fait un bien meilleur repli qu'un rejet: le
        // client reconnaît son appelant, et corrigera le nom lui-même.
        name: analysis.callerName || callerNumber || 'Appelant inconnu',
        // Sans prénom, ce qui remplit `name` est le numéro, et rapprocher deux
        // numéros par ressemblance de texte fusionnerait des appelants
        // différents. Le numéro et l'email restent des critères, eux.
        matchByName: !!analysis.callerName,
        email: analysis.emailCollected || undefined,
        phone: callerNumber || undefined,
        // Le métier du client, pas celui de l'appelant: c'est ce que la colonne
        // porte déjà pour les contacts créés à la main.
        niche: client.businessType || undefined,
        leadScore: analysis.isLead ? analysis.leadScore : undefined,
        tags: analysis.tags || [],
        notes: analysis.summary || undefined,
      });

      await prisma.activity.create({
        data: {
          clientId,
          contactId,
          type: 'call',
          description: analysis.summary || null,
          // Ce qui relie la fiche contact à l'appel dont elle vient: sans lui,
          // l'historique dirait « appel » sans pouvoir en montrer un seul.
          callId: clientCall.id,
        },
      });
    } catch (error: any) {
      logger.warn(`[CRM] Contact non enregistré pour l'appel ${clientCall.id}: ${error.message}`);
    }

    // If booking was made, create booking record
    /* Le rendez-vous a-t-il ÉTÉ FIXÉ. `bookingRequested` dit seulement que
       l'appelant en a demandé un; c'est la création de la réservation qui dit
       s'il en repart avec. La notification a besoin des deux pour distinguer
       une bonne nouvelle d'un rappel à passer dans l'heure. */
    let bookingConfirmed = false;
    /* Réservation DÉJÀ prise pendant l'appel (`bookAppointment`): on la relie
       à l'appel et on s'arrête là. La recréer depuis la transcription donnait
       DEUX rendez-vous et deux événements d'agenda, le second à l'heure que
       le modèle d'analyse croyait avoir lue (appel réel, 12/09/2026). Le SMS
       de confirmation est parti en direct, lui aussi. */
    if (extra.liveBookingId) {
      await prisma.clientBooking.updateMany({
        where: { id: extra.liveBookingId, clientId },
        data: { clientCallId: clientCall.id },
      }).catch(err => logger.warn(`[Booking] liaison à l'appel impossible: ${err.message}`));
      bookingConfirmed = true;
    } else if (extra.liveCancelledBookingId) {
      /* L'APPELANT A ANNULE PENDANT L'APPEL: on ne recrée rien.
         Une annulation parle forcément du rendez-vous qu'elle vise, donc
         `bookingRequested` sort vrai de l'analyse avec la date que l'appelant
         venait de LIBERER. Sans cette branche, il raccrochait, sa ligne était
         annulée par l'outil, et le post-appel lui en écrivait une neuve au
         même créneau, SMS de confirmation compris. C'est le doublon du
         12/09/2026 (6trigesies) retourné: là un rendez-vous pris en direct
         était recréé, ici c'est un rendez-vous annulé qui ressuscite.
         `bookingConfirmed` reste FAUX: l'appelant repart sans rendez-vous, et
         la notification du gérant doit dire cela, pas l'inverse. */
      await prisma.clientBooking.updateMany({
        where: { id: extra.liveCancelledBookingId, clientId },
        data: { clientCallId: clientCall.id },
      }).catch(err => logger.warn(`[Booking] liaison de l'annulation à l'appel impossible: ${err.message}`));
      logger.info(`[Booking] annulation en direct pour ${client.businessName} — aucune ligne recréée depuis la transcription`);
    } else if (analysis.bookingRequested && bookingDay && !bookingDay.ok) {
      /* Le refus est BRUYANT, et c'est le point. Une date illisible ou passée
         produisait jusqu'ici une ligne de rendez-vous que personne ne voyait:
         pas dans le calendrier du portail, pas dans `lookupBooking`, donc un
         appelant qui se présente un jour où on ne l'attend pas. Ne rien écrire
         est plus honnête, à condition de le DIRE: c'est un rendez-vous demandé
         dont il ne reste aucune trace exploitable. */
      logger.error(
        `[Booking] rendez-vous NON enregistré pour ${client.businessName}: ${bookingDay.reason} `
          + `(appel ${clientCall.id}, brut « ${String(analysis.bookingDate).slice(0, 40)} »)`,
      );
      await discordService.notify(
        `📅 RENDEZ-VOUS NON ENREGISTRÉ\n\nClient: ${client.businessName}\n` +
          `Appelant: ${analysis.callerName || callerNumber || 'inconnu'}\n` +
          `Raison: ${bookingDay.reason}\n\n` +
          `L'appelant a demandé un rendez-vous et AUCUNE ligne n'a été créée. À rappeler.`,
      ).catch(() => {});
    } else if (analysis.bookingRequested && bookingDay?.ok) {
      try {
        const booking = await prisma.clientBooking.create({
          data: {
            clientId,
            clientCallId: clientCall.id,
            customerName: analysis.callerName || 'Unknown',
            customerPhone: callerNumber || null,
            customerEmail: analysis.emailCollected || null,
            bookingDate: bookingDay.date,
            bookingTime: analysis.bookingTime || null,
            serviceType: analysis.serviceType || null,
            partySize: analysis.partySize || null,
            specialRequests: analysis.specialRequests || null,
            status: 'confirmed',
          },
        });
        logger.info(`Booking created for ${client.businessName}: ${analysis.callerName} on ${bookingDay.ymd}`);

        // Send booking confirmation SMS (fire-and-forget)
        if (callerNumber) {
          smsService.sendBookingConfirmationSMS({
            customerPhone: callerNumber,
            customerName: analysis.callerName || 'there',
            businessName: client.businessName,
            bookingDate: bookingDay.ymd,
            bookingTime: analysis.bookingTime || null,
            serviceType: analysis.serviceType || null,
          }).then(sent => {
            if (sent) {
              prisma.clientBooking.update({
                where: { id: booking.id },
                data: { smsConfirmationSent: true },
              }).catch(() => {});
            }
          }).catch(err => logger.error('Booking confirmation SMS failed:', err));
        }
        /* Posé DÈS que la réservation existe, avant les envois annexes: un
           SMS de paiement ou une synchronisation d'agenda qui échoue ne rend
           pas le rendez-vous inexistant. */
        bookingConfirmed = true;

        // Auto-send payment SMS after booking
        try {
          const { agentPaymentsService } = await import('./agent-payments.service');
          await agentPaymentsService.sendPaymentLinkAfterBooking(clientId, {
            customerName: analysis.callerName || callerNumber || 'Customer',
            customerPhone: callerNumber,
            serviceType: analysis.bookingDetails || undefined,
          });
        } catch (err) {
          logger.warn('Failed to send post-booking payment SMS:', err);
        }

        // Sync to Google Calendar if client has connected their account (fire-and-forget)
        if (client.googleCalendarRefreshToken) {
          this.syncBookingToCalendar(booking.id, client.googleCalendarRefreshToken, client.googleCalendarId || 'primary')
            .catch(err => logger.error('Google Calendar sync failed:', err));
        }
      } catch (err) {
        logger.error('Failed to create booking record:', err);
      }
    }

    /* Prévenir le propriétaire, tout de suite. Jamais attendu: la fin d'appel
       n'a pas à dépendre de Twilio ni de Resend. Le spam est déjà sorti plus
       haut, il ne réveille donc personne. */
    void callNotificationService
      .notify(client, {
        id: clientCall.id,
        callerNumber: clientCall.callerNumber,
        callerName: clientCall.callerName,
        summary: clientCall.summary,
        outcome: clientCall.outcome,
        sentiment: clientCall.sentiment,
        durationSeconds: clientCall.durationSeconds,
        isSpam: clientCall.isSpam,
        isLead: clientCall.isLead,
        bookingRequested: clientCall.bookingRequested,
        bookingConfirmed,
      })
      .catch(err => logger.warn('[CallNotify] notification échouée:', err));

    // Update client total calls
    await prisma.client.update({
      where: { id: clientId },
      data: {
        totalCallsMade: { increment: 1 },
        lastCallDate: new Date(),
      },
    });

    // Check minute quota (per-minute billing). Spam is excluded — it never
    // counts against the quota. The quota-alert cron owns the deduped 80/95/100
    // customer emails; this is only an internal Discord heads-up at 90%.
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const usageAgg = await prisma.clientCall.aggregate({
      where: { clientId, isSpam: false, startedAt: { gte: startOfMonth } },
      _sum: { durationSeconds: true },
    });
    const minutesUsed = Math.round((usageAgg._sum.durationSeconds ?? 0) / 60);

    if (client.monthlyMinutesQuota && minutesUsed >= client.monthlyMinutesQuota * 0.9) {
      await discordService.notify(
        `⚠️ QUOTA WARNING\n\nClient: ${client.businessName}\nMinutes this month: ${minutesUsed}/${client.monthlyMinutesQuota}\n${minutesUsed >= client.monthlyMinutesQuota ? '🔴 QUOTA REACHED!' : '🟡 90% of quota used'}`
      );
    }

    /* LE FILET DES PROMESSES (20/09/2026).
       Si l'agent a promis un rappel sans appeler `captureLead`, personne ne
       le saurait: `leadAlertService` sort sur `no_lead` et l'appelant
       raccroche rassuré. On reconstruit le lead depuis l'analyse et on le
       rend à l'appelant de cette fonction, qui porte l'alerte. */
    const rescue = rescuePromise({
      analysis: analysis as PromiseFacts,
      callerNumber: callerNumber ?? null,
      hasLiveLead: !!extra.liveLead,
      hasBooking: bookingConfirmed,
    });
    let rescuedLead: LeadForAlert | null = null;
    if (rescue.rescued) {
      rescuedLead = rescue.lead;
      /* Écrit dans le CRM comme un lead ordinaire: sans ça le gérant reçoit
         une alerte et ne retrouve rien dans son portail, donc deux endroits
         où chercher pour une seule promesse. */
      await prisma.agentCrmActivity.create({
        data: {
          clientId,
          type: 'lead_capture',
          status: 'pending',
          content: {
            source: 'ai_receptionist_rescue',
            vapiCallId,
            clientCallId: clientCall.id,
            capturedAt: new Date().toISOString(),
            contact: { name: rescue.lead.name, email: rescue.lead.email, phone: rescue.lead.phone },
            reason: rescue.lead.reason,
            urgency: rescue.lead.urgency,
            businessName: client.businessName,
          },
        },
      }).catch(err => logger.warn(`[Promise] lead de rattrapage non écrit: ${err.message}`));
      /* BRUYANT, parce que c'est une défaillance du modèle qu'il faut pouvoir
         compter: si ce journal sort à chaque appel, c'est le prompt qu'il faut
         reprendre, pas le filet qu'il faut élargir. */
      logger.warn(
        `[Promise] rappel PROMIS sans captureLead pour ${client.businessName} ` +
          `(appel ${vapiCallId}): lead reconstruit depuis l'analyse.`,
      );
    } else if (rescue.why === 'unreachable') {
      logger.warn(
        `[Promise] rappel promis pour ${client.businessName} (appel ${vapiCallId}) ` +
          `mais AUCUN moyen de rappeler: ni numéro (masqué ?) ni courriel.`,
      );
    }

    logger.info(`Client call processed: ${client.businessName} | ${analysis.sentiment} | Lead: ${analysis.isLead} | Booking: ${analysis.bookingRequested}`);
    return { rescuedLead };
  }

  // Neutral analysis used for spam calls, which skip the GPT-4 pass entirely.
  private emptyAnalysis(): ClientCallAnalysis {
    return {
      callerName: null,
      emailCollected: null,
      sentiment: 'neutral',
      outcome: 'spam',
      summary: 'Call flagged as spam by the inbound shield; analysis skipped.',
      bookingRequested: false,
      bookingDate: null,
      bookingTime: null,
      bookingDetails: null,
      serviceType: null,
      partySize: null,
      specialRequests: null,
      isLead: false,
      leadScore: 0,
      tags: [],
      /* Faux par defaut: un appel de spam, ou une analyse qui n'a pas tourne,
         n'a promis a personne. Le filet ne doit jamais inventer une promesse. */
      callbackPromised: false,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYZE CLIENT CALL TRANSCRIPT - GPT-4 analysis
  // ═══════════════════════════════════════════════════════════
  private async analyzeClientCallTranscript(transcript: string, client: any, knownName: string | null = null): Promise<ClientCallAnalysis> {
    /* AUJOURD'HUI, dans le fuseau de l'entreprise. Sans cette ligne le modèle
       lit « vendredi 18 septembre » dans le transcript et pose l'année qu'il
       veut: un compte réel portait une réservation datée 2023 pour une
       conversation de 2026 (relevé au docteur, 16/09). C'est 6novovicies
       appliqué à l'agent et oublié sur le modèle d'ANALYSE. */
    const todayYmd = todayIso(businessTimezone(client));
    /* Le nom confirmé (réservation relue et épelée, ou mémoire d'appelant)
       est donné au modèle d'analyse: le transcripteur écrit « Jean Lucas »
       pour « Jean-Luc », et sans cette ligne le résumé le répète. */
    /* SANS nom confirmé, le NOM ÉPELÉ du transcript fait foi (21/09/2026).
       Appel réel: le transcripteur entend « Virginie Barre », elle épelle
       « B A R », qui est son vrai nom, l'agent le redit à voix haute — et la
       réservation de rattrapage est partie sous « Barre ». La règle est dans
       la description du champ `callerName` ci-dessous, parce que c'est là que
       le modèle lit quoi extraire.
       Pourquoi ici et pas seulement en aval: quand `bookAppointment` n'a jamais
       abouti, `knownCallerName` rend `null` et l'analyse est la SEULE source du
       nom. L'orthographe épelée est dans le transcript, personne ne lui disait
       de la préférer. */
    const nameHint = knownName
      ? `\n\nThe caller's confirmed name is "${knownName.replace(/["\n]/g, ' ').trim()}" (verified against their booking or prior calls). Use exactly this name for callerName and in the summary, even if the transcript spells it differently.`
      : '';
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert call analyst. Analyze this incoming customer call transcript for ${client.businessName} (${client.businessType}).

Write every free-text field (summary, serviceType, specialRequests, unansweredQuestions) in ${ANALYSIS_LANGUAGE[clientLocale(client)]}, the language of the business, whatever language the transcript is in.

Return a JSON object with:
- callerName: caller's name if mentioned (string or null). If the caller SPELLS their family name letter by letter anywhere in the transcript, that spelling IS the name, even when it is shorter or different from the name heard earlier: the earlier mention is what the transcriber guessed, the spelling is what the caller actually said. Join the letters into one word ("B A R" or "BAR" -> "Bar").
- emailCollected: email if the caller provided one (string or null)
- sentiment: "positive", "neutral", or "negative"
- outcome: "booking_made", "info_provided", "message_taken", "transferred", "complaint", "missed", or "other"
- summary: 2-sentence summary of the call (string)
- bookingRequested: did the caller want to book/make an appointment? (boolean)
- bookingDate: if booking was made, the date (YYYY-MM-DD or null). ${analysisDateRule(todayYmd)}
- bookingTime: if booking was made, the time (string like "14:00" or null)
- serviceType: type of service requested (string or null)
- partySize: number of people if mentioned (number or null)
- specialRequests: any special requests mentioned (string or null)
- isLead: is this person a potential customer/qualified lead? (boolean)
- leadScore: lead quality score 1-10 (number)
- tags: relevant tags like ["new_customer", "complaint", "urgent", "vip", "repeat_customer"] (string[])
- callbackPromised: did the receptionist tell the caller that someone would call them back, get back to them, pass their request to the team, or otherwise follow up after the call? true only when a follow-up was actually promised out loud, false when the caller was fully served on the call. (boolean)
- unansweredQuestions: questions the CALLER asked that the receptionist could not answer, each in the caller's own words, at most 3. Only genuine gaps in business knowledge (prices, hours, services, policies) — never a question the receptionist answered, and never something only the caller could know such as their own name or booking. Empty array when there is none. (string[])${nameHint}`,
            },
            {
              role: 'user',
              content: `Transcript:\n${transcript}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as any;
      /* Un refus d'OpenAI (débit, clé, modèle) rend un corps SANS `choices`:
         lire `choices[0]` faisait un TypeError qui ne nommait rien (alerte
         Discord du 13/09/2026). Le statut et le message du refus sont la seule
         chose qui dise POURQUOI l'analyse a manqué. */
      if (!response.ok || !Array.isArray(data?.choices) || !data.choices[0]?.message?.content) {
        const why = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
        throw new Error(`OpenAI ${response.status} sur l'analyse d'appel: ${why}`);
      }
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      logger.error('Error analyzing client call transcript:', error);
      return {
        /* Analyse indisponible: on ne DEVINE pas de promesse. Un filet qui se
           declenche sur une absence de donnee fabriquerait des leads vides. */
        callbackPromised: false,
        callerName: null,
        emailCollected: null,
        sentiment: 'neutral',
        outcome: 'other',
        summary: 'Automatic analysis failed, manual review needed.',
        bookingRequested: false,
        bookingDate: null,
        bookingTime: null,
        bookingDetails: null,
        serviceType: null,
        partySize: null,
        specialRequests: null,
        isLead: false,
        leadScore: 3,
        tags: [],
        unansweredQuestions: [],
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LOG TRANSFER - Records call transfer events
  // ═══════════════════════════════════════════════════════════
  async logTransfer(clientId: string, vapiCallId: string | undefined, status: string, event: any) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      logger.error(`Client not found for transfer log: ${clientId}`);
      return;
    }

    const transferNumber = client.transferNumber || 'unknown';
    const reason = event.message?.reason || event.reason || 'explicit_request';
    const triggerPhrase = event.message?.triggerPhrase || event.triggerPhrase || null;

    // Map VAPI status to our transfer status
    let transferStatus = 'initiated';
    if (status === 'completed' || status === 'transferred') {
      transferStatus = 'completed';
    } else if (status === 'failed' || status === 'error') {
      transferStatus = 'failed';
    }

    /* La CAUSE, et non plus « No answer » écrit en dur (REL-7).
       Un poste occupé, un numéro refusé, un numéro faux et une boîte vocale
       produisaient tous la même phrase, et cette phrase était fausse trois
       fois sur quatre. C'est pourtant elle qui décide de la suite: « occupé »
       se rappelle dans dix minutes, « numéro faux » se corrige dans les
       réglages du client, et personne ne peut agir sur « No answer ». */
    const endedReason = event.message?.endedReason || event.endedReason || '';
    const reading = readEndedReason(endedReason);
    if (transferStatus === 'initiated') transferFunnel.attempt();
    else transferFunnel.settle(reading);

    /* L'erreur brute du fournisseur d'abord quand il en donne une: elle est
       plus précise que toute classification. La cause lue ensuite, et le
       libellé générique seulement quand les deux manquent. */
    const failedReason =
      transferStatus !== 'failed'
        ? null
        : event.message?.error || (reading.cause === 'other' ? 'cause inconnue' : reading.label);

    const transfer = await prisma.callTransfer.create({
      data: {
        clientId,
        vapiCallId: vapiCallId || null,
        transferNumber,
        reason,
        triggerPhrase,
        preTransferMessage: 'Of course — let me connect you with someone from the team right now. One moment please.',
        transferStatus,
        failedReason,
        callbackRequested: transferStatus === 'failed',
        callbackPriority: transferStatus === 'failed' ? 'high' : 'normal',
      },
    });

    // Discord notification for transfers
    const emoji = transferStatus === 'completed' ? '🔄' : transferStatus === 'failed' ? '❌' : '📞';
    /* La cause dans l'alerte, avec son équivalent SIP: c'est ce qui permet de
       décider sans ouvrir la base. Le code est un ÉQUIVALENT déduit du libellé
       Vapi, pas une lecture sur le fil — le leg téléphonique appartient à Vapi. */
    const cause =
      transferStatus === 'failed' && reading.cause !== 'other'
        ? `\nCause: ${reading.label}${reading.sipEquivalent ? ` (SIP ${reading.sipEquivalent} équivalent)` : ''}`
        : '';
    await discordService.notify(
      `${emoji} CALL TRANSFER ${transferStatus.toUpperCase()}\n\nClient: ${client.businessName}\nTransfer to: ${transferNumber}\nReason: ${reason}${cause}\nVAPI Call: ${vapiCallId || 'N/A'}${transferStatus === 'failed' ? '\n⚠️ Callback requested (high priority)' : ''}`
    );

    logger.info(`Transfer logged for ${client.businessName}: ${transferStatus} → ${transferNumber}`);
    return transfer;
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE CALLBACK REQUEST - For failed transfers
  // ═══════════════════════════════════════════════════════════
  async createCallbackRequest(clientId: string, callerNumber: string, vapiCallId?: string) {
    const transfer = await prisma.callTransfer.create({
      data: {
        clientId,
        vapiCallId: vapiCallId || null,
        transferNumber: 'callback_requested',
        reason: 'explicit_request',
        transferStatus: 'failed',
        failedReason: 'No answer on designated number',
        callbackRequested: true,
        callbackNumber: callerNumber,
        callbackPriority: 'high',
      },
    });

    logger.info(`Callback request created for client ${clientId}, caller: ${callerNumber}`);
    return transfer;
  }

  /**
   * Exchange Google refresh token for access token and sync booking to calendar
   */
  private async syncBookingToCalendar(bookingId: string, refreshToken: string, calendarId: string) {
    const { GOOGLE_CLIENT_ID } = process.env;
    const { GOOGLE_CLIENT_SECRET } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      logger.warn('Google OAuth not configured, skipping calendar sync');
      return;
    }

    // Exchange refresh token for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      logger.error('Failed to refresh Google access token');
      return;
    }

    const tokenData = await tokenResponse.json() as any;
    await googleCalendarService.createEventFromBooking(bookingId, tokenData.access_token, calendarId);
    logger.info(`Booking ${bookingId} synced to Google Calendar`);
  }
}

interface ClientCallAnalysis {
  callerName: string | null;
  emailCollected: string | null;
  sentiment: string;
  outcome: string;
  summary: string;
  bookingRequested: boolean;
  bookingDate: string | null;
  bookingTime: string | null;
  bookingDetails: string | null;
  serviceType: string | null;
  partySize: number | null;
  specialRequests: string | null;
  isLead: boolean;
  leadScore: number;
  tags: string[];
  /**
   * Un rappel a-t-il été PROMIS à voix haute pendant l'appel.
   *
   * Ce champ existe parce que la règle de prompt n'a pas tenu: « promettre un
   * rappel EXIGE captureLead » est écrite dans les trois langues depuis le
   * 16/09, et le modèle l'a enfreinte deux fois depuis. Ce qui doit arriver à
   * coup sûr se pose dans le code, pas dans une consigne. Voir
   * `voice/promise-rescue.ts`.
   */
  callbackPromised: boolean;
  /**
   * Les questions restées sans réponse, dans les mots de l'appelant.
   *
   * Relevées ICI et pas seulement par l'outil de consultation, parce que
   * l'outil n'est attaché qu'aux clients qui ont DÉJÀ une base de
   * connaissances: un client qui n'en a aucune, c'est-à-dire celui qui a le
   * plus à apprendre, n'aurait jamais rien appris. L'analyse tourne de toute
   * façon sur chaque appel; ce champ ne coûte que quelques mots de réponse.
   */
  unansweredQuestions?: string[];
}

export const clientCallService = new ClientCallService();
