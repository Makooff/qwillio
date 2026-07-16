import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowRight, Check, Phone, CalendarDays, MessageSquare, Sparkles } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';

type Sector = {
  slug: string;
  metierFr: string;
  metierEn: string;
  headlineFr: string;
  headlineEn: string;
  painFr: string;
  painEn: string;
  scenarioFr: string;
  scenarioEn: string;
  wins: { titleFr: string; titleEn: string; bodyFr: string; bodyEn: string }[];
  plan: 'solo' | 'starter' | 'pro';
};

const SECTORS: Record<string, Sector> = {
  plombier: {
    slug: 'plombier',
    metierFr: 'plombier',
    metierEn: 'plumber',
    headlineFr: 'La réceptionniste IA qui prend les urgences plomberie 24/7',
    headlineEn: 'The AI receptionist that takes plumbing emergencies 24/7',
    painFr:
      "Vous êtes bras dans les canalisations, votre téléphone sonne, personne ne décroche. En 60 secondes, votre client compose le concurrent. 5 appels ratés par semaine, c'est 15 000 € de CA qui part chaque année.",
    painEn:
      'You are hands-deep in a pipe, your phone rings, no one picks up. In 60 seconds your customer calls the next plumber on the list. 5 missed calls a week is €15,000 in lost revenue a year.',
    scenarioFr:
      "Chaudière qui lâche un dimanche soir. Qwillio décroche, prend l'adresse, propose un créneau d'urgence, vous envoie le rendez-vous par SMS et pose la ligne dans votre agenda.",
    scenarioEn:
      'Boiler dies on a Sunday night. Qwillio picks up, takes the address, offers an emergency slot, texts you the appointment and drops it into your calendar.',
    wins: [
      {
        titleFr: 'Urgences 24/7',
        titleEn: '24/7 emergencies',
        bodyFr:
          "Route les vraies urgences vers votre portable, prend les autres RDV sans vous déranger.",
        bodyEn: 'Routes real emergencies to your phone, books the rest without disturbing you.',
      },
      {
        titleFr: 'Devis rapide',
        titleEn: 'Fast quote intake',
        bodyFr: "Qualifie type d'intervention, adresse, urgence, prend photos par SMS entrant.",
        bodyEn: 'Qualifies intervention type, address, urgency, receives photos via inbound SMS.',
      },
      {
        titleFr: 'Agenda intégré',
        titleEn: 'Calendar integrated',
        bodyFr: 'Pose le RDV direct dans Google Calendar ou Cal.com. Zéro double booking.',
        bodyEn: 'Books straight into Google Calendar or Cal.com. Zero double bookings.',
      },
    ],
    plan: 'solo',
  },
  dentiste: {
    slug: 'dentiste',
    metierFr: 'dentiste',
    metierEn: 'dentist',
    headlineFr: 'La réceptionniste IA qui reprogramme vos no-shows en direct',
    headlineEn: 'The AI receptionist that rebooks no-shows on the spot',
    painFr:
      'Votre secrétaire est débordée à 12 h 30 pile. 30 % des appels raccrochent avant qu\'elle décroche. Chaque no-show non reprogrammé, c\'est 85 € de perte.',
    painEn:
      "Your receptionist is overwhelmed at 12:30 sharp. 30% of callers hang up before she picks up. Every no-show that isn't rebooked costs €85.",
    scenarioFr:
      "Un patient annule mardi à 15 h. Qwillio note l'annulation, propose deux créneaux alternatifs, reprogramme, envoie confirmation SMS et libère le créneau pour le prochain appelant.",
    scenarioEn:
      'A patient cancels Tuesday 3pm. Qwillio logs the cancellation, offers two alternative slots, rebooks, sends a SMS confirmation and releases the slot to the next caller.',
    wins: [
      {
        titleFr: 'Anti no-show',
        titleEn: 'Anti no-show',
        bodyFr: "Rappelle 24 h avant, reprogramme en 60 s si le patient annule.",
        bodyEn: 'Reminds 24h before, rebooks in 60 seconds if the patient cancels.',
      },
      {
        titleFr: 'Bilingue français / anglais',
        titleEn: 'Bilingual French / English',
        bodyFr: "Change de langue au milieu de l'appel sans transfert manuel.",
        bodyEn: 'Switches language mid-call with no manual transfer.',
      },
      {
        titleFr: 'Fiches patients',
        titleEn: 'Patient records',
        bodyFr: "Push la fiche complète dans votre logiciel de gestion (Doctolib, Softpro, etc.).",
        bodyEn: 'Pushes the full record into your practice software (Doctolib, Softpro, etc.).',
      },
    ],
    plan: 'starter',
  },
  notaire: {
    slug: 'notaire',
    metierFr: 'notaire',
    metierEn: 'notary',
    headlineFr: 'La réceptionniste IA qui qualifie vos dossiers avant votre secrétaire',
    headlineEn: 'The AI receptionist that qualifies files before your assistant',
    painFr:
      "30 % de vos prospects vente-achat sont mal qualifiés au premier appel. Ils passent chez le confrère. Chaque dossier perdu, c'est 3 500 € d'honoraires évaporés.",
    painEn:
      "30% of your sale-purchase prospects are poorly qualified on the first call. They go to a competitor. Each lost file is €3,500 in fees evaporated.",
    scenarioFr:
      "Un prospect appelle pour vendre une maison. Qwillio qualifie : compromis signé ou non, prix, acheteur, urgence. Pose le RDV. Envoie un email récap au notaire avant qu'il n'ouvre le dossier.",
    scenarioEn:
      'A prospect calls to sell a house. Qwillio qualifies: signed compromise or not, price, buyer, urgency. Books the meeting. Emails a recap to the notary before the file is opened.',
    wins: [
      {
        titleFr: 'Pré-qualification',
        titleEn: 'Pre-qualification',
        bodyFr: "Type dossier, montant, urgence, contexte livrés en email avant le RDV.",
        bodyEn: 'File type, amount, urgency, context delivered by email before the meeting.',
      },
      {
        titleFr: 'Filtrage smart',
        titleEn: 'Smart filtering',
        bodyFr: "Route commerciaux, spam, prospects, dossiers urgents vers les bonnes personnes.",
        bodyEn: 'Routes sales, spam, prospects and urgent files to the right people.',
      },
      {
        titleFr: 'Conforme RGPD',
        titleEn: 'GDPR compliant',
        bodyFr: 'Hébergement européen, aucune donnée hors EEE, consentement demandé au décrochage.',
        bodyEn: 'European hosting, no data outside the EEA, consent asked at pickup.',
      },
    ],
    plan: 'pro',
  },
};

const PLAN_PRICES: Record<Sector['plan'], { eur: number; usd?: number; labelFr: string; labelEn: string }> = {
  solo: { eur: 149, labelFr: 'Solo', labelEn: 'Solo' },
  starter: { eur: 470, usd: 497, labelFr: 'Starter', labelEn: 'Starter' },
  pro: { eur: 1180, usd: 1297, labelFr: 'Pro', labelEn: 'Pro' },
};

export default function Vertical({ secteur: secteurProp }: { secteur?: string } = {}) {
  const params = useParams<{ secteur: string }>();
  const secteur = secteurProp ?? params.secteur;
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const sector = secteur ? SECTORS[secteur] : undefined;

  useSEO({
    title: sector
      ? isFr
        ? `Qwillio pour ${sector.metierFr} · Réceptionniste IA en français`
        : `Qwillio for ${sector.metierEn}s · French-native AI receptionist`
      : 'Qwillio',
    description: sector
      ? isFr
        ? sector.painFr
        : sector.painEn
      : '',
    canonical: sector ? `https://qwillio.com/${sector.slug}` : undefined,
  });

  if (!sector) return <Navigate to="/" replace />;

  const plan = PLAN_PRICES[sector.plan];
  const priceLine = isFr
    ? `${plan.eur} € HT / mois · plan ${plan.labelFr}`
    : `${plan.usd ?? plan.eur} ${plan.usd ? 'USD' : 'EUR'} / month · ${plan.labelEn} plan`;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <PublicNavbar />

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-24 sm:pt-32">
        <Reveal>
          <span className="inline-block rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium tracking-wide text-indigo-700">
            {isFr ? `Pour les ${sector.metierFr}s` : `For ${sector.metierEn}s`}
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-4 max-w-3xl font-outfit text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {isFr ? sector.headlineFr : sector.headlineEn}
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-neutral-600">
            {isFr ? sector.painFr : sector.painEn}
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 active:scale-[0.97]"
            >
              {isFr ? 'Créer un compte' : 'Create an account'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 active:scale-[0.97]"
            >
              {isFr ? 'Voir une démo' : 'Book a demo'}
            </Link>
            <span className="text-sm text-neutral-500">{priceLine}</span>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <Reveal>
          <h2 className="font-outfit text-2xl font-semibold tracking-tight sm:text-3xl">
            {isFr ? 'Un cas concret' : 'A concrete scenario'}
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-neutral-700">
            {isFr ? sector.scenarioFr : sector.scenarioEn}
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <Reveal>
          <h2 className="font-outfit text-2xl font-semibold tracking-tight sm:text-3xl">
            {isFr ? 'Ce que vous gagnez' : 'What you get'}
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {sector.wins.map((w, i) => (
            <Reveal key={w.titleFr} delay={0.05 + i * 0.05}>
              <Card3D>
                <div className="h-full rounded-2xl border border-neutral-200 bg-white p-6">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    {i === 0 ? <Phone className="h-4 w-4" /> : i === 1 ? <MessageSquare className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                  </div>
                  <h3 className="font-outfit text-lg font-semibold">
                    {isFr ? w.titleFr : w.titleEn}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    {isFr ? w.bodyFr : w.bodyEn}
                  </p>
                </div>
              </Card3D>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <Reveal>
          <h2 className="font-outfit text-2xl font-semibold tracking-tight sm:text-3xl">
            {isFr ? 'Ce qui est inclus' : 'What is included'}
          </h2>
        </Reveal>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {(isFr
            ? [
                'Voix française native, accent belge ou français',
                'Bilingue français / anglais en cours d\'appel',
                'Prise de RDV Google Calendar, Cal.com, Calendly',
                'SMS de confirmation au client',
                'Email récap au patron après chaque appel',
                'Transcript complet + sentiment',
                'Routage urgences / commercial / spam',
                'Hébergement européen, RGPD conforme',
              ]
            : [
                'French-native voice, Belgian or French accent',
                'Bilingual French / English mid-call',
                'Calendar booking: Google Calendar, Cal.com, Calendly',
                'SMS confirmation to the customer',
                'Email recap to the owner after each call',
                'Full transcript + sentiment',
                'Routing: emergencies / sales / spam',
                'European hosting, GDPR compliant',
              ]
          ).map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-neutral-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <Reveal>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-8 sm:p-12">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
              <Sparkles className="h-4 w-4" />
              {isFr ? 'Premier mois offert, sans carte' : 'First month free, no card required'}
            </div>
            <h2 className="mt-3 font-outfit text-3xl font-semibold tracking-tight sm:text-4xl">
              {isFr
                ? `Testez Qwillio sur votre activité de ${sector.metierFr}.`
                : `Try Qwillio on your ${sector.metierEn} practice.`}
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-600">
              {isFr
                ? "15 minutes de setup. Résiliable en un clic. Aucun engagement."
                : '15 minutes to set up. Cancel in one click. No commitment.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 active:scale-[0.97]"
              >
                {isFr ? 'Créer un compte' : 'Create an account'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 active:scale-[0.97]"
              >
                {isFr ? 'Voir tous les tarifs' : 'See all pricing'}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}
