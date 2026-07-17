// Single source of truth for what each plan includes, shown in the client
// dashboard. Base plans deliberately carry the powerful, low-cost capabilities
// (bilingual AI, booking, urgency transfer, transcript+sentiment, spam shield);
// higher tiers add call volume plus the features that cost real money or human
// time (advanced analytics, CRM, API, SLA, a dedicated manager).
//
// Note: these are packaging labels for display. The base capabilities already
// run for every client in code — nothing here restricts them.

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
