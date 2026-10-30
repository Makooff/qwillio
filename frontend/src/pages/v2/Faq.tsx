import { useEffect } from 'react';
import { ArrowRight } from '../../components/icons';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import FaqAccordion from '../../components/v2/FaqAccordion';

/* FAQ V2. Le mur de texte déplié de la V1 devient un accordéon replié.
   L'injection JSON-LD FAQPage reste identique et couvre la totalité des
   questions, indépendamment de ce qui est ouvert à l'écran. */

type QA = { q: string; a: string };

const FAQ_FR: QA[] = [
  {
    q: 'Est-ce qu’il prend vraiment le rendez-vous pendant l’appel ?',
    a: "Oui, avec votre agenda Google ou Outlook connecté. Il vérifie vos disponibilités, propose un créneau libre puis enregistre la réservation confirmée. Vos clients peuvent aussi déplacer ou annuler un rendez-vous pendant l’appel. Si le créneau vient d’être réservé, il propose une autre heure. Sans agenda connecté, il note la demande et les coordonnées pour vous permettre de rappeler.",
  },
  {
    q: 'Que se passe-t-il quand il me passe l’appel ?',
    a: "Il ne vous met pas devant un inconnu. Avant de faire le pont, il vous résume à l’oral qui est en ligne et pourquoi, puis peut vous envoyer le même brief par SMS si ce canal est activé et votre numéro renseigné. Si le transfert échoue, les coordonnées déjà recueillies vous permettent de rappeler.",
  },
  {
    q: 'Reconnaît-il un client qui rappelle ?',
    a: "Oui. Un appelant déjà connu est salué par son prénom, et ce qui a été dit lors du précédent appel est disponible dès le décrochage, tout comme son rendez-vous à venir. Il ne redemande pas ce qu'il sait déjà. Cette mémoire se limite à ce qui sert l'appel suivant, n'est ni vendue ni utilisée pour entraîner un modèle externe sans votre accord, et peut être effacée sur demande, conformément au RGPD.",
  },
  {
    q: 'Puis-je importer mes tarifs depuis une photo ?',
    a: "Oui. Photographiez votre carte, votre menu ou votre grille de prix, et il en lit les lignes. Rien n'est ajouté sans que vous ayez relu et confirmé la liste extraite. Aucune image n'est conservée : la photo est traitée puis abandonnée, seules les lignes que vous validez sont enregistrées.",
  },
  {
    q: 'Puis-je l’essayer avant de brancher ma ligne ?',
    a: "Oui. Depuis votre tableau de bord, vous l'appelez directement dans le navigateur et vous lui parlez comme le ferait un client. Vous corrigez ce qui vous gêne, vous relancez un appel test, et vous ne transférez votre vrai numéro que lorsque le résultat vous convient.",
  },
  {
    q: 'Combien de voix, et puis-je changer le ton ?',
    a: "Dix personnages, chacun avec sa voix, et chacun parle français et anglais : la langue vient de vos appels, pas du personnage. Vous les écoutez avant de choisir. Le ton se règle séparément de la voix, parmi six réglages (chaleureux, professionnel, décontracté, énergique, haut de gamme, rassurant), et vous pouvez le changer à tout moment. Vous pouvez aussi cloner votre propre voix.",
  },
  {
    q: 'Puis-je utiliser ma propre voix ?',
    a: "Oui. Depuis le tableau de bord, enregistrez votre voix au micro ou importez un fichier audio. Sur le moteur vocal Qwillio, cette option nécessite le mode cascade : les voix des modèles temps réel ne peuvent pas être remplacées par un clone. Le clonage exige votre consentement explicite ; la voix doit être la vôtre ou enregistrée avec l’accord écrit de la personne. Vous pouvez la remplacer ou demander sa suppression.",
  },
  {
    q: 'Parle-t-il d’autres langues que le français et l’anglais ?',
    a: "Non. Français et anglais, et c'est un choix. Les deux fonctionnent sur le même appel, sans menu à choisir : si l'appelant passe à l'anglais en cours de conversation, il suit. Nous préférons deux langues bien tenues qu'une liste longue mal tenue.",
  },
  {
    q: 'Les appels spam comptent-ils dans mes minutes ?',
    a: "Non, sur tous les plans. Le bouclier anti-spam détecte les robocalls, les appels silencieux et les numéros qui inondent la ligne, les écarte de vos rendez-vous et de vos leads, et ne les décompte pas de vos minutes incluses.",
  },
  {
    q: 'Et s’il ne sait pas répondre ?',
    a: "Il transfère vers vous selon vos règles ou prend les coordonnées pour vous permettre de rappeler. Lorsqu’une action échoue, il peut proposer ce même repli. Cela ne couvre pas toutes les pannes ou les coupures de ligne. Un bilan hebdomadaire peut vous être envoyé par email et par SMS selon les canaux activés, notamment pour repérer les questions sans réponse dans votre FAQ.",
  },
  {
    q: 'Combien ça coûte ?',
    a: "Le plan Solo est à 99 € par mois : 250 minutes incluses, soit environ 100 appels. Au-delà, les minutes supplémentaires sont à 0,45 €. Les plans supérieurs ajoutent du volume et des fonctions avancées : Starter 249 € (750 min), Pro 599 € (2 000 min), Enterprise 1 290 € (5 000 min). Le rappel automatique la veille du rendez-vous est inclus sur tous les plans. 7 jours d'essai gratuit, remise de 20 % en annuel.",
  },
  {
    q: 'Puis-je résilier facilement ?',
    a: "Oui. En mensuel, aucun engagement : résiliez en un clic depuis votre tableau de bord, à tout moment. En annuel, vous vous engagez sur 12 mois en échange de la remise de 20 %. Aucun frais d'installation dans les deux cas.",
  },
];

const FAQ_EN: QA[] = [
  {
    q: 'Does it really book the appointment during the call?',
    a: "Yes, with your Google or Outlook calendar connected. It checks availability, offers a free slot and records the confirmed booking. Customers can also reschedule or cancel an appointment during the call. If the slot has just been taken, it offers another time. Without a connected calendar, it records the request and contact details so you can call back.",
  },
  {
    q: 'What happens when it hands the call over to me?',
    a: "You are not dropped in front of a stranger. Before bridging the call, it tells you who is on the line and why, then can send the same brief by text when messaging is enabled and your number is provided. If the transfer fails, contact details already collected let you call back.",
  },
  {
    q: 'Does it recognise a customer calling back?',
    a: "Yes. A known caller is greeted by first name, and what was said on the previous call is available from pickup, along with their upcoming appointment. It does not ask again for what it already knows. That memory is limited to what serves the next call, is never sold and never used to train an external model without your consent, and can be erased on request, in line with GDPR.",
  },
  {
    q: 'Can I import my rates from a photo?',
    a: 'Yes. Photograph your rate card, menu or price list and it reads the lines off it. Nothing is added until you have reviewed and confirmed the extracted list. No image is kept: the photo is processed then dropped, and only the lines you approve are stored.',
  },
  {
    q: 'Can I try it before pointing my line at it?',
    a: 'Yes. From your dashboard you call it straight in the browser and talk to it the way a customer would. You fix what bothers you, run another test call, and only forward your real number once you are happy with the result.',
  },
  {
    q: 'How many voices, and can I change the tone?',
    a: 'Ten characters, each with its own voice, and each speaks French and English: the language comes from your calls, not from the character. You listen before you pick. Tone is set separately from the voice, across six settings (warm, professional, casual, energetic, premium, reassuring), and you can change it at any time. You can also clone your own voice.',
  },
  {
    q: 'Can I use my own voice?',
    a: 'Yes. Record your voice with your microphone or import an audio file from the dashboard. On the Qwillio voice engine, this option requires cascade mode: a realtime model voice cannot be replaced by a clone. Cloning requires explicit consent; the voice must be yours or recorded with the person’s written permission. You can replace it or request deletion.',
  },
  {
    q: 'Does it speak languages other than French and English?',
    a: 'No. French and English, and that is a choice. Both work on the same call, with no menu to pick from: if the caller switches to English mid-conversation, it follows. We would rather hold two languages properly than a long list badly.',
  },
  {
    q: 'Do spam calls count against my minutes?',
    a: 'No, on every plan. The spam shield detects robocalls, silent calls and numbers flooding the line, keeps them out of your appointments and leads, and does not count them against your included minutes.',
  },
  {
    q: 'What if it does not know the answer?',
    a: 'It transfers according to your rules or collects contact details so you can call back. If an action fails, it can offer this same fallback. This cannot cover every outage or disconnected line. A weekly report can be sent by email and text depending on enabled channels, including questions your FAQ could not answer.',
  },
  {
    q: 'How much does it cost?',
    a: 'The Solo plan is €99 per month: 250 minutes included, roughly 100 calls. Beyond that, extra minutes are €0.45. Higher plans add volume and advanced features: Starter €249 (750 min), Pro €599 (2,000 min), Enterprise €1,290 (5,000 min). The automatic day-before appointment reminder is included on every plan. 7-day free trial, 20% off annually.',
  },
  {
    q: 'Can I cancel easily?',
    a: 'Yes. On monthly billing, no commitment: cancel in one click from your dashboard, anytime. On annual, you commit for 12 months in exchange for the 20% discount. No setup fee either way.',
  },
];

export default function Faq() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const faqs = isFr ? FAQ_FR : FAQ_EN;

  useSEO({
    title: isFr ? 'Questions fréquentes · Qwillio' : 'Frequently asked questions · Qwillio',
    description: isFr
      ? 'Réponses aux questions sur Qwillio : prise de rendez-vous pendant l’appel, transfert avec résumé, mémoire des habitués, import des tarifs par photo, appel test, voix, RGPD, tarifs et résiliation.'
      : 'Answers about Qwillio: booking during the call, warm transfer with a brief, memory of regulars, importing rates from a photo, test call, voices, GDPR, pricing and cancellation.',
    canonical: 'https://qwillio.com/faq',
  });

  // FAQPage JSON-LD, targets Google "People Also Ask" and rich results.
  useEffect(() => {
    const id = 'qwillio-faq-jsonld';
    document.getElementById(id)?.remove();
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: isFr ? 'fr' : 'en',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [faqs, isFr]);

  return (
    <PublicShell>
      <Section aria-label={isFr ? 'Questions fréquentes' : 'Frequently asked questions'} className="relative !pt-16 md:!pt-24 !pb-0">
        <Container className="grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-20 items-end">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-6">
              FAQ
            </Eyebrow>
            <Display>
              {isFr ? (
                <>
                  Questions <SerifWord>fréquentes.</SerifWord>
                </>
              ) : (
                <>
                  Frequently asked <SerifWord>questions.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1}>
            <Lead className="max-w-[400px] q2-body-text lg:pb-3">
              {isFr
                ? 'Tout ce qu\u2019on nous demande avant de démarrer. Une autre question\u00A0? Écrivez-nous.'
                : 'Everything people ask before getting started. Another question? Get in touch.'}
            </Lead>
          </RevealV2>
        </Container>
      </Section>

      <Section className="!pt-16 md:!pt-20">
        <Container className="grid lg:grid-cols-[1fr_1.9fr] gap-10 lg:gap-16 items-start">
          <RevealV2>
            <H2 className="!text-[clamp(1.6rem,2.4vw,2.2rem)] lg:sticky lg:top-24">
              {isFr ? 'Avant de démarrer' : 'Before you start'}
            </H2>
          </RevealV2>
          <RevealV2 index={1}>
            <FaqAccordion items={faqs} />
          </RevealV2>
        </Container>
      </Section>

      <Section variant="drenched-indigo" aria-label={isFr ? 'Essayer Qwillio' : 'Try Qwillio'}>
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
          <RevealV2>
            <h2 className="q2-h2 text-white max-w-[560px]">
              {isFr ? 'Prêt à essayer\u00A0?' : 'Ready to try it?'}
            </h2>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-1">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr
                ? '7 jours d\u2019essai gratuit. 15 minutes de setup.'
                : '7-day free trial. 15 minutes to set up.'}
            </p>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <PillLink to="/register" variant="chromatic" size="lg">
                {isFr ? 'Créer un compte' : 'Create an account'}
                <ArrowRight size={16} aria-hidden="true" />
              </PillLink>
              <PillLink to="/contact" variant="onDark" size="lg">
                {isFr ? 'Nous contacter' : 'Contact us'}
              </PillLink>
            </div>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
