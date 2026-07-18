import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';
import Reveal from '../components/ui/Reveal';

type QA = { q: string; a: string };

const FAQ_FR: QA[] = [
  {
    q: "Qu'est-ce que Qwillio ?",
    a: "Qwillio est une réceptionniste IA qui décroche vos appels 24 heures sur 24, prend les rendez-vous dans votre agenda, transfère les urgences vers votre ligne et vous envoie un résumé de chaque appel. Elle parle français et anglais nativement.",
  },
  {
    q: 'Mes clients vont-ils se rendre compte que c\'est une IA ?',
    a: "En tests aveugles en 2026, la majorité des appelants ne distinguent plus une IA vocale moderne d'une secrétaire humaine. La voix a un accent naturel (belge, français ou québécois), elle hésite, s'excuse et reformule comme un humain. Beaucoup préfèrent même l'IA : jamais de mise en attente, jamais de mauvaise journée.",
  },
  {
    q: 'Combien de temps pour installer Qwillio ?',
    a: "Environ 15 minutes. Vous gardez votre numéro existant et le transférez vers Qwillio. Nous configurons votre agent avec votre activité, vos horaires et vos règles. Le soir même, l'IA prend vos appels.",
  },
  {
    q: 'Combien ça coûte ?',
    a: "Le plan Solo est à 149 EUR par mois (300 appels, français, hébergement UE). Les plans supérieurs ajoutent du volume et des fonctions avancées. Premier mois offert sans carte, résiliable au mois, remise de 20 % en annuel.",
  },
  {
    q: 'Est-ce que Qwillio prend les rendez-vous dans mon agenda ?',
    a: "Oui. Qwillio se connecte à Google Calendar, Cal.com et Calendly. Elle vérifie les disponibilités, réserve le créneau, envoie une confirmation par SMS au client et un récapitulatif par email au patron.",
  },
  {
    q: 'Mes données sont-elles protégées ?',
    a: "Oui. Hébergement européen, conforme au RGPD, aucune donnée personnelle transférée hors de l'Espace économique européen. Le consentement à l'enregistrement est demandé au décrochage.",
  },
  {
    q: 'Que se passe-t-il en cas d\'urgence ?',
    a: "Vous définissez des règles : les vraies urgences sont transférées immédiatement vers votre portable ou une ligne dédiée. Les demandes commerciales, techniques ou le spam sont routés séparément.",
  },
  {
    q: 'Qwillio bloque-t-elle les appels spam ?',
    a: "Oui, sur tous les plans. Le bouclier anti-spam détecte les robocalls, les appels silencieux et les numéros qui inondent la ligne, les écarte de vos rendez-vous et de vos leads, et ne les compte pas dans votre quota d'appels.",
  },
  {
    q: 'Puis-je résilier facilement ?',
    a: "Oui. Tous les plans sont sans engagement, résiliables au mois en un clic depuis votre tableau de bord.",
  },
  {
    q: 'Qwillio remplace-t-elle une secrétaire humaine ?',
    a: "Pour le décrochage, la prise de rendez-vous et la qualification des appels, oui, à une fraction du coût et sans absence ni turnover. Pour les tâches qui demandent un jugement humain, elle vous transfère l'appel. C'est un renfort qui ne dort jamais, pas un remplacement de votre équipe.",
  },
];

const FAQ_EN: QA[] = [
  {
    q: 'What is Qwillio?',
    a: 'Qwillio is an AI receptionist that answers your calls 24/7, books appointments into your calendar, transfers emergencies to your line and sends you a summary of every call. It speaks French and English natively.',
  },
  {
    q: 'Will my customers notice it is an AI?',
    a: 'In blind tests in 2026, most callers can no longer tell a modern voice AI from a human receptionist. The voice has a natural accent, hesitates, apologises and rephrases like a human. Many even prefer the AI: never on hold, never having a bad day.',
  },
  {
    q: 'How long does it take to set up?',
    a: 'About 15 minutes. You keep your existing number and forward it to Qwillio. We configure your agent with your business, hours and rules. It answers your calls the same evening.',
  },
  {
    q: 'How much does it cost?',
    a: 'The Solo plan is 149 EUR per month (300 calls, French, EU hosting). Higher plans add volume and advanced features. First month free with no card, cancel monthly, 20% off annually.',
  },
  {
    q: 'Does Qwillio book appointments into my calendar?',
    a: 'Yes. Qwillio connects to Google Calendar, Cal.com and Calendly. It checks availability, books the slot, texts a confirmation to the customer and emails a recap to the owner.',
  },
  {
    q: 'Is my data protected?',
    a: 'Yes. European hosting, GDPR compliant, no personal data transferred outside the European Economic Area. Consent to recording is asked at pickup.',
  },
  {
    q: 'What happens in an emergency?',
    a: 'You define rules: real emergencies are transferred immediately to your mobile or a dedicated line. Sales enquiries, technical requests and spam are routed separately.',
  },
  {
    q: 'Does Qwillio block spam calls?',
    a: 'Yes, on every plan. The spam shield detects robocalls, silent calls and numbers flooding the line, keeps them out of your appointments and leads, and does not count them against your call quota.',
  },
  {
    q: 'Can I cancel easily?',
    a: 'Yes. All plans are commitment-free, cancellable monthly in one click from your dashboard.',
  },
  {
    q: 'Does Qwillio replace a human receptionist?',
    a: 'For answering, booking and qualifying calls, yes, at a fraction of the cost with no absences or turnover. For tasks that need human judgement, it transfers the call to you. It is backup that never sleeps, not a replacement for your team.',
  },
];

export default function Faq() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const faqs = isFr ? FAQ_FR : FAQ_EN;

  useSEO({
    title: isFr ? 'Questions fréquentes · Qwillio' : 'Frequently asked questions · Qwillio',
    description: isFr
      ? 'Réponses aux questions sur Qwillio : installation, langues, tarifs, RGPD, prise de rendez-vous, anti-spam, résiliation.'
      : 'Answers about Qwillio: setup, languages, pricing, GDPR, appointment booking, spam shield, cancellation.',
    canonical: 'https://qwillio.com/faq',
  });

  // FAQPage JSON-LD — targets Google "People Also Ask" and rich results.
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
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main className="mx-auto max-w-3xl px-6 pt-28 pb-24 md:pt-36">
        <Reveal>
          <h1 className="font-outfit text-4xl md:text-5xl font-semibold tracking-[-0.03em] leading-tight">
            {isFr ? 'Questions fréquentes' : 'Frequently asked questions'}
          </h1>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-4 text-lg text-[#6e6e73] max-w-2xl">
            {isFr
              ? 'Tout ce qu\'on nous demande avant de démarrer. Une autre question ? Écrivez-nous.'
              : 'Everything people ask before getting started. Another question? Get in touch.'}
          </p>
        </Reveal>

        <dl className="mt-12 divide-y divide-[#1d1d1f]/10">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={0.03 + i * 0.02}>
              <div className="py-6">
                <dt className="font-outfit text-lg font-semibold tracking-[-0.01em]">{f.q}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-[#424245]">{f.a}</dd>
              </div>
            </Reveal>
          ))}
        </dl>

        <Reveal delay={0.1}>
          <div className="mt-14 rounded-3xl border border-[#1d1d1f]/10 bg-[#fafaf8] p-8 md:p-10">
            <h2 className="font-outfit text-2xl font-semibold tracking-[-0.02em]">
              {isFr ? 'Prêt à essayer ?' : 'Ready to try it?'}
            </h2>
            <p className="mt-2 text-[#6e6e73]">
              {isFr
                ? 'Premier mois offert, sans carte. 15 minutes de setup.'
                : 'First month free, no card. 15 minutes to set up.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6366f1] active:scale-[0.97]"
              >
                {isFr ? 'Créer un compte' : 'Create an account'}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-[#1d1d1f]/15 bg-white px-5 py-3 text-sm font-medium text-[#1d1d1f] transition-colors hover:border-[#1d1d1f] active:scale-[0.97]"
              >
                {isFr ? 'Nous contacter' : 'Contact us'}
              </Link>
            </div>
          </div>
        </Reveal>
      </main>

      <PublicFooter />
    </div>
  );
}
