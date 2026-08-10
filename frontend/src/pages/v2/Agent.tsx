import type { ReactNode } from 'react';
import {
  Mail, Receipt, Package, Wallet, ArrowRight, Check,
  type LucideIcon,
} from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import ShapeDrift from '../../components/v2/motion/ShapeDrift';

/* Qwillio Agent V2 « Papier & Signal » (DA/v2-direction.md).
   Sémantique violet: ce qui sort. Copie FR/EN portée de la V1 (pages/Agent.tsx),
   restreinte aux quatre modules du catalogue V2: Email, Facturation, Inventaire, Paiements. */

interface Module {
  id: string;
  icon: LucideIcon;
  num: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  panel: ReactNode;
}

function PanelLabel({ children }: { children: ReactNode }) {
  return <p className="q2-eyebrow text-q2-body mb-6">{children}</p>;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="inline-flex items-center rounded-full bg-q2-canvas border border-q2-plate px-4 py-2 text-[13px] font-medium text-q2-graphite">
      {children}
    </li>
  );
}

export default function Agent() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr ? 'Qwillio Agent · Modules IA' : 'Qwillio Agent · AI Modules',
    description: isFr
      ? 'Quatre modules IA add-on à greffer sur votre Réceptionniste : Email, Facturation, Inventaire, Paiements. 197 € par module et par mois au lancement.'
      : 'Four add-on AI modules to bolt onto your Receptionist: Email, Billing, Inventory, Payments. €197 per module per month at launch.',
    canonical: 'https://qwillio.com/agent',
  });

  const modules: Module[] = [
    {
      id: 'email',
      icon: Mail,
      num: '01',
      name: 'Email AI',
      tagline: isFr ? 'Triage et réponses automatiques' : 'Triage and automated replies',
      description: isFr
        ? 'Classe vos emails par priorité, répond aux demandes simples, route le reste à votre équipe avec contexte.'
        : 'Sorts your inbox by priority, replies to simple requests, routes the rest to your team with context.',
      features: isFr
        ? ['Tri par catégorie (urgent, rendez-vous, facturation)', 'Réponses auto avec votre ton', 'Détection de leads chauds', 'Connecté à Gmail et Outlook']
        : ['Category triage (urgent, appointments, billing)', 'Auto-replies in your tone', 'Hot lead detection', 'Gmail and Outlook connected'],
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Catégories de tri' : 'Triage categories'}</PanelLabel>
          <ul className="divide-y divide-q2-plate mb-8" role="list">
            {[
              isFr ? 'Urgent' : 'Urgent',
              isFr ? 'Rendez-vous' : 'Appointments',
              isFr ? 'Facturation' : 'Billing',
            ].map((cat) => (
              <li key={cat} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                <span className="text-q2-graphite text-[15px] q2-body-text">{cat}</span>
                <span className="text-q2-body text-xs">{isFr ? 'routé' : 'routed'}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-2.5" role="list">
            <Chip>Gmail</Chip>
            <Chip>Outlook</Chip>
          </ul>
        </CardV2>
      ),
    },
    {
      id: 'billing',
      icon: Receipt,
      num: '02',
      name: isFr ? 'Facturation IA' : 'Billing AI',
      tagline: isFr ? 'Factures et P&L automatiques' : 'Auto invoices and P&L',
      description: isFr
        ? 'Génère vos factures, relance les impayés, prépare votre P&L mensuel. Connecté à QuickBooks et Wave.'
        : 'Generates invoices, chases overdue payments, prepares your monthly P&L. Synced with QuickBooks and Wave.',
      features: isFr
        ? ['Facturation automatique post-appel', 'Relances 7/14/30 jours', 'Export comptable mensuel', 'Synchronisation QuickBooks et Wave']
        : ['Auto-invoicing after each call', 'Reminders at 7/14/30 days', 'Monthly accounting export', 'QuickBooks and Wave sync'],
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Séquence de relance' : 'Reminder sequence'}</PanelLabel>
          <ol className="border-t border-q2-plate mb-8" role="list">
            {['7', '14', '30'].map((day) => (
              <li key={day} className="flex items-baseline gap-5 border-b border-q2-plate py-4">
                <span className="text-2xl font-light tracking-tight text-q2-violet tabular-nums w-12">{day}</span>
                <span className="text-q2-graphite text-[15px] q2-body-text">
                  {isFr ? 'jours après la facture' : 'days after the invoice'}
                </span>
              </li>
            ))}
          </ol>
          <ul className="flex flex-wrap gap-2.5" role="list">
            <Chip>QuickBooks</Chip>
            <Chip>Wave</Chip>
          </ul>
        </CardV2>
      ),
    },
    {
      id: 'inventory',
      icon: Package,
      num: '03',
      name: isFr ? 'Inventaire IA' : 'Inventory AI',
      tagline: isFr ? 'Stock et réassort intelligents' : 'Smart stock and reordering',
      description: isFr
        ? 'Suit vos produits, alerte avant rupture, commande automatiquement aux fournisseurs préférés.'
        : 'Tracks your products, alerts before stockouts, auto-orders from preferred suppliers.',
      features: isFr
        ? ['Seuils par produit', 'Alertes de rupture', 'Commande automatique', 'QR codes pour suivi terrain']
        : ['Per-product thresholds', 'Stockout alerts', 'Auto-reordering', 'QR codes for field tracking'],
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Boucle de réassort' : 'Reordering loop'}</PanelLabel>
          <ol className="space-y-4" role="list">
            {[
              isFr ? 'Seuil défini par produit' : 'Threshold set per product',
              isFr ? 'Alerte avant la rupture' : 'Alert before the stockout',
              isFr ? 'Commande au fournisseur préféré' : 'Order to the preferred supplier',
              isFr ? 'Suivi terrain par QR code' : 'Field tracking by QR code',
            ].map((line, i, arr) => (
              <li key={line} className="flex items-start gap-4">
                <span className="q2-eyebrow text-q2-violet tabular-nums pt-1 w-6 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`text-q2-graphite text-[15px] leading-snug q2-body-text pb-4 flex-1 ${
                    i === arr.length - 1 ? '' : 'border-b border-q2-plate'
                  }`}
                >
                  {line}
                </span>
              </li>
            ))}
          </ol>
        </CardV2>
      ),
    },
    {
      id: 'payments',
      icon: Wallet,
      num: '04',
      name: isFr ? 'Paiements IA' : 'Payments AI',
      tagline: isFr ? 'Encaissements et acomptes' : 'Payments and deposits',
      description: isFr
        ? 'Demande l’acompte pendant l’appel, encaisse à distance, gère les remboursements et impayés.'
        : 'Collects deposit during the call, charges remotely, handles refunds and failed payments.',
      features: isFr
        ? ['Acomptes vocaux pendant l’appel', 'Stripe, SEPA, Apple Pay', 'Gestion des remboursements', 'Reporting consolidé']
        : ['Voice deposits during call', 'Stripe, SEPA, Apple Pay', 'Refund handling', 'Consolidated reporting'],
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Moyens de paiement' : 'Payment methods'}</PanelLabel>
          <ul className="flex flex-wrap gap-2.5 mb-8" role="list">
            <Chip>Stripe</Chip>
            <Chip>SEPA</Chip>
            <Chip>Apple Pay</Chip>
          </ul>
          <p className="text-q2-body text-sm leading-relaxed q2-body-text border-t border-q2-plate pt-5">
            {isFr
              ? 'L’acompte est demandé pendant l’appel, les remboursements et les impayés sont gérés depuis le même reporting.'
              : 'The deposit is requested during the call, refunds and failed payments are handled from the same reporting.'}
          </p>
        </CardV2>
      ),
    },
  ];

  return (
    <PublicShell>
      {/* HERO, asymétrique: titre whisper à gauche, panneau agent sombre à droite */}
      <Section
        aria-label={isFr ? 'Qwillio Agent, modules IA' : 'Qwillio Agent, AI modules'}
        className="relative !pt-16 md:!pt-24 overflow-hidden"
      >
        <ShapeDrift shapes={[{ kind: 'column', x: '88%', y: '18%', size: 150, drift: 90, opacity: 0.26 }]} />
        <Container className="grid lg:grid-cols-[1.15fr_1fr] gap-14 lg:gap-20 items-center">
          <RevealV2>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Eyebrow tone="violet">
                  Qwillio Agent · {isFr ? 'Modules IA' : 'AI Modules'}
                </Eyebrow>
                <span className="q2-eyebrow text-q2-violet rounded-full border border-q2-violet/30 px-3 py-1">
                  {isFr ? 'Bientôt' : 'Coming soon'}
                </span>
              </div>
              <Display className="mb-7">
                {isFr ? (
                  <>
                    Quatre modules. <SerifWord>Un seul agent.</SerifWord>
                  </>
                ) : (
                  <>
                    Four modules. <SerifWord>One agent.</SerifWord>
                  </>
                )}
              </Display>
              <Lead className="max-w-[460px] mb-10 q2-body-text">
                {isFr
                  ? 'Greffez Email, Facturation, Inventaire ou Paiements à votre Réceptionniste IA. Activez à la carte.'
                  : 'Bolt Email, Billing, Inventory, or Payments onto your AI Receptionist. Pick what you need.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-12">
                <PillLink to="/contact" variant="primary" size="lg">
                  {isFr ? 'Être prévenu au lancement' : 'Get notified at launch'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
                <PillLink to="/receptionist" variant="outline" size="lg">
                  {isFr ? 'Découvrir le Réceptionniste' : 'Explore the Receptionist'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
              </div>

              <p className="text-sm text-q2-body border-t border-q2-plate pt-6 max-w-[460px] q2-body-text">
                <span className="text-q2-ink text-lg font-light tabular-nums">+197&nbsp;€</span>{' '}
                {isFr
                  ? 'par module et par mois au lancement. Greffé à votre Réceptionniste IA.'
                  : 'per module per month at launch. Bolted onto your AI Receptionist.'}
              </p>
            </div>
          </RevealV2>

          <RevealV2 index={2}>
            <CardV2 variant="drenched">
              <div className="flex items-center justify-between mb-6">
                <span className="q2-eyebrow text-q2-fog">{isFr ? 'Aperçu' : 'Preview'}</span>
                <span className="text-[11px] text-q2-fog tabular-nums">qwillio.com/agent</span>
              </div>
              <ul role="list">
                {modules.map((m, i) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-4 py-4 ${i > 0 ? 'border-t border-q2-graphite-d' : ''}`}
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-q2-obsidian flex items-center justify-center">
                      <m.icon size={16} className="text-q2-violet" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      <p className="text-[11px] text-q2-fog leading-relaxed">{m.tagline}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center justify-between text-[13px] border-t border-q2-graphite-d pt-5">
                <span className="text-q2-fog">{isFr ? '4 modules · bientôt' : '4 modules · coming soon'}</span>
                <span className="text-q2-mist tabular-nums">
                  +788&nbsp;€/{isFr ? 'mois' : 'month'}
                </span>
              </div>
            </CardV2>
          </RevealV2>
        </Container>
      </Section>

      {/* MODULES, blocs éditoriaux alternés (jamais une grille de cards identiques) */}
      <Section hairline aria-labelledby="modules-heading">
        <Container>
          <RevealV2 className="mb-4 md:mb-10">
            <Eyebrow tone="violet" className="mb-4">
              {isFr ? 'Le catalogue' : 'The catalogue'}
            </Eyebrow>
            <H2 id="modules-heading" className="max-w-[720px]">
              {isFr ? 'Quatre modules. ' : 'Four modules. '}
              <span className="text-q2-body">
                {isFr ? 'Chacun excellent à son métier.' : 'Each one excellent at its job.'}
              </span>
            </H2>
          </RevealV2>

          <div className="border-t border-q2-plate">
            {modules.map((m, i) => {
              const flip = i % 2 === 1;
              return (
                <RevealV2 key={m.id} as="article" className="border-b border-q2-plate">
                  <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center py-12 md:py-20">
                    <div className={flip ? 'lg:order-2' : ''}>
                      <div className="flex items-center gap-3 mb-6">
                        <span className="w-11 h-11 rounded-full bg-q2-plate flex items-center justify-center">
                          <m.icon size={18} className="text-q2-violet" aria-hidden="true" />
                        </span>
                        <span className="q2-eyebrow text-q2-body tabular-nums">{m.num}</span>
                      </div>
                      <h3 className="q2-h3 text-q2-ink mb-1.5">{m.name}</h3>
                      <p className="text-q2-body text-sm mb-5 q2-body-text">{m.tagline}</p>
                      <p className="text-q2-body text-base leading-relaxed max-w-[440px] mb-7 q2-body-text">
                        {m.description}
                      </p>
                      <ul className="space-y-3" role="list">
                        {m.features.map((f) => (
                          <li key={f} className="flex items-start gap-3 text-sm text-q2-graphite q2-body-text">
                            <Check size={15} className="mt-0.5 shrink-0 text-q2-violet" aria-hidden="true" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={flip ? 'lg:order-1' : ''}>{m.panel}</div>
                  </div>
                </RevealV2>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* TARIF, snapshot: prix unitaire à gauche et suite complète en card sombre */}
      <Section variant="band" hairline aria-labelledby="agent-pricing-heading" className="relative">
        <ShapeDrift shapes={[{ kind: 'disc', x: '-10%', y: '30%', size: 260, drift: -90, opacity: 0.24 }]} />
        <Container className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center">
          <RevealV2>
            <Eyebrow tone="violet" className="mb-4">
              {isFr ? 'Tarif' : 'Pricing'}
            </Eyebrow>
            <H2 id="agent-pricing-heading" className="mb-5 max-w-[520px]">
              197&nbsp;€ <SerifWord>{isFr ? 'par module, par mois.' : 'per module, per month.'}</SerifWord>
            </H2>
            <p className="text-q2-body text-[15px] leading-relaxed max-w-[440px] q2-body-text">
              {isFr
                ? 'Au lancement : ajoutez un, deux, trois ou les quatre. Activez ou désactivez quand vous voulez.'
                : 'At launch: add one, two, three or all four. Toggle anytime.'}
            </p>
          </RevealV2>

          <RevealV2 index={1}>
            <CardV2 variant="drenched">
              <p className="q2-eyebrow text-q2-fog mb-4">{isFr ? 'Suite complète' : 'Complete suite'}</p>
              <p className="flex items-baseline gap-2 mb-2 text-white">
                <span className="q2-price">788&nbsp;€</span>
                <span className="text-sm text-q2-fog">/{isFr ? 'mois' : 'month'}</span>
              </p>
              <p className="text-sm text-q2-mist mb-8 q2-body-text">
                {isFr ? 'Les 4 modules · au lancement' : 'All 4 modules · at launch'}
              </p>
              <ul className="border-t border-q2-graphite-d mb-8" role="list">
                {modules.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-4 border-b border-q2-graphite-d py-3.5 text-sm"
                  >
                    <span className="text-q2-mist">{m.name}</span>
                    <span className="text-q2-fog tabular-nums">197&nbsp;€</span>
                  </li>
                ))}
              </ul>
              <PillLink to="/contact" variant="onDark" size="lg" className="w-full">
                {isFr ? 'Être prévenu au lancement' : 'Get notified at launch'}
                <ArrowRight size={15} aria-hidden="true" />
              </PillLink>
            </CardV2>
          </RevealV2>
        </Container>
      </Section>

      {/* CTA FINAL, drenched: une seule action chromatique */}
      <Section variant="drenched-violet" aria-label={isFr ? 'Démarrer' : 'Get started'}>
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
          <RevealV2>
            <Display as="h2" onDark>
              {isFr ? (
                <>
                  Confiez votre business <SerifWord>à un seul agent.</SerifWord>
                </>
              ) : (
                <>
                  Hand your business <SerifWord>to one agent.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-2">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr
                ? 'En construction. Commencez avec le Réceptionniste IA, les modules s’y grefferont.'
                : 'In the works. Start with the AI Receptionist, the modules will bolt onto it.'}
            </p>
            <PillLink to="/receptionist" variant="chromatic" size="lg">
              {isFr ? 'Commencer avec le Réceptionniste' : 'Start with the Receptionist'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
