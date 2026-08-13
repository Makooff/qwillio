import { describe, it, expect } from 'vitest';
import { SCENARIOS, profileFor } from '../scenarios';
import { checkAssertions, openAiTools } from '../run-evals';
import { buildSystemPrompt } from '../../services/voice/system-prompt';

/**
 * Le harness d'évals lui-même, sans réseau: structure des scénarios,
 * conversion des outils au format OpenAI, mécanique des assertions.
 * Les vrais appels au modèle vivent dans `npm run evals`.
 */
describe('scénarios', () => {
  it('ids uniques, au moins un scénario par langue', () => {
    const ids = SCENARIOS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lang of ['fr', 'en', 'nl'] as const) {
      expect(SCENARIOS.some(s => profileFor(s).language === lang)).toBe(true);
    }
  });

  it('toutes les regex d\'assertion compilent', () => {
    for (const s of SCENARIOS) {
      for (const a of s.assertions) {
        if (a.kind === 'reply-matches' || a.kind === 'reply-not-matches') {
          expect(() => new RegExp(String(a.value), 'i')).not.toThrow();
        }
      }
    }
  });

  it('chaque profil de scénario produit un prompt système valide', () => {
    for (const s of SCENARIOS) {
      const prompt = buildSystemPrompt(profileFor(s), {
        previousCalls: 0, lastCallAt: null, lastSummary: null, knownName: null, hasUpcomingBooking: false,
      });
      expect(prompt.length).toBeGreaterThan(200);
    }
  });

  it('couvre les invariants critiques: divulgation, injection, discipline outils', () => {
    expect(SCENARIOS.some(s => s.id.includes('divulgation') || s.id.includes('disclosure'))).toBe(true);
    expect(SCENARIOS.some(s => s.id.includes('injection'))).toBe(true);
    expect(SCENARIOS.some(s => s.assertions.some(a => a.kind === 'calls-tool'))).toBe(true);
  });
});

describe('openAiTools', () => {
  it('convertit les outils Vapi en outils OpenAI purs (sans transport Vapi)', () => {
    const tools = openAiTools(profileFor(SCENARIOS[0])) as Array<Record<string, unknown>>;
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(t.type).toBe('function');
      expect(t).not.toHaveProperty('server');
      expect(t).not.toHaveProperty('messages');
    }
  });
});

describe('checkAssertions', () => {
  const scenario = {
    id: 'x', description: 'x', profileOverrides: {}, turns: [],
    assertions: [
      { kind: 'reply-matches' as const, value: 'assistant IA', description: 'd' },
      { kind: 'calls-tool' as const, value: 'checkAvailability', description: 'd' },
    ],
  };

  it('vert quand la réponse et les outils correspondent', () => {
    const failures = checkAssertions(scenario, { text: 'Je suis votre assistant IA.', toolCalls: ['checkAvailability'] });
    expect(failures).toEqual([]);
  });

  it('énumère chaque assertion échouée', () => {
    const failures = checkAssertions(scenario, { text: 'Bonjour.', toolCalls: [] });
    expect(failures).toHaveLength(2);
  });
});
