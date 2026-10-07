import { describe, it, expect } from 'vitest';
import { NICHE_PERSONA, defaultCharacterForNiche } from '../niche-personas';
import { listCharacters, isValidCharacterId } from '../voice-characters';
import { resolveNiche } from '../niches';

describe('NICHE_PERSONA', () => {
  it('couvre chacun des 12 métiers, sans en oublier', () => {
    // Les clés de `NicheId` (voir niches.ts), énumérées ici pour que le test
    // casse si un métier est ajouté là-bas sans être traduit en ton ici.
    const niches = [
      'restaurant', 'dental', 'medical', 'salon', 'law', 'real_estate',
      'auto', 'home_services', 'veterinary', 'fitness', 'financial', 'default',
    ] as const;
    for (const n of niches) {
      expect(NICHE_PERSONA[n], `niche sans ton: ${n}`).toBeTruthy();
    }
  });

  it('chaque métier retombe sur un personnage qui porte LE ton attendu', () => {
    const characters = listCharacters();
    for (const [niche, persona] of Object.entries(NICHE_PERSONA)) {
      const id = defaultCharacterForNiche(niche as keyof typeof NICHE_PERSONA);
      expect(id, `aucun personnage pour ${niche}`).toBeTruthy();
      const character = characters.find(c => c.id === id);
      expect(character?.personaKey, `${niche} → ${id} → ${character?.personaKey}`).toBe(persona);
    }
  });

  it('préfère le genre demandé quand le métier le permet', () => {
    // Le dentaire a (au moins) un personnage féminin doux: nour.
    const f = defaultCharacterForNiche('dental', 'f');
    expect(f).toBeTruthy();
    const character = listCharacters().find(c => c.id === f)!;
    expect(character.gender).toBe('f');
    expect(character.personaKey).toBe('caring');
  });

  it('rend des identifiants valides du catalogue', () => {
    for (const niche of Object.keys(NICHE_PERSONA)) {
      const id = defaultCharacterForNiche(niche as keyof typeof NICHE_PERSONA);
      expect(isValidCharacterId(id)).toBe(true);
    }
  });

  it('reste cohérent avec resolveNiche: un businessType libre donne un personnage', () => {
    // « dentiste » → dental → caring; « restaurant » → warm.
    expect(NICHE_PERSONA[resolveNiche('cabinet dentaire')]).toBe('caring');
    expect(defaultCharacterForNiche(resolveNiche('pizzeria')).length).toBeGreaterThan(0);
  });
});
