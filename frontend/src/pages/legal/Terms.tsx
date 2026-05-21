import { useState, useEffect, useMemo } from 'react';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';

interface Section {
  id: string;
  label: string;
}

export default function Terms() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [activeId, setActiveId] = useState<string>('acceptance');

  useSEO({
    title: 'Terms of Service',
    description:
      'Qwillio terms of service: usage terms for the AI receptionist and business automation platform.',
    canonical: 'https://qwillio.com/terms',
    noindex: true,
  });

  const sections: Section[] = useMemo(
    () => [
      { id: 'acceptance', label: isFr ? '1. Acceptation' : '1. Acceptance' },
      { id: 'free-trial', label: isFr ? '2. Essai gratuit' : '2. Free Trial' },
      { id: 'pricing', label: isFr ? '3. Tarification' : '3. Pricing' },
      { id: 'billing', label: isFr ? '4. Facturation' : '4. Billing' },
      { id: 'cancellation', label: isFr ? '5. Annulation' : '5. Cancellation' },
      { id: 'ai-disclosure', label: isFr ? '6. Divulgation IA' : '6. AI Disclosure' },
      {
        id: 'acceptable-use',
        label: isFr ? '7. Utilisation acceptable' : '7. Acceptable Use',
      },
      {
        id: 'liability',
        label: isFr ? '8. Limitation de responsabilité' : '8. Limitation of Liability',
      },
      { id: 'governing-law', label: isFr ? '9. Droit applicable' : '9. Governing Law' },
      { id: 'changes', label: isFr ? '10. Modifications' : '10. Changes' },
      { id: 'contact', label: isFr ? '11. Contact' : '11. Contact' },
    ],
    [isFr],
  );

  // Scroll-spy: track the active TOC section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 },
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      const offset = 100;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <a
        href="#legal-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-[#1d1d1f] focus:text-white focus:text-sm focus:font-medium focus:px-4 focus:py-2 focus:rounded-full focus:shadow-lg"
      >
        {isFr ? 'Aller au contenu' : 'Skip to content'}
      </a>

      <PublicNavbar />

      <main className="pt-28 md:pt-32 pb-24 px-6 print:pt-0">
        <div className="max-w-[1240px] mx-auto">
          {/* ── Editorial heading ─────────────────────────────────────── */}
          <header className="mb-14 md:mb-20 max-w-[860px]">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#6366f1] mb-6">
              {isFr ? 'Document juridique' : 'Legal document'}
            </p>
            <h1 className="text-[clamp(2.4rem,6vw,5rem)] font-semibold tracking-[-0.035em] leading-[0.98] mb-6">
              {isFr ? (
                <>
                  Conditions{' '}
                  <span className="font-serif italic text-[#6366f1]">générales</span>{' '}
                  d'utilisation.
                </>
              ) : (
                <>
                  Terms of <span className="font-serif italic text-[#6366f1]">service.</span>
                </>
              )}
            </h1>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm text-[#525257] border-t border-[#1d1d1f]/10 pt-5">
              <span className="font-serif italic text-[#86868b]">
                {isFr ? 'Dernière mise à jour' : 'Last updated'}
              </span>
              <time className="font-medium text-[#1d1d1f]" dateTime="2026-03-01">
                {isFr ? '1er mars 2026' : 'March 1, 2026'}
              </time>
              <span className="text-[#86868b]">·</span>
              <span className="text-[#86868b]">
                {isFr ? 'Lecture : 6 min' : '6 min read'}
              </span>
            </div>
          </header>

          {/* ── Asymmetric layout ─────────────────────────────────────── */}
          <div className="grid lg:grid-cols-[260px_1fr] gap-12 lg:gap-20">
            {/* Sticky TOC */}
            <aside
              aria-label={isFr ? 'Table des matières' : 'Table of contents'}
              className="lg:sticky lg:top-28 lg:self-start print:hidden"
            >
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#86868b] mb-4">
                {isFr ? 'Sommaire' : 'Contents'}
              </p>
              <nav aria-label={isFr ? 'Navigation des sections' : 'Section navigation'}>
                <ol className="space-y-1 border-l border-[#1d1d1f]/10" role="list">
                  {sections.map((section) => {
                    const isActive = activeId === section.id;
                    return (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          onClick={(event) => handleAnchorClick(event, section.id)}
                          className={`block pl-4 -ml-px py-1.5 text-[13px] leading-snug border-l transition-colors ${
                            isActive
                              ? 'border-[#6366f1] text-[#6366f1] font-medium'
                              : 'border-transparent text-[#525257] hover:text-[#1d1d1f]'
                          }`}
                          aria-current={isActive ? 'true' : undefined}
                        >
                          {section.label}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </aside>

            {/* Scrollable content */}
            <article
              id="legal-content"
              className="max-w-[65ch] text-[17px] leading-[1.75] text-[#1d1d1f] print:max-w-none"
            >
              {/* FTC required disclosure */}
              <aside
                role="note"
                aria-label={isFr ? 'Renouvellement automatique' : 'Automatic renewal notice'}
                className="not-prose mb-14 border-l-2 border-amber-500 bg-amber-50/60 pl-5 pr-5 py-5 rounded-r-md"
              >
                <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-amber-800 mb-2">
                  {isFr ? 'Important' : 'Important'}
                </p>
                <p className="text-[15px] leading-[1.65] text-amber-950">
                  <strong className="font-semibold">
                    {isFr ? 'Renouvellement automatique. ' : 'Automatic renewal. '}
                  </strong>
                  {isFr
                    ? "Votre abonnement Qwillio se renouvelle automatiquement à la fin de chaque période de facturation au tarif en vigueur, sauf annulation avant la date de renouvellement. L'essai gratuit de 30 jours se convertit automatiquement en abonnement payant à son terme. Vous pouvez annuler à tout moment depuis votre tableau de bord."
                    : 'Your Qwillio subscription automatically renews at the end of each billing period at the then-current rate unless you cancel before the renewal date. The 30 day free trial automatically converts to a paid subscription at the end of the trial period. You may cancel at any time from your dashboard.'}
                </p>
              </aside>

              {/* 1. Acceptance */}
              <section id="acceptance" aria-labelledby="h-acceptance" className="mb-16 scroll-mt-28">
                <h2
                  id="h-acceptance"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Acceptation' : 'Acceptance'}
                </h2>
                <p>
                  {isFr
                    ? "En accédant ou en utilisant les services de Qwillio LLC (« Qwillio »), vous acceptez d'être lié par les présentes conditions. Si vous n'êtes pas d'accord, veuillez ne pas utiliser nos services."
                    : 'By accessing or using the services of Qwillio LLC ("Qwillio"), you agree to be bound by these terms. If you do not agree, please do not use our services.'}
                </p>
              </section>

              {/* 2. Free Trial */}
              <section id="free-trial" aria-labelledby="h-trial" className="mb-16 scroll-mt-28">
                <h2
                  id="h-trial"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Essai gratuit' : 'Free trial'}
                </h2>
                <ul className="space-y-3 pl-0 list-none">
                  {(isFr
                    ? [
                        'Durée : 30 jours.',
                        "Carte de crédit requise à l'inscription.",
                        "Se renouvelle automatiquement en abonnement payant à la fin de la période d'essai.",
                        'Limité à un essai par personne physique et par entreprise.',
                        'Nous nous réservons le droit de révoquer les essais abusifs et de facturer au tarif standard.',
                      ]
                    : [
                        'Duration: 30 days.',
                        'Credit card required at signup.',
                        'Automatically renews into a paid subscription at the end of the trial period.',
                        'Limited to one trial per natural person and per business.',
                        'We reserve the right to revoke abusive trials and charge at the standard rate.',
                      ]
                  ).map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-[#6366f1] font-serif italic select-none" aria-hidden="true">
                        ¶
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 3. Pricing */}
              <section id="pricing" aria-labelledby="h-pricing" className="mb-16 scroll-mt-28">
                <h2
                  id="h-pricing"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Tarification' : 'Pricing'}
                </h2>
                <p className="mb-6">
                  {isFr
                    ? "Tous les prix sont en USD, facturés mensuellement. Aucun frais d'installation."
                    : 'All prices are in USD, billed monthly. No setup fees.'}
                </p>

                <h3 className="text-base font-semibold tracking-tight mt-8 mb-3 text-[#1d1d1f]">
                  {isFr ? 'Forfaits principaux' : 'Core plans'}
                </h3>
                <div className="overflow-x-auto -mx-2 mb-8">
                  <table className="w-full text-[14px] border border-[#1d1d1f]/10 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-[#fafaf8] text-left">
                        <th className="px-4 py-3 font-semibold text-[#1d1d1f]">
                          {isFr ? 'Forfait' : 'Plan'}
                        </th>
                        <th className="px-4 py-3 font-semibold text-[#1d1d1f]">
                          {isFr ? 'Prix mensuel' : 'Monthly price'}
                        </th>
                        <th className="px-4 py-3 font-semibold text-[#1d1d1f]">
                          {isFr ? 'Appels inclus' : 'Included calls'}
                        </th>
                        <th className="px-4 py-3 font-semibold text-[#1d1d1f]">
                          {isFr ? 'Dépassement' : 'Overage'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1d1d1f]/8">
                      <tr>
                        <td className="px-4 py-3 font-medium">Starter</td>
                        <td className="px-4 py-3 tabular-nums">$497/mo</td>
                        <td className="px-4 py-3 tabular-nums">800</td>
                        <td className="px-4 py-3 tabular-nums">$0.22 / {isFr ? 'appel' : 'call'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium">Pro</td>
                        <td className="px-4 py-3 tabular-nums">$1,297/mo</td>
                        <td className="px-4 py-3 tabular-nums">2,000</td>
                        <td className="px-4 py-3 tabular-nums">$0.18 / {isFr ? 'appel' : 'call'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium">Enterprise</td>
                        <td className="px-4 py-3 tabular-nums">$2,497/mo</td>
                        <td className="px-4 py-3 tabular-nums">4,000</td>
                        <td className="px-4 py-3 tabular-nums">$0.15 / {isFr ? 'appel' : 'call'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-base font-semibold tracking-tight mt-8 mb-3 text-[#1d1d1f]">
                  {isFr ? 'Modules complémentaires' : 'Agent add-ons'}
                </h3>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[14px] border border-[#1d1d1f]/10 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-[#fafaf8] text-left">
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Module' : 'Add-on'}</th>
                        <th className="px-4 py-3 font-semibold">
                          {isFr ? 'Prix mensuel' : 'Monthly price'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1d1d1f]/8">
                      <tr>
                        <td className="px-4 py-3">Email AI</td>
                        <td className="px-4 py-3 tabular-nums">+$197/mo</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">Payments AI</td>
                        <td className="px-4 py-3 tabular-nums">+$97/mo</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">Accounting AI</td>
                        <td className="px-4 py-3 tabular-nums">+$297/mo</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">Inventory AI</td>
                        <td className="px-4 py-3 tabular-nums">+$197/mo</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">
                          Agent Bundle ({isFr ? 'tous les modules' : 'all add-ons'})
                        </td>
                        <td className="px-4 py-3 tabular-nums">+$597/mo</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 4. Billing */}
              <section id="billing" aria-labelledby="h-billing" className="mb-16 scroll-mt-28">
                <h2
                  id="h-billing"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Facturation' : 'Billing'}
                </h2>
                <ul className="space-y-3 pl-0 list-none">
                  {(isFr
                    ? [
                        'Facturation mensuelle via Stripe.',
                        "En cas d'échec de paiement, nous effectuons 3 tentatives de relance.",
                        "Après 3 échecs, votre compte est suspendu jusqu'à régularisation.",
                        "Les dépassements d'appels sont facturés au cycle suivant.",
                      ]
                    : [
                        'Monthly billing via Stripe.',
                        'On payment failure, we retry 3 times.',
                        'After 3 failures, your account is suspended until payment is resolved.',
                        'Call overages are billed on the next billing cycle.',
                      ]
                  ).map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-[#6366f1] font-serif italic select-none" aria-hidden="true">
                        ¶
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 5. Cancellation */}
              <section
                id="cancellation"
                aria-labelledby="h-cancel"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-cancel"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Annulation' : 'Cancellation'}
                </h2>
                <ul className="space-y-3 pl-0 list-none">
                  {(isFr
                    ? [
                        "Vous pouvez annuler à tout moment depuis votre tableau de bord.",
                        "L'annulation prend effet à la fin de la période de facturation en cours.",
                        "Aucun remboursement au prorata n'est effectué.",
                        'Vos données sont conservées 30 jours après résiliation, puis supprimées.',
                      ]
                    : [
                        'You may cancel at any time from your dashboard.',
                        'Cancellation takes effect at the end of the current billing period.',
                        'No prorated refunds are issued.',
                        'Your data is retained for 30 days after cancellation, then deleted.',
                      ]
                  ).map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-[#6366f1] font-serif italic select-none" aria-hidden="true">
                        ¶
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 6. AI Disclosure */}
              <section
                id="ai-disclosure"
                aria-labelledby="h-ai"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-ai"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Divulgation IA' : 'AI disclosure'}
                </h2>
                <p>
                  {isFr
                    ? "Qwillio utilise l'intelligence artificielle pour traiter les appels, générer des réponses et effectuer des actions au nom de votre entreprise. Les appelants sont informés qu'ils interagissent avec un assistant IA. Bien que nous nous efforcions d'assurer l'exactitude, les réponses générées par l'IA peuvent contenir des erreurs. Vous êtes responsable de la supervision des actions de l'agent."
                    : "Qwillio uses artificial intelligence to process calls, generate responses, and perform actions on behalf of your business. Callers are informed that they are interacting with an AI assistant. While we strive for accuracy, AI generated responses may contain errors. You are responsible for overseeing the agent's actions."}
                </p>
              </section>

              {/* 7. Acceptable Use */}
              <section
                id="acceptable-use"
                aria-labelledby="h-use"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-use"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Utilisation acceptable' : 'Acceptable use'}
                </h2>
                <p className="mb-4">{isFr ? "Vous vous engagez à ne pas :" : 'You agree not to:'}</p>
                <ul className="space-y-3 pl-0 list-none">
                  {(isFr
                    ? [
                        'Utiliser le service à des fins illégales ou frauduleuses.',
                        "Abuser du système d'essai gratuit (comptes multiples, identités fictives).",
                        "Tenter de contourner les limites d'appels ou les mesures de sécurité.",
                        'Revendre ou redistribuer le service sans autorisation.',
                      ]
                    : [
                        'Use the service for illegal or fraudulent purposes.',
                        'Abuse the free trial system (multiple accounts, fictitious identities).',
                        'Attempt to bypass call limits or security measures.',
                        'Resell or redistribute the service without authorization.',
                      ]
                  ).map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-[#6366f1] font-serif italic select-none" aria-hidden="true">
                        ¶
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 8. Liability */}
              <section
                id="liability"
                aria-labelledby="h-liability"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-liability"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Limitation de responsabilité' : 'Limitation of liability'}
                </h2>
                <p>
                  {isFr
                    ? "Dans toute la mesure permise par la loi, la responsabilité totale de Qwillio est limitée au montant des frais que vous avez payés au cours des 3 derniers mois précédant la réclamation. Qwillio ne sera en aucun cas responsable de dommages indirects, accessoires, spéciaux ou consécutifs."
                    : "To the maximum extent permitted by law, Qwillio's total liability is limited to the amount of fees you paid during the 3 months preceding the claim. Qwillio shall not be liable for any indirect, incidental, special, or consequential damages."}
                </p>
              </section>

              {/* 9. Governing Law */}
              <section
                id="governing-law"
                aria-labelledby="h-law"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-law"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Droit applicable' : 'Governing law'}
                </h2>
                <p>
                  {isFr
                    ? "Pour les clients américains : ces conditions sont régies par les lois de l'État du Delaware, États-Unis. Pour les clients de l'UE : ces conditions sont régies par le droit belge, et tout litige sera soumis aux tribunaux de Bruxelles."
                    : 'For US customers: these terms are governed by the laws of the State of Delaware, United States. For EU customers: these terms are governed by Belgian law, and any disputes shall be submitted to the courts of Brussels.'}
                </p>
              </section>

              {/* 10. Changes */}
              <section id="changes" aria-labelledby="h-changes" className="mb-16 scroll-mt-28">
                <h2
                  id="h-changes"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Modifications' : 'Changes'}
                </h2>
                <p>
                  {isFr
                    ? "Nous pouvons modifier ces conditions avec un préavis de 30 jours par e-mail. Votre utilisation continue après notification vaut acceptation des nouvelles conditions."
                    : "We may modify these terms with 30 days' notice by email. Your continued use after notification constitutes acceptance of the updated terms."}
                </p>
              </section>

              {/* 11. Contact */}
              <section id="contact" aria-labelledby="h-contact" className="mb-8 scroll-mt-28">
                <h2
                  id="h-contact"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Contact' : 'Contact'}
                </h2>
                <address className="not-italic">
                  <p className="font-semibold">Qwillio LLC</p>
                  <p className="text-[#525257]">
                    {isFr ? 'E-mail : ' : 'Email: '}
                    <a
                      href="mailto:hello@qwillio.com"
                      className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1] transition-colors"
                    >
                      hello@qwillio.com
                    </a>
                  </p>
                </address>
              </section>

              {/* Editorial closer */}
              <div className="mt-20 pt-8 border-t border-[#1d1d1f]/10 text-[13px] text-[#86868b] flex flex-wrap items-baseline gap-x-4 gap-y-1 print:hidden">
                <span className="font-serif italic">
                  {isFr ? 'Fin du document.' : 'End of document.'}
                </span>
                <span>
                  {isFr ? 'Des questions ? Écrivez-nous à ' : 'Questions? Write to '}
                  <a
                    href="mailto:hello@qwillio.com"
                    className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1]"
                  >
                    hello@qwillio.com
                  </a>
                  .
                </span>
              </div>
            </article>
          </div>
        </div>
      </main>

      <PublicFooter />

      <style>{`
        @media print {
          html, body { background: #fff !important; color: #000 !important; font-size: 11pt; }
          aside[aria-label], nav, footer, .print\\:hidden { display: none !important; }
          article { max-width: 100% !important; }
          h1, h2, h3 { color: #000 !important; page-break-after: avoid; }
          h2 { margin-top: 1.5rem !important; }
          section { page-break-inside: avoid; }
          a { color: #000 !important; text-decoration: underline; }
          table, th, td { border-color: #999 !important; }
          thead { background: #f5f5f5 !important; }
        }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
        }
      `}</style>
    </div>
  );
}
