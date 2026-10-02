import { describe, it, expect } from 'vitest';
import { entreesDepuisConfig } from '../routes/voice-core.routes';

/**
 * Le SECOND magasin de connaissance.
 *
 * Il y a deux endroits ou un client range ce qu'il sait : la table
 * `businessKnowledge` (une ligne par question) et le blob `vapiConfig` qu'il
 * remplit lui-meme depuis son portail — `items` pour la carte, `hours` pour les
 * horaires, `faq` en texte libre.
 *
 * Le chemin voice-core ne lisait que la table. Un restaurant saisissait
 * trente-trois plats avec leurs prix, et l'agent repondait « je n'ai pas
 * l'info », puis enregistrait la lacune. La donnee n'etait pas perdue : elle
 * etait dans un magasin qu'on ne lisait pas. Ces tests tiennent la porte
 * ouverte.
 */

const CARTE = {
  items: [
    { id: 'b1xbrt0q', name: 'Portion mixte', price: '10€', category: 'menu' },
    { id: 'gnxlj8o7', name: 'Scampis à l’ail (6 pcs / 9 pcs)', price: '18€ / 20€', category: 'menu' },
    { id: 'g6qfrk0s', name: 'Tartare à l’italienne', price: '24€', category: 'menu' },
    { id: 'a0ritv98', name: 'Salade de chèvre chaud et lardons', price: '20€', category: 'menu' },
    { id: '4l04lcpx', name: 'Steak d’angus', price: '28€', category: 'menu' },
  ],
  hours: {
    monday: { from: '12:00', to: '20:00', open: false },
    saturday: { from: '12:00', to: '22:00', open: true },
  },
};

describe('la carte saisie dans le portail devient une entree vocale', () => {
  it('rend une entree cherchable portant les plats et leurs prix', () => {
    const entrees = entreesDepuisConfig(CARTE);
    const carte = entrees.find((e) => e.id === 'config:items');
    expect(carte).toBeDefined();
    expect(carte!.genre).toBe('faq');
    expect(carte!.contenu).toContain('Scampis à l’ail');
    expect(carte!.contenu).toContain('18€ / 20€');
    expect(carte!.contenu).toContain('Steak d’angus');
  });

  /**
   * Le point qui a fait echouer l'appel : l'appelant ne dit pas « carte » ni
   * « menu », il dit le nom du plat. Sans ses mots-la dans les mots-cles, la
   * recherche lexicale de `voice-core` ne peut pas tomber dessus.
   */
  it('met les NOMS des plats en mots-cles, pas seulement leur categorie', () => {
    const carte = entreesDepuisConfig(CARTE).find((e) => e.id === 'config:items')!;
    const cles = carte.mots_cles.map((c) => c.toLowerCase());
    expect(cles).toContain('scampis');
    expect(cles).toContain('angus');
    expect(cles).toContain('salade');
    expect(cles).toContain('tartare');
    // La categorie seule ne suffirait pas : elle est la, mais elle n'est pas tout.
    expect(cles).not.toEqual(['menu']);
  });

  /**
   * Trente-trois plats font trente-trois mots-cles utiles, mais une SEULE
   * entree : cote voix `MAX_RESULTATS` vaut 3, et trente-trois lignes de carte
   * evinceraient la FAQ, les regles et l'equipe.
   */
  it('tient toute la carte en une seule entree', () => {
    const entrees = entreesDepuisConfig(CARTE);
    expect(entrees.filter((e) => e.id === 'config:items')).toHaveLength(1);
  });

  it('passe devant la FAQ generale, sans ecraser les regles', () => {
    const carte = entreesDepuisConfig(CARTE).find((e) => e.id === 'config:items')!;
    expect(carte.priorite).toBeGreaterThan(0);
  });
});

describe('les horaires saisis dans le portail deviennent une entree vocale', () => {
  it('rend les jours en clair, pas l objet brut a cles anglaises', () => {
    const horaires = entreesDepuisConfig(CARTE).find((e) => e.id === 'config:hours');
    expect(horaires).toBeDefined();
    expect(horaires!.contenu).toContain('Samedi');
    expect(horaires!.contenu).toContain('12:00 – 22:00');
    expect(horaires!.contenu).toContain('Lundi : fermé');
  });

  it('reconnait les mots qu un appelant emploie vraiment', () => {
    const horaires = entreesDepuisConfig(CARTE).find((e) => e.id === 'config:hours')!;
    expect(horaires.mots_cles).toContain('ouvert');
    expect(horaires.mots_cles).toContain('ferme');
  });
});

describe('ce qui est vide ou malforme ne fabrique pas d entree fantome', () => {
  it('ne rend rien pour un client qui n a rien rempli', () => {
    expect(entreesDepuisConfig({})).toEqual([]);
  });

  it('ne rend rien pour une carte vide', () => {
    expect(entreesDepuisConfig({ items: [] })).toEqual([]);
  });

  it('survit a une carte malformee sans lever', () => {
    const entrees = entreesDepuisConfig({ items: [null, 'texte', 42, { name: '' }] as unknown[] });
    expect(entrees.find((e) => e.id === 'config:items')).toBeUndefined();
  });

  it('ignore les items sans nom et garde les autres', () => {
    const carte = entreesDepuisConfig({
      items: [{ name: '' }, { name: 'Frites', price: '4,50€', category: 'menu' }],
    }).find((e) => e.id === 'config:items');
    expect(carte).toBeDefined();
    expect(carte!.contenu).toContain('Frites');
  });

  /**
   * Le champ `faq` du blob est une chaine libre : certains clients y ecrivent
   * leur carte en texte plutot que de la saisir en items. On ne la perd pas.
   */
  it('retombe sur le champ faq texte quand il n y a pas d items', () => {
    const entrees = entreesDepuisConfig({ faq: 'Nos plats : lasagnes, carbonara.' });
    expect(entrees.find((e) => e.id === 'config:faq')!.contenu).toContain('lasagnes');
  });

  it('ne double pas la carte quand items ET faq sont remplis', () => {
    const entrees = entreesDepuisConfig({ ...CARTE, faq: 'texte en double' });
    expect(entrees.filter((e) => e.genre === 'faq' && e.id === 'config:faq')).toHaveLength(0);
  });
});
