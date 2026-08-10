import { useEffect } from 'react';
import { ArrowRight, Heart, Compass, Zap, type LucideIcon } from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import ShapeDrift from '../../components/v2/motion/ShapeDrift';

/* About V2 « Papier & Signal », voir DA/v2-direction.md.
   Copie FR/EN, useSEO et JSON-LD portés de la V1 (pages/legal/About.tsx). */

interface Value {
  num: string;
  icon: LucideIcon;
  tone: 'indigo' | 'violet';
  title: string;
  desc: string;
}

export default function About() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr ? 'À propos · Qwillio' : 'About · Qwillio',
    description: isFr
      ? 'La mission, la vision et l\'histoire de Qwillio, plateforme de réceptionniste IA basée à Bruxelles.'
      : 'Qwillio mission, vision and story: AI receptionist platform headquartered in Brussels.',
    canonical: 'https://qwillio.com/about',
  });

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

  const values: Value[] = [
    {
      num: '01',
      tone: 'indigo',
      icon: Heart,
      title: isFr ? 'Humain d\'abord' : 'Human first',
      desc: isFr
        ? 'L\'IA est là pour libérer du temps, pas pour remplacer la relation. Chaque appel garde la chaleur d\'un échange réel.'
        : 'AI is here to free your time, not replace human connection. Every call keeps the warmth of a real conversation.',
    },
    {
      num: '02',
      tone: 'violet',
      icon: Compass,
      title: isFr ? 'Honnêteté radicale' : 'Radical honesty',
      desc: isFr
        ? 'Pas de fausses promesses. Pas de jargon. On dit ce que l\'IA fait, ce qu\'elle ne fait pas, et combien ça coûte.'
        : 'No false promises. No jargon. We say what the AI does, what it doesn\'t, and what it costs.',
    },
    {
      num: '03',
      tone: 'indigo',
      icon: Zap,
      title: isFr ? 'Construit pour scale' : 'Built to scale',
      desc: isFr
        ? 'De 800 à 40 000 appels par mois sans changer d\'outil. La plateforme grandit avec votre entreprise.'
        : 'From 800 to 40,000 calls a month without switching tools. The platform grows with your business.',
    },
  ];

  return (
    <PublicShell>
      {/* HERO: titre whisper à gauche, description à droite */}
      <Section aria-label={isFr ? 'À propos de Qwillio' : 'About Qwillio'} className="!pt-16 md:!pt-24">
        <Container className="grid lg:grid-cols-[1.45fr_1fr] gap-10 lg:gap-16 items-end">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-6">
              {isFr ? 'À propos' : 'About'}
            </Eyebrow>
            <Display>
              {isFr ? (
                <>
                  Nous bâtissons l'IA <SerifWord>qui décroche.</SerifWord>
                </>
              ) : (
                <>
                  Building the AI <SerifWord>that picks up.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1}>
            <Lead className="max-w-[460px] lg:pb-3 q2-body-text">
              {isFr
                ? "Construit et opéré depuis Bruxelles. Un outil qui répond vraiment au téléphone, pas une démo."
                : 'Built and run from Brussels. A tool that actually answers the phone, not a demo.'}
            </Lead>
          </RevealV2>
        </Container>
      </Section>

      {/* HISTOIRE: deux colonnes, intitulé à gauche, récit à droite */}
      <Section variant="band" hairline aria-labelledby="story-heading" className="relative">
        <ShapeDrift shapes={[{ kind: 'column', x: '88%', y: '18%', size: 150, drift: 90, opacity: 0.26 }]} />
        <Container className="grid lg:grid-cols-[1fr_1.5fr] gap-10 lg:gap-20 items-start">
          <RevealV2>
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Origine' : 'Origin'}
            </Eyebrow>
            <H2 id="story-heading" className="max-w-[380px]">
              {isFr ? 'Notre histoire.' : 'Our story.'}
            </H2>
          </RevealV2>

          <RevealV2 index={1}>
            <div className="space-y-6 text-q2-body text-[17px] leading-[1.7] max-w-[640px] q2-body-text">
              <p>
                {isFr
                  ? 'Qwillio est né d\'une observation simple : les petites et moyennes entreprises perdent jusqu\'à 35% de leurs appels entrants par manque de personnel. Chaque appel manqué est un client qui va chez le concurrent.'
                  : 'Qwillio started from a simple observation: small and mid-sized businesses miss up to 35% of inbound calls due to lack of staff. Every missed call is a customer going to a competitor.'}
              </p>
              <p>
                {isFr
                  ? 'Les solutions existantes coûtaient trop cher (réceptionnistes humains à 38 000 €/an) ou étaient trop primitives (répondeurs sans intelligence). Personne ne proposait l\'évidence : une IA vocale capable de tenir une vraie conversation, prendre un rendez-vous, et qualifier un lead.'
                  : 'Existing solutions were either too expensive (human receptionists at 38,000 EUR/year) or too primitive (dumb voicemail). Nobody offered the obvious: a voice AI that could hold a real conversation, book an appointment, and qualify a lead.'}
              </p>
              <p>
                {isFr
                  ? 'Qwillio répond aujourd\'hui aux appels de cliniques, garages, salons, restaurants et cabinets d\'avocats. Notre engagement reste le même : un outil qui marche, sans engagement, sans surprise.'
                  : 'Qwillio answers calls today for clinics, garages, salons, restaurants and law firms. Our commitment stays the same: a tool that works, no lock-in, no surprises.'}
              </p>
            </div>
          </RevealV2>
        </Container>
      </Section>

      {/* PRINCIPE FONDATEUR: drenched indigo, la citation reprise de la V1 */}
      <Section variant="drenched-indigo" aria-label={isFr ? 'Notre principe' : 'Our principle'}>
        <Container>
          <RevealV2>
            <Eyebrow tone="indigo" onDark className="mb-8">
              {isFr ? 'Le principe' : 'The principle'}
            </Eyebrow>
            <blockquote className="q2-h2 text-white max-w-[880px]">
              {isFr ? (
                <>
                  « Si un humain peut le faire au téléphone,{' '}
                  <SerifWord>l'IA le fera mieux, plus vite, et 24/7.</SerifWord> »
                </>
              ) : (
                <>
                  &ldquo;If a human can do it on the phone,{' '}
                  <SerifWord>AI will do it better, faster, and 24/7.</SerifWord>&rdquo;
                </>
              )}
            </blockquote>
          </RevealV2>
        </Container>
      </Section>

      {/* VALEURS: rangées hairline numérotées, jamais une grille de tuiles */}
      <Section aria-labelledby="values-heading">
        <Container>
          <RevealV2 className="mb-14">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Valeurs' : 'Values'}
            </Eyebrow>
            <H2 id="values-heading" className="max-w-[700px]">
              {isFr ? (
                <>
                  Trois valeurs. <span className="text-q2-body">Qui guident chaque décision.</span>
                </>
              ) : (
                <>
                  Three values. <span className="text-q2-body">Guiding every decision.</span>
                </>
              )}
            </H2>
          </RevealV2>

          <ol className="border-t border-q2-plate" role="list">
            {values.map((v, i) => (
              <RevealV2 key={v.num} index={i} as="li" className="border-b border-q2-plate">
                <div className="grid md:grid-cols-[110px_1fr_1.4fr] gap-4 md:gap-10 py-10 md:py-12 items-start">
                  <p className="q2-price text-q2-plate select-none tabular-nums" aria-hidden="true">
                    {v.num}
                  </p>
                  <div className="flex items-center gap-3 md:pt-1">
                    <v.icon
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 ${v.tone === 'indigo' ? 'text-q2-indigo' : 'text-q2-violet'}`}
                    />
                    <h3 className="q2-h3 text-q2-ink">{v.title}</h3>
                  </div>
                  <p className="text-q2-body text-[15px] leading-relaxed max-w-[480px] q2-body-text md:pt-1.5">
                    {v.desc}
                  </p>
                </div>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      {/* MOT DU FONDATEUR: bande taupe, prose éditoriale */}
      <Section variant="band" hairline aria-labelledby="founder-heading" className="relative">
        <ShapeDrift shapes={[{ kind: 'disc', x: '-10%', y: '30%', size: 260, drift: -90, opacity: 0.24 }]} />
        <Container className="grid lg:grid-cols-[1fr_1.5fr] gap-10 lg:gap-20 items-start">
          <RevealV2>
            <Eyebrow tone="violet" className="mb-4">
              {isFr ? 'Mot du fondateur' : 'Founder note'}
            </Eyebrow>
            <H2 id="founder-heading" className="max-w-[320px]">
              Mathieu&nbsp;P.
            </H2>
            <p className="text-q2-body text-sm mt-3">{isFr ? 'Fondateur, Bruxelles' : 'Founder, Brussels'}</p>
          </RevealV2>

          <RevealV2 index={1}>
            <div className="space-y-5 text-q2-body text-[17px] leading-[1.7] max-w-[640px] q2-body-text">
              <p>
                {isFr
                  ? "J'ai démarré Qwillio seul, depuis Bruxelles, avec une obsession simple : que chaque appel téléphonique trouve toujours quelqu'un au bout du fil. On est en tout début de lancement, et j'accompagne personnellement chaque nouveau client, du premier appel jusqu'au support au quotidien."
                  : "I started Qwillio alone, from Brussels, with one simple obsession: every phone call should always find someone on the other end. We are very early in launch, and I personally support every new customer, from the first call onward."}
              </p>
              <p>
                {isFr
                  ? 'Si vous voulez nous écrire, l\'adresse de contact arrive directement dans ma boîte. Bienvenue.'
                  : 'If you want to write to us, the contact address lands straight in my inbox. Welcome.'}
              </p>
            </div>
          </RevealV2>
        </Container>
      </Section>

      {/* CTA FINAL: drenched, une seule action chromatique */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Nous contacter' : 'Contact us'}
        className="border-t border-q2-graphite-d"
      >
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
          <RevealV2>
            <Display as="h2" onDark>
              {isFr ? (
                <>
                  Une question&nbsp;? <SerifWord>Parlons.</SerifWord>
                </>
              ) : (
                <>
                  A question? <SerifWord>Let's talk.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-2">
            <PillLink to="/contact" variant="chromatic" size="lg">
              {isFr ? 'Nous contacter' : 'Contact us'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
