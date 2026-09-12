import { describe, it, expect } from 'vitest';
import { CARTESIA_CURATED, curatedCartesiaIds } from '../cartesia-curated';

/**
 * Le sélecteur ne montre que les voix choisies par le propriétaire.
 *
 * Le catalogue public répond 69 voix « fr », québécoises comprises; la liste
 * retenue vient de cartesia.ai et ses identifiants de la réponse de l'API
 * (`npm run voice:cartesia -- --lang=fr`), jamais d'un nom d'écran.
 */
describe('CARTESIA_CURATED', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it('porte la liste française choisie, sous forme d\'identifiants API', () => {
    const fr = CARTESIA_CURATED.fr ?? [];
    expect(fr.length).toBe(25);
    for (const v of fr) expect(v.voiceId).toMatch(UUID);
  });

  it('ne répète ni un identifiant ni un nom', () => {
    const fr = CARTESIA_CURATED.fr ?? [];
    expect(new Set(fr.map(v => v.voiceId)).size).toBe(fr.length);
    expect(new Set(fr.map(v => v.name)).size).toBe(fr.length);
  });

  it('sert le catalogue ENTIER pour une langue non triée', () => {
    /* Le vide n'est pas un tri: un oubli ne doit pas éteindre un écran. */
    expect(curatedCartesiaIds('en')).toBeNull();
    expect(curatedCartesiaIds('nl')).toBeNull();
    expect(curatedCartesiaIds('fr')?.size).toBe(25);
  });
});
