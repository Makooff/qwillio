import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';

interface Section {
  id: string;
  label: string;
}

export default function Privacy() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [activeId, setActiveId] = useState<string>('introduction');

  useSEO({
    title: 'Privacy Policy',
    description:
      'Qwillio privacy policy: how we collect, use, and protect your data in compliance with GDPR and CCPA.',
    canonical: 'https://qwillio.com/privacy',
    noindex: true,
  });

  const sections: Section[] = useMemo(
    () => [
      { id: 'introduction', label: isFr ? 'Introduction' : 'Introduction' },
      { id: 'data-collected', label: isFr ? '1. Données collectées' : '1. Data we collect' },
      {
        id: 'data-use',
        label: isFr ? '2. Utilisation des données' : '2. How we use data',
      },
      { id: 'sub-processors', label: isFr ? '3. Sous-traitants' : '3. Sub-processors' },
      {
        id: 'data-retention',
        label: isFr ? '4. Conservation' : '4. Data retention',
      },
      {
        id: 'international',
        label: isFr ? '5. Transferts internationaux' : '5. International transfers',
      },
      {
        id: 'outbound-calling',
        label: isFr ? '6. Démarchage téléphonique' : '6. Outbound calling',
      },
      { id: 'rights', label: isFr ? '7. Vos droits' : '7. Your rights' },
      { id: 'cookies', label: isFr ? '8. Cookies' : '8. Cookies' },
      { id: 'changes', label: isFr ? '9. Modifications' : '9. Changes' },
      { id: 'contact', label: isFr ? '10. Contact' : '10. Contact' },
    ],
    [isFr],
  );

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

  const subProcessors = [
    { name: 'Vapi', purpose: isFr ? 'Orchestration vocale IA' : 'AI voice orchestration', region: 'USA' },
    { name: 'Twilio', purpose: isFr ? 'Téléphonie et SMS' : 'Telephony and SMS', region: 'USA' },
    { name: 'ElevenLabs', purpose: isFr ? 'Synthèse vocale' : 'Voice synthesis', region: 'USA / EU' },
    { name: 'OpenAI', purpose: isFr ? 'Modèles de langage' : 'Language models', region: 'USA' },
    { name: 'Stripe', purpose: isFr ? 'Paiements' : 'Payments', region: 'USA / EU' },
    { name: 'Resend', purpose: isFr ? 'E-mails transactionnels' : 'Transactional emails', region: 'USA' },
    { name: 'Neon', purpose: isFr ? 'Base de données' : 'Database', region: 'USA / EU' },
    { name: 'Vercel', purpose: isFr ? 'Hébergement frontend' : 'Frontend hosting', region: 'USA / EU' },
    { name: 'Render', purpose: isFr ? 'Hébergement backend' : 'Backend hosting', region: 'USA' },
  ];

  const rights = isFr
    ? [
        { name: 'Accès', desc: 'Obtenir une copie de vos données personnelles.' },
        { name: 'Rectification', desc: 'Corriger des données inexactes.' },
        { name: 'Effacement', desc: 'Demander la suppression de vos données.' },
        { name: 'Portabilité', desc: 'Recevoir vos données dans un format structuré.' },
        { name: 'Opposition', desc: 'Vous opposer à certains traitements.' },
        {
          name: 'Refus de vente (CCPA)',
          desc: "Nous ne vendons pas vos données. Si cela devait changer, vous pourrez vous désinscrire.",
        },
      ]
    : [
        { name: 'Access', desc: 'Obtain a copy of your personal data.' },
        { name: 'Rectification', desc: 'Correct inaccurate data.' },
        { name: 'Erasure', desc: 'Request deletion of your data.' },
        { name: 'Portability', desc: 'Receive your data in a structured format.' },
        { name: 'Objection', desc: 'Object to certain processing activities.' },
        {
          name: 'Opt-out of sale (CCPA)',
          desc: 'We do not sell your data. If this changes, you can opt out.',
        },
      ];

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
              {isFr ? 'Politique' : 'Policy'}
            </p>
            <h1 className="text-[clamp(2.4rem,6vw,5rem)] font-semibold tracking-[-0.035em] leading-[0.98] mb-6">
              {isFr ? (
                <>
                  Politique de{' '}
                  <span className="font-serif italic text-[#6366f1]">confidentialité.</span>
                </>
              ) : (
                <>
                  Privacy <span className="font-serif italic text-[#6366f1]">policy.</span>
                </>
              )}
            </h1>
            <p className="text-lg text-[#525257] leading-[1.55] max-w-[560px] mb-6">
              {isFr
                ? "Comment nous collectons, utilisons et protégeons vos données. Sans détour."
                : 'How we collect, use, and protect your data. Plainly stated.'}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm text-[#525257] border-t border-[#1d1d1f]/10 pt-5">
              <span className="font-serif italic text-[#86868b]">
                {isFr ? 'Dernière mise à jour' : 'Last updated'}
              </span>
              <time className="font-medium text-[#1d1d1f]" dateTime="2026-03-01">
                {isFr ? '1er mars 2026' : 'March 1, 2026'}
              </time>
              <span className="text-[#86868b]">·</span>
              <span className="text-[#86868b]">
                {isFr ? 'Conforme RGPD et CCPA' : 'GDPR and CCPA compliant'}
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

              <div className="mt-10 hidden lg:block">
                <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#86868b] mb-3">
                  {isFr ? 'Voir aussi' : 'See also'}
                </p>
                <Link
                  to="/gdpr"
                  className="block text-[13px] text-[#1d1d1f] hover:text-[#6366f1] transition-colors"
                >
                  {isFr ? 'Vos droits RGPD →' : 'Your GDPR rights →'}
                </Link>
                <Link
                  to="/terms"
                  className="block text-[13px] text-[#1d1d1f] hover:text-[#6366f1] transition-colors mt-1.5"
                >
                  {isFr ? "Conditions d'utilisation →" : 'Terms of service →'}
                </Link>
              </div>
            </aside>

            {/* Scrollable content */}
            <article
              id="legal-content"
              className="max-w-[65ch] text-[17px] leading-[1.75] text-[#1d1d1f] print:max-w-none"
            >
              {/* Introduction */}
              <section
                id="introduction"
                aria-labelledby="h-intro"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-intro"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Introduction' : 'Introduction'}
                </h2>
                <p className="mb-4">
                  {isFr
                    ? "Qwillio LLC (« Qwillio », « nous ») s'engage à protéger votre vie privée. Cette politique explique comment nous collectons, utilisons et protégeons vos données personnelles conformément au RGPD (UE) et au CCPA (Californie)."
                    : 'Qwillio LLC ("Qwillio", "we", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal data in compliance with the GDPR (EU) and CCPA (California).'}
                </p>
                <p>
                  {isFr ? 'Contact : ' : 'Contact: '}
                  <a
                    href="mailto:hello@qwillio.com"
                    className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1] transition-colors"
                  >
                    hello@qwillio.com
                  </a>
                </p>
              </section>

              {/* 1. Data Collected */}
              <section
                id="data-collected"
                aria-labelledby="h-data"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-data"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Données collectées' : 'Data we collect'}
                </h2>
                <ul className="space-y-3 pl-0 list-none">
                  {(isFr
                    ? [
                        'Identité : nom, adresse e-mail, numéro de téléphone.',
                        'Paiement : informations de carte (traitées par Stripe, jamais stockées chez nous).',
                        "Enregistrements d'appels et transcriptions.",
                        "Données techniques : empreinte d'appareil, adresse IP, type de navigateur.",
                        "Données d'utilisation : journaux d'interaction, préférences.",
                      ]
                    : [
                        'Identity: name, email address, phone number.',
                        'Payment: card information (processed by Stripe, never stored by us).',
                        'Call recordings and transcripts.',
                        'Technical data: device fingerprint, IP address, browser type.',
                        'Usage data: interaction logs, preferences.',
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

              {/* 2. How We Use Data */}
              <section
                id="data-use"
                aria-labelledby="h-use"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-use"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Comment nous utilisons vos données' : 'How we use your data'}
                </h2>
                <ul className="space-y-3 pl-0 list-none">
                  {(isFr
                    ? [
                        "Fournir et améliorer nos services d'agent vocal IA.",
                        'Traiter les paiements et gérer les abonnements.',
                        'Communiquer avec vous (e-mails transactionnels et support).',
                        'Détecter et prévenir la fraude.',
                        'Respecter nos obligations légales.',
                      ]
                    : [
                        'Provide and improve our AI voice agent services.',
                        'Process payments and manage subscriptions.',
                        'Communicate with you (transactional emails and support).',
                        'Detect and prevent fraud.',
                        'Comply with legal obligations.',
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

              {/* 3. Sub-processors */}
              <section
                id="sub-processors"
                aria-labelledby="h-sub"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-sub"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Sous-traitants' : 'Sub-processors'}
                </h2>
                <p className="mb-6">
                  {isFr
                    ? 'Nous partageons des données avec les sous-traitants suivants, chacun lié par des clauses contractuelles de protection des données.'
                    : 'We share data with the following sub-processors, each bound by data protection agreements.'}
                </p>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[14px] border border-[#1d1d1f]/10 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-[#fafaf8] text-left">
                        <th className="px-4 py-3 font-semibold">
                          {isFr ? 'Sous-traitant' : 'Sub-processor'}
                        </th>
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Fonction' : 'Purpose'}</th>
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Localisation' : 'Location'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1d1d1f]/8">
                      {subProcessors.map((sp) => (
                        <tr key={sp.name}>
                          <td className="px-4 py-3 font-medium">{sp.name}</td>
                          <td className="px-4 py-3 text-[#525257]">{sp.purpose}</td>
                          <td className="px-4 py-3 tabular-nums">{sp.region}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 4. Data Retention */}
              <section
                id="data-retention"
                aria-labelledby="h-retention"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-retention"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Conservation des données' : 'Data retention'}
                </h2>
                <ul className="space-y-3 pl-0 list-none">
                  {(isFr
                    ? [
                        "Enregistrements d'appels et transcriptions : 90 jours après la création.",
                        "Données de compte : durée de l'abonnement + 30 jours après résiliation.",
                        'Signaux de fraude : conservés indéfiniment sous forme hachée.',
                        'Journaux de facturation : 7 ans (obligation légale).',
                      ]
                    : [
                        'Call recordings and transcripts: 90 days after creation.',
                        'Account data: subscription duration + 30 days after cancellation.',
                        'Fraud signals: retained indefinitely in hashed form.',
                        'Billing logs: 7 years (legal requirement).',
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

              {/* 5. International Transfers */}
              <section
                id="international"
                aria-labelledby="h-intl"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-intl"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Transferts internationaux' : 'International transfers'}
                </h2>
                <p>
                  {isFr
                    ? "Les données personnelles de l'UE et de l'EEE transférées vers les États-Unis sont protégées par les Clauses Contractuelles Types (CCT) approuvées par la Commission européenne. Nous mettons également en œuvre des mesures techniques supplémentaires, y compris le chiffrement au repos et en transit."
                    : 'Personal data from the EU and EEA transferred to the United States is protected by Standard Contractual Clauses (SCCs) approved by the European Commission. We also implement supplementary technical measures, including encryption at rest and in transit.'}
                </p>
              </section>

              {/* 6. Outbound Calling */}
              <section
                id="outbound-calling"
                aria-labelledby="h-outbound"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-outbound"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Démarchage téléphonique' : 'Outbound calling disclosure'}
                </h2>
                <p>
                  {isFr
                    ? "Qwillio peut effectuer des appels sortants vers des lignes fixes professionnelles pour le compte de nos clients, en conformité avec le TCPA (Telephone Consumer Protection Act). Nous ne contactons jamais de numéros de téléphone mobiles ou personnels sans consentement préalable exprimé par écrit. Tous les appels sortants respectent les listes DNC (Do Not Call) fédérales et des États."
                    : 'Qwillio may place outbound calls to business landlines on behalf of our clients in compliance with the TCPA (Telephone Consumer Protection Act). We never contact mobile or personal phone numbers without prior express written consent. All outbound calls comply with federal and state Do Not Call (DNC) lists.'}
                </p>
              </section>

              {/* 7. Your Rights */}
              <section id="rights" aria-labelledby="h-rights" className="mb-16 scroll-mt-28">
                <h2
                  id="h-rights"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Vos droits' : 'Your rights'}
                </h2>
                <p className="mb-6">
                  {isFr
                    ? 'Selon votre juridiction, vous disposez des droits suivants.'
                    : 'Depending on your jurisdiction, you have the following rights.'}
                </p>
                <dl className="space-y-4">
                  {rights.map((right) => (
                    <div
                      key={right.name}
                      className="grid grid-cols-[180px_1fr] gap-4 py-3 border-b border-[#1d1d1f]/8 last:border-0"
                    >
                      <dt className="font-semibold text-[#1d1d1f]">{right.name}</dt>
                      <dd className="text-[#525257]">{right.desc}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6">
                  {isFr ? 'Pour exercer vos droits, contactez-nous à ' : 'To exercise your rights, contact us at '}
                  <a
                    href="mailto:hello@qwillio.com"
                    className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1] transition-colors"
                  >
                    hello@qwillio.com
                  </a>
                  . {isFr ? 'Voir aussi notre page ' : 'See also our '}
                  <Link
                    to="/gdpr"
                    className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1] transition-colors"
                  >
                    {isFr ? 'Droits RGPD' : 'GDPR Rights'}
                  </Link>
                  .
                </p>
              </section>

              {/* 8. Cookies */}
              <section id="cookies" aria-labelledby="h-cookies" className="mb-16 scroll-mt-28">
                <h2
                  id="h-cookies"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Cookies' : 'Cookies'}
                </h2>
                <p>
                  {isFr
                    ? "Nous utilisons uniquement des cookies essentiels nécessaires au fonctionnement du service (session, préférence de langue). Nous n'utilisons pas de cookies de suivi ni d'analyse tiers."
                    : 'We use only essential cookies necessary for the service to function (session, language preference). We do not use tracking cookies or third party analytics.'}
                </p>
              </section>

              {/* 9. Changes */}
              <section id="changes" aria-labelledby="h-changes" className="mb-16 scroll-mt-28">
                <h2
                  id="h-changes"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Modifications' : 'Changes to this policy'}
                </h2>
                <p>
                  {isFr
                    ? "Nous pouvons mettre à jour cette politique périodiquement. En cas de changement significatif, nous vous en informerons par e-mail au moins 30 jours avant l'entrée en vigueur."
                    : 'We may update this policy periodically. For material changes, we will notify you by email at least 30 days before the changes take effect.'}
                </p>
              </section>

              {/* 10. Contact */}
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
