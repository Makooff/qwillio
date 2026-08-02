import { Link } from 'react-router-dom';
import {
  Phone, Bot, ArrowRight, Play, Clock, Mic, Calendar, MessageSquare,
  Users, Mail, Receipt, Package, Wallet, CreditCard, Gift, FileText, Headphones,
  type LucideIcon,
} from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import LogoOrbs from '../../components/v2/LogoOrbs';

/* Home V2 « Papier & Signal » — voir DA/v2-direction.md.
   Copie FR/EN portée de la V1 (pages/Home.tsx), aucune métrique inventée. */

const INDUSTRY_HREFS: (string | null)[] = [
  '/dentiste', '/avocat', '/immobilier', '/plombier', '/restaurant', null,
  '/garagiste', null, '/coiffeur', '/fiduciaire', null, null,
];

interface Step {
  num: string;
  title: string;
  desc: string;
  points: { icon: LucideIcon; label: string }[];
  tone: 'indigo' | 'violet' | 'deep';
}

const TONE_COLOR = { indigo: '#7a5fff', violet: '#cd6bfb', deep: '#7349fe' } as const;

export default function Home() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr
      ? 'Meilleur réceptionniste IA en Belgique et en France'
      : 'AI Receptionist for Businesses',
    description: isFr
      ? 'Qwillio, le réceptionniste IA francophone n°1 pour la Belgique et la France : répond à chaque appel 24/7, prend les rendez-vous, hébergement UE et conforme RGPD. Sans engagement, 7 jours d’essai gratuit.'
      : 'Qwillio is your AI receptionist that answers every call 24/7, books appointments, and never sleeps. Bilingual French / English, EU-hosted, GDPR-friendly.',
    canonical: 'https://qwillio.com/',
  });

  const industries = isFr
    ? ['Santé', 'Juridique', 'Immobilier', 'Services à domicile', 'Restauration', 'Éducation', 'Automobile', 'Fitness', 'Beauté', 'Finance', 'Commerce', 'Startups']
    : ['Healthcare', 'Legal', 'Real Estate', 'Home Services', 'Restaurants', 'Education', 'Automotive', 'Fitness', 'Beauty', 'Finance', 'Retail', 'Startups'];

  const steps: Step[] = [
    {
      num: '01',
      title: isFr ? 'Inscrivez-vous' : 'Sign up',
      desc: isFr
        ? 'Créez votre compte en 2 minutes. 7 jours d’essai gratuit.'
        : 'Create your account in 2 minutes. 7-day free trial.',
      points: [
        { icon: Clock, label: '2 minutes' },
        { icon: CreditCard, label: isFr ? 'Annulable à tout moment' : 'Cancel anytime' },
        { icon: Gift, label: isFr ? '7 jours d’essai' : '7-day trial' },
      ],
      tone: 'indigo',
    },
    {
      num: '02',
      title: isFr ? 'Configurez' : 'Configure',
      desc: isFr
        ? 'Voix, scripts, horaires, intégrations calendrier. Tout se règle dans le dashboard.'
        : 'Voice, scripts, hours, calendar integrations. Everything from the dashboard.',
      points: [
        { icon: Mic, label: isFr ? 'Voix naturelle' : 'Natural voice' },
        { icon: FileText, label: isFr ? 'Scripts par métier' : 'Industry scripts' },
        { icon: Calendar, label: isFr ? 'Calendrier connecté' : 'Calendar sync' },
      ],
      tone: 'violet',
    },
    {
      num: '03',
      title: isFr ? 'Allumez la ligne' : 'Go live',
      desc: isFr
        ? 'Transférez votre numéro existant. L’IA prend le relais. Support FR 7j/7.'
        : 'Forward your existing number. The AI takes over. Support 7 days a week.',
      points: [
        { icon: Phone, label: isFr ? 'Numéro conservé' : 'Keep your number' },
        { icon: Bot, label: isFr ? 'IA en relais 24/7' : 'AI on 24/7' },
        { icon: Headphones, label: isFr ? 'Support 7j/7' : 'Support 7 days' },
      ],
      tone: 'deep',
    },
  ];

  return (
    <PublicShell>
      {/* ── HERO — asymétrique: titre whisper à gauche, orbes du logo à droite ── */}
      <Section aria-labelledby="hero-heading" className="!pt-16 md:!pt-24 overflow-hidden">
        <Container className="grid lg:grid-cols-[1.2fr_1fr] gap-14 lg:gap-20 items-center">
          <RevealV2>
            <div>
              <Eyebrow tone="indigo" className="mb-6">
                {isFr ? 'Réceptionniste IA' : 'AI Receptionist'}
              </Eyebrow>
              <Display className="mb-7">
                {isFr ? (
                  <>
                    L'appel que vous ratez part{' '}
                    <SerifWord>chez le voisin.</SerifWord>
                  </>
                ) : (
                  <>
                    The call you miss goes to <SerifWord>the next name.</SerifWord>
                  </>
                )}
              </Display>
              <Lead className="max-w-[480px] mb-10 q2-body-text">
                {isFr
                  ? 'Qwillio décroche à votre place, en moins d’une seconde, prend le rendez-vous dans votre agenda et vous envoie le résumé. Français et anglais sur le même appel. À partir de 99 € par mois, soit moins qu’une matinée de secrétariat.'
                  : 'Qwillio picks up for you in under a second, books the appointment in your calendar and sends you the summary. French and English on the same call. From €99 a month, less than a morning of reception cover.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-12">
                <PillLink to="/demo.html" variant="primary" size="lg">
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  {isFr ? 'Écouter une démo' : 'Hear the demo'}
                </PillLink>
                <PillLink to="/pricing" variant="outline" size="lg">
                  {isFr ? 'Voir les tarifs' : 'See pricing'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
              </div>

              {/* Strip crédibilité: uniquement des propriétés vérifiables du produit,
                  jamais des métriques de performance inventées (DA/voix.md). */}
              <dl className="flex items-baseline gap-8 sm:gap-10 text-sm text-q2-faint border-t border-q2-plate pt-6 max-w-[520px]">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Langues' : 'Languages'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink">FR/EN</dd>
                  <span>{isFr ? 'bilingue' : 'bilingual'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Temps de réponse' : 'Response time'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">&lt;1&nbsp;s</dd>
                  <span>{isFr ? 'réponse' : 'response'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Disponibilité' : 'Uptime'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">24/7</dd>
                  <span className="hidden sm:inline">{isFr ? 'jamais fermé' : 'always on'}</span>
                </div>
              </dl>
            </div>
          </RevealV2>

          <RevealV2 index={2} className="hidden lg:block">
            <LogoOrbs className="max-w-[420px] mx-auto" />
          </RevealV2>
        </Container>
      </Section>

      {/* ── PRODUITS — deux panneaux éditoriaux asymétriques sur bande taupe ── */}
      <Section variant="band" hairline aria-labelledby="products-heading">
        <Container>
          <RevealV2 className="mb-14">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Produits' : 'Products'}
            </Eyebrow>
            <H2 className="max-w-[700px]">
              {isFr ? 'Deux modules. ' : 'Two modules. '}
              <span className="text-q2-faint">{isFr ? 'Un cerveau.' : 'One brain.'}</span>
            </H2>
            <p className="text-q2-body text-base max-w-[520px] leading-relaxed mt-4 q2-body-text">
              {isFr
                ? 'Conçus pour fonctionner ensemble. Adoptez ce dont vous avez besoin, quand vous en avez besoin.'
                : 'Built to work together. Adopt what you need, when you need it.'}
            </p>
          </RevealV2>

          <div className="grid lg:grid-cols-[1.7fr_1fr] gap-5">
            <RevealV2>
              <Link
                to="/receptionist"
                className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-[28px]"
              >
                <CardV2 variant="canvas" large hover className="h-full flex flex-col justify-between min-h-[420px] md:p-12">
                  <div>
                    <div className="flex items-center gap-3 mb-8">
                      <span className="w-11 h-11 rounded-full bg-q2-plate flex items-center justify-center">
                        <Phone size={18} className="text-q2-indigo" aria-hidden="true" />
                      </span>
                      <Eyebrow tone="indigo">{isFr ? 'Le best-seller' : 'Best-seller'}</Eyebrow>
                    </div>
                    <h3 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-light tracking-[-0.02em] leading-[1.08] mb-4 text-q2-ink max-w-[520px]">
                      {isFr ? 'Réceptionniste IA' : 'AI Receptionist'}
                    </h3>
                    <p className="text-q2-body text-base md:text-lg leading-relaxed max-w-[440px] q2-body-text">
                      {isFr
                        ? 'Décroche en moins d’une seconde. Prend les rendez-vous. Qualifie le lead. Transfère l’urgence.'
                        : 'Picks up in under a second. Books the appointment. Qualifies the lead. Transfers the urgency.'}
                    </p>
                  </div>

                  <div>
                    <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3" role="list">
                      {[
                        { icon: Mic, label: isFr ? 'Voix française naturelle' : 'Natural voice' },
                        { icon: Calendar, label: isFr ? 'Calendrier auto' : 'Auto-calendar' },
                        { icon: Users, label: isFr ? 'CRM intégré' : 'CRM sync' },
                        { icon: MessageSquare, label: isFr ? 'SMS de suivi' : 'SMS follow-up' },
                      ].map((f) => (
                        <li key={f.label} className="flex items-center gap-2.5 text-sm text-q2-graphite border-b border-q2-plate pb-3">
                          <f.icon size={14} className="shrink-0 text-q2-indigo" aria-hidden="true" />
                          {f.label}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8 flex items-baseline justify-between gap-4 flex-wrap">
                      <p className="text-q2-faint text-sm">
                        {isFr ? 'À partir de ' : 'From '}
                        <span className="text-q2-ink text-lg font-light tabular-nums">99&nbsp;€</span>
                        <span>/{isFr ? 'mois' : 'mo'}</span>
                        <span className="ml-2 text-q2-indigo text-xs font-medium">
                          · {isFr ? 'Essai gratuit' : 'Free trial'}
                        </span>
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-q2-ink">
                        {isFr ? 'Découvrir' : 'Explore'}
                        <ArrowRight size={15} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </CardV2>
              </Link>
            </RevealV2>

            <RevealV2 index={1}>
              <CardV2 variant="band" large className="h-full flex flex-col justify-between min-h-[420px] !bg-q2-plate/60">
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <span className="w-11 h-11 rounded-full bg-q2-canvas flex items-center justify-center">
                      <Bot size={18} className="text-q2-violet" aria-hidden="true" />
                    </span>
                    <span className="q2-eyebrow text-q2-violet rounded-full border border-q2-violet/30 px-3 py-1.5">
                      {isFr ? 'Bientôt' : 'Coming soon'}
                    </span>
                  </div>
                  <h3 className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-light tracking-[-0.02em] leading-[1.1] mb-3 text-q2-ink">
                    Qwillio Agent
                  </h3>
                  <p className="text-q2-body text-[15px] leading-relaxed q2-body-text">
                    {isFr
                      ? 'Modules IA additionnels : Email, Facturation, Inventaire, Paiements. Greffés à votre réceptionniste.'
                      : 'Add-on AI modules: Email, Billing, Inventory, Payments. Bolted onto your receptionist.'}
                  </p>
                </div>

                <div>
                  <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3" role="list">
                    {[
                      { icon: Mail, label: 'Email' },
                      { icon: Receipt, label: isFr ? 'Facturation' : 'Billing' },
                      { icon: Package, label: isFr ? 'Inventaire' : 'Inventory' },
                      { icon: Wallet, label: isFr ? 'Paiements' : 'Payments' },
                    ].map((m) => (
                      <li key={m.label} className="flex items-center gap-2.5 text-sm text-q2-graphite border-b border-q2-plate pb-3">
                        <m.icon size={14} className="shrink-0 text-q2-violet" aria-hidden="true" />
                        {m.label}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-8 text-q2-faint text-sm">
                    <span className="text-q2-ink text-lg font-light tabular-nums">+197&nbsp;€</span>
                    /{isFr ? 'mois · par module' : 'mo · per module'}
                  </p>
                </div>
              </CardV2>
            </RevealV2>
          </div>
        </Container>
      </Section>

      {/* ── TROIS ÉTAPES — rangées éditoriales hairline, sobres ── */}
      <Section aria-labelledby="how-heading">
        <Container>
          <RevealV2 className="mb-14">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Mise en route' : 'Getting started'}
            </Eyebrow>
            <H2>{isFr ? 'Trois étapes.' : 'Three steps.'}</H2>
            <p className="text-q2-body text-base mt-4 max-w-[480px] q2-body-text">
              {isFr ? 'Premiers appels traités le jour même.' : 'First calls handled the same day.'}
            </p>
          </RevealV2>

          <ol className="border-t border-q2-plate" role="list">
            {steps.map((step, i) => (
              <RevealV2 key={step.num} index={i} as="li" className="border-b border-q2-plate">
                <div className="grid md:grid-cols-[110px_1.1fr_1.4fr] gap-5 md:gap-10 py-10 md:py-12 items-start">
                  <p className="q2-price text-q2-plate select-none" aria-hidden="true">
                    {step.num}
                  </p>
                  <div>
                    <h3 className="q2-h3 text-q2-ink mb-2">{step.title}</h3>
                    <p className="text-q2-body text-[15px] leading-relaxed max-w-[380px] q2-body-text">{step.desc}</p>
                  </div>
                  <ul className="flex flex-wrap gap-2.5 md:justify-end md:pt-2" role="list">
                    {step.points.map((p) => (
                      <li
                        key={p.label}
                        className="inline-flex items-center gap-2 rounded-full border border-q2-plate bg-q2-canvas px-4 py-2 text-[13px] font-medium text-q2-graphite"
                      >
                        <p.icon size={13} aria-hidden="true" style={{ color: TONE_COLOR[step.tone] }} />
                        {p.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ── POUR QUI — bande taupe, chips pilules navigables ── */}
      <Section variant="band" hairline aria-labelledby="industries-heading">
        <Container className="grid lg:grid-cols-[1fr_1.4fr] gap-12 items-start">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-4">
              {isFr ? 'Secteurs' : 'Industries'}
            </Eyebrow>
            <H2 id="industries-heading">
              {isFr ? 'Pour ' : 'For '}
              <SerifWord>{isFr ? 'qui ?' : 'whom?'}</SerifWord>
            </H2>
            <p className="text-q2-body text-base mt-4 max-w-[380px] leading-relaxed q2-body-text">
              {isFr
                ? 'Chaque métier a son script, son vocabulaire et ses urgences. Qwillio parle le vôtre.'
                : 'Every trade has its script, its vocabulary and its emergencies. Qwillio speaks yours.'}
            </p>
          </RevealV2>

          <RevealV2 index={1}>
            <nav aria-label={isFr ? 'Secteurs' : 'Industries'} className="flex flex-wrap gap-3 lg:pt-14">
              {industries.map((name, i) => {
                const href = INDUSTRY_HREFS[i];
                const cls =
                  'inline-flex items-center rounded-full bg-q2-canvas border border-q2-plate px-5 py-2.5 text-sm font-medium';
                return href ? (
                  <Link
                    key={name}
                    to={href}
                    className={`${cls} text-q2-ink hover:border-q2-indigo hover:text-q2-indigo transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40`}
                  >
                    {name}
                  </Link>
                ) : (
                  <span key={name} className={`${cls} text-q2-faint`}>
                    {name}
                  </span>
                );
              })}
            </nav>
          </RevealV2>
        </Container>
      </Section>

      {/* ── NOTE FONDATEUR — drenched indigo, positionnement honnête ── */}
      <Section variant="drenched-indigo" aria-label={isFr ? 'Note du fondateur' : 'Founder note'}>
        <Container>
          <RevealV2>
            <Eyebrow tone="indigo" onDark className="mb-8">
              {isFr ? 'Lancement' : 'Launch'}
            </Eyebrow>
            <blockquote className="q2-h2 text-white max-w-[820px]">
              {isFr
                ? 'Qwillio vient de démarrer, construit et opéré par un développeur solo à Bruxelles. Chaque premier client est onboardé personnellement, pas de ticket support impersonnel.'
                : 'Qwillio just launched, built and run by a solo developer in Brussels. Every first customer is onboarded personally, no impersonal support ticket.'}
            </blockquote>
            <p className="mt-8 text-q2-fog text-[15px] max-w-[640px] leading-relaxed q2-body-text">
              {isFr
                ? 'On préfère être honnête plutôt qu’afficher de faux avis clients. Devenez l’un des premiers.'
                : 'We’d rather be upfront than show fake customer reviews. Become one of the first.'}
            </p>
          </RevealV2>
        </Container>
      </Section>

      {/* ── CTA FINAL — drenched, une seule action chromatique ── */}
      <Section variant="drenched-violet" aria-label={isFr ? 'Démarrer avec Qwillio' : 'Get started with Qwillio'} className="border-t border-q2-graphite-d">
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
          <RevealV2>
            <Display as="h2" onDark>
              {isFr ? (
                <>
                  Arrêtez de perdre des appels. <SerifWord>Commencez aujourd'hui.</SerifWord>
                </>
              ) : (
                <>
                  Stop losing calls. <SerifWord>Start today.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-2">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr ? 'Sans engagement. Annulez en un clic.' : 'No commitment. Cancel anytime.'}
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
