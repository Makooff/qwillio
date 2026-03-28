import { useState, useEffect, useRef } from 'react';
import { useSEO } from '../hooks/useSEO';
import { Link } from 'react-router-dom';
import {
  Mail, CreditCard, Calculator, Package, Check, ArrowRight,
  Zap, Shield, BarChart3, RefreshCw, BrainCircuit, Clock,
  Plug, Settings, Users, Smartphone, Receipt, TrendingUp,
  DollarSign, FileSpreadsheet, Truck, QrCode, Bell, Globe, Workflow
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

function Counter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        let t0 = 0;
        const step = (ts: number) => {
          if (!t0) t0 = ts;
          const p = Math.min((ts - t0) / 1800, 1);
          setN(Math.floor((1 - Math.pow(1 - p, 3)) * value));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);
  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>;
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Agent() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  useSEO({
    title: 'Qwillio Agent – AI Modules',
    description: isFr
      ? 'Qwillio Agent automatise votre CRM, facturation, suivi clients, emails et inventaire. Des modules IA avancés pour développer votre entreprise.'
      : 'Qwillio Agent automates your CRM, billing, client follow-up, emails and inventory. Advanced AI modules to grow your business.',
    canonical: 'https://qwillio.com/agent',
  });

  const benefits = [
    { icon: Zap, title: isFr ? 'Activation instantanee' : 'Instant activation', desc: isFr ? 'Un clic depuis votre dashboard. Operationnel en 60s.' : 'One click from your dashboard. Live in 60s.' },
    { icon: Shield, title: isFr ? 'Securise & conforme' : 'Secure & compliant', desc: isFr ? 'RGPD, CCPA, chiffrement bout-en-bout.' : 'GDPR, CCPA, end-to-end encryption.' },
    { icon: BarChart3, title: isFr ? 'Analytics avancés' : 'Advanced analytics', desc: isFr ? 'Performances par module en temps reel.' : 'Per-module performance in real time.' },
    { icon: RefreshCw, title: isFr ? 'Auto-apprentissage' : 'Self-learning', desc: isFr ? 'Micro-optimisations hebdomadaires auto.' : 'Automatic weekly micro-optimizations.' },
    { icon: BrainCircuit, title: isFr ? 'Propulse par GPT-4' : 'GPT-4 powered', desc: isFr ? 'Comprend le contexte de votre business.' : 'Understands your business context.' },
    { icon: Clock, title: isFr ? '24/7 autonome' : '24/7 autonomous', desc: isFr ? 'Nuits, week-ends, jours feries inclus.' : 'Nights, weekends, holidays included.' },
    { icon: Plug, title: isFr ? 'Integrations fluides' : 'Seamless integrations', desc: isFr ? 'Gmail, Stripe, QuickBooks en un clic.' : 'Gmail, Stripe, QuickBooks in one click.' },
    { icon: Settings, title: isFr ? 'Zero code' : 'No code', desc: isFr ? 'Tout depuis votre dashboard, sans technique.' : 'Everything from your dashboard, no tech.' },
    { icon: Users, title: isFr ? 'Sync Receptionist' : 'Works with Receptionist', desc: isFr ? 'Appels, emails, paiements tous connectes.' : 'Calls, emails, payments all connected.' },
  ];

  const howItWorks = [
    {
      step: '01',
      title: isFr ? 'Choisissez vos modules' : 'Choose your modules',
      desc: isFr
        ? 'Selectionnez Email, Payments, Accounting, Inventory ou les 4. Activez ou desactivez chaque module a tout moment depuis votre dashboard.'
        : 'Pick Email, Payments, Accounting, Inventory or all 4. Activate or deactivate each module anytime from your dashboard.',
      icon: Settings,
    },
    {
      step: '02',
      title: isFr ? 'Connectez vos outils' : 'Connect your tools',
      desc: isFr
        ? 'Liez Gmail, Stripe, QuickBooks en un clic via OAuth. Aucune API key, aucun code. Authentification securisee et instantanee.'
        : 'Link Gmail, Stripe, QuickBooks in one click via OAuth. No API keys, no code. Secure and instant authentication.',
      icon: Plug,
    },
    {
      step: '03',
      title: isFr ? 'L\'IA prend le relais' : 'AI takes over',
      desc: isFr
        ? 'Les modules commencent a travailler immediatement, 24/7 en autonomie complete. Vous recevez des rapports et gardez le controle total.'
        : 'Modules start working immediately, 24/7 fully autonomous. You receive reports and keep total control.',
      icon: BrainCircuit,
    },
  ];

  const modules = [
    {
      name: 'Email AI',
      icon: Mail,
      price: 197,
      desc: isFr
        ? 'Votre boite email, entierement automatisee. L\'IA lit, classe, repond et relance pour vous. Confirmations de RDV, sequences de suivi, detection de spam, le tout sans intervention humaine.'
        : 'Your inbox, fully automated. AI reads, classifies, replies, and follows up for you. Appointment confirmations, follow-up sequences, spam detection, all without human intervention.',
      features: isFr
        ? [
            'Integration Gmail & Outlook via OAuth',
            'Classification IA (urgent / spam / demande / reservation)',
            'Reponses personnalisees avec contexte business',
            'Confirmations de RDV avec lien calendrier',
            'Sequences de rappels (24h, 2h, 30min avant)',
            'Sequences de suivi (merci post-visite, demande d\'avis)',
            'Detection de spam & archivage auto',
            'Bibliotheque de templates (50+ modeles)',
            'Multi-langue (EN / FR)',
            'Analytics (taux d\'ouverture, taux de reponse, temps de reponse)',
          ]
        : [
            'Gmail & Outlook OAuth integration',
            'AI classification (urgent / spam / inquiry / booking)',
            'Personalized auto-replies using business context',
            'Appointment confirmations with calendar link',
            'Reminder sequences (24h, 2h, 30min before)',
            'Follow-up sequences (post-visit thank you, review request)',
            'Spam detection & auto-archive',
            'Template library (50+ templates)',
            'Multi-language (EN / FR)',
            'Analytics (open rate, reply rate, response time)',
          ],
      stats: [
        { label: isFr ? 'Temps de reponse moyen' : 'Avg response time', value: '2.3s' },
        { label: isFr ? 'Precision classification' : 'Classification accuracy', value: '95%' },
      ],
      color: 'from-blue-500/10 to-indigo-500/10',
      useCases: isFr
        ? [
            'Salon de coiffure: confirmations RDV automatiques avec lien de modification et rappels sequentiels',
            'Restaurant: gestion des reservations par email avec reponse instantanee et liste d\'attente automatique',
            'Cabinet medical: rappels patients avec instructions pre-visite et formulaires a remplir',
            'Garage auto: devis par email avec suivi automatique et relance si pas de reponse sous 48h',
            'Hotel: reponses aux demandes de disponibilite avec tarifs personnalises et upsell automatique',
          ]
        : [
            'Hair salon: auto appointment confirmations with modification link and sequential reminders',
            'Restaurant: email reservation management with instant replies and automatic waitlist',
            'Medical office: patient reminders with pre-visit instructions and forms to fill',
            'Auto shop: email quotes with automatic follow-up and re-engagement if no reply in 48h',
            'Hotel: availability inquiry replies with personalized rates and automatic upsell',
          ],
    },
    {
      name: 'Payments AI',
      icon: CreditCard,
      price: 97,
      desc: isFr
        ? 'Encaissez plus, plus vite. Liens de paiement SMS, acomptes automatiques, frais de no-show et dashboard revenus en temps reel. Integration native Stripe pour une experience sans friction.'
        : 'Collect more, faster. SMS payment links, automatic deposits, no-show fee enforcement, and real-time revenue dashboard. Native Stripe integration for a frictionless experience.',
      features: isFr
        ? [
            'Liens de paiement par SMS (Stripe Checkout)',
            'Demandes d\'acompte automatiques (% configurable)',
            'Application des frais de no-show',
            'Dashboard revenus (quotidien / hebdo / mensuel)',
            'Integration native Stripe',
            'Rappels de paiement (24h, 1h avant)',
            'Gestion des remboursements',
            'Generation automatique de factures',
            'Support multi-devises',
            'Configuration de paiements recurrents',
          ]
        : [
            'SMS payment links (Stripe Checkout)',
            'Automatic deposit requests (configurable %)',
            'No-show fee enforcement',
            'Revenue dashboard (daily / weekly / monthly)',
            'Native Stripe integration',
            'Payment reminders (24h, 1h before)',
            'Refund management',
            'Automatic invoice generation',
            'Multi-currency support',
            'Recurring payment setup',
          ],
      stats: [
        { label: isFr ? 'Taux d\'encaissement' : 'Collection rate', value: '98%' },
        { label: isFr ? 'Frais de setup' : 'Setup fee', value: '$0' },
      ],
      color: 'from-emerald-500/10 to-green-500/10',
      useCases: isFr
        ? [
            'Garage auto: acompte de 30% par SMS avant debut des reparations, solde a la livraison',
            'Hotel: pre-autorisation de carte a la reservation avec politique d\'annulation automatique',
            'Salon de beaute: frais d\'annulation no-show debites automatiquement, client notifie par SMS',
            'Restaurant: paiement d\'avance pour evenements prives et menus degustation avec lien Stripe',
            'Cabinet dentaire: plans de paiement echelonnes pour traitements couteux avec rappels auto',
          ]
        : [
            'Auto shop: 30% SMS deposit before starting repairs, balance on delivery',
            'Hotel: card pre-authorization at booking with automatic cancellation policy',
            'Beauty salon: no-show cancellation fees auto-charged, client notified via SMS',
            'Restaurant: advance payment for private events and tasting menus with Stripe link',
            'Dental office: installment payment plans for expensive treatments with auto reminders',
          ],
    },
    {
      name: 'Accounting AI',
      icon: Calculator,
      price: 297,
      desc: isFr
        ? 'Votre comptabilite en pilote automatique. Factures generees apres chaque appel, P&L mensuel, relances impayés automatiques et export fiscal. Synchronisez QuickBooks et Wave sans effort.'
        : 'Your accounting on autopilot. Invoices generated after every call, monthly P&L, automatic overdue reminders, and tax export. Sync QuickBooks and Wave effortlessly.',
      features: isFr
        ? [
            'Factures auto-generees depuis les appels',
            'Rapports P&L mensuels',
            'Relances impayés (3, 7, 14, 30 jours)',
            'Export fiscal PDF & CSV',
            'Synchronisation QuickBooks Online',
            'Integration Wave',
            'Rapprochement bancaire',
            'Categorisation IA des depenses',
            'Estimations fiscales trimestrielles',
            'Rapport de synthese annuel',
          ]
        : [
            'Auto-generated invoices from calls',
            'Monthly P&L reports',
            'Overdue reminders (3-day, 7-day, 14-day, 30-day)',
            'Tax export PDF & CSV',
            'QuickBooks Online sync',
            'Wave integration',
            'Bank reconciliation',
            'AI expense categorization',
            'Quarterly tax estimates',
            'Year-end summary report',
          ],
      stats: [
        { label: isFr ? 'Temps economise' : 'Time saved', value: isFr ? '12h/mois' : '12h/month' },
        { label: isFr ? 'Precision' : 'Accuracy', value: '99.2%' },
      ],
      color: 'from-purple-500/10 to-violet-500/10',
      useCases: isFr
        ? [
            'Cabinet avocat: facturation horaire automatique avec ventilation par dossier et client',
            'Restaurant: P&L en temps reel avec comparaison mensuelle et alertes de marge',
            'Salon de coiffure: relances clients impayés avec escalade automatique et notification SMS',
            'Agence immobiliere: factures de commissions auto-generees a la cloture de chaque vente',
            'Clinique veterinaire: export fiscal trimestriel avec categorisation automatique des depenses',
          ]
        : [
            'Law firm: automatic hourly billing with breakdown by case and client',
            'Restaurant: real-time P&L with monthly comparison and margin alerts',
            'Hair salon: overdue client reminders with automatic escalation and SMS notification',
            'Real estate agency: commission invoices auto-generated at each sale closing',
            'Vet clinic: quarterly tax export with automatic expense categorization',
          ],
    },
    {
      name: 'Inventory AI',
      icon: Package,
      price: 197,
      desc: isFr
        ? 'Ne tombez plus jamais en rupture de stock. Suivi en temps reel, alertes de seuils bas, commandes fournisseur automatiques et previsions IA. QR codes, historique complet et multi-sites.'
        : 'Never run out of stock again. Real-time tracking, low-stock alerts, automatic supplier orders, and AI forecasting. QR codes, complete history, and multi-site support.',
      features: isFr
        ? [
            'Dashboard stock en temps reel',
            'Alertes seuils bas configurables (email + SMS)',
            'Generation automatique de bons de commande fournisseur',
            'Generation & scan de QR codes',
            'Historique des mouvements & audit trail',
            'Previsions IA de la demande (7 / 14 / 30 jours)',
            'Support multi-sites',
            'Suivi des pertes & gaspillage',
            'Gestion fournisseurs',
            'Integration codes-barres',
          ]
        : [
            'Real-time stock dashboard',
            'Configurable low-stock alerts (email + SMS)',
            'Automatic supplier PO generation',
            'QR code generation & scanning',
            'Movement history & audit trail',
            'AI demand forecasting (7 / 14 / 30 day)',
            'Multi-location support',
            'Wastage tracking',
            'Supplier management',
            'Barcode integration',
          ],
      stats: [
        { label: isFr ? 'Reduction ruptures' : 'Reduce stockouts', value: '89%' },
        { label: isFr ? 'Economie annuelle' : 'Annual savings', value: '$2,400' },
      ],
      color: 'from-orange-500/10 to-amber-500/10',
      useCases: isFr
        ? [
            'Restaurant: alertes stock ingredients avec commande fournisseur auto quand le seuil est atteint',
            'Salon de beaute: reapprovisionnement automatique des produits capillaires et colorations',
            'Garage auto: suivi des pieces detachees avec historique par vehicule et fournisseur',
            'Boulangerie: previsions IA de la demande par jour de la semaine pour reduire le gaspillage',
            'Pharmacie: suivi multi-sites avec alertes d\'expiration et rotation FIFO automatique',
          ]
        : [
            'Restaurant: ingredient stock alerts with auto supplier order when threshold is reached',
            'Beauty salon: automatic restock of hair products and color treatments',
            'Auto shop: parts tracking with history by vehicle and supplier',
            'Bakery: AI demand forecasting by day of week to reduce wastage',
            'Pharmacy: multi-site tracking with expiration alerts and automatic FIFO rotation',
          ],
    },
  ];

  const integrations = [
    { name: 'Gmail', icon: Mail },
    { name: 'Outlook', icon: Mail },
    { name: 'Stripe', icon: CreditCard },
    { name: 'QuickBooks', icon: FileSpreadsheet },
    { name: 'Wave', icon: DollarSign },
    { name: 'Google Calendar', icon: Clock },
    { name: 'Calendly', icon: Clock },
    { name: 'HubSpot', icon: Users },
    { name: 'Zapier', icon: Workflow },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-28 text-center px-6">
        <FadeIn>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
            {isFr ? 'Automatisez' : 'Automate'}<br />
            <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
              {isFr ? 'tout votre' : 'your entire'}<br />{isFr ? 'business.' : 'business.'}
            </span>
          </h1>
        </FadeIn>
        <FadeIn delay={100}>
          <p className="mt-6 text-lg md:text-xl text-[#86868b] max-w-2xl mx-auto leading-relaxed">
            {isFr
              ? '4 modules IA specialises qui gerent vos emails, paiements, comptabilite et inventaire. Combinez-les avec votre receptionist pour une automatisation complete.'
              : '4 specialized AI modules that manage your emails, payments, accounting and inventory. Combine them with your receptionist for complete automation.'}
          </p>
        </FadeIn>
        <FadeIn delay={200}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              {isFr ? 'Commencer gratuitement' : 'Start free trial'} <ArrowRight size={18} />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 text-[#6366f1] text-base font-medium hover:underline"
            >
              {isFr ? 'Voir les tarifs' : 'View pricing'} <ArrowRight size={16} />
            </Link>
          </div>
        </FadeIn>
        {/* Stat counters */}
        <FadeIn delay={300}>
          <div className="mt-20 flex flex-row items-stretch justify-center divide-x divide-[#d2d2d7] w-full mx-auto">
            {[
              { value: 40,  suffix: 'hrs', prefix: '',  label: isFr ? 'Economisees/semaine' : 'Saved per week' },
              { value: 12,  suffix: 'k+',  prefix: '$', label: isFr ? 'Economises/an' : 'Saved/year' },
              { value: 99,  suffix: '.5%', prefix: '',  label: isFr ? 'Disponibilite' : 'Uptime' },
            ].map((s, i) => (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-center px-1 py-2">
                <p className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight whitespace-nowrap">
                  <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="text-[10px] sm:text-xs md:text-sm text-[#86868b] mt-1 text-center leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* How it works */}
      <section className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-20">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{isFr ? 'Comment ca marche' : 'How it works'}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Operationnel en 3 etapes.' : 'Up and running in 3 steps.'}
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {howItWorks.map((step, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="text-center">
                  <p className="text-6xl md:text-7xl font-bold mb-6 text-[#6366f1]">{step.step}</p>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">{step.title}</h3>
                  <p className="text-[15px] text-[#86868b] leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Features — 4 Modules */}
      <section id="features" className="py-24 md:py-32 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-20">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{isFr ? 'Fonctionnalites' : 'Features'}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? '4 modules. Un employe IA complet.' : '4 modules. A complete AI employee.'}
              </h2>
            </div>
          </FadeIn>

          <div className="space-y-20">
            {modules.map((mod, idx) => (
              <FadeIn key={idx} delay={idx * 100}>
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-[#e5e5ea] hover:shadow-xl hover:shadow-[#6366f1]/10 transition-all duration-500 ${idx % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                  {/* Gradient side */}
                  <div className={`bg-gradient-to-br ${idx % 2 === 0 ? 'from-[#6366f1] to-[#818cf8]' : 'from-[#8b5cf6] to-[#a78bfa]'} p-8 md:p-10 text-white flex flex-col justify-between min-h-[340px] ${idx % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                          <mod.icon size={24} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-semibold">{mod.name}</h3>
                          <p className="text-sm text-white/50">+${mod.price}/mo</p>
                        </div>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed max-w-md">{mod.desc}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-8">
                      {mod.stats.map((s, i) => (
                        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 text-center">
                          <p className="text-xl font-semibold">{s.value}</p>
                          <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Features side */}
                  <div className={`bg-white p-8 md:p-10 flex flex-col justify-center ${idx % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {mod.features.map((f, j) => (
                        <div key={j} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f5f5f7] transition-colors">
                          <div className={`w-6 h-6 rounded-lg ${idx % 2 === 0 ? 'bg-[#6366f1]/10' : 'bg-[#8b5cf6]/10'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <Check size={14} className={idx % 2 === 0 ? 'text-[#6366f1]' : 'text-[#8b5cf6]'} />
                          </div>
                          <span className="text-sm text-[#1d1d1f]/80 leading-snug">{f}</span>
                        </div>
                      ))}
                    </div>
                    <Link
                      to="/register"
                      className={`inline-flex items-center gap-2 ${idx % 2 === 0 ? 'bg-[#6366f1] hover:bg-[#4f46e5]' : 'bg-[#8b5cf6] hover:bg-[#7c3aed]'} text-white text-sm font-medium px-6 py-3 rounded-full transition-colors mt-8 self-start`}
                    >
                      {isFr ? 'Ajouter ce module' : 'Add this module'} <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* Integrations */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{isFr ? 'Integrations' : 'Integrations'}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Connectez vos outils preferes.' : 'Connect your favorite tools.'}
              </h2>
              <p className="text-lg text-[#86868b] mt-4">
                {isFr ? 'OAuth en un clic. Aucune API key requise.' : 'One-click OAuth. No API keys required.'}
              </p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-4">
            {integrations.map((integ, i) => (
              <FadeIn key={i} delay={i * 40}>
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[#f5f5f7] border border-[#d2d2d7]/40 hover:border-[#6366f1]/30 transition-colors">
                  <integ.icon size={28} className="text-[#6366f1] mb-2" />
                  <p className="text-xs font-medium text-[#1d1d1f] text-center">{integ.name}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{isFr ? 'Tarifs' : 'Pricing'}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Des modules, un prix simple.' : 'Modules, simply priced.'}
              </h2>
              <p className="text-lg text-[#86868b] mt-4">
                {isFr ? 'Choisissez vos modules ou prenez le bundle complet.' : 'Pick your modules or grab the full bundle.'}
              </p>
            </div>
          </FadeIn>

          {/* ── Add-on Module Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { name: 'Email AI', icon: Mail, price: 197, features: isFr ? ['Int\u00e9gration Gmail & Outlook', 'Classification IA', 'R\u00e9ponses personnalis\u00e9es', 'Confirmations RDV', 'S\u00e9quences de suivi'] : ['Gmail & Outlook integration', 'AI classification', 'Personalized auto-replies', 'Appointment confirmations', 'Follow-up sequences'] },
              { name: 'Payments AI', icon: CreditCard, price: 97, features: isFr ? ['Liens de paiement SMS', 'Acomptes automatiques', 'Frais de no-show', 'Dashboard revenus', 'Int\u00e9gration Stripe'] : ['SMS payment links', 'Automatic deposits', 'No-show fees', 'Revenue dashboard', 'Stripe integration'] },
              { name: 'Accounting AI', icon: Calculator, price: 297, features: isFr ? ['Factures auto-g\u00e9n\u00e9r\u00e9es', 'Rapports P&L mensuels', 'Relances impay\u00e9s', 'Export fiscal', 'Sync QuickBooks'] : ['Auto-generated invoices', 'Monthly P&L reports', 'Overdue reminders', 'Tax export', 'QuickBooks sync'] },
              { name: 'Inventory AI', icon: Package, price: 197, features: isFr ? ['Dashboard stock temps r\u00e9el', 'Alertes seuils bas', 'Commandes fournisseur auto', 'QR codes', 'Pr\u00e9visions IA'] : ['Real-time stock dashboard', 'Low-stock alerts', 'Auto supplier orders', 'QR codes', 'AI forecasting'] },
            ].map((mod, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="rounded-2xl border border-[#d2d2d7] p-8 hover:border-[#6366f1]/40 transition-colors h-full flex flex-col">
                  <mod.icon size={28} className="text-[#6366f1] mb-4" strokeWidth={1.5} />
                  <h4 className="text-lg font-semibold mb-1">{mod.name}</h4>
                  <div className="mb-4">
                    <span className="text-3xl font-semibold tracking-tight">+${mod.price}</span>
                    <span className="text-[#86868b]">/mo</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {mod.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]/80">
                        <Check size={15} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className="block text-center border border-[#6366f1] text-[#6366f1] text-sm font-medium px-6 py-2.5 rounded-full hover:bg-[#6366f1] hover:text-white transition-colors">
                    Add
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* ── Agent Bundle ── */}
          <FadeIn delay={400}>
            <div className="rounded-2xl border-2 border-[#6366f1] p-8 md:p-10 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6366f1] text-white text-xs font-semibold px-4 py-1 rounded-full">
                {isFr ? 'Meilleure offre' : 'Best value'}
              </span>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">{isFr ? 'Bundle complet' : 'Full Bundle'}</h3>
                  <p className="text-[#86868b] text-sm mb-4 max-w-lg">
                    {isFr ? 'Les 4 modules pour un prix r\u00e9duit. \u00c9conomisez $191/mois par rapport aux modules s\u00e9par\u00e9s.' : 'All 4 modules at a reduced price. Save $191/month compared to buying separately.'}
                  </p>
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-4xl font-semibold tracking-tight">+$597</span>
                      <span className="text-[#86868b]">/mo</span>
                    </div>
                    <div className="text-sm">
                      <p className="text-[#86868b] line-through">$788/mo</p>
                      <p className="text-emerald-600 font-medium">{isFr ? '\u00c9conomisez $191/mois' : 'Save $191/month'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <span className="flex items-center gap-2"><Check size={16} className="text-[#6366f1]" /> Email AI</span>
                    <span className="flex items-center gap-2"><Check size={16} className="text-[#6366f1]" /> Payments AI</span>
                    <span className="flex items-center gap-2"><Check size={16} className="text-[#6366f1]" /> Accounting AI</span>
                    <span className="flex items-center gap-2"><Check size={16} className="text-[#6366f1]" /> Inventory AI</span>
                  </div>
                  <Link
                    to="/register?bundle=true"
                    className="inline-flex items-center justify-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-8 py-3 rounded-full hover:bg-[#4f46e5] transition-colors mt-2"
                  >
                    {isFr ? 'Commencer avec le bundle' : 'Start with bundle'} <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* ── Compare Plans link ── */}
          <div className="mt-8 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-[#6366f1] text-base font-medium hover:underline">
              {isFr ? 'Comparer tous les plans' : 'Compare all plans'} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
