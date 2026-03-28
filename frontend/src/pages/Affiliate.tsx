import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, DollarSign, Users, Share2, BarChart3, Gift, Zap, Shield, Clock, TrendingUp, Percent } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function Affiliate() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const steps = [
    {
      num: '01',
      title: isFr ? 'Inscrivez-vous' : 'Sign up',
      desc: isFr ? 'Creez votre compte affilie en 2 minutes. Recevez votre lien unique et vos ressources marketing.' : 'Create your affiliate account in 2 minutes. Get your unique link and marketing resources.',
    },
    {
      num: '02',
      title: isFr ? 'Partagez' : 'Share',
      desc: isFr ? 'Partagez votre lien avec votre audience. Nous fournissons bannieres, emails et contenus prets a utiliser.' : 'Share your link with your audience. We provide banners, emails, and ready-to-use content.',
    },
    {
      num: '03',
      title: isFr ? 'Gagnez' : 'Earn',
      desc: isFr ? 'Touchez 30% de commission recurrente sur chaque client. Paiements mensuels via Stripe.' : 'Earn 30% recurring commission on every client. Monthly payouts via Stripe.',
    },
  ];

  const benefits = [
    { icon: Percent, title: isFr ? '30% recurrent' : '30% recurring', desc: isFr ? 'Commission a vie sur chaque client referé.' : 'Lifetime commission on every referred client.' },
    { icon: Clock, title: isFr ? 'Cookie 90 jours' : '90-day cookie', desc: isFr ? 'Vos referrals sont trackes pendant 90 jours.' : 'Your referrals are tracked for 90 days.' },
    { icon: DollarSign, title: isFr ? 'Paiements mensuels' : 'Monthly payouts', desc: isFr ? 'Virements automatiques via Stripe chaque mois.' : 'Automatic payouts via Stripe every month.' },
    { icon: BarChart3, title: isFr ? 'Dashboard temps reel' : 'Real-time dashboard', desc: isFr ? 'Suivez vos clics, conversions et revenus.' : 'Track your clicks, conversions, and revenue.' },
    { icon: Gift, title: isFr ? 'Ressources marketing' : 'Marketing resources', desc: isFr ? 'Bannieres, emails, contenus prets a partager.' : 'Banners, emails, ready-to-share content.' },
    { icon: Shield, title: isFr ? 'Pas de limite' : 'No limits', desc: isFr ? 'Aucun plafond de commission. Plus vous referez, plus vous gagnez.' : 'No commission cap. The more you refer, the more you earn.' },
  ];

  const earnings = [
    { plan: 'Starter', price: '$497/mo', commission: '$149', yearly: '$1,788' },
    { plan: 'Pro', price: '$1,297/mo', commission: '$389', yearly: '$4,668' },
    { plan: 'Enterprise', price: '$2,497/mo', commission: '$749', yearly: '$8,988' },
  ];

  const idealFor = [
    { icon: Users, title: isFr ? 'Consultants' : 'Consultants', desc: isFr ? 'Conseillers en marketing digital, business coaches.' : 'Digital marketing advisors, business coaches.' },
    { icon: Share2, title: isFr ? 'Influenceurs' : 'Influencers', desc: isFr ? 'Createurs de contenu, YouTubers, podcasters.' : 'Content creators, YouTubers, podcasters.' },
    { icon: TrendingUp, title: isFr ? 'Agences' : 'Agencies', desc: isFr ? 'Agences web, marketing et communication.' : 'Web, marketing and communication agencies.' },
    { icon: Zap, title: isFr ? 'Revendeurs SaaS' : 'SaaS resellers', desc: isFr ? 'Partenaires tech qui recommandent des outils.' : 'Tech partners who recommend tools.' },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-28 pb-14 md:pt-44 md:pb-24 text-center px-6">
        <FadeIn>
          <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-4">{isFr ? 'Programme affilié' : 'Affiliate program'}</p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
            {isFr ? 'Recommandez. ' : 'Refer. '}
            <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
              {isFr ? 'Gagnez.' : 'Earn.'}
            </span>
          </h1>
        </FadeIn>
        <FadeIn delay={100}>
          <p className="mt-6 text-lg md:text-xl text-[#86868b] max-w-2xl mx-auto leading-relaxed">
            {isFr
              ? 'Touchez 30% de commission recurrente sur chaque client que vous nous envoyez. Pas de plafond, pas de limite.'
              : 'Earn 30% recurring commission on every client you send our way. No cap, no limits.'}
          </p>
        </FadeIn>
        <FadeIn delay={200}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register?affiliate=true"
              className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              {isFr ? 'Devenir affilie' : 'Become an affiliate'} <ArrowRight size={18} />
            </Link>
          </div>
        </FadeIn>

        {/* Stats */}
        <FadeIn delay={400}>
          <div className="mt-12 flex flex-row items-stretch justify-center divide-x divide-[#d2d2d7] text-center mx-auto">
            <div className="px-8 py-2">
              <p className="text-3xl md:text-4xl font-semibold tracking-tight">30%</p>
              <p className="text-sm text-[#86868b] mt-1">{isFr ? 'Commission' : 'Commission'}</p>
            </div>
            <div className="px-8 py-2">
              <p className="text-3xl md:text-4xl font-semibold tracking-tight">90 {isFr ? 'jours' : 'days'}</p>
              <p className="text-sm text-[#86868b] mt-1">Cookie</p>
            </div>
            <div className="px-8 py-2">
              <p className="text-3xl md:text-4xl font-semibold tracking-tight">{isFr ? 'À vie' : 'Lifetime'}</p>
              <p className="text-sm text-[#86868b] mt-1">{isFr ? 'Récurrence' : 'Recurring'}</p>
            </div>
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
                {isFr ? 'Simple comme 1, 2, 3.' : 'Simple as 1, 2, 3.'}
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {steps.map((step, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="text-center">
                  <p className="text-6xl md:text-7xl font-bold mb-6 text-[#6366f1]">{step.num}</p>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">{step.title}</h3>
                  <p className="text-[15px] text-[#86868b] leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{isFr ? 'Avantages' : 'Benefits'}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Pourquoi nous rejoindre.' : 'Why join us.'}
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="rounded-2xl border border-[#e5e5ea] p-6 hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all duration-300 group h-full">
                  <div className="w-12 h-12 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-4 group-hover:bg-[#6366f1]/15 transition-colors">
                    <b.icon size={24} className="text-[#6366f1]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                  <p className="text-sm text-[#86868b] leading-relaxed">{b.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* Earnings calculator */}
      <section className="py-24 md:py-32 px-6 bg-[#1d1d1f] text-white">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-[#818cf8] uppercase tracking-wider mb-3">{isFr ? 'Combien pouvez-vous gagner' : 'How much can you earn'}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Calculez vos gains.' : 'Calculate your earnings.'}
              </h2>
              <p className="text-lg text-white/50 mt-4">
                {isFr ? 'Commission de 30% sur chaque plan, chaque mois.' : '30% commission on every plan, every month.'}
              </p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {earnings.map((e, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className={`rounded-2xl p-8 text-center ${i === 1 ? 'bg-[#6366f1] ring-2 ring-[#6366f1]' : 'bg-white/5 border border-white/10'}`}>
                  <h3 className="text-xl font-semibold mb-2">{e.plan}</h3>
                  <p className={`text-sm mb-6 ${i === 1 ? 'text-white/60' : 'text-white/40'}`}>{e.price}</p>
                  <p className="text-4xl font-semibold tracking-tight mb-1">{e.commission}</p>
                  <p className={`text-sm ${i === 1 ? 'text-white/60' : 'text-white/40'}`}>{isFr ? 'par mois par client' : 'per month per client'}</p>
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-2xl font-semibold text-[#818cf8]">{e.yearly}</p>
                    <p className={`text-xs ${i === 1 ? 'text-white/50' : 'text-white/30'}`}>{isFr ? 'par an par client' : 'per year per client'}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={400}>
            <div className="mt-12 text-center">
              <p className="text-white/50 text-sm">
                {isFr
                  ? '10 clients Pro = $3,890/mois en commissions recurrentes'
                  : '10 Pro clients = $3,890/month in recurring commissions'}
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Ideal for */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{isFr ? 'Pour qui' : 'Ideal for'}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Fait pour vous.' : 'Made for you.'}
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {idealFor.map((item, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="rounded-2xl border border-[#e5e5ea] p-6 hover:border-[#6366f1]/30 hover:shadow-lg transition-all duration-300 group text-center h-full">
                  <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center mb-4 mx-auto group-hover:bg-[#6366f1]/15 transition-colors">
                    <item.icon size={28} className="text-[#6366f1]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-[#86868b] leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 px-6 bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white">
        <div className="max-w-[800px] mx-auto text-center">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
              {isFr ? 'Pret a gagner avec Qwillio ?' : 'Ready to earn with Qwillio?'}
            </h2>
            <p className="text-lg text-white/70 mb-10 max-w-md mx-auto">
              {isFr ? 'Rejoignez notre programme affilie et commencez a generer des revenus recurrents des aujourd\'hui.' : 'Join our affiliate program and start generating recurring revenue today.'}
            </p>
            <Link
              to="/register?affiliate=true"
              className="inline-flex items-center gap-2 bg-white text-[#6366f1] text-base font-medium px-8 py-3.5 rounded-full hover:bg-white/90 transition-colors"
            >
              {isFr ? 'Devenir affilie' : 'Become an affiliate'} <ArrowRight size={18} />
            </Link>
            <p className="mt-4 text-sm text-white/40">{isFr ? 'Gratuit. Aucun engagement.' : 'Free. No commitment.'}</p>
          </FadeIn>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
