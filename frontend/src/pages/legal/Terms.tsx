import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QwillioLogo from '../../components/QwillioLogo';
import LangToggle from '../../components/LangToggle';
import { useLang } from '../../stores/langStore';

export default function Terms() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);

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
        <h1 className="text-4xl font-bold mb-2">{isFr ? 'Conditions g\u00e9n\u00e9rales d\u2019utilisation' : 'Terms of Service'}</h1>
        <p className="text-sm text-[#86868b] mb-6">{isFr ? 'Derni\u00e8re mise \u00e0 jour : mars 2026' : 'Last updated: March 2026'}</p>

        {/* Acceptance */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '1. Acceptation' : '1. Acceptance'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'En acc\u00e9dant ou en utilisant les services de Qwillio LLC (\u00ab Qwillio \u00bb), vous acceptez d\u2019\u00eatre li\u00e9 par les pr\u00e9sentes conditions. Si vous n\u2019\u00eates pas d\u2019accord, veuillez ne pas utiliser nos services.'
              : 'By accessing or using the services of Qwillio LLC ("Qwillio"), you agree to be bound by these terms. If you do not agree, please do not use our services.'}
          </p>
        </section>

        {/* Free Trial */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '2. Essai gratuit' : '2. Free Trial'}</h2>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li>{isFr ? 'Dur\u00e9e : 30 jours' : 'Duration: 30 days'}</li>
            <li>{isFr ? 'Carte de cr\u00e9dit requise pour l\u2019inscription' : 'Credit card required at signup'}</li>
            <li><strong>{isFr ? 'Se renouvelle automatiquement en abonnement payant \u00e0 la fin de la p\u00e9riode d\u2019essai' : 'Automatically renews into a paid subscription at the end of the trial period'}</strong></li>
            <li>{isFr ? 'Limit\u00e9 \u00e0 un essai par personne physique et par entreprise' : 'Limited to one trial per natural person and per business'}</li>
            <li>{isFr ? 'Nous nous r\u00e9servons le droit de r\u00e9voquer les essais abusifs et de facturer au tarif standard' : 'We reserve the right to revoke abusive trials and charge at the standard rate'}</li>
          </ul>
        </section>

        {/* Pricing */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '3. Tarification' : '3. Pricing'}</h2>
          <p className="mb-4 leading-relaxed">
            {isFr ? 'Tous les prix sont en USD, factur\u00e9s mensuellement. Aucun frais d\u2019installation.' : 'All prices are in USD, billed monthly. No setup fees.'}
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border border-[#d2d2d7]/60 rounded-lg">
              <thead className="bg-[#f5f5f7]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Forfait' : 'Plan'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Prix mensuel' : 'Monthly Price'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Appels inclus' : 'Included Calls'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'D\u00e9passement' : 'Overage'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]/60">
                <tr><td className="px-4 py-3">Starter</td><td className="px-4 py-3">$497/mo</td><td className="px-4 py-3">800</td><td className="px-4 py-3">$0.22/{isFr ? 'appel' : 'call'}</td></tr>
                <tr><td className="px-4 py-3">Pro</td><td className="px-4 py-3">$1,297/mo</td><td className="px-4 py-3">2,000</td><td className="px-4 py-3">$0.18/{isFr ? 'appel' : 'call'}</td></tr>
                <tr><td className="px-4 py-3">Enterprise</td><td className="px-4 py-3">$2,497/mo</td><td className="px-4 py-3">4,000</td><td className="px-4 py-3">$0.15/{isFr ? 'appel' : 'call'}</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold mb-3">{isFr ? 'Modules compl\u00e9mentaires' : 'Agent Add-ons'}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[#d2d2d7]/60 rounded-lg">
              <thead className="bg-[#f5f5f7]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Module' : 'Add-on'}</th>
                  <th className="text-left px-4 py-3 font-semibold">{isFr ? 'Prix mensuel' : 'Monthly Price'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]/60">
                <tr><td className="px-4 py-3">Email AI</td><td className="px-4 py-3">+$197/mo</td></tr>
                <tr><td className="px-4 py-3">Payments AI</td><td className="px-4 py-3">+$97/mo</td></tr>
                <tr><td className="px-4 py-3">Accounting AI</td><td className="px-4 py-3">+$297/mo</td></tr>
                <tr><td className="px-4 py-3">Inventory AI</td><td className="px-4 py-3">+$197/mo</td></tr>
                <tr><td className="px-4 py-3">Agent Bundle ({isFr ? 'tous les modules' : 'all add-ons'})</td><td className="px-4 py-3">+$597/mo</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Billing */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '4. Facturation' : '4. Billing'}</h2>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li>{isFr ? 'Facturation mensuelle via Stripe' : 'Monthly billing via Stripe'}</li>
            <li>{isFr ? 'En cas d\u2019\u00e9chec de paiement, nous effectuons 3 tentatives de relance' : 'On payment failure, we retry 3 times'}</li>
            <li>{isFr ? 'Apr\u00e8s 3 \u00e9checs, votre compte est suspendu jusqu\u2019\u00e0 r\u00e9gularisation' : 'After 3 failures, your account is suspended until payment is resolved'}</li>
            <li>{isFr ? 'Les d\u00e9passements d\u2019appels sont factur\u00e9s au cycle suivant' : 'Call overages are billed on the next billing cycle'}</li>
          </ul>
        </section>

        {/* Cancellation */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '5. Annulation' : '5. Cancellation'}</h2>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li>{isFr ? 'Vous pouvez annuler \u00e0 tout moment depuis votre tableau de bord' : 'You may cancel at any time from your dashboard'}</li>
            <li>{isFr ? 'L\u2019annulation prend effet \u00e0 la fin de la p\u00e9riode de facturation en cours' : 'Cancellation takes effect at the end of the current billing period'}</li>
            <li>{isFr ? 'Aucun remboursement au prorata n\u2019est effectu\u00e9' : 'No prorated refunds are issued'}</li>
            <li>{isFr ? 'Vos donn\u00e9es sont conserv\u00e9es 30 jours apr\u00e8s r\u00e9siliation, puis supprim\u00e9es' : 'Your data is retained for 30 days after cancellation, then deleted'}</li>
          </ul>
        </section>

        {/* AI Disclosure */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '6. Divulgation IA' : '6. AI Disclosure'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Qwillio utilise l\u2019intelligence artificielle pour traiter les appels, g\u00e9n\u00e9rer des r\u00e9ponses et effectuer des actions au nom de votre entreprise. Les appelants sont inform\u00e9s qu\u2019ils interagissent avec un assistant IA. Bien que nous nous efforcions d\u2019assurer l\u2019exactitude, les r\u00e9ponses g\u00e9n\u00e9r\u00e9es par l\u2019IA peuvent contenir des erreurs. Vous \u00eates responsable de la supervision des actions de l\u2019agent.'
              : 'Qwillio uses artificial intelligence to process calls, generate responses, and perform actions on behalf of your business. Callers are informed that they are interacting with an AI assistant. While we strive for accuracy, AI-generated responses may contain errors. You are responsible for overseeing the agent\u2019s actions.'}
          </p>
        </section>

        {/* Acceptable Use */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '7. Utilisation acceptable' : '7. Acceptable Use'}</h2>
          <p className="mb-3 leading-relaxed">{isFr ? 'Vous vous engagez \u00e0 ne pas :' : 'You agree not to:'}</p>
          <ul className="list-disc pl-6 space-y-2 leading-relaxed">
            <li>{isFr ? 'Utiliser le service \u00e0 des fins ill\u00e9gales ou frauduleuses' : 'Use the service for illegal or fraudulent purposes'}</li>
            <li>{isFr ? 'Abuser du syst\u00e8me d\u2019essai gratuit (comptes multiples, identit\u00e9s fictives)' : 'Abuse the free trial system (multiple accounts, fictitious identities)'}</li>
            <li>{isFr ? 'Tenter de contourner les limites d\u2019appels ou les mesures de s\u00e9curit\u00e9' : 'Attempt to bypass call limits or security measures'}</li>
            <li>{isFr ? 'Revendre ou redistribuer le service sans autorisation' : 'Resell or redistribute the service without authorization'}</li>
          </ul>
        </section>

        {/* Liability */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '8. Limitation de responsabilit\u00e9' : '8. Limitation of Liability'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Dans toute la mesure permise par la loi, la responsabilit\u00e9 totale de Qwillio est limit\u00e9e au montant des frais que vous avez pay\u00e9s au cours des 6 derniers mois pr\u00e9c\u00e9dant la r\u00e9clamation. Qwillio ne sera en aucun cas responsable de dommages indirects, accessoires, sp\u00e9ciaux ou cons\u00e9cutifs.'
              : 'To the maximum extent permitted by law, Qwillio\u2019s total liability is limited to the amount of fees you paid during the 6 months preceding the claim. Qwillio shall not be liable for any indirect, incidental, special, or consequential damages.'}
          </p>
        </section>

        {/* Governing Law */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '9. Droit applicable' : '9. Governing Law'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Pour les clients am\u00e9ricains : ces conditions sont r\u00e9gies par les lois de l\u2019\u00c9tat du Delaware, \u00c9tats-Unis. Pour les clients de l\u2019UE : ces conditions sont r\u00e9gies par le droit belge, et tout litige sera soumis aux tribunaux de Bruxelles.'
              : 'For US customers: these terms are governed by the laws of the State of Delaware, United States. For EU customers: these terms are governed by Belgian law, and any disputes shall be submitted to the courts of Brussels.'}
          </p>
        </section>

        {/* Changes */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '10. Modifications' : '10. Changes'}</h2>
          <p className="leading-relaxed">
            {isFr
              ? 'Nous pouvons modifier ces conditions avec un pr\u00e9avis de 30 jours par e-mail. Votre utilisation continue apr\u00e8s notification vaut acceptation des nouvelles conditions.'
              : 'We may modify these terms with 30 days\u2019 notice by email. Your continued use after notification constitutes acceptance of the updated terms.'}
          </p>
        </section>

        {/* Contact */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">{isFr ? '11. Contact' : '11. Contact'}</h2>
          <p className="leading-relaxed">
            Qwillio LLC<br />
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
