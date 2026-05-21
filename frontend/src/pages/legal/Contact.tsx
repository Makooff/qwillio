import { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';

export default function Contact() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useSEO({
    title: isFr ? 'Contact · Qwillio' : 'Contact · Qwillio',
    description: isFr ? 'Une question ? Une démo ? Écrivez-nous.' : 'A question? A demo? Write to us.',
    canonical: 'https://qwillio.com/contact',
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(isFr ? 'Veuillez remplir tous les champs requis.' : 'Please fill all required fields.');
      return;
    }
    setSending(true);
    try {
      // mailto fallback (no backend yet for contact form)
      const subject = encodeURIComponent(`[Contact] ${name}${company ? ' · ' + company : ''}`);
      const body = encodeURIComponent(`${message}\n\n--\n${name}\n${email}${company ? '\n' + company : ''}`);
      window.location.href = `mailto:hello@qwillio.com?subject=${subject}&body=${body}`;
      setSubmitted(true);
    } catch {
      setError(isFr ? 'Une erreur est survenue. Réessayez.' : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  };

  const contactMethods = [
    {
      icon: Mail,
      accent: '#6366f1',
      label: 'Email',
      value: 'hello@qwillio.com',
      href: 'mailto:hello@qwillio.com',
    },
    {
      icon: Phone,
      accent: '#a855f7',
      label: isFr ? 'Téléphone' : 'Phone',
      value: '+32 2 808 80 80',
      href: 'tel:+3228088080',
    },
    {
      icon: MapPin,
      accent: '#6366f1',
      label: isFr ? 'Bureau' : 'Office',
      value: 'Brussels, Belgium',
      href: null,
    },
  ];

  const inputCls =
    'w-full px-4 py-3.5 rounded-2xl border border-[#1d1d1f]/12 bg-white text-[15px] text-[#1d1d1f] placeholder-[#86868b] outline-none transition-colors focus:border-[#6366f1]';

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main id="main">
        {/* ── HERO ──────────────────────────────────────────── */}
        <section
          aria-labelledby="contact-heading"
          className="pt-24 sm:pt-28 md:pt-36 pb-12 md:pb-20 px-5 sm:px-6"
        >
          <div className="max-w-[1240px] mx-auto">
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-4" style={{ color: '#6366f1' }}>
              Contact
            </span>
            <h1
              id="contact-heading"
              className="text-[clamp(2.6rem,6.5vw,5.6rem)] font-semibold tracking-[-0.04em] leading-[0.95] max-w-[1000px]"
            >
              {isFr ? (
                <><span className="font-serif italic" style={{ color: '#6366f1' }}>Parlons.</span> Aux humains, pas aux bots.</>
              ) : (
                <><span className="font-serif italic" style={{ color: '#6366f1' }}>Let's talk.</span> Humans, not bots.</>
              )}
            </h1>
          </div>
        </section>

        {/* ── TWO-COLUMN SPLIT ──────────────────────────────── */}
        <section
          aria-label={isFr ? 'Méthodes de contact et formulaire' : 'Contact methods and form'}
          className="px-6 pb-24 md:pb-32"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1fr_1.3fr] gap-12 md:gap-20">
            {/* Editorial contact list */}
            <aside>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#86868b] mb-6">
                {isFr ? 'Joignez-nous directement' : 'Reach us directly'}
              </p>
              <ul role="list" className="space-y-7">
                {contactMethods.map((m) => (
                  <li key={m.label} className="border-t border-[#1d1d1f]/10 pt-5">
                    <div className="flex items-center gap-2.5 mb-2">
                      <m.icon size={15} style={{ color: m.accent }} aria-hidden="true" />
                      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#86868b]">
                        {m.label}
                      </span>
                    </div>
                    {m.href ? (
                      <a
                        href={m.href}
                        className="text-lg font-medium text-[#1d1d1f] hover:text-[#6366f1] transition-colors"
                      >
                        {m.value}
                      </a>
                    ) : (
                      <p className="text-lg font-medium text-[#1d1d1f]">{m.value}</p>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-12 p-6 rounded-2xl bg-[#fafaf8] border border-[#1d1d1f]/8">
                <p className="text-[11px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: '#a855f7' }}>
                  {isFr ? 'Temps de réponse' : 'Response time'}
                </p>
                <p className="text-[#424245] text-sm leading-relaxed">
                  {isFr
                    ? 'Réponse en moins de 4 heures pendant les heures ouvrées (9h-19h, lundi-vendredi, heure de Bruxelles).'
                    : 'Reply within 4 hours during business hours (9am-7pm, Mon-Fri, Brussels time).'}
                </p>
              </div>
            </aside>

            {/* Form */}
            <form
              onSubmit={onSubmit}
              aria-label={isFr ? 'Formulaire de contact' : 'Contact form'}
              className="rounded-[2rem] p-8 md:p-10 border border-[#1d1d1f]/10 bg-white"
            >
              {submitted ? (
                <div className="text-center py-8">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'rgba(99,102,241,0.12)' }}
                  >
                    <CheckCircle2 size={24} style={{ color: '#6366f1' }} aria-hidden="true" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-[-0.02em] mb-2">
                    {isFr ? 'Message envoyé.' : 'Message sent.'}
                  </h2>
                  <p className="text-[#525257] text-[15px]">
                    {isFr ? 'Réponse dans la journée.' : 'Reply within the day.'}
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold tracking-[-0.02em] mb-6">
                    {isFr ? 'Écrivez-nous' : 'Drop us a line'}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-semibold text-[#86868b] mb-2">
                        {isFr ? 'Nom' : 'Name'} *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoComplete="name"
                        className={inputCls}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="contact-email" className="block text-xs font-semibold text-[#86868b] mb-2">
                          Email *
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-company" className="block text-xs font-semibold text-[#86868b] mb-2">
                          {isFr ? 'Entreprise' : 'Company'}
                        </label>
                        <input
                          id="contact-company"
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          autoComplete="organization"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-message" className="block text-xs font-semibold text-[#86868b] mb-2">
                        Message *
                      </label>
                      <textarea
                        id="contact-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        rows={5}
                        className={inputCls + ' resize-none'}
                      />
                    </div>

                    {error && (
                      <p role="alert" className="text-sm text-red-600">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-sm font-medium pl-5 pr-6 py-3.5 rounded-full hover:bg-[#6366f1] transition-colors disabled:opacity-60"
                    >
                      <Send size={14} aria-hidden="true" />
                      {sending ? (isFr ? 'Envoi…' : 'Sending…') : (isFr ? 'Envoyer' : 'Send')}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
