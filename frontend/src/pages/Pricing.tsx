import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { Check, ArrowRight, Mail, CreditCard, Calculator, Package, Plus } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`animate-fade-in ${className}`} style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
      {children}
    </div>
  );
}

export default function Pricing() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  useSEO({
    title: 'Pricing',
    description: isFr
      ? 'Tarifs Qwillio – à partir de 497$/mois. Premier mois gratuit, sans frais d\'installation. Plans Starter, Pro et Enterprise disponibles.'
      : 'Qwillio pricing – starting at $497/month. First month free, no setup fee. Starter, Pro and Enterprise plans with AI receptionist and automation.',
    canonical: 'https://qwillio.com/pricing',
  });

  const plans = [
    {
      name: 'Starter',
      sub: isFr ? 'Pour les petites entreprises' : 'For small businesses',
      price: 497,
      calls: 800,
      overage: 0.22,
      popular: false,
      features: isFr
        ? ['Ashley (EN) ou Marie (FR) — voix IA dediee', '800 appels/mois inclus', 'Prise de RDV + calendrier', 'Dashboard analytics', 'Support email', 'Transcription des appels', 'SMS de suivi automatique']
        : ['Ashley (EN) or Marie (FR) — dedicated AI voice', '800 calls/month included', 'Appointment booking + calendar', 'Analytics dashboard', 'Email support', 'Call transcription', 'Automatic follow-up SMS'],
    },
    {
      name: 'Pro',
      sub: isFr ? 'Pour les entreprises en croissance' : 'For growing businesses',
      price: 1297,
      calls: 2000,
      overage: 0.18,
      popular: true,
      features: isFr
        ? ['Tout Starter inclus', '2 000 appels/mois inclus', 'Analytics avancees + sentiments', 'Transfert d\'appel intelligent', 'Support prioritaire', 'Integrations CRM natives', 'A/B testing scripts', 'Detection boite vocale']
        : ['Everything in Starter', '2,000 calls/month included', 'Advanced analytics + sentiments', 'Smart call transfer', 'Priority support', 'Native CRM integrations', 'Script A/B testing', 'Voicemail detection'],
    },
    {
      name: 'Enterprise',
      sub: isFr ? 'Pour les grands comptes' : 'For large organizations',
      price: 2497,
      calls: 4000,
      overage: 0.15,
      popular: false,
      features: isFr
        ? ['Tout Pro inclus', '4 000 appels/mois inclus', 'Account manager dedie', 'SLA 99.5% uptime garanti', 'Onboarding personnalise', 'API access complet', 'Numero local de proximite', 'IA auto-apprenante']
        : ['Everything in Pro', '4,000 calls/month included', 'Dedicated account manager', '99.5% uptime SLA guaranteed', 'Personalized onboarding', 'Full API access', 'Local presence number', 'Self-learning AI'],
    },
  ];

  const addons = [
    { name: 'Email AI', icon: Mail, price: 197, desc: isFr ? 'Gestion emails IA' : 'AI email management', features: isFr ? ['Integration Gmail & Outlook', 'Classification IA', 'Reponses auto', 'Confirmations RDV', 'Sequences de relance'] : ['Gmail & Outlook integration', 'AI classification', 'Auto-replies', 'Appointment confirmations', 'Follow-up sequences'] },
    { name: 'Payments AI', icon: CreditCard, price: 97, desc: isFr ? 'Paiements & encaissement' : 'Payments & collection', features: isFr ? ['Liens paiement SMS', 'Acomptes automatiques', 'Frais no-show', 'Dashboard revenus', 'Integration Stripe'] : ['SMS payment links', 'Auto deposits', 'No-show fees', 'Revenue dashboard', 'Stripe integration'] },
    { name: 'Accounting AI', icon: Calculator, price: 297, desc: isFr ? 'Comptabilite automatisee' : 'Automated accounting', features: isFr ? ['Factures auto', 'P&L mensuel', 'Relances impayés', 'Export fiscal', 'QuickBooks & Wave'] : ['Auto invoices', 'Monthly P&L', 'Overdue reminders', 'Tax export', 'QuickBooks & Wave'] },
    { name: 'Inventory AI', icon: Package, price: 197, desc: isFr ? 'Gestion des stocks' : 'Inventory management', features: isFr ? ['Suivi stock temps reel', 'Alertes seuils bas', 'Commandes auto', 'QR codes', 'Historique mouvements'] : ['Real-time tracking', 'Low-stock alerts', 'Auto orders', 'QR codes', 'Movement history'] },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-32 pb-16 md:pt-44 md:pb-20 text-center px-6">
        <FadeIn>
          <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-4">{isFr ? 'Tarifs' : 'Pricing'}</p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
            {isFr ? 'Simple.' : 'Simple.'}{' '}
            <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
              {isFr ? 'Transparent.' : 'Transparent.'}
            </span>
          </h1>
        </FadeIn>
        <FadeIn delay={100}>
          <p className="mt-6 text-lg md:text-xl text-[#86868b] max-w-xl mx-auto leading-relaxed">
            {isFr
              ? 'Premier mois gratuit sur tous les plans. Pas de frais de setup. Annulez a tout moment.'
              : 'First month free on all plans. No setup fee. Cancel anytime.'}
          </p>
        </FadeIn>
      </section>

      {/* Receptionist Plans */}
      <section className="pb-24 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{isFr ? 'Receptionist AI' : 'Receptionist AI'}</h2>
              <p className="text-[#86868b] mt-3">{isFr ? 'Votre standardiste IA qui repond 24/7' : 'Your AI receptionist that answers 24/7'}</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className={`rounded-2xl ${plan.popular ? 'bg-[#1d1d1f] text-white' : 'border border-[#d2d2d7]'} p-8 flex flex-col h-full relative`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6366f1] text-white text-xs font-semibold px-4 py-1 rounded-full">
                      {isFr ? 'Populaire' : 'Most popular'}
                    </span>
                  )}
                  <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                  <p className={`text-sm mb-6 ${plan.popular ? 'text-white/50' : 'text-[#86868b]'}`}>{plan.sub}</p>
                  <div className="mb-2">
                    <span className="text-4xl font-semibold tracking-tight">${plan.price.toLocaleString()}</span>
                    <span className={plan.popular ? 'text-white/50' : 'text-[#86868b]'}>/mo</span>
                  </div>
                  <p className={`text-sm font-semibold mb-1 ${plan.popular ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {isFr ? '✓ Premier mois gratuit' : '✓ First month free'}
                  </p>
                  <p className={`text-xs font-medium mb-4 ${plan.popular ? 'text-blue-400' : 'text-blue-500'}`}>
                    {isFr ? 'Aucun frais de setup' : 'No setup fee'}
                  </p>
                  <p className={`text-sm font-medium mb-1 ${plan.popular ? 'text-[#6366f1]' : 'text-[#6366f1]'}`}>{plan.calls.toLocaleString()} {isFr ? 'appels/mois inclus' : 'calls/month included'}</p>
                  <p className={`text-xs mb-6 ${plan.popular ? 'text-white/40' : 'text-[#86868b]'}`}>${plan.overage} {isFr ? 'par appel supplementaire' : 'overage/call'}</p>
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className={`flex items-start gap-2.5 text-sm ${plan.popular ? 'text-white/70' : 'text-[#1d1d1f]/80'}`}>
                        <Check size={16} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-2 mb-6">
                    <Link to={`/register?plan=${plan.name.toLowerCase()}&bundle=true`} className={`flex items-center justify-between rounded-full px-4 py-3 transition-colors text-sm font-medium ${plan.popular ? 'border border-white/60 text-white hover:bg-white/10' : 'border border-[#6366f1] text-[#6366f1] hover:bg-[#6366f1] hover:text-white'}`}>
                      <span className="flex items-center gap-2"><Plus size={16} /> {isFr ? 'Ajouter Agent Bundle' : 'Add Agent Bundle'}</span>
                      <span className="font-semibold">+$597/mo</span>
                    </Link>
                    <a href="#addons" className={`flex items-center justify-center gap-2 rounded-full px-4 py-3 transition-colors text-sm font-medium ${plan.popular ? 'border border-white/60 text-white hover:bg-white/10' : 'border border-[#6366f1] text-[#6366f1] hover:bg-[#6366f1] hover:text-white'}`}>
                      <Plus size={16} />
                      <span>{isFr ? 'Ajouter des add-ons' : 'Add add-ons'}</span>
                    </a>
                  </div>
                  <Link to={`/register?plan=${plan.name.toLowerCase()}`} className="block text-center text-sm font-medium px-6 py-3 rounded-full transition-colors bg-[#6366f1] text-white hover:bg-[#4f46e5]">
                    {isFr ? 'Choisir ce plan' : 'Choose this plan'}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* Agent Add-ons */}
      <section id="addons" className="py-24 md:py-32 px-6 scroll-mt-24">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">Qwillio Agent</p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{isFr ? 'Modules add-on' : 'Add-on modules'}</h2>
              <p className="text-[#86868b] mt-3 max-w-lg mx-auto">{isFr ? 'Ajoutez des modules IA specialises a votre plan.' : 'Add specialized AI modules to your plan.'}</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {addons.map((mod, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="rounded-2xl border border-[#d2d2d7] p-8 hover:border-[#6366f1]/40 transition-colors h-full flex flex-col">
                  <mod.icon size={28} className="text-[#6366f1] mb-4" strokeWidth={1.5} />
                  <h4 className="text-lg font-semibold mb-1">{mod.name}</h4>
                  <p className="text-sm text-[#86868b] mb-4 leading-relaxed">{mod.desc}</p>
                  <div className="mb-6">
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

          {/* Bundle row */}
          <FadeIn delay={400}>
            <div className="mt-12 rounded-2xl border-2 border-[#6366f1] p-8 text-center">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <div>
                  <h3 className="text-xl font-semibold">Agent Bundle</h3>
                  <p className="text-sm text-[#86868b]">{isFr ? 'Les 4 modules — economisez $191/mois' : 'All 4 modules — save $191/month'}</p>
                </div>
                <div className="text-center">
                  <span className="text-4xl font-semibold tracking-tight">+$597</span>
                  <span className="text-[#86868b]">/mo</span>
                  <p className="text-xs text-[#86868b] mt-1">{isFr ? 'au lieu de' : 'instead of'} $788/mo</p>
                </div>
                <Link to="/register?bundle=true" className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors">
                  {isFr ? 'Choisir le bundle' : 'Choose bundle'} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* Comparison table */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-[900px] mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{isFr ? 'Comparaison detaillee' : 'Detailed comparison'}</h2>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#d2d2d7]">
                    <th className="text-left py-4 pr-4 font-medium text-[#86868b]">{isFr ? 'Fonctionnalite' : 'Feature'}</th>
                    <th className="text-center py-4 px-4 font-semibold">Starter</th>
                    <th className="text-center py-4 px-4 font-semibold text-[#6366f1]">Pro</th>
                    <th className="text-center py-4 px-4 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: isFr ? 'Appels/mois' : 'Calls/month', s: '800', p: '2,000', e: '4,000' },
                    { feature: isFr ? 'Cout supplementaire' : 'Overage cost', s: '$0.22', p: '$0.18', e: '$0.15' },
                    { feature: isFr ? 'Voix IA dediee' : 'Dedicated AI voice', s: true, p: true, e: true },
                    { feature: isFr ? 'Prise de RDV' : 'Appointment booking', s: true, p: true, e: true },
                    { feature: isFr ? 'Analytics de base' : 'Basic analytics', s: true, p: true, e: true },
                    { feature: isFr ? 'Analytics avancees' : 'Advanced analytics', s: false, p: true, e: true },
                    { feature: isFr ? 'Transfert intelligent' : 'Smart transfer', s: false, p: true, e: true },
                    { feature: isFr ? 'Integrations CRM' : 'CRM integrations', s: false, p: true, e: true },
                    { feature: isFr ? 'A/B testing scripts' : 'Script A/B testing', s: false, p: true, e: true },
                    { feature: 'SLA 99.5%', s: false, p: false, e: true },
                    { feature: isFr ? 'Account manager dedie' : 'Dedicated account manager', s: false, p: false, e: true },
                    { feature: isFr ? 'Acces API complet' : 'Full API access', s: false, p: false, e: true },
                    { feature: isFr ? 'Numero local' : 'Local presence number', s: false, p: false, e: true },
                    { feature: isFr ? 'IA auto-apprenante' : 'Self-learning AI', s: false, p: false, e: true },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-[#d2d2d7]/40">
                      <td className="py-3 pr-4 text-[#1d1d1f]/80">{row.feature}</td>
                      {['s', 'p', 'e'].map((k) => (
                        <td key={k} className="text-center py-3 px-4">
                          {typeof (row as any)[k] === 'boolean'
                            ? (row as any)[k]
                              ? <Check size={16} className="text-[#6366f1] mx-auto" />
                              : <span className="text-[#d2d2d7]">—</span>
                            : <span className="font-medium">{(row as any)[k]}</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
        <div className="max-w-[700px] mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-12">FAQ</h2>
          </FadeIn>
          {[
            { q: isFr ? 'Puis-je changer de plan a tout moment ?' : 'Can I change plans anytime?', a: isFr ? 'Oui, vous pouvez upgrader ou downgrader a tout moment. La difference est calculee au prorata.' : 'Yes, you can upgrade or downgrade anytime. The difference is prorated.' },
            { q: isFr ? 'Que se passe-t-il apres le mois gratuit ?' : 'What happens after the free month?', a: isFr ? 'Votre carte sera debitee au tarif du plan choisi. Vous pouvez annuler avant la fin du mois gratuit sans etre facture.' : 'Your card will be charged at the chosen plan rate. You can cancel before the end of the free month without being billed.' },
            { q: isFr ? 'Les add-ons Agent sont-ils obligatoires ?' : 'Are Agent add-ons required?', a: isFr ? 'Non, les add-ons sont completement optionnels. Votre Receptionist AI fonctionne parfaitement seul.' : 'No, add-ons are completely optional. Your Receptionist AI works perfectly on its own.' },
            { q: isFr ? 'Y a-t-il un engagement ?' : 'Is there a commitment?', a: isFr ? 'Non, tous les plans sont sans engagement. Annulez a tout moment.' : 'No, all plans are commitment-free. Cancel anytime.' },
            { q: isFr ? 'Que se passe-t-il si je depasse mes appels ?' : 'What if I exceed my call limit?', a: isFr ? 'Chaque appel supplementaire est facture au tarif de depassement de votre plan. Pas de surprise.' : 'Each additional call is billed at your plan\'s overage rate. No surprises.' },
          ].map((faq, i) => (
            <FadeIn key={i} delay={i * 60}>
              <div className="mb-8">
                <h3 className="text-base font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-[#86868b] leading-relaxed">{faq.a}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 px-6 text-center">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-2xl mx-auto">
            {isFr ? 'Pret a commencer ?' : 'Ready to get started?'}
          </h2>
          <p className="mt-5 text-lg text-[#86868b] max-w-md mx-auto">
            {isFr ? 'Premier mois gratuit. Pas de carte requise.' : 'First month free. No card required.'}
          </p>
          <div className="mt-10">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              {isFr ? 'Commencer gratuitement' : 'Start free trial'} <ArrowRight size={18} />
            </Link>
          </div>
        </FadeIn>
      </section>

      <PublicFooter />
    </div>
  );
}
