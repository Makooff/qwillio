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
   Contenu FR/EN porté à l'identique depuis pages/legal/Sla.tsx.
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
      ? "Engagement de disponibilité, de réponse au support et de résolution des incidents pour l'ensemble des plans Qwillio."
      : 'Uptime, support response and incident resolution commitments across all Qwillio plans.',
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

  const rows: Row[] = isFr
    ? [
        { label: 'Disponibilité mensuelle cible', starter: '99,0 %', pro: '99,5 %', enterprise: '99,9 %' },
        { label: 'Temps de réponse support', starter: '48 h ouvrées', pro: '12 h ouvrées', enterprise: '2 h, 24/7' },
        { label: 'Canal support', starter: 'Email', pro: 'Email + chat', enterprise: 'Email + chat + téléphone' },
        { label: 'Rapport d\'incident public', starter: 'Sur demande', pro: 'Sous 5 jours ouvrés', enterprise: 'Sous 24 h' },
        { label: 'Crédits de service en cas de manquement', starter: '–', pro: 'Oui, à partir de 99 %', enterprise: 'Oui, à partir de 99,5 %' },
        { label: 'Rétention des transcriptions', starter: '90 jours', pro: '365 jours', enterprise: 'Sur mesure' },
        { label: 'Chiffrement des données', starter: 'TLS 1.3 en transit, AES-256 au repos', pro: 'TLS 1.3 + AES-256', enterprise: 'TLS 1.3 + AES-256 + KMS dédié en option' },
      ]
    : [
        { label: 'Monthly uptime target', starter: '99.0 %', pro: '99.5 %', enterprise: '99.9 %' },
        { label: 'Support response time', starter: '48 business hours', pro: '12 business hours', enterprise: '2 hours, 24/7' },
        { label: 'Support channels', starter: 'Email', pro: 'Email + chat', enterprise: 'Email + chat + phone' },
        { label: 'Public incident post-mortem', starter: 'On request', pro: 'Within 5 business days', enterprise: 'Within 24 hours' },
        { label: 'Service credits on breach', starter: '–', pro: 'Yes, from 99 % downwards', enterprise: 'Yes, from 99.5 % downwards' },
        { label: 'Transcript retention', starter: '90 days', pro: '365 days', enterprise: 'Custom' },
        { label: 'Data encryption', starter: 'TLS 1.3 in transit, AES-256 at rest', pro: 'TLS 1.3 + AES-256', enterprise: 'TLS 1.3 + AES-256 + optional dedicated KMS' },
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
          ? "Ce document décrit les engagements de disponibilité, de réponse au support et de gestion des incidents que Qwillio prend envers ses clients payants. Il complète les Conditions Générales de Service et s'applique dès le début de l'abonnement payant (la période d'essai gratuite est fournie « tel quel »)."
          : 'This document describes the uptime, support response and incident commitments Qwillio makes to paying customers. It complements the Terms of Service and applies from the start of the paid subscription (the free trial period is provided as-is).'
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
            ? "Solo (99 €/mois) suit les mêmes engagements que Starter. Enterprise permet des SLA sur-mesure au-delà du barème ci-dessus."
            : 'Solo (€99/month) follows the same commitments as Starter. Enterprise supports custom SLAs beyond the table above.'}
        </p>
      </LegalSection>

      <LegalSection
        id="uptime"
        title={isFr ? 'Comment la disponibilité est calculée' : 'How uptime is measured'}
      >
        <LegalP>
          {isFr
            ? "La disponibilité mensuelle est mesurée sur les endpoints publics de la plateforme (webhooks entrants Vapi, API client, tableau de bord) via un service externe de monitoring. Sont exclus du calcul : les fenêtres de maintenance planifiée annoncées au moins 72 h à l'avance, les incidents provenant d'un fournisseur tiers en dehors du contrôle raisonnable de Qwillio (Vapi, OpenAI, Twilio, Stripe, Neon), et les incidents causés par une utilisation non conforme aux Conditions Générales."
            : "Monthly uptime is measured on the platform's public endpoints (incoming Vapi webhooks, client API, dashboard) via an external monitoring service. Excluded from the calculation: scheduled maintenance windows announced at least 72 hours in advance, incidents caused by a third-party provider outside Qwillio's reasonable control (Vapi, OpenAI, Twilio, Stripe, Neon), and incidents caused by usage that violates the Terms of Service."}
        </LegalP>
      </LegalSection>

      <LegalSection id="credits" title={isFr ? 'Crédits de service' : 'Service credits'}>
        <LegalP className="mb-6">
          {isFr
            ? "Si la disponibilité mensuelle mesurée descend sous l'engagement de votre plan, un crédit est appliqué sur la facture du mois suivant selon le barème ci-dessous. Le crédit est plafonné au montant mensuel du plan concerné et doit être demandé dans les 30 jours suivant l'incident."
            : "If measured monthly uptime drops below your plan's commitment, a credit is applied to the following month's invoice according to the schedule below. The credit is capped at that month's plan fee and must be requested within 30 days of the incident."}
        </LegalP>
        <LegalList
          items={
            isFr
              ? [
                  'De 99 % à 99,49 % : crédit de 10 % du prix mensuel (Pro et supérieurs)',
                  'De 98 % à 98,99 % : crédit de 25 % du prix mensuel',
                  'En dessous de 98 % : crédit de 50 % du prix mensuel',
                  'En dessous de 95 % : crédit de 100 % du prix mensuel',
                ]
              : [
                  '99 % to 99.49 %: 10 % monthly-fee credit (Pro and above)',
                  '98 % to 98.99 %: 25 % monthly-fee credit',
                  'Below 98 %: 50 % monthly-fee credit',
                  'Below 95 %: 100 % monthly-fee credit',
                ]
          }
        />
      </LegalSection>

      <LegalSection
        id="support"
        title={isFr ? 'Temps de réponse support' : 'Support response times'}
      >
        <LegalP>
          {isFr
            ? "Le temps de réponse est le délai entre la réception d'un ticket écrit valide et la première réponse humaine (pas un accusé de réception automatique). Les heures ouvrées sont 9 h – 18 h CET du lundi au vendredi, jours fériés belges exclus. Le plan Enterprise inclut un support 24/7 par téléphone avec un numéro dédié."
            : "Response time is the interval between receipt of a valid written ticket and the first human response (not an automated acknowledgement). Business hours are 9 AM – 6 PM CET Monday through Friday, Belgian public holidays excluded. The Enterprise plan includes 24/7 phone support with a dedicated number."}
        </LegalP>
      </LegalSection>

      <LegalSection id="incidents" title={isFr ? 'Gestion des incidents' : 'Incident management'}>
        <LegalP>
          {isFr
            ? "Chaque incident est classifié en trois niveaux : critique (interruption totale du service voix), majeur (fonction essentielle indisponible), mineur (fonction non critique dégradée). Les incidents critiques sont communiqués aux clients concernés dans l'heure via email et statut public. Un rapport post-mortem est fourni sous le délai indiqué dans le tableau du plan."
            : 'Each incident is classified in three levels: critical (total voice service outage), major (essential function unavailable), minor (non-critical function degraded). Critical incidents are communicated to affected customers within one hour via email and public status. A post-mortem is provided within the delay listed in the plan table above.'}
        </LegalP>
      </LegalSection>

      <LegalSection id="contact" title={isFr ? 'Contact' : 'Contact'} last>
        <LegalP>
          {isFr
            ? "Pour demander un crédit de service, signaler un incident, ou discuter d'un SLA sur-mesure Enterprise : "
            : 'To request a service credit, report an incident, or discuss a custom Enterprise SLA: '}
          <a href="mailto:sla@qwillio.com" className={LEGAL_LINK}>
            sla@qwillio.com
          </a>
          .
        </LegalP>
      </LegalSection>
    </LegalShell>
  );
}
