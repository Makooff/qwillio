import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Compass, Zap } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';

export default function About() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr ? 'À propos · Qwillio' : 'About · Qwillio',
    description: isFr
      ? 'La mission, la vision et l\'histoire de Qwillio, plateforme de réceptionniste IA basée à Bruxelles.'
      : 'Qwillio mission, vision and story — AI receptionist platform headquartered in Brussels.',
    canonical: 'https://qwillio.com/about',
  });

  // JSON-LD Organization + Person schema (E-E-A-T)
  useEffect(() => {
    const id = 'qwillio-about-jsonld';
    document.getElementById(id)?.remove();
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'AboutPage',
          '@id': 'https://qwillio.com/about#page',
          url: 'https://qwillio.com/about',
          name: 'About Qwillio',
          description: 'Qwillio is an AI receptionist platform founded in 2025, headquartered in Brussels, Belgium. Serving small and medium businesses across Belgium, France, and North America.',
          inLanguage: ['en', 'fr'],
          isPartOf: { '@id': 'https://qwillio.com#website' },
        },
        {
          '@type': 'Organization',
          '@id': 'https://qwillio.com#organization',
          name: 'Qwillio',
          url: 'https://qwillio.com',
          foundingDate: '2025',
          foundingLocation: { '@type': 'Place', name: 'Brussels, Belgium' },
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Brussels',
            addressCountry: 'BE',
          },
          knowsLanguage: ['en', 'fr'],
        },
      ],
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  const values = [
    {
      num: '01',
      accent: '#6366f1',
      icon: Heart,
      title: isFr ? 'Humain d\'abord' : 'Human first',
      desc: isFr
        ? 'L\'IA est là pour libérer du temps, pas pour remplacer la relation. Chaque appel garde la chaleur d\'un échange réel.'
        : 'AI is here to free your time, not replace human connection. Every call keeps the warmth of a real conversation.',
    },
    {
      num: '02',
      accent: '#a855f7',
      icon: Compass,
      title: isFr ? 'Honnêteté radicale' : 'Radical honesty',
      desc: isFr
        ? 'Pas de fausses promesses. Pas de jargon. On dit ce que l\'IA fait, ce qu\'elle ne fait pas, et combien ça coûte.'
        : 'No false promises. No jargon. We say what the AI does, what it doesn\'t, and what it costs.',
    },
    {
      num: '03',
      accent: '#6366f1',
      icon: Zap,
      title: isFr ? 'Construit pour scale' : 'Built to scale',
      desc: isFr
        ? 'De 800 à 40 000 appels par mois sans changer d\'outil. La plateforme grandit avec votre entreprise.'
        : 'From 800 to 40,000 calls a month without switching tools. The platform grows with your business.',
    },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main id="main">
        {/* ── HERO ──────────────────────────────────────────────── */}
        <section
          aria-labelledby="about-heading"
          className="pt-24 sm:pt-28 md:pt-36 pb-16 md:pb-24 px-5 sm:px-6"
        >
          <div className="max-w-[1240px] mx-auto">
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-4" style={{ color: '#6366f1' }}>
              {isFr ? 'À propos' : 'About'}
            </span>
            <h1
              id="about-heading"
              className="text-[clamp(2.6rem,6.5vw,5.6rem)] font-semibold tracking-[-0.04em] leading-[0.95] max-w-[1000px]"
            >
              {isFr ? (
                <>
                  Nous bâtissons{' '}
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>l'IA</span>{' '}
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>qui décroche.</span>
                </>
              ) : (
                <>
                  Building the{' '}
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>AI</span>{' '}
                  <span className="font-serif italic" style={{ color: '#a855f7' }}>that picks up.</span>
                </>
              )}
            </h1>
          </div>
        </section>

        {/* ── ORIGIN STORY ─────────────────────────────────────── */}
        <section
          aria-labelledby="story-heading"
          className="px-6 pb-20 md:pb-28"
        >
          <div className="max-w-[820px] mx-auto">
            <h2 id="story-heading" className="sr-only">
              {isFr ? 'Notre histoire' : 'Our story'}
            </h2>
            <div className="space-y-6 text-[#424245] text-lg leading-[1.7]">
              <p>
                {isFr
                  ? 'Qwillio est né d\'une observation simple : les petites et moyennes entreprises perdent jusqu\'à 35% de leurs appels entrants par manque de personnel. Chaque appel manqué est un client qui va chez le concurrent.'
                  : 'Qwillio started from a simple observation: small and mid-sized businesses miss up to 35% of inbound calls due to lack of staff. Every missed call is a customer going to a competitor.'}
              </p>
              <p>
                {isFr
                  ? 'Les solutions existantes coûtaient trop cher (réceptionnistes humains à 38 000 $/an) ou étaient trop primitives (répondeurs sans intelligence). Personne ne proposait l\'évidence : une IA vocale capable de tenir une vraie conversation, prendre un rendez-vous, et qualifier un lead.'
                  : 'Existing solutions were either too expensive (human receptionists at $38,000/year) or too primitive (dumb voicemail). Nobody offered the obvious: a voice AI that could hold a real conversation, book an appointment, and qualify a lead.'}
              </p>
              <blockquote
                className="border-l-0 pl-0 my-10"
                style={{ borderTop: '2px solid #6366f1', paddingTop: '1.5rem' }}
              >
                <p className="text-[clamp(1.4rem,2.8vw,2rem)] font-semibold tracking-[-0.025em] leading-[1.25] text-[#1d1d1f]">
                  {isFr
                    ? <>« Si un humain peut le faire au téléphone, <span className="font-serif italic" style={{ color: '#6366f1' }}>l'IA le fera mieux, plus vite, et 24/7.</span> »</>
                    : <>"If a human can do it on the phone, <span className="font-serif italic" style={{ color: '#6366f1' }}>AI will do it better, faster, and 24/7.</span>"</>}
                </p>
              </blockquote>
              <p>
                {isFr
                  ? 'Aujourd\'hui Qwillio traite des millions d\'appels par mois pour des cliniques, garages, salons, restaurants et cabinets d\'avocats. Notre engagement reste le même : un outil qui marche, sans engagement, sans surprise.'
                  : 'Today Qwillio handles millions of calls per month for clinics, garages, salons, restaurants and law firms. Our commitment stays the same: a tool that works, no lock-in, no surprises.'}
              </p>
            </div>
          </div>
        </section>

        {/* ── VALUES — numbered editorial ─────────────────────── */}
        <section
          aria-labelledby="values-heading"
          className="py-14 sm:py-18 md:py-28 px-6 border-t border-[#1d1d1f]/8 bg-[#fafaf8]"
        >
          <div className="max-w-[1240px] mx-auto">
            <h2
              id="values-heading"
              className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-12 max-w-[640px]"
            >
              {isFr
                ? <>Trois valeurs. <span className="text-[#86868b] font-normal">Qui guident chaque décision.</span></>
                : <>Three values. <span className="text-[#86868b] font-normal">Guiding every decision.</span></>}
            </h2>

            <ol className="grid md:grid-cols-3 gap-8 md:gap-12" role="list">
              {values.map((v) => (
                <li key={v.num} className="border-t-2 pt-5" style={{ borderColor: v.accent }}>
                  <p className="text-[11px] font-bold tracking-[0.2em] mb-3" style={{ color: v.accent }}>
                    {v.num}
                  </p>
                  <div className="flex items-center gap-3 mb-3">
                    <v.icon size={20} style={{ color: v.accent }} aria-hidden="true" />
                    <h3 className="text-xl font-semibold tracking-[-0.015em]">{v.title}</h3>
                  </div>
                  <p className="text-[#525257] leading-relaxed text-[15px]">{v.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── FOUNDER NOTE ─────────────────────────────────────── */}
        <section
          aria-labelledby="founder-heading"
          className="py-14 sm:py-18 md:py-28 px-6"
        >
          <div className="max-w-[820px] mx-auto">
            <h2
              id="founder-heading"
              className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-6"
              style={{ color: '#a855f7' }}
            >
              {isFr ? 'Mot du fondateur' : 'Founder note'}
            </h2>
            <div className="text-[#424245] text-lg leading-[1.7] space-y-5">
              <p>
                {isFr
                  ? 'On a démarré Qwillio à trois personnes dans un bureau de Bruxelles. Aujourd\'hui on est une petite équipe distribuée entre Bruxelles, Paris et Montréal qui partage la même obsession : que chaque appel téléphonique trouve toujours quelqu\'un au bout du fil.'
                  : 'We started Qwillio with three people in a Brussels office. Today we are a small team distributed across Brussels, Paris and Montreal, sharing the same obsession: every phone call always finding someone on the other end.'}
              </p>
              <p>
                {isFr
                  ? 'Si vous voulez nous écrire, l\'adresse de contact arrive directement dans ma boîte. Bienvenue.'
                  : 'If you want to write to us, the contact address lands straight in my inbox. Welcome.'}
              </p>
              <p className="text-sm text-[#86868b] not-italic">
                Mathieu P., {isFr ? 'fondateur' : 'founder'}
              </p>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────── */}
        <section className="py-14 sm:py-18 md:py-28 px-6">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end border-t-2 border-[#1d1d1f] pt-12 md:pt-16">
            <h2 className="text-[clamp(2rem,4.5vw,3.6rem)] font-semibold tracking-[-0.035em] leading-[1.02]">
              {isFr ? (
                <>Une question ? <span className="font-serif italic" style={{ color: '#6366f1' }}>Parlons.</span></>
              ) : (
                <>A question? <span className="font-serif italic" style={{ color: '#6366f1' }}>Let's talk.</span></>
              )}
            </h2>
            <div className="flex flex-col items-start gap-3 lg:items-end pb-4">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#6366f1] transition-colors"
              >
                {isFr ? 'Nous contacter' : 'Contact us'}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
