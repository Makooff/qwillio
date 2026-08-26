/**
 * À QUI appartient ce que je m'apprête à modifier.
 *
 * Dix routes de `agent.routes.ts` agissaient sur un enregistrement par son seul
 * identifiant: envoyer une facture, la marquer payée, décrémenter un stock,
 * envoyer un document à signer, le marquer signé. Aucune ne lisait `clientId`,
 * et aucun des services appelés ne le faisait non plus. N'importe quel client
 * authentifié pouvait donc agir sur les données d'un autre en connaissant un
 * identifiant.
 *
 * Le motif etait net: dans le meme fichier, TOUS les `GET` lisaient `clientId`,
 * et AUCUN `POST` par identifiant ne le faisait. Ce n'est pas un oubli isolé,
 * c'est une classe d'oubli, et un paramètre facultatif se serait fait oublier
 * de la même façon.
 *
 * D'où un paramètre OBLIGATOIRE, et un type qui n'a que deux habitants: soit un
 * identifiant de client, soit `ALL_TENANTS`, qu'on ne pose pas par distraction.
 * Le compilateur refuse alors tout appelant qui n'a pas tranché, y compris ceux
 * qu'on écrira plus tard.
 *
 * Ce n'est pas la sécurité au niveau des lignes (RLS Postgres), qui rendrait
 * l'isolation structurelle. C'est ce qui la rend VÉRIFIABLE en attendant.
 */

/**
 * L'administration, qui agit sur tous les clients à la fois.
 *
 * Ne doit jamais apparaître dans une route servie à un client. Un symbole
 * plutôt que `null`: on ne l'écrit pas sans le vouloir, et il se repère à la
 * relecture.
 */
export const ALL_TENANTS = Symbol('all-tenants');

export type TenantScope = string | typeof ALL_TENANTS;

/**
 * Le fragment de `where` correspondant à cette portée.
 *
 * `{}` pour l'administration, `{ clientId }` pour un client. Rendu comme un
 * fragment à étaler plutôt que comme un booléen à tester: un appelant ne peut
 * pas l'ignorer sans que la requête change de forme.
 */
export function tenantWhere(scope: TenantScope): { clientId?: string } {
  return scope === ALL_TENANTS ? {} : { clientId: scope };
}

/** Vrai quand la portée est celle d'un client précis. */
export function isTenantScoped(scope: TenantScope): scope is string {
  return scope !== ALL_TENANTS;
}
