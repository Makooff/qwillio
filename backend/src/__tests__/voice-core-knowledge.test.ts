import { describe, it, expect } from 'vitest';
import { entreesDepuisConfig } from '../routes/voice-core.routes';
import { knowledgePreset } from '../config/knowledge-presets';

/**
 * Le SECOND magasin de connaissance.
 *
 * Il y a deux endroits ou un client range ce qu'il sait : la table
 * `businessKnowledge` (une ligne par question) et le blob `vapiConfig` qu'il
 * remplit lui-meme depuis son portail — `items` pour ce qu'il vend, `hours`
 * pour les horaires, `knowledge` pour les champs nommes de son metier, `faq`
 * pour ses questions.
 *
 * Le chemin voice-core ne lisait que la table. Un restaurateur saisissait
 * trente-trois plats avec leurs prix, et l'agent repondait « je n'ai pas
 * l'info », puis enregistrait la lacune. La donnee n'etait pas perdue : elle
 * etait dans un magasin qu'on ne lisait pas.
 *
 * DOUZE METIERS. Le piege de la premiere version de ces tests : ils ne
 * couvraient qu'un restaurant, et le code ecrivait « Carte / services et prix »
 * en dur. Un dentiste remplissait « Mutuelles et conventionnement » et sa
 * receptionniste repondait qu'elle ne savait pas. Les libelles viennent
 * maintenant du preset du metier, et plusieurs metiers sont verifies ici.
 */

/** Les maps de libelles, telles que la route les construit depuis le preset. */
function libelles(businessType: string) {
  const preset = knowledgePreset(businessType);
  return {
    items: new Map(preset.itemCategories.map((c) => [c.v, c.l])),
    champs: new Map(preset.fields.map((f) => [f.id, f.label])),
  };
}

function pour(businessType: string, cfg: Record<string, unknown>) {
  const { items, champs } = libelles(businessType);
  return entreesDepuisConfig(cfg, items, champs);
}

const RESTO = {
  items: [
    { name: 'Portion mixte', price: '10€', category: 'carte' },
    { name: 'Scampis à l’ail (6 pcs / 9 pcs)', price: '18€ / 20€', category: 'carte' },
    { name: 'Steak d’angus', price: '28€', category: 'carte' },
    { name: 'Menus du midi', price: '19€', category: 'menus' },
  ],
  hours: {
    monday: { from: '12:00', to: '20:00', open: false },
    saturday: { from: '12:00', to: '22:00', open: true },
  },
};

const DENTISTE = {
  items: [
    { name: 'Détartrage', price: '60€', category: 'soins' },
    { name: 'Implant', price: '1 800€', category: 'protheses' },
    { name: 'Urgence douleur', price: '', category: 'urgences' },
  ],
  knowledge: {
    insuranceAccepted: 'Conventionné, tiers payant avec Partenamut et Solidaris',
    emergencyProtocol: 'Créneau urgence chaque matin à 8 h 30, sinon le 1733',
    cancellationPolicy: 'Gratuite jusqu’à 24 h avant, 40 € au-delà',
  },
};

describe('les items saisis dans le portail deviennent une entree vocale', () => {
  it('rend une entree cherchable portant les items et leurs prix', () => {
    const carte = pour('restaurant', RESTO).find((e) => e.id === 'config:items');
    expect(carte).toBeDefined();
    expect(carte!.genre).toBe('faq');
    expect(carte!.contenu).toContain('Scampis à l’ail');
    expect(carte!.contenu).toContain('18€ / 20€');
    expect(carte!.contenu).toContain('Steak d’angus');
  });

  /**
   * Le point qui a fait echouer l'appel : l'appelant ne dit pas « carte » ni
   * « menu », il dit le nom de l'item. Sans ses mots-la dans les mots-cles, la
   * recherche lexicale de `voice-core` ne peut pas tomber dessus.
   */
  it('met les NOMS des items en mots-cles, pas seulement leur categorie', () => {
    const carte = pour('restaurant', RESTO).find((e) => e.id === 'config:items')!;
    const cles = carte.mots_cles.map((c) => c.toLowerCase());
    expect(cles).toContain('scampis');
    expect(cles).toContain('angus');
    expect(cles).not.toEqual(['carte']);
  });

  /**
   * Trente-trois items font trente-trois mots-cles utiles, mais une SEULE
   * entree : cote voix `MAX_RESULTATS` vaut 3, et trente-trois lignes
   * evinceraient la FAQ, les regles et l'equipe.
   */
  it('tient toute la liste en une seule entree', () => {
    expect(pour('restaurant', RESTO).filter((e) => e.id === 'config:items')).toHaveLength(1);
  });

  it('accepte un item sans prix', () => {
    const carte = pour('dental', DENTISTE).find((e) => e.id === 'config:items')!;
    expect(carte.contenu).toContain('Urgence douleur');
  });
});

// ── Le libelle vient du METIER, jamais d'une chaine ecrite ici ────────────────
//
// La premiere version ecrivait « Carte / services et prix » en dur, ce qui
// servait un restaurant et mentait aux onze autres metiers. `niches.ts` decrit
// exactement ce defaut : un client « aurait eu ses questions d'onboarding mais
// pas ses presets, sans que rien ne le signale ».

describe('les libelles suivent le metier du client', () => {
  it('un restaurateur lit les libelles de la restauration', () => {
    const carte = pour('restaurant', RESTO).find((e) => e.id === 'config:items')!;
    expect(carte.contenu).toContain('Plats à la carte');
    expect(carte.contenu).toContain('Menus et formules');
  });

  it('un dentiste lit les libelles du cabinet dentaire', () => {
    const carte = pour('cabinet dentaire', DENTISTE).find((e) => e.id === 'config:items')!;
    expect(carte.contenu).toContain('Soins conservateurs');
    expect(carte.contenu).toContain('Prothèses et implants');
    expect(carte.contenu).toContain('Urgences');
    // Et surtout PAS la carte d'un restaurant.
    expect(carte.contenu).not.toContain('Plats à la carte');
  });

  /**
   * `businessType` est un champ LIBRE (« Garage Dupont », « cabinet dentaire »).
   * Le preset passe par `resolveNiche`, donc un libelle metier doit sortir meme
   * quand le client a ecrit autre chose que l'identifiant de la niche.
   */
  it('trouve le metier derriere un businessType ecrit librement', () => {
    const carte = pour('Garage Dupont & Fils', {
      items: [{ name: 'Vidange', price: '79€', category: 'prestations' }],
    }).find((e) => e.id === 'config:items')!;
    expect(carte).toBeDefined();
    expect(carte.contenu).toContain('Vidange');
  });

  /**
   * Un metier qu'aucun preset ne connait retombe sur `default`, qui a ses
   * propres libelles. On ne devine pas, on ne perd pas non plus.
   */
  it('retombe proprement sur un metier inconnu', () => {
    const entrees = pour('chose jamais vue', {
      items: [{ name: 'Forfait A', price: '100€', category: 'formules' }],
    });
    expect(entrees.find((e) => e.id === 'config:items')).toBeDefined();
  });
});

// ── Les champs nommes du metier ───────────────────────────────────────────────
//
// Ce que le portail fait remplir et que la voix n'a jamais lu : « Mutuelles et
// conventionnement », « Politique d'annulation », « Acces et stationnement ».
// Un dentiste qui remplit « Mutuelles acceptees » et s'entend dire « je ne sais
// pas » a paye pour un formulaire que personne ne lit.

describe('les champs nommes du metier deviennent une entree vocale', () => {
  it('rend les champs du dentiste avec leurs libelles', () => {
    const infos = pour('dental', DENTISTE).find((e) => e.id === 'config:knowledge');
    expect(infos).toBeDefined();
    expect(infos!.contenu).toContain('Mutuelles et conventionnement');
    expect(infos!.contenu).toContain('Partenamut');
    expect(infos!.contenu).toContain('Conduite à tenir en urgence');
  });

  /**
   * Un identifiant qu'aucun preset ne connait est rendu TEL QUEL plutot
   * qu'ecarte : il vient d'un preset qui a change depuis, et une valeur ecrite
   * par un client vaut mieux brute que perdue.
   */
  it('conserve un champ qu aucun preset ne connait, sans le perdre', () => {
    const infos = pour('dental', {
      knowledge: { champDisparu: 'Livraison le samedi' },
    }).find((e) => e.id === 'config:knowledge')!;
    expect(infos.contenu).toContain('champDisparu');
    expect(infos.contenu).toContain('Livraison le samedi');
  });

  it('ignore les champs vides', () => {
    const entrees = pour('dental', { knowledge: { parkingAccess: '   ' } });
    expect(entrees.find((e) => e.id === 'config:knowledge')).toBeUndefined();
  });
});

// ── La FAQ libre ──────────────────────────────────────────────────────────────
//
// `vapiConfig.faq` et `faqEntries` n'avaient aucun lecteur cote appel : le
// gerant ecrivait les questions qu'on lui pose le plus, et sa receptionniste ne
// les avait jamais vues.

describe('la FAQ saisie par le gerant devient une entree vocale', () => {
  it('rend les lignes question/reponse', () => {
    const faq = pour('dental', {
      faqEntries: [{ q: 'Prenez-vous de nouveaux patients ?', a: 'Oui, sur rendez-vous.' }],
    }).find((e) => e.id === 'config:faq')!;
    expect(faq.contenu).toContain('Prenez-vous de nouveaux patients ?');
    expect(faq.contenu).toContain('Oui, sur rendez-vous.');
  });

  it('rend aussi le faq en texte libre', () => {
    const faq = pour('restaurant', { faq: 'Le service du soir commence à 19 h.' })
      .find((e) => e.id === 'config:faq')!;
    expect(faq.contenu).toContain('service du soir');
  });

  it('met les mots de la question en mots-cles', () => {
    const faq = pour('dental', {
      faqEntries: [{ q: 'Faites-vous du blanchiment ?', a: 'Après un contrôle.' }],
    }).find((e) => e.id === 'config:faq')!;
    expect(faq.mots_cles).toContain('blanchiment');
  });

  it('saute une ligne q/a incomplete plutot que de rendre du vide', () => {
    const entrees = pour('dental', { faqEntries: [{ q: 'Une question ?' }] });
    expect(entrees.find((e) => e.id === 'config:faq')).toBeUndefined();
  });
});

describe('les horaires saisis dans le portail deviennent une entree vocale', () => {
  it('rend les jours en clair, pas l objet brut a cles anglaises', () => {
    const horaires = pour('restaurant', RESTO).find((e) => e.id === 'config:hours');
    expect(horaires).toBeDefined();
    expect(horaires!.contenu).toContain('Samedi');
    expect(horaires!.contenu).toContain('12:00 – 22:00');
    expect(horaires!.contenu).toContain('Lundi : fermé');
  });

  it('reconnait les mots qu un appelant emploie vraiment', () => {
    const horaires = pour('restaurant', RESTO).find((e) => e.id === 'config:hours')!;
    expect(horaires.mots_cles).toContain('ouvert');
    expect(horaires.mots_cles).toContain('ferme');
  });
});

describe('ce qui est vide ou malforme ne fabrique pas d entree fantome', () => {
  it('ne rend rien pour un client qui n a rien rempli', () => {
    expect(pour('restaurant', {})).toEqual([]);
  });

  it('ne rend rien pour une liste vide', () => {
    expect(pour('restaurant', { items: [] })).toEqual([]);
  });

  /**
   * Une entree au contenu vide serait offerte au modele comme une reponse a
   * lire, et il repondrait « voici la liste : (rien) » au lieu d'avouer qu'il
   * ne sait pas. Le filtre des objets ne suffit pas : il garde `{ name: '' }`.
   */
  it('survit a une liste malformee sans lever ni inventer une entree', () => {
    const entrees = pour('restaurant', { items: [null, 'texte', 42, { name: '' }] as unknown[] });
    expect(entrees.find((e) => e.id === 'config:items')).toBeUndefined();
  });

  it('ignore les items sans nom et garde les autres', () => {
    const carte = pour('restaurant', {
      items: [{ name: '' }, { name: 'Frites', price: '4,50€', category: 'carte' }],
    }).find((e) => e.id === 'config:items');
    expect(carte).toBeDefined();
    expect(carte!.contenu).toContain('Frites');
  });

  it('ne fabrique pas de prefixe quand le blob ne porte pas de categorie', () => {
    const carte = pour('restaurant', { items: [{ name: 'Frites', price: '4,50€' }] })
      .find((e) => e.id === 'config:items')!;
    expect(carte.contenu).toBe('Frites — 4,50€');
  });

  it('ne melange pas items et champs nommes dans une seule entree', () => {
    const entrees = pour('dental', DENTISTE);
    expect(entrees.filter((e) => e.id === 'config:items')).toHaveLength(1);
    expect(entrees.filter((e) => e.id === 'config:knowledge')).toHaveLength(1);
  });
});
