import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { ALL_TENANTS, tenantWhere, isTenantScoped } from '../services/tenant-scope';

/**
 * Dix routes agissaient sur un enregistrement par son seul identifiant, sans
 * jamais lire `clientId`: envoyer une facture, la marquer payée, décrémenter un
 * stock. N'importe quel client pouvait agir sur les données d'un autre.
 */

describe('la portée décide du WHERE', () => {
  it("cloisonne quand la portée est un client", () => {
    expect(tenantWhere('client_1')).toEqual({ clientId: 'client_1' });
  });

  it("ne cloisonne rien pour l'administration, et seulement pour elle", () => {
    expect(tenantWhere(ALL_TENANTS)).toEqual({});
  });

  it("distingue les deux sans se tromper", () => {
    expect(isTenantScoped('client_1')).toBe(true);
    expect(isTenantScoped(ALL_TENANTS)).toBe(false);
  });

  it("ne peut pas être obtenu par distraction", () => {
    /* Un symbole et non `null` ou `''`: une chaîne vide ou un `undefined` qui
       traînerait ne doit JAMAIS ouvrir l'accès à tous les clients. */
    expect(tenantWhere('')).toEqual({ clientId: '' });
    expect(tenantWhere('undefined')).toEqual({ clientId: 'undefined' });
    expect(ALL_TENANTS).not.toBe(Symbol('all-tenants'));
  });
});

/**
 * La portée doit vivre DANS l'écriture, pas à côté.
 *
 * L'isolation entre clients est entièrement applicative: pas de RLS Postgres,
 * une clause `clientId` posée à la main dans chaque WHERE. Une écriture qui
 * cible un enregistrement par son seul identifiant est donc correcte tant
 * qu'une vérification la précède — et fausse dès que quelqu'un réordonne le
 * code, change une sortie anticipée, ou copie la ligne vers une route sans
 * garde. C'est ainsi que sont nées les dix routes qui agissaient sur les
 * données d'un autre client.
 *
 * Ce test lit le SOURCE plutôt que d'exécuter quoi que ce soit: le défaut
 * qu'il cherche est une forme d'écriture, et il n'apparaît à l'exécution que
 * le jour où quelqu'un s'en sert.
 */
describe('les écritures du portail client portent leur portée', () => {
  const CONTROLLER = join(__dirname, '..', 'controllers', 'client-dashboard.controller.ts');
  const source = readFileSync(CONTROLLER, 'utf8');

  /** Les appels d'écriture Prisma, avec le bloc `where` qui suit. */
  function writes(): Array<{ model: string; op: string; where: string }> {
    const out: Array<{ model: string; op: string; where: string }> = [];
    const re = /prisma\.(\w+)\.(update|delete|updateMany|deleteMany)\(\{\s*where:\s*(\{[^}]*\})/g;
    for (const m of source.matchAll(re)) {
      out.push({ model: m[1], op: m[2], where: m[3] });
    }
    return out;
  }

  it('trouve bien les écritures, sinon ce test ne prouve rien', () => {
    // Un motif qui ne matche plus rien passerait au vert en ne regardant rien.
    expect(writes().length).toBeGreaterThan(0);
  });

  /**
   * Deux règles, parce qu'il y a deux formes de portée et une seule est un
   * `clientId`.
   *
   * `client` et `user` sont des RACINES de locataire: leur `id` est la portée,
   * il n'y a rien de plus à cloisonner. Leur exiger un `clientId` n'aurait pas
   * de sens, et la première version de ce test le faisait — elle a signalé
   * cinq écritures parfaitement correctes.
   *
   * Ce qui compte sur une racine, c'est D'OÙ vient l'identifiant. Depuis le
   * jeton d'authentification (`req.userId`, `req.clientId`), il est prouvé.
   * Depuis la requête (`req.params`, `req.body`, `req.query`), il est CHOISI
   * par l'appelant, et une écriture sur une racine ainsi désignée laisserait
   * agir sur le compte de n'importe qui.
   */
  const TENANT_ROOTS = new Set(['client', 'user']);
  const FROM_REQUEST = /req\.(params|body|query)/;

  it('les tables ordinaires portent toujours un clientId', () => {
    const unscoped = writes().filter(w => !TENANT_ROOTS.has(w.model) && !w.where.includes('clientId'));
    expect(unscoped).toEqual([]);
  });

  it('une racine n\'est jamais désignée par ce que l\'appelant a envoyé', () => {
    const chosen = writes().filter(w => TENANT_ROOTS.has(w.model) && FROM_REQUEST.test(w.where));
    expect(chosen).toEqual([]);
  });
});
