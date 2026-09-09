import { describe, it, expect } from 'vitest';
import { canonicalCommune, findCommune, normaliseAddress, COMMUNE_COUNT } from '../be-communes';

/**
 * BEL-6. Ixelles et Elsene sont le même endroit et deux noms également
 * officiels. Sans table d'équivalence, deux appelants qui donnent la même
 * adresse produisent deux lignes différentes dans le CRM, le client croit à
 * deux clients, et il rappelle pour demander où il doit aller.
 */
describe('les communes qui portent deux noms', () => {
  it('couvre les dix-neuf bruxelloises qui diffèrent, la périphérie et les grandes villes', () => {
    expect(COMMUNE_COUNT).toBeGreaterThanOrEqual(40);
  });

  it('ramène les deux noms au même endroit', () => {
    expect(findCommune('Elsene')).toEqual(findCommune('Ixelles'));
    expect(findCommune('Schaarbeek')).toEqual(findCommune('Schaerbeek'));
  });

  it('écrit dans la langue du CLIENT, qui est celui qui relit la fiche', () => {
    expect(canonicalCommune('Elsene', 'fr')).toBe('Ixelles');
    expect(canonicalCommune('Ixelles', 'nl')).toBe('Elsene');
  });

  it('ignore la casse, les accents et les tirets', () => {
    for (const written of ['UCCLE', 'uccle', 'Ukkel', 'ukkel']) {
      expect(canonicalCommune(written, 'fr')).toBe('Uccle');
    }
  });

  it('rapproche « saint », « sint » et « st », qu\'un transcripteur écrit au hasard', () => {
    for (const written of ['Saint-Gilles', 'st gilles', 'Sint-Gillis', 'sint gillis']) {
      expect(canonicalCommune(written, 'fr')).toBe('Saint-Gilles');
    }
  });

  it('laisse intacte une commune qui n\'a qu\'un nom', () => {
    // Anderlecht, Jette, Evere s'écrivent pareil: les lister ne changerait
    // aucune sortie et allongerait une table à maintenir.
    expect(findCommune('Anderlecht')).toBeNull();
    expect(canonicalCommune('Anderlecht', 'nl')).toBe('Anderlecht');
  });
});

/**
 * Une adresse belge nomme sa commune après le code postal, ou en fin de ligne.
 * Nulle part ailleurs, et c'est ce qui décide de tout le reste.
 */
describe('la commune dans une adresse libre', () => {
  it('remplace celle qui suit le code postal', () => {
    expect(normaliseAddress('rue de la Loi 155, 1050 Elsene', 'fr'))
      .toBe('rue de la Loi 155, 1050 Ixelles');
    expect(normaliseAddress('Wetstraat 155, 1000 Bruxelles', 'nl'))
      .toBe('Wetstraat 155, 1000 Brussel');
  });

  /**
   * Le piège, trouvé par une sonde avant d'être écrit. « chaussée de WAVRE »
   * contient une commune wallonne dans son nom de RUE. Une recherche libre
   * remplaçait celle-là et laissait la vraie intacte.
   */
  it('ne touche pas à une commune cachée dans un nom de rue', () => {
    expect(normaliseAddress('chaussee de Wavre 100, 1160 Oudergem', 'fr'))
      .toBe('chaussee de Wavre 100, 1160 Auderghem');
  });

  it('ne réécrit rien quand la mention est ambiguë', () => {
    // « je passe par Hal » n'est pas une adresse. Devant l'ambiguïté on ne
    // touche à rien: une adresse laissée telle quelle se relit, une adresse
    // réécrite de travers se croit juste.
    expect(normaliseAddress('chaussee de Wavre 100', 'fr')).toBe('chaussee de Wavre 100');
  });

  it('accepte la commune en fin de phrase, sans code postal', () => {
    expect(normaliseAddress('je suis a Elsene', 'fr')).toBe('je suis a Ixelles');
  });

  it('reconnaît les noms les plus longs, qui sont ceux qu\'on rate', () => {
    // Essayer « Sint » d'abord ne trouverait jamais la commune entière.
    expect(normaliseAddress('rue Haute 12, 1210 Sint-Joost-ten-Node', 'fr'))
      .toBe('rue Haute 12, 1210 Saint-Josse-ten-Noode');
  });

  it('conserve la ponctuation qui suivait', () => {
    expect(normaliseAddress('1050 Elsene, Belgique', 'fr')).toBe('1050 Ixelles, Belgique');
  });
});
