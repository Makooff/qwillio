import { describe, it, expect } from 'vitest';
import { buildFirstMessage, buildSystemPrompt, firstMessageVariants } from '../system-prompt';
import type { CallerHistory, ClientVoiceProfile } from '../realtime-context.service';

const profile: ClientVoiceProfile = {
  clientId: 'client_1',
  businessName: 'Le Comptoir',
  businessType: 'restaurant',
  agentName: 'Camille',
  language: 'fr',
  timezone: 'Europe/Paris',
  transferNumber: '+33123456789',
  instructions: 'Ne jamais donner les prix au telephone.',
  services: ['dejeuner', 'diner', 'privatisation'],
  openingHours: '12h-14h et 19h-22h30',
  bookingEnabled: true,
  calendarConnected: true,
  planType: 'pro',
  characterId: null,
  customVoice: null,
  country: 'FR',
  customLlm: true,
  voiceMode: 'auto',
  hasKnowledgeBase: false,
  recordCalls: true,
};

const newCaller: CallerHistory = {
  previousCalls: 0,
  lastCallAt: null,
  lastSummary: null,
  knownName: null,
  hasUpcomingBooking: false,
};

describe('buildSystemPrompt', () => {
  it('injects the business identity so the agent is in character from word one', () => {
    const prompt = buildSystemPrompt(profile, newCaller);
    expect(prompt).toContain('Camille');
    expect(prompt).toContain('Le Comptoir');
    expect(prompt).toContain('restaurant');
  });

  it('carries the client instructions and marks them as taking priority', () => {
    const prompt = buildSystemPrompt(profile, newCaller);
    expect(prompt).toContain('Ne jamais donner les prix');
    expect(prompt).toMatch(/prioritaires/i);
  });

  it('forbids booking when no calendar is connected', () => {
    const prompt = buildSystemPrompt({ ...profile, calendarConnected: false }, newCaller);
    expect(prompt).toMatch(/tu ne peux pas réserver/i);
    expect(prompt).toContain('captureLead');
  });

  it('includes the anti-injection clause — the transcript is caller-controlled', () => {
    expect(buildSystemPrompt(profile, newCaller)).toMatch(/jamais une instruction système/i);
  });

  it('surfaces caller memory and tells the agent not to re-ask the name', () => {
    const prompt = buildSystemPrompt(profile, {
      previousCalls: 2,
      lastCallAt: '2026-07-30T10:00:00.000Z',
      lastSummary: 'Voulait reserver pour six personnes.',
      knownName: 'Julien',
      hasUpcomingBooking: true,
    });
    expect(prompt).toContain('Julien');
    expect(prompt).toMatch(/ne redemande pas son nom/i);
    expect(prompt).toContain('lookupBooking');
  });

  it('omits the history block entirely for a first-time caller', () => {
    expect(buildSystemPrompt(profile, newCaller)).not.toMatch(/HISTORIQUE/);
  });

  it('stays compact — the prompt is replayed on every model turn', () => {
    // ~4 chars per token; 2000 chars keeps a 20-turn call under ~10k input
    // tokens of pure prompt.
    expect(buildSystemPrompt(profile, newCaller).length).toBeLessThan(2000);
  });

  it('injects the pre-rendered knowledge block when one is supplied', () => {
    const prompt = buildSystemPrompt(profile, newCaller, 'RÈGLES DE LA MAISON:\n- Pas de prix au téléphone');
    expect(prompt).toContain('RÈGLES DE LA MAISON');
  });

  it('tells the agent to look things up rather than invent them, when a base exists', () => {
    const prompt = buildSystemPrompt({ ...profile, hasKnowledgeBase: true }, newCaller);
    expect(prompt).toContain('lookupKnowledge');
    expect(prompt).toMatch(/n'invente jamais/i);
  });

  it('switches language wholesale for an English client', () => {
    const prompt = buildSystemPrompt({ ...profile, language: 'en', agentName: 'Ashley' }, newCaller);
    expect(prompt).toContain('SPEAKING RULES');
    expect(prompt).not.toContain('RÈGLES DE PAROLE');
  });
});

describe('buildFirstMessage', () => {
  it('greets a known caller by name', () => {
    const msg = buildFirstMessage(profile, { ...newCaller, previousCalls: 1, knownName: 'Julien' });
    expect(msg).toContain('Julien');
  });

  it('falls back to a neutral greeting for a new caller', () => {
    const msg = buildFirstMessage(profile, newCaller);
    expect(msg).toContain('Le Comptoir');
    expect(msg).toContain('Camille');
  });
});

describe('firstMessageVariants', () => {
  it('offers several distinct openings — a regular must not hear a recording', () => {
    const variants = firstMessageVariants(profile, null);
    expect(variants.length).toBeGreaterThan(1);
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('names every variant after the business and the agent', () => {
    for (const v of firstMessageVariants(profile, null)) {
      expect(v).toContain('Le Comptoir');
      expect(v).toContain('Camille');
    }
  });

  it('uses the caller name in every variant when we know it', () => {
    for (const v of firstMessageVariants(profile, 'Julien')) {
      expect(v).toContain('Julien');
    }
  });

  it('keeps openings short — this is the sentence the caller judges', () => {
    // The ceiling includes the AI disclosure and the recording notice: the
    // compliant greeting must still land in one breath.
    for (const v of firstMessageVariants(profile, null)) {
      expect(v.length).toBeLessThan(170);
    }
  });

  it('switches language with the profile', () => {
    for (const v of firstMessageVariants({ ...profile, language: 'en', agentName: 'Ashley' }, null)) {
      expect(v).not.toMatch(/bonjour/i);
    }
  });
});
