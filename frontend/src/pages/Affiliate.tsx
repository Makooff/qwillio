import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Share2, Wallet, UserPlus } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';

export default function Affiliate() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useSEO({
    title: isFr ? 'Programme d\'affiliation · Qwillio' : 'Affiliate program · Qwillio',
    description: isFr
      ? 'Gagnez 30% de commission récurrente. Aucun plafond.'
      : 'Earn 30% recurring commission. No cap.',
    canonical: 'https://qwillio.com/affiliate',
  });

  const steps = [
    {
      num: '01',
      accent: '#6366f1',
      icon: UserPlus,
      title: isFr ? 'Inscrivez-vous' : 'Sign up',
      desc: isFr
        ? 'Compte affilié créé en 30 secondes. Obtenez votre lien unique.'
        : 'Affiliate account created in 30 seconds. Get your unique link.',
    },
    {
      num: '02',
      accent: '#a855f7',
      icon: Share2,
      title: isFr ? 'Partagez' : 'Share',
      desc: isFr
        ? 'Lien dans vos emails, sur LinkedIn, votre site. Tracking automatique.'
        : 'Link in your emails, LinkedIn, your site. Automatic tracking.',
    },
    {
      num: '03',
      accent: '#6366f1',
      icon: Wallet,
      title: isFr ? 'Encaissez' : 'Cash in',
      desc: isFr
        ? 'Virement mensuel. 30% du MRR de chaque client recommandé, à vie.'
        : 'Monthly payout. 30% of recurring revenue from every referred customer, for life.',
    },
  ];

  const faqs = isFr
    ? [
        { q: 'Quel est le taux de commission ?', a: '30% du MRR de chaque client recommandé, versé chaque mois tant que le client reste actif. Pas de plafond, pas de dégressivité.' },
        { q: 'Comment suis-je payé ?', a: 'Virement bancaire automatique le 5 de chaque mois. Seuil minimum de $50. Reporting transparent dans votre dashboard affilié.' },
        { q: 'Y a-t-il un cookie de tracking ?', a: 'Oui, 90 jours. Si un prospect clique sur votre lien puis souscrit dans les 90 jours, la commission vous revient.' },
        { q: 'Puis-je faire de l\'affiliation et être client ?', a: 'Bien sûr. Beaucoup de nos meilleurs affiliés sont des clients qui recommandent l\'outil qu\'ils utilisent eux-mêmes.' },
      ]
    : [
        { q: 'What is the commission rate?', a: '30% of recurring revenue from each referred customer, paid monthly for as long as they stay active. No cap, no decay.' },
        { q: 'How am I paid?', a: 'Automatic bank transfer on the 5th of each month. Minimum threshold $50. Transparent reporting in your affiliate dashboard.' },
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
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main id="main">
        {/* ── HERO ──────────────────────────────────────────── */}
        <section
          aria-labelledby="aff-heading"
          className="pt-24 sm:pt-28 md:pt-36 pb-12 md:pb-20 px-5 sm:px-6"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.4fr_1fr] gap-12 items-end">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-4" style={{ color: '#a855f7' }}>
                {isFr ? 'Programme d\'affiliation' : 'Affiliate program'}
              </span>
              <h1
                id="aff-heading"
                className="text-[clamp(2.6rem,6vw,5rem)] font-semibold tracking-[-0.04em] leading-[0.98]"
              >
                {isFr ? (
                  <>
                    <span className="font-serif italic" style={{ color: '#6366f1' }}>30% de commission.</span><br />
                    <span className="font-serif italic" style={{ color: '#a855f7' }}>À vie.</span>
                  </>
                ) : (
                  <>
                    <span className="font-serif italic" style={{ color: '#6366f1' }}>30% commission.</span><br />
                    <span className="font-serif italic" style={{ color: '#a855f7' }}>For life.</span>
                  </>
                )}
              </h1>
            </div>
            <p className="text-[#525257] text-[15px] leading-relaxed max-w-[400px] pb-3">
              {isFr
                ? 'Pas de plafond. Pas de dégressivité. Pas de minimum mensuel. Recommandez Qwillio, encaissez chaque mois.'
                : 'No cap. No decay. No monthly minimum. Recommend Qwillio, get paid every month.'}
            </p>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────── */}
        <section
          aria-labelledby="how-heading"
          className="py-12 sm:py-16 md:py-24 px-6 border-t border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto">
            <h2
              id="how-heading"
              className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-12 max-w-[640px]"
            >
              {isFr ? <>Trois étapes. <span className="text-[#86868b] font-normal">Premier virement sous 30 jours.</span></>
                : <>Three steps. <span className="text-[#86868b] font-normal">First payout within 30 days.</span></>}
            </h2>

            <ol className="grid md:grid-cols-3 gap-8 md:gap-12" role="list">
              {steps.map((s) => (
                <li key={s.num} className="border-t-2 pt-5" style={{ borderColor: s.accent }}>
                  <p className="text-[11px] font-bold tracking-[0.2em] mb-3" style={{ color: s.accent }}>{s.num}</p>
                  <div className="flex items-center gap-3 mb-3">
                    <s.icon size={20} style={{ color: s.accent }} aria-hidden="true" />
                    <h3 className="text-xl font-semibold tracking-[-0.015em]">{s.title}</h3>
                  </div>
                  <p className="text-[#525257] leading-relaxed text-[15px]">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── COMMISSION TIERS — bento ─────────────────────── */}
        <section
          aria-labelledby="tiers-heading"
          className="py-12 sm:py-16 md:py-24 px-6 bg-[#fafaf8] border-y border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto">
            <h2
              id="tiers-heading"
              className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-10 max-w-[600px]"
            >
              {isFr
                ? <>Plus vous recommandez, <span className="font-serif italic" style={{ color: '#a855f7' }}>plus vous touchez.</span></>
                : <>The more you refer, <span className="font-serif italic" style={{ color: '#a855f7' }}>the more you earn.</span></>}
            </h2>

            <div className="grid lg:grid-cols-[1fr_1.4fr_1fr] gap-5">
              {tiers.map((t) => {
                const isGold = t.popular;
                return (
                  <article
                    key={t.name}
                    className={`relative rounded-[2rem] p-8 md:p-10 ${
                      isGold ? 'text-white' : 'border border-[#1d1d1f]/10 bg-white text-[#1d1d1f]'
                    }`}
                    style={
                      isGold
                        ? { background: 'linear-gradient(155deg, #1d1d1f 0%, #3a1f4a 60%, #a855f7 115%)' }
                        : undefined
                    }
                  >
                    <p className={`text-[11px] font-bold tracking-[0.18em] uppercase mb-3 ${isGold ? 'text-white/55' : 'text-[#86868b]'}`}>
                      {t.name}
                    </p>
                    <p className={`text-[clamp(2.6rem,4vw,3.4rem)] font-semibold tracking-[-0.04em] tabular-nums mb-2 ${isGold ? 'text-white' : 'text-[#1d1d1f]'}`}>
                      {t.rate}
                    </p>
                    <p className={`text-sm leading-relaxed ${isGold ? 'text-white/70' : 'text-[#525257]'}`}>
                      {t.desc}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIAL ─────────────────────────────────── */}
        <section className="py-12 sm:py-16 md:py-24 px-6">
          <div className="max-w-[1240px] mx-auto">
            <figure
              className="rounded-[2rem] px-8 md:px-16 py-14 md:py-20"
              style={{ background: '#a855f7' }}
            >
              <blockquote className="text-white text-[clamp(1.4rem,3vw,2.2rem)] font-semibold tracking-[-0.025em] leading-[1.25] max-w-[820px]">
                <span className="font-serif italic text-white/40 text-[1.8em] leading-none mr-2 align-[-0.18em]" aria-hidden="true">"</span>
                {isFr
                  ? 'Je touche $4 800 par mois sans rien faire. Trois clients recommandés il y a 18 mois, toujours actifs aujourd\'hui.'
                  : 'I make $4,800 a month doing nothing. Three customers I referred 18 months ago, still active today.'}
              </blockquote>
              <figcaption className="mt-6 text-white/80 text-sm">
                <span className="font-semibold text-white">Thomas K.</span>
                <span className="text-white/60"> — {isFr ? 'Consultant indépendant' : 'Independent consultant'}</span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────── */}
        <section
          aria-labelledby="faq-heading"
          className="py-12 sm:py-16 md:py-24 px-6"
        >
          <div className="max-w-[900px] mx-auto">
            <h2
              id="faq-heading"
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-semibold tracking-[-0.025em] mb-8"
            >
              {isFr ? 'Questions fréquentes.' : 'Frequently asked.'}
            </h2>
            <ul role="list" className="space-y-2">
              {faqs.map((f, i) => {
                const open = openFaq === i;
                return (
                  <li key={f.q} className="border-b border-[#1d1d1f]/10">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="w-full text-left py-5 flex items-center justify-between gap-4 group"
                    >
                      <span className="text-base md:text-lg font-medium text-[#1d1d1f] group-hover:text-[#a855f7] transition-colors">
                        {f.q}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#a855f7]' : 'text-[#86868b]'}`}
                        aria-hidden="true"
                      />
                    </button>
                    {open && (
                      <p className="text-[#525257] text-[15px] leading-relaxed pb-6 pr-8 max-w-[720px]">{f.a}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────── */}
        <section className="py-16 sm:py-20 md:py-32 px-6">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end border-t-2 border-[#1d1d1f] pt-12 md:pt-16">
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-semibold tracking-[-0.035em] leading-[0.98]">
              {isFr ? (
                <>
                  Prêt à toucher<br />
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>chaque mois ?</span>
                </>
              ) : (
                <>
                  Ready to get paid<br />
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>every month?</span>
                </>
              )}
            </h2>
            <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right pb-4">
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[320px] lg:ml-auto">
                {isFr ? 'Compte créé en 30 secondes. Lien unique immédiat.' : 'Account in 30 seconds. Unique link instantly.'}
              </p>
              <Link
                to="/register?role=affiliate"
                className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#a855f7] transition-colors"
              >
                {isFr ? 'Devenir affilié' : 'Become an affiliate'}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
