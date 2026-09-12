import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Une voix sert un appel: elle se filtre sur la langue de l'APPEL, qui est
 * celle du profil. Pas sur une règle écrite à la main dans la route.
 *
 * Relevé le 12/09/2026 sur un vrai compte, `agentLanguage` « en » (un défaut
 * d'inscription) et pays « BE »: le profil faisait parler l'agent en français,
 * la liste des voix lisait `agentLanguage` et servait de l'anglais, la route
 * d'aperçu avait une troisième règle, disait français, ne retrouvait pas la
 * voix anglaise et répondait 404 sur chaque bouton lecture. Trois règles,
 * trois réponses. C'est 6vicies: deux règles écrites à la main pour la même
 * question divergent en moins d'un mois, et ici il y en avait trois.
 *
 * Le test lit le SOURCE des deux routes, comme les autres gardes de ce dépôt:
 * ni l'une ni l'autre ne décide de la langue elle-même.
 */
const SOURCE = readFileSync(join(__dirname, '../client-dashboard.controller.ts'), 'utf8');
/** Sans les commentaires: celui qui explique le correctif nomme la forme fautive. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function method(name: string): string {
  const start = CODE.indexOf(`async ${name}(`);
  expect(start, `${name} introuvable`).toBeGreaterThan(-1);
  // Jusqu'à la méthode suivante: assez large pour couvrir le corps entier.
  const next = CODE.indexOf('\n  async ', start + 1);
  return CODE.slice(start, next === -1 ? undefined : next);
}

describe('la langue des voix vient du profil', () => {
  for (const name of ['listVoices', 'characterPreview']) {
    it(`${name} ne décide pas de la langue elle-même`, () => {
      const body = method(name);
      expect(body).toMatch(/getClientProfile\(/);
      expect(body).not.toMatch(/agentLanguage\s*===|agentLanguage\?\.startsWith|\[\s*'FR'\s*,\s*'BE'/);
    });
  }
});
