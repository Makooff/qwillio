import { env } from '../config/env';

/**
 * Les adresses publiques que le backend écrit dans les emails.
 *
 * Deux pièges, tous deux constatés en production:
 *
 * 1. `FRONTEND_URL` est une LISTE séparée par des virgules (elle sert aussi
 *    d'allow-list CORS). Interpolée telle quelle, elle produit des liens du
 *    genre `https://a.com,https://b.com/portal`, morts au clic.
 * 2. Les liens pointaient vers `/client-portal/:id` et `/client-dashboard/:id`,
 *    qui n'existent dans aucune route du frontend. Les vraies adresses prennent
 *    l'identifiant et le jeton en paramètres de requête.
 *
 * Tout lien envoyé par email passe donc par ici, et non par une interpolation
 * à la main.
 */

/** La PREMIÈRE origine déclarée: la canonique, les suivantes sont des alias. */
export function frontendBaseUrl(): string {
  const first = (env.FRONTEND_URL || '').split(',')[0].trim();
  return (first || 'https://qwillio.com').replace(/\/+$/, '');
}

/** Portail client authentifié par jeton (`pages/ClientPortal.tsx`). */
export function clientPortalUrl(clientId: string, token: string | null | undefined): string {
  const base = frontendBaseUrl();
  // Sans jeton, le portail ne peut rien charger: mieux vaut la page de connexion
  // que trois écrans d'erreur.
  if (!token) return `${base}/login`;
  return `${base}/portal?id=${encodeURIComponent(clientId)}&token=${encodeURIComponent(token)}`;
}

/** Formulaire d'installation (`pages/Onboarding.tsx`), mêmes paramètres. */
export function onboardingFormUrl(clientId: string, token: string): string {
  return `${frontendBaseUrl()}/onboarding?id=${encodeURIComponent(clientId)}&token=${encodeURIComponent(token)}`;
}
