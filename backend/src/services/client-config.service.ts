// Single validated writer for a client's receptionist configuration (the
// vapiConfig JSON blob). Both the settings form (updateMySettings) and the
// conversational assistant (assistant-chat) go through here so validation and
// the Vapi re-sync happen in exactly one place.

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { isValidCharacterId, CUSTOM_CHARACTER_ID } from '../config/voice-characters';
import { PERSONALITY_PROMPTS } from '../config/personalities';

export interface VapiConfigPatch {
  items?: Array<{ id?: string; category?: string; name?: string; price?: string }>;
  hours?: Record<string, unknown> | null;
  faq?: string;
  personalityPreset?: string;
  personalityNotes?: string;
  characterId?: string;
  /**
   * The voice the client chose for themselves. An override on top of the
   * character, not a character: null (or a blank voiceId) means "use the
   * character's own voice".
   */
  customVoice?: { voiceId?: string; name?: string; cloned?: boolean } | null;
}

const PERSONA_KEYS = new Set(Object.keys(PERSONALITY_PROMPTS));

/**
 * Merge a validated patch into an existing vapiConfig object. Pure — no I/O —
 * so it can be unit-tested and reused. Unknown/invalid values are dropped or
 * clamped; only keys present in `patch` are touched.
 */
export function buildVapiConfigPatch(
  prev: Record<string, any>,
  patch: VapiConfigPatch,
): Record<string, any> {
  const next: Record<string, any> = { ...prev };
  // Legacy free-text keys superseded by the structured fields.
  delete next.priceList;
  delete next.services;

  if (patch.items !== undefined) {
    const arr = Array.isArray(patch.items) ? patch.items : [];
    next.items = arr
      .slice(0, 200)
      .map((it: any) => ({
        id:       String(it?.id || Math.random().toString(36).slice(2, 10)),
        category: String(it?.category || 'service').slice(0, 40),
        name:     String(it?.name || '').trim().slice(0, 200),
        price:    String(it?.price || '').trim().slice(0, 80),
      }))
      // A nameless or priceless line is not a half-saved entry, it is a trap:
      // the receptionist reads the item list aloud and would announce a service
      // it cannot quote. The setup assistant is instructed to ask for the price
      // before saving, but an instruction is not a guarantee — this is.
      .filter((it: { name: string; price: string }) => it.name !== '' && it.price !== '');
  }
  if (patch.hours !== undefined) {
    next.hours = patch.hours && typeof patch.hours === 'object' && !Array.isArray(patch.hours)
      ? patch.hours
      : null;
  }
  if (patch.faq !== undefined) {
    next.faq = typeof patch.faq === 'string' ? patch.faq.slice(0, 8000) : '';
  }
  if (patch.personalityPreset !== undefined) {
    const v = String(patch.personalityPreset || '');
    next.personalityPreset = PERSONA_KEYS.has(v) ? v : 'warm';
  }
  if (patch.personalityNotes !== undefined) {
    next.personalityNotes = typeof patch.personalityNotes === 'string'
      ? patch.personalityNotes.slice(0, 4000)
      : '';
    delete next.specialNotes; // legacy key superseded
  }
  if (patch.characterId !== undefined) {
    const v = String(patch.characterId || '');
    // The cloned voice is a valid selection but is not in the catalog: it has
    // no fixed voiceId, it lives per-tenant in the client's own config.
    if (isValidCharacterId(v) || v === CUSTOM_CHARACTER_ID) next.characterId = v;
  }
  if (patch.customVoice !== undefined) {
    const voiceId = String(patch.customVoice?.voiceId || '').trim();
    if (!voiceId) {
      // Deleted rather than set to null: readCustomVoice treats both as "no
      // override", and an absent key keeps the stored config honest.
      delete next.customVoice;
    } else {
      const prevVoice = (prev.customVoice || {}) as Record<string, unknown>;
      next.customVoice = {
        voiceId: voiceId.slice(0, 64),
        name: String(patch.customVoice?.name || prevVoice.name || 'Ma voix').slice(0, 80),
        // The date marks when this voice was chosen, so re-picking the same one
        // must not reset it.
        createdAt: prevVoice.voiceId === voiceId && typeof prevVoice.createdAt === 'string'
          ? prevVoice.createdAt
          : new Date().toISOString(),
        ...(patch.customVoice?.cloned === true ? { cloned: true } : {}),
      };
    }
  }
  return next;
}

/**
 * Load the client's config, apply a validated patch, persist it, and re-sync
 * the Vapi assistant (best-effort). Returns the resulting merged config.
 */
export async function applyConfigPatch(
  clientId: string,
  patch: VapiConfigPatch,
): Promise<Record<string, any>> {
  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { vapiConfig: true, vapiAssistantId: true },
  });
  const prev = (existing?.vapiConfig as any) || {};
  const next = buildVapiConfigPatch(prev, patch);

  await prisma.client.update({
    where: { id: clientId },
    data: { vapiConfig: next },
  });

  if (existing?.vapiAssistantId) {
    try {
      const { onboardingService } = await import('./onboarding.service');
      await onboardingService.syncVapiAssistant(clientId);
    } catch (err) {
      logger.warn(`applyConfigPatch: Vapi sync failed for client ${clientId}:`, err);
    }
  }
  return next;
}
