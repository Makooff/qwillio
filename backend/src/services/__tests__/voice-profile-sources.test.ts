import { describe, it, expect } from 'vitest';
import { readServices, readFaqBlock } from '../voice/realtime-context.service';

/**
 * Ce que la réceptionniste SAIT quand elle décroche.
 *
 * Deux écrans écrivent la même chose dans deux colonnes. Le parcours guidé
 * enregistre dans `onboardingData`; l'assistant d'inscription et l'écran
 * Réceptionniste écrivent dans `vapiConfig` (`applyConfigPatch` ne touche que
 * celle-là). Le profil d'appel ne lisait que la première: tout ce qu'un client
 * dictait à l'assistant pendant son inscription — ses horaires, ses services,
 * sa FAQ — restait dans l'autre colonne et n'arrivait jamais à l'appel.
 * L'écran de configuration, lui, note son score sur `vapiConfig`: la case
 * passait au vert pendant que le téléphone ne savait rien, et l'agent
 * inventait — exactement ce que `setup-completeness` dit vouloir empêcher.
 *
 * La règle que ces tests tiennent: une information saisie quelque part arrive
 * à l'appel, et la saisie explicite du parcours guidé garde la priorité.
 */
describe('readServices', () => {
  it('lit les services du parcours guidé en priorité', () => {
    const out = readServices(['Coupe', 'Couleur'], [{ name: 'Barbe', price: '15 EUR' }]);
    expect(out).toEqual(['Coupe', 'Couleur']);
  });

  it("lit la carte de l'assistant quand le parcours guidé n'a rien", () => {
    /* Le cas de TOUT client inscrit en libre-service: il n'a jamais ouvert le
       parcours guidé, donc `onboardingData.services` est vide. Le libellé
       reprend celui du mode test, pour que l'essai au clavier et l'appel réel
       énoncent les mêmes prix. */
    const out = readServices(undefined, [
      { name: 'Pizza Margherita', price: '12 EUR' },
      { name: 'Tiramisu', price: '6 EUR' },
    ]);
    expect(out).toEqual(['Pizza Margherita (12 EUR)', 'Tiramisu (6 EUR)']);
  });

  it('garde un service sans prix plutôt que de le perdre', () => {
    expect(readServices(null, [{ name: 'Devis gratuit' }])).toEqual(['Devis gratuit']);
  });

  it('jette une entrée sans nom', () => {
    /* Un prix sans nom ne se prononce pas: « ça coûte 12 EUR » sans dire de
       quoi est pire qu'un silence, parce que l'appelant l'entend comme une
       réponse à sa question. */
    expect(readServices(null, [{ price: '12 EUR' }, { name: '  ' }])).toEqual([]);
  });

  it('ne rend rien quand les deux colonnes sont vides', () => {
    expect(readServices(null, null)).toEqual([]);
    expect(readServices([], [])).toEqual([]);
  });

  it('plafonne à douze, des deux côtés', () => {
    const vingt = Array.from({ length: 20 }, (_, i) => ({ name: `Plat ${i}`, price: '1 EUR' }));
    expect(readServices(null, vingt)).toHaveLength(12);
    expect(readServices(vingt.map(v => v.name), null)).toHaveLength(12);
  });

  it("ignore une valeur qui n'a pas la forme attendue", () => {
    /* Ces deux colonnes sont du JSON écrit par plusieurs chemins depuis des
       mois: une valeur d'une autre forme doit valoir « rien », jamais une
       exception sur le chemin critique d'un appel entrant. */
    expect(readServices('Coupe', 'Couleur')).toEqual([]);
    expect(readServices([1, null, 'Coupe'], null)).toEqual(['Coupe']);
  });
});

describe('readFaqBlock', () => {
  it('rend les paires question/réponse', () => {
    const out = readFaqBlock('', [{ q: 'Vous livrez ?', a: 'Oui, dans un rayon de 5 km.' }]);
    expect(out).toContain('Vous livrez ?');
    expect(out).toContain('dans un rayon de 5 km');
  });

  it('rend aussi la FAQ tapée en texte libre', () => {
    /* Deux formes coexistent en base, écrites par deux écrans. Aucune des deux
       n'avait de lecteur côté appel: le gérant écrivait les questions qu'on lui
       pose le plus, et sa réceptionniste ne les avait jamais vues. */
    expect(readFaqBlock('Parking gratuit derrière le bâtiment.', null))
      .toContain('Parking gratuit');
  });

  it('rend les deux formes ensemble, les paires en premier', () => {
    const out = readFaqBlock('Texte libre.', [{ q: 'Une question', a: 'Sa réponse' }]);
    expect(out.indexOf('Une question')).toBeLessThan(out.indexOf('Texte libre.'));
  });

  it("rend une chaîne vide quand il n'y a rien à dire", () => {
    /* Le bloc est concaténé dans le prompt: un en-tête « BUSINESS KNOWLEDGE »
       suivi de rien inviterait le modèle à le combler lui-même. */
    expect(readFaqBlock('', [])).toBe('');
    expect(readFaqBlock(null, null)).toBe('');
    expect(readFaqBlock('   ', [{ q: 'une question sans réponse' }])).toBe('');
  });

  it('borne la longueur', () => {
    /* C'est un prompt d'appel, pas une base de connaissances: celle-là vit
       dans `businessKnowledge` et a son propre outil. */
    const out = readFaqBlock('x'.repeat(5000), null);
    expect(out.length).toBeLessThanOrEqual('BUSINESS KNOWLEDGE:\n'.length + 2000);
  });
});
