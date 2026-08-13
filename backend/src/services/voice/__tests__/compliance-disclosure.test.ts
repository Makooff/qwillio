import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, firstMessageVariants } from '../system-prompt';
import { shouldRecord, type CallerHistory, type ClientVoiceProfile } from '../realtime-context.service';

/**
 * Conformité au décroché (AI Act art. 50 + RGPD/314bis).
 *
 * Deux invariants que rien ne doit pouvoir réintroduire en silence:
 *  1. chaque premier message annonce que l'appelant parle à une IA, et
 *     annonce l'enregistrement quand — et seulement quand — il a lieu;
 *  2. aucun prompt du dépôt ne nie être une IA ni n'instruit de le cacher.
 */

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
  calendarConnected: false,
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

const allVariantSets = (p: ClientVoiceProfile) => [
  firstMessageVariants(p, null),
  firstMessageVariants(p, 'Julien'),
];

describe('divulgation IA au décroché', () => {
  it('annonce l\'IA dans chaque variante française, appelant connu ou non', () => {
    for (const variants of allVariantSets(profile)) {
      for (const v of variants) expect(v).toMatch(/assistant IA/i);
    }
  });

  it('annonce l\'IA dans chaque variante anglaise', () => {
    const en = { ...profile, language: 'en' as const, agentName: 'Ashley' };
    for (const variants of allVariantSets(en)) {
      for (const v of variants) expect(v).toMatch(/AI assistant/i);
    }
  });
});

describe('notice d\'enregistrement', () => {
  it('est prononcée dans chaque variante quand l\'appel est enregistré', () => {
    for (const variants of allVariantSets(profile)) {
      for (const v of variants) expect(v).toContain('Cet appel est enregistré.');
    }
    const en = { ...profile, language: 'en' as const };
    for (const variants of allVariantSets(en)) {
      for (const v of variants) expect(v).toContain('This call is recorded.');
    }
  });

  it('disparaît — dans les deux langues — quand l\'enregistrement est coupé', () => {
    const off = { ...profile, recordCalls: false };
    for (const variants of allVariantSets(off)) {
      for (const v of variants) expect(v).not.toMatch(/enregistré/i);
    }
    const en = { ...off, language: 'en' as const };
    for (const variants of allVariantSets(en)) {
      for (const v of variants) expect(v).not.toMatch(/recorded/i);
    }
  });

  it('shouldRecord: un profil d\'avant le champ (cache) vaut « enregistré »', () => {
    expect(shouldRecord({ recordCalls: undefined as unknown as boolean })).toBe(true);
    expect(shouldRecord({ recordCalls: true })).toBe(true);
    expect(shouldRecord({ recordCalls: false })).toBe(false);
  });
});

describe('le prompt interdit de nier être une IA', () => {
  it('en français', () => {
    expect(buildSystemPrompt(profile, newCaller)).toMatch(/assistant vocal IA[\s\S]*confirme/i);
  });
  it('en anglais', () => {
    const prompt = buildSystemPrompt({ ...profile, language: 'en' }, newCaller);
    expect(prompt).toMatch(/AI voice assistant[\s\S]*confirm it plainly/i);
  });
});

describe('aucun script de déni d\'IA ne survit dans le dépôt', () => {
  // Garde de régression sur les sources elles-mêmes: le déni scripté a déjà
  // existé (« non, je suis réelle »), il ne doit pas pouvoir revenir par un
  // simple revert de prompt.
  const sources = [
    '../../vapi.service.ts',
    '../../../config/vapi-templates.ts',
    '../../../config/niche-scripts.ts',
    '../system-prompt.ts',
  ].map(rel => readFileSync(join(__dirname, rel), 'utf8'));

  const forbidden = [
    'je suis réelle',
    "I'm real",
    'Never reveal you are AI',
    'jamais révéler que tu es une IA',
    "people don't know it's AI",
    "most people can't tell",
  ];

  for (const needle of forbidden) {
    it(`ne contient plus « ${needle} »`, () => {
      for (const src of sources) expect(src).not.toContain(needle);
    });
  }
});
