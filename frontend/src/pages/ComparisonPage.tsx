import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X, Calendar } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';
import { getComparisonBySlug, type ComparisonBlock } from '../content/comparisons';

function renderCell(text: string) {
  if (text === 'Yes' || text === 'Oui') {
    return (
      <span className="inline-flex items-center gap-1 text-[#059669]">
        <Check size={14} aria-hidden="true" /> {text}
      </span>
    );
  }
  if (text === 'No' || text === 'Non') {
    return (
      <span className="inline-flex items-center gap-1 text-[#dc2626]">
        <X size={14} aria-hidden="true" /> {text}
      </span>
    );
  }
  return text;
}

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
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main aria-labelledby="comparison-heading">
        <header className="pt-32 md:pt-40 pb-10 px-6">
          <div className="max-w-[820px] mx-auto">
            <Reveal y={12}>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#6366f1] mb-8 transition-colors active:scale-[0.97]"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                {isFr ? 'Retour aux tarifs' : 'Back to pricing'}
              </Link>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}
                >
                  {isFr ? 'Comparatif' : 'Comparison'} · Qwillio vs {page.competitor}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#6e6e73]">
                  <Calendar size={12} aria-hidden="true" /> {isFr ? 'Mis à jour le' : 'Updated'} {updated}
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <h1
                id="comparison-heading"
                className="text-[clamp(2.2rem,5vw,3.6rem)] font-semibold tracking-[-0.03em] leading-[1.05]"
              >
                {isFr ? page.title.fr : page.title.en}
              </h1>
            </Reveal>

            <Reveal delay={0.18}>
              <p className="mt-6 text-lg text-[#525257] leading-relaxed max-w-[680px]">
                {isFr ? page.subtitle.fr : page.subtitle.en}
              </p>
            </Reveal>
          </div>
        </header>

        <article className="px-6 pb-20">
          <div className="max-w-[820px] mx-auto space-y-6">
            {body.map((block, i) => {
              if (block.type === 'h2') {
                return (
                  <Reveal key={i} y={16} delay={0.04}>
                    <h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.02em] mt-10 mb-1 text-[#1d1d1f]">
                      {block.text}
                    </h2>
                  </Reveal>
                );
              }
              if (block.type === 'ul') {
                return (
                  <Reveal key={i} y={14} delay={0.04}>
                    <ul className="list-disc pl-6 space-y-2 text-[#424245]" role="list">
                      {block.items.map((it, j) => (
                        <li key={j} className="text-[16px] leading-relaxed">{it}</li>
                      ))}
                    </ul>
                  </Reveal>
                );
              }
              if (block.type === 'table') {
                return (
                  <Reveal key={i} y={16} delay={0.04}>
                    <figure className="my-4">
                      <div className="overflow-x-auto rounded-2xl border border-[#1d1d1f]/10 shadow-[0_1px_0_rgba(29,29,31,0.03)]">
                        <table className="w-full text-[13.5px] border-collapse">
                          <thead className="bg-[#fafaf8]">
                            <tr>
                              {block.head.map((h, j) => (
                                <th
                                  key={j}
                                  scope="col"
                                  className="text-left px-4 py-3 font-semibold text-[#1d1d1f] border-b border-[#1d1d1f]/10 whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1d1d1f]/8">
                            {block.rows.map((row, j) => (
                              <tr key={j} className="hover:bg-[#fafaf8] transition-colors">
                                {row.map((cell, k) => (
                                  <td
                                    key={k}
                                    className={`px-4 py-2.5 align-top ${k === 0 ? 'font-medium text-[#1d1d1f]' : 'text-[#424245]'}`}
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
                        <figcaption className="text-xs text-[#6e6e73] mt-2 italic">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  </Reveal>
                );
              }
              if (block.type === 'verdict') {
                const bg = block.tone === 'good'
                  ? 'rgba(6,95,70,0.06)'
                  : block.tone === 'bad'
                    ? 'rgba(220,38,38,0.06)'
                    : 'rgba(99,102,241,0.06)';
                const border = block.tone === 'good'
                  ? '#059669'
                  : block.tone === 'bad'
                    ? '#dc2626'
                    : '#6366f1';
                return (
                  <Reveal key={i} y={16} delay={0.06}>
                    <aside
                      role="note"
                      className="rounded-2xl p-5 my-4 border"
                      style={{ background: bg, borderColor: border }}
                    >
                      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: border }}>
                        {block.title}
                      </p>
                      <p className="text-[15px] leading-relaxed text-[#1d1d1f]">
                        {block.text}
                      </p>
                    </aside>
                  </Reveal>
                );
              }
              return (
                <Reveal key={i} y={12}>
                  <p className="text-[17px] leading-[1.75] text-[#424245]">{block.text}</p>
                </Reveal>
              );
            })}
          </div>
        </article>

        <section
          aria-label={isFr ? 'Essayer Qwillio' : 'Try Qwillio'}
          className="px-6 pb-24 md:pb-32"
        >
          <div className="max-w-[820px] mx-auto">
            <Reveal>
              <Card3D intensity={3}>
                <div
                  className="rounded-3xl p-8 md:p-10 text-white overflow-hidden relative"
                  style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #6366f1 115%)' }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-30 blur-3xl"
                    style={{ background: '#a855f7' }}
                  />
                  <h3 className="relative text-[clamp(1.4rem,2.4vw,2rem)] font-semibold tracking-[-0.02em] mb-3">
                    {isFr ? 'Testez Qwillio en 15 minutes.' : 'Try Qwillio in 15 minutes.'}
                  </h3>
                  <p className="relative text-white/75 text-[15px] leading-relaxed mb-6 max-w-[540px]">
                    {isFr
                      ? 'Premier mois offert. Sans carte, sans engagement. Comparez par vous-même sur vos vrais appels.'
                      : 'First month free. No card, no commitment. Compare on your own real calls.'}
                  </p>
                  <Link
                    to="/register"
                    className="relative inline-flex items-center gap-2 bg-white text-[#1d1d1f] text-sm font-medium px-5 py-3 rounded-full hover:bg-[#a5b4fc] transition-colors active:scale-[0.97]"
                  >
                    {isFr ? 'Créer un compte' : 'Create account'}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </Card3D>
            </Reveal>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
