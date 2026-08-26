import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { clientDashboardService } from '../services/client-dashboard.service';
import { googleCalendarService } from '../services/google-calendar.service';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { listCharacters, resolveCharacter, CHARACTERS, isValidCharacterId, DEFAULT_CHARACTER_FR, DEFAULT_CHARACTER_EN, CUSTOM_CHARACTER_ID } from '../config/voice-characters';
import { buildVapiConfigPatch, parseFaq } from '../services/client-config.service';
import { knowledgePreset } from '../config/knowledge-presets';

// OAuth state: per-user, signed, short-lived — the callback verifies it was
// minted for the same client that finishes the flow (CSRF protection).
const GCAL_STATE_PREFIX = 'qwillio-gcal.';

export class ClientDashboardController {

  // GET /api/client-portal/:clientId/overview
  async getOverview(req: Request, res: Response) {
    try {
      const overview = await clientDashboardService.getClientOverview(req.params.clientId as string);
      res.json(overview);
    } catch (error: any) {
      if (error.message === 'Client not found') {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/calls
  async getCalls(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        status: req.query.status as string | undefined,
        sentiment: req.query.sentiment as string | undefined,
        isLead: req.query.isLead === 'true' ? true : req.query.isLead === 'false' ? false : undefined,
        isSpam: req.query.isSpam === 'true' ? true : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      const result = await clientDashboardService.getClientCalls(req.params.clientId as string, page, limit, filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/bookings
  async getBookings(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const upcoming = req.query.upcoming !== 'false';
      const result = await clientDashboardService.getClientBookings(req.params.clientId as string, page, limit, upcoming);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/leads
  async getLeads(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await clientDashboardService.getClientLeads(req.params.clientId as string, page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/client-portal/:clientId/analytics
  async getAnalytics(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await clientDashboardService.getClientAnalytics(req.params.clientId as string, days);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ JWT-protected endpoints (use req.clientId from clientMiddleware) ═══

  async getMyOverview(req: any, res: Response) {
    try {
      const overview = await clientDashboardService.getClientOverview(req.clientId);
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyCalls(req: any, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        status: req.query.status as string | undefined,
        sentiment: req.query.sentiment as string | undefined,
        isLead: req.query.isLead === 'true' ? true : req.query.isLead === 'false' ? false : undefined,
        isSpam: req.query.isSpam === 'true' ? true : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      const result = await clientDashboardService.getClientCalls(req.clientId, page, limit, filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyBookings(req: any, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const upcoming = req.query.upcoming !== 'false';
      const result = await clientDashboardService.getClientBookings(req.clientId, page, limit, upcoming);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyLeads(req: any, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await clientDashboardService.getClientLeads(req.clientId, page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyAnalytics(req: any, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await clientDashboardService.getClientAnalytics(req.clientId, days);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Lead management ═══

  // PUT /my-dashboard/leads/:id/status
  async updateLeadStatus(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      // Verify the call belongs to this client
      const call = await prisma.clientCall.findFirst({
        where: { id, clientId: req.clientId },
      });
      if (!call) return res.status(404).json({ error: 'Lead not found' });

      const statusValues = ['new', 'contacted', 'converted', 'lost'];
      await prisma.clientCall.update({
        where: { id },
        data: { tags: { set: [...(call.tags || []).filter((t: string) => !statusValues.includes(t)), status] } },
      });
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/leads/:id/notes
  async updateLeadNotes(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const call = await prisma.clientCall.findFirst({
        where: { id, clientId: req.clientId },
      });
      if (!call) return res.status(404).json({ error: 'Lead not found' });

      await prisma.clientCall.update({
        where: { id },
        data: {
          metadata: {
            ...(typeof call.metadata === 'object' && call.metadata !== null ? call.metadata as Record<string, unknown> : {}),
            clientNotes: notes,
          },
        },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Settings ═══

  // GET /my-dashboard/settings
  async getMySettings(req: any, res: Response) {
    try {
      const { useSpeechToSpeech } = await import('../services/voice/speech-plans');
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: {
          businessName: true,
          businessType: true,
          sector: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          address: true,
          city: true,
          postalCode: true,
          country: true,
          vatNumber: true,
          transferNumber: true,
          vapiPhoneNumber: true,
          vapiConfig: true,
          vapiAssistantId: true,
          subscriptionStatus: true,
          planType: true,
          isTrial: true,
          trialEndDate: true,
          agentLanguage: true,
          agentName: true,
          forwardingStatus: true,
          forwardingType: true,
          forwardingVerifiedAt: true,
          monthlyMinutesQuota: true,
          totalCallsMade: true,
          lastCallDate: true,
          activationDate: true,
          loomVideoUrl: true,
          googleCalendarId: true,
        },
      });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      // Surface JSON-held knowledge fields at top level so the UI can bind
      // directly (items, hours, faq, personalityPreset, personalityNotes).
      const cfg = (client.vapiConfig as any) || {};
      const isFrench = (client as any).agentLanguage === 'fr'
        || ['FR', 'BE', 'LU', 'MC', 'CH'].includes(String((client as any).country || '').toUpperCase());
      res.json({
        ...client,
        items:             Array.isArray(cfg.items) ? cfg.items : [],
        hours:             cfg.hours && typeof cfg.hours === 'object' ? cfg.hours : null,
        faq:               cfg.faq               ?? '',
        personalityPreset: cfg.personalityPreset ?? 'warm',
        personalityNotes:  cfg.personalityNotes  ?? cfg.specialNotes ?? '',
        knowledge:         cfg.knowledge && typeof cfg.knowledge === 'object' ? cfg.knowledge : {},
        // Relues depuis le texte quand elles n'ont jamais ete saisies sous
        // forme d'entrees: sans cela, un client qui a tape sa FAQ a la main
        // verrait une liste vide au-dessus d'une donnee qui existe toujours.
        faqEntries:        Array.isArray(cfg.faqEntries) ? cfg.faqEntries : parseFaq(cfg.faq ?? ''),
        // Les presets de son metier, resolus par la meme lecture que le reste
        // du backend, pour que la page n'ait pas a porter sa propre liste.
        knowledgePresets:  knowledgePreset(client.businessType),
        characterId:       cfg.characterId ?? (isFrench ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN),
        // Null rather than absent: the UI shows either the recorder or the
        // cloned-voice card, and "not loaded yet" must not look like "none".
        customVoice:       cfg.customVoice?.voiceId ? cfg.customVoice : null,
        /* Le moteur vocal. `auto` suit le réglage global, les deux autres
           l'emportent. Normalisé ici comme il l'est à l'écriture: une valeur
           inconnue en base ne doit pas afficher un mode qui n'existe pas. */
        voiceMode:         ['realtime', 'classic'].includes(cfg.voiceMode) ? cfg.voiceMode : 'auto',
        /* Le prix de l'option temps réel, pour que l'écran l'ANNONCE. Un
           supplément à la minute qui ne s'affiche pas là où on l'active se
           découvre sur la facture, et c'est ainsi qu'on récolte un litige
           plutôt qu'un client. 0 = option non vendue, l'écran n'en parle pas. */
        realtimeSurchargeEur: env.VOICE_REALTIME_SURCHARGE_EUR,
        /* Ce que « Automatique » vaut RÉELLEMENT aujourd'hui, calculé par la
           règle qui sert les appels et non recopié dans l'écran. Sans lui,
           l'interface devrait deviner le réglage global du serveur, et
           afficherait « temps réel » là où la plateforme fait du classique. */
        autoResolvesTo: useSpeechToSpeech({ voiceMode: 'auto' }) ? 'realtime' : 'classic',
        /* La synthèse servie à CE client, et celle que la plateforme sert par
           défaut. Les deux, parce que l'écran doit pouvoir afficher « suit le
           réglage global (ElevenLabs) » plutôt qu'un bouton vide. */
        ttsProvider: ['11labs', 'cartesia'].includes(cfg.ttsProvider) ? cfg.ttsProvider : null,
        ttsProviderDefault: env.VOICE_TTS_PROVIDER,
        /* Par où partent les messages. `whatsapp` reste une PRÉFÉRENCE: un type
           de message sans modèle approuvé par Meta repart en SMS plutôt que de
           se perdre. L'écran doit donc le dire, pas le promettre. */
        notificationChannel: cfg.notificationChannel === 'whatsapp' ? 'whatsapp' : 'sms',
        /* Ce que le compte peut RÉELLEMENT faire aujourd'hui. Sans ce drapeau,
           l'écran proposerait un canal qui n'enverra jamais rien, et le client
           croirait avoir activé quelque chose. */
        whatsappAvailable: !!env.TWILIO_WHATSAPP_NUMBER && Object.keys(env.WHATSAPP_TEMPLATE_SIDS).length > 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/settings
  async updateMySettings(req: any, res: Response) {
    try {
      const body = req.body;
      const updateData: any = {};
      if (body.transferNumber !== undefined) updateData.transferNumber = body.transferNumber || null;
      if (body.businessName !== undefined) updateData.businessName = body.businessName || null;
      if (body.businessType !== undefined) updateData.businessType = body.businessType || null;
      if (body.vapiPhoneNumber !== undefined) updateData.vapiPhoneNumber = body.vapiPhoneNumber || null;
      if (body.vapiConfig !== undefined) updateData.vapiConfig = body.vapiConfig;
      if (body.agentLanguage !== undefined) updateData.agentLanguage = body.agentLanguage;
      if (body.agentName !== undefined) updateData.agentName = body.agentName || null;
      if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone || null;
      if (body.address !== undefined) updateData.address = body.address || null;
      if (body.city !== undefined) updateData.city = body.city || null;
      if (body.postalCode !== undefined) updateData.postalCode = body.postalCode || null;
      if (body.forwardingType !== undefined) updateData.forwardingType = body.forwardingType || null;
      if (body.forwardingStatus !== undefined) {
        const allowedStatuses = ['pending', 'active', 'inactive', 'failed'];
        if (body.forwardingStatus && !allowedStatuses.includes(body.forwardingStatus)) {
          return res.status(400).json({ error: 'Invalid forwardingStatus' });
        }
        updateData.forwardingStatus = body.forwardingStatus || null;
        // forwardingVerifiedAt is set only by server-side verification, never by the client
      }
      /* NUMÉRO DE TVA. Normalisé avant d'être gardé: les clients le tapent
         avec des espaces et des points (« BE 0123.456.789 »), et Stripe refuse
         tout ce qui n'est pas la forme compacte. Le format est vérifié ici,
         parce qu'un numéro invalide ne se voit qu'au moment où la facture
         part, c'est-à-dire trop tard. */
      if (body.vatNumber !== undefined) {
        const raw = String(body.vatNumber || '').replace(/[\s.-]/g, '').toUpperCase();
        if (raw && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(raw)) {
          return res.status(400).json({ error: 'Numéro de TVA invalide' });
        }
        updateData.vatNumber = raw || null;
      }
      if (body.loomVideoUrl !== undefined) updateData.loomVideoUrl = body.loomVideoUrl || null;
      if (body.googleCalendarId !== undefined) updateData.googleCalendarId = body.googleCalendarId || null;

      // Merge knowledge-base fields into vapiConfig JSON so the IA has context.
      // - items  : structured list [{ category, name, price }]
      // - hours  : weekly schedule { monday: { open, from, to }, ... }
      // - faq    : free text (Q/A pairs)
      // - specialNotes : free text
      const hasKnowledgeUpdate =
        body.items !== undefined ||
        body.hours !== undefined ||
        body.faq !== undefined ||
        body.faqEntries !== undefined ||
        body.knowledge !== undefined ||
        body.personalityPreset !== undefined ||
        body.personalityNotes !== undefined ||
        body.characterId !== undefined ||
        body.customVoice !== undefined ||
        body.voiceMode !== undefined ||
        body.ttsProvider !== undefined ||
        body.notificationChannel !== undefined;
      if (hasKnowledgeUpdate) {
        const existing = await prisma.client.findUnique({
          where: { id: req.clientId },
          select: { vapiConfig: true },
        });
        const prev = (existing?.vapiConfig as any) || {};
        updateData.vapiConfig = buildVapiConfigPatch(prev, {
          items:             body.items,
          hours:             body.hours,
          faq:               body.faq,
          faqEntries:        body.faqEntries,
          knowledge:         body.knowledge,
          personalityPreset: body.personalityPreset,
          personalityNotes:  body.personalityNotes,
          characterId:       body.characterId,
          customVoice:       body.customVoice,
          /* `buildVapiConfigPatch` savait valider `voiceMode` depuis toujours,
             mais personne ne le lui passait: le réglage existait de bout en
             bout SAUF ici, donc changer de moteur était impossible, y compris
             en appelant l'API à la main. */
          voiceMode:         body.voiceMode,
          ttsProvider:       body.ttsProvider,
          notificationChannel: body.notificationChannel,
        });
      }

      const client = await prisma.client.update({
        where: { id: req.clientId },
        data: updateData,
      });

      // The voice is read from the cached profile on every call, so a change
      // that is not invalidated keeps the old voice answering for the rest of
      // the TTL. The Vapi sync below invalidates too, but only when it succeeds
      // and only when an assistant exists.
      /* `voiceMode` rejoint la liste: le profil est relu depuis le cache à
         chaque appel, donc sans invalidation l'ANCIEN moteur continue de
         répondre pendant tout le TTL. Sur un réglage qu'on change précisément
         pour comparer deux moteurs, l'oubli ferait juger le mauvais. */
      if (body.characterId !== undefined || body.customVoice !== undefined
          || body.voiceMode !== undefined || body.ttsProvider !== undefined) {
        const { realtimeContextService } = await import('../services/voice/realtime-context.service');
        await realtimeContextService.invalidateClient(req.clientId);
      }

      /* LE NUMÉRO DE TVA REMONTE CHEZ STRIPE, sinon il ne sert à rien: gardé
         chez nous seulement, il ne figurerait sur aucune facture, et c'est la
         facture que le comptable du client regarde.
         Best-effort et isolé: une panne Stripe ne doit pas faire échouer
         l'enregistrement des réglages, qui a déjà eu lieu.
         Les anciens identifiants sont retirés d'abord: Stripe les empile, et
         une facture portant deux numéros de TVA est pire que pas de numéro. */
      if (updateData.vatNumber !== undefined && client.stripeCustomerId) {
        try {
          const { stripe } = await import('../config/stripe');
          const existing = await stripe.customers.listTaxIds(client.stripeCustomerId, { limit: 20 });
          /* SEULS les identifiants de TVA européenne sont retirés. Le client
             peut porter d'autres enregistrements fiscaux chez Stripe (numéro
             britannique, suisse, canadien), qui ne nous appartiennent pas et
             qu'une boucle sans filtre effaçait au passage. */
          for (const t of existing.data.filter((x: any) => x.type === 'eu_vat')) {
            await stripe.customers.deleteTaxId(client.stripeCustomerId, t.id);
          }
          if (updateData.vatNumber) {
            await stripe.customers.createTaxId(client.stripeCustomerId, {
              type: 'eu_vat',
              value: updateData.vatNumber,
            });
          }
        } catch (err: any) {
          logger.warn(`[TVA] Numéro non transmis à Stripe pour ${client.id}: ${err.message}`);
        }
      }

      // Auto-sync VAPI assistant within 60s of settings change
      if (client.vapiAssistantId) {
        try {
          const { onboardingService } = await import('../services/onboarding.service');
          await onboardingService.syncVapiAssistant(client.id);
          logger.info(`VAPI assistant synced for client ${client.id}`);
        } catch (err) {
          logger.warn(`Failed to sync VAPI assistant for client ${client.id}:`, err);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/characters — receptionist character catalog for the picker
  async getCharacters(_req: any, res: Response) {
    try {
      res.json({ characters: listCharacters() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/assistant/chat — conversational config/onboarding assistant
  async assistantChat(req: any, res: Response) {
    try {
      const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const messages = raw
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-20)
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
      if (!messages.length) return res.status(400).json({ error: 'messages required' });

      const allowedModes = ['config', 'onboarding', 'receptionist'] as const;
      const mode = allowedModes.includes(req.body?.mode) ? req.body.mode : 'config';

      const { assistantChatService } = await import('../services/assistant-chat.service');
      const result = await assistantChatService.chat(req.clientId, messages, mode);
      res.json(result);
    } catch (error: any) {
      logger.error('assistantChat failed:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/assistant/chat/stream — la même conversation, en flux.
  //
  // Un POST et non un `EventSource`: l'historique du fil ne tient pas dans une
  // URL, et `EventSource` ne sait pas porter l'en-tête d'autorisation. Le
  // client lit donc le corps de la réponse au fur et à mesure.
  async assistantChatStream(req: any, res: Response) {
    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const messages = raw
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (!messages.length) return res.status(400).json({ error: 'messages required' });

    const allowedModes = ['config', 'onboarding', 'receptionist'] as const;
    const mode = allowedModes.includes(req.body?.mode) ? req.body.mode : 'config';

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Render met un proxy devant le service, et un proxy qui met en tampon
    // rend le flux inutile: tout arriverait d'un coup, à la fin.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (payload: any) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    try {
      const { assistantChatService } = await import('../services/assistant-chat.service');
      const result = await assistantChatService.chatStream(
        req.clientId, messages, mode,
        (delta) => send({ delta }),
      );
      send({ done: true, configChanged: result.configChanged, completed: result.completed });
    } catch (error: any) {
      logger.error('assistantChatStream failed:', error);
      // Les en-têtes sont déjà partis: on ne peut plus répondre 500, l'erreur
      // doit voyager dans le flux lui-même pour que la page puisse le dire.
      send({ error: error.message || 'stream_failed' });
    } finally {
      res.end();
    }
  }

  // POST /my-dashboard/assistant/transcribe: speech-to-text for the chat's
  // dictation button. Audio arrives base64-encoded in JSON so no multipart
  // dependency is needed; clips are seconds long and stay far under the 10mb
  // express json limit.
  async assistantTranscribe(req: any, res: Response) {
    try {
      const { audio, mimeType, language } = req.body || {};
      if (typeof audio !== 'string' || !audio) {
        return res.status(400).json({ error: 'audio required' });
      }

      const { transcriptionService, MAX_AUDIO_BYTES } = await import('../services/transcription.service');
      // Check the encoded length first: base64 is ~4/3 of the bytes it carries,
      // so decoding an oversized payload would waste the memory before we
      // rejected it. MAX_AUDIO_BYTES is set below the express json limit so a
      // clip at the cap still reaches this handler and gets the coded 413,
      // rather than a bare PayloadTooLargeError from the body parser.
      if (audio.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 4) {
        return res.status(413).json({ error: 'audio_too_large' });
      }
      const buf = Buffer.from(audio, 'base64');
      if (buf.length > MAX_AUDIO_BYTES) {
        return res.status(413).json({ error: 'audio_too_large' });
      }

      const result = await transcriptionService.transcribe(
        buf,
        typeof mimeType === 'string' ? mimeType : 'audio/webm',
        typeof language === 'string' ? language : undefined,
      );
      res.json(result);
    } catch (error: any) {
      // These are expected, actionable states. The UI shows them to the user
      // rather than failing silently the way the old browser API did.
      const known: Record<string, number> = {
        transcription_unavailable: 503,
        empty_audio: 400,
        audio_too_large: 413,
        transcription_failed: 502,
      };
      const status = known[error.message];
      if (status) return res.status(status).json({ error: error.message });

      logger.error('assistantTranscribe failed:', error);
      res.status(500).json({ error: 'transcription_failed' });
    }
  }

  // POST /my-dashboard/assistant/extract-items: reads a price list out of a
  // photo. The image is never stored, only the lines it yields, and only after
  // the user confirms them in the chat.
  async assistantExtractItems(req: any, res: Response) {
    try {
      const { image, mimeType } = req.body || {};
      if (typeof image !== 'string' || !image) {
        return res.status(400).json({ error: 'image required' });
      }

      const { priceExtractionService, MAX_IMAGE_BYTES } = await import('../services/price-extraction.service');
      if (image.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) {
        return res.status(413).json({ error: 'image_too_large' });
      }

      const items = await priceExtractionService.extract(
        Buffer.from(image, 'base64'),
        typeof mimeType === 'string' ? mimeType : 'image/jpeg',
      );
      res.json({ items });
    } catch (error: any) {
      const known: Record<string, number> = {
        extraction_unavailable: 503,
        empty_image: 400,
        image_too_large: 413,
        extraction_failed: 502,
      };
      const status = known[error.message];
      if (status) return res.status(status).json({ error: error.message });

      logger.error('assistantExtractItems failed:', error);
      res.status(500).json({ error: 'extraction_failed' });
    }
  }

  // GET /my-dashboard/voice/live-config — in-browser Vapi call with THIS
  // client's receptionist.
  //
  // Built by the SAME functions as a real phone call (services/voice/), not by
  // a config written here. The previous version hand-rolled its own assistant:
  // a slower voice model, no speaking plans, no tools. It therefore demoed
  // something worse than the product — the one place where that is least
  // acceptable, since this is what an owner judges the agent on.
  async voiceLiveConfig(req: any, res: Response) {
    try {
      if (!env.VAPI_PUBLIC_KEY) return res.status(503).json({ error: 'Vapi public key not configured' });

      const { realtimeContextService } = await import('../services/voice/realtime-context.service');
      const { businessMemoryService } = await import('../services/voice/business-memory.service');
      const { buildSystemPrompt, firstMessageVariants } = await import('../services/voice/system-prompt');
      const { buildRealtimePlans, buildSpeech } = await import('../services/voice/speech-plans');
      const { buildVoiceTools } = await import('../services/voice/voice-tools');

      const profile = await realtimeContextService.getClientProfile(req.clientId);
      if (!profile) return res.status(404).json({ error: 'Client not found' });

      const caller = { previousCalls: 0, lastCallAt: null, lastSummary: null, knownName: null, hasUpcomingBooking: false };
      const knowledgeBlock = profile.hasKnowledgeBase
        ? businessMemoryService.promptBlock(await businessMemoryService.all(req.clientId), profile.language)
        : '';

      const character = resolveCharacter({
        characterId: profile.characterId,
        isFrench: profile.language === 'fr',
        country: profile.country,
        /* La voix clonée était OUBLIÉE ici, alors que l'appel entrant réel la
           passe. Le client qui avait enregistré la sienne l'entendait sur les
           vrais appels et pas dans son propre test: le test ne testait donc
           pas ce qu'il annonçait. Le mode parole-à-parole rend l'écart
           visible, puisqu'il se décide sur cette même voix clonée. */
        customVoice: profile.customVoice,
      });

      // Reading tools stay: an owner testing the agent should hear it check a
      // real slot. Writing tools do not — every demo would otherwise put a fake
      // appointment in the client's calendar.
      const tools = buildVoiceTools(profile).filter((t: any) => t.function?.name !== 'bookAppointment');

      const testNotice = profile.language === 'fr'
        ? "\n\nCONTEXTE: c'est un appel de test, le gerant joue un appelant. Comporte-toi exactement comme sur un vrai appel, mais ne confirme aucune reservation definitive."
        : '\n\nCONTEXT: this is a test call, the owner is playing a caller. Behave exactly as on a real call, but do not confirm any final booking.';

      const variants = firstMessageVariants(profile, null);

      // Même source que l'appel entrant réel: l'appel test doit sonner comme ce
      // que l'appelant entendra, sinon il ne teste rien.
      const { model, voice, speechToSpeech } = buildSpeech({
        lang: profile.language,
        systemPrompt: buildSystemPrompt(profile, caller, knowledgeBlock) + testNotice,
        tools,
        character,
        hasCustomVoice: !!profile.customVoice,
        // L'appel test suit le mode du client, sinon il teste autre chose que
        // ce que l'appelant entendra.
        voiceMode: profile.voiceMode,
        // L'appel test doit sonner comme l'appel réel, synthèse comprise.
        ttsProvider: profile.ttsProvider,
        /* Pas de secours SUR CET APPEL-CI. Ils font préparer un second
           fournisseur avant que la salle réponde, et c'est du temps d'attente
           que le gérant voit à l'écran. Sur un vrai appel entrant le calcul est
           inverse (une ligne muette coûte un client), et les vrais appels les
           gardent donc: c'est tout l'intérêt d'un drapeau ici plutôt que d'une
           variable d'environnement. */
        fallbacks: false,
      });

      res.json({
        publicKey: env.VAPI_PUBLIC_KEY,
        assistant: {
          name: `${character.name} — ${profile.businessName}`,
          model,
          voice,
          firstMessage: variants[Math.floor(Math.random() * variants.length)],
          ...buildRealtimePlans(profile.language, speechToSpeech, { fallbacks: false }),
          backgroundSound: env.VOICE_BACKGROUND_SOUND,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /my-dashboard/voice/live-diagnosis/:callId — pourquoi l'appel de test
   * s'est-il coupé ?
   *
   * Le SDK web ne le sait pas. Quand Vapi met fin à la session, le navigateur
   * ne voit qu'une salle fermée: `{"type":"ejected","msg":"Meeting has ended"}`,
   * qui décrit le SYMPTÔME et jamais la cause (voix indisponible, crédit épuisé,
   * modèle refusé…). La raison n'existe qu'à un seul endroit, l'enregistrement
   * d'appel chez Vapi, sous `endedReason`.
   *
   * L'assistant de test est TRANSIENT (envoyé par le navigateur, sans
   * `serverUrl`): aucun webhook de fin d'appel ne nous parvient, et c'est
   * pourquoi rien de tout cela n'apparaissait dans nos journaux.
   *
   * Cloisonnement: un identifiant d'appel se devine, donc on vérifie que
   * l'appel est bien un appel WEB portant le nom d'assistant que CE client
   * génère, et on ne renvoie que l'état et la raison. Ni transcription, ni
   * enregistrement, ni coût: le strict nécessaire pour afficher une phrase.
   */
  async voiceLiveDiagnosis(req: any, res: Response) {
    try {
      /* Le PROFIL plutôt qu'une requête à part: il est en cache, il porte le
         nom d'entreprise qui sert de cloisonnement, et il porte surtout la
         voix clonée dont dépend le moteur réellement retenu. */
      const { realtimeContextService } = await import('../services/voice/realtime-context.service');
      const { useSpeechToSpeech } = await import('../services/voice/speech-plans');

      const profile = await realtimeContextService.getClientProfile(req.clientId);
      if (!profile) return res.status(404).json({ error: 'Client not found' });

      /* Le moteur EFFECTIF, décidé par la même fonction que l'appel lui-même.
         Renvoyer le réglage brut mentirait dans le seul cas qui compte: une
         voix clonée force le classique par-dessus un réglage « direct », et
         l'écran conseillerait alors de rebasculer un mode qui n'a jamais
         servi. */
      const effectiveMode = useSpeechToSpeech({
        hasCustomVoice: !!profile.customVoice,
        clonedVoice: profile.customVoice?.cloned,
        voiceMode: profile.voiceMode,
      }) ? 'realtime' : 'classic';

      const { vapiClient } = await import('../config/vapi');

      /* L'appel se retrouve par le contenu, pas par un identifiant fourni.
         Le SDK web ne rend le sien qu'une fois `start()` tenue, et l'echec le
         devance: c'est ce qui rendait ce diagnostic muet a son premier essai.
         On relit donc la liste des derniers appels du compte et on y cherche
         CELUI de ce client.
         Le filtre EST le cloisonnement, et il porte sur trois criteres a la
         fois: appel web, nom d'assistant genere pour cette entreprise, et
         recent. La liste couvre tout le compte, donc rien ne doit sortir
         d'ici sans avoir passe ces trois-la. */
      const callId = typeof req.params.callId === 'string' && /^[a-zA-Z0-9-]{10,64}$/.test(req.params.callId)
        ? req.params.callId
        : null;

      const belongsHere = (c: any) =>
        c?.type === 'webCall' &&
        typeof c?.assistant?.name === 'string' &&
        c.assistant.name.includes(profile.businessName);

      let call: any = null;
      if (callId) {
        const found: any = await vapiClient.getCall(callId);
        if (!belongsHere(found)) return res.status(403).json({ error: 'not_your_call' });
        call = found;
      } else {
        const recent: any = await vapiClient.listCalls(20);
        const list: any[] = Array.isArray(recent) ? recent : (recent?.results ?? []);
        const since = Date.now() - 15 * 60 * 1000;
        call = list.find(c => belongsHere(c) && new Date(c.createdAt ?? 0).getTime() >= since) ?? null;
      }

      if (!call) return res.status(404).json({ error: 'no_recent_call' });

      /* Écrit aussi dans NOS journaux. L'assistant de test est transient, donc
         aucun webhook de fin d'appel ne nous parvient et cette raison ne laisse
         sinon aucune trace: elle vit à l'écran du gérant, quelques secondes,
         sur un téléphone. Une ligne ici la rend consultable après coup. */
      if (call.endedReason) {
        logger.warn(
          `voiceLiveDiagnosis client=${req.clientId} mode=${effectiveMode} endedReason=${call.endedReason}`,
        );
      }

      res.json({
        status: call.status ?? null,
        endedReason: call.endedReason ?? null,
        /* Le moteur réellement employé pour cet appel. L'écran s'en sert pour
           proposer le seul geste qui isole la panne: rebasculer en classique.
           Sans lui il devrait deviner, et il devinerait faux dès qu'une voix
           clonée force le classique par-dessus le réglage. */
        voiceMode: effectiveMode,
      });
    } catch (error: any) {
      // Un diagnostic qui échoue ne doit pas empiler un second message par-dessus
      // le premier: le composant affiche alors ce qu'il avait déjà.
      logger.warn(`voiceLiveDiagnosis failed: ${error?.message}`);
      res.status(502).json({ error: 'diagnosis_unavailable' });
    }
  }

  // GET /my-dashboard/assistant/voice-config — talk to the CONFIG assistant by
  // voice instead of typing.
  //
  // Same voice stack as the receptionist (flash model, speaking plans,
  // backchannels): configuring the agent should not feel worse than the agent.
  // Different job though — this one changes settings, it does not answer
  // callers, so it carries no receptionist tools.
  async assistantVoiceConfig(req: any, res: Response) {
    try {
      if (!env.VAPI_PUBLIC_KEY) return res.status(503).json({ error: 'Vapi public key not configured' });

      const { realtimeContextService } = await import('../services/voice/realtime-context.service');
      const { buildRealtimePlans, buildVoice } = await import('../services/voice/speech-plans');
      const { assistantChatService } = await import('../services/assistant-chat.service');

      const profile = await realtimeContextService.getClientProfile(req.clientId);
      if (!profile) return res.status(404).json({ error: 'Client not found' });

      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      const character = resolveCharacter({
        characterId: profile.characterId,
        isFrench: profile.language === 'fr',
        country: profile.country,
        /* La voix de remplacement était OUBLIÉE ici, et elle seule. L'appel
           réel et l'appel de test l'appliquent, l'aperçu de la fiche aussi
           désormais: cet assistant restait le dernier à parler avec la voix du
           catalogue. Deux voix pour un seul réglage, c'est exactement ce que
           l'utilisateur a rapporté (« l'assistant a la bonne voix », l'appel
           non), et le seul moyen de le trancher est que les quatre endroits
           lisent la MÊME résolution. */
        customVoice: profile.customVoice,
      });

      const fr = profile.language === 'fr';
      // Spoken configuration needs its own rules: reading a settings list out
      // loud is unlistenable, so it asks one question at a time.
      const spokenRules = fr
        ? [
            'Tu configures le receptionniste IA de ce commerce, a la voix.',
            'Une question a la fois. Jamais de liste a voix haute.',
            'Reformule brievement ce que tu as compris avant de passer au point suivant.',
            'Si le gerant hesite, propose la valeur la plus courante pour son secteur.',
          ].join('\n')
        : [
            'You are configuring this business\'s AI receptionist, by voice.',
            'One question at a time. Never read a list out loud.',
            'Briefly restate what you understood before moving on.',
            'If the owner hesitates, offer the most common value for their sector.',
          ].join('\n');

      res.json({
        publicKey: env.VAPI_PUBLIC_KEY,
        assistant: {
          name: `Config — ${profile.businessName}`,
          model: {
            provider: 'openai',
            model: env.VAPI_MODEL,
            temperature: 0.6,
            maxTokens: env.VOICE_MAX_COMPLETION_TOKENS,
            messages: [{
              role: 'system',
              content: `${assistantChatService.voiceConfigPrompt(client, fr)}\n\n${spokenRules}`,
            }],
          },
          voice: buildVoice({
            voiceId: character.voiceId,
            stability: character.stability,
            similarityBoost: character.similarityBoost,
            style: character.style,
            lang: fr ? 'fr' : 'en',
          }),
          firstMessage: fr
            ? `Bonjour ! On configure votre standard ensemble. Qu'est-ce que vous voulez ajuster ?`
            : `Hi! Let's set up your receptionist together. What would you like to adjust?`,
          // Même raison que l'appel test: cet assistant se lance depuis un
          // navigateur, devant quelqu'un qui attend.
          ...buildRealtimePlans(profile.language, false, { fallbacks: false }),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/characters/:id/preview[?voiceId=…] — real ElevenLabs
  // voice sample (mp3). Falls back with 503 when no ELEVENLABS_API_KEY so the
  // UI can use TTS.
  //
  // `voiceId` auditions another voice through the same character: that is what
  // the client will actually hear once they save the override, tuning included.
  async characterPreview(req: any, res: Response) {
    try {
      const id = String(req.params.id || '');
      const isCustom = id === CUSTOM_CHARACTER_ID;
      if (!isCustom && !isValidCharacterId(id)) return res.status(404).json({ error: 'Unknown character' });
      if (!env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'elevenlabs_key_missing' });

      // The sample follows the CLIENT's language, not the character's: a
      // character is bilingual now, so playing French to an English client
      // would demo a voice they will never hear.
      const previewClient = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { agentLanguage: true, country: true, vapiConfig: true },
      });

      // `custom` is the old pseudo-character, kept because configs written
      // before the override model still name it. It resolves to whatever voice
      // the client chose, over the default character.
      let character = isCustom ? null : CHARACTERS[id];
      /* Une voix CLONÉE ne quitte pas ElevenLabs, et l'aperçu doit le savoir:
         sinon il auditionnerait un timbre Cartesia là où l'appel servira le
         clone. Voir `useCartesia`. */
      let cloned = false;
      if (isCustom) {
        const custom = (previewClient?.vapiConfig as any)?.customVoice;
        const voiceId = (custom?.voiceId ?? '') as string;
        if (!voiceId) return res.status(404).json({ error: 'no_custom_voice' });
        cloned = custom?.cloned === true;
        const base = CHARACTERS[previewClient?.agentLanguage?.startsWith('fr') ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN];
        character = {
          ...base,
          voiceId,
          ...(custom?.provider === 'cartesia' ? { voiceProvider: 'cartesia' as const } : {}),
          style: 0,
          similarityBoost: 0.85,
        };
      }
      if (!character) return res.status(404).json({ error: 'Unknown character' });

      const overrideId = String(req.query.voiceId || '').trim();
      /* Remonté AU DESSUS du bloc `overrideId`: la langue sert maintenant à
         choisir le catalogue à interroger, pas seulement le texte de la
         phrase, et elle était déclarée après. */
      const previewFrench = previewClient?.agentLanguage?.startsWith('fr')
        || ['FR', 'BE', 'LU', 'MC', 'CH'].includes(String(previewClient?.country || '').toUpperCase());

      if (overrideId) {
        // Checked against the account's own voices so this route cannot be used
        // as an open text-to-speech proxy on our ElevenLabs quota.
        const { voiceCatalogService } = await import('../services/voice/voice-catalog.service');
        /* Filtré par client ici AUSSI, et pas seulement à l'affichage: sans
           ça, un identifiant de voix deviné donnerait à écouter le clone d'un
           autre client par cette route d'aperçu. */
        const tts = (previewClient?.vapiConfig as any)?.ttsProvider;
        const voices = await voiceCatalogService
          .list(req.clientId, previewFrench ? 'fr' : 'en',
                tts === 'cartesia' || tts === '11labs' ? tts : undefined)
          .catch(() => []);
        const match = voices.find(v => v.voiceId === overrideId);
        if (!match) return res.status(404).json({ error: 'unknown_voice' });
        character = {
          ...character,
          voiceId: match.voiceId,
          ...(match.provider ? { voiceProvider: match.provider } : {}),
          ...(match.cloned ? { style: 0, similarityBoost: 0.85 } : {}),
        };
        cloned = match.cloned;
      }

      const text = previewFrench ? character.previewFr : character.previewEn;

      // Synthesised once, then read from the cache. The line never changes, so
      // paying for it and waiting for it on every press of ▶ bought nothing —
      // and it was the delay before the sound, and the silence once the account
      // hit its rate limit.
      const { previewAudioService } = await import('../services/voice/preview-audio.service');
      const { audio, key } = await previewAudioService.get({
        voiceId: character.voiceId,
        text,
        stability: character.stability,
        similarityBoost: character.similarityBoost,
        style: character.style,
        lang: previewFrench ? 'fr' : 'en',
        cloned,
        /* Sans ça, l'aperçu d'une voix Cartesia chercherait son identifiant
           dans la table de correspondance, ne l'y trouverait pas, et jouerait
           la voix par défaut: on auditionnerait autre chose que ce qu'on
           croit choisir. */
        voiceProvider: character.voiceProvider,
        ttsProvider: (previewClient?.vapiConfig as any)?.ttsProvider,
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      // A week, and an ETag: the clip is immutable for a given voice and line,
      // so a second press should not leave the device at all.
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.setHeader('ETag', `"${key}"`);
      if (req.headers['if-none-match'] === `"${key}"`) return res.status(304).end();
      res.send(audio);
    } catch (error: any) {
      const { PreviewAudioError } = await import('../services/voice/preview-audio.service');
      if (error instanceof PreviewAudioError) {
        return res.status(error.status).json({
          error: error.message,
          status: error.upstream,
          reason: error.reason,
        });
      }
      logger.error('characterPreview failed:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/characters/warm — synthesise the catalog's clips ahead
  // of the first press, so ▶ plays instantly instead of waiting on a paid API.
  async warmCharacterPreviews(req: any, res: Response) {
    // Answers immediately: this is a hint, and the page must not wait on it.
    // La clé à vérifier est celle du fournisseur ACTIF: sous Fish Audio, exiger
    // la clé ElevenLabs éteindrait le préchauffage sans raison, et les cartes
    // repartiraient à attendre leur synthèse au premier clic.
    const previewKeyPresent = env.VOICE_PREVIEW_PROVIDER === 'fish'
      ? !!env.FISH_AUDIO_API_KEY
      : !!env.ELEVENLABS_API_KEY;
    res.json({ started: previewKeyPresent });
    if (!previewKeyPresent) return;

    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { agentLanguage: true, country: true, vapiConfig: true },
      });
      const isFrench = client?.agentLanguage?.startsWith('fr')
        || ['FR', 'BE', 'LU', 'MC', 'CH'].includes(String(client?.country || '').toUpperCase());
      const override = ((client?.vapiConfig as any)?.customVoice?.voiceId ?? '') as string;

      const { previewAudioService } = await import('../services/voice/preview-audio.service');
      void previewAudioService.warm(listCharacters().map(c => ({
        // With an override in place, every card plays that voice — warming the
        // catalog voices instead would warm clips nobody will hear.
        voiceId: override || c.voiceId,
        text: isFrench ? c.previewFr : c.previewEn,
        stability: c.stability,
        similarityBoost: c.similarityBoost,
        style: c.style,
        lang: (isFrench ? 'fr' : 'en') as 'fr' | 'en',
      })));
    } catch (error: any) {
      logger.debug(`warmCharacterPreviews failed: ${error.message}`);
    }
  }

  // ── Clés d'API ────────────────────────────────────────────────────────
  // « Accès API complet » est vendu sur Enterprise: la porte est donc ouverte
  // là, et nulle part ailleurs. Le contrôle est refait à chaque requête de
  // l'API elle-même, celui-ci ne fait qu'éviter de créer une clé inutilisable.

  private async requireApiPlan(req: any, res: Response): Promise<{ userId: string } | null> {
    const client = await prisma.client.findUnique({
      where: { id: req.clientId },
      select: { userId: true, planType: true },
    });
    if (!client?.userId) {
      res.status(404).json({ error: 'client_not_found' });
      return null;
    }
    if ((client.planType || '').toLowerCase() !== 'enterprise') {
      res.status(403).json({ error: 'plan_required', message: "L'API est incluse au forfait Enterprise." });
      return null;
    }
    return { userId: client.userId };
  }

  async listApiKeys(req: any, res: Response) {
    try {
      const ok = await this.requireApiPlan(req, res);
      if (!ok) return;
      const { agencyService } = await import('../services/agency.service');
      res.json({ keys: await agencyService.listApiKeys(ok.userId) });
    } catch (error: any) {
      logger.error('[api-keys] liste impossible:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async createApiKey(req: any, res: Response) {
    try {
      const ok = await this.requireApiPlan(req, res);
      if (!ok) return;
      const name = String(req.body?.name || '').trim().slice(0, 120) || 'Clé sans nom';
      const { agencyService } = await import('../services/agency.service');
      const created = await agencyService.createApiKey(ok.userId, name, ['read']);
      /* La clé complète n'est montrée QU'ICI. La liste ne la renvoie jamais:
         une clé qu'on peut relire à volonté n'est plus un secret. */
      res.status(201).json({ id: created.id, name: created.name, key: created.key, createdAt: created.createdAt });
    } catch (error: any) {
      logger.error('[api-keys] création impossible:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async revokeApiKey(req: any, res: Response) {
    try {
      const ok = await this.requireApiPlan(req, res);
      if (!ok) return;
      const { agencyService } = await import('../services/agency.service');
      const r = await agencyService.revokeApiKey(String(req.params.id), ok.userId);
      if (!r.count) return res.status(404).json({ error: 'key_not_found' });
      res.json({ revoked: true });
    } catch (error: any) {
      logger.error('[api-keys] révocation impossible:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /* ── Les numéros du client ────────────────────────────────────────────
   *
   * DEUX CHOSES DIFFÉRENTES VIVENT DANS CETTE TABLE, et les confondre a coûté
   * la fonctionnalité entière:
   *
   *  1. SON PROPRE NUMÉRO, celui que ses clients composent depuis toujours et
   *     qu'il renvoie vers notre ligne. Le déclarer n'est pas une option de
   *     confort: c'est ce qui permet au routage de reconnaître un appel renvoyé
   *     (voir `divertedNumber`), donc ce qui rend une ligne partagée utilisable
   *     par plusieurs clients. Sans lui, un client doit acheter et faire valider
   *     un numéro à lui, et en attendant il reçoit un numéro américain qu'il ne
   *     peut même pas appeler pour tester.
   *
   *  2. SES LIGNES SUPPLÉMENTAIRES (« Boutique Ixelles »), qui sont bien
   *     l'option multi-sites vendue sur Enterprise.
   *
   * La première était barrée par le même contrôle de forfait que la seconde.
   * C'est ce qui rendait le renvoi d'appel inopérant pour tout le monde sauf
   * Enterprise, alors que le renvoi est justement ce qu'on demande à TOUS les
   * clients de faire à l'installation. Le premier numéro est donc gratuit; les
   * suivants restent l'option payante. */

  /** Le forfait est exigé à partir de la DEUXIÈME ligne, pas de la première. */
  private async requireLinePlan(req: any, res: Response): Promise<boolean> {
    const [client, count] = await Promise.all([
      prisma.client.findUnique({ where: { id: req.clientId }, select: { planType: true } }),
      prisma.clientPhoneNumber.count({ where: { clientId: req.clientId } }),
    ]);
    if (count === 0) return true;
    if ((client?.planType || '').toLowerCase() === 'enterprise') return true;
    res.status(403).json({
      error: 'plan_required',
      message: 'Les lignes supplémentaires (multi-sites) sont incluses au forfait Enterprise. '
        + 'Votre propre numéro, lui, reste gratuit.',
    });
    return false;
  }

  async listPhoneNumbers(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { vapiPhoneNumber: true, phoneNumbers: { orderBy: { createdAt: 'asc' } } },
      });
      res.json({ primary: client?.vapiPhoneNumber || null, numbers: client?.phoneNumbers ?? [] });
    } catch (error: any) {
      logger.error('[phone-numbers] liste impossible:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async addPhoneNumber(req: any, res: Response) {
    try {
      if (!(await this.requireLinePlan(req, res))) return;

      const number = String(req.body?.number || '').trim();
      /* Au moins huit chiffres, comme le routage entrant: en accepter moins
         créerait une ligne qui ne pourra jamais correspondre à un appel. */
      if (number.replace(/\D/g, '').length < 8) {
        return res.status(400).json({ error: 'invalid_number' });
      }

      /* Un même numéro chez deux clients rend l'appel non routable (le service
         de routage refuse alors de deviner). Autant le refuser ici, où l'on
         peut encore l'expliquer. */
      const digits = number.replace(/\D/g, '');
      const [taken, others] = await Promise.all([
        prisma.client.findMany({ select: { id: true, vapiPhoneNumber: true } }),
        prisma.clientPhoneNumber.findMany({ select: { clientId: true, number: true } }),
      ]);
      const clash =
        taken.some(c => c.id !== req.clientId && (c.vapiPhoneNumber || '').replace(/\D/g, '') === digits) ||
        others.some(p => p.clientId !== req.clientId && p.number.replace(/\D/g, '') === digits);
      if (clash) return res.status(409).json({ error: 'number_already_routed' });

      const created = await prisma.clientPhoneNumber.create({
        data: {
          clientId: req.clientId,
          number,
          label: req.body?.label ? String(req.body.label).trim().slice(0, 120) : null,
        },
      });
      res.status(201).json({ number: created });
    } catch (error: any) {
      logger.error('[phone-numbers] ajout impossible:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async removePhoneNumber(req: any, res: Response) {
    try {
      const r = await prisma.clientPhoneNumber.deleteMany({
        where: { id: String(req.params.id), clientId: req.clientId },
      });
      if (!r.count) return res.status(404).json({ error: 'number_not_found' });
      res.json({ removed: true });
    } catch (error: any) {
      logger.error('[phone-numbers] suppression impossible:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/voices — the voices available on the ElevenLabs account,
  // so a voice is chosen after being heard instead of pasted as an opaque id.
  async listVoices(req: any, res: Response) {
    try {
      const { voiceCatalogService } = await import('../services/voice/voice-catalog.service');
      // L'identifiant FILTRE les clones: sans lui, ce client verrait les voix
      // clonées de tous les autres. Voir `cloneBelongsTo`.
      /* La langue de l'agent: le catalogue Cartesia est filtré dessus, sans
         quoi un gérant francophone choisirait parmi des voix anglaises. */
      const c = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { agentLanguage: true, vapiConfig: true },
      });
      const lang = c?.agentLanguage === 'nl' ? 'nl' : c?.agentLanguage === 'en' ? 'en' : 'fr';
      const tts = (c?.vapiConfig as any)?.ttsProvider;
      res.json({
        voices: await voiceCatalogService.list(
          req.clientId, lang,
          tts === 'cartesia' || tts === '11labs' ? tts : undefined,
        ),
      });
    } catch (error: any) {
      // 503 rather than 500 for a missing key: the UI shows "not configured",
      // which is actionable, instead of "server error", which is not.
      if (error.message === 'elevenlabs_key_missing') {
        return res.status(503).json({ error: 'elevenlabs_key_missing' });
      }
      if (error.message === 'elevenlabs_list_failed') {
        return res.status(502).json({ error: 'elevenlabs_list_failed' });
      }
      // Mêmes deux cas, côté Cartesia: un réglage absent se dit, une panne amont
      // se distingue d'une erreur de notre part.
      if (error.message === 'cartesia_key_missing') {
        return res.status(503).json({ error: 'cartesia_key_missing' });
      }
      if (error.message === 'cartesia_list_failed' || error.message === 'cartesia_unreachable') {
        return res.status(502).json({ error: 'cartesia_list_failed' });
      }
      logger.error('listVoices failed:', error);
      res.status(500).json({ error: 'voices_unavailable' });
    }
  }

  // POST /my-dashboard/voice-clone — the client's own voice as the receptionist.
  //
  // The sample arrives base64 in JSON, like the dictation endpoint: the express
  // json parser already handles it, and adding multipart here would mean a new
  // dependency for one route.
  async createVoiceClone(req: any, res: Response) {
    try {
      const { audio, mimeType, label, consent } = req.body || {};
      if (typeof audio !== 'string' || !audio) return res.status(400).json({ error: 'audio required' });

      const { voiceCloneService, MAX_SAMPLE_BYTES } =
        await import('../services/voice/voice-clone.service');

      // Encoded length first: base64 is ~4/3 of what it carries, so an oversized
      // payload is rejected before it costs the memory to decode it.
      if (audio.length > Math.ceil((MAX_SAMPLE_BYTES * 4) / 3) + 4) {
        return res.status(413).json({ error: 'sample_too_large' });
      }

      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const current = (client.vapiConfig as Record<string, unknown>) ?? {};
      const previous = current.customVoice as { voiceId?: string } | undefined;

      const voice = await voiceCloneService.create({
        clientId: req.clientId,
        sample: Buffer.from(audio, 'base64'),
        mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
        label: typeof label === 'string' ? label : '',
        consent: consent === true,
      });

      await prisma.client.update({
        where: { id: req.clientId },
        // Selecting it immediately is the point of the screen: a client who
        // records their voice wants to hear it answer, not to then hunt for a
        // radio button. The character is left alone — the clone changes how the
        // agent sounds, not who it is.
        data: { vapiConfig: { ...current, customVoice: { ...voice, cloned: true } } },
      });

      // Re-cloning replaces: leaving the old voice on the shared ElevenLabs
      // account would accumulate one dead voice per retry, and the account has
      // a voice limit.
      if (previous?.voiceId && previous.voiceId !== voice.voiceId) {
        void voiceCloneService.remove(previous.voiceId);
      }

      const { realtimeContextService } = await import('../services/voice/realtime-context.service');
      await realtimeContextService.invalidateClient(req.clientId);
      // The new clone must appear in the voice list now, not in ten minutes.
      const { voiceCatalogService } = await import('../services/voice/voice-catalog.service');
      voiceCatalogService.invalidate();

      res.json({ success: true, voice });
    } catch (error: any) {
      const { VoiceCloneError } = await import('../services/voice/voice-clone.service');
      if (error instanceof VoiceCloneError) {
        return res.status(error.status).json({ error: error.message, upstream: error.upstream });
      }
      logger.error('createVoiceClone failed:', error);
      res.status(500).json({ error: 'voice_clone_failed' });
    }
  }

  // DELETE /my-dashboard/voice-clone
  async deleteVoiceClone(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const current = (client.vapiConfig as Record<string, unknown>) ?? {};
      const voice = current.customVoice as { voiceId?: string } | undefined;
      const { customVoice: _removed, ...rest } = current;

      // Dropping the override is enough now that it sits on top of a real
      // character. Configs written before that still say `custom`, which points
      // at nothing once the voice is gone, so they are migrated here.
      const characterId = current.characterId === CUSTOM_CHARACTER_ID
        ? (client.agentLanguage?.startsWith('fr') ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN)
        : (typeof current.characterId === 'string' ? current.characterId : null);

      await prisma.client.update({
        where: { id: req.clientId },
        data: { vapiConfig: { ...rest, characterId } },
      });

      const { voiceCloneService } = await import('../services/voice/voice-clone.service');
      if (voice?.voiceId) await voiceCloneService.remove(voice.voiceId);

      const { realtimeContextService } = await import('../services/voice/realtime-context.service');
      await realtimeContextService.invalidateClient(req.clientId);
      const { voiceCatalogService } = await import('../services/voice/voice-catalog.service');
      voiceCatalogService.invalidate();

      res.json({ success: true, characterId });
    } catch (error: any) {
      logger.error('deleteVoiceClone failed:', error);
      res.status(500).json({ error: 'voice_clone_delete_failed' });
    }
  }

  /**
   * DELETE /my-dashboard/voices/:voiceId — supprimer une voix clonée.
   *
   * `deleteVoiceClone` ne sait retirer qu'UNE voix: celle qui est enregistrée
   * dans `vapiConfig.customVoice`. Un client qui ré-enregistre, puis change
   * d'avis et reprend une voix de la bibliothèque, laisse derrière lui un clone
   * que plus rien ne référence: il reste dans la liste, il ne peut plus en
   * sortir, et c'est l'enregistrement de sa propre voix. D'où cette route.
   *
   * La propriété se vérifie contre le catalogue filtré par client, jamais
   * contre le paramètre reçu: le compte ElevenLabs est partagé, et un
   * identifiant deviné supprimerait la voix d'un autre.
   */
  async deleteCatalogVoice(req: any, res: Response) {
    try {
      const voiceId = String(req.params.voiceId || '');
      if (!voiceId) return res.status(400).json({ error: 'voice_id_required' });

      const { voiceCatalogService } = await import('../services/voice/voice-catalog.service');
      const mine = await voiceCatalogService.list(req.clientId);
      const match = mine.find(v => v.voiceId === voiceId);
      // Absente de SA liste: soit elle n'existe pas, soit elle appartient à
      // quelqu'un d'autre. Les deux se répondent pareil, pour ne pas confirmer
      // l'existence d'un identifiant deviné.
      if (!match) return res.status(404).json({ error: 'voice_not_found' });
      // Les voix de bibliothèque n'appartiennent à personne: les effacer les
      // retirerait à toute la flotte.
      if (!match.cloned) return res.status(403).json({ error: 'voice_not_deletable' });

      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const { voiceCloneService } = await import('../services/voice/voice-clone.service');
      await voiceCloneService.remove(voiceId);

      // Si c'était la voix en service, la configuration doit lâcher prise en
      // même temps, sinon la réceptionniste pointe vers une voix effacée et se
      // tait au prochain appel.
      const current = (client.vapiConfig as Record<string, unknown>) ?? {};
      const selected = current.customVoice as { voiceId?: string } | undefined;
      let characterId = typeof current.characterId === 'string' ? current.characterId : null;
      if (selected?.voiceId === voiceId) {
        const { customVoice: _removed, ...rest } = current;
        characterId = current.characterId === CUSTOM_CHARACTER_ID
          ? (client.agentLanguage?.startsWith('fr') ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN)
          : characterId;
        await prisma.client.update({
          where: { id: req.clientId },
          data: { vapiConfig: { ...rest, characterId } },
        });
        const { realtimeContextService } = await import('../services/voice/realtime-context.service');
        await realtimeContextService.invalidateClient(req.clientId);
      }

      voiceCatalogService.invalidate();
      res.json({ success: true, cleared: selected?.voiceId === voiceId, characterId });
    } catch (error: any) {
      if (error.message === 'elevenlabs_key_missing') {
        return res.status(503).json({ error: 'elevenlabs_key_missing' });
      }
      logger.error('deleteCatalogVoice failed:', error);
      res.status(500).json({ error: 'voice_delete_failed' });
    }
  }

  // POST /my-dashboard/pause
  async pauseAgent(req: any, res: Response) {
    try {
      await prisma.client.update({
        where: { id: req.clientId },
        data: { subscriptionStatus: 'paused' },
      });
      res.json({ success: true, status: 'paused' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/resume
  async resumeAgent(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      const status = client.isTrial ? 'trialing' : 'active';
      await prisma.client.update({
        where: { id: req.clientId },
        data: { subscriptionStatus: status },
      });
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Base de connaissance (le chemin d'écriture du RAG) ═══

  // GET /my-dashboard/knowledge
  async listKnowledge(req: any, res: Response) {
    try {
      const { businessKnowledgeService } = await import('../services/business-knowledge.service');
      res.json({ entries: await businessKnowledgeService.list(req.clientId) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/knowledge
  async createKnowledge(req: any, res: Response) {
    try {
      const { businessKnowledgeService } = await import('../services/business-knowledge.service');
      const result = await businessKnowledgeService.create(req.clientId, req.body || {});
      if ('error' in result) return res.status(400).json(result);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/knowledge/:id
  async updateKnowledge(req: any, res: Response) {
    try {
      const { businessKnowledgeService } = await import('../services/business-knowledge.service');
      const result = await businessKnowledgeService.update(req.clientId, req.params.id, req.body || {});
      if ('error' in result) {
        return res.status(result.error === 'not_found' ? 404 : 400).json(result);
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /my-dashboard/knowledge/:id
  async deleteKnowledge(req: any, res: Response) {
    try {
      const { businessKnowledgeService } = await import('../services/business-knowledge.service');
      const result = await businessKnowledgeService.remove(req.clientId, req.params.id);
      if ('error' in result) return res.status(404).json(result);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /my-dashboard/knowledge/import-preset — la FAQ du métier, pré-rédigée.
  async importKnowledgePreset(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { businessType: true },
      });
      const { businessKnowledgeService } = await import('../services/business-knowledge.service');
      res.json(await businessKnowledgeService.importPreset(req.clientId, client?.businessType));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Rétention des données (RGPD) ═══

  // GET /my-dashboard/retention
  async getRetention(req: any, res: Response) {
    try {
      const { resolveRetentionDays, DEFAULT_RETENTION_DAYS, MIN_RETENTION_DAYS, MAX_RETENTION_DAYS } =
        await import('../services/data-retention.service');
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { retentionDays: true },
      });
      res.json({
        retentionDays: resolveRetentionDays(client?.retentionDays),
        isDefault: client?.retentionDays == null,
        defaultDays: DEFAULT_RETENTION_DAYS,
        minDays: MIN_RETENTION_DAYS,
        maxDays: MAX_RETENTION_DAYS,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/retention { retentionDays: number | null }
  async updateRetention(req: any, res: Response) {
    try {
      const { MIN_RETENTION_DAYS, MAX_RETENTION_DAYS } = await import('../services/data-retention.service');
      const raw = req.body?.retentionDays;
      // null = revenir au défaut de la plateforme.
      if (raw !== null && (typeof raw !== 'number' || !Number.isFinite(raw))) {
        return res.status(400).json({ error: 'retentionDays must be a number or null' });
      }
      if (typeof raw === 'number' && (raw < MIN_RETENTION_DAYS || raw > MAX_RETENTION_DAYS)) {
        return res.status(400).json({ error: `retentionDays must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}` });
      }
      await prisma.client.update({
        where: { id: req.clientId },
        data: { retentionDays: raw === null ? null : Math.round(raw) },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /my-dashboard/callers/:number — effacement d'un appelant (droit du
  // sujet de données: l'appelant du client, pas le client lui-même).
  async eraseCaller(req: any, res: Response) {
    try {
      const number = decodeURIComponent(String(req.params.number || '')).trim();
      if (!number) return res.status(400).json({ error: 'Caller number required' });
      const { dataRetentionService } = await import('../services/data-retention.service');
      const result = await dataRetentionService.eraseCaller(req.clientId, number);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Account ═══

  // PUT /my-dashboard/profile
  async updateProfile(req: any, res: Response) {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

      await prisma.user.update({
        where: { id: req.userId },
        data: { name: name.trim() },
      });

      // Also update client contact name
      await prisma.client.update({
        where: { id: req.clientId },
        data: { contactName: name.trim() },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /my-dashboard/password
  async changePassword(req: any, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both passwords required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (!user.passwordHash) return res.status(401).json({ error: 'Password not set. Please use Google login or reset your password.' });
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

      const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: req.userId },
        data: { passwordHash },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /my-dashboard/email — demander un changement d'adresse de connexion.
   *
   * Le compte n'offrait AUCUN moyen de changer son adresse: un client qui
   * quitte son fournisseur de messagerie, ou dont l'employée qui a signé s'en
   * va, perdait l'accès à son propre tableau de bord.
   *
   * Trois garde-fous, chacun pour un accident constaté ailleurs:
   * 1. le mot de passe est redemandé — une session laissée ouverte sur un poste
   *    partagé ne doit pas suffire à détourner un compte;
   * 2. l'adresse ne bascule PAS tout de suite: elle attend dans `pendingEmail`
   *    que le lien envoyé à la NOUVELLE adresse soit cliqué. Une faute de
   *    frappe est donc sans conséquence, l'ancienne continue de fonctionner;
   * 3. l'échec d'envoi est RENDU. Un « c'est envoyé » sur un courriel jamais
   *    parti laisserait le client attendre indéfiniment.
   */
  async requestEmailChange(req: any, res: Response) {
    try {
      const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
      const currentPassword = String(req.body?.currentPassword || '');
      if (!newEmail || !currentPassword) {
        return res.status(400).json({ error: 'Adresse et mot de passe requis' });
      }
      /* Validation volontairement simple: la seule preuve qu'une adresse existe
         est le courriel qui y arrive, et c'est justement ce qu'on envoie. */
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
        return res.status(400).json({ error: 'Adresse invalide' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(404).json({ error: 'Compte introuvable' });
      if (newEmail === user.email.toLowerCase()) {
        return res.status(400).json({ error: 'C’est déjà votre adresse' });
      }
      if (!user.passwordHash) {
        return res.status(400).json({ error: 'Compte Google: changez l’adresse chez Google, la connexion suit.' });
      }
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const taken = await prisma.user.findFirst({ where: { email: newEmail } });
      if (taken) return res.status(409).json({ error: 'Cette adresse est déjà utilisée' });

      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          pendingEmail: newEmail,
          pendingEmailToken: token,
          pendingEmailExpiry: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const { emailService } = await import('../services/email.service');
      const { frontendBaseUrl } = await import('../utils/urls');
      /* Le lien passe par le FRONTEND, comme celui de la confirmation
         d'inscription: le backend n'a aucune variable qui lui dise sous quel
         nom de domaine il est joignable, et un lien vers `/api/...` du site
         tomberait à côté. La page appelle ensuite l'API. */
      const confirmUrl = `${frontendBaseUrl()}/auth/confirm-email-change?token=${token}`;
      const sent = await emailService.sendEmailChangeEmail({
        to: newEmail,
        name: user.name,
        confirmUrl,
        lang: 'fr',
      });
      if (!sent.success) {
        /* La demande est effacée: laisser un jeton vivant sur une adresse qui
           n'a jamais reçu son lien, c'est une porte ouverte sans serrure. */
        await prisma.user.update({
          where: { id: user.id },
          data: { pendingEmail: null, pendingEmailToken: null, pendingEmailExpiry: null },
        });
        return res.status(502).json({ error: "Le courriel de confirmation n'a pas pu être envoyé. Réessayez." });
      }

      logger.info(`[EMAIL-CHANGE] Demande pour l'utilisateur ${user.id}`);
      res.json({ success: true, pendingEmail: newEmail });
    } catch (error: any) {
      logger.error('requestEmailChange failed', error);
      res.status(500).json({ error: 'Changement impossible pour le moment.' });
    }
  }

  /**
   * DELETE /my-dashboard/account — droit à l'effacement (RGPD, art. 17).
   *
   * La page « Vos données » du site le promet depuis toujours, et il n'existait
   * aucun moyen de l'exercer autrement qu'en écrivant au support.
   *
   * L'ordre des opérations est le point délicat: l'abonnement est résilié CHEZ
   * STRIPE avant tout effacement. Supprimer d'abord la ligne du client
   * effacerait le `stripeSubscriptionId`, et l'abonnement continuerait de
   * prélever une personne dont le compte n'existe plus, sans plus aucun moyen
   * de faire le lien.
   *
   * L'assistant Vapi et le numéro sont retirés ensuite, pour qu'aucun appel
   * n'arrive plus chez un client effacé. Ces deux étapes sont « au mieux »: si
   * Vapi ne répond pas, l'effacement se poursuit, parce que le droit du client
   * ne dépend pas de la disponibilité d'un tiers.
   */
  async deleteMyAccount(req: any, res: Response) {
    try {
      const password = String(req.body?.password || '');
      const confirm = String(req.body?.confirm || '').trim();

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(404).json({ error: 'Compte introuvable' });

      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { id: true, businessName: true, stripeSubscriptionId: true, vapiAssistantId: true },
      });
      if (!client) return res.status(404).json({ error: 'Client introuvable' });

      /* Le nom de l'entreprise, tapé à la main. Un « oui » n'est pas une
         confirmation pour une action définitive: il faut avoir lu. */
      if (confirm.toLowerCase() !== client.businessName.trim().toLowerCase()) {
        return res.status(400).json({ error: "Tapez le nom exact de l'entreprise pour confirmer" });
      }
      /* Le mot de passe reste exigé, sauf pour un compte Google qui n'en a
         aucun: lui réclamer un mot de passe inexistant rendrait la suppression
         impossible, ce qui reviendrait à refuser le droit. */
      if (user.passwordHash) {
        if (!password) return res.status(400).json({ error: 'Mot de passe requis' });
        if (!(await bcrypt.compare(password, user.passwordHash))) {
          return res.status(401).json({ error: 'Mot de passe incorrect' });
        }
      }

      const { stripeService } = await import('../services/stripe.service');
      try {
        await stripeService.cancelSubscription(client, { immediately: true });
      } catch (e) {
        /* Stripe refuse: on n'efface RIEN. Un compte effacé dont l'abonnement
           continue de prélever est le seul résultat pire que l'échec. */
        logger.error(`[DELETE] Résiliation Stripe refusée pour ${client.id}`, e);
        return res.status(502).json({
          error: "Votre abonnement n'a pas pu être résilié, le compte n'a donc pas été supprimé. Écrivez-nous.",
        });
      }

      if (client.vapiAssistantId) {
        try {
          const { vapiClient } = await import('../config/vapi');
          await vapiClient.deleteAssistant(client.vapiAssistantId);
        } catch (e) {
          logger.warn(`[DELETE] Assistant Vapi ${client.vapiAssistantId} non supprimé`, e);
        }
      }

      /* La ligne du client emporte ses appels, ses leads, ses rendez-vous et
         ses numéros: toutes les relations portent `onDelete: Cascade`. La ligne
         de l'utilisateur suit, et le compte n'existe plus nulle part. */
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.user.delete({ where: { id: user.id } });

      logger.info(`[DELETE] Compte supprimé: client ${client.id}, utilisateur ${user.id}`);
      res.json({ success: true });
    } catch (error: any) {
      logger.error('deleteMyAccount failed', error);
      res.status(500).json({ error: 'Suppression impossible pour le moment.' });
    }
  }

  // GET /my-dashboard/billing
  /**
   * The billing OVERVIEW — plan, status, quota, trial.
   *
   * This route used to answer with the payment list, which is why the billing
   * page displayed its own defaults as if they were the client's real plan.
   * The payments moved to `/my-dashboard/payments`, which the page was already
   * calling and which did not exist.
   */
  async getBilling(req: any, res: Response) {
    try {
      const overview = await clientDashboardService.getBillingOverview(req.clientId);
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /my-dashboard/export — toutes les données du client, en un fichier.
   *
   * Le RGPD (art. 20) donne un droit à la portabilité, et la page RGPD du site
   * le promet déjà: il n'existait aucun moyen de l'exercer autrement qu'en
   * nous écrivant. Le format est du JSON, lisible par une machine comme le
   * texte de l'article l'exige, et téléchargé sous un nom daté.
   *
   * Ce qui n'y est PAS: les enregistrements audio, qui vivent chez Vapi et
   * dont les liens expirent, et les secrets (jetons Google, identifiants
   * Stripe), qui ne sont pas des données personnelles du client mais des
   * clés d'accès à des services tiers.
   */
  async exportMyData(req: any, res: Response) {
    try {
      const [client, calls, bookings, payments, contacts] = await Promise.all([
        prisma.client.findUnique({
          where: { id: req.clientId },
          select: {
            businessName: true, businessType: true, contactName: true,
            contactEmail: true, contactPhone: true, address: true, city: true,
            postalCode: true, country: true, vatNumber: true, planType: true,
            subscriptionStatus: true, vapiPhoneNumber: true, transferNumber: true,
            monthlyMinutesQuota: true, createdAt: true, activationDate: true,
          },
        }),
        prisma.clientCall.findMany({
          where: { clientId: req.clientId },
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true, callerNumber: true, callerName: true,
            durationSeconds: true, status: true, sentiment: true, outcome: true,
            summary: true, transcript: true, isLead: true, leadScore: true,
            bookingRequested: true, bookingDate: true, emailCollected: true,
          },
        }),
        prisma.clientBooking.findMany({
          where: { clientId: req.clientId },
          orderBy: { bookingDate: 'desc' },
        }),
        prisma.payment.findMany({
          where: { clientId: req.clientId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.contact.findMany({ where: { clientId: req.clientId } }).catch(() => []),
      ]);

      if (!client) return res.status(404).json({ error: 'Client not found' });

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="qwillio-export-${stamp}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        client,
        calls,
        bookings,
        payments,
        contacts,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/payments
  async getPayments(req: any, res: Response) {
    try {
      const payments = await prisma.payment.findMany({
        where: { clientId: req.clientId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/payments/:id/invoice
  /* Renvoie l'adresse de la facture chez Stripe. Le portail pointait vers une
     route inexistante, et chaque ligne de l'historique donnait un 404. */
  async getInvoiceUrl(req: any, res: Response) {
    try {
      const payment = await prisma.payment.findFirst({
        // Le filtre par client est ce qui empêche de lire la facture d'autrui
        // en devinant un identifiant.
        where: { id: req.params.id, clientId: req.clientId },
        select: { stripeInvoiceId: true },
      });
      if (!payment) return res.status(404).json({ error: 'Paiement introuvable' });
      if (!payment.stripeInvoiceId) {
        return res.status(409).json({ error: 'Aucune facture Stripe pour ce paiement' });
      }
      const { stripeService } = await import('../services/stripe.service');
      const url = await stripeService.getInvoiceUrl(payment.stripeInvoiceId);
      if (!url) return res.status(404).json({ error: 'Facture indisponible' });
      res.json({ url });
    } catch (error) {
      logger.error('getInvoiceUrl failed', error);
      res.status(500).json({ error: 'Facture indisponible pour le moment.' });
    }
  }

  /**
   * POST /my-dashboard/cancel
   *
   * Résilie CHEZ STRIPE d'abord, en base ensuite. L'ordre compte: écrite
   * d'abord, la base aurait affiché « Résilié » à un client que Stripe
   * continuait de prélever, et personne n'aurait vu l'écart avant le relevé.
   *
   * L'abonnement court jusqu'au terme payé (`cancel_at_period_end`), et c'est
   * cette date que la réponse porte: le portail peut alors dire « jusqu'au 12
   * septembre » au lieu d'un « Résilié » qui laisse croire à une coupure
   * immédiate.
   */
  async cancelSubscription(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { id: true, stripeSubscriptionId: true, subscriptionStatus: true },
      });
      if (!client) return res.status(404).json({ error: 'Client introuvable' });
      if (['cancelled', 'canceled'].includes((client.subscriptionStatus || '').toLowerCase())) {
        return res.json({ success: true, alreadyCancelled: true, endsAt: null });
      }

      const { stripeService } = await import('../services/stripe.service');
      const { cancelled, endsAt } = await stripeService.cancelSubscription(client);

      await prisma.client.update({
        where: { id: req.clientId },
        data: { subscriptionStatus: 'cancelled', cancellationDate: new Date() },
      });

      logger.info(
        `[CANCEL] Client ${req.clientId} résilie${cancelled ? ` (Stripe, fin ${endsAt?.toISOString() ?? 'inconnue'})` : ' (aucun abonnement Stripe)'}`,
      );
      res.json({ success: true, stripeCancelled: cancelled, endsAt });
    } catch (error: any) {
      /* La résiliation Stripe a échoué: la base n'est PAS touchée, et le client
         voit une erreur. Un « Résilié » affiché sur un abonnement toujours actif
         serait pire que le message d'échec. */
      logger.error(`[CANCEL] Échec pour le client ${req.clientId}`, error);
      res.status(502).json({ error: "La résiliation n'a pas pu être enregistrée. Réessayez, ou écrivez-nous." });
    }
  }

  // ═══ Billing ═══

  // POST /my-dashboard/upgrade
  /**
   * POST /my-dashboard/billing-portal
   *
   * Ouvre le portail Stripe du client. C'est le chaînon qui manquait: la ligne
   * « Moyens de paiement » menait bien à Facturation, mais la page n'offrait
   * AUCUN moyen de voir ou de changer la carte enregistrée.
   *
   * Le client est relu depuis `req.clientId`, jamais depuis le corps de la
   * requête: c'est ce qui empêche d'ouvrir le portail de quelqu'un d'autre en
   * postant son identifiant.
   */
  async createBillingPortal(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { stripeCustomerId: true },
      });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const { stripeService } = await import('../services/stripe.service');
      const url = await stripeService.createBillingPortalSession(client);
      if (!url) {
        /* 409 et non 500: rien n'a échoué, il n'y a simplement pas de dossier
           Stripe à ouvrir. Le message part tel quel vers l'interface. */
        return res.status(409).json({
          error: "Aucun moyen de paiement enregistré. Il apparaîtra ici après votre premier règlement.",
        });
      }
      res.json({ url });
    } catch (error: any) {
      /* Le message d'erreur RESTE au serveur (signalé en revue). Celui que
         lèvent Prisma ou Stripe porte des détails d'infrastructure — nom de
         table, identifiant de compte, raison interne d'un refus — et la page
         de facturation affiche `data.error` tel quel. Le renvoyer, c'était le
         peindre à l'écran du client.
         La phrase rendue est donc fixe. Elle ne dit pas moins: elle dit ce que
         le client peut faire, et le reste part au journal, où il sert. */
      logger.error('createBillingPortal failed', error);
      res.status(500).json({
        error: 'Le portail de facturation est momentanément indisponible. Réessayez dans un instant.',
      });
    }
  }

  async upgradeSubscription(req: any, res: Response) {
    try {
      const { planType } = req.body;
      const validPlans = ['solo', 'starter', 'pro', 'enterprise'];
      if (!validPlans.includes(planType)) return res.status(400).json({ error: 'Invalid plan' });

      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      if (client.planType === planType) return res.status(400).json({ error: 'Already on this plan' });

      const { stripeService } = await import('../services/stripe.service');
      const checkoutUrl = await stripeService.createUpgradeCheckout(client, planType);
      res.json({ success: true, checkoutUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Agent modules ═══

  // PUT /my-dashboard/agent-modules
  async updateAgentModules(req: any, res: Response) {
    try {
      const { modules } = req.body;
      if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules must be an array' });

      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const current = (client.vapiConfig as Record<string, unknown>) ?? {};
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          vapiConfig: {
            ...current,
            agentModules: modules.map((m: any) => ({ id: String(m.id || '').slice(0, 64), enabled: Boolean(m.enabled) })),
          },
        },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Notifications ═══

  // PUT /my-dashboard/notifications
  async updateNotifications(req: any, res: Response) {
    try {
      const { notifEmail, notifWeekly, notifLeads, notifQuota } = req.body;
      const client = await prisma.client.findUnique({ where: { id: req.clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const current = (client.vapiConfig as Record<string, unknown>) ?? {};
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          vapiConfig: {
            ...current,
            notifications: { notifEmail, notifWeekly, notifLeads, notifQuota },
          },
        },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Support ═══

  // POST /my-dashboard/support
  async sendSupport(req: any, res: Response) {
    try {
      const { subject, message } = req.body;
      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ error: 'Subject and message are required' });
      }

      // Get user + client info
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const client = await prisma.client.findUnique({ where: { id: req.clientId } });

      // Log the support request (email sending may fail if Resend not configured with custom domain)
      logger.info(`[SUPPORT] From ${user?.email} (${client?.businessName}): ${subject}`);

      // Try to send email via Resend
      try {
        const { emailService } = await import('../services/email.service');
        /* `send`, pas `sendRaw`: cette dernière n'existe pas sur le service.
           Appelée en `?.()`, elle ne levait rien et ne partait pas: aucune
           demande de support n'a jamais atteint la boîte. */
        /* TOUT ce qui vient du client est echappe, pas seulement le message:
           le nom de l'entreprise et le nom du contact sont eux aussi saisis par
           l'utilisateur, et ils partaient bruts dans un email de confiance. */
        const esc = (v: unknown) => String(v ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

        await emailService.send({
          to: env.RESEND_REPLY_TO || 'contact@qwillio.com',
          subject: `[Support] ${subject} — ${client?.businessName || user?.email}`,
          html: `
            <h3>Support request from ${esc(user?.name)} (${esc(user?.email)})</h3>
            <p><strong>Business:</strong> ${esc(client?.businessName)}</p>
            <p><strong>Plan:</strong> ${esc(client?.planType)}</p>
            <hr/>
            <p>${esc(message).replace(/\n/g, '<br/>')}</p>
          `,
        });
      } catch {
        // Email sending is best-effort; the request is logged above
        logger.warn('[SUPPORT] Email sending failed — support request still logged');
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Google Calendar integration (OAuth) ═══════════════════════════

  // GET /api/my-dashboard/integrations/google-calendar/auth-url
  async getGoogleCalendarAuthUrl(req: any, res: Response) {
    try {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({ error: 'Google OAuth non configuré côté serveur' });
      }
      const state = GCAL_STATE_PREFIX + jwt.sign({ gcal: req.clientId }, env.JWT_SECRET, { expiresIn: '15m' });
      const url = googleCalendarService.getConnectUrl(state);
      /* On renvoie AUSSI l'adresse de retour employee.
       *
       * `redirect_uri_mismatch` est le refus le plus opaque de Google: il ne
       * dit jamais QUELLE adresse a ete envoyee, seulement qu'elle n'est pas
       * dans la console. Or c'est une comparaison caractere par caractere, ou
       * un `www`, un slash final ou un `http` suffisent. La renvoyer permet de
       * l'afficher a l'ecran et de la coller telle quelle dans la console, au
       * lieu de deviner ce que le serveur a en memoire. */
      res.json({ url, redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI });
    } catch (error: any) {
      logger.error('GCal auth-url error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/my-dashboard/integrations/google-calendar/callback  { code, state }
  async connectGoogleCalendar(req: any, res: Response) {
    try {
      const { code, state } = req.body as { code?: string; state?: string };
      if (!code) return res.status(400).json({ error: 'Code OAuth manquant' });
      if (!state || !state.startsWith(GCAL_STATE_PREFIX)) {
        return res.status(400).json({ error: 'State OAuth invalide' });
      }
      let statePayload: any;
      try {
        statePayload = jwt.verify(state.slice(GCAL_STATE_PREFIX.length), env.JWT_SECRET);
      } catch {
        return res.status(400).json({ error: 'State OAuth invalide ou expiré' });
      }
      if (statePayload?.gcal !== req.clientId) {
        return res.status(400).json({ error: 'State OAuth invalide' });
      }

      const refreshToken = await googleCalendarService.exchangeCode(code);
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          googleCalendarRefreshToken: refreshToken,
          googleCalendarId: 'primary',
        },
      });
      logger.info(`Google Calendar connected for client ${req.clientId}`);
      res.json({ connected: true });
    } catch (error: any) {
      logger.error('GCal connect error:', error);
      res.status(500).json({ error: 'Échec de la connexion Google Calendar' });
    }
  }

  // GET /api/my-dashboard/integrations/google-calendar/status
  async googleCalendarStatus(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { googleCalendarRefreshToken: true, googleCalendarId: true },
      });
      if (!client?.googleCalendarRefreshToken) {
        return res.json({ connected: false });
      }
      try {
        const upcoming = await googleCalendarService.listUpcomingEvents(
          client.googleCalendarRefreshToken,
          client.googleCalendarId || 'primary',
          3,
        );
        res.json({ connected: true, calendarId: client.googleCalendarId || 'primary', upcoming });
      } catch (err: any) {
        // Only treat auth failures as revocation; transient errors keep the
        // integration connected without the events preview.
        const authFailure = /invalid_grant|invalid_rapt|unauthorized|\b40[13]\b/i.test(String(err?.message || ''));
        if (authFailure) {
          res.json({ connected: false, revoked: true });
        } else {
          res.json({ connected: true, calendarId: client.googleCalendarId || 'primary', upcoming: [], previewUnavailable: true });
        }
      }
    } catch (error: any) {
      logger.error('GCal status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/my-dashboard/integrations/google-calendar
  async disconnectGoogleCalendar(req: any, res: Response) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { googleCalendarRefreshToken: true },
      });
      if (client?.googleCalendarRefreshToken) {
        await googleCalendarService.revokeToken(client.googleCalendarRefreshToken);
      }
      await prisma.client.update({
        where: { id: req.clientId },
        data: { googleCalendarRefreshToken: null, googleCalendarId: null },
      });
      res.json({ connected: false });
    } catch (error: any) {
      logger.error('GCal disconnect error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const clientDashboardController = new ClientDashboardController();
