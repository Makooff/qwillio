import { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, type LucideIcon } from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, SerifWord } from '../../components/v2/Primitives';
import { PillButton } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import ShapeDrift from '../../components/v2/motion/ShapeDrift';
import api from '../../services/api';

/* Contact V2 « Papier & Signal », voir DA/v2-direction.md.
   Le formulaire poste réellement sur `POST /api/contact` (server.ts): la note
   d'origine « aucun backend n'existe encore » n'est plus vraie, et un mailto
   n'est plus le chemin nominal. */

interface Method {
  icon: LucideIcon;
  tone: 'indigo' | 'violet';
  label: string;
  value: string;
  href: string | null;
}

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
  // Champ leurre pour les robots, masqué à l'écran et hors du parcours clavier.
  const [honeypot, setHoneypot] = useState('');

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
      /* Un vrai POST, et non plus un `mailto:` suivi d'une confirmation
         immédiate. Le visiteur sans client mail configuré, c'est-à-dire la
         plupart sur mobile et sur un poste d'entreprise, lisait « Message
         envoyé » pour un message qui n'était jamais parti: un prospect perdu en
         silence, à l'endroit précis où il demandait à être rappelé.
         `honeypot` reste vide chez un humain: le champ est masqué. */
      await api.post('/contact', {
        name: name.trim(),
        email: email.trim(),
        subject: company.trim() || 'Site',
        message: message.trim(),
        website: honeypot,
      });
      setSubmitted(true);
    } catch {
      setError(
        isFr
          ? "L'envoi a échoué. Réessayez, ou écrivez-nous directement à hello@qwillio.com."
          : 'Sending failed. Try again, or email us directly at hello@qwillio.com.',
      );
    } finally {
      setSending(false);
    }
  };

  const contactMethods: Method[] = [
    {
      icon: Mail,
      tone: 'indigo',
      label: 'Email',
      value: 'hello@qwillio.com',
      href: 'mailto:hello@qwillio.com',
    },
    {
      icon: Phone,
      tone: 'violet',
      label: isFr ? 'Téléphone' : 'Phone',
      value: '+32 2 808 80 80',
      href: 'tel:+3228088080',
    },
    {
      icon: MapPin,
      tone: 'indigo',
      label: isFr ? 'Bureau' : 'Office',
      value: 'Brussels, Belgium',
      href: null,
    },
  ];

  const labelCls = 'block text-[13px] font-medium text-q2-graphite mb-2';
  const inputCls =
    'w-full rounded-xl border border-q2-plate bg-q2-plate/50 px-4 py-3 text-[15px] text-q2-ink placeholder-q2-faint outline-none transition-colors duration-150 focus:border-q2-indigo focus:ring-2 focus:ring-q2-indigo/25';

  return (
    <PublicShell>
      {/* HERO: titre whisper asymétrique */}
      <Section aria-label="Contact" className="relative !pt-16 md:!pt-24 !pb-12 md:!pb-16">
        <ShapeDrift shapes={[{ kind: 'twinMirror', x: '84%', y: '22%', size: 225, drift: 80, opacity: 0.22 }]} />
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-end">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-6">
              Contact
            </Eyebrow>
            <Display>
              {isFr ? (
                <>
                  <SerifWord>Parlons.</SerifWord> Aux humains, pas aux bots.
                </>
              ) : (
                <>
                  <SerifWord>Let's talk.</SerifWord> Humans, not bots.
                </>
              )}
            </Display>
          </RevealV2>
        </Container>
      </Section>

      {/* SPLIT: coordonnées en rangées hairline à gauche, formulaire à droite */}
      <Section
        aria-label={isFr ? 'Méthodes de contact et formulaire' : 'Contact methods and form'}
        className="!pt-0"
      >
        <Container className="grid lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-20 items-start">
          <RevealV2 as="div">
            <Eyebrow tone="neutral" className="mb-6">
              {isFr ? 'Joignez-nous directement' : 'Reach us directly'}
            </Eyebrow>
            <ul role="list" className="border-t border-q2-plate">
              {contactMethods.map((m) => (
                <li key={m.label} className="border-b border-q2-plate py-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <m.icon
                      size={14}
                      aria-hidden="true"
                      className={`shrink-0 ${m.tone === 'indigo' ? 'text-q2-indigo' : 'text-q2-violet'}`}
                    />
                    <span className="q2-eyebrow text-q2-body">{m.label}</span>
                  </div>
                  {m.href ? (
                    <a
                      href={m.href}
                      className="text-lg font-light tracking-tight text-q2-ink hover:text-q2-graphite transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-md"
                    >
                      {m.value}
                    </a>
                  ) : (
                    <p className="text-lg font-light tracking-tight text-q2-ink">{m.value}</p>
                  )}
                </li>
              ))}
            </ul>
          </RevealV2>

          <RevealV2 index={1}>
            <CardV2 variant="canvas" large className="md:p-10">
              {submitted ? (
                <div className="py-8 text-center">
                  <span className="w-14 h-14 rounded-full bg-q2-plate flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 size={22} className="text-q2-indigo" aria-hidden="true" />
                  </span>
                  <h2 className="q2-h3 text-q2-ink mb-2">{isFr ? 'Message envoyé.' : 'Message sent.'}</h2>
                  <p className="text-q2-body text-[15px] q2-body-text">
                    {isFr ? 'Réponse dans la journée.' : 'Reply within the day.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} aria-label={isFr ? 'Formulaire de contact' : 'Contact form'}>
                  <h2 className="q2-h3 text-q2-ink mb-6">{isFr ? 'Écrivez-nous' : 'Drop us a line'}</h2>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="contact-name" className={labelCls}>
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
                        <label htmlFor="contact-email" className={labelCls}>
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
                        <label htmlFor="contact-company" className={labelCls}>
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
                      <label htmlFor="contact-message" className={labelCls}>
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

                    {/* Leurre à robots: hors flux, hors tabulation, annoncé
                        comme décoratif aux lecteurs d'écran. Un humain ne peut
                        pas le remplir, un robot remplit tout. */}
                    <div className="absolute -left-[9999px]" aria-hidden="true">
                      <label htmlFor="contact-website">Site web</label>
                      <input
                        id="contact-website"
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    {error && (
                      <p
                        role="alert"
                        className="rounded-xl border border-q2-plate bg-q2-band px-4 py-3 text-sm text-q2-ink"
                      >
                        {error}
                      </p>
                    )}

                    <PillButton type="submit" disabled={sending} size="lg" className="disabled:opacity-60">
                      <Send size={14} aria-hidden="true" />
                      {sending ? (isFr ? 'Envoi…' : 'Sending…') : isFr ? 'Envoyer' : 'Send'}
                    </PillButton>
                  </div>
                </form>
              )}
            </CardV2>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
