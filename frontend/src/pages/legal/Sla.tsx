import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import Reveal from '../../components/ui/Reveal';

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

  const rows: Row[] = isFr
    ? [
        { label: 'Disponibilité mensuelle cible', starter: '99,0 %', pro: '99,5 %', enterprise: '99,9 %' },
        { label: 'Temps de réponse support', starter: '48 h ouvrées', pro: '12 h ouvrées', enterprise: '2 h, 24/7' },
        { label: 'Canal support', starter: 'Email', pro: 'Email + chat', enterprise: 'Email + chat + téléphone' },
        { label: 'Rapport d\'incident public', starter: 'Sur demande', pro: 'Sous 5 jours ouvrés', enterprise: 'Sous 24 h' },
        { label: 'Crédits de service en cas de manquement', starter: '—', pro: 'Oui, à partir de 99 %', enterprise: 'Oui, à partir de 99,5 %' },
        { label: 'Rétention des transcriptions', starter: '90 jours', pro: '365 jours', enterprise: 'Sur mesure' },
        { label: 'Chiffrement des données', starter: 'TLS 1.3 en transit, AES-256 au repos', pro: 'TLS 1.3 + AES-256', enterprise: 'TLS 1.3 + AES-256 + KMS dédié en option' },
      ]
    : [
        { label: 'Monthly uptime target', starter: '99.0 %', pro: '99.5 %', enterprise: '99.9 %' },
        { label: 'Support response time', starter: '48 business hours', pro: '12 business hours', enterprise: '2 hours, 24/7' },
        { label: 'Support channels', starter: 'Email', pro: 'Email + chat', enterprise: 'Email + chat + phone' },
        { label: 'Public incident post-mortem', starter: 'On request', pro: 'Within 5 business days', enterprise: 'Within 24 hours' },
        { label: 'Service credits on breach', starter: '—', pro: 'Yes, from 99 % downwards', enterprise: 'Yes, from 99.5 % downwards' },
        { label: 'Transcript retention', starter: '90 days', pro: '365 days', enterprise: 'Custom' },
        { label: 'Data encryption', starter: 'TLS 1.3 in transit, AES-256 at rest', pro: 'TLS 1.3 + AES-256', enterprise: 'TLS 1.3 + AES-256 + optional dedicated KMS' },
      ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main aria-labelledby="sla-heading" className="pt-32 md:pt-40 px-6">
        <div className="max-w-[860px] mx-auto">
          <Reveal y={14}>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full inline-block mb-4"
              style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}
            >
              {isFr ? 'Engagement' : 'Commitment'}
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1
              id="sla-heading"
              className="text-[clamp(2.2rem,5vw,3.6rem)] font-semibold tracking-[-0.03em] leading-[1.05]"
            >
              {isFr ? 'Engagement de niveau de service.' : 'Service Level Agreement.'}
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 text-lg text-[#525257] leading-relaxed max-w-[680px]">
              {isFr
                ? "Ce document décrit les engagements de disponibilité, de réponse au support et de gestion des incidents que Qwillio prend envers ses clients payants. Il complète les Conditions Générales de Service et s'applique dès le début de l'abonnement payant (le mois d'essai gratuit est fourni « tel quel »)."
                : 'This document describes the uptime, support response and incident commitments Qwillio makes to paying customers. It complements the Terms of Service and applies from the start of the paid subscription (the free trial month is provided as-is).'}
            </p>
          </Reveal>

          <Reveal>
            <section aria-labelledby="tiers-heading" className="mt-14">
              <h2 id="tiers-heading" className="text-2xl font-semibold tracking-[-0.02em] mb-6">
                {isFr ? 'Engagements par plan' : 'Commitments per plan'}
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-[#1d1d1f]/10 shadow-[0_1px_0_rgba(29,29,31,0.03)]">
                <table className="w-full text-[13.5px] border-collapse">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      <th scope="col" className="text-left px-4 py-3 font-semibold text-[#1d1d1f] border-b border-[#1d1d1f]/10">
                        {isFr ? 'Engagement' : 'Commitment'}
                      </th>
                      <th scope="col" className="text-left px-4 py-3 font-semibold text-[#1d1d1f] border-b border-[#1d1d1f]/10">Starter</th>
                      <th scope="col" className="text-left px-4 py-3 font-semibold text-[#6366f1] border-b border-[#1d1d1f]/10">Pro</th>
                      <th scope="col" className="text-left px-4 py-3 font-semibold text-[#1d1d1f] border-b border-[#1d1d1f]/10">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1d1d1f]/8">
                    {rows.map((r) => (
                      <tr key={r.label} className="hover:bg-[#fafaf8] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-[#1d1d1f] align-top">{r.label}</td>
                        <td className="px-4 py-2.5 text-[#424245] align-top">{r.starter}</td>
                        <td className="px-4 py-2.5 text-[#424245] align-top bg-[rgba(99,102,241,0.04)]">{r.pro}</td>
                        <td className="px-4 py-2.5 text-[#424245] align-top">{r.enterprise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[#6e6e73]">
                {isFr
                  ? "Solo (149 €/mois) suit les mêmes engagements que Starter. Enterprise permet des SLA sur-mesure au-delà du barème ci-dessus."
                  : 'Solo (€149/month) follows the same commitments as Starter. Enterprise supports custom SLAs beyond the table above.'}
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="uptime-heading" className="mt-14">
              <h2 id="uptime-heading" className="text-2xl font-semibold tracking-[-0.02em] mb-4">
                {isFr ? 'Comment la disponibilité est calculée' : 'How uptime is measured'}
              </h2>
              <p className="text-[16px] leading-relaxed text-[#424245] mb-4">
                {isFr
                  ? "La disponibilité mensuelle est mesurée sur les endpoints publics de la plateforme (webhooks entrants Vapi, API client, tableau de bord) via un service externe de monitoring. Sont exclus du calcul : les fenêtres de maintenance planifiée annoncées au moins 72 h à l'avance, les incidents provenant d'un fournisseur tiers en dehors du contrôle raisonnable de Qwillio (Vapi, OpenAI, Twilio, Stripe, Neon), et les incidents causés par une utilisation non conforme aux Conditions Générales."
                  : "Monthly uptime is measured on the platform's public endpoints (incoming Vapi webhooks, client API, dashboard) via an external monitoring service. Excluded from the calculation: scheduled maintenance windows announced at least 72 hours in advance, incidents caused by a third-party provider outside Qwillio's reasonable control (Vapi, OpenAI, Twilio, Stripe, Neon), and incidents caused by usage that violates the Terms of Service."}
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="credits-heading" className="mt-12">
              <h2 id="credits-heading" className="text-2xl font-semibold tracking-[-0.02em] mb-4">
                {isFr ? 'Crédits de service' : 'Service credits'}
              </h2>
              <p className="text-[16px] leading-relaxed text-[#424245] mb-4">
                {isFr
                  ? "Si la disponibilité mensuelle mesurée descend sous l'engagement de votre plan, un crédit est appliqué sur la facture du mois suivant selon le barème ci-dessous. Le crédit est plafonné au montant mensuel du plan concerné et doit être demandé dans les 30 jours suivant l'incident."
                  : "If measured monthly uptime drops below your plan's commitment, a credit is applied to the following month's invoice according to the schedule below. The credit is capped at that month's plan fee and must be requested within 30 days of the incident."}
              </p>
              <ul role="list" className="list-disc pl-6 space-y-2 text-[#424245]">
                <li>{isFr ? 'De 99 % à 99,49 % : crédit de 10 % du prix mensuel (Pro et supérieurs)' : '99 % to 99.49 %: 10 % monthly-fee credit (Pro and above)'}</li>
                <li>{isFr ? 'De 98 % à 98,99 % : crédit de 25 % du prix mensuel' : '98 % to 98.99 %: 25 % monthly-fee credit'}</li>
                <li>{isFr ? 'En dessous de 98 % : crédit de 50 % du prix mensuel' : 'Below 98 %: 50 % monthly-fee credit'}</li>
                <li>{isFr ? 'En dessous de 95 % : crédit de 100 % du prix mensuel' : 'Below 95 %: 100 % monthly-fee credit'}</li>
              </ul>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="support-heading" className="mt-12">
              <h2 id="support-heading" className="text-2xl font-semibold tracking-[-0.02em] mb-4">
                {isFr ? 'Temps de réponse support' : 'Support response times'}
              </h2>
              <p className="text-[16px] leading-relaxed text-[#424245]">
                {isFr
                  ? "Le temps de réponse est le délai entre la réception d'un ticket écrit valide et la première réponse humaine (pas un accusé de réception automatique). Les heures ouvrées sont 9 h – 18 h CET du lundi au vendredi, jours fériés belges exclus. Le plan Enterprise inclut un support 24/7 par téléphone avec un numéro dédié."
                  : "Response time is the interval between receipt of a valid written ticket and the first human response (not an automated acknowledgement). Business hours are 9 AM – 6 PM CET Monday through Friday, Belgian public holidays excluded. The Enterprise plan includes 24/7 phone support with a dedicated number."}
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="incidents-heading" className="mt-12">
              <h2 id="incidents-heading" className="text-2xl font-semibold tracking-[-0.02em] mb-4">
                {isFr ? 'Gestion des incidents' : 'Incident management'}
              </h2>
              <p className="text-[16px] leading-relaxed text-[#424245]">
                {isFr
                  ? "Chaque incident est classifié en trois niveaux : critique (interruption totale du service voix), majeur (fonction essentielle indisponible), mineur (fonction non critique dégradée). Les incidents critiques sont communiqués aux clients concernés dans l'heure via email et statut public. Un rapport post-mortem est fourni sous le délai indiqué dans le tableau du plan."
                  : 'Each incident is classified in three levels: critical (total voice service outage), major (essential function unavailable), minor (non-critical function degraded). Critical incidents are communicated to affected customers within one hour via email and public status. A post-mortem is provided within the delay listed in the plan table above.'}
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="contact-heading" className="mt-12 mb-24">
              <h2 id="contact-heading" className="text-2xl font-semibold tracking-[-0.02em] mb-4">
                {isFr ? 'Contact' : 'Contact'}
              </h2>
              <p className="text-[16px] leading-relaxed text-[#424245]">
                {isFr
                  ? 'Pour demander un crédit de service, signaler un incident, ou discuter d\'un SLA sur-mesure Enterprise : '
                  : 'To request a service credit, report an incident, or discuss a custom Enterprise SLA: '}
                <a href="mailto:sla@qwillio.com" className="text-[#6366f1] hover:underline">sla@qwillio.com</a>.
              </p>
            </section>
          </Reveal>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
