import { useMemo } from 'react';
import { useSEO } from '../../../hooks/useSEO';
import { useLang } from '../../../stores/langStore';
import { SerifWord } from '../../../components/v2/Primitives';
import LegalShell, {
  LEGAL_LINK,
  LegalList,
  LegalP,
  LegalSection,
  LegalTable,
  type LegalSectionRef,
} from '../../../components/v2/LegalShell';

/* SLA V2 « Papier & Signal ».
   Seul SLA du site (la copie V1 a été supprimée le 16/08/2026).
   Le tableau des engagements reste une table sémantique: e2e/marketing.spec.ts
   vérifie les columnheaders Starter, Pro, Enterprise. */

interface Row {
  label: string;
  starter: string;
  pro: string;
  enterprise: string;
}

export default function Sla() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr ? 'Engagement de niveau de service (SLA)' : 'Service Level Agreement (SLA)',
    description: isFr
      ? "Ce à quoi Qwillio s'engage contractuellement, et ce qu'il vise sans le garantir, plan par plan."
      : 'What Qwillio commits to contractually, and what it aims for without guaranteeing it, plan by plan.',
    canonical: 'https://qwillio.com/sla',
  });

  const sections: LegalSectionRef[] = useMemo(
    () => [
      { id: 'tiers', label: isFr ? 'Engagements par plan' : 'Commitments per plan' },
      { id: 'uptime', label: isFr ? 'Calcul de la disponibilité' : 'How uptime is measured' },
      { id: 'credits', label: isFr ? 'Crédits de service' : 'Service credits' },
      { id: 'support', label: isFr ? 'Temps de réponse support' : 'Support response times' },
      { id: 'incidents', label: isFr ? 'Gestion des incidents' : 'Incident management' },
      { id: 'contact', label: isFr ? 'Contact' : 'Contact' },
    ],
    [isFr],
  );

  /* Ce tableau promettait 99,0 % dès Starter, des crédits de service dès Pro,
     un support téléphonique 24/7 et des post-mortems publics sous 24 h. Une
     instance unique sans astreinte ni monitoring externe n'en tient aucun, et
     un crédit de service dû est de l'argent réel. Seul Enterprise porte
     désormais un engagement chiffré, parce qu'il est contractuel et négocié.

     La ligne « rétention des transcriptions » était fausse d'une autre façon:
     elle l'annonçait par palier alors que CHAQUE client la règle entre 30 jours
     et 5 ans dans ses paramètres (`Client.retentionDays`). Même défaut que
     celui déjà corrigé dans la politique de confidentialité. */
  const rows: Row[] = isFr
    ? [
        { label: 'Disponibilité', starter: 'Au mieux', pro: 'Au mieux', enterprise: '99,5 % contractuels' },
        { label: 'Temps de réponse support (indicatif)', starter: '48 h ouvrées', pro: '24 h ouvrées', enterprise: 'Négocié au contrat' },
        { label: 'Canal support', starter: 'Email', pro: 'Email prioritaire', enterprise: 'Email + responsable dédié' },
        { label: 'Information en cas d\'incident majeur', starter: 'Email', pro: 'Email', enterprise: 'Email + post-mortem écrit' },
        { label: 'Crédits de service', starter: '–', pro: '–', enterprise: 'Prévus au contrat' },
        { label: 'Rétention des transcriptions', starter: 'Réglable 30 j à 5 ans', pro: 'Réglable 30 j à 5 ans', enterprise: 'Réglable 30 j à 5 ans' },
        { label: 'Chiffrement des données', starter: 'TLS 1.3 en transit, AES-256 au repos', pro: 'TLS 1.3 + AES-256', enterprise: 'TLS 1.3 + AES-256' },
      ]
    : [
        { label: 'Availability', starter: 'Best effort', pro: 'Best effort', enterprise: '99.5 % contractual' },
        { label: 'Support response time (indicative)', starter: '48 business hours', pro: '24 business hours', enterprise: 'Agreed by contract' },
        { label: 'Support channels', starter: 'Email', pro: 'Priority email', enterprise: 'Email + dedicated manager' },
        { label: 'Notification on major incident', starter: 'Email', pro: 'Email', enterprise: 'Email + written post-mortem' },
        { label: 'Service credits', starter: '–', pro: '–', enterprise: 'Set out in the contract' },
        { label: 'Transcript retention', starter: 'Adjustable, 30 days to 5 years', pro: 'Adjustable, 30 days to 5 years', enterprise: 'Adjustable, 30 days to 5 years' },
        { label: 'Data encryption', starter: 'TLS 1.3 in transit, AES-256 at rest', pro: 'TLS 1.3 + AES-256', enterprise: 'TLS 1.3 + AES-256' },
      ];

  return (
    <LegalShell
      eyebrow={isFr ? 'Engagement' : 'Commitment'}
      title={
        isFr ? (
          <>
            Engagement de niveau de <SerifWord>service.</SerifWord>
          </>
        ) : (
          <>
            Service Level <SerifWord>Agreement.</SerifWord>
          </>
        )
      }
      lead={
        isFr
          ? "Ce document décrit le niveau de service que Qwillio vise, et ce à quoi Qwillio s'engage contractuellement. Les deux ne se confondent pas: seul le plan Enterprise porte un engagement chiffré, assorti de crédits de service définis au contrat. Sur les autres plans, le service est fourni au mieux, sans garantie de disponibilité. Nous préférons le dire ici plutôt que de promettre un pourcentage que nous ne pourrions pas tenir."
          : 'This document describes the service level Qwillio aims for, and what Qwillio contractually commits to. They are not the same: only the Enterprise plan carries a numeric commitment, with service credits defined in the contract. On other plans the service is provided on a best-effort basis, with no availability guarantee. We would rather say so here than promise a percentage we could not honour.'
      }
      sections={sections}
    >
      <LegalSection id="tiers" title={isFr ? 'Engagements par plan' : 'Commitments per plan'}>
        <LegalTable
          caption={isFr ? 'Engagements par plan' : 'Commitments per plan'}
          head={[isFr ? 'Engagement' : 'Commitment', 'Starter', 'Pro', 'Enterprise']}
          rows={rows.map((r) => [r.label, r.starter, r.pro, r.enterprise])}
        />
        <p className="mt-4 text-[13px] text-q2-body">
          {isFr
            ? "Solo (99 €/mois) suit les mêmes conditions que Starter. Un engagement de disponibilité chiffré se négocie avec le plan Enterprise, et figure alors au contrat."
            : 'Solo (€99/month) follows the same conditions as Starter. A numeric availability commitment is negotiated with the Enterprise plan and then set out in the contract.'}
        </p>
      </LegalSection>

      <LegalSection
        id="uptime"
        title={isFr ? 'Comment la disponibilité est calculée' : 'How uptime is measured'}
      >
        <LegalP>
          {isFr
            ? "Pour un client Enterprise, la disponibilité mensuelle est mesurée sur les endpoints publics de la plateforme (webhooks entrants Vapi, API client, tableau de bord), selon les modalités fixées au contrat. Sont exclus du calcul : les fenêtres de maintenance planifiée annoncées au moins 72 h à l'avance, les incidents provenant d'un fournisseur tiers en dehors du contrôle raisonnable de Qwillio (Vapi, OpenAI, Twilio, Stripe, Neon), et les incidents causés par une utilisation non conforme aux Conditions Générales. Sur les autres plans, aucune disponibilité n'est garantie et aucun calcul n'est opposable."
            : "For an Enterprise customer, monthly uptime is measured on the platform's public endpoints (incoming Vapi webhooks, client API, dashboard), on the terms set out in the contract. Excluded from the calculation: scheduled maintenance windows announced at least 72 hours in advance, incidents caused by a third-party provider outside Qwillio's reasonable control (Vapi, OpenAI, Twilio, Stripe, Neon), and incidents caused by usage that violates the Terms of Service. On other plans no availability is guaranteed and no calculation is enforceable."}
        </LegalP>
      </LegalSection>

      <LegalSection id="credits" title={isFr ? 'Crédits de service' : 'Service credits'}>
        <LegalP className="mb-6">
          {isFr
            ? "Les crédits de service existent uniquement dans le cadre d'un contrat Enterprise, où leur barème et leur plafond sont négociés puis écrits noir sur blanc. Aucun crédit automatique n'est prévu sur les plans Solo, Starter et Pro, puisque aucun engagement chiffré n'y est pris. Un incident reste bien sûr traité, et une compensation commerciale reste possible au cas par cas."
            : 'Service credits exist only under an Enterprise contract, where their schedule and cap are negotiated and written down. No automatic credit applies to the Solo, Starter and Pro plans, since no numeric commitment is made there. An incident is of course still handled, and a commercial gesture remains possible case by case.'}
        </LegalP>
      </LegalSection>

      <LegalSection
        id="support"
        title={isFr ? 'Temps de réponse support' : 'Support response times'}
      >
        <LegalP>
          {isFr
            ? "Le temps de réponse est le délai entre la réception d'un ticket écrit valide et la première réponse humaine (pas un accusé de réception automatique). Les heures ouvrées sont 9 h – 18 h CET du lundi au vendredi, jours fériés belges exclus. Les délais du tableau sont des objectifs indicatifs, pas des engagements contractuels, sauf mention contraire dans un contrat Enterprise."
            : 'Response time is the interval between receipt of a valid written ticket and the first human response (not an automated acknowledgement). Business hours are 9 AM to 6 PM CET Monday through Friday, Belgian public holidays excluded. The times in the table are indicative targets, not contractual commitments, unless an Enterprise contract states otherwise.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="incidents" title={isFr ? 'Gestion des incidents' : 'Incident management'}>
        <LegalP>
          {isFr
            ? "Chaque incident est classifié en trois niveaux : critique (interruption totale du service voix), majeur (fonction essentielle indisponible), mineur (fonction non critique dégradée). Les incidents critiques et majeurs sont communiqués par email aux clients concernés, dès que la cause est comprise. Un rapport écrit est fourni aux clients Enterprise, dans le délai prévu à leur contrat."
            : 'Each incident is classified in three levels: critical (total voice service outage), major (essential function unavailable), minor (non-critical function degraded). Critical and major incidents are communicated by email to affected customers as soon as the cause is understood. A written report is provided to Enterprise customers, within the delay set out in their contract.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="contact" title={isFr ? 'Contact' : 'Contact'} last>
        <LegalP>
          {isFr
            ? "Pour signaler un incident ou discuter d'un engagement de service Enterprise : "
            : 'To report an incident or discuss an Enterprise service commitment: '}
          <a href="mailto:sla@qwillio.com" className={LEGAL_LINK}>
            sla@qwillio.com
          </a>
          .
        </LegalP>
      </LegalSection>
    </LegalShell>
  );
}
