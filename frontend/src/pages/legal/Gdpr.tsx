import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import QwillioLogo from '../../components/QwillioLogo';
import LangToggle from '../../components/LangToggle';
import { useLang } from '../../stores/langStore';

export default function Gdpr() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const rights = [
    {
      title: isFr ? 'Droit d\u2019acc\u00e8s (Art. 15)' : 'Right of Access (Art. 15)',
      desc: isFr
        ? 'Vous pouvez demander une copie de toutes les donn\u00e9es personnelles que nous d\u00e9tenons \u00e0 votre sujet, y compris les enregistrements d\u2019appels, les transcriptions et les donn\u00e9es de compte.'
        : 'You can request a copy of all personal data we hold about you, including call recordings, transcripts, and account data.',
    },
    {
      title: isFr ? 'Droit de rectification (Art. 16)' : 'Right to Rectification (Art. 16)',
      desc: isFr
        ? 'Si vos donn\u00e9es sont inexactes ou incompl\u00e8tes, vous pouvez demander leur correction.'
        : 'If your data is inaccurate or incomplete, you can request correction.',
    },
    {
      title: isFr ? 'Droit \u00e0 l\u2019effacement (Art. 17)' : 'Right to Erasure (Art. 17)',
      desc: isFr
        ? 'Vous pouvez demander la suppression de vos donn\u00e9es personnelles. Nous les supprimerons sauf obligation l\u00e9gale de conservation.'
        : 'You can request deletion of your personal data. We will delete it unless we are legally required to retain it.',
    },
    {
      title: isFr ? 'Droit \u00e0 la limitation du traitement (Art. 18)' : 'Right to Restriction (Art. 18)',
      desc: isFr
        ? 'Vous pouvez demander que nous limitions le traitement de vos donn\u00e9es dans certaines circonstances.'
        : 'You can request that we restrict the processing of your data in certain circumstances.',
    },
    {
      title: isFr ? 'Droit \u00e0 la portabilit\u00e9 (Art. 20)' : 'Right to Portability (Art. 20)',
      desc: isFr
        ? 'Vous pouvez recevoir vos donn\u00e9es dans un format structur\u00e9, couramment utilis\u00e9 et lisible par machine (JSON/CSV).'
        : 'You can receive your data in a structured, commonly used, machine-readable format (JSON/CSV).',
    },
    {
      title: isFr ? 'Droit d\u2019opposition (Art. 21)' : 'Right to Object (Art. 21)',
      desc: isFr
        ? 'Vous pouvez vous opposer au traitement de vos donn\u00e9es fond\u00e9 sur notre int\u00e9r\u00eat l\u00e9gitime, y compris le profilage.'
        : 'You can object to processing of your data based on our legitimate interest, including profiling.',
    },
    {
      title: isFr ? 'Droits li\u00e9s \u00e0 la d\u00e9cision automatis\u00e9e (Art. 22)' : 'Automated Decision-Making Rights (Art. 22)',
      desc: isFr
        ? 'Vous avez le droit de ne pas faire l\u2019objet d\u2019une d\u00e9cision fond\u00e9e exclusivement sur un traitement automatis\u00e9 qui produit des effets juridiques.'
        : 'You have the right not to be subject to a decision based solely on automated processing that produces legal effects.',
    },
  ];

  const dataCategories = [
    {
      category: isFr ? 'Donn\u00e9es de compte' : 'Account data',
      examples: isFr ? 'Nom, e-mail, t\u00e9l\u00e9phone' : 'Name, email, phone',
      retention: isFr ? 'Dur\u00e9e de l\u2019abonnement + 30 jours' : 'Subscription duration + 30 days',
    },
    {
      category: isFr ? 'Enregistrements d\u2019appels' : 'Call recordings',
      examples: isFr ? 'Audio des appels trait\u00e9s' : 'Audio of processed calls',
      retention: isFr ? '90 jours' : '90 days',
    },
    {
      category: isFr ? 'Transcriptions' : 'Transcripts',
      examples: isFr ? 'Texte des conversations' : 'Conversation text',
      retention: isFr ? '90 jours' : '90 days',
    },
    {
      category: isFr ? 'Donn\u00e9es de paiement' : 'Payment data',
      examples: isFr ? 'Identifiants Stripe (pas de num\u00e9ros de carte)' : 'Stripe identifiers (no card numbers)',
      retention: isFr ? '7 ans (obligation l\u00e9gale)' : '7 years (legal requirement)',
    },
    {
      category: isFr ? 'Donn\u00e9es techniques' : 'Technical data',
      examples: isFr ? 'Adresse IP, empreinte d\u2019appareil' : 'IP address, device fingerprint',
      retention: isFr ? '90 jours (IP), ind\u00e9fini hach\u00e9 (fraude)' : '90 days (IP), indefinite hashed (fraud)',
    },
  ];

  const legalBases = [
    {
      activity: isFr ? 'Fourniture du service' : 'Service delivery',
      basis: isFr ? 'Ex\u00e9cution du contrat (Art. 6(1)(b))' : 'Contract performance (Art. 6(1)(b))',
    },
    {
      activity: isFr ? 'Facturation et paiements' : 'Billing & payments',
      basis: isFr ? 'Ex\u00e9cution du contrat (Art. 6(1)(b))' : 'Contract performance (Art. 6(1)(b))',
    },
    {
      activity: isFr ? 'D\u00e9tection de fraude' : 'Fraud detection',
      basis: isFr ? 'Int\u00e9r\u00eat l\u00e9gitime (Art. 6(1)(f))' : 'Legitimate interest (Art. 6(1)(f))',
    },
    {
      activity: isFr ? 'E-mails transactionnels' : 'Transactional emails',
      basis: isFr ? 'Ex\u00e9cution du contrat (Art. 6(1)(b))' : 'Contract performance (Art. 6(1)(b))',
    },
    {
      activity: isFr ? 'Conservation l\u00e9gale (factures)' : 'Legal retention (invoices)',
      basis: isFr ? 'Obligation l\u00e9gale (Art. 6(1)(c))' : 'Legal obligation (Art. 6(1)(c))',
    },
    {
      activity: isFr ? 'Am\u00e9lioration du service' : 'Service improvement',
      basis: isFr ? 'Int\u00e9r\u00eat l\u00e9gitime (Art. 6(1)(f))' : 'Legitimate interest (Art. 6(1)(f))',
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

      {/* Content */}
      <main className="max-w-[900px] mx-auto px-6 py-24 pt-32">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#6366f1]" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">{isFr ? 'Vos droits RGPD' : 'Your GDPR Rights'}</h1>
          </div>
        </div>
        <p className="text-[#86868b] mb-10 leading-relaxed">
          {isFr
            ? 'Le R\u00e8glement G\u00e9n\u00e9ral sur la Protection des Donn\u00e9es (RGPD) vous donne un contr\u00f4le total sur vos donn\u00e9es personnelles. Voici vos droits expliqu\u00e9s simplement.'
            : 'The General Data Protection Regulation (GDPR) gives you full control over your personal data. Here are your rights explained in plain language.'}
        </p>

        {/* 7 Rights */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">{isFr ? 'Vos 7 droits' : 'Your 7 Rights'}</h2>
          <div className="space-y-4">
            {rights.map((right, i) => (
              <div key={i} className="bg-[#f5f5f7] rounded-xl p-5">
                <h3 className="font-semibold mb-1">{right.title}</h3>
                <p className="text-sm text-[#86868b] leading-relaxed">{right.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How to Exercise */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? 'Comment exercer vos droits' : 'How to Exercise Your Rights'}</h2>
          <div className="bg-[#6366f1]/5 border border-[#6366f1]/20 rounded-xl p-6">
            <p className="leading-relaxed mb-3">
              {isFr
                ? 'Envoyez un e-mail \u00e0 '
                : 'Send an email to '}
              <a href="mailto:hello@qwillio.com" className="text-[#6366f1] hover:underline font-medium">hello@qwillio.com</a>
              {isFr ? ' avec l\u2019objet :' : ' with the subject:'}
            </p>
            <div className="bg-white rounded-lg px-4 py-3 font-mono text-sm border border-[#d2d2d7]/60">
              {isFr ? 'RGPD \u2014 [Votre droit]' : 'GDPR Request \u2014 [Right]'}
            </div>
            <p className="text-sm text-[#86868b] mt-3">
              {isFr
                ? 'Exemple : "RGPD \u2014 Droit d\u2019acc\u00e8s" ou "RGPD \u2014 Droit \u00e0 l\u2019effacement"'
                : 'Example: "GDPR Request \u2014 Right of Access" or "GDPR Request \u2014 Right to Erasure"'}
            </p>
          </div>
        </section>

        {/* Response Time */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? 'D\u00e9lai de r\u00e9ponse' : 'Response Time'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Nous r\u00e9pondrons \u00e0 votre demande dans un d\u00e9lai de 30 jours calendaires. Si la demande est complexe, ce d\u00e9lai peut \u00eatre prolong\u00e9 de 60 jours suppl\u00e9mentaires, auquel cas nous vous en informerons dans le d\u00e9lai initial de 30 jours.'
              : 'We will respond to your request within 30 calendar days. If the request is complex, this period may be extended by an additional 60 days, in which case we will inform you within the initial 30-day period.'}
          </p>
        </section>

        {/* Data Categories */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? 'Cat\u00e9gories de donn\u00e9es et conservation' : 'Data Categories & Retention'}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[#d2d2d7]/60 rounded-lg">
              <thead className="bg-[#f5f5f7]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Cat\u00e9gorie' : 'Category'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Exemples' : 'Examples'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Conservation' : 'Retention'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]/60">
                {dataCategories.map((cat, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium">{cat.category}</td>
                    <td className="px-4 py-3 text-[#86868b]">{cat.examples}</td>
                    <td className="px-4 py-3">{cat.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cookies */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Cookies</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Qwillio utilise uniquement des cookies essentiels n\u00e9cessaires au fonctionnement du service. Nous n\u2019utilisons aucun cookie de suivi, d\u2019analyse ou publicitaire. Aucun bandeau de cookies n\u2019est n\u00e9cessaire car nous ne collectons que des cookies strictement n\u00e9cessaires.'
              : 'Qwillio uses only essential cookies necessary for the service to function. We do not use any tracking, analytics, or advertising cookies. No cookie banner is needed because we only use strictly necessary cookies.'}
          </p>
        </section>

        {/* Legal Basis */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? 'Base l\u00e9gale par activit\u00e9' : 'Legal Basis per Activity'}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[#d2d2d7]/60 rounded-lg">
              <thead className="bg-[#f5f5f7]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Activit\u00e9' : 'Activity'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Base l\u00e9gale' : 'Legal Basis'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]/60">
                {legalBases.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">{item.activity}</td>
                    <td className="px-4 py-3">{item.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Link to Privacy */}
        <section className="mb-10">
          <p className="leading-relaxed">
            {isFr ? 'Pour plus de d\u00e9tails, consultez notre ' : 'For more details, see our '}
            <Link to="/privacy" className="text-[#6366f1] hover:underline font-medium">
              {isFr ? 'politique de confidentialit\u00e9 compl\u00e8te' : 'full privacy policy'}
            </Link>.
          </p>
        </section>
      </main>

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
