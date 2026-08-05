import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown, ArrowRight, X } from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink, PillButton } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import FaqAccordion from '../../components/v2/FaqAccordion';

/* Pricing V2 « Papier & Signal », voir DA/v2-direction.md.
   Copie FR/EN, tarifs et calcul ROI portés de la V1 (pages/Pricing.tsx). */

interface Tier {
  id: string;
  name: string;
  badge?: string;
  /* Étiquette de positionnement, portée de la bannière Solo de la V1 */
  flag?: string;
  note?: string;
  monthly: number;
  minutes: number;
  overage: number;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

interface CompareGroup {
  label: string;
  rows: string[][];
}

export default function Pricing() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
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
      flag: isFr ? 'Nouveau : Belgique & France' : 'New: Belgium & France',
      note: isFr
        ? 'PME, artisans, professions libérales (français, hébergement UE).'
        : 'Small businesses, tradespeople, liberal professions (French, EU hosting).',
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

  const pro = tiers.find((t) => t.popular) as Tier;
  const secondary = tiers.filter((t) => !t.popular);

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

  /* Base de comparaison V1: un mi-temps humain chargé en Belgique face au tier
     Starter, le sélecteur annuel étant honoré par priceFor(). */
  const humanMonthly = 2300;
  const qwillioMonthlyEur = priceFor(249);
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

  /* Mêmes lignes que la V1, regroupées pour permettre le repli par groupe.
     La ligne prix reste dérivée de priceFor() pour suivre le sélecteur. */
  const compareGroups: CompareGroup[] = isFr
    ? [
        {
          label: 'Volumes et tarifs',
          rows: [
            ['Minutes incluses', '250', '750', '2 000', '5 000'],
            [`Prix / ${perLabel}`, ...tiers.map((t) => `${priceFor(t.monthly).toLocaleString('fr-FR')} €`)],
            ['Dépassement / minute', '0,45 €', '0,39 €', '0,35 €', '0,30 €'],
          ],
        },
        {
          label: 'Capacités',
          rows: [
            ['IA 24/7', 'FR', 'FR + EN', 'FR + EN', 'FR + EN'],
            ['Prise de RDV + agenda', '✓', '✓', '✓', '✓'],
            ['Transfert des urgences', '✓', '✓', '✓', '✓'],
            ['Bouclier anti-spam', '✓', '✓', '✓', '✓'],
            ['Transcription + sentiment', '·', '✓', '✓', '✓'],
            ['Analytiques avancées', '·', '·', '✓', '✓'],
            ['Intégrations CRM natives', '·', '·', '✓', '✓'],
            ['Accès API complet', '·', '·', '·', '✓'],
          ],
        },
        {
          label: 'Engagements et support',
          rows: [
            ['SLA 99,5% uptime', '·', '·', '·', '✓'],
            ['Responsable dédié', '·', '·', '·', '✓'],
            ['Support', 'Email', 'Email', 'Prioritaire', 'Dédié'],
          ],
        },
      ]
    : [
        {
          label: 'Volume and pricing',
          rows: [
            ['Minutes included', '250', '750', '2,000', '5,000'],
            [`Price / ${perLabel}`, ...tiers.map((t) => `€${priceFor(t.monthly).toLocaleString('en-US')}`)],
            ['Overage per minute', '€0.45', '€0.39', '€0.35', '€0.30'],
          ],
        },
        {
          label: 'Capabilities',
          rows: [
            ['24/7 AI', 'FR', 'FR + EN', 'FR + EN', 'FR + EN'],
            ['Booking + calendar', '✓', '✓', '✓', '✓'],
            ['Urgency transfer', '✓', '✓', '✓', '✓'],
            ['Spam shield', '✓', '✓', '✓', '✓'],
            ['Transcript + sentiment', '·', '✓', '✓', '✓'],
            ['Advanced analytics', '·', '·', '✓', '✓'],
            ['Native CRM integrations', '·', '·', '✓', '✓'],
            ['Full API access', '·', '·', '·', '✓'],
          ],
        },
        {
          label: 'Commitments and support',
          rows: [
            ['99.5% uptime SLA', '·', '·', '·', '✓'],
            ['Dedicated manager', '·', '·', '·', '✓'],
            ['Support', 'Email', 'Email', 'Priority', 'Dedicated'],
          ],
        },
      ];

  const yes = (
    <span className="inline-flex items-center gap-1.5 text-q2-ink font-medium">
      <Check size={14} className="text-q2-indigo" aria-hidden="true" />
      {isFr ? 'Oui' : 'Yes'}
    </span>
  );
  const no = (
    <span className="inline-flex items-center gap-1.5 text-q2-body">
      <X size={14} aria-hidden="true" />
      {isFr ? 'Non' : 'No'}
    </span>
  );

  const vsRows: { label: string; qwillio: ReactNode; rosie: ReactNode; smith: ReactNode; yelda: ReactNode }[] = [
    {
      label: isFr ? 'Frais de setup' : 'Setup fees',
      qwillio: isFr ? 'Aucun' : 'None',
      rosie: isFr ? 'Aucun' : 'None',
      smith: isFr ? 'Aucun' : 'None',
      yelda: isFr ? '3 000 – 8 000 €' : '€3,000 – €8,000',
    },
    {
      label: isFr ? 'Temps de mise en route' : 'Time to first call',
      qwillio: '15 min',
      rosie: isFr ? '1 h' : '1 hour',
      smith: isFr ? '1 jour' : '1 day',
      yelda: isFr ? '4 à 8 sem' : '4 to 8 weeks',
    },
    {
      label: isFr ? 'Bilingue sur un même appel' : 'Bilingual on the same call',
      qwillio: yes,
      rosie: no,
      smith: no,
      yelda: no,
    },
    {
      label: isFr ? 'Hébergement UE / RGPD' : 'EU hosting / GDPR',
      qwillio: yes,
      rosie: no,
      smith: no,
      yelda: yes,
    },
    {
      label: isFr ? '7 jours d’essai' : '7-day free trial',
      qwillio: yes,
      rosie: no,
      smith: isFr ? 'Cas par cas' : 'Case by case',
      yelda: no,
    },
  ];

  const trialLine = isFr ? '7 jours d\'essai, sans frais d\'installation' : '7-day trial, no setup fee';

  const overageLine = (t: Tier) =>
    isFr
      ? `Dépassement\u00a0: ${t.overage.toFixed(2).replace('.', ',')}\u00a0€/min au-delà des ${t.minutes.toLocaleString('fr-FR')} minutes incluses`
      : `Overage: €${t.overage.toFixed(2)}/min beyond ${t.minutes.toLocaleString('fr-FR')} included minutes`;

  const annualLine = (monthlyPrice: number) =>
    isFr
      ? `Facturé ${(priceFor(monthlyPrice) * 12).toLocaleString('fr-FR')} €/an`
      : `Billed ${(priceFor(monthlyPrice) * 12).toLocaleString('fr-FR')} €/yr`;

  return (
    <PublicShell>
      {/* HERO */}
      <Section aria-labelledby="pricing-heading" className="!pt-16 md:!pt-24 !pb-12 md:!pb-16">
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-12 lg:gap-20 items-end">
          <RevealV2>
            <div>
              <Eyebrow tone="indigo" className="mb-6">
                {isFr ? 'Tarifs' : 'Pricing'}
              </Eyebrow>
              <Display className="mb-0">
                <span id="pricing-heading">
                  {isFr ? (
                    <>
                      Un prix. <SerifWord>Tout compris.</SerifWord>
                    </>
                  ) : (
                    <>
                      One price. <SerifWord>Everything included.</SerifWord>
                    </>
                  )}
                </span>
              </Display>
            </div>
          </RevealV2>

          <RevealV2 index={2}>
            <Lead className="max-w-[400px] q2-body-text">
              {isFr
                ? 'Une secrétaire à mi-temps coûte environ 1 200 € par mois, charges comprises, et ne répond pas le samedi. Qwillio commence à 99 €.'
                : 'A part-time receptionist costs around €1,200 a month all in, and does not answer on Saturday. Qwillio starts at €99.'}
            </Lead>
            <p className="text-q2-body text-[13px] leading-relaxed max-w-[400px] mt-4 q2-body-text">
              {isFr
                ? '7 jours d’essai sur tous les plans. Carte requise, rien n’est débité avant la fin. Annulez en un clic.'
                : '7-day trial on every plan. Card required, nothing charged until it ends. Cancel anytime.'}
            </p>
          </RevealV2>
        </Container>
      </Section>

      {/* TARIFS: Pro en grande card, les trois autres en rangées hairline */}
      <Section aria-label={isFr ? 'Plans tarifaires' : 'Pricing plans'} className="!pt-0">
        <Container>
          {/* Le sélecteur est fréquent: il ne s'anime pas (DA motion) */}
          <div
            role="group"
            aria-label={isFr ? 'Fréquence de facturation' : 'Billing frequency'}
            className="inline-flex items-center gap-1 p-1 rounded-full border border-q2-plate bg-q2-band mb-12"
          >
            <PillButton
              variant="ghost"
              onClick={() => setBilling('monthly')}
              aria-pressed={billing === 'monthly'}
              className={`!min-h-0 !px-5 !py-2 !text-[13px] !transition-none ${
                billing === 'monthly' ? '!bg-q2-ink !text-white' : '!text-q2-body hover:!bg-q2-plate'
              }`}
            >
              {isFr ? 'Mensuel' : 'Monthly'}
            </PillButton>
            <PillButton
              variant="ghost"
              onClick={() => setBilling('annual')}
              aria-pressed={billing === 'annual'}
              className={`!min-h-0 !px-5 !py-2 !text-[13px] !transition-none ${
                billing === 'annual' ? '!bg-q2-ink !text-white' : '!text-q2-body hover:!bg-q2-plate'
              }`}
            >
              {isFr ? 'Annuel' : 'Annual'}
              <span
                className={`text-[10px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full ${
                  billing === 'annual' ? 'bg-white/15 text-white' : 'bg-q2-plate text-q2-graphite'
                }`}
              >
                −20&nbsp;%
              </span>
            </PillButton>
          </div>

          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-6 lg:gap-10 items-start">
            {/* Colonne discrète: Solo, Starter, Enterprise en rangées */}
            <ol className="border-t border-q2-plate" role="list">
              {secondary.map((tier, i) => (
                <RevealV2 key={tier.id} index={i} as="li" className="border-b border-q2-plate">
                  <article className="py-8 md:py-10">
                    {tier.flag && (
                      <span className="q2-eyebrow text-q2-indigo inline-flex items-center rounded-full border border-q2-plate px-3 py-1.5 mb-5">
                        {tier.flag}
                      </span>
                    )}

                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                      <div>
                        <h2 className="q2-h3 text-q2-ink">{tier.name}</h2>
                        <p className="text-sm text-q2-body mt-1 q2-body-text">{tier.description}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[clamp(1.7rem,2.4vw,2.2rem)] font-light tracking-[-0.04em] tabular-nums text-q2-ink leading-none">
                          {priceFor(tier.monthly).toLocaleString('fr-FR')}&nbsp;€
                          <span className="text-sm text-q2-body font-normal tracking-normal">/{perLabel}</span>
                        </p>
                        {billing === 'annual' && (
                          <p className="text-[11px] text-q2-body mt-1.5">{annualLine(tier.monthly)}</p>
                        )}
                      </div>
                    </div>

                    {tier.note && (
                      <p className="text-sm text-q2-body mt-4 max-w-[440px] leading-relaxed q2-body-text">{tier.note}</p>
                    )}

                    <ul role="list" className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-q2-graphite leading-relaxed">
                          <Check size={14} className="shrink-0 mt-1 text-q2-indigo" aria-hidden="true" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                      <p className="text-xs text-q2-body max-w-[420px] leading-relaxed">{overageLine(tier)}</p>
                      <PillLink to="/register" variant="outline">
                        {tier.cta}
                        <ArrowRight size={15} aria-hidden="true" />
                      </PillLink>
                    </div>
                  </article>
                </RevealV2>
              ))}
            </ol>

            {/* Pro: la seule surface élevée de la page */}
            <RevealV2 index={1} className="lg:sticky lg:top-24">
              <CardV2 variant="canvas" large hover className="md:p-10">
                {pro.badge && (
                  <span className="q2-eyebrow text-q2-indigo inline-flex items-center rounded-full border border-q2-indigo/30 px-3 py-1.5 mb-7">
                    {pro.badge}
                  </span>
                )}

                <h2 className="q2-h2 text-q2-ink">{pro.name}</h2>
                <p className="text-[15px] text-q2-body mt-2 q2-body-text">{pro.description}</p>

                <p className="q2-price text-q2-ink mt-8 leading-none">
                  {priceFor(pro.monthly).toLocaleString('fr-FR')}&nbsp;€
                  <span className="text-sm text-q2-body font-normal tracking-normal">/{perLabel}</span>
                </p>
                {billing === 'annual' && (
                  <p className="text-[11px] text-q2-body mt-2">{annualLine(pro.monthly)}</p>
                )}
                <ul role="list" className="mt-8 border-t border-q2-plate">
                  {pro.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 text-[15px] text-q2-graphite leading-relaxed border-b border-q2-plate py-3.5"
                    >
                      <Check size={16} className="shrink-0 mt-0.5 text-q2-indigo" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-q2-body mt-6 leading-relaxed">{overageLine(pro)}</p>

                <PillLink to="/register" variant="primary" size="lg" className="mt-6 w-full">
                  {pro.cta}
                  <ArrowRight size={16} aria-hidden="true" />
                </PillLink>
              </CardV2>
            </RevealV2>
          </div>

          <p className="text-xs text-q2-body mt-8">· {trialLine}</p>
        </Container>
      </Section>

      {/* ROI: bande taupe hairline, comparaison narrative */}
      <Section variant="band" hairline aria-labelledby="roi-heading">
        <Container>
          <div className="max-w-[820px]">
            <RevealV2>
              <Eyebrow tone="violet" className="mb-4">
                {isFr ? 'Retour sur investissement' : 'Return on investment'}
              </Eyebrow>
              <H2 id="roi-heading">
                {isFr ? (
                  <>
                    Une réceptionniste, <SerifWord>{savingsPct}&nbsp;% moins chère.</SerifWord>
                  </>
                ) : (
                  <>
                    A receptionist, <SerifWord>{savingsPct}% cheaper.</SerifWord>
                  </>
                )}
              </H2>
            </RevealV2>

            <RevealV2 index={1}>
              <p className="mt-8 text-[17px] leading-[1.75] text-q2-body q2-body-text">{humanRow}</p>
              <p className="mt-4 text-[17px] leading-[1.75] text-q2-body q2-body-text">{qwillioRow}</p>
            </RevealV2>

            <RevealV2 index={2}>
              <p className="mt-6 text-[17px] leading-[1.75] text-q2-ink q2-body-text">
                {isFr ? (
                  <>
                    Le calcul se règle en une phrase&nbsp;: vous économisez{' '}
                    <span className="font-medium tabular-nums">{fmt(monthlySavings)}&nbsp;€</span> par mois, soit{' '}
                    <span className="font-medium tabular-nums">{fmt(yearlySavings)}&nbsp;€</span> sur la première année,
                    en couvrant deux fois plus d'heures et deux fois plus de langues.
                  </>
                ) : (
                  <>
                    The math lands in one line: you save{' '}
                    <span className="font-medium tabular-nums">{fmt(monthlySavings)}&nbsp;EUR</span> a month, or{' '}
                    <span className="font-medium tabular-nums">{fmt(yearlySavings)}&nbsp;EUR</span> over the first year,
                    while covering twice the hours and twice the languages.
                  </>
                )}
              </p>
              <p className="mt-4 text-[13px] text-q2-body leading-relaxed">
                {isFr
                  ? 'Basé sur un mi-temps CP200 chargé (brut + ONSS 27 % + chèques repas + transport + backup + turnover) et le tier Qwillio Starter (750 minutes incluses), mensuel ou annuel selon le sélecteur ci-dessus. Prix de lancement.'
                  : 'Based on a CP200 loaded part-time (gross + 27% ONSS + meal vouchers + transport + backup + turnover) and the Qwillio Starter tier (750 included minutes), monthly or annual depending on the toggle above. Launch pricing.'}
              </p>
            </RevealV2>
          </div>
        </Container>
      </Section>

      {/* COMPARATIF: groupes repliables, table sémantique */}
      <Section aria-labelledby="compare-heading" hairline>
        <Container>
          <RevealV2 className="mb-10">
            <H2 id="compare-heading" className="max-w-[640px]">
              {isFr ? (
                <>
                  Tout ce qui change. <span className="text-q2-body">Et tout ce qui reste pareil.</span>
                </>
              ) : (
                <>
                  What changes. <span className="text-q2-body">And what stays the same.</span>
                </>
              )}
            </H2>
          </RevealV2>

          <div className="border-t border-q2-plate">
            {compareGroups.map((group, gi) => (
              <RevealV2 key={group.label} index={gi}>
                <details className="group border-b border-q2-plate" open={gi === 0}>
                  <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none text-[15px] font-medium text-q2-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-md">
                    {group.label}
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-q2-body transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>

                  <div className="overflow-x-auto pb-6">
                    <table className="w-full min-w-[640px] text-sm border-collapse">
                      <caption className="sr-only">{group.label}</caption>
                      <thead>
                        <tr className="border-b border-q2-plate">
                          <th scope="col" className="text-left py-3 pr-4 font-normal text-q2-body text-xs uppercase tracking-[0.12em]">
                            {isFr ? 'Fonction' : 'Feature'}
                          </th>
                          {tiers.map((t) => (
                            <th
                              key={t.id}
                              scope="col"
                              className={`text-center py-3 px-3 text-sm font-medium ${
                                t.popular ? 'text-q2-ink' : 'text-q2-graphite'
                              }`}
                            >
                              {t.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row[0]} className="border-b border-q2-plate last:border-0">
                            <th scope="row" className="text-left py-3 pr-4 font-normal text-q2-graphite">
                              {row[0]}
                            </th>
                            {tiers.map((t, ti) => (
                              <td
                                key={t.id}
                                className={`py-3 px-3 text-center tabular-nums ${
                                  t.popular ? 'bg-q2-band text-q2-ink font-medium' : 'text-q2-body'
                                }`}
                              >
                                {row[ti + 1]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </RevealV2>
            ))}
          </div>
        </Container>
      </Section>

      {/* FACE AU MARCHÉ: version courte, le détail vit sur les pages /vs/* */}
      <Section variant="band" hairline aria-labelledby="vs-heading">
        <Container>
          <RevealV2 className="mb-10 max-w-[720px]">
            <Eyebrow tone="violet" className="mb-4">
              {isFr ? 'Face à la concurrence' : 'Head to head'}
            </Eyebrow>
            <H2 id="vs-heading">
              {isFr ? (
                <>
                  Qwillio vs le marché. <span className="text-q2-body">Rien à cacher.</span>
                </>
              ) : (
                <>
                  Qwillio vs the market. <span className="text-q2-body">Nothing to hide.</span>
                </>
              )}
            </H2>
            <p className="mt-4 text-[15px] text-q2-body leading-relaxed max-w-[560px] q2-body-text">
              {isFr
                ? 'Comparaison honnête sur les acteurs les plus cités en 2026. Chiffres publics, volumes équivalents.'
                : 'Honest comparison against the most-cited providers in 2026. Public numbers, equivalent volumes.'}
            </p>
          </RevealV2>

          <RevealV2 index={1}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[13.5px] border-collapse">
                <thead>
                  <tr className="border-b border-q2-plate">
                    {[
                      isFr ? 'Critère' : 'Feature',
                      'Qwillio',
                      'Rosie',
                      'Smith.ai',
                      'Yelda',
                    ].map((label, i) => (
                      <th
                        key={label}
                        scope="col"
                        className={`text-left px-4 py-3 font-medium whitespace-nowrap ${
                          i === 1 ? 'text-q2-ink' : 'text-q2-graphite'
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vsRows.map((row) => (
                    <tr key={row.label} className="border-b border-q2-plate last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-normal text-q2-graphite align-top">
                        {row.label}
                      </th>
                      <td className="px-4 py-3 align-top bg-q2-canvas text-q2-ink font-medium">{row.qwillio}</td>
                      <td className="px-4 py-3 align-top text-q2-body">{row.rosie}</td>
                      <td className="px-4 py-3 align-top text-q2-body">{row.smith}</td>
                      <td className="px-4 py-3 align-top text-q2-body">{row.yelda}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealV2>

          <RevealV2 index={2}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PillLink to="/vs/smith-ai" variant="outline">
                {isFr ? 'Détail vs Smith.ai' : 'Full vs Smith.ai'}
                <ArrowRight size={14} aria-hidden="true" />
              </PillLink>
              <PillLink to="/vs/yelda" variant="outline">
                {isFr ? 'Détail vs Yelda' : 'Full vs Yelda'}
                <ArrowRight size={14} aria-hidden="true" />
              </PillLink>
              <span className="text-xs text-q2-body max-w-[320px] leading-relaxed">
                {isFr
                  ? 'Sources publiques 2026. Comparatif détaillé par acteur sur nos pages dédiées.'
                  : 'Public 2026 sources. Full detail per provider on our dedicated pages.'}
              </span>
            </div>
          </RevealV2>
        </Container>
      </Section>

      {/* FAQ */}
      <Section aria-labelledby="faq-heading" hairline>
        <Container className="grid lg:grid-cols-[1fr_1.6fr] gap-10 lg:gap-16 items-start">
          <RevealV2>
            <H2 id="faq-heading">{isFr ? 'Questions fréquentes.' : 'Frequently asked.'}</H2>
          </RevealV2>
          <RevealV2 index={1}>
            <FaqAccordion items={faqs} />
          </RevealV2>
        </Container>
      </Section>

      {/* CTA FINAL: drenched, une seule pilule chromatique */}
      <Section variant="drenched-violet" aria-label={isFr ? 'Démarrer' : 'Get started'}>
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
          <RevealV2>
            <Display as="h2" onDark>
              {isFr ? (
                <>
                  Prêt à <SerifWord>économiser du temps&nbsp;?</SerifWord>
                </>
              ) : (
                <>
                  Ready to <SerifWord>save time?</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-2">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr ? 'Sans engagement. 7 jours d’essai gratuit.' : 'No commitment. 7-day free trial.'}
            </p>
            <PillLink to="/register" variant="chromatic" size="lg">
              {isFr ? 'Créer un compte' : 'Create account'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
