import { useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowRight, Phone, CalendarDays, ShieldCheck } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import LogoOrbs from '../../components/v2/LogoOrbs';

/* Page ville V2. Le JSON-LD LocalBusiness, le param :ville et la copie FR/EN
   sont ceux de la V1. La grille de trois cards identiques devient une liste
   éditoriale hairline, les secteurs deviennent des pilules navigables. */

const SECTOR_SLUGS = ['plombier', 'dentiste', 'garagiste', 'kine', 'avocat', 'restaurant', 'immobilier', 'coiffeur', 'notaire'];

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
    <PublicShell>
      <Section aria-label={name} className="!pt-16 md:!pt-24 overflow-hidden">
        <Container className="grid lg:grid-cols-[1.25fr_1fr] gap-14 lg:gap-20 items-center">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-6">
              {name}
            </Eyebrow>
            <Display className="mb-7">
              {isFr ? (
                <>
                  La réceptionniste IA pour les entreprises de <SerifWord>{name}.</SerifWord>
                </>
              ) : (
                <>
                  The AI receptionist for businesses in <SerifWord>{name}.</SerifWord>
                </>
              )}
            </Display>
            <Lead className="max-w-[520px] mb-10 q2-body-text">
              {isFr ? city.introFr : city.introEn}
            </Lead>
            <div className="flex flex-wrap items-center gap-3">
              <PillLink to="/register" variant="primary" size="lg">
                {isFr ? 'Créer un compte' : 'Create an account'}
                <ArrowRight size={15} aria-hidden="true" />
              </PillLink>
              <PillLink to="/pricing" variant="outline" size="lg">
                {isFr ? 'Voir les tarifs' : 'See pricing'}
              </PillLink>
            </div>
          </RevealV2>

          <RevealV2 index={2} className="hidden lg:block">
            <LogoOrbs className="max-w-[380px] mx-auto" />
          </RevealV2>
        </Container>
      </Section>

      <Section variant="band" hairline aria-label={isFr ? 'Ce que Qwillio fait' : 'What Qwillio does'}>
        <Container>
          <ol className="border-t border-q2-plate" role="list">
            {benefits.map((b, i) => (
              <RevealV2 key={b.title} index={i} as="li" className="border-b border-q2-plate">
                <div className="grid md:grid-cols-[64px_1fr_1.2fr] gap-4 md:gap-10 py-9 md:py-11 items-start">
                  <span className="w-12 h-12 rounded-full bg-q2-canvas flex items-center justify-center">
                    <b.icon className="h-4 w-4 text-q2-indigo" aria-hidden="true" />
                  </span>
                  <h2 className="q2-h3 text-q2-ink md:pt-2">{b.title}</h2>
                  <p className="text-[15px] leading-relaxed text-q2-body max-w-[440px] q2-body-text md:pt-3">
                    {b.body}
                  </p>
                </div>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      <Section>
        <Container className="grid lg:grid-cols-[1fr_1.4fr] gap-12 items-start">
          <RevealV2>
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Secteurs' : 'Industries'}
            </Eyebrow>
            <H2>
              {isFr ? `Les secteurs qu'on couvre à ${name}` : `Industries we cover in ${name}`}
            </H2>
          </RevealV2>
          <RevealV2 index={1}>
            <nav aria-label={isFr ? 'Secteurs' : 'Industries'} className="flex flex-wrap gap-3 lg:pt-10">
              {SECTOR_SLUGS.map((s) => (
                <Link
                  key={s}
                  to={`/${s}`}
                  className="inline-flex items-center rounded-full border border-q2-plate bg-q2-canvas px-5 py-2.5 text-sm font-medium capitalize text-q2-ink hover:border-q2-indigo hover:text-q2-indigo transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
                >
                  {s}
                </Link>
              ))}
            </nav>
          </RevealV2>
        </Container>
      </Section>

      <Section variant="drenched-indigo" aria-label={isFr ? `Testez Qwillio à ${name}` : `Try Qwillio in ${name}`}>
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
          <RevealV2>
            <h2 className="q2-h2 text-white max-w-[640px]">
              {isFr ? `Testez Qwillio à ${name}` : `Try Qwillio in ${name}`}
            </h2>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-1">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[300px] lg:text-right q2-body-text">
              {isFr ? '7 jours d\u2019essai gratuit. 15 minutes de setup.' : '7-day free trial. 15 minutes to set up.'}
            </p>
            <PillLink to="/register" variant="chromatic" size="lg">
              {isFr ? 'Créer un compte' : 'Create an account'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
