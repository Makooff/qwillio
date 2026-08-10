import { ArrowRight, Share2, Wallet, UserPlus, type LucideIcon } from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import FaqAccordion, { type FaqEntry } from '../../components/v2/FaqAccordion';
import ShapeDrift from '../../components/v2/motion/ShapeDrift';

/* Affiliate V2 « Papier & Signal », voir DA/v2-direction.md.
   Copie FR/EN, useSEO, paliers et FAQ portés de la V1 (pages/Affiliate.tsx).
   L'état d'ouverture de la FAQ est désormais tenu par FaqAccordion. */

interface Step {
  num: string;
  icon: LucideIcon;
  tone: 'indigo' | 'violet';
  title: string;
  desc: string;
}

export default function Affiliate() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr ? 'Programme d\'affiliation · Qwillio' : 'Affiliate program · Qwillio',
    description: isFr
      ? 'Gagnez 30% de commission récurrente. Aucun plafond.'
      : 'Earn 30% recurring commission. No cap.',
    canonical: 'https://qwillio.com/affiliate',
  });

  const steps: Step[] = [
    {
      num: '01',
      tone: 'indigo',
      icon: UserPlus,
      title: isFr ? 'Inscrivez-vous' : 'Sign up',
      desc: isFr
        ? 'Compte affilié créé en 30 secondes. Obtenez votre lien unique.'
        : 'Affiliate account created in 30 seconds. Get your unique link.',
    },
    {
      num: '02',
      tone: 'violet',
      icon: Share2,
      title: isFr ? 'Partagez' : 'Share',
      desc: isFr
        ? 'Lien dans vos emails, sur LinkedIn, votre site. Tracking automatique.'
        : 'Link in your emails, LinkedIn, your site. Automatic tracking.',
    },
    {
      num: '03',
      tone: 'indigo',
      icon: Wallet,
      title: isFr ? 'Encaissez' : 'Cash in',
      desc: isFr
        ? '30 % de chaque facture payée par vos filleuls, à vie, comptabilisé automatiquement.'
        : 'Monthly payout. 30% of recurring revenue from every referred customer, for life.',
    },
  ];

  const faqs: FaqEntry[] = isFr
    ? [
        { q: 'Quel est le taux de commission ?', a: '30% du MRR de chaque client recommandé, versé chaque mois tant que le client reste actif. Pas de plafond, pas de dégressivité.' },
        { q: 'Comment suis-je payé ?', a: 'Vos commissions s\'accumulent automatiquement dès qu\'un filleul paie une facture, et sont visibles en temps réel dans votre espace affilié. Le versement se fait par virement, sur demande.' },
        { q: 'Y a-t-il un cookie de tracking ?', a: 'Oui, 90 jours. Si un prospect clique sur votre lien puis souscrit dans les 90 jours, la commission vous revient.' },
        { q: 'Puis-je faire de l\'affiliation et être client ?', a: 'Bien sûr. Beaucoup de nos meilleurs affiliés sont des clients qui recommandent l\'outil qu\'ils utilisent eux-mêmes.' },
      ]
    : [
        { q: 'What is the commission rate?', a: '30% of recurring revenue from each referred customer, paid monthly for as long as they stay active. No cap, no decay.' },
        { q: 'How am I paid?', a: 'Commissions accrue automatically as soon as a referral pays an invoice, and show live in your affiliate dashboard. Payout is by bank transfer, on request.' },
        { q: 'Is there a tracking cookie?', a: 'Yes, 90 days. If a prospect clicks your link and subscribes within 90 days, the commission goes to you.' },
        { q: 'Can I be both an affiliate and a customer?', a: 'Of course. Many of our best affiliates are customers who recommend the tool they use themselves.' },
      ];

  const tiers = [
    {
      name: isFr ? 'Standard' : 'Standard',
      desc: isFr ? '1 à 9 clients actifs' : '1 to 9 active customers',
      rate: '30%',
      popular: false,
    },
    {
      name: 'Gold',
      desc: isFr ? '10 à 49 clients actifs' : '10 to 49 active customers',
      rate: '35%',
      popular: true,
    },
    {
      name: 'Platinum',
      desc: isFr ? '50+ clients actifs' : '50+ active customers',
      rate: '40%',
      popular: false,
    },
  ];

  return (
    <PublicShell>
      {/* HERO: titre whisper à gauche, promesse à droite */}
      <Section aria-label={isFr ? 'Programme d\'affiliation' : 'Affiliate program'} className="!pt-16 md:!pt-24">
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-end">
          <RevealV2>
            <Eyebrow tone="violet" className="mb-6">
              {isFr ? 'Programme d\'affiliation' : 'Affiliate program'}
            </Eyebrow>
            <Display>
              {isFr ? (
                <>
                  30&nbsp;% de commission.
                  <br />
                  <SerifWord>À vie.</SerifWord>
                </>
              ) : (
                <>
                  30% commission.
                  <br />
                  <SerifWord>For life.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1}>
            <Lead className="max-w-[460px] pb-3 q2-body-text">
              {isFr
                ? 'Pas de plafond. Pas de dégressivité. Pas de minimum mensuel. Recommandez Qwillio, encaissez chaque mois.'
                : 'No cap. No decay. No monthly minimum. Recommend Qwillio, get paid every month.'}
            </Lead>
          </RevealV2>
        </Container>
      </Section>

      {/* FONCTIONNEMENT: rangées hairline numérotées */}
      <Section variant="band" hairline aria-labelledby="how-heading" className="relative">
        <ShapeDrift shapes={[{ kind: 'quarters', x: '86%', y: '26%', size: 220, drift: 80, opacity: 0.22 }]} />
        <Container>
          <RevealV2 className="mb-14">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Fonctionnement' : 'How it works'}
            </Eyebrow>
            <H2 id="how-heading" className="max-w-[700px]">
              {isFr ? (
                <>
                  Trois étapes. <span className="text-q2-body">Vos gains comptabilisés en direct.</span>
                </>
              ) : (
                <>
                  Three steps. <span className="text-q2-body">Your earnings tallied live.</span>
                </>
              )}
            </H2>
          </RevealV2>

          <ol className="border-t border-q2-plate" role="list">
            {steps.map((s, i) => (
              <RevealV2 key={s.num} index={i} as="li" className="border-b border-q2-plate">
                <div className="grid md:grid-cols-[110px_1fr_1.4fr] gap-4 md:gap-10 py-10 md:py-12 items-start">
                  <p className="q2-price text-q2-plate select-none tabular-nums" aria-hidden="true">
                    {s.num}
                  </p>
                  <div className="flex items-center gap-3 md:pt-1">
                    <s.icon
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 ${s.tone === 'indigo' ? 'text-q2-indigo' : 'text-q2-violet'}`}
                    />
                    <h3 className="q2-h3 text-q2-ink">{s.title}</h3>
                  </div>
                  <p className="text-q2-body text-[15px] leading-relaxed max-w-[440px] q2-body-text md:pt-1.5">
                    {s.desc}
                  </p>
                </div>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      {/* PALIERS: drenched indigo, rangées hairline, taux en tabular-nums */}
      <Section variant="drenched-indigo" aria-labelledby="tiers-heading">
        <Container>
          <RevealV2 className="mb-14">
            <Eyebrow tone="indigo" onDark className="mb-4">
              {isFr ? 'Paliers' : 'Tiers'}
            </Eyebrow>
            <H2 id="tiers-heading" onDark className="max-w-[640px]">
              {isFr ? (
                <>
                  Plus vous recommandez, <SerifWord>plus vous touchez.</SerifWord>
                </>
              ) : (
                <>
                  The more you refer, <SerifWord>the more you earn.</SerifWord>
                </>
              )}
            </H2>
          </RevealV2>

          <ul className="border-t border-q2-graphite-d" role="list">
            {tiers.map((t, i) => (
              <RevealV2 key={t.name} index={i} as="li" className="border-b border-q2-graphite-d">
                <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 md:gap-10 py-8 md:py-10 items-baseline">
                  <p className="text-white text-lg font-light tracking-tight">{t.name}</p>
                  <p className="text-q2-fog text-[15px] q2-body-text">{t.desc}</p>
                  {/* Le seul élément chromatique de la section drenched: le palier central */}
                  <p className={`q2-price md:text-right ${t.popular ? 'text-q2-lift' : 'text-white'}`}>{t.rate}</p>
                </div>
              </RevealV2>
            ))}
          </ul>
        </Container>
      </Section>

      {/* FAQ: accordéon hairline, un item ouvert à la fois */}
      <Section aria-labelledby="faq-heading">
        <Container className="grid lg:grid-cols-[1fr_1.5fr] gap-10 lg:gap-20 items-start">
          <RevealV2>
            <Eyebrow tone="neutral" className="mb-4">
              FAQ
            </Eyebrow>
            <H2 id="faq-heading" className="max-w-[320px]">
              {isFr ? 'Questions fréquentes.' : 'Frequently asked.'}
            </H2>
          </RevealV2>
          <RevealV2 index={1}>
            <FaqAccordion items={faqs} />
          </RevealV2>
        </Container>
      </Section>

      {/* CTA FINAL: drenched, une seule action chromatique */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Devenir affilié' : 'Become an affiliate'}
        className="border-t border-q2-graphite-d"
      >
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
          <RevealV2>
            <Display as="h2" onDark>
              {isFr ? (
                <>
                  Prêt à toucher
                  <br />
                  <SerifWord>chaque mois&nbsp;?</SerifWord>
                </>
              ) : (
                <>
                  Ready to get paid
                  <br />
                  <SerifWord>every month?</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-2">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr ? 'Compte créé en 30 secondes. Lien unique immédiat.' : 'Account in 30 seconds. Unique link instantly.'}
            </p>
            <PillLink to="/affiliate/dashboard" variant="chromatic" size="lg">
              {isFr ? 'Devenir affilié' : 'Become an affiliate'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
