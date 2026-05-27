import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  Check, ArrowRight, ChevronDown,
  Users, Megaphone, Star, FileText, CalendarClock, MapPin,
  Mail, Crosshair, LifeBuoy, CreditCard, LineChart, Calculator, Package,
  Sparkles,
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';

interface Tier {
  id: string;
  name: string;
  badge?: string;
  monthly: number;
  calls: number;
  overage: number;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

export default function Pricing() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useSEO({
    title: isFr ? 'Tarifs Qwillio' : 'Qwillio Pricing',
    description: isFr
      ? 'Tarifs simples et transparents. Premier mois offert. Sans engagement.'
      : 'Simple transparent pricing. First month free. No commitment.',
    canonical: 'https://qwillio.com/pricing',
  });

  const tiers: Tier[] = [
    {
      id: 'starter',
      name: 'Starter',
      monthly: 497,
      calls: 800,
      overage: 0.22,
      description: isFr ? 'Pour commencer' : 'To get started',
      features: isFr
        ? ['800 appels par mois', 'Réceptionniste IA 24/7', 'Capture de leads', 'Analytiques', 'Support email', 'Transcription des appels']
        : ['800 calls per month', 'AI Receptionist 24/7', 'Lead capture', 'Analytics', 'Email support', 'Call transcripts'],
      cta: isFr ? 'Commencer' : 'Start',
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      badge: isFr ? 'Le plus populaire' : 'Most popular',
      monthly: 1297,
      calls: 2000,
      overage: 0.18,
      description: isFr ? 'Pour grandir' : 'To grow',
      features: isFr
        ? ['2 000 appels par mois', 'Tout Starter inclus', 'Analytiques avancées + sentiments', 'Transfert d\'appel intelligent', 'Support prioritaire', 'Intégrations CRM natives']
        : ['2,000 calls per month', 'Everything in Starter', 'Advanced analytics + sentiment', 'Smart call routing', 'Priority support', 'Native CRM integrations'],
      cta: isFr ? 'Choisir Pro' : 'Choose Pro',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthly: 2497,
      calls: 4000,
      overage: 0.15,
      description: isFr ? 'Pour scale' : 'To scale',
      features: isFr
        ? ['4 000 appels par mois', 'Tout Pro inclus', 'Responsable dédié', 'SLA 99,5% uptime', 'Accès API complet', 'IA auto-apprenante']
        : ['4,000 calls per month', 'Everything in Pro', 'Dedicated manager', '99.5% uptime SLA', 'Full API access', 'Self-learning AI'],
      cta: isFr ? 'Contacter' : 'Contact us',
      popular: false,
    },
  ];

  const faqs = isFr
    ? [
        { q: 'Y a-t-il un engagement ?', a: 'Non. Annulez en un clic depuis votre dashboard, à tout moment. Le premier mois est offert sur tous les plans.' },
        { q: 'Que se passe-t-il si je dépasse mon quota ?', a: 'Les appels supplémentaires sont facturés au tarif overage indiqué pour votre plan. Vous recevez une alerte avant d\'atteindre la limite.' },
        { q: 'Puis-je changer de plan ?', a: 'Oui, à tout moment. Les changements sont au prorata sur votre prochaine facture.' },
        { q: 'Combien de temps prend la mise en route ?', a: 'Compte créé en 2 minutes. Premiers appels traités le jour même. Configuration assistée si besoin.' },
        { q: 'Quels moyens de paiement acceptez-vous ?', a: 'Carte bancaire (Visa, Mastercard, Amex), SEPA, virement pour les comptes Enterprise.' },
      ]
    : [
        { q: 'Is there a commitment?', a: 'No. Cancel anytime from your dashboard. First month is free on all plans.' },
        { q: 'What happens if I exceed my quota?', a: 'Extra calls are billed at the overage rate listed for your plan. You get an alert before hitting the limit.' },
        { q: 'Can I change my plan?', a: 'Yes, anytime. Changes are prorated on your next invoice.' },
        { q: 'How long does setup take?', a: 'Account created in 2 minutes. First calls handled the same day. Assisted setup if you need it.' },
        { q: 'What payment methods do you accept?', a: 'Credit card (Visa, Mastercard, Amex), SEPA, wire transfer for Enterprise accounts.' },
      ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main id="main">
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section
          aria-labelledby="pricing-heading"
          className="pt-24 sm:pt-28 md:pt-36 pb-12 md:pb-20 px-5 sm:px-6"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.5fr_1fr] gap-12 items-end">
            <Reveal>
            <div>
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-4" style={{ color: '#6366f1' }}>
                {isFr ? 'Tarifs' : 'Pricing'}
              </span>
              <h1
                id="pricing-heading"
                className="text-[clamp(2.6rem,6vw,5rem)] font-semibold tracking-[-0.04em] leading-[0.98]"
              >
                {isFr ? (
                  <>
                    Un prix.<br />
                    <span className="font-serif italic" style={{ color: '#6366f1' }}>Tout</span>{' '}
                    <span className="font-serif italic" style={{ color: '#a855f7' }}>compris.</span>
                  </>
                ) : (
                  <>
                    One price.<br />
                    <span className="font-serif italic" style={{ color: '#6366f1' }}>Everything</span>{' '}
                    <span className="font-serif italic" style={{ color: '#a855f7' }}>included.</span>
                  </>
                )}
              </h1>
            </div>
            </Reveal>
            <Reveal delay={0.12}>
            <p className="text-[#525257] text-[15px] leading-relaxed max-w-[400px]">
              {isFr
                ? 'Premier mois offert sur tous les plans. Sans carte requise pour démarrer. Annulez en un clic.'
                : 'First month free on every plan. No card required to start. Cancel anytime.'}
            </p>
            </Reveal>
          </div>
        </section>

        {/* ── PRICING BENTO 1fr 1.4fr 1fr — Pro dominant ─────────── */}
        <section aria-label={isFr ? 'Plans tarifaires' : 'Pricing plans'} className="px-6 pb-24 md:pb-32">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1fr_1.4fr_1fr] gap-5 items-stretch">
            {tiers.map((tier, i) => {
              const isPro = tier.popular;
              return (
                <Reveal key={tier.id} delay={i * 0.08}>
                <Card3D intensity={isPro ? 4 : 3}>
                <article
                  aria-label={tier.name}
                  className={`relative rounded-3xl sm:rounded-[2rem] p-7 sm:p-8 md:p-10 flex flex-col ${
                    isPro ? 'text-white mt-3 sm:mt-0' : 'border border-[#1d1d1f]/10 bg-[#fafaf8] text-[#1d1d1f]'
                  }`}
                  style={
                    isPro
                      ? { background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #6366f1 115%)' }
                      : undefined
                  }
                >
                  {tier.badge && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full whitespace-nowrap"
                      style={{ background: '#a855f7', color: '#fff' }}
                    >
                      {tier.badge}
                    </span>
                  )}

                  <header className="mb-6">
                    <h2 className={`text-2xl font-semibold tracking-[-0.02em] mb-1 ${isPro ? 'text-white' : 'text-[#1d1d1f]'}`}>
                      {tier.name}
                    </h2>
                    <p className={`text-sm ${isPro ? 'text-white/60' : 'text-[#86868b]'}`}>
                      {tier.description}
                    </p>
                  </header>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[clamp(2.6rem,4vw,3.4rem)] font-semibold tracking-[-0.04em] tabular-nums ${isPro ? 'text-white' : 'text-[#1d1d1f]'}`}>
                        ${tier.monthly.toLocaleString()}
                      </span>
                      <span className={`text-sm ${isPro ? 'text-white/60' : 'text-[#86868b]'}`}>
                        /{isFr ? 'mois' : 'month'}
                      </span>
                    </div>
                    <p className={`text-xs mt-2 ${isPro ? 'text-[#a5b4fc]' : 'text-[#6366f1]'}`}>
                      · {isFr ? '1er mois offert' : '1st month free'}
                    </p>
                  </div>

                  <ul role="list" className={`space-y-3 mb-8 flex-1 ${isPro ? 'text-white/85' : 'text-[#424245]'}`}>
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm leading-relaxed">
                        <Check
                          size={16}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: isPro ? '#a5b4fc' : '#6366f1' }}
                          aria-hidden="true"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <p className={`text-xs mb-4 ${isPro ? 'text-white/45' : 'text-[#86868b]'}`}>
                    {isFr
                      ? `Overage : $${tier.overage}/appel au-delà des ${tier.calls.toLocaleString('fr-FR')} appels inclus`
                      : `Overage: $${tier.overage}/call beyond ${tier.calls.toLocaleString()} included calls`}
                  </p>

                  <Link
                    to="/register"
                    className={`inline-flex items-center justify-center gap-2 text-sm font-medium pl-5 pr-6 py-3.5 rounded-full transition-colors ${
                      isPro
                        ? 'bg-white text-[#1d1d1f] hover:bg-[#a5b4fc]'
                        : 'bg-[#1d1d1f] text-white hover:bg-[#6366f1]'
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
                </Card3D>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ── AI MODULES — 13 add-on agents ────────────────────────── */}
        <section
          aria-labelledby="modules-heading"
          className="px-6 pb-20 md:pb-28 border-t border-[#1d1d1f]/8 pt-16 md:pt-24"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
            <div className="mb-10 md:mb-14 grid lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
              <div>
                <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-3" style={{ color: '#a855f7' }}>
                  {isFr ? 'Qwillio Agent' : 'Qwillio Agent'}
                </span>
                <h2
                  id="modules-heading"
                  className="text-[clamp(2rem,4.4vw,3.6rem)] font-semibold tracking-[-0.03em] leading-[1.02]"
                >
                  {isFr ? (
                    <>13 modules IA. <span className="font-serif italic" style={{ color: '#6366f1' }}>À la carte</span> ou en bundle.</>
                  ) : (
                    <>13 AI modules. <span className="font-serif italic" style={{ color: '#6366f1' }}>À la carte</span> or bundled.</>
                  )}
                </h2>
              </div>
              <p className="text-[#525257] text-[15px] leading-relaxed">
                {isFr
                  ? 'Activez les modules dont vous avez besoin, désactivez à tout moment. Du plus demandé au moins demandé.'
                  : 'Activate the modules you need, turn them off anytime. From most to least requested.'}
              </p>
            </div>
            </Reveal>

            {/* Bundle highlight card */}
            <Reveal delay={0.1}>
            <Card3D intensity={4}>
            <article
              className="relative rounded-3xl sm:rounded-[2rem] p-7 sm:p-9 md:p-11 mb-6 text-white"
              style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #a855f7 115%)' }}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: '#a855f7', color: '#fff' }}>
                {isFr ? 'Bundle complet' : 'Full bundle'}
              </span>
              <div className="grid md:grid-cols-[1.4fr_1fr] gap-6 items-center mt-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={18} style={{ color: '#a855f7' }} />
                    <span className="text-[12.5px] font-semibold tracking-[0.08em] uppercase opacity-90">
                      {isFr ? 'All Agents' : 'All Agents'}
                    </span>
                  </div>
                  <h3 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-semibold tracking-[-0.025em] leading-[1.05] mb-3">
                    {isFr ? 'Les 13 modules en un seul abonnement' : 'All 13 modules in one subscription'}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-white/75 mb-4 max-w-[480px]">
                    {isFr
                      ? 'Au lieu de 2 561 $/mois si pris à l\'unité. Économisez 1 064 $/mois en activant tout en une fois.'
                      : 'Instead of $2,561/mo if bought individually. Save $1,064/mo by activating everything at once.'}
                  </p>
                </div>
                <div className="text-right md:text-left md:border-l md:border-white/10 md:pl-8">
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-60 mb-1">
                    {isFr ? 'À partir de' : 'Starting at'}
                  </div>
                  <div className="text-[clamp(2.4rem,5vw,3.6rem)] font-semibold tracking-[-0.04em] tabular-nums leading-none">
                    $1 497<span className="text-[14px] font-normal opacity-60 ml-1">/mo</span>
                  </div>
                  <div className="mt-1 text-[12px] tabular-nums" style={{ color: '#a855f7' }}>
                    −$1 064/mo {isFr ? 'd\'économie' : 'savings'}
                  </div>
                  <Link
                    to="/contact"
                    className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12.5px] font-semibold transition-colors active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    style={{ background: '#fff', color: '#1d1d1f' }}
                  >
                    {isFr ? 'Activer le bundle' : 'Activate bundle'}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </article>
            </Card3D>
            </Reveal>

            {/* 13 modules grid, ordered by demand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: 'crm',        icon: Users,        name: 'CRM AI',         tagline: isFr ? 'Pipeline, forecast, relances' : 'Pipeline, forecast, follow-ups',  hot: true },
                { id: 'marketing',  icon: Megaphone,    name: 'Marketing AI',   tagline: isFr ? 'Posts, emails, ad copy' : 'Posts, emails, ad copy',                 hot: true },
                { id: 'reputation', icon: Star,         name: 'Reputation AI',  tagline: isFr ? 'Avis et réponses' : 'Reviews and replies' },
                { id: 'document',   icon: FileText,     name: 'Document AI',    tagline: isFr ? 'Devis, contrats, signature' : 'Quotes, contracts, signature' },
                { id: 'scheduling', icon: CalendarClock,name: 'Scheduling AI',  tagline: isFr ? 'Créneaux et rappels' : 'Slots and reminders' },
                { id: 'local_seo',  icon: MapPin,       name: 'Local SEO AI',   tagline: isFr ? 'GMB, keywords, audit' : 'GMB, keywords, audit' },
                { id: 'email',      icon: Mail,         name: 'Email AI',       tagline: isFr ? 'Triage et auto-reply' : 'Triage and auto-reply' },
                { id: 'lead_gen',   icon: Crosshair,    name: 'Lead Gen AI',    tagline: isFr ? 'Prospection sortante' : 'Outbound prospecting' },
                { id: 'support',    icon: LifeBuoy,     name: 'Support AI',     tagline: isFr ? 'Tickets et escalade' : 'Tickets and escalation' },
                { id: 'payments',   icon: CreditCard,   name: 'Payments AI',    tagline: isFr ? 'Encaissements et acomptes' : 'Payments and deposits' },
                { id: 'analytics',  icon: LineChart,    name: 'Analytics AI',   tagline: isFr ? 'Digest, anomalies, forecast' : 'Digest, anomalies, forecast' },
                { id: 'accounting', icon: Calculator,   name: 'Accounting AI',  tagline: isFr ? 'Factures et P&L' : 'Invoices and P&L' },
                { id: 'inventory',  icon: Package,      name: 'Inventory AI',   tagline: isFr ? 'Stock et réassort' : 'Stock and reorder' },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <Reveal key={m.id} delay={Math.min(i * 0.04, 0.4)}>
                  <article
                    className="rounded-2xl p-5 transition-colors flex items-start gap-3 active:scale-[0.99] focus-within:ring-2 focus-within:ring-[#6366f1]/30"
                    style={{ background: '#fafaf8', border: '1px solid rgba(29,29,31,0.08)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.10)' }}
                    >
                      <Icon size={18} style={{ color: '#6366f1' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-[14px] font-semibold tracking-[-0.005em] text-[#1d1d1f] truncate">
                          {m.name}
                        </h3>
                        {m.hot && (
                          <span className="text-[9px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded-full" style={{ background: '#a855f7', color: '#fff' }}>
                            {isFr ? 'Top' : 'Top'}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#525257] mb-2 truncate">{m.tagline}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold tabular-nums text-[#1d1d1f]">$197<span className="text-[11px] font-normal text-[#86868b]">/mo</span></span>
                        <Link
                          to="/agent"
                          className="text-[11.5px] font-semibold inline-flex items-center gap-1"
                          style={{ color: '#6366f1' }}
                        >
                          {isFr ? 'Détail' : 'Details'}
                          <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── COMPARISON TABLE ─────────────────────────────────────── */}
        <section
          aria-labelledby="compare-heading"
          className="py-14 sm:py-18 md:py-28 px-6 border-t border-[#1d1d1f]/8 bg-[#fafaf8]"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
            <h2
              id="compare-heading"
              className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-10 max-w-[640px]"
            >
              {isFr
                ? <>Tout ce qui change. <span className="text-[#86868b] font-normal">Et tout ce qui reste pareil.</span></>
                : <>What changes. <span className="text-[#86868b] font-normal">And what stays the same.</span></>}
            </h2>
            </Reveal>

            {(() => {
              const rows = isFr
                ? [
                    ['Appels inclus', '800', '2 000', '4 000'],
                    ['Coût par appel supplémentaire', '$0,22', '$0,18', '$0,15'],
                    ['Réceptionniste IA 24/7', '✓', '✓', '✓'],
                    ['Transcription des appels', '✓', '✓', '✓'],
                    ['Analyse de sentiment', '·', '✓', '✓'],
                    ['Intégrations CRM natives', '·', '✓', '✓'],
                    ['Accès API complet', '·', '·', '✓'],
                    ['SLA 99,5% uptime', '·', '·', '✓'],
                    ['Responsable dédié', '·', '·', '✓'],
                    ['Support', 'Email', 'Prioritaire', 'Dédié'],
                  ]
                : [
                    ['Calls included', '800', '2,000', '4,000'],
                    ['Overage per call', '$0.22', '$0.18', '$0.15'],
                    ['24/7 AI Receptionist', '✓', '✓', '✓'],
                    ['Call transcripts', '✓', '✓', '✓'],
                    ['Sentiment analysis', '·', '✓', '✓'],
                    ['Native CRM integrations', '·', '✓', '✓'],
                    ['Full API access', '·', '·', '✓'],
                    ['99.5% uptime SLA', '·', '·', '✓'],
                    ['Dedicated manager', '·', '·', '✓'],
                    ['Support', 'Email', 'Priority', 'Dedicated'],
                  ];
              return (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1d1d1f]/15">
                          <th className="text-left py-4 font-normal text-[#86868b] text-xs uppercase tracking-wider">
                            {isFr ? 'Fonction' : 'Feature'}
                          </th>
                          {tiers.map((t) => (
                            <th
                              key={t.id}
                              className={`text-center py-4 font-semibold text-sm ${
                                t.popular ? 'text-[#6366f1]' : 'text-[#1d1d1f]'
                              }`}
                            >
                              {t.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1d1d1f]/8">
                        {rows.map((row) => (
                          <tr key={row[0]}>
                            <td className="py-3.5 text-[#1d1d1f] font-medium">{row[0]}</td>
                            <td className="py-3.5 text-center text-[#525257]">{row[1]}</td>
                            <td
                              className="py-3.5 text-center font-semibold"
                              style={{ background: 'rgba(99,102,241,0.04)', color: '#6366f1' }}
                            >
                              {row[2]}
                            </td>
                            <td className="py-3.5 text-center text-[#525257]">{row[3]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile stacked accordion-style per tier */}
                  <div className="md:hidden space-y-6">
                    {tiers.map((tier, tierIdx) => (
                      <details
                        key={tier.id}
                        className="rounded-2xl border border-[#1d1d1f]/10 bg-white overflow-hidden"
                        open={tier.popular}
                      >
                        <summary
                          className={`flex items-center justify-between px-5 py-4 cursor-pointer list-none ${
                            tier.popular ? 'text-[#6366f1]' : 'text-[#1d1d1f]'
                          }`}
                        >
                          <span className="font-semibold text-base">{tier.name}</span>
                          <span className="text-xs text-[#86868b]">
                            {isFr ? 'Voir détails' : 'View details'}
                          </span>
                        </summary>
                        <dl className="border-t border-[#1d1d1f]/8 divide-y divide-[#1d1d1f]/6 text-sm">
                          {rows.map((row) => (
                            <div key={row[0]} className="flex items-center justify-between px-5 py-3 gap-4">
                              <dt className="text-[#525257]">{row[0]}</dt>
                              <dd className={`font-semibold text-right ${tier.popular ? 'text-[#6366f1]' : 'text-[#1d1d1f]'}`}>
                                {row[tierIdx + 1]}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section
          aria-labelledby="faq-heading"
          className="py-14 sm:py-18 md:py-28 px-6"
        >
          <div className="max-w-[900px] mx-auto">
            <Reveal>
            <h2
              id="faq-heading"
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-semibold tracking-[-0.025em] mb-10"
            >
              {isFr ? 'Questions fréquentes.' : 'Frequently asked.'}
            </h2>
            </Reveal>

            <ul role="list" className="space-y-2">
              {faqs.map((f, i) => {
                const open = openFaq === i;
                return (
                  <Reveal key={f.q} delay={i * 0.06} as="li" className="border-b border-[#1d1d1f]/10">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="w-full text-left py-5 flex items-center justify-between gap-4 group"
                    >
                      <span className="text-base md:text-lg font-medium text-[#1d1d1f] group-hover:text-[#6366f1] transition-colors">
                        {f.q}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#6366f1]' : 'text-[#86868b]'}`}
                        aria-hidden="true"
                      />
                    </button>
                    {open && (
                      <p className="text-[#525257] text-[15px] leading-relaxed pb-6 pr-8 max-w-[720px]">
                        {f.a}
                      </p>
                    )}
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────── */}
        <section aria-label={isFr ? 'Démarrer' : 'Get started'} className="py-16 sm:py-20 md:py-32 px-6">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end border-t-2 border-[#1d1d1f] pt-12 md:pt-16">
            <Reveal>
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-semibold tracking-[-0.035em] leading-[0.98]">
              {isFr ? (
                <>
                  Prêt à<br />
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>économiser</span>{' '}
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>du temps ?</span>
                </>
              ) : (
                <>
                  Ready to<br />
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>save</span>{' '}
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>time?</span>
                </>
              )}
            </h2>
            </Reveal>
            <Reveal delay={0.1}>
            <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right pb-4">
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[320px] lg:ml-auto">
                {isFr
                  ? 'Sans engagement. Sans carte bancaire. Premier mois offert.'
                  : 'No commitment. No credit card. First month free.'}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#6366f1] transition-colors"
              >
                {isFr ? 'Créer un compte' : 'Create account'}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            </Reveal>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
