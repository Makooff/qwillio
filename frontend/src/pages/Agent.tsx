import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  Mail, Calculator, Package, CreditCard, ArrowRight, Check,
  Megaphone, Star, CalendarClock, LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';

interface Module {
  id: string;
  icon: LucideIcon;
  name: string;
  tagline: string;
  description: string;
  features: string[];
}

export default function Agent() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr ? 'Qwillio Agent · Modules IA' : 'Qwillio Agent · AI Modules',
    description: isFr
      ? 'Modules IA additionnels : Email, Comptabilité, Inventaire, Paiements. Greffés à votre Réceptionniste.'
      : 'Add-on AI modules: Email, Accounting, Inventory, Payments, Marketing, Reputation, Scheduling, Support. Bolted onto your Receptionist.',
    canonical: 'https://qwillio.com/agent',
  });

  const modules: Module[] = [
    {
      id: 'email',
      icon: Mail,
      name: 'Email AI',
      tagline: isFr ? 'Triage et réponses automatiques' : 'Triage and automated replies',
      description: isFr
        ? 'Classe vos emails par priorité, répond aux demandes simples, route le reste à votre équipe avec contexte.'
        : 'Sorts your inbox by priority, replies to simple requests, routes the rest to your team with context.',
      features: isFr
        ? ['Tri par catégorie (urgent, rendez-vous, facturation)', 'Réponses auto avec votre ton', 'Détection de leads chauds', 'Connecté à Gmail et Outlook']
        : ['Category triage (urgent, appointments, billing)', 'Auto-replies in your tone', 'Hot lead detection', 'Gmail and Outlook connected'],
    },
    {
      id: 'accounting',
      icon: Calculator,
      name: isFr ? 'Comptabilité IA' : 'Accounting AI',
      tagline: isFr ? 'Factures et P&L automatiques' : 'Auto invoices and P&L',
      description: isFr
        ? 'Génère vos factures, relance les impayés, prépare votre P&L mensuel. Connecté à QuickBooks et Wave.'
        : 'Generates invoices, chases overdue payments, prepares your monthly P&L. Synced with QuickBooks and Wave.',
      features: isFr
        ? ['Facturation automatique post-appel', 'Relances 7/14/30 jours', 'Export comptable mensuel', 'Synchronisation QuickBooks et Wave']
        : ['Auto-invoicing after each call', 'Reminders at 7/14/30 days', 'Monthly accounting export', 'QuickBooks and Wave sync'],
    },
    {
      id: 'inventory',
      icon: Package,
      name: isFr ? 'Inventaire IA' : 'Inventory AI',
      tagline: isFr ? 'Stock et réassort intelligents' : 'Smart stock and reordering',
      description: isFr
        ? 'Suit vos produits, alerte avant rupture, commande automatiquement aux fournisseurs préférés.'
        : 'Tracks your products, alerts before stockouts, auto-orders from preferred suppliers.',
      features: isFr
        ? ['Seuils par produit', 'Alertes de rupture', 'Commande automatique', 'QR codes pour suivi terrain']
        : ['Per-product thresholds', 'Stockout alerts', 'Auto-reordering', 'QR codes for field tracking'],
    },
    {
      id: 'payments',
      icon: CreditCard,
      name: isFr ? 'Paiements IA' : 'Payments AI',
      tagline: isFr ? 'Encaissements et acomptes' : 'Payments and deposits',
      description: isFr
        ? 'Demande l\'acompte pendant l\'appel, encaisse à distance, gère les remboursements et impayés.'
        : 'Collects deposit during the call, charges remotely, handles refunds and failed payments.',
      features: isFr
        ? ['Acomptes vocaux pendant l\'appel', 'Stripe, SEPA, Apple Pay', 'Gestion des remboursements', 'Reporting consolidé']
        : ['Voice deposits during call', 'Stripe, SEPA, Apple Pay', 'Refund handling', 'Consolidated reporting'],
    },
    {
      id: 'marketing',
      icon: Megaphone,
      name: isFr ? 'Marketing IA' : 'Marketing AI',
      tagline: isFr ? 'Posts, emails, ad copy' : 'Posts, emails, ad copy',
      description: isFr
        ? 'Génère vos publications réseaux sociaux, vos campagnes emails et vos textes publicitaires adaptés à votre niche.'
        : 'Generates social media posts, email campaigns, and ad copy tailored to your niche.',
      features: isFr
        ? ['Posts Facebook et Instagram', 'Emails campagne par segment', 'Texte publicitaire Google Ads', 'Adapté au ton de votre marque']
        : ['Facebook and Instagram posts', 'Segmented campaign emails', 'Google Ads copy', 'Matches your brand tone'],
    },
    {
      id: 'reputation',
      icon: Star,
      name: isFr ? 'Réputation IA' : 'Reputation AI',
      tagline: isFr ? 'Avis et réponses' : 'Reviews and replies',
      description: isFr
        ? 'Surveille vos avis Google et Facebook, rédige les réponses, alerte sur les notes basses.'
        : 'Monitors your Google and Facebook reviews, drafts replies, alerts on low ratings.',
      features: isFr
        ? ['Surveillance temps réel des avis', 'Réponses générées par IA', 'Escalade des notes basses', 'Score réputation hebdomadaire']
        : ['Real-time review monitoring', 'AI-drafted replies', 'Low-rating escalation', 'Weekly reputation score'],
    },
    {
      id: 'scheduling',
      icon: CalendarClock,
      name: isFr ? 'Planification IA' : 'Scheduling AI',
      tagline: isFr ? 'Créneaux et rappels' : 'Slots and reminders',
      description: isFr
        ? 'Optimise vos créneaux de rendez-vous, envoie les rappels SMS, réduit les no-shows.'
        : 'Optimizes appointment slots, sends SMS reminders, cuts down on no-shows.',
      features: isFr
        ? ['Recommandation de créneaux', 'Rappels SMS automatiques', 'Détection de patterns no-show', 'Synchronisé avec votre Receptionist']
        : ['Slot recommendations', 'Automated SMS reminders', 'No-show pattern detection', 'Synced with your Receptionist'],
    },
    {
      id: 'support',
      icon: LifeBuoy,
      name: isFr ? 'Support IA' : 'Support AI',
      tagline: isFr ? 'Tickets et escalade' : 'Tickets and escalation',
      description: isFr
        ? 'Trie les tickets email et chat, rédige les réponses, escalade ce qui demande un humain.'
        : 'Triages email and chat tickets, drafts replies, escalates what needs a human.',
      features: isFr
        ? ['Classification automatique', 'Réponses générées par IA', 'Escalade par mots-clés', 'Priorisation high/normal/low']
        : ['Automatic classification', 'AI-drafted replies', 'Keyword-based escalation', 'High/normal/low priority']
    },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main id="main">
        {/* ── HERO — violet primary (Agent brand) ────────────────── */}
        <section
          aria-labelledby="agent-heading"
          className="pt-24 sm:pt-28 md:pt-36 pb-16 md:pb-28 px-5 sm:px-6"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">
            <Reveal>
            <div>
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase mb-6">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#a855f7' }} aria-hidden="true" />
                <span style={{ color: '#a855f7' }}>Qwillio Agent</span>
                <span className="text-[#86868b]">·</span>
                <span className="text-[#1d1d1f]">{isFr ? 'Modules IA' : 'AI Modules'}</span>
              </span>

              <h1
                id="agent-heading"
                className="text-[clamp(2.6rem,6.5vw,5.6rem)] font-semibold tracking-[-0.04em] leading-[0.95] mb-6"
              >
                {isFr ? (
                  <>
                    Quatre modules.<br />
                    <span className="italic font-serif" style={{ color: '#a855f7' }}>Un seul agent.</span>
                  </>
                ) : (
                  <>
                    Four modules.<br />
                    <span className="italic font-serif" style={{ color: '#a855f7' }}>One agent.</span>
                  </>
                )}
              </h1>

              <p className="text-lg md:text-xl text-[#424245] max-w-[460px] mb-9 leading-[1.55]">
                {isFr
                  ? 'Greffez Email, Comptabilité, Inventaire, ou Paiements à votre Réceptionniste IA. Activez à la carte.'
                  : 'Bolt Email, Accounting, Inventory, or Payments onto your AI Receptionist. Pick what you need.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[15px] font-medium pl-5 pr-6 py-3.5 rounded-full hover:bg-[#a855f7] transition-colors"
                >
                  {isFr ? 'Démarrer' : 'Get started'}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#1d1d1f] px-2 py-2 underline decoration-[#a855f7]/30 decoration-2 underline-offset-8 hover:decoration-[#a855f7] transition-colors"
                >
                  {isFr ? 'Voir les tarifs' : 'See pricing'}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>

              <p className="text-sm text-[#86868b] border-t border-[#1d1d1f]/10 pt-6 max-w-[460px]">
                {isFr ? (
                  <>
                    <span className="text-[#1d1d1f] font-semibold">+$197</span>
                    {' '}par module et par mois. Premier mois offert. Sans engagement.
                  </>
                ) : (
                  <>
                    <span className="text-[#1d1d1f] font-semibold">+$197</span>
                    {' '}per module per month. First month free. No commitment.
                  </>
                )}
              </p>
            </div>
            </Reveal>

            {/* Visual: 2x2 module grid as a "device" */}
            <Reveal delay={0.12}>
            <Card3D intensity={4}>
            <div
              className="relative rounded-3xl p-6 overflow-hidden text-white"
              style={{
                background: 'linear-gradient(155deg, #1d1d1f 0%, #3a1f4a 60%, #a855f7 115%)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: '#a855f7', boxShadow: '0 0 8px #a855f7' }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/55">
                    {isFr ? 'Agent actif' : 'Agent active'}
                  </span>
                </div>
                <span className="text-[11px] text-white/35 tabular-nums">qwillio.ai/agent</span>
              </div>

              <ul className="grid grid-cols-2 gap-3" role="list">
                {modules.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-2xl p-4 border"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: 'rgba(168,85,247,0.18)' }}
                      aria-hidden="true"
                    >
                      <m.icon size={16} style={{ color: '#d8b4fe' }} />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">{m.name}</p>
                    <p className="text-[11px] text-white/55 leading-relaxed">{m.tagline}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center justify-between text-[11px]">
                <span className="text-white/55">
                  {isFr ? '4 modules actifs' : '4 modules active'}
                </span>
                <span style={{ color: '#d8b4fe' }} className="font-semibold">
                  +$788/{isFr ? 'mois' : 'month'}
                </span>
              </div>
            </div>
            </Card3D>
            </Reveal>
          </div>
        </section>

        {/* ── MODULES — alternating editorial blocks ─────────────── */}
        <section
          aria-labelledby="modules-heading"
          className="py-14 sm:py-18 md:py-28 px-6 border-t border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
            <h2
              id="modules-heading"
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-semibold tracking-[-0.025em] mb-12 max-w-[640px]"
            >
              {isFr
                ? <>Quatre modules. <span className="text-[#86868b] font-normal">Chacun excellent à son métier.</span></>
                : <>Four modules. <span className="text-[#86868b] font-normal">Each one excellent at its job.</span></>}
            </h2>
            </Reveal>

            <div className="space-y-16 md:space-y-24">
              {modules.map((m, i) => {
                const flip = i % 2 === 1;
                const accent = i % 2 === 0 ? '#a855f7' : '#6366f1';
                return (
                  <Reveal key={m.id} delay={0.05}>
                  <article
                    aria-label={m.name}
                    className={`grid lg:grid-cols-2 gap-10 md:gap-16 items-center ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <span
                          className="w-12 h-12 rounded-2xl flex items-center justify-center"
                          style={{ background: `${accent}1f`, color: accent }}
                          aria-hidden="true"
                        >
                          <m.icon size={22} />
                        </span>
                        <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: accent }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h3 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-[-0.025em] mb-3">
                        {m.name}
                      </h3>
                      <p className="text-[#525257] text-lg leading-relaxed mb-6 max-w-[480px]">
                        {m.description}
                      </p>
                      <ul role="list" className="space-y-2.5">
                        {m.features.map((f) => (
                          <li key={f} className="flex items-start gap-3 text-sm text-[#424245]">
                            <Check
                              size={16}
                              className="flex-shrink-0 mt-0.5"
                              style={{ color: accent }}
                              aria-hidden="true"
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div
                      className="rounded-[2rem] aspect-[5/4] flex items-center justify-center relative overflow-hidden"
                      style={{
                        background: i % 2 === 0
                          ? 'linear-gradient(155deg, #1d1d1f 0%, #3a1f4a 60%, #a855f7 115%)'
                          : 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #6366f1 115%)',
                      }}
                    >
                      <div
                        aria-hidden="true"
                        className="absolute -right-20 -top-20 w-[320px] h-[320px] rounded-full opacity-30 blur-3xl"
                        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
                      />
                      <m.icon size={140} className="text-white/15 relative" strokeWidth={1} aria-hidden="true" />
                    </div>
                  </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── PRICING SNAPSHOT ───────────────────────────────────── */}
        <section
          aria-labelledby="agent-pricing-heading"
          className="py-14 sm:py-18 md:py-28 px-6 bg-[#fafaf8] border-y border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <Reveal>
            <div>
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-3" style={{ color: '#a855f7' }}>
                {isFr ? 'Tarif' : 'Pricing'}
              </span>
              <h2
                id="agent-pricing-heading"
                className="text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.03em] leading-[1.05] mb-5"
              >
                {isFr ? (
                  <><span className="font-serif italic" style={{ color: '#a855f7' }}>$197</span> par module, par mois.</>
                ) : (
                  <><span className="font-serif italic" style={{ color: '#a855f7' }}>$197</span> per module, per month.</>
                )}
              </h2>
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[440px]">
                {isFr
                  ? 'Ajoutez un, deux, trois ou les quatre. Activez ou désactivez quand vous voulez. Premier mois offert.'
                  : 'Add one, two, three or all four. Toggle anytime. First month free.'}
              </p>
            </div>
            </Reveal>

            <Reveal delay={0.1}>
            <Card3D intensity={4}>
            <div
              className="rounded-[2rem] p-8 text-white"
              style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #3a1f4a 60%, #a855f7 115%)' }}
            >
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/55 mb-3">
                {isFr ? 'Suite complète' : 'Complete suite'}
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-semibold tracking-[-0.03em] tabular-nums">$788</span>
                <span className="text-sm text-white/60">/{isFr ? 'mois' : 'month'}</span>
              </div>
              <p className="text-xs mb-6" style={{ color: '#d8b4fe' }}>
                {isFr ? 'Les 4 modules · Premier mois offert' : 'All 4 modules · 1st month free'}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center justify-center w-full gap-2 bg-white text-[#1d1d1f] text-sm font-semibold pl-5 pr-6 py-3.5 rounded-full hover:bg-[#d8b4fe] transition-colors"
              >
                {isFr ? 'Activer' : 'Activate'}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            </Card3D>
            </Reveal>
          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────────────── */}
        <section aria-label={isFr ? 'Démarrer' : 'Get started'} className="py-16 sm:py-20 md:py-32 px-6">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end border-t-2 border-[#1d1d1f] pt-12 md:pt-16">
            <Reveal>
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-semibold tracking-[-0.035em] leading-[0.98]">
              {isFr ? (
                <>
                  Confiez votre business<br />
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>à un</span>{' '}
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>seul agent.</span>
                </>
              ) : (
                <>
                  Hand your business<br />
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>to one</span>{' '}
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>agent.</span>
                </>
              )}
            </h2>
            </Reveal>
            <Reveal delay={0.1}>
            <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right pb-4">
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[320px] lg:ml-auto">
                {isFr
                  ? 'Activez à la carte. Désactivez en un clic. Sans engagement.'
                  : 'Activate à la carte. Deactivate anytime. No commitment.'}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#a855f7] transition-colors"
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
