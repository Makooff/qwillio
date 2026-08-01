import { describe, it, expect } from 'vitest';
import { buildVoiceTools, fillerFor, isKnownTool } from '../voice-tools';
import type { ClientVoiceProfile } from '../realtime-context.service';

const profile: ClientVoiceProfile = {
  clientId: 'client_1',
  businessName: 'Le Comptoir',
  businessType: 'restaurant',
  agentName: 'Camille',
  language: 'fr',
  timezone: 'Europe/Paris',
  transferNumber: null,
  instructions: null,
  services: [],
  openingHours: null,
  bookingEnabled: true,
  calendarConnected: true,
  planType: 'pro',
  characterId: null,
  country: 'FR',
};

function toolNames(tools: Array<Record<string, any>>): string[] {
  return tools.map(t => t.function?.name ?? t.type);
}

describe('buildVoiceTools', () => {
  it('exposes booking tools when a calendar is connected', () => {
    expect(toolNames(buildVoiceTools(profile))).toEqual(
      expect.arrayContaining(['checkAvailability', 'bookAppointment', 'lookupBooking', 'captureLead'])
    );
  });

  it('hides booking tools when no calendar is connected — never promise a slot we cannot write', () => {
    const names = toolNames(buildVoiceTools({ ...profile, calendarConnected: false }));
    expect(names).not.toContain('checkAvailability');
    expect(names).not.toContain('bookAppointment');
    expect(names).toContain('captureLead');
  });

  it('hides booking tools when the client disabled booking', () => {
    const names = toolNames(buildVoiceTools({ ...profile, bookingEnabled: false }));
    expect(names).not.toContain('bookAppointment');
  });

  it('only offers transferCall when a transfer number exists', () => {
    expect(toolNames(buildVoiceTools(profile))).not.toContain('transferCall');
    expect(toolNames(buildVoiceTools({ ...profile, transferNumber: '+33123456789' }))).toContain('transferCall');
  });

  it('points every function tool at the dedicated tool endpoint', () => {
    for (const tool of buildVoiceTools(profile).filter(t => t.type === 'function')) {
      expect((tool as any).server.url).toMatch(/\/api\/webhooks\/vapi\/tools\/client_1$/);
    }
  });
});

describe('filler (meublage)', () => {
  it('attaches a request-start message to every blocking tool', () => {
    const blocking = buildVoiceTools(profile).filter(t => t.type === 'function' && t.async === false);
    expect(blocking.length).toBeGreaterThan(0);
    for (const tool of blocking) {
      const messages = (tool as any).messages as Array<Record<string, any>>;
      expect(messages.some(m => m.type === 'request-start')).toBe(true);
    }
  });

  it('adds a second reassurance for the slow calendar lookups only', () => {
    expect(fillerFor('checkAvailability', 'fr', 'delayed').length).toBeGreaterThan(0);
    // captureLead is a fire-and-forget write; a delayed line there would be noise.
    expect(fillerFor('captureLead', 'fr', 'delayed')).toHaveLength(0);
  });

  it('varies the wording so it does not sound like a recording', () => {
    expect(new Set(fillerFor('checkAvailability', 'fr', 'start')).size).toBeGreaterThan(1);
  });

  it('speaks the caller language', () => {
    expect(fillerFor('checkAvailability', 'fr', 'start')[0]).toMatch(/regarde|vérifi|consulte/i);
    expect(fillerFor('checkAvailability', 'en', 'start')[0]).toMatch(/check|look/i);
  });

  it('keeps captureLead non-blocking — the model must not wait on a write', () => {
    const lead = buildVoiceTools(profile).find(t => (t as any).function?.name === 'captureLead');
    expect((lead as any).async).toBe(true);
  });
});

describe('isKnownTool', () => {
  it('accepts the tools the runtime implements', () => {
    expect(isKnownTool('bookAppointment')).toBe(true);
  });

  it('rejects anything else — a hallucinated tool name must not reach the runtime', () => {
    expect(isKnownTool('deleteAllBookings')).toBe(false);
  });
});
