import { describe, it, expect } from 'vitest';
import { buildScrapeQueries } from '../apify-scraping.service';
import { CITIES_COORDINATES } from '../../utils/constants';

/**
 * Deux règles du scraping qui ne se voient pas à la lecture, et dont chacune
 * a produit un silence plutôt qu'une erreur.
 */
describe('buildScrapeQueries', () => {
  it('garde le mot-clé saisi même quand la niche déclare déjà dix requêtes', () => {
    const base = [
      'plombier', 'plumber', 'électricien', 'electrician', 'HVAC contractor',
      'chauffagiste', 'serrurier', 'locksmith', 'couvreur', 'roofer',
    ];
    // C'est le cas qui échouait: le mot-clé arrivait en onzième position et le
    // plafond le supprimait, donc le champ de l'admin ne faisait rien.
    expect(buildScrapeQueries(base, ['chauffagiste'])).toEqual([
      'chauffagiste', 'plombier', 'plumber',
    ]);
  });

  it('tient le plafond, qui est ce qui protège les crédits Apify', () => {
    expect(buildScrapeQueries(['a', 'b', 'c', 'd'], [])).toHaveLength(3);
    expect(buildScrapeQueries(['a', 'b', 'c', 'd'], ['x', 'y'], 2)).toEqual(['x', 'y']);
  });

  it('sans mot-clé, laisse l\'ordre des requêtes par défaut intact', () => {
    expect(buildScrapeQueries(['plombier', 'plumber', 'électricien'])).toEqual([
      'plombier', 'plumber', 'électricien',
    ]);
  });
});

describe('CITIES_COORDINATES, zone de vente Bruxelles et Brabant wallon', () => {
  /* Une ville absente de cette table retombe sur les États-Unis dans
     getCityMeta(): l'acteur cherche alors en anglais avec un biais géo
     américain (« Waterloo » existe dans l'Iowa), et toE164(..., 'US') rejette
     ou préfixe en +1 les numéros belges. Le scrape ne tombe pas en erreur, il
     rend des résultats faux, ce qui est pire. */
  const ZONE = [
    'Bruxelles', 'Wavre', 'Nivelles', 'Waterloo', "Braine-l'Alleud",
    'Ottignies-Louvain-la-Neuve', 'Rixensart', 'Tubize', 'Genappe',
    'La Hulpe', 'Jodoigne',
  ];

  it.each(ZONE)('%s est belge, sur le fuseau de Bruxelles', (city) => {
    const meta = CITIES_COORDINATES[city];
    expect(meta, `${city} manque à CITIES_COORDINATES`).toBeDefined();
    expect(meta.country).toBe('BE');
    expect(meta.timezone).toBe('Europe/Brussels');
  });

  it('place la zone dans la bonne fenêtre de coordonnées', () => {
    for (const city of ZONE) {
      const { lat, lng } = CITIES_COORDINATES[city];
      expect(lat, city).toBeGreaterThan(50.3);
      expect(lat, city).toBeLessThan(51.0);
      expect(lng, city).toBeGreaterThan(4.0);
      expect(lng, city).toBeLessThan(5.0);
    }
  });
});
