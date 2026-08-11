import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '../components/icons';
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
    a: "Certains le remarqueront, d'autres non : la qualité vocale a beaucoup progressé, et la voix hésite, s'excuse et reformule comme un humain, avec un accent naturel belge, français ou québécois. Le mieux est de juger vous-même en écoutant la démo. Et posez-vous la vraie question : ce que votre client préfère, ce n'est pas humain contre IA, c'est quelqu'un qui décroche plutôt qu'un répondeur.",
  },
  {
    q: 'Combien de temps pour installer Qwillio ?',
    a: "Environ 15 minutes. Vous gardez votre numéro existant et le transférez vers Qwillio. Nous configurons votre agent avec votre activité, vos horaires et vos règles. Le soir même, l'IA prend vos appels.",
  },
  {
    q: 'Combien ça coûte ?',
    a: "Le plan Solo est à 99 € par mois : 250 minutes incluses, soit environ 100 appels, en français. Au-delà, les minutes supplémentaires sont à 0,45 €. Les plans supérieurs ajoutent du volume et des fonctions avancées : Starter 249 € (750 min), Pro 599 € (2 000 min), Enterprise 1 290 € (5 000 min). 7 jours d’essai gratuit, résiliable au mois, remise de 20 % en annuel.",
  },
  {
    q: 'Est-ce que Qwillio prend les rendez-vous dans mon agenda ?',
    a: "Oui. Qwillio se connecte à Google Calendar, Cal.com et Calendly. Elle vérifie les disponibilités, réserve le créneau, envoie une confirmation par SMS au client et un récapitulatif par email au patron.",
  },
  {
    q: 'Mes données sont-elles protégées ?',
    a: "Oui. Conforme au RGPD : les transferts hors EEE sont couverts par les Clauses Contractuelles Types, la liste des sous-traitants est publique, et rien n'est vendu ni utilisé pour entraîner des modèles. Le consentement à l'enregistrement est demandé au décrochage.",
  },
  {
    q: 'Que se passe-t-il en cas d\'urgence ?',
    a: "Vous définissez des règles : les vraies urgences sont transférées immédiatement vers votre portable ou une ligne dédiée. Les demandes commerciales, techniques ou le spam sont routés séparément.",
  },
  {
    q: 'Qwillio bloque-t-elle les appels spam ?',
    a: "Oui, sur tous les plans. Le bouclier anti-spam détecte les robocalls, les appels silencieux et les numéros qui inondent la ligne, les écarte de vos rendez-vous et de vos leads, et ne les décompte pas de vos minutes incluses.",
  },
  {
    q: "Après le 11 août, aurai-je encore le droit d'utiliser Qwillio ?",
    a: "Oui, et la loi joue même en votre faveur. Ce qui devient interdit en France, c'est le démarchage téléphonique vers les particuliers sans accord préalable. Qwillio répond aux appels entrants, ceux que vos clients vous passent : c'est l'inverse du démarchage, et ce n'est pas concerné. Concrètement, comme beaucoup d'entreprises perdent le téléphone sortant, l'appel entrant devient leur principal canal, et en rater un coûte plus cher qu'avant.",
  },
  {
    q: 'Pourquoi payer 99 € quand certains sont à 49 € ?',
    a: "Parce que ce n'est pas le même produit. À 49 €, vous avez le décrochage en français. Qwillio parle français et anglais sur le même appel sans que l'appelant ait à choisir, efface vos données sur demande, et inclut le CRM et la prise de rendez-vous. Si le français seul vous suffit et que vous n'avez pas besoin de CRM, prenez l'offre la moins chère, franchement. Le bon repère n'est pas un autre logiciel : c'est ce que coûte une secrétaire à mi-temps.",
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
    a: 'Some will notice, some will not: voice quality has come a long way, and the voice hesitates, apologises and rephrases like a human, with a natural Belgian, French or Quebec accent. The best way to judge is to listen to the demo yourself. And ask the real question: what your customer is comparing is not human versus AI, it is someone picking up versus voicemail.',
  },
  {
    q: 'How long does it take to set up?',
    a: 'About 15 minutes. You keep your existing number and forward it to Qwillio. We configure your agent with your business, hours and rules. It answers your calls the same evening.',
  },
  {
    q: 'How much does it cost?',
    a: 'The Solo plan is €99 per month: 250 minutes included, roughly 100 calls, French. Beyond that, extra minutes are €0.45. Higher plans add volume and advanced features: Starter €249 (750 min), Pro €599 (2,000 min), Enterprise €1,290 (5,000 min). 7-day free trial, cancel monthly, 20% off annually.',
  },
  {
    q: 'Does Qwillio book appointments into my calendar?',
    a: 'Yes. Qwillio connects to Google Calendar, Cal.com and Calendly. It checks availability, books the slot, texts a confirmation to the customer and emails a recap to the owner.',
  },
  {
    q: 'Is my data protected?',
    a: 'Yes. GDPR compliant: transfers outside the EEA are covered by Standard Contractual Clauses, the list of processors is public, and nothing is sold or used to train models. Consent to recording is asked at pickup.',
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
    q: 'After 11 August, will I still be allowed to use Qwillio?',
    a: 'Yes, and the law actually works in your favour. What becomes illegal in France is unsolicited outbound calling to consumers without prior consent. Qwillio answers inbound calls, the ones your customers make to you: that is the opposite of cold calling, and it is not covered. In practice, as many businesses lose outbound calling, the inbound call becomes their main channel, so missing one costs more than it used to.',
  },
  {
    q: 'Why pay €99 when some charge €49?',
    a: 'Because it is not the same product. At €49 you get answering in French. Qwillio speaks French and English on the same call without the caller picking an option, erases your data on request, and includes the CRM and calendar booking. If French-only covers you and you do not need a CRM, take the cheaper option, honestly. The right yardstick is not another piece of software: it is what a part-time receptionist costs.',
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
                ? '7 jours d’essai gratuit. 15 minutes de setup.'
                : '7-day free trial. 15 minutes to set up.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#7a5fff] active:scale-[0.97]"
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
