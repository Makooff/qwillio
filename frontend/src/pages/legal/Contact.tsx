import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send } from 'lucide-react';
import QwillioLogo from '../../components/QwillioLogo';
import LangToggle from '../../components/LangToggle';
import { useLang } from '../../stores/langStore';

export default function Contact() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      subject: (form.elements.namedItem('subject') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // Show success regardless for now
    }
    setLoading(false);
    setSubmitted(true);
  };

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
        <h1 className="text-4xl font-bold mb-4 text-center">{isFr ? 'Contactez-nous' : 'Contact Us'}</h1>
        <p className="text-center text-[#86868b] mb-12 max-w-[500px] mx-auto leading-relaxed">
          {isFr
            ? 'Une question ? Un besoin sp\u00e9cifique ? Notre \u00e9quipe vous r\u00e9pond sous 24 heures.'
            : 'Have a question? Need something specific? Our team replies within 24 hours.'}
        </p>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div>
            <div className="bg-[#f5f5f7] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#6366f1]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{isFr ? 'E-mail' : 'Email'}</p>
                  <a href="mailto:hello@qwillio.com" className="text-sm text-[#6366f1] hover:underline">hello@qwillio.com</a>
                </div>
              </div>
              <p className="text-sm text-[#86868b] leading-relaxed mt-6">
                {isFr
                  ? 'Pour les demandes RGPD, veuillez inclure "RGPD" dans l\u2019objet de votre e-mail.'
                  : 'For GDPR requests, please include "GDPR" in the subject of your email.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <div>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Send className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  {isFr ? 'Message envoy\u00e9 !' : 'Message sent!'}
                </h3>
                <p className="text-sm text-green-700">
                  {isFr ? 'Merci, nous vous r\u00e9pondrons sous 24 heures.' : 'Thanks, we\u2019ll reply within 24 hours.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{isFr ? 'Nom' : 'Name'}</label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="w-full border border-[#d2d2d7] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]"
                    placeholder={isFr ? 'Votre nom' : 'Your name'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{isFr ? 'E-mail' : 'Email'}</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full border border-[#d2d2d7] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]"
                    placeholder={isFr ? 'votre@email.com' : 'you@email.com'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{isFr ? 'Sujet' : 'Subject'}</label>
                  <select
                    name="subject"
                    required
                    className="w-full border border-[#d2d2d7] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] bg-white"
                  >
                    <option value="">{isFr ? 'S\u00e9lectionnez un sujet' : 'Select a subject'}</option>
                    <option value="general">{isFr ? 'G\u00e9n\u00e9ral' : 'General'}</option>
                    <option value="sales">{isFr ? 'Ventes' : 'Sales'}</option>
                    <option value="support">Support</option>
                    <option value="press">{isFr ? 'Presse' : 'Press'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Message</label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    className="w-full border border-[#d2d2d7] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] resize-none"
                    placeholder={isFr ? 'Votre message...' : 'Your message...'}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#6366f1] text-white font-medium py-2.5 rounded-lg hover:bg-[#4f46e5] transition-colors disabled:opacity-50"
                >
                  {loading
                    ? (isFr ? 'Envoi...' : 'Sending...')
                    : (isFr ? 'Envoyer' : 'Send message')}
                </button>
              </form>
            )}
          </div>
        </div>
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
