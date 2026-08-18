/**
 * Ce que le forfait ouvre, côté écran.
 *
 * ⚠️ Ceci n'est PAS le contrôle d'accès. Le contrôle vit sur le serveur
 * (`backend/src/middleware/plan.middleware.ts`, adossé à
 * `backend/src/config/plan-features.ts`), et lui seul compte: masquer une
 * entrée de menu n'empêche personne d'appeler l'API.
 *
 * Cette table sert uniquement à ne pas proposer une porte qui répondra 403.
 * Un client qui clique sur « Pipeline » et reçoit un refus a une mauvaise
 * expérience; un client qui ne voit pas l'entrée comprend qu'elle appartient à
 * un autre forfait, et la page Tarifs lui dit lequel.
 *
 * Si les deux tables divergent un jour, c'est le serveur qui a raison.
 */
export type PlanCapability = 'advancedAnalytics' | 'crm' | 'api';

const PLAN_CAPABILITIES: Record<PlanCapability, string[]> = {
  advancedAnalytics: ['pro', 'enterprise'],
  crm: ['pro', 'enterprise'],
  api: ['enterprise'],
};

/** Un forfait absent ou inconnu n'ouvre rien, comme côté serveur. */
export function planAllows(plan: string | null | undefined, capability: PlanCapability): boolean {
  return PLAN_CAPABILITIES[capability].includes((plan || '').toLowerCase());
}
