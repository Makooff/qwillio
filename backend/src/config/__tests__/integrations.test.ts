import { describe, it, expect } from 'vitest';
import {
  INTEGRATIONS,
  catalogueForBusinessType,
  findIntegration,
  isConnectable,
  NATIVE_SYNC_PROVIDERS,
  URL_SETUP_PROVIDERS,
} from '../integrations';

/**
 * Le catalogue existe pour empêcher une panne précise: afficher « connecté »
 * sur une intégration que la synchro ignore. Ces tests portent sur cette
 * promesse, pas sur la liste des logos, qui a vocation à grandir.
 */

describe('honnêteté du catalogue', () => {
  it('ne déclare `native` que ce que la synchro sait réellement traiter', () => {
    /* C'est LE test qui compte. `crm-sync.service.ts` termine sur
       `default: no sync handler, skipping`: tout fournisseur annoncé natif sans
       gestionnaire serait un « connecté » qui ne synchronise rien, et le client
       ne s'en apercevrait qu'en cherchant ses leads chez lui. */
    const natifs = INTEGRATIONS.filter(i => i.transport === 'native');
    const traites = new Set<string>([...NATIVE_SYNC_PROVIDERS, 'google-calendar']);

    for (const entry of natifs) {
      expect(traites.has(entry.id), `${entry.id} annoncé natif sans gestionnaire`).toBe(true);
    }
  });

  it('refuse de connecter ce qui n\'est pas encore construit', () => {
    // « Bientôt » est honnête. « Connecté » sur du vide ne l'est pas.
    const planifie = INTEGRATIONS.find(i => i.transport === 'planned')!;
    expect(isConnectable(planifie.id)).toBe(false);
    expect(isConnectable('hubspot')).toBe(true);
    // Un fournisseur inventé n'existe pas davantage.
    expect(isConnectable('salesforce-crm-pro-2000')).toBe(false);
    expect(findIntegration('salesforce-crm-pro-2000')).toBeNull();
  });

  it('branche chaque relais sous SON nom, pas sous « webhook »', () => {
    /* La clé est `(clientId, provider)`. Ranger Pipedrive et Notion sous
       `webhook` n'en aurait laissé brancher qu'un par client, le second
       écrasant le premier en silence. C'est `crm-sync` qui les aiguille, en
       consultant ce catalogue. */
    const relais = INTEGRATIONS.filter(i => i.transport === 'relay');
    expect(relais.length).toBeGreaterThan(1);
    for (const entry of relais) {
      expect((URL_SETUP_PROVIDERS as readonly string[]).includes(entry.id)).toBe(false);
      expect(entry.setup).toBe('url');
    }
  });

  it('accepte les relais: ils marchent aujourd\'hui, sans code de notre part', () => {
    /* Un relais est le MÊME mécanisme que le webhook générique, sous un autre
       nom commercial. Le refuser priverait le client de dizaines d'outils
       atteignables ce soir. */
    const relais = INTEGRATIONS.find(i => i.transport === 'relay')!;
    expect(isConnectable(relais.id)).toBe(true);
    expect(relais.setup).toBe('url');
  });

  it('ne fait jamais passer une lecture pendant l\'appel par un relais', () => {
    /* Un aller-retour Zapier coûte plusieurs secondes: l'appelant entendrait un
       blanc, puis raccrocherait. Ce qu'on veut lire pendant l'appel se code
       nativement, ou pas du tout. */
    for (const entry of INTEGRATIONS) {
      if (entry.verbs.includes('read_live')) {
        expect(entry.transport, `${entry.id} lit en direct via un relais`).not.toBe('relay');
      }
    }
  });

  it('dit un bénéfice, pas une catégorie', () => {
    // « Synchroniser vos contacts CRM » ne décide personne, et c'est exactement
    // ce que la vitrine concurrente écrit sous chacun de ses logos.
    for (const entry of INTEGRATIONS) {
      expect(entry.benefit.length).toBeGreaterThan(30);
      expect(entry.benefit).toMatch(/[.!]$/);
    }
  });

  it('n\'a pas deux fois le même identifiant', () => {
    const ids = INTEGRATIONS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('le catalogue vu par un métier', () => {
  it('ne montre à un garagiste que ce qui le concerne', () => {
    const garage = catalogueForBusinessType('garage automobile').map(i => i.id);
    expect(garage).not.toContain('doctolib');
    expect(garage).not.toContain('planity');
    expect(garage).not.toContain('apimo');
    // Et il garde tout ce qui vaut pour tout le monde.
    expect(garage).toContain('google-calendar');
    expect(garage).toContain('make');
  });

  it('donne à une agence immobilière ses outils métier', () => {
    const immo = catalogueForBusinessType('agence immobilière').map(i => i.id);
    expect(immo).toContain('apimo');
    expect(immo).toContain('hektor');
    expect(immo).not.toContain('zenchef');
  });

  it('montre ce qui MARCHE avant ce qui est promis', () => {
    /* Un client qui scrolle jusqu'à une promesse avant d'avoir vu ce qu'il peut
       brancher ce soir repart avec l'impression d'une vitrine. */
    const ordre = catalogueForBusinessType('restaurant').map(i => i.transport);
    const premierPlanifie = ordre.indexOf('planned');
    const dernierNatif = ordre.lastIndexOf('native');
    expect(dernierNatif).toBeLessThan(premierPlanifie);
  });

  it('sert un métier inconnu sans le priver de rien de générique', () => {
    // `default` est une valeur de plein droit: la plupart des clients ne
    // rentrent dans aucune case.
    const autre = catalogueForBusinessType('brocante et antiquités');
    expect(autre.length).toBeGreaterThan(5);
    expect(autre.every(i => !i.niches)).toBe(true);
  });

  it('traite un métier absent comme un métier inconnu, sans lever', () => {
    expect(() => catalogueForBusinessType(null)).not.toThrow();
    expect(catalogueForBusinessType(undefined).length).toBeGreaterThan(0);
  });
});
