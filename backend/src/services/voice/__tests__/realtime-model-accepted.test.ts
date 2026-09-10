import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';

/**
 * Le modèle temps réel ne doit pas être une valeur que Vapi a REFUSÉE.
 *
 * `gpt-realtime-2.1` était posé ici, lu dans le catalogue d'OpenAI. Vapi l'a
 * refusé le 10/09/2026, sur les trois variantes temps réel, et un modèle refusé
 * ne dégrade pas un appel: il fait refuser l'assistant entier (6octies).
 *
 * **Une liste NOIRE, pas une liste blanche, et c'est délibéré.** La première
 * version de ce test énumérait les valeurs acceptées, lues dans le message
 * d'erreur — sauf que le script coupait ce message à 600 caractères et que
 * l'énumération était tronquée en plein milieu. Une liste blanche bâtie sur un
 * texte coupé refuserait un identifiant parfaitement valide, par exemple celui
 * des modèles que le tableau de bord Vapi propose et que la partie visible ne
 * nommait pas. On ne fige donc que ce qu'on SAIT: cette valeur-là est refusée.
 */
const REFUSED_BY_VAPI = [
  /* Refusé sur les six variantes, message d'erreur du 10/09/2026. */
  'gpt-realtime-2.1',
];

describe('VOICE_REALTIME_MODEL', () => {
  it('n\'est pas une valeur que Vapi a refusée', () => {
    expect(REFUSED_BY_VAPI).not.toContain(env.VOICE_REALTIME_MODEL);
  });

  it('a une valeur', () => {
    // Vide, le champ part quand même et emporte l'assistant.
    expect(env.VOICE_REALTIME_MODEL.trim().length).toBeGreaterThan(0);
  });
});

describe('voice:validate — le corps de la réponse', () => {
  it('n\'est plus tronqué', async () => {
    /* Une réponse d'API se lit en entier ou ne se lit pas. C'est la troncature
       qui a fait conclure trop vite sur la liste des modèles acceptés. */
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const script = readFileSync(join(process.cwd(), 'src/scripts/validate-assistant.ts'), 'utf8');
    expect(script).not.toMatch(/body\.slice\(0,\s*\d+\)/);
  });
});
