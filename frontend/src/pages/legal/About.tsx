import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, BrainCircuit, Calendar, Stethoscope, Wrench, Scale, Scissors, UtensilsCrossed, Building2, ArrowRight } from 'lucide-react';
import QwillioLogo from '../../components/QwillioLogo';
import LangToggle from '../../components/LangToggle';
import { useLang } from '../../stores/langStore';

export default function About() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const steps = [
    {
      icon: Phone,
      title: isFr ? 'Un client appelle' : 'A customer calls',
      desc: isFr
        ? 'Qwillio r\u00e9pond instantan\u00e9ment, 24h/24, 7j/7, dans la langue de votre client.'
        : 'Qwillio answers instantly, 24/7, in your customer\u2019s language.',
    },
    {
      icon: BrainCircuit,
      title: isFr ? 'L\u2019IA comprend et agit' : 'AI understands & acts',
      desc: isFr
        ? 'Elle r\u00e9pond aux questions, prend des rendez-vous, envoie des devis et traite les paiements.'
        : 'It answers questions, books appointments, sends quotes, and processes payments.',
    },
    {
      icon: Calendar,
      title: isFr ? 'Vous restez inform\u00e9' : 'You stay informed',
      desc: isFr
        ? 'Recevez un r\u00e9sum\u00e9 de chaque appel, les rendez-vous dans votre calendrier et les transcriptions compl\u00e8tes.'
        : 'Get a summary of every call, appointments in your calendar, and full transcripts.',
    },
  ];

  const niches = [
    { icon: Stethoscope, label: isFr ? 'Cliniques m\u00e9dicales' : 'Medical clinics' },
    { icon: Scale, label: isFr ? 'Cabinets d\u2019avocats' : 'Law firms' },
    { icon: Wrench, label: isFr ? 'Plombiers & \u00e9lectriciens' : 'Plumbers & electricians' },
    { icon: Scissors, label: isFr ? 'Salons de coiffure' : 'Hair salons' },
    { icon: UtensilsCrossed, label: isFr ? 'Restaurants' : 'Restaurants' },
    { icon: Building2, label: isFr ? 'Agences immobili\u00e8res' : 'Real estate agencies' },
  ];

  const advantages = [
    {
      title: isFr ? '3x moins cher' : '3x cheaper',
      desc: isFr ? 'Que Smith.ai et les services de r\u00e9ception traditionnels. Tarif mensuel fixe, pas de frais cach\u00e9s.' : 'Than Smith.ai and traditional receptionist services. Flat monthly rate, no hidden fees.',
    },
    {
      title: isFr ? 'Op\u00e9rationnel en 48h' : 'Live in 48 hours',
      desc: isFr ? 'Pas de mois d\u2019int\u00e9gration. Nous configurons votre agent en 2 jours, cl\u00e9 en main.' : 'No months of integration. We set up your agent in 2 days, turnkey.',
    },
    {
      title: isFr ? 'Auto-apprenant et bilingue' : 'Self-learning & bilingual',
      desc: isFr ? 'L\u2019agent s\u2019am\u00e9liore avec chaque appel et parle fran\u00e7ais et anglais nativement.' : 'The agent improves with every call and speaks English and French natively.',
    },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-white'}`}>
        <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#1d1d1f]">
            <QwillioLogo size={30} /> Qwillio
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors">Login</Link>
            <Link to="/register" className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#4f46e5] transition-colors">
              {isFr ? 'Commencer' : 'Get started'}
            </Link>
            <LangToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-[900px] mx-auto px-6 pt-32 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          {isFr
            ? 'L\u2019IA qui g\u00e8re votre entreprise pendant que vous vous concentrez sur votre m\u00e9tier'
            : 'The AI that runs your business while you focus on your craft'}
        </h1>
        <p className="text-lg text-[#86868b] max-w-[600px] mx-auto leading-relaxed">
          {isFr
            ? 'Qwillio est un r\u00e9ceptionniste vocal IA qui r\u00e9pond \u00e0 vos appels, prend des rendez-vous et convertit les prospects \u2014 24h/24, 7j/7.'
            : 'Qwillio is an AI voice receptionist that answers your calls, books appointments, and converts leads \u2014 24/7.'}
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-[900px] mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">{isFr ? 'Comment \u00e7a marche' : 'How it works'}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-8 h-8 text-[#6366f1]" />
              </div>
              <p className="text-xs font-semibold text-[#6366f1] uppercase tracking-wider mb-2">
                {isFr ? `\u00c9tape ${i + 1}` : `Step ${i + 1}`}
              </p>
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-[#86868b] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Qwillio */}
      <section className="bg-[#f5f5f7] py-16">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">{isFr ? 'Pourquoi Qwillio' : 'Why Qwillio'}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {advantages.map((adv, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-2">{adv.title}</h3>
                <p className="text-sm text-[#86868b] leading-relaxed">{adv.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Niches */}
      <section className="max-w-[900px] mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">{isFr ? 'Secteurs support\u00e9s' : 'Supported Industries'}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {niches.map((niche, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#f5f5f7] rounded-xl p-4">
              <niche.icon className="w-6 h-6 text-[#6366f1] shrink-0" />
              <span className="text-sm font-medium">{niche.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-[#6366f1] text-white py-16">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <p className="text-4xl font-bold mb-4">400+</p>
          <p className="text-lg opacity-90">
            {isFr
              ? 'entreprises qui ne manquent plus jamais un appel'
              : 'businesses that never miss a call'}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[900px] mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">
          {isFr ? 'Pr\u00eat \u00e0 transformer vos appels ?' : 'Ready to transform your calls?'}
        </h2>
        <p className="text-[#86868b] mb-8">
          {isFr ? 'Essai gratuit de 30 jours. Aucun engagement.' : '30-day free trial. No commitment.'}
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-[#6366f1] text-white font-medium px-8 py-3 rounded-full hover:bg-[#4f46e5] transition-colors text-lg"
        >
          {isFr ? 'D\u00e9marrer l\u2019essai gratuit' : 'Start your free trial'}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#d2d2d7]/60 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <QwillioLogo size={24} />
                <p className="text-base font-semibold">Qwillio</p>
              </div>
              <p className="text-sm text-[#86868b] leading-relaxed">{isFr ? 'L\u2019agent vocal IA qui transforme chaque appel en opportunit\u00e9.' : 'The AI voice agent that turns every call into an opportunity.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{isFr ? 'Produit' : 'Product'}</p>
              <div className="space-y-2">
                <Link to="/#features" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Fonctionnalit\u00e9s' : 'Features'}</Link>
                <Link to="/#pricing" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Tarifs' : 'Pricing'}</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{isFr ? 'Entreprise' : 'Company'}</p>
              <div className="space-y-2">
                <Link to="/about" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? '\u00c0 propos' : 'About'}</Link>
                <Link to="/contact" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">Contact</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{isFr ? 'L\u00e9gal' : 'Legal'}</p>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Confidentialit\u00e9' : 'Privacy'}</Link>
                <Link to="/terms" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Conditions' : 'Terms'}</Link>
                <Link to="/gdpr" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'RGPD' : 'GDPR'}</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-[#d2d2d7]/60 pt-6">
            <p className="text-xs text-[#86868b]">&copy; 2026 Qwillio. {isFr ? 'Tous droits r\u00e9serv\u00e9s.' : 'All rights reserved.'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
