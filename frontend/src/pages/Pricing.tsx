import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { Check, ArrowRight, X, ChevronDown, ChevronUp } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';

/* ── Design tokens ── */
const D = {
  bg:      'oklch(8% 0.009 265)',
  border:  'oklch(22% 0.012 265 / 0.55)',
  text:    'oklch(95% 0.004 265)',
  text2:   'oklch(65% 0.007 265)',
  accent:  'oklch(56% 0.22 264)',
  lBg:     'oklch(96% 0.010 55)',
  lBorder: 'oklch(84% 0.012 55)',
  lText:   'oklch(12% 0.006 0)',
  lText2:  'oklch(40% 0.006 0)',
} as const;

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    sub: 'Pour les petites équipes',
    monthly: 29,
    annual: 23,
    calls: '500',
    agents: '1 agent IA',
    featured: false,
    features: [
      '500 appels / mois',
      '1 agent IA configuré',
      'Transcription automatique',
      'Dashboard analytics',
      'Support email',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    sub: 'Pour les équipes en croissance',
    monthly: 79,
    annual: 63,
    calls: '2 000',
    agents: '3 agents IA',
    featured: true,
    features: [
      '2 000 appels / mois',
      '3 agents IA configurés',
      'Analytics & sentiment IA',
      'Sync CRM native',
      'Transfert intelligent',
      'A/B testing de scripts',
      'Support prioritaire',
    ],
  },
  {
    id: 'agence',
    name: 'Agence',
    sub: 'Pour les agences & grands comptes',
    monthly: 199,
    annual: 159,
    calls: 'Illimité',
    agents: 'Agents illimités',
    featured: false,
    features: [
      'Appels illimités',
      'Agents IA illimités',
      'White-label complet',
      'API access full',
      'Account manager dédié',
      'SLA 99.5% garanti',
      'Onboarding personnalisé',
    ],
  },
] as const;

const COMPARISON = [
  { label: 'Appels / mois', s: '500', p: '2 000', a: 'Illimité' },
  { label: 'Agents IA', s: '1', p: '3', a: 'Illimité' },
  { label: 'Transcriptions', s: true, p: true, a: true },
  { label: 'Analytics avancées', s: false, p: true, a: true },
  { label: 'Sync CRM', s: false, p: true, a: true },
  { label: 'White-label', s: false, p: false, a: true },
  { label: 'API access', s: false, p: false, a: true },
  { label: 'Account manager', s: false, p: false, a: true },
];

const FAQS = [
  {
    q: 'Puis-je changer de plan à tout moment ?',
    a: 'Oui — upgrade ou downgrade à tout moment. La différence est calculée au prorata, sans frais cachés.',
  },
  {
    q: "Y a-t-il un engagement minimum ?",
    a: "Non. Tous les plans sont sans engagement. En annuel, vous économisez 20% et pouvez annuler à la prochaine période.",
  },
  {
    q: "Que se passe-t-il si je dépasse mon quota d'appels ?",
    a: "Vous recevez une alerte à 80% puis à 100%. Vous pouvez upgrader en un clic ou payer les appels supplémentaires à 0.09€/appel.",
  },
  {
    q: "Le white-label inclut-il le domaine personnalisé ?",
    a: "Oui. Le plan Agence inclut domaine custom, logo, couleurs et suppression complète de toute mention Qwillio.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b" style={{ borderColor: 'oklch(22% 0.012 265 / 0.3)' }}>
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="font-medium text-sm" style={{ color: D.text }}>{q}</span>
        {open
          ? <ChevronUp size={16} style={{ color: D.text2, flexShrink: 0 }} />
          : <ChevronDown size={16} style={{ color: D.text2, flexShrink: 0 }} />}
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed" style={{ color: D.text2 }}>{a}</p>
      )}
    </div>
  );
}

export default function Pricing() {
  useSEO({
    title: 'Tarifs — Qwillio',
    description: 'Tarifs Qwillio — Starter 29€, Pro 79€, Agence 199€. Sans engagement. Premier mois gratuit.',
    canonical: 'https://qwillio.com/pricing',
  });

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const price = (plan: typeof PLANS[number]) =>
    billing === 'annual' ? plan.annual : plan.monthly;

  return (
    <div style={{ background: D.bg, minHeight: '100dvh', fontFamily: "'Outfit', system-ui, sans-serif" }}>

      {/* ── Minimal nav ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 h-14"
        style={{ borderBottom: `1px solid ${D.border}`, background: 'oklch(8% 0.009 265 / 0.85)', backdropFilter: 'blur(20px)' }}
        aria-label="Navigation principale"
      >
        <Link to="/" className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
          <QwillioLogo size={24} />
          <span className="font-bold tracking-tight" style={{ color: D.text, fontSize: 17 }}>Qwillio</span>
        </Link>
        <Link
          to="/login"
          className="text-sm font-medium transition-colors hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-2 py-1"
          style={{ color: D.text2 }}
        >
          Se connecter
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-20 pb-12 text-center px-6">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-4"
          style={{ color: D.accent }}
        >
          Tarifs
        </p>
        <h1
          className="text-4xl md:text-6xl font-bold tracking-tight leading-tight max-w-2xl mx-auto"
          style={{ color: D.text, letterSpacing: '-0.03em' }}
        >
          Tarifs simples,<br />résultats mesurables
        </h1>
        <p className="mt-5 text-base md:text-lg max-w-md mx-auto leading-relaxed" style={{ color: D.text2 }}>
          Premier mois gratuit sur tous les plans. Aucun frais de setup. Annulez à tout moment.
        </p>

        {/* ── Billing toggle ── */}
        <div
          className="inline-flex items-center mt-10 rounded-full p-1 gap-1"
          style={{ background: 'oklch(13% 0.013 265)', border: `1px solid ${D.border}` }}
          role="group"
          aria-label="Fréquence de facturation"
        >
          {(['monthly', 'annual'] as const).map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className="relative px-5 py-2 rounded-full text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{
                background: billing === b ? D.accent : 'transparent',
                color: billing === b ? 'oklch(8% 0.009 265)' : D.text2,
              }}
              aria-pressed={billing === b}
            >
              {b === 'monthly' ? 'Mensuel' : 'Annuel'}
              {b === 'annual' && (
                <span
                  className="absolute -top-2 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: 'oklch(72% 0.18 145)', color: 'oklch(8% 0.009 265)' }}
                >
                  -20%
                </span>
              )}
            </button>
          ))}
        </div>
        {billing === 'annual' && (
          <p className="mt-3 text-xs font-medium" style={{ color: 'oklch(72% 0.18 145)' }}>
            2 mois offerts — facturé annuellement
          </p>
        )}
      </section>

      {/* ── Pricing cards — intentionally different visual weights ── */}
      <section className="px-6 pb-20" aria-label="Plans tarifaires">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 items-start">

          {/* Starter — light weight */}
          <article
            className="rounded-2xl p-7 flex flex-col"
            style={{ border: `1px solid ${D.border}`, background: 'oklch(10% 0.010 265)' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: D.text2 }}>
                {PLANS[0].name}
              </p>
              <p className="text-sm mb-5" style={{ color: D.text2 }}>{PLANS[0].sub}</p>
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-5xl font-bold tracking-tight" style={{ color: D.text }}>
                  {price(PLANS[0])}€
                </span>
                <span className="text-sm mb-2" style={{ color: D.text2 }}>/mois</span>
              </div>
              {billing === 'annual' && (
                <p className="text-xs mb-5" style={{ color: D.text2 }}>
                  soit {PLANS[0].annual * 12}€ / an
                </p>
              )}
            </div>
            <Link
              to={`/register?plan=starter&billing=${billing}`}
              className="mt-5 block text-center rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{ border: `1px solid ${D.border}`, color: D.text }}
            >
              Commencer gratuitement
            </Link>
            <ul className="mt-6 space-y-3">
              {PLANS[0].features.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: D.text2 }}>
                  <Check size={14} style={{ color: D.accent, marginTop: 2, flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
          </article>

          {/* Pro — FEATURED, visually dominant, scale up with indigo border */}
          <article
            className="rounded-2xl p-8 flex flex-col relative md:-mt-4 md:-mb-4"
            style={{
              border: '2px solid oklch(56% 0.22 264)',
              background: 'oklch(11% 0.015 265)',
              boxShadow: '0 0 0 1px oklch(56% 0.22 264 / 0.15), 0 24px 60px oklch(56% 0.22 264 / 0.18)',
            }}
            aria-label="Plan recommandé"
          >
            <span
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full"
              style={{ background: D.accent, color: 'oklch(8% 0.009 265)' }}
            >
              Le plus populaire
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: D.accent }}>
                {PLANS[1].name}
              </p>
              <p className="text-sm mb-5" style={{ color: D.text2 }}>{PLANS[1].sub}</p>
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-5xl font-bold tracking-tight" style={{ color: D.text }}>
                  {price(PLANS[1])}€
                </span>
                <span className="text-sm mb-2" style={{ color: D.text2 }}>/mois</span>
              </div>
              {billing === 'annual' && (
                <p className="text-xs mb-5" style={{ color: D.text2 }}>
                  soit {PLANS[1].annual * 12}€ / an
                </p>
              )}
            </div>
            <Link
              to={`/register?plan=pro&billing=${billing}`}
              className="mt-5 block text-center rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ background: D.accent, color: 'oklch(8% 0.009 265)' }}
            >
              Commencer gratuitement <ArrowRight size={14} className="inline ml-1" />
            </Link>
            <ul className="mt-6 space-y-3">
              {PLANS[1].features.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: D.text2 }}>
                  <Check size={14} style={{ color: D.accent, marginTop: 2, flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
          </article>

          {/* Agence — subdued luxury */}
          <article
            className="rounded-2xl p-7 flex flex-col"
            style={{
              border: `1px solid oklch(38% 0.010 265)`,
              background: 'oklch(9.5% 0.008 265)',
            }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'oklch(68% 0.14 290)' }}>
                {PLANS[2].name}
              </p>
              <p className="text-sm mb-5" style={{ color: D.text2 }}>{PLANS[2].sub}</p>
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-5xl font-bold tracking-tight" style={{ color: D.text }}>
                  {price(PLANS[2])}€
                </span>
                <span className="text-sm mb-2" style={{ color: D.text2 }}>/mois</span>
              </div>
              {billing === 'annual' && (
                <p className="text-xs mb-5" style={{ color: D.text2 }}>
                  soit {PLANS[2].annual * 12}€ / an
                </p>
              )}
            </div>
            <Link
              to={`/register?plan=agence&billing=${billing}`}
              className="mt-5 block text-center rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{ border: `1px solid oklch(38% 0.010 265)`, color: D.text }}
            >
              Contacter les ventes
            </Link>
            <ul className="mt-6 space-y-3">
              {PLANS[2].features.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: D.text2 }}>
                  <Check size={14} style={{ color: 'oklch(68% 0.14 290)', marginTop: 2, flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
          </article>

        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="px-6 py-20" aria-labelledby="comparison-heading">
        <div className="max-w-3xl mx-auto">
          <h2
            id="comparison-heading"
            className="text-2xl md:text-3xl font-bold tracking-tight text-center mb-10"
            style={{ color: D.text, letterSpacing: '-0.025em' }}
          >
            Comparaison détaillée
          </h2>
          <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${D.border}` }}>
            <table className="w-full text-sm" role="table">
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}`, background: 'oklch(10% 0.010 265)' }}>
                  <th className="text-left py-4 px-6 font-medium" style={{ color: D.text2 }}>Fonctionnalité</th>
                  <th className="text-center py-4 px-4 font-semibold" style={{ color: D.text }}>Starter</th>
                  <th className="text-center py-4 px-4 font-bold" style={{ color: D.accent }}>Pro</th>
                  <th className="text-center py-4 px-4 font-semibold" style={{ color: D.text }}>Agence</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: i < COMPARISON.length - 1 ? `1px solid oklch(22% 0.012 265 / 0.3)` : 'none' }}
                  >
                    <td className="py-3.5 px-6" style={{ color: D.text2 }}>{row.label}</td>
                    {(['s', 'p', 'a'] as const).map(k => (
                      <td key={k} className="text-center py-3.5 px-4">
                        {typeof row[k] === 'boolean' ? (
                          row[k]
                            ? <Check size={15} style={{ color: D.accent, margin: '0 auto' }} aria-label="Inclus" />
                            : <X size={15} style={{ color: 'oklch(35% 0.006 265)', margin: '0 auto' }} aria-label="Non inclus" />
                        ) : (
                          <span className="font-medium" style={{ color: D.text }}>{row[k]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 py-20" aria-labelledby="faq-heading">
        <div className="max-w-2xl mx-auto">
          <h2
            id="faq-heading"
            className="text-2xl md:text-3xl font-bold tracking-tight text-center mb-10"
            style={{ color: D.text, letterSpacing: '-0.025em' }}
          >
            Questions fréquentes
          </h2>
          {FAQS.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 text-center" aria-label="Appel à l'action">
        <div
          className="max-w-xl mx-auto rounded-3xl px-8 py-14"
          style={{ border: `1px solid ${D.border}`, background: 'oklch(10% 0.010 265)' }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" style={{ color: D.text, letterSpacing: '-0.03em' }}>
            Prêt à commencer ?
          </h2>
          <p className="text-sm mb-8" style={{ color: D.text2 }}>
            Premier mois gratuit. Aucune carte requise.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{ background: D.accent, color: 'oklch(8% 0.009 265)' }}
          >
            Commencer gratuitement <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-xs" style={{ color: 'oklch(42% 0.006 265)' }}>
            Déjà un compte ?{' '}
            <Link to="/login" className="hover:underline" style={{ color: D.text2 }}>Se connecter</Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-6 py-8 text-center text-xs"
        style={{ borderTop: `1px solid ${D.border}`, color: 'oklch(40% 0.006 265)' }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <QwillioLogo size={18} />
          <span className="font-semibold" style={{ color: D.text2 }}>Qwillio</span>
        </div>
        <p>© {new Date().getFullYear()} Qwillio. Tous droits réservés.</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <a href="#" className="hover:underline" style={{ color: 'oklch(40% 0.006 265)' }}>CGU</a>
          <a href="#" className="hover:underline" style={{ color: 'oklch(40% 0.006 265)' }}>Confidentialité</a>
          <a href="#" className="hover:underline" style={{ color: 'oklch(40% 0.006 265)' }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}
