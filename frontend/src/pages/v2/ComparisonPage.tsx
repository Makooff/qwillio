import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';
import { getComparisonBySlug, type ComparisonBlock } from '../../content/comparisons';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, Lead } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';

/* Comparatif V2. Table sémantique hairline (pas de boîte ombrée), verdicts en
   asides sur bande taupe. Data content/comparisons.ts et redirection slug
   inconnu vers /pricing conservées telles quelles. */

function renderCell(text: string) {
  if (text === 'Yes' || text === 'Oui') {
    return (
      <span className="inline-flex items-center gap-1.5 text-q2-ink font-medium">
        <Check size={14} aria-hidden="true" className="text-q2-indigo" /> {text}
      </span>
    );
  }
  if (text === 'No' || text === 'Non') {
    return (
      <span className="inline-flex items-center gap-1.5 text-q2-body">
        <X size={14} aria-hidden="true" /> {text}
      </span>
    );
  }
  return text;
}

const VERDICT_TONE: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'text-q2-indigo',
  bad: 'text-q2-graphite',
  neutral: 'text-q2-body',
};

export default function ComparisonPage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const page = slug ? getComparisonBySlug(slug) : undefined;

  useSEO({
    title: page ? (isFr ? page.title.fr : page.title.en) : (isFr ? 'Comparaison introuvable' : 'Comparison not found'),
    description: page ? (isFr ? page.subtitle.fr : page.subtitle.en) : undefined,
    canonical: page ? `https://qwillio.com/vs/${page.slug}` : 'https://qwillio.com/pricing',
    noindex: !page,
  });

  if (!page) {
    return <Navigate to="/pricing" replace />;
  }

  const body: ComparisonBlock[] = isFr ? page.content.fr : page.content.en;
  const updated = new Date(page.updated).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <PublicShell>
      <Section className="!pt-14 md:!pt-20 !pb-0">
        <Container>
          <div className="max-w-[760px]">
            <RevealV2 y={12}>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 text-sm text-q2-body hover:text-q2-ink transition-colors duration-150 mb-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-full"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                {isFr ? 'Retour aux tarifs' : 'Back to pricing'}
              </Link>
            </RevealV2>

            <RevealV2 index={1}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-7">
                <Eyebrow tone="indigo">
                  {isFr ? 'Comparatif' : 'Comparison'} · Qwillio vs {page.competitor}
                </Eyebrow>
                <span className="text-q2-plate" aria-hidden="true">·</span>
                <span className="text-xs text-q2-body">
                  {isFr ? 'Mis à jour le' : 'Updated'} {updated}
                </span>
              </div>
            </RevealV2>

            <RevealV2 index={2}>
              <Display className="!text-[clamp(2.2rem,5vw,3.6rem)]">
                {isFr ? page.title.fr : page.title.en}
              </Display>
            </RevealV2>

            <RevealV2 index={3}>
              <Lead className="mt-7 q2-body-text">{isFr ? page.subtitle.fr : page.subtitle.en}</Lead>
            </RevealV2>
          </div>
        </Container>
      </Section>

      <Section className="!pt-14 md:!pt-16">
        <Container>
          <article className="max-w-[820px]">
            {body.map((block, i) => {
              if (block.type === 'h2') {
                return (
                  <RevealV2 key={i} y={16}>
                    <h2 className="q2-h2 !text-[clamp(1.5rem,2.6vw,2rem)] text-q2-ink mt-14 mb-4 pt-8 border-t border-q2-plate first:mt-0 first:pt-0 first:border-0">
                      {block.text}
                    </h2>
                  </RevealV2>
                );
              }

              if (block.type === 'ul') {
                return (
                  <RevealV2 key={i} y={14}>
                    <ul className="my-6 space-y-3" role="list">
                      {block.items.map((it, j) => (
                        <li
                          key={j}
                          className="text-[18px] leading-[1.7] text-q2-body q2-body-text pl-5 relative before:absolute before:left-0 before:top-[0.7em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-q2-indigo"
                        >
                          {it}
                        </li>
                      ))}
                    </ul>
                  </RevealV2>
                );
              }

              if (block.type === 'table') {
                return (
                  <RevealV2 key={i} y={16}>
                    <figure className="my-10">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[14px] q2-body-text">
                          <thead>
                            <tr>
                              {block.head.map((h, j) => (
                                <th
                                  key={j}
                                  scope="col"
                                  className="text-left px-4 py-3 font-medium text-q2-graphite border-y border-q2-plate bg-q2-band whitespace-nowrap first:rounded-l-[12px] last:rounded-r-[12px]"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.map((row, j) => (
                              <tr key={j}>
                                {row.map((cell, k) => (
                                  <td
                                    key={k}
                                    className={`px-4 py-3.5 align-top border-b border-q2-plate ${k === 0 ? 'font-medium text-q2-ink' : 'text-q2-body'}`}
                                  >
                                    {renderCell(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {block.caption && (
                        <figcaption className="text-xs text-q2-body mt-3">{block.caption}</figcaption>
                      )}
                    </figure>
                  </RevealV2>
                );
              }

              if (block.type === 'verdict') {
                return (
                  <RevealV2 key={i} y={16}>
                    <aside role="note" className="my-10 rounded-[20px] bg-q2-band p-7 md:p-8">
                      <p className={`q2-eyebrow mb-3 ${VERDICT_TONE[block.tone]}`}>{block.title}</p>
                      <p className="text-[17px] leading-[1.6] text-q2-ink q2-body-text max-w-[620px]">
                        {block.text}
                      </p>
                    </aside>
                  </RevealV2>
                );
              }

              return (
                <RevealV2 key={i} y={12}>
                  <p className="text-[18px] leading-[1.7] text-q2-body q2-body-text my-6">{block.text}</p>
                </RevealV2>
              );
            })}
          </article>
        </Container>
      </Section>

      <Section variant="drenched-indigo" aria-label={isFr ? 'Essayer Qwillio' : 'Try Qwillio'}>
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
          <RevealV2>
            <h2 className="q2-h2 text-white max-w-[640px]">
              {isFr ? 'Testez Qwillio en 15 minutes.' : 'Try Qwillio in 15 minutes.'}
            </h2>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-1">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[340px] lg:text-right q2-body-text">
              {isFr
                ? '7 jours d’essai gratuit. Sans engagement. Comparez par vous-même sur vos vrais appels.'
                : '7-day free trial. No commitment. Compare on your own real calls.'}
            </p>
            <PillLink to="/register" variant="chromatic" size="lg">
              {isFr ? 'Créer un compte' : 'Create account'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
