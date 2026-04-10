import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QwillioLogo from '../../components/QwillioLogo';
import LangToggle from '../../components/LangToggle';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';

export default function Privacy() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);

  useSEO({
    title: 'Privacy Policy',
    description: 'Qwillio privacy policy — how we collect, use, and protect your data in compliance with GDPR and CCPA.',
    canonical: 'https://qwillio.com/privacy',
    noindex: true,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
        <h1 className="text-4xl font-bold mb-2">{isFr ? 'Politique de confidentialit\u00e9' : 'Privacy Policy'}</h1>
        <p className="text-sm text-[#86868b] mb-10">{isFr ? 'Derni\u00e8re mise \u00e0 jour : mars 2026' : 'Last updated: March 2026'}</p>

        {/* Introduction */}
        <section className="mb-10">
          <p className="leading-relaxed">
            {isFr
              ? 'Qwillio LLC (\u00ab Qwillio \u00bb, \u00ab nous \u00bb) s\u2019engage \u00e0 prot\u00e9ger votre vie priv\u00e9e. Cette politique explique comment nous collectons, utilisons et prot\u00e9geons vos donn\u00e9es personnelles conform\u00e9ment au RGPD (UE) et au CCPA (Californie).'
              : 'Qwillio LLC ("Qwillio", "we", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal data in compliance with the GDPR (EU) and CCPA (California).'}
          </p>
          <p className="mt-3 leading-relaxed">
            {isFr ? 'Contact : ' : 'Contact: '}
            <a href="mailto:hello@qwillio.com" className="text-[#6366f1] hover:underline">hello@qwillio.com</a>
          </p>
        </section>

        {/* Data Collected */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '1. Donn\u00e9es collect\u00e9es' : '1. Data We Collect'}</h2>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li>{isFr ? 'Identit\u00e9 : nom, adresse e-mail, num\u00e9ro de t\u00e9l\u00e9phone' : 'Identity: name, email address, phone number'}</li>
            <li>{isFr ? 'Paiement : informations de carte (trait\u00e9es par Stripe, jamais stock\u00e9es chez nous)' : 'Payment: card information (processed by Stripe, never stored by us)'}</li>
            <li>{isFr ? 'Enregistrements d\u2019appels et transcriptions' : 'Call recordings and transcripts'}</li>
            <li>{isFr ? 'Donn\u00e9es techniques : empreinte d\u2019appareil, adresse IP, type de navigateur' : 'Technical data: device fingerprint, IP address, browser type'}</li>
            <li>{isFr ? 'Donn\u00e9es d\u2019utilisation : journaux d\u2019interaction, pr\u00e9f\u00e9rences' : 'Usage data: interaction logs, preferences'}</li>
          </ul>
        </section>

        {/* How We Use Data */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '2. Comment nous utilisons vos donn\u00e9es' : '2. How We Use Your Data'}</h2>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li>{isFr ? 'Fournir et am\u00e9liorer nos services d\u2019agent vocal IA' : 'Provide and improve our AI voice agent services'}</li>
            <li>{isFr ? 'Traiter les paiements et g\u00e9rer les abonnements' : 'Process payments and manage subscriptions'}</li>
            <li>{isFr ? 'Communiquer avec vous (e-mails transactionnels et support)' : 'Communicate with you (transactional emails and support)'}</li>
            <li>{isFr ? 'D\u00e9tecter et pr\u00e9venir la fraude' : 'Detect and prevent fraud'}</li>
            <li>{isFr ? 'Respecter nos obligations l\u00e9gales' : 'Comply with legal obligations'}</li>
          </ul>
        </section>

        {/* Sub-processors */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '3. Sous-traitants' : '3. Sub-processors'}</h2>
          <p className="mb-4 leading-relaxed">
            {isFr
              ? 'Nous partageons des donn\u00e9es avec les sous-traitants suivants, chacun li\u00e9 par des clauses contractuelles de protection des donn\u00e9es :'
              : 'We share data with the following sub-processors, each bound by data protection agreements:'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[#d2d2d7]/60 rounded-lg">
              <thead className="bg-[#f5f5f7]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Sous-traitant' : 'Sub-processor'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Fonction' : 'Purpose'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Localisation' : 'Location'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]/60">
                <tr><td className="px-4 py-3">Vapi</td><td className="px-4 py-3">{isFr ? 'Orchestration vocale IA' : 'AI voice orchestration'}</td><td className="px-4 py-3">USA</td></tr>
                <tr><td className="px-4 py-3">Twilio</td><td className="px-4 py-3">{isFr ? 'T\u00e9l\u00e9phonie / SMS' : 'Telephony / SMS'}</td><td className="px-4 py-3">USA</td></tr>
                <tr><td className="px-4 py-3">ElevenLabs</td><td className="px-4 py-3">{isFr ? 'Synth\u00e8se vocale' : 'Voice synthesis'}</td><td className="px-4 py-3">USA / EU</td></tr>
                <tr><td className="px-4 py-3">OpenAI</td><td className="px-4 py-3">{isFr ? 'Mod\u00e8les de langage' : 'Language models'}</td><td className="px-4 py-3">USA</td></tr>
                <tr><td className="px-4 py-3">Stripe</td><td className="px-4 py-3">{isFr ? 'Paiements' : 'Payments'}</td><td className="px-4 py-3">USA / EU</td></tr>
                <tr><td className="px-4 py-3">Resend</td><td className="px-4 py-3">{isFr ? 'E-mails transactionnels' : 'Transactional emails'}</td><td className="px-4 py-3">USA</td></tr>
                <tr><td className="px-4 py-3">Neon</td><td className="px-4 py-3">{isFr ? 'Base de donn\u00e9es' : 'Database'}</td><td className="px-4 py-3">USA / EU</td></tr>
                <tr><td className="px-4 py-3">Vercel</td><td className="px-4 py-3">{isFr ? 'H\u00e9bergement frontend' : 'Frontend hosting'}</td><td className="px-4 py-3">USA / EU</td></tr>
                <tr><td className="px-4 py-3">Render</td><td className="px-4 py-3">{isFr ? 'H\u00e9bergement backend' : 'Backend hosting'}</td><td className="px-4 py-3">USA</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Data Retention */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '4. Conservation des donn\u00e9es' : '4. Data Retention'}</h2>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li>{isFr ? 'Enregistrements d\u2019appels et transcriptions : 90 jours apr\u00e8s la cr\u00e9ation' : 'Call recordings and transcripts: 90 days after creation'}</li>
            <li>{isFr ? 'Donn\u00e9es de compte : dur\u00e9e de l\u2019abonnement + 30 jours apr\u00e8s r\u00e9siliation' : 'Account data: subscription duration + 30 days after cancellation'}</li>
            <li>{isFr ? 'Signaux de fraude : conserv\u00e9s ind\u00e9finiment sous forme hach\u00e9e' : 'Fraud signals: retained indefinitely in hashed form'}</li>
            <li>{isFr ? 'Journaux de facturation : 7 ans (obligation l\u00e9gale)' : 'Billing logs: 7 years (legal requirement)'}</li>
          </ul>
        </section>

        {/* International Transfers */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '5. Transferts internationaux' : '5. International Transfers'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Les donn\u00e9es personnelles de l\u2019UE/EEE transf\u00e9r\u00e9es vers les \u00c9tats-Unis sont prot\u00e9g\u00e9es par les Clauses Contractuelles Types (CCT) approuv\u00e9es par la Commission europ\u00e9enne. Nous mettons \u00e9galement en \u0153uvre des mesures techniques suppl\u00e9mentaires, y compris le chiffrement au repos et en transit.'
              : 'Personal data from the EU/EEA transferred to the United States is protected by Standard Contractual Clauses (SCCs) approved by the European Commission. We also implement supplementary technical measures, including encryption at rest and in transit.'}
          </p>
        </section>

        {/* Cold Calling Disclosure */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '6. D\u00e9marchage t\u00e9l\u00e9phonique' : '6. Outbound Calling Disclosure'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Qwillio peut effectuer des appels sortants vers des lignes fixes professionnelles pour le compte de nos clients, en conformit\u00e9 avec le TCPA (Telephone Consumer Protection Act). Nous ne contactons jamais de num\u00e9ros de t\u00e9l\u00e9phone mobiles ou personnels sans consentement pr\u00e9alable exprim\u00e9 par \u00e9crit. Tous les appels sortants respectent les listes DNC (Do Not Call) f\u00e9d\u00e9rales et des \u00c9tats.'
              : 'Qwillio may place outbound calls to business landlines on behalf of our clients in compliance with the TCPA (Telephone Consumer Protection Act). We never contact mobile or personal phone numbers without prior express written consent. All outbound calls comply with federal and state Do Not Call (DNC) lists.'}
          </p>
        </section>

        {/* Your Rights */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '7. Vos droits' : '7. Your Rights'}</h2>
          <p className="mb-4 leading-relaxed">
            {isFr
              ? 'Selon votre juridiction, vous disposez des droits suivants :'
              : 'Depending on your jurisdiction, you have the following rights:'}
          </p>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li><strong>{isFr ? 'Acc\u00e8s' : 'Access'}</strong> \u2014 {isFr ? 'Obtenir une copie de vos donn\u00e9es personnelles' : 'Obtain a copy of your personal data'}</li>
            <li><strong>{isFr ? 'Rectification' : 'Rectification'}</strong> \u2014 {isFr ? 'Corriger des donn\u00e9es inexactes' : 'Correct inaccurate data'}</li>
            <li><strong>{isFr ? 'Effacement' : 'Erasure'}</strong> \u2014 {isFr ? 'Demander la suppression de vos donn\u00e9es' : 'Request deletion of your data'}</li>
            <li><strong>{isFr ? 'Portabilit\u00e9' : 'Portability'}</strong> \u2014 {isFr ? 'Recevoir vos donn\u00e9es dans un format structur\u00e9' : 'Receive your data in a structured format'}</li>
            <li><strong>{isFr ? 'Opposition' : 'Objection'}</strong> \u2014 {isFr ? 'Vous opposer \u00e0 certains traitements' : 'Object to certain processing activities'}</li>
            <li><strong>{isFr ? 'Refus de vente (CCPA)' : 'Opt-out of sale (CCPA)'}</strong> \u2014 {isFr ? 'Nous ne vendons pas vos donn\u00e9es. Si cela devait changer, vous pourrez vous d\u00e9sinscrire.' : 'We do not sell your data. If this changes, you can opt out.'}</li>
          </ul>
          <p className="mt-4 leading-relaxed">
            {isFr
              ? 'Pour exercer vos droits, contactez-nous \u00e0 '
              : 'To exercise your rights, contact us at '}
            <a href="mailto:hello@qwillio.com" className="text-[#6366f1] hover:underline">hello@qwillio.com</a>.
            {' '}{isFr ? 'Voir aussi notre page ' : 'See also our '}
            <Link to="/gdpr" className="text-[#6366f1] hover:underline">{isFr ? 'Droits RGPD' : 'GDPR Rights'}</Link>.
          </p>
        </section>

        {/* Cookies */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '8. Cookies' : '8. Cookies'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Nous utilisons uniquement des cookies essentiels n\u00e9cessaires au fonctionnement du service (session, pr\u00e9f\u00e9rence de langue). Nous n\u2019utilisons pas de cookies de suivi ni d\u2019analyse tiers.'
              : 'We use only essential cookies necessary for the service to function (session, language preference). We do not use tracking cookies or third-party analytics.'}
          </p>
        </section>

        {/* Changes */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '9. Modifications' : '9. Changes to This Policy'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Nous pouvons mettre \u00e0 jour cette politique p\u00e9riodiquement. En cas de changement significatif, nous vous en informerons par e-mail au moins 30 jours avant l\u2019entr\u00e9e en vigueur.'
              : 'We may update this policy periodically. For material changes, we will notify you by email at least 30 days before the changes take effect.'}
          </p>
        </section>

        {/* Contact */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '10. Contact' : '10. Contact'}</h2>
          <p className="leading-relaxed">
            {isFr ? 'Qwillio LLC' : 'Qwillio LLC'}<br />
            {isFr ? 'E-mail : ' : 'Email: '}
            <a href="mailto:hello@qwillio.com" className="text-[#6366f1] hover:underline">hello@qwillio.com</a>
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
