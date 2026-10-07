import { describe, it, expect } from 'vitest';

/**
 * ── LE DÉFAUT QUE CES TESTS EXISTENT POUR EMPÊCHER ──────────────────────────
 *
 * En écoutant le site : dix personnages, cinq femmes et cinq hommes, tous
 * servis par le même timbre masculin. La cause n'était pas les voix elles-mêmes
 * mais l'appariement — une table de correspondance incomplète faisait retomber
 * tout le monde sur `CARTESIA_DEFAULT_VOICE_ID`.
 *
 * `pairVoices` est la partie où ce défaut se produit. Elle est pure, donc
 * vérifiable sans réseau.
 */

const { pairVoices } = await import('../cartesia-voices.service');

const voix = (n: number, gender: 'male' | 'female') =>
  Array.from({ length: n }, (_, i) => ({ voiceId: `${gender}-${i}`, name: `${gender} ${i}`, gender }));

const persos = (...gendres: Array<'f' | 'm'>) =>
  gendres.map((gender, i) => ({ id: `p${i}`, gender }));

describe('pairVoices — une voix française par personnage', () => {
  it('donne une voix DISTINCTE à chaque personnage', () => {
    /* Le défaut d'origine : tout le monde sur la même voix. Rien ne doit jamais
       pouvoir produire deux fois le même identifiant. */
    const pairing = pairVoices(persos('f', 'f', 'm', 'm'), { female: voix(5, 'female'), male: voix(5, 'male') });

    const ids = Object.values(pairing).map(v => v.voiceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
  });

  it('respecte le genre, sans exception', () => {
    /* C'est la règle qui a été violée en production — un « Lucas » avec une voix
       de femme — et elle ne se négocie pas. */
    const pairing = pairVoices(persos('f', 'm', 'f', 'm'), { female: voix(5, 'female'), male: voix(5, 'male') });

    expect(pairing.p0.gender).toBe('female');
    expect(pairing.p1.gender).toBe('male');
    expect(pairing.p2.gender).toBe('female');
    expect(pairing.p3.gender).toBe('male');
  });

  it('laisse SANS voix plutôt que de donner le mauvais genre', () => {
    /* Le point le plus important, et le plus tentant à rater : quand le
       catalogue français n'a plus de voix masculine, on préfère laisser le
       personnage sur son ancienne voix plutôt que de lui donner une voix de
       femme. Un défaut visible livré au client est pire qu'un défaut connu en
       attente de correction. */
    const pairing = pairVoices(persos('m', 'm', 'm'), { female: voix(10, 'female'), male: voix(1, 'male') });

    expect(Object.keys(pairing)).toEqual(['p0']);
    expect(pairing.p1).toBeUndefined();
    expect(pairing.p2).toBeUndefined();
  });

  it('ne redistribue jamais une voix déjà prise', () => {
    /* Deux personnages du même genre, une seule voix disponible : le second
       n'en reçoit aucune. Réutiliser produirait exactement le défaut qu'on
       répare. */
    const pairing = pairVoices(persos('f', 'f'), { female: voix(1, 'female'), male: voix(5, 'male') });

    expect(Object.keys(pairing)).toEqual(['p0']);
  });

  it('ne donne jamais une voix de l’autre genre pour combler un manque', () => {
    // Aucune voix féminine : les femmes ne reçoivent rien, et surtout pas un homme.
    const pairing = pairVoices(persos('f', 'f'), { female: [], male: voix(5, 'male') });

    expect(pairing).toEqual({});
  });

  it('traite le catalogue vide sans planter', () => {
    expect(pairVoices(persos('f', 'm'), { female: [], male: [] })).toEqual({});
  });

  it('rend une entrée par personnage servi, et pas plus', () => {
    const pairing = pairVoices(persos('f', 'm'), { female: voix(3, 'female'), male: voix(3, 'male') });
    expect(Object.keys(pairing).sort()).toEqual(['p0', 'p1']);
  });

  it('répartit dans l’ordre : le premier personnage prend la première voix', () => {
    // Déterministe, pour qu'un même catalogue donne toujours le même rendu.
    const pairing = pairVoices(persos('f'), { female: voix(3, 'female'), male: [] });
    expect(pairing.p0.voiceId).toBe('female-0');
  });
});
