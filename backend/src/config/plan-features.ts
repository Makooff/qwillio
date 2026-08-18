// Single source of truth for what each plan includes, shown in the client
// dashboard. Base plans deliberately carry the powerful, low-cost capabilities
// (bilingual AI, booking, urgency transfer, transcript+sentiment, spam shield);
// higher tiers add call volume plus the features that cost real money or human
// time (advanced analytics, CRM, API, SLA, a dedicated manager).
//
// Deux tables, un seul fichier, et c'est le point: les étiquettes VENDUES et les
// droits ACCORDÉS doivent sortir du même endroit, sinon la page tarifs et le
// code divergent — ce qui était exactement le cas jusqu'au 18/08/2026, où le
// seul contrôle de forfait de tout le backend portait sur l'API.
//
// PLAN_FEATURES ci-dessous reste la liste d'AFFICHAGE du portail. PLAN_CAPABILITIES
// plus bas est la liste qui AUTORISE. Toute ligne vendue comme réservée à un
// palier doit exister dans la seconde, ou disparaître de la première.

export type PlanId = 'solo' | 'starter' | 'pro' | 'enterprise';

const BASE: string[] = [
  'IA 24/7 bilingue FR / EN',
  'Prise de RDV + synchronisation agenda',
  'Transfert des urgences vers votre ligne',
  'Transcription + analyse de sentiment',
  'Bouclier anti-spam (non facturé)',
  'SMS de confirmation au client',
  'Email récapitulatif après chaque appel',
  'Tableau de bord complet',
];

const STARTER: string[] = [...BASE, 'Capture de leads', 'Support par email'];

const PRO: string[] = [
  ...STARTER,
  'Analytiques avancées',
  'Intégrations CRM natives',
  'Support prioritaire',
];

const ENTERPRISE: string[] = [
  ...PRO,
  'Multi-sites & numéros multiples',
  'Responsable dédié',
  'SLA 99,5% uptime',
  'Accès API complet',
];

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  solo: [...BASE],
  starter: STARTER,
  pro: PRO,
  enterprise: ENTERPRISE,
};

export function planFeatures(plan: string | null | undefined): string[] {
  const key = (plan || '').toLowerCase() as PlanId;
  return PLAN_FEATURES[key] ?? PLAN_FEATURES.starter;
}

/**
 * Ce qu'un forfait DONNE LE DROIT de faire.
 *
 * Ne contient que ce qui est réellement restreignable et réellement vendu comme
 * tel. Deux lignes de la page tarifs n'y figurent délibérément pas:
 *
 *  - la transcription et l'analyse de sentiment, parce qu'elles alimentent aussi
 *    le scoring de lead et le CRM interne: les couper en Solo dégraderait des
 *    fonctions vendues dans le socle ;
 *  - la langue de l'agent, qui est un réglage client (`agentLanguage`) et non
 *    une capacité.
 *
 * Elles ont donc été corrigées sur la page tarifs plutôt que bridées ici. Une
 * restriction artificielle coûte toujours plus qu'elle ne rapporte.
 */
export type PlanCapability = 'advancedAnalytics' | 'crm' | 'api';

const PLAN_CAPABILITIES: Record<PlanCapability, PlanId[]> = {
  advancedAnalytics: ['pro', 'enterprise'],
  crm: ['pro', 'enterprise'],
  api: ['enterprise'],
};

/** Le palier le plus bas qui ouvre la capacité, pour le dire à l'écran. */
export function lowestPlanFor(capability: PlanCapability): PlanId {
  return PLAN_CAPABILITIES[capability][0];
}

/**
 * Un forfait inconnu ou absent n'accorde RIEN.
 *
 * C'est l'inverse de `planFeatures`, qui retombe sur Starter pour avoir quelque
 * chose à afficher. Ici le défaut sûr est le refus: un `planType` vide en base
 * ne doit pas ouvrir une fonction facturée.
 */
export function planAllows(plan: string | null | undefined, capability: PlanCapability): boolean {
  const key = (plan || '').toLowerCase() as PlanId;
  return PLAN_CAPABILITIES[capability].includes(key);
}
