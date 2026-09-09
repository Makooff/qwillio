import { describe, it, expect } from 'vitest';
import { fitAssistantLabel, fitAssistantName, VAPI_ASSISTANT_NAME_MAX } from '../vapi-limits';

/**
 * « name must be shorter than or equal to 40 characters », API Vapi, 09/09/2026.
 *
 * Un nom trop long ne dégrade rien: il fait refuser la création de l'assistant,
 * donc le client n'en a aucun. Et le nom est l'unique partie de la charge qui
 * ne change rien au comportement de l'agent.
 */
describe('le nom d\'assistant tient dans ce que Vapi accepte', () => {
  it('laisse un nom court intact', () => {
    expect(fitAssistantName('Receptionist', 'Chez Marie')).toBe('Receptionist - Chez Marie');
  });

  it('coupe l\'entreprise, jamais l\'agent', () => {
    const name = fitAssistantName('Sophie', 'Boulangerie Pâtisserie Saint-Michel Uccle');
    expect(name.length).toBeLessThanOrEqual(VAPI_ASSISTANT_NAME_MAX);
    expect(name.startsWith('Sophie - ')).toBe(true);
    expect(name.endsWith('…')).toBe(true);
  });

  it('tient la limite sur le cas qui a refusé en production', () => {
    // 45 caractères: le nom qu'aurait porté ce client à l'inscription.
    const original = 'Receptionist - Boulangerie Saint-Michel Uccle';
    expect(original.length).toBeGreaterThan(VAPI_ASSISTANT_NAME_MAX);
    expect(fitAssistantName('Receptionist', 'Boulangerie Saint-Michel Uccle').length)
      .toBeLessThanOrEqual(VAPI_ASSISTANT_NAME_MAX);
  });

  it('survit à un nom d\'agent qui déborde à lui seul', () => {
    const name = fitAssistantName('A'.repeat(60), 'Chez Marie');
    expect(name.length).toBeLessThanOrEqual(VAPI_ASSISTANT_NAME_MAX);
  });

  it('accepte une entreprise absente sans produire un nom bancal', () => {
    expect(fitAssistantName('Sophie', '')).toBe('Sophie');
    expect(fitAssistantName('', 'Chez Marie')).toBe('Chez Marie');
  });

  it('ne rend jamais un nom vide', () => {
    expect(fitAssistantName('', '').length).toBeGreaterThan(0);
  });

  /* Une entreprise dont le nom porte un emoji consomme deux unités UTF-16 —
     et le validateur en face compte pareil. */
  it('compte comme le validateur, unités UTF-16 comprises', () => {
    const name = fitAssistantName('Sophie', '🍞'.repeat(40));
    expect(name.length).toBeLessThanOrEqual(VAPI_ASSISTANT_NAME_MAX);
  });
});

describe('la borne tient aussi sur le passage obligé', () => {
  it('coupe une étiquette trop longue sans rien savoir d\'elle', () => {
    const label = fitAssistantLabel('Receptionist - Boulangerie Saint-Michel Uccle et Environs');
    expect(label.length).toBeLessThanOrEqual(VAPI_ASSISTANT_NAME_MAX);
    expect(label.startsWith('Receptionist - ')).toBe(true);
  });

  it('laisse une étiquette courte intacte', () => {
    expect(fitAssistantLabel('Sophie - Chez Marie')).toBe('Sophie - Chez Marie');
  });
});
