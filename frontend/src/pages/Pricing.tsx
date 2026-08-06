import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  Check, ArrowRight, ChevronDown, X,
} from '../components/icons';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';

interface Tier {
  id: string;
  name: string;
  badge?: string;
  monthly: number;        // EUR/month
  minutes: number;        // included minutes/month
  overage: number;        // EUR per overage minute
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

export default function Pricing() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const ANNUAL_DISCOUNT = 0.20;
  const priceFor = (monthlyPrice: number): number =>
    billing === 'annual' ? Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT)) : monthlyPrice;
  const perLabel = isFr ? 'mois' : 'month';

  useSEO({
    title: isFr ? 'Tarifs Qwillio' : 'Qwillio Pricing',
    description: isFr
      ? 'Tarifs par minute, simples et transparents. Facturation à la minute, minutes incluses par plan. 7 jours d\'essai gratuit, sans engagement. Économisez 20 % en annuel.'
      : 'Simple transparent per-minute pricing. Billed by the minute, minutes included per plan. 7-day free trial, no commitment. Save 20% on annual billing.',
    canonical: 'https://qwillio.com/pricing',
  });

  const tiers: Tier[] = [
    {
      id: 'solo',
      name: 'Solo',
      monthly: 99,
      minutes: 250,
      overage: 0.45,
      description: isFr ? 'Pour un indépendant' : 'For a solo operator',
      features: isFr
        ? ['250 minutes incluses par mois', 'IA 24/7 en français', 'Prise de RDV + agenda', 'Transfert des urgences', 'Bouclier anti-spam inclus', 'Hébergement UE, RGPD', 'Support email']
        : ['250 minutes included per month', '24/7 AI in French', 'Booking + calendar sync', 'Urgency transfer', 'Spam shield included', 'EU hosting, GDPR', 'Email support'],
      cta: isFr ? 'Commencer' : 'Start',
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      monthly: 249,
      minutes: 750,
      overage: 0.39,
      description: isFr ? 'Pour commencer' : 'To get started',
      features: isFr
        ? ['750 minutes incluses par mois', 'IA 24/7 bilingue FR / EN', 'Prise de RDV + agenda', 'Transfert des urgences', 'Transcription + sentiment', 'Bouclier anti-spam inclus', 'Capture de leads', 'Support email']
        : ['750 minutes included per month', '24/7 AI, bilingual FR / EN', 'Booking + calendar sync', 'Urgency transfer', 'Transcript + sentiment', 'Spam shield included', 'Lead capture', 'Email support'],
      cta: isFr ? 'Commencer' : 'Start',
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      badge: isFr ? 'Le plus populaire' : 'Most popular',
      monthly: 599,
      minutes: 2000,
      overage: 0.35,
      description: isFr ? 'Pour grandir' : 'To grow',
      features: isFr
        ? ['2 000 minutes incluses par mois', 'Tout Starter inclus', 'Analytiques avancées', 'Intégrations CRM natives', 'Support prioritaire']
        : ['2,000 minutes included per month', 'Everything in Starter', 'Advanced analytics', 'Native CRM integrations', 'Priority support'],
      cta: isFr ? 'Choisir Pro' : 'Choose Pro',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthly: 1290,
      minutes: 5000,
      overage: 0.30,
      description: isFr ? 'Pour scale' : 'To scale',
      features: isFr
        ? ['5 000 minutes incluses par mois', 'Tout Pro inclus', 'Multi-sites & numéros multiples', 'Responsable dédié', 'SLA 99,5% uptime', 'Accès API complet']
        : ['5,000 minutes included per month', 'Everything in Pro', 'Multi-site & multiple numbers', 'Dedicated manager', '99.5% uptime SLA', 'Full API access'],
      cta: isFr ? 'Contacter' : 'Contact us',
      popular: false,
    },
  ];

  const faqs = isFr
    ? [
        { q: 'Y a-t-il un engagement ?', a: 'En mensuel, non. Annulez en un clic depuis votre dashboard, à tout moment. En annuel, vous vous engagez sur 12 mois en échange d\'une remise de 20 %. Les 7 jours d’essai restent offerts dans les deux cas.' },
        { q: 'Comment fonctionne la remise de 20 % en annuel ?', a: 'Choisissez la facturation annuelle sur la page tarifs. Vous économisez 20 % sur le prix mensuel, prélevé en une fois à l\'inscription. Le calcul est simple : le montant annuel affiché correspond à 12 × (prix mensuel × 0,80).' },
        { q: 'Comment fonctionne la facturation à la minute ?', a: 'Chaque plan inclut un volume de minutes par mois. Au-delà, les minutes supplémentaires sont facturées au tarif de dépassement de votre plan (par exemple 0,39 €/min en Starter). Seuls les appels réels comptent : le spam bloqué n\'est jamais facturé. Vous recevez une alerte à 80, 95 et 100 % de votre quota.' },
        { q: 'Puis-je changer de plan ?', a: 'Oui, à tout moment. Les changements sont au prorata sur votre prochaine facture.' },
        { q: 'Combien de temps prend la mise en route ?', a: 'Compte créé en 2 minutes. Premiers appels traités le jour même. Configuration assistée si besoin.' },
        { q: 'Quels moyens de paiement acceptez-vous ?', a: 'Carte bancaire (Visa, Mastercard, Amex), SEPA, virement pour les comptes Enterprise et annuels.' },
      ]
    : [
        { q: 'Is there a commitment?', a: 'On monthly billing, none: cancel anytime from your dashboard. On annual, you commit for 12 months in exchange for a 20% discount. The 7-day trial applies either way.' },
        { q: 'How does the 20% annual discount work?', a: 'Pick annual billing on the pricing page. You save 20% on the monthly price, charged upfront at signup. The math is simple: the annual amount shown equals 12 × (monthly price × 0.80).' },
        { q: 'How does per-minute billing work?', a: 'Each plan includes a monthly minute allowance. Beyond that, extra minutes are billed at your plan\'s overage rate (for example €0.39/min on Starter). Only real calls count: blocked spam is never billed. You get an alert at 80%, 95% and 100% of your quota.' },
        { q: 'Can I change my plan?', a: 'Yes, anytime. Changes are prorated on your next invoice.' },
        { q: 'How long does setup take?', a: 'Account created in 2 minutes. First calls handled the same day. Assisted setup if you need it.' },
        { q: 'What payment methods do you accept?', a: 'Credit card (Visa, Mastercard, Amex), SEPA, wire transfer for Enterprise and annual accounts.' },
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
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-4" style={{ color: '#7a5fff' }}>
                {isFr ? 'Tarifs' : 'Pricing'}
              </span>
              <h1
                id="pricing-heading"
                className="text-[clamp(2.6rem,6vw,5rem)] font-semibold tracking-[-0.04em] leading-[0.98]"
              >
                {isFr ? (
                  <>
                    Un prix.<br />
                    <span className="font-serif italic" style={{ color: '#7a5fff' }}>Tout</span>{' '}
                    <span className="font-serif italic" style={{ color: '#cd6afb' }}>compris.</span>
                  </>
                ) : (
                  <>
                    One price.<br />
                    <span className="font-serif italic" style={{ color: '#7a5fff' }}>Everything</span>{' '}
                    <span className="font-serif italic" style={{ color: '#cd6afb' }}>included.</span>
                  </>
                )}
              </h1>
            </div>
            </Reveal>
            <Reveal delay={0.12}>
            {/* Frame the value before showing the number: read cold, €99 sits
                next to a €49 tool. Read after the comparison a customer
                actually faces, a part-time receptionist, it reads cheap. */}
            <p className="text-[#525257] text-[15px] leading-relaxed max-w-[400px]">
              {isFr
                ? 'Une secrétaire à mi-temps coûte environ 1 200 € par mois, charges comprises, et ne répond pas le samedi. Qwillio commence à 99 €.'
                : 'A part-time receptionist costs around €1,200 a month all in, and does not answer on Saturday. Qwillio starts at €99.'}
            </p>
            <p className="text-[#86868b] text-[13px] leading-relaxed max-w-[400px] mt-3">
              {isFr
                ? '7 jours d’essai sur tous les plans. Carte requise, rien n’est débité avant la fin. Annulez en un clic.'
                : '7-day trial on every plan. Card required, nothing charged until it ends. Cancel anytime.'}
            </p>
            </Reveal>
          </div>
        </section>

        {/* ── BILLING TOGGLE — Monthly / Annual (−20%) ─────────────── */}
        <section aria-label={isFr ? 'Choisir la fréquence de facturation' : 'Choose billing frequency'} className="px-6 pb-8 md:pb-10">
          <div className="max-w-[1240px] mx-auto flex justify-center">
            <div
              role="group"
              aria-label={isFr ? 'Fréquence de facturation' : 'Billing frequency'}
              className="inline-flex items-center gap-1 p-1 rounded-full border border-[#1d1d1f]/10 bg-[#fafaf8]"
            >
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                aria-pressed={billing === 'monthly'}
                className={`px-4 sm:px-5 py-2 rounded-full text-[13px] font-medium transition-colors active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fff]/40 ${
                  billing === 'monthly' ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {isFr ? 'Mensuel' : 'Monthly'}
              </button>
              <button
                type="button"
                onClick={() => setBilling('annual')}
                aria-pressed={billing === 'annual'}
                className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-[13px] font-medium transition-colors active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fff]/40 ${
                  billing === 'annual' ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {isFr ? 'Annuel' : 'Annual'}
                <span
                  className="text-[10px] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    background: billing === 'annual' ? '#b9a8ff' : 'rgba(122,95,255,0.10)',
                    color: billing === 'annual' ? '#1d1d1f' : '#7a5fff',
                  }}
                >
                  −20 %
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ── PRICING BENTO : four tiers, Pro dominant ───────────── */}
        <section aria-label={isFr ? 'Plans tarifaires' : 'Pricing plans'} className="px-6 pb-24 md:pb-32">
          <div className="max-w-[1240px] mx-auto grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.25fr_1fr] gap-5 items-stretch">
            {tiers.map((tier, i) => {
              const isPro = tier.popular;
              return (
                <Reveal key={tier.id} delay={i * 0.08}>
                <Card3D intensity={isPro ? 4 : 3}>
                <article
                  aria-label={tier.name}
                  className={`relative rounded-3xl sm:rounded-[2rem] p-7 sm:p-8 lg:p-7 xl:p-9 flex flex-col ${
                    isPro ? 'text-white mt-3 sm:mt-0' : 'border border-[#1d1d1f]/10 bg-[#fafaf8] text-[#1d1d1f]'
                  }`}
                  style={
                    isPro
                      ? { background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #7a5fff 115%)' }
                      : undefined
                  }
                >
                  {tier.badge && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full whitespace-nowrap"
                      style={{ background: '#cd6afb', color: '#fff' }}
                    >
                      {tier.badge}
                    </span>
                  )}

                  <header className="mb-6">
                    <h2 className={`text-2xl font-semibold tracking-[-0.02em] mb-1 ${isPro ? 'text-white' : 'text-[#1d1d1f]'}`}>
                      {tier.name}
                    </h2>
                    <p className={`text-sm ${isPro ? 'text-white/60' : 'text-[#6e6e73]'}`}>
                      {tier.description}
                    </p>
                  </header>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[clamp(2.2rem,3.2vw,3rem)] font-semibold tracking-[-0.04em] tabular-nums ${isPro ? 'text-white' : 'text-[#1d1d1f]'}`}>
                        {priceFor(tier.monthly).toLocaleString('fr-FR')}&nbsp;€
                      </span>
                      <span className={`text-sm ${isPro ? 'text-white/60' : 'text-[#6e6e73]'}`}>
                        /{perLabel}
                      </span>
                    </div>
                    {billing === 'annual' && (
                      <p className={`text-[11px] mt-1 ${isPro ? 'text-white/50' : 'text-[#6e6e73]'}`}>
                        {isFr
                          ? `Facturé ${(priceFor(tier.monthly) * 12).toLocaleString('fr-FR')} €/an`
                          : `Billed ${(priceFor(tier.monthly) * 12).toLocaleString('fr-FR')} €/yr`}
                      </p>
                    )}
                    <p className={`text-xs mt-2 ${isPro ? 'text-[#b9a8ff]' : 'text-[#7a5fff]'}`}>
                      · {isFr ? '7 jours d\'essai, sans frais d\'installation' : '7-day trial, no setup fee'}
                    </p>
                  </div>

                  <ul role="list" className={`space-y-3 mb-8 flex-1 ${isPro ? 'text-white/85' : 'text-[#424245]'}`}>
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm leading-relaxed">
                        <Check
                          size={16}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: isPro ? '#b9a8ff' : '#7a5fff' }}
                          aria-hidden="true"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <p className={`text-xs mb-4 ${isPro ? 'text-white/45' : 'text-[#6e6e73]'}`}>
                    {isFr
                      ? `Dépassement : ${tier.overage.toFixed(2).replace('.', ',')} €/min au-delà des ${tier.minutes.toLocaleString('fr-FR')} minutes incluses`
                      : `Overage: €${tier.overage.toFixed(2)}/min beyond ${tier.minutes.toLocaleString('fr-FR')} included minutes`}
                  </p>

                  <Link
                    to="/register"
                    className={`inline-flex items-center justify-center gap-2 text-sm font-medium pl-5 pr-6 py-3.5 rounded-full transition-colors ${
                      isPro
                        ? 'bg-white text-[#1d1d1f] hover:bg-[#b9a8ff]'
                        : 'bg-[#1d1d1f] text-white hover:bg-[#7a5fff]'
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

        {/* ── ROI CALLOUT — narrative comparison, no hero-metric grids ── */}
        {(() => {
          // Fair comparison basis: a 20h/week human receptionist in Belgium
          // costs ~2,300 EUR loaded. Qwillio Starter (750 included minutes,
          // 24/7, bilingual) is the honest counterpart at a fraction of the cost.
          const humanMonthly = 2300;                       // EUR loaded
          const qwillioMonthlyEur = priceFor(249);         // Starter, honors annual toggle
          const monthlySavings = humanMonthly - qwillioMonthlyEur;
          const yearlySavings = monthlySavings * 12;
          const savingsPct = Math.round((monthlySavings / humanMonthly) * 100);
          const fmt = (n: number) => n.toLocaleString('fr-FR');

          const humanRow = isFr
            ? `Un mi-temps humain en Belgique : environ 2 300 € tout compris (brut, charges, chèques repas, backup absences, turnover), pour 20 h par semaine, dans une seule langue.`
            : `A part-time human in Belgium: roughly 2,300 EUR loaded per month (gross, social charges, meal vouchers, absence backup, turnover), for 20 hours a week, in a single language.`;

          const qwillioRow = isFr
            ? `Qwillio Starter : ${fmt(qwillioMonthlyEur)} € par mois, 750 minutes incluses, facturation à la minute au-delà, français et anglais sur le même compte, 24 heures sur 24, 365 jours par an, sans arrêt et sans turnover.`
            : `Qwillio Starter: ${fmt(qwillioMonthlyEur)} EUR a month, 750 included minutes, billed by the minute beyond that, French and English on the same account, 24 hours a day, 365 days a year, no downtime and no turnover.`;

          return (
            <section
              aria-labelledby="roi-heading"
              className="px-6 pb-16 md:pb-24 border-t border-[#1d1d1f]/8 pt-14 md:pt-20"
            >
              <div className="max-w-[820px] mx-auto">
                <Reveal>
                  <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-3" style={{ color: '#cd6afb' }}>
                    {isFr ? 'Retour sur investissement' : 'Return on investment'}
                  </span>
                </Reveal>
                <Reveal delay={0.06}>
                  <h2
                    id="roi-heading"
                    className="text-[clamp(1.9rem,4vw,3.2rem)] font-semibold tracking-[-0.03em] leading-[1.05]"
                  >
                    {isFr ? (
                      <>Une réceptionniste,{' '}<span className="font-serif italic" style={{ color: '#7a5fff' }}>{savingsPct} % moins chère.</span></>
                    ) : (
                      <>A receptionist,{' '}<span className="font-serif italic" style={{ color: '#7a5fff' }}>{savingsPct}% cheaper.</span></>
                    )}
                  </h2>
                </Reveal>

                <Reveal delay={0.12}>
                  <p className="mt-6 text-[17px] leading-[1.75] text-[#424245]">
                    {humanRow}
                  </p>
                </Reveal>
                <Reveal delay={0.16}>
                  <p className="mt-4 text-[17px] leading-[1.75] text-[#424245]">
                    {qwillioRow}
                  </p>
                </Reveal>

                <Reveal delay={0.22}>
                  <p className="mt-6 text-[17px] leading-[1.75]" style={{ color: '#1d1d1f' }}>
                    {isFr ? (
                      <>Le calcul se règle en une phrase : vous économisez{' '}<span className="font-semibold tabular-nums" style={{ color: '#7a5fff' }}>{fmt(monthlySavings)} €</span>{' '}par mois, soit{' '}<span className="font-semibold tabular-nums" style={{ color: '#cd6afb' }}>{fmt(yearlySavings)} €</span>{' '}sur la première année, en couvrant deux fois plus d'heures et deux fois plus de langues.</>
                    ) : (
                      <>The math lands in one line: you save{' '}<span className="font-semibold tabular-nums" style={{ color: '#7a5fff' }}>{fmt(monthlySavings)} EUR</span>{' '}a month, or{' '}<span className="font-semibold tabular-nums" style={{ color: '#cd6afb' }}>{fmt(yearlySavings)} EUR</span>{' '}over the first year, while covering twice the hours and twice the languages.</>
                    )}
                  </p>
                </Reveal>

                <Reveal delay={0.28}>
                  <p className="mt-4 text-[13px] text-[#6e6e73]">
                    {isFr
                      ? 'Basé sur un mi-temps CP200 chargé (brut + ONSS 27 % + chèques repas + transport + backup + turnover) et le tier Qwillio Starter (750 minutes incluses), mensuel ou annuel selon le sélecteur ci-dessus. Prix de lancement.'
                      : 'Based on a CP200 loaded part-time (gross + 27% ONSS + meal vouchers + transport + backup + turnover) and the Qwillio Starter tier (750 included minutes), monthly or annual depending on the toggle above. Launch pricing.'}
                  </p>
                </Reveal>
              </div>
            </section>
          );
        })()}

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
                ? <>Tout ce qui change. <span className="text-[#6e6e73] font-normal">Et tout ce qui reste pareil.</span></>
                : <>What changes. <span className="text-[#6e6e73] font-normal">And what stays the same.</span></>}
            </h2>
            </Reveal>

            {(() => {
              // One entry per tier, in the same order as `tiers`
              // (Solo, Starter, Pro, Enterprise).
              const rows = isFr
                ? [
                    ['Minutes incluses', '250', '750', '2 000', '5 000'],
                    // Derived, not hardcoded: the cards already run through
                    // priceFor(), so a fixed row here contradicted them the
                    // moment the annual toggle was flipped.
                    [`Prix / ${perLabel}`, ...tiers.map(t => `${priceFor(t.monthly).toLocaleString('fr-FR')} €`)],
                    ['Dépassement / minute', '0,45 €', '0,39 €', '0,35 €', '0,30 €'],
                    ['IA 24/7', 'FR', 'FR + EN', 'FR + EN', 'FR + EN'],
                    ['Prise de RDV + agenda', '✓', '✓', '✓', '✓'],
                    ['Transfert des urgences', '✓', '✓', '✓', '✓'],
                    ['Bouclier anti-spam', '✓', '✓', '✓', '✓'],
                    ['Transcription + sentiment', '·', '✓', '✓', '✓'],
                    ['Analytiques avancées', '·', '·', '✓', '✓'],
                    ['Intégrations CRM natives', '·', '·', '✓', '✓'],
                    ['Accès API complet', '·', '·', '·', '✓'],
                    ['SLA 99,5% uptime', '·', '·', '·', '✓'],
                    ['Responsable dédié', '·', '·', '·', '✓'],
                    ['Support', 'Email', 'Email', 'Prioritaire', 'Dédié'],
                  ]
                : [
                    ['Minutes included', '250', '750', '2,000', '5,000'],
                    [`Price / ${perLabel}`, ...tiers.map(t => `€${priceFor(t.monthly).toLocaleString('en-US')}`)],
                    ['Overage per minute', '€0.45', '€0.39', '€0.35', '€0.30'],
                    ['24/7 AI', 'FR', 'FR + EN', 'FR + EN', 'FR + EN'],
                    ['Booking + calendar', '✓', '✓', '✓', '✓'],
                    ['Urgency transfer', '✓', '✓', '✓', '✓'],
                    ['Spam shield', '✓', '✓', '✓', '✓'],
                    ['Transcript + sentiment', '·', '✓', '✓', '✓'],
                    ['Advanced analytics', '·', '·', '✓', '✓'],
                    ['Native CRM integrations', '·', '·', '✓', '✓'],
                    ['Full API access', '·', '·', '·', '✓'],
                    ['99.5% uptime SLA', '·', '·', '·', '✓'],
                    ['Dedicated manager', '·', '·', '·', '✓'],
                    ['Support', 'Email', 'Email', 'Priority', 'Dedicated'],
                  ];
              return (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1d1d1f]/15">
                          <th className="text-left py-4 font-normal text-[#6e6e73] text-xs uppercase tracking-wider">
                            {isFr ? 'Fonction' : 'Feature'}
                          </th>
                          {tiers.map((t) => (
                            <th
                              key={t.id}
                              className={`text-center py-4 font-semibold text-sm ${
                                t.popular ? 'text-[#7a5fff]' : 'text-[#1d1d1f]'
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
                            {/* One cell per tier so the highlighted column
                                follows `popular` instead of a fixed index. */}
                            {tiers.map((t, ti) =>
                              t.popular ? (
                                <td
                                  key={t.id}
                                  className="py-3.5 text-center font-semibold"
                                  style={{ background: 'rgba(122,95,255,0.04)', color: '#7a5fff' }}
                                >
                                  {row[ti + 1]}
                                </td>
                              ) : (
                                <td key={t.id} className="py-3.5 text-center text-[#525257]">
                                  {row[ti + 1]}
                                </td>
                              )
                            )}
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
                            tier.popular ? 'text-[#7a5fff]' : 'text-[#1d1d1f]'
                          }`}
                        >
                          <span className="font-semibold text-base">{tier.name}</span>
                          <span className="text-xs text-[#6e6e73]">
                            {isFr ? 'Voir détails' : 'View details'}
                          </span>
                        </summary>
                        <dl className="border-t border-[#1d1d1f]/8 divide-y divide-[#1d1d1f]/6 text-sm">
                          {rows.map((row) => (
                            <div key={row[0]} className="flex items-center justify-between px-5 py-3 gap-4">
                              <dt className="text-[#525257]">{row[0]}</dt>
                              <dd className={`font-semibold text-right ${tier.popular ? 'text-[#7a5fff]' : 'text-[#1d1d1f]'}`}>
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

        {/* ── VS COMPETITORS — head-to-head across the market ─────── */}
        <section
          aria-labelledby="vs-heading"
          className="px-6 py-14 sm:py-18 md:py-28 border-t border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <div className="mb-8 md:mb-12 max-w-[720px]">
                <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-3" style={{ color: '#cd6afb' }}>
                  {isFr ? 'Face à la concurrence' : 'Head to head'}
                </span>
                <h2
                  id="vs-heading"
                  className="text-[clamp(1.8rem,3.6vw,2.8rem)] font-semibold tracking-[-0.025em] leading-[1.05]"
                >
                  {isFr
                    ? <>Qwillio vs le marché. <span className="text-[#6e6e73] font-normal">Rien à cacher.</span></>
                    : <>Qwillio vs the market. <span className="text-[#6e6e73] font-normal">Nothing to hide.</span></>}
                </h2>
                <p className="mt-4 text-[15px] text-[#525257] leading-relaxed max-w-[560px]">
                  {isFr
                    ? 'Comparaison honnête sur les acteurs les plus cités en 2026. Chiffres publics, volumes équivalents.'
                    : 'Honest comparison against the most-cited providers in 2026. Public numbers, equivalent volumes.'}
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="overflow-x-auto rounded-2xl border border-[#1d1d1f]/10 shadow-[0_1px_0_rgba(29,29,31,0.03)]">
                <table className="w-full text-[13.5px] border-collapse">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      {[
                        { label: isFr ? 'Critère' : 'Feature', accent: false },
                        { label: 'Qwillio', accent: true },
                        { label: 'Rosie', accent: false },
                        { label: 'Smith.ai', accent: false },
                        { label: 'Yelda', accent: false },
                      ].map((h, i) => (
                        <th
                          key={i}
                          scope="col"
                          className={`text-left px-4 py-3 font-semibold border-b border-[#1d1d1f]/10 whitespace-nowrap ${h.accent ? 'text-[#7a5fff]' : 'text-[#1d1d1f]'}`}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1d1d1f]/8">
                    {(() => {
                      const yes = <span className="inline-flex items-center gap-1 text-[#059669]"><Check size={14} aria-hidden="true" /> {isFr ? 'Oui' : 'Yes'}</span>;
                      const no = <span className="inline-flex items-center gap-1 text-[#dc2626]"><X size={14} aria-hidden="true" /> {isFr ? 'Non' : 'No'}</span>;
                      const rows: Array<[string, React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode]> = [
                        [
                          isFr ? 'Frais de setup' : 'Setup fees',
                          isFr ? 'Aucun' : 'None',
                          isFr ? 'Aucun' : 'None',
                          isFr ? 'Aucun' : 'None',
                          isFr ? '3 000 – 8 000 €' : '€3,000 – €8,000',
                        ],
                        [
                          isFr ? 'Temps de mise en route' : 'Time to first call',
                          '15 min',
                          isFr ? '1 h' : '1 hour',
                          isFr ? '1 jour' : '1 day',
                          isFr ? '4 à 8 sem' : '4 to 8 weeks',
                        ],
                        [isFr ? 'Français natif' : 'French native', yes, no, no, yes],
                        [isFr ? 'Bilingue sur un même appel' : 'Bilingual on the same call', yes, no, no, no],
                        [isFr ? 'Hébergement UE / RGPD' : 'EU hosting / GDPR', yes, no, no, yes],
                        [isFr ? 'CRM natif inclus' : 'Native CRM included', yes, isFr ? 'Zapier' : 'Zapier', yes, isFr ? 'Sur-mesure' : 'Custom'],
                        [isFr ? 'Prise de RDV agenda native' : 'Native calendar booking', yes, isFr ? 'Tier sup.' : 'Higher tier', yes, isFr ? 'Sur-mesure' : 'Custom'],
                        [isFr ? 'Onboarding self-serve' : 'Self-serve onboarding', <>{yes} <span className="text-[11px] text-[#6e6e73]">15 min</span></>, yes, isFr ? 'Partiel' : 'Partial', no],
                        [isFr ? '7 jours d’essai' : '7-day free trial', yes, no, isFr ? 'Cas par cas' : 'Case by case', no],
                        [isFr ? 'Résiliable au mois' : 'Cancel monthly', yes, yes, yes, isFr ? 'Contrat' : 'Contract'],
                      ];
                      return rows.map(([label, q, r, s, y], i) => (
                        <tr key={i} className="hover:bg-[#fafaf8] transition-colors">
                          <td className="px-4 py-2.5 font-medium text-[#1d1d1f] align-top">{label}</td>
                          <td className="px-4 py-2.5 align-top bg-[rgba(122,95,255,0.05)] text-[#1d1d1f] font-semibold">{q}</td>
                          <td className="px-4 py-2.5 align-top text-[#424245]">{r}</td>
                          <td className="px-4 py-2.5 align-top text-[#424245]">{s}</td>
                          <td className="px-4 py-2.5 align-top text-[#424245]">{y}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px]">
                <Link
                  to="/vs/smith-ai"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-medium bg-[#1d1d1f] text-white hover:bg-[#7a5fff] transition-colors active:scale-[0.97]"
                >
                  {isFr ? 'Détail vs Smith.ai' : 'Full vs Smith.ai'}
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
                <Link
                  to="/vs/yelda"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-medium bg-[#1d1d1f] text-white hover:bg-[#7a5fff] transition-colors active:scale-[0.97]"
                >
                  {isFr ? 'Détail vs Yelda' : 'Full vs Yelda'}
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
                <span className="text-xs text-[#6e6e73]">
                  {isFr
                    ? 'Sources publiques 2026. Comparatif détaillé par acteur sur nos pages dédiées.'
                    : 'Public 2026 sources. Full detail per provider on our dedicated pages.'}
                </span>
              </div>
            </Reveal>
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
                      <span className="text-base md:text-lg font-medium text-[#1d1d1f] group-hover:text-[#7a5fff] transition-colors">
                        {f.q}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#7a5fff]' : 'text-[#6e6e73]'}`}
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
                  <span className="font-serif italic" style={{ color: '#7a5fff' }}>économiser</span>{' '}
                  <span className="font-serif italic" style={{ color: '#cd6afb' }}>du temps ?</span>
                </>
              ) : (
                <>
                  Ready to<br />
                  <span className="font-serif italic" style={{ color: '#7a5fff' }}>save</span>{' '}
                  <span className="font-serif italic" style={{ color: '#cd6afb' }}>time?</span>
                </>
              )}
            </h2>
            </Reveal>
            <Reveal delay={0.1}>
            <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right pb-4">
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[320px] lg:ml-auto">
                {isFr
                  ? 'Sans engagement. 7 jours d’essai gratuit.'
                  : 'No commitment. 7-day free trial.'}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#7a5fff] transition-colors"
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
