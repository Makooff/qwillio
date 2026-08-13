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

  /* LE test qui manquait. `buildVoiceTools` pose le transfert en outil NATIF
     Vapi, sans bloc `function`: le filtre le jetait, et le modèle ne voyait
     jamais `transferCall`. Le scénario `fr-transfert-humain` exigeait donc un
     appel d'outil qu'il n'avait aucun moyen d'émettre — il échouait toujours,
     et il ne « passait » que les jours où le harnais sautait faute de clé.
     Toute assertion `calls-tool` porte sur un outil RÉELLEMENT proposé: c'est
     ce que les deux tests suivants garantissent. */
  it('propose transferCall au modèle quand le client a un numéro de transfert', () => {
    const profile = profileFor(SCENARIOS[0]);
    expect(profile.transferNumber).toBeTruthy();
    const names = (openAiTools(profile) as Array<{ function: { name: string } }>).map(t => t.function.name);
    expect(names).toContain('transferCall');
  });

  it('ne le propose pas quand aucun numéro de transfert n\'est configuré', () => {
    const profile = { ...profileFor(SCENARIOS[0]), transferNumber: null };
    const names = (openAiTools(profile) as Array<{ function: { name: string } }>).map(t => t.function.name);
    expect(names).not.toContain('transferCall');
  });

  it('chaque outil attendu par une assertion est bien proposé au modèle', () => {
    for (const scenario of SCENARIOS) {
      const names = (openAiTools(profileFor(scenario)) as Array<{ function: { name: string } }>)
        .map(t => t.function.name);
      for (const a of scenario.assertions) {
        if (a.kind === 'calls-tool') expect(names, `${scenario.id} → ${a.value}`).toContain(a.value);
      }
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
