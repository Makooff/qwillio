import { useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowRight, Check, Phone, CalendarDays, ShieldCheck } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';

type City = {
  slug: string;
  nameFr: string;
  nameEn: string;
  region: string; // for schema areaServed
  introFr: string;
  introEn: string;
};

const CITIES: Record<string, City> = {
  bruxelles: {
    slug: 'bruxelles',
    nameFr: 'Bruxelles',
    nameEn: 'Brussels',
    region: 'Brussels-Capital Region, Belgium',
    introFr:
      "À Bruxelles, entre bilinguisme et densité d'entreprises, chaque appel manqué part chez un concurrent en quelques secondes. Qwillio décroche à votre place, en français et en anglais, 24 heures sur 24.",
    introEn:
      'In Brussels, between bilingualism and business density, every missed call goes to a competitor within seconds. Qwillio answers for you, in French and English, 24 hours a day.',
  },
  namur: {
    slug: 'namur',
    nameFr: 'Namur',
    nameEn: 'Namur',
    region: 'Wallonia, Belgium',
    introFr:
      "À Namur, les PME et artisans wallons perdent des clients faute de pouvoir décrocher en intervention. Qwillio prend vos appels et vos rendez-vous pendant que vous travaillez.",
    introEn:
      'In Namur, Walloon SMBs and tradespeople lose customers because they cannot answer while on a job. Qwillio takes your calls and bookings while you work.',
  },
  liege: {
    slug: 'liege',
    nameFr: 'Liège',
    nameEn: 'Liège',
    region: 'Wallonia, Belgium',
    introFr:
      "À Liège, garages, cabinets et commerces de proximité manquent un quart de leurs appels. Qwillio répond, qualifie et pose les rendez-vous dans votre agenda, sans embaucher.",
    introEn:
      'In Liège, garages, practices and local shops miss a quarter of their calls. Qwillio answers, qualifies and books appointments into your calendar, without hiring.',
  },
  anvers: {
    slug: 'anvers',
    nameFr: 'Anvers',
    nameEn: 'Antwerp',
    region: 'Flanders, Belgium',
    introFr:
      "À Anvers, la réceptionniste IA de Qwillio répond en français, en anglais et gère vos rendez-vous 24/7, pour une fraction du coût d'un secrétariat.",
    introEn:
      'In Antwerp, Qwillio\'s AI receptionist answers in French and English and handles your bookings 24/7, at a fraction of the cost of a front desk.',
  },
};

export default function City() {
  const { ville } = useParams<{ ville: string }>();
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const city = ville ? CITIES[ville] : undefined;

  useSEO({
    title: city
      ? isFr
        ? `Réceptionniste IA à ${city.nameFr} · Qwillio`
        : `AI receptionist in ${city.nameEn} · Qwillio`
      : 'Qwillio',
    description: city ? (isFr ? city.introFr : city.introEn) : '',
    canonical: city ? `https://qwillio.com/ville/${city.slug}` : undefined,
  });

  // LocalBusiness / Service JSON-LD with areaServed for local SEO.
  useEffect(() => {
    if (!city) return;
    const id = 'qwillio-city-jsonld';
    document.getElementById(id)?.remove();
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: isFr ? 'Réceptionniste IA' : 'AI receptionist',
      provider: {
        '@type': 'Organization',
        name: 'Qwillio',
        url: 'https://qwillio.com',
      },
      areaServed: { '@type': 'City', name: city.nameEn, address: { '@type': 'PostalAddress', addressRegion: city.region, addressCountry: 'BE' } },
      url: `https://qwillio.com/ville/${city.slug}`,
      inLanguage: isFr ? 'fr' : 'en',
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [city, isFr]);

  if (!city) return <Navigate to="/" replace />;

  const name = isFr ? city.nameFr : city.nameEn;
  const benefits = isFr
    ? [
        { icon: Phone, title: '24/7, bilingue', body: 'Décroche en français et en anglais, jour et nuit, sans jamais mettre en attente.' },
        { icon: CalendarDays, title: 'RDV dans votre agenda', body: 'Prend les rendez-vous, sync Google Calendar, envoie la confirmation par SMS.' },
        { icon: ShieldCheck, title: 'RGPD, hébergement UE', body: 'Données en Europe, anti-spam inclus, consentement demandé au décrochage.' },
      ]
    : [
        { icon: Phone, title: '24/7, bilingual', body: 'Answers in French and English, day and night, never puts callers on hold.' },
        { icon: CalendarDays, title: 'Booking in your calendar', body: 'Takes appointments, syncs Google Calendar, texts the confirmation.' },
        { icon: ShieldCheck, title: 'GDPR, EU hosting', body: 'Data in Europe, spam shield included, consent asked at pickup.' },
      ];

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <PublicNavbar />

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-24 sm:pt-32">
        <Reveal>
          <span className="inline-block rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium tracking-wide text-indigo-700">
            {name}
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-4 max-w-3xl font-outfit text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {isFr ? `La réceptionniste IA pour les entreprises de ${name}` : `The AI receptionist for businesses in ${name}`}
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-neutral-600">
            {isFr ? city.introFr : city.introEn}
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
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 active:scale-[0.97]"
            >
              {isFr ? 'Voir les tarifs' : 'See pricing'}
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={0.05 + i * 0.05}>
              <Card3D>
                <div className="h-full rounded-2xl border border-neutral-200 bg-white p-6">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <b.icon className="h-4 w-4" />
                  </div>
                  <h2 className="font-outfit text-lg font-semibold">{b.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{b.body}</p>
                </div>
              </Card3D>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <Reveal>
          <h2 className="font-outfit text-2xl font-semibold tracking-tight sm:text-3xl">
            {isFr ? `Les secteurs qu'on couvre à ${name}` : `Industries we cover in ${name}`}
          </h2>
        </Reveal>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {['plombier', 'dentiste', 'garagiste', 'kine', 'avocat', 'restaurant', 'immobilier', 'coiffeur', 'notaire'].map((s) => (
            <li key={s}>
              <Link
                to={`/${s}`}
                className="flex items-center gap-2 text-sm text-neutral-700 transition-colors hover:text-indigo-600"
              >
                <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                <span className="capitalize">{s}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-8">
        <Reveal>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-8 sm:p-12">
            <h2 className="font-outfit text-3xl font-semibold tracking-tight sm:text-4xl">
              {isFr ? `Testez Qwillio à ${name}` : `Try Qwillio in ${name}`}
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-600">
              {isFr ? 'Premier mois offert, sans carte. 15 minutes de setup.' : 'First month free, no card. 15 minutes to set up.'}
            </p>
            <div className="mt-6">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 active:scale-[0.97]"
              >
                {isFr ? 'Créer un compte' : 'Create an account'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}
