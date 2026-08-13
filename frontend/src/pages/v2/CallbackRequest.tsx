import { useState } from 'react';
import { CheckCircle2, Phone } from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, SerifWord } from '../../components/v2/Primitives';
import { PillButton } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import api from '../../services/api';
import { CONSENT_STATEMENTS } from '../../config/consent-statements';

/* Demande de rappel — la porte d'entrée du registre de consentement.
   Voir DA/v2-direction.md pour le registre visuel.

   Cette page n'est pas un formulaire de contact de plus: c'est le seul endroit
   où un consentement à être appelé peut naître côté public. Depuis le
   11/08/2026, appeler un numéro français sans preuve de consentement est
   interdit, et cette preuve nous incombe. Trois règles en découlent:

     - la case n'est JAMAIS pré-cochée, et le bouton reste désactivé tant
       qu'elle ne l'est pas. Un consentement déduit d'un envoi de formulaire
       n'est pas un acte positif clair;
     - le texte affiché est le texte enregistré, au caractère près
       (`config/consent-statements.ts`, miroir du fichier serveur);
     - on n'envoie pas ce texte au serveur, seulement sa langue. Le serveur
       inscrit sa propre copie: un texte venu du navigateur pourrait avoir été
       réécrit, et prouverait alors un consentement fabriqué. */

const INPUT =
  'w-full px-4 py-3 text-[15px] rounded-xl border border-q2-plate bg-q2-canvas text-q2-ink ' +
  'placeholder-q2-faint focus:outline-none focus:border-q2-indigo transition-colors';

export default function CallbackRequest() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('BE');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useSEO({
    title: isFr ? 'Être rappelé — Qwillio' : 'Request a callback — Qwillio',
    description: isFr
      ? 'Laissez votre numéro, nous vous rappelons pour vous présenter la réceptionniste IA.'
      : 'Leave your number and we will call you back about the AI receptionist.',
  });

  const statement = CONSENT_STATEMENTS[isFr ? 'fr' : 'en'];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || sending) return;
    setSending(true);
    setError('');
    try {
      await api.post('/public/callback-request', {
        phone, name, businessName, country,
        locale: isFr ? 'fr' : 'en',
        consent: true,
      });
      setSent(true);
    } catch (err: any) {
      const code = err?.response?.data?.error;
      setError(
        code === 'invalid_phone'
          ? (isFr ? 'Ce numéro semble incomplet. Vérifiez-le et réessayez.' : 'That number looks incomplete. Please check it.')
          : code === 'rate_limited'
            ? (isFr ? 'Trop de demandes depuis cette connexion. Réessayez dans une heure.' : 'Too many requests from this connection. Try again in an hour.')
            : (isFr ? "L'envoi a échoué. Réessayez dans un instant." : 'Something went wrong. Please try again.'),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicShell>
      <Section>
        <Container className="max-w-[620px]">
          <RevealV2>
            <Eyebrow>{isFr ? 'Être rappelé' : 'Request a callback'}</Eyebrow>
            <Display>
              {isFr ? (
                <>On vous <SerifWord>rappelle</SerifWord>.</>
              ) : (
                <>We'll <SerifWord>call</SerifWord> you.</>
              )}
            </Display>
            <p className="mt-5 text-[16px] leading-relaxed text-q2-body">
              {isFr
                ? "Laissez votre numéro : on vous rappelle pour vous montrer ce que la réceptionniste sait faire, sur votre métier. Pas de séquence d'emails, pas de relance automatique."
                : 'Leave your number and we will call you back to show what the receptionist does for your line of work. No email sequence, no automated follow-up.'}
            </p>
          </RevealV2>

          {sent ? (
            <RevealV2 delay={0.05}>
              <div className="mt-10 rounded-2xl border border-q2-plate bg-q2-band p-8 text-center">
                <CheckCircle2 size={28} className="mx-auto text-q2-indigo" />
                <p className="mt-4 text-[17px] font-medium text-q2-ink">
                  {isFr ? "C'est noté." : 'All set.'}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-q2-body">
                  {isFr
                    ? 'Nous vous appelons pendant les heures ouvrables. Vous pouvez nous dire « ne me rappelez plus » à tout moment pendant l’appel : le numéro est retiré immédiatement et définitivement.'
                    : 'We will call during business hours. You can say "do not call me again" at any point during the call: the number is removed immediately and permanently.'}
                </p>
              </div>
            </RevealV2>
          ) : (
            <RevealV2 delay={0.05}>
              <form onSubmit={submit} className="mt-10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={isFr ? 'Votre nom' : 'Your name'}
                    autoComplete="name" className={INPUT}
                  />
                  <input
                    type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                    placeholder={isFr ? 'Votre entreprise' : 'Your business'}
                    autoComplete="organization" className={INPUT}
                  />
                </div>

                <div className="grid grid-cols-[110px_1fr] gap-4">
                  <select
                    value={country} onChange={e => setCountry(e.target.value)}
                    className={INPUT + ' appearance-none'}
                    aria-label={isFr ? 'Pays' : 'Country'}
                  >
                    <option value="BE">🇧🇪 +32</option>
                    <option value="FR">🇫🇷 +33</option>
                  </select>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder={country === 'FR' ? '06 12 34 56 78' : '0470 12 34 56'}
                    autoComplete="tel" required className={INPUT}
                  />
                </div>

                {/* La case, jamais pré-cochée. Le libellé complet est visible
                    AVANT le clic: un consentement « éclairé » suppose qu'on
                    ait pu lire ce à quoi on consent, sans déplier quoi que ce
                    soit. */}
                <label className="flex gap-3 items-start pt-2 cursor-pointer group">
                  <input
                    type="checkbox" checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    className="mt-1 h-[18px] w-[18px] flex-shrink-0 accent-q2-indigo cursor-pointer"
                  />
                  <span className="text-[13.5px] leading-relaxed text-q2-body">{statement}</span>
                </label>

                {error && <p className="text-[14px] text-red-600">{error}</p>}

                <div className="pt-2">
                  <PillButton type="submit" disabled={!consent || sending}>
                    <Phone size={15} />
                    {sending
                      ? (isFr ? 'Envoi…' : 'Sending…')
                      : (isFr ? 'Demander un rappel' : 'Request a callback')}
                  </PillButton>
                  {!consent && (
                    <p className="mt-3 text-[13px] text-q2-faint">
                      {isFr
                        ? 'Cochez la case pour activer le bouton.'
                        : 'Tick the box to enable the button.'}
                    </p>
                  )}
                </div>
              </form>
            </RevealV2>
          )}
        </Container>
      </Section>
    </PublicShell>
  );
}
