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
