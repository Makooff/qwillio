import { describe, it, expect } from 'vitest';
import { clientLocale, emailLocale, signupAgentLanguage } from '../client-locale';

/**
 * UNE règle de langue, pour toutes les surfaces.
 *
 * « Il y a souvent des mélanges français, anglais, j'en ai marre. » Relevé le
 * 11/09/2026, et ce n'était pas un hasard d'affichage: SEPT règles écrites à la
 * main répondaient à la même question dans le dépôt, et elles se
 * contredisaient. Le même client passait en anglais sur un écran et en français
 * sur le suivant, selon la règle que ce bout de code avait recopiée.
 *
 * Les cas ci-dessous sont exactement ceux où les anciennes règles divergeaient.
 */
describe('clientLocale', () => {
  it('rend le choix du client quand il existe', () => {
    expect(clientLocale({ agentLanguage: 'fr' })).toBe('fr');
    expect(clientLocale({ agentLanguage: 'en' })).toBe('en');
    expect(clientLocale({ agentLanguage: 'nl' })).toBe('nl');
  });

  it('ne perd PAS le néerlandais', () => {
    /* `agentLanguage === 'fr' ? 'fr' : 'en'`, recopié dans huit services,
       servait de l'anglais à tout client flamand. */
    expect(clientLocale({ agentLanguage: 'nl', country: 'BE' })).toBe('nl');
  });

  it('met le CHOIX au-dessus du pays', () => {
    /* L'ancienne règle du chat mettait le pays d'abord, donc un commerce
       bruxellois ayant demandé le néerlandais était servi en français. Le pays
       est une présomption, le réglage est une décision. */
    expect(clientLocale({ agentLanguage: 'nl', country: 'BE' })).toBe('nl');
    expect(clientLocale({ agentLanguage: 'en', country: 'FR' })).toBe('en');
  });

  it('n\'utilise le pays QUE faute de choix', () => {
    expect(clientLocale({ country: 'BE' })).toBe('fr');
    expect(clientLocale({ country: 'LU' })).toBe('fr');
    expect(clientLocale({ country: 'US' })).toBe('en');
    expect(clientLocale({})).toBe('en');
  });

  it('tolère une valeur sale sans changer de sens', () => {
    // Une casse ou un espace ne doit pas faire basculer toute une interface.
    expect(clientLocale({ agentLanguage: ' FR ' })).toBe('fr');
    expect(clientLocale({ agentLanguage: 'NL' })).toBe('nl');
    expect(clientLocale({ agentLanguage: 'xx', country: 'BE' })).toBe('fr');
    expect(clientLocale({ agentLanguage: null, country: null })).toBe('en');
  });
});

describe('emailLocale', () => {
  it('rétrécit EXPLICITEMENT aux deux gabarits qui existent', () => {
    /* Il n'y a pas de gabarit néerlandais. Un client flamand reçoit donc
       l'anglais, et c'est écrit ici plutôt que d'être une surprise: le jour où
       les gabarits existeront, une seule ligne change. */
    expect(emailLocale({ agentLanguage: 'nl' })).toBe('en');
    expect(emailLocale({ agentLanguage: 'fr' })).toBe('fr');
    expect(emailLocale({ agentLanguage: 'en' })).toBe('en');
  });

  it('suit le même repli que le reste', () => {
    expect(emailLocale({ country: 'BE' })).toBe('fr');
    expect(emailLocale({})).toBe('en');
  });
});

describe('signupAgentLanguage', () => {
  /* « La langue doit être auto en fonction de quelle langue [est] choisie sur
     le site à la création du compte » (12/09/2026). Avant, chaque chemin de
     création posait 'en' en dur. */
  it('prend la langue du site quand elle est connue', () => {
    expect(signupAgentLanguage({ siteLanguage: 'fr', country: 'US' })).toBe('fr');
    expect(signupAgentLanguage({ siteLanguage: 'en', country: 'BE' })).toBe('en');
    expect(signupAgentLanguage({ siteLanguage: 'nl', country: 'BE' })).toBe('nl');
  });

  it('retombe sur le pays quand le site n\'a rien dit', () => {
    expect(signupAgentLanguage({ siteLanguage: null, country: 'BE' })).toBe('fr');
    expect(signupAgentLanguage({ siteLanguage: undefined, country: 'US' })).toBe('en');
    expect(signupAgentLanguage({ siteLanguage: 'de', country: 'BE' })).toBe('fr');
  });
});
