import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { clientDashboardService } from '../services/client-dashboard.service';
import { googleCalendarService } from '../services/google-calendar.service';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { listCharacters, resolveCharacter, CHARACTERS, isValidCharacterId, DEFAULT_CHARACTER_FR, DEFAULT_CHARACTER_EN, CUSTOM_CHARACTER_ID } from '../config/voice-characters';
import { buildVapiConfigPatch } from '../services/client-config.service';

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
        characterId:       cfg.characterId ?? (isFrench ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN),
        // Null rather than absent: the UI shows either the recorder or the
        // cloned-voice card, and "not loaded yet" must not look like "none".
        customVoice:       cfg.customVoice?.voiceId ? cfg.customVoice : null,
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
        body.personalityPreset !== undefined ||
        body.personalityNotes !== undefined ||
        body.characterId !== undefined;
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
          personalityPreset: body.personalityPreset,
          personalityNotes:  body.personalityNotes,
          characterId:       body.characterId,
        });
      }

      const client = await prisma.client.update({
        where: { id: req.clientId },
        data: updateData,
      });

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
      const { buildRealtimePlans, buildVoice } = await import('../services/voice/speech-plans');
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
      });

      // Reading tools stay: an owner testing the agent should hear it check a
      // real slot. Writing tools do not — every demo would otherwise put a fake
      // appointment in the client's calendar.
      const tools = buildVoiceTools(profile).filter((t: any) => t.function?.name !== 'bookAppointment');

      const testNotice = profile.language === 'fr'
        ? "\n\nCONTEXTE: c'est un appel de test, le gerant joue un appelant. Comporte-toi exactement comme sur un vrai appel, mais ne confirme aucune reservation definitive."
        : '\n\nCONTEXT: this is a test call, the owner is playing a caller. Behave exactly as on a real call, but do not confirm any final booking.';

      const variants = firstMessageVariants(profile, null);

      res.json({
        publicKey: env.VAPI_PUBLIC_KEY,
        assistant: {
          name: `${character.name} — ${profile.businessName}`,
          model: {
            provider: 'openai',
            model: env.VAPI_MODEL,
            temperature: 0.6,
            maxTokens: env.VOICE_MAX_COMPLETION_TOKENS,
            messages: [{ role: 'system', content: buildSystemPrompt(profile, caller, knowledgeBlock) + testNotice }],
            tools,
          },
          voice: buildVoice({
            voiceId: character.voiceId,
            stability: character.stability,
            similarityBoost: character.similarityBoost,
            style: character.style,
          }),
          firstMessage: variants[Math.floor(Math.random() * variants.length)],
          ...buildRealtimePlans(profile.language),
          backgroundSound: 'office',
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
          }),
          firstMessage: fr
            ? `Bonjour ! On configure votre standard ensemble. Qu'est-ce que vous voulez ajuster ?`
            : `Hi! Let's set up your receptionist together. What would you like to adjust?`,
          ...buildRealtimePlans(profile.language),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/characters/:id/preview — real ElevenLabs voice sample
  // (mp3). Falls back with 503 when no ELEVENLABS_API_KEY so the UI can use TTS.
  async characterPreview(req: any, res: Response) {
    try {
      const id = String(req.params.id || '');
      const isCustom = id === CUSTOM_CHARACTER_ID;
      if (!isCustom && !isValidCharacterId(id)) return res.status(404).json({ error: 'Unknown character' });
      if (!env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'elevenlabs_key_missing' });

      // The cloned voice has no entry in the catalog: its id lives in the
      // client's own config, so the preview reads it from there and borrows the
      // language default's sample line and tuning.
      let character = isCustom ? null : CHARACTERS[id];
      if (isCustom) {
        const client = await prisma.client.findUnique({
          where: { id: req.clientId },
          select: { vapiConfig: true, agentLanguage: true },
        });
        const voiceId = ((client?.vapiConfig as any)?.customVoice?.voiceId ?? '') as string;
        if (!voiceId) return res.status(404).json({ error: 'no_custom_voice' });
        const base = CHARACTERS[client?.agentLanguage?.startsWith('fr') ? DEFAULT_CHARACTER_FR : DEFAULT_CHARACTER_EN];
        character = { ...base, voiceId, style: 0, similarityBoost: 0.85 };
      }
      if (!character) return res.status(404).json({ error: 'Unknown character' });

      // The sample follows the CLIENT's language, not the character's: a
      // character is bilingual now, so playing French to an English client
      // would demo a voice they will never hear.
      const previewClient = await prisma.client.findUnique({
        where: { id: req.clientId },
        select: { agentLanguage: true, country: true },
      });
      const previewFrench = previewClient?.agentLanguage?.startsWith('fr')
        || ['FR', 'BE', 'LU', 'MC', 'CH'].includes(String(previewClient?.country || '').toUpperCase());
      const text = previewFrench ? character.previewFr : character.previewEn;
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${character.voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: character.stability, similarity_boost: character.similarityBoost, style: character.style },
        }),
      });
      if (!r.ok) {
        // Log the upstream body: ElevenLabs explains *why* (bad key, unknown
        // voice id, quota exhausted) and without it this is undiagnosable.
        const detail = await r.text().catch(() => '');
        logger.warn(`ElevenLabs preview ${r.status} for ${id} (voice ${character.voiceId}): ${detail.slice(0, 300)}`);
        return res.status(502).json({ error: 'elevenlabs_request_failed', status: r.status });
      }
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /my-dashboard/voices — the voices available on the ElevenLabs account,
  // so a voice is chosen after being heard instead of pasted as an opaque id.
  async listVoices(_req: any, res: Response) {
    try {
      const { voiceCatalogService } = await import('../services/voice/voice-catalog.service');
      res.json({ voices: await voiceCatalogService.list() });
    } catch (error: any) {
      // 503 rather than 500 for a missing key: the UI shows "not configured",
      // which is actionable, instead of "server error", which is not.
      if (error.message === 'elevenlabs_key_missing') {
        return res.status(503).json({ error: 'elevenlabs_key_missing' });
      }
      if (error.message === 'elevenlabs_list_failed') {
        return res.status(502).json({ error: 'elevenlabs_list_failed' });
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
        // radio button.
        data: { vapiConfig: { ...current, customVoice: { ...voice }, characterId: CUSTOM_CHARACTER_ID } },
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

      // Falling back to a catalog character rather than leaving `custom`
      // pointing at nothing: an agent with no voice cannot answer a call.
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

  // GET /my-dashboard/billing
  async getBilling(req: any, res: Response) {
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

  // POST /my-dashboard/cancel
  async cancelSubscription(req: any, res: Response) {
    try {
      await prisma.client.update({
        where: { id: req.clientId },
        data: {
          subscriptionStatus: 'cancelled',
          cancellationDate: new Date(),
        },
      });
      logger.info(`[CANCEL] Client ${req.clientId} cancelled subscription`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ═══ Billing ═══

  // POST /my-dashboard/upgrade
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
        await (emailService as any).sendRaw?.({
          to: env.RESEND_REPLY_TO || 'contact@qwillio.com',
          subject: `[Support] ${subject} — ${client?.businessName || user?.email}`,
          html: `
            <h3>Support request from ${user?.name} (${user?.email})</h3>
            <p><strong>Business:</strong> ${client?.businessName}</p>
            <p><strong>Plan:</strong> ${client?.planType}</p>
            <hr/>
            <p>${message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g, '<br/>')}</p>
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
      res.json({ url });
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
