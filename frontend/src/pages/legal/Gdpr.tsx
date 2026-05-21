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

interface DataRight {
  article: string;
  title: string;
  desc: string;
}

interface DataCategory {
  category: string;
  examples: string;
  retention: string;
}

interface LegalBasis {
  activity: string;
  basis: string;
}

export default function Gdpr() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [activeId, setActiveId] = useState<string>('overview');

  useSEO({
    title: 'GDPR Rights',
    description: 'Your GDPR data rights with Qwillio: access, rectification, erasure, portability and more.',
    canonical: 'https://qwillio.com/gdpr',
    noindex: true,
  });

  const sections: Section[] = useMemo(
    () => [
      { id: 'overview', label: isFr ? 'Aperçu' : 'Overview' },
      { id: 'your-rights', label: isFr ? 'Vos 7 droits' : 'Your 7 rights' },
      { id: 'how-to-exercise', label: isFr ? 'Comment exercer' : 'How to exercise' },
      { id: 'response-time', label: isFr ? 'Délai de réponse' : 'Response time' },
      { id: 'data-categories', label: isFr ? 'Catégories de données' : 'Data categories' },
      { id: 'cookies', label: isFr ? 'Cookies' : 'Cookies' },
      { id: 'legal-basis', label: isFr ? 'Base légale' : 'Legal basis' },
      { id: 'related', label: isFr ? 'Documents liés' : 'Related documents' },
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

  const rights: DataRight[] = isFr
    ? [
        {
          article: 'Art. 15',
          title: "Droit d'accès",
          desc: "Vous pouvez demander une copie de toutes les données personnelles que nous détenons à votre sujet, y compris les enregistrements d'appels, les transcriptions et les données de compte.",
        },
        {
          article: 'Art. 16',
          title: 'Droit de rectification',
          desc: 'Si vos données sont inexactes ou incomplètes, vous pouvez demander leur correction.',
        },
        {
          article: 'Art. 17',
          title: "Droit à l'effacement",
          desc: 'Vous pouvez demander la suppression de vos données personnelles. Nous les supprimerons sauf obligation légale de conservation.',
        },
        {
          article: 'Art. 18',
          title: 'Droit à la limitation du traitement',
          desc: 'Vous pouvez demander que nous limitions le traitement de vos données dans certaines circonstances.',
        },
        {
          article: 'Art. 20',
          title: 'Droit à la portabilité',
          desc: 'Vous pouvez recevoir vos données dans un format structuré, couramment utilisé et lisible par machine (JSON, CSV).',
        },
        {
          article: 'Art. 21',
          title: "Droit d'opposition",
          desc: "Vous pouvez vous opposer au traitement de vos données fondé sur notre intérêt légitime, y compris le profilage.",
        },
        {
          article: 'Art. 22',
          title: 'Décision automatisée',
          desc: "Vous avez le droit de ne pas faire l'objet d'une décision fondée exclusivement sur un traitement automatisé qui produit des effets juridiques.",
        },
      ]
    : [
        {
          article: 'Art. 15',
          title: 'Right of access',
          desc: 'You can request a copy of all personal data we hold about you, including call recordings, transcripts, and account data.',
        },
        {
          article: 'Art. 16',
          title: 'Right to rectification',
          desc: 'If your data is inaccurate or incomplete, you can request correction.',
        },
        {
          article: 'Art. 17',
          title: 'Right to erasure',
          desc: 'You can request deletion of your personal data. We will delete it unless we are legally required to retain it.',
        },
        {
          article: 'Art. 18',
          title: 'Right to restriction',
          desc: 'You can request that we restrict the processing of your data in certain circumstances.',
        },
        {
          article: 'Art. 20',
          title: 'Right to portability',
          desc: 'You can receive your data in a structured, commonly used, machine readable format (JSON, CSV).',
        },
        {
          article: 'Art. 21',
          title: 'Right to object',
          desc: 'You can object to processing of your data based on our legitimate interest, including profiling.',
        },
        {
          article: 'Art. 22',
          title: 'Automated decision making',
          desc: 'You have the right not to be subject to a decision based solely on automated processing that produces legal effects.',
        },
      ];

  const dataCategories: DataCategory[] = isFr
    ? [
        {
          category: 'Données de compte',
          examples: 'Nom, e-mail, téléphone',
          retention: "Durée de l'abonnement + 30 jours",
        },
        {
          category: "Enregistrements d'appels",
          examples: 'Audio des appels traités',
          retention: '90 jours',
        },
        {
          category: 'Transcriptions',
          examples: 'Texte des conversations',
          retention: '90 jours',
        },
        {
          category: 'Données de paiement',
          examples: 'Identifiants Stripe (pas de numéros de carte)',
          retention: '7 ans (obligation légale)',
        },
        {
          category: 'Données techniques',
          examples: "Adresse IP, empreinte d'appareil",
          retention: '90 jours (IP), indéfini hachée (fraude)',
        },
      ]
    : [
        {
          category: 'Account data',
          examples: 'Name, email, phone',
          retention: 'Subscription duration + 30 days',
        },
        {
          category: 'Call recordings',
          examples: 'Audio of processed calls',
          retention: '90 days',
        },
        {
          category: 'Transcripts',
          examples: 'Conversation text',
          retention: '90 days',
        },
        {
          category: 'Payment data',
          examples: 'Stripe identifiers (no card numbers)',
          retention: '7 years (legal requirement)',
        },
        {
          category: 'Technical data',
          examples: 'IP address, device fingerprint',
          retention: '90 days (IP), indefinite hashed (fraud)',
        },
      ];

  const legalBases: LegalBasis[] = isFr
    ? [
        { activity: 'Fourniture du service', basis: 'Exécution du contrat (Art. 6(1)(b))' },
        { activity: 'Facturation et paiements', basis: 'Exécution du contrat (Art. 6(1)(b))' },
        { activity: 'Détection de fraude', basis: 'Intérêt légitime (Art. 6(1)(f))' },
        { activity: 'E-mails transactionnels', basis: 'Exécution du contrat (Art. 6(1)(b))' },
        { activity: 'Conservation légale (factures)', basis: 'Obligation légale (Art. 6(1)(c))' },
        { activity: 'Amélioration du service', basis: 'Intérêt légitime (Art. 6(1)(f))' },
      ]
    : [
        { activity: 'Service delivery', basis: 'Contract performance (Art. 6(1)(b))' },
        { activity: 'Billing and payments', basis: 'Contract performance (Art. 6(1)(b))' },
        { activity: 'Fraud detection', basis: 'Legitimate interest (Art. 6(1)(f))' },
        { activity: 'Transactional emails', basis: 'Contract performance (Art. 6(1)(b))' },
        { activity: 'Legal retention (invoices)', basis: 'Legal obligation (Art. 6(1)(c))' },
        { activity: 'Service improvement', basis: 'Legitimate interest (Art. 6(1)(f))' },
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
              {isFr ? 'Règlement RGPD' : 'GDPR regulation'}
            </p>
            <h1 className="text-[clamp(2.4rem,6vw,5rem)] font-semibold tracking-[-0.035em] leading-[0.98] mb-6">
              {isFr ? (
                <>
                  Vos droits{' '}
                  <span className="font-serif italic text-[#6366f1]">RGPD,</span> en clair.
                </>
              ) : (
                <>
                  Your GDPR{' '}
                  <span className="font-serif italic text-[#6366f1]">rights,</span> plainly.
                </>
              )}
            </h1>
            <p className="text-lg text-[#525257] leading-[1.55] max-w-[560px] mb-6">
              {isFr
                ? "Le Règlement Général sur la Protection des Données vous donne un contrôle total sur vos données personnelles. Voici vos droits expliqués simplement."
                : 'The General Data Protection Regulation gives you full control over your personal data. Here are your rights explained in plain language.'}
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
                {isFr ? 'Conforme au Règlement (UE) 2016/679' : 'Compliant with Regulation (EU) 2016/679'}
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
                  {isFr ? 'Action rapide' : 'Quick action'}
                </p>
                <a
                  href="mailto:hello@qwillio.com?subject=GDPR%20Request"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1d1d1f] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1]"
                >
                  {isFr ? 'Envoyer une demande →' : 'Send a request →'}
                </a>
              </div>
            </aside>

            {/* Scrollable content */}
            <article
              id="legal-content"
              className="max-w-[65ch] text-[17px] leading-[1.75] text-[#1d1d1f] print:max-w-none"
            >
              {/* Overview */}
              <section id="overview" aria-labelledby="h-overview" className="mb-16 scroll-mt-28">
                <h2
                  id="h-overview"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Aperçu' : 'Overview'}
                </h2>
                <p className="mb-4">
                  {isFr
                    ? "Si vous résidez dans l'Union européenne ou dans l'Espace économique européen, le RGPD vous accorde un ensemble de droits sur vos données personnelles. Qwillio est responsable du traitement de vos données et s'engage à respecter chacun de ces droits sans frais ni délai injustifié."
                    : 'If you reside in the European Union or the European Economic Area, the GDPR grants you a set of rights over your personal data. Qwillio is the data controller and commits to honoring each of these rights without charge or undue delay.'}
                </p>
                <p>
                  {isFr
                    ? 'Cette page résume vos droits, la façon de les exercer, et la base légale de chaque traitement que nous effectuons.'
                    : 'This page summarizes your rights, how to exercise them, and the legal basis for each processing activity we perform.'}
                </p>
              </section>

              {/* Your 7 Rights */}
              <section
                id="your-rights"
                aria-labelledby="h-rights"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-rights"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-6 leading-[1.15]"
                >
                  {isFr ? 'Vos 7 droits' : 'Your 7 rights'}
                </h2>
                <ol className="space-y-7 list-none pl-0">
                  {rights.map((right, i) => (
                    <li key={right.article} className="grid grid-cols-[36px_1fr] gap-5">
                      <span className="font-serif italic text-[#6366f1] text-2xl leading-none pt-1 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                          <h3 className="text-xl font-semibold tracking-tight">{right.title}</h3>
                          <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#86868b]">
                            {right.article}
                          </span>
                        </div>
                        <p className="text-[#525257] text-[16px] leading-[1.7]">{right.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* How to Exercise */}
              <section
                id="how-to-exercise"
                aria-labelledby="h-how"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-how"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Comment exercer vos droits' : 'How to exercise your rights'}
                </h2>
                <p className="mb-5">
                  {isFr ? "Envoyez un e-mail à " : 'Send an email to '}
                  <a
                    href="mailto:hello@qwillio.com"
                    className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1] transition-colors font-medium"
                  >
                    hello@qwillio.com
                  </a>
                  {isFr ? " avec l'objet suivant :" : ' with the following subject:'}
                </p>
                <div className="border-l-2 border-[#6366f1] pl-5 py-4 bg-[#6366f1]/4 rounded-r-md mb-5">
                  <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#6366f1] mb-2">
                    {isFr ? 'Modèle' : 'Template'}
                  </p>
                  <code className="font-mono text-[14px] text-[#1d1d1f] block">
                    {isFr ? 'RGPD : [Votre droit]' : 'GDPR Request: [Right]'}
                  </code>
                </div>
                <p className="text-[15px] text-[#525257]">
                  {isFr
                    ? "Exemple : « RGPD : Droit d'accès » ou « RGPD : Droit à l'effacement »."
                    : 'Example: "GDPR Request: Right of Access" or "GDPR Request: Right to Erasure".'}
                </p>
              </section>

              {/* Response Time */}
              <section
                id="response-time"
                aria-labelledby="h-time"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-time"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Délai de réponse' : 'Response time'}
                </h2>
                <p>
                  {isFr
                    ? "Nous répondrons à votre demande dans un délai de 30 jours calendaires. Si la demande est complexe, ce délai peut être prolongé de 60 jours supplémentaires, auquel cas nous vous en informerons dans le délai initial de 30 jours."
                    : 'We will respond to your request within 30 calendar days. If the request is complex, this period may be extended by an additional 60 days, in which case we will inform you within the initial 30 day period.'}
                </p>
              </section>

              {/* Data Categories */}
              <section
                id="data-categories"
                aria-labelledby="h-cats"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-cats"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Catégories de données et conservation' : 'Data categories and retention'}
                </h2>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[14px] border border-[#1d1d1f]/10 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-[#fafaf8] text-left">
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Catégorie' : 'Category'}</th>
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Exemples' : 'Examples'}</th>
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Conservation' : 'Retention'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1d1d1f]/8">
                      {dataCategories.map((cat) => (
                        <tr key={cat.category}>
                          <td className="px-4 py-3 font-medium">{cat.category}</td>
                          <td className="px-4 py-3 text-[#525257]">{cat.examples}</td>
                          <td className="px-4 py-3 tabular-nums">{cat.retention}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Cookies */}
              <section id="cookies" aria-labelledby="h-cookies" className="mb-16 scroll-mt-28">
                <h2
                  id="h-cookies"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Cookies' : 'Cookies'}
                </h2>
                <p>
                  {isFr
                    ? "Qwillio utilise uniquement des cookies essentiels nécessaires au fonctionnement du service. Nous n'utilisons aucun cookie de suivi, d'analyse ou publicitaire. Aucun bandeau de cookies n'est nécessaire car nous ne collectons que des cookies strictement nécessaires."
                    : 'Qwillio uses only essential cookies necessary for the service to function. We do not use any tracking, analytics, or advertising cookies. No cookie banner is needed because we only use strictly necessary cookies.'}
                </p>
              </section>

              {/* Legal Basis */}
              <section
                id="legal-basis"
                aria-labelledby="h-basis"
                className="mb-16 scroll-mt-28"
              >
                <h2
                  id="h-basis"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Base légale par activité' : 'Legal basis per activity'}
                </h2>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[14px] border border-[#1d1d1f]/10 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-[#fafaf8] text-left">
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Activité' : 'Activity'}</th>
                        <th className="px-4 py-3 font-semibold">{isFr ? 'Base légale' : 'Legal basis'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1d1d1f]/8">
                      {legalBases.map((item) => (
                        <tr key={item.activity}>
                          <td className="px-4 py-3 font-medium">{item.activity}</td>
                          <td className="px-4 py-3 text-[#525257]">{item.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Related Documents */}
              <section id="related" aria-labelledby="h-related" className="mb-8 scroll-mt-28">
                <h2
                  id="h-related"
                  className="text-3xl md:text-[2.1rem] font-semibold tracking-tight mb-5 leading-[1.15]"
                >
                  {isFr ? 'Documents liés' : 'Related documents'}
                </h2>
                <p>
                  {isFr ? 'Pour plus de détails, consultez notre ' : 'For more details, see our '}
                  <Link
                    to="/privacy"
                    className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1] transition-colors font-medium"
                  >
                    {isFr ? 'politique de confidentialité complète' : 'full privacy policy'}
                  </Link>
                  {isFr ? ' ou nos ' : ' or our '}
                  <Link
                    to="/terms"
                    className="text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-4 hover:decoration-[#6366f1] transition-colors font-medium"
                  >
                    {isFr ? "conditions d'utilisation" : 'terms of service'}
                  </Link>
                  .
                </p>
              </section>

              {/* Editorial closer */}
              <div className="mt-20 pt-8 border-t border-[#1d1d1f]/10 text-[13px] text-[#86868b] flex flex-wrap items-baseline gap-x-4 gap-y-1 print:hidden">
                <span className="font-serif italic">
                  {isFr ? 'Fin du document.' : 'End of document.'}
                </span>
                <span>
                  {isFr ? 'Une demande à formuler ? Écrivez-nous à ' : 'Need to submit a request? Write to '}
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
