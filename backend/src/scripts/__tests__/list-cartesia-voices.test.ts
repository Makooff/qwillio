import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Le script existe pour une raison qui se perd facilement: un identifiant de
 * voix ne se DÉDUIT jamais.
 *
 * Trois valeurs fausses ont été posées dans `VOICE_REALTIME_MODEL` avant la
 * bonne (6quinvicies), et chacune venait d'ailleurs que de l'API qui reçoit la
 * charge. Écrire dans le dépôt une liste de voix « françaises et bonnes »
 * referait exactement ça: la liste vieillirait, et le symptôme serait une voix
 * qui n'existe pas, servie à un appelant.
 *
 * Deux règles, donc: le script DEMANDE, et il ne coupe pas ce que l'API répond.
 */
const SOURCE = readFileSync(join(__dirname, '../list-cartesia-voices.ts'), 'utf8');
/** Sans les commentaires: celui qui explique un correctif nomme la forme fautive. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('voice:cartesia', () => {
  it('demande la liste à Cartesia, il ne la porte pas en dur', () => {
    expect(CODE).toMatch(/listCartesiaVoices/);
    // Un identifiant Cartesia est un UUID. Aucun ne doit être écrit ici.
    expect(CODE).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  /**
   * Une voix inconnue et un modèle inconnu rendent tous les deux un 400 chez
   * Cartesia: seul le corps les sépare. Le tronquer fabrique une déduction
   * fausse qui a l'air d'une lecture — c'est la leçon exacte de 6quinvicies,
   * où `validate-assistant.ts` coupait à 600 caractères et a coûté deux
   * identifiants de modèle faux.
   */
  it('ne tronque pas la réponse de l\'API', () => {
    expect(CODE).not.toMatch(/\.slice\(\s*0\s*,\s*\d+\s*\)/);
  });

  /**
   * L'essai POSTe vraiment: « cette voix existe » et « ce modèle l'accepte »
   * sont deux questions, et seule la seconde décide d'un appel réel.
   */
  it('propose d\'essayer la voix avec le modèle configuré', () => {
    expect(CODE).toMatch(/synthesiseWithCartesia/);
    expect(CODE).toMatch(/CARTESIA_MODEL/);
  });

  it('dit quand CARTESIA_DEFAULT_VOICE_ID est absente, le défaut silencieux', () => {
    expect(CODE).toMatch(/CARTESIA_DEFAULT_VOICE_ID/);
    expect(SOURCE).toMatch(/ABSENTE/);
  });
});
