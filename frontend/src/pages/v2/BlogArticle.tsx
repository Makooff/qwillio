import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';
import { getArticleBySlug, type Block } from '../../content/blogArticles';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, Lead } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';

/* Article de blog V2. Mesure de lecture 680px, corps 18px, hairlines.
   Le rendu typé des blocs et la redirection slug inconnu vers /blog sont
   ceux de la V1, seule la peau change. */

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const article = slug ? getArticleBySlug(slug) : undefined;

  useSEO({
    title: article ? (isFr ? article.title.fr : article.title.en) : (isFr ? 'Article introuvable' : 'Article not found'),
    description: article ? (isFr ? article.excerpt.fr : article.excerpt.en) : undefined,
    canonical: article ? `https://qwillio.com/blog/${article.slug}` : 'https://qwillio.com/blog',
    noindex: !article,
  });

  if (!article) {
    return <Navigate to="/blog" replace />;
  }

  const body: Block[] = isFr ? article.content.fr : article.content.en;
  const dateStr = new Date(article.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <PublicShell>
      <Section className="!pt-14 md:!pt-20 !pb-0">
        <Container>
          <div className="max-w-[680px]">
            <RevealV2 y={12}>
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 text-sm text-q2-body hover:text-q2-ink transition-colors duration-150 mb-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-full"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                {isFr ? 'Retour au blog' : 'Back to blog'}
              </Link>
            </RevealV2>

            <RevealV2 index={1}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-7">
                <Eyebrow tone="indigo">{isFr ? article.tag.fr : article.tag.en}</Eyebrow>
                <span className="text-q2-plate" aria-hidden="true">·</span>
                <span className="text-xs text-q2-body">{dateStr}</span>
                <span className="text-q2-plate" aria-hidden="true">·</span>
                <span className="text-xs text-q2-body tabular-nums">{article.readTime}&nbsp;min</span>
              </div>
            </RevealV2>

            <RevealV2 index={2}>
              <Display className="!text-[clamp(2.2rem,5vw,3.6rem)]">
                {isFr ? article.title.fr : article.title.en}
              </Display>
            </RevealV2>

            <RevealV2 index={3}>
              <Lead className="mt-7 q2-body-text">{isFr ? article.excerpt.fr : article.excerpt.en}</Lead>
            </RevealV2>
          </div>
        </Container>
      </Section>

      <Section className="!pt-14 md:!pt-16">
        <Container>
          <article className="max-w-[680px]">
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
              return (
                <RevealV2 key={i} y={12}>
                  <p className="text-[18px] leading-[1.7] text-q2-body q2-body-text my-6">{block.text}</p>
                </RevealV2>
              );
            })}
          </article>
        </Container>
      </Section>

      {/* Une seule section drenched sur la page, une seule action chromatique */}
      <Section
        variant="drenched-indigo"
        aria-label={isFr ? 'Passer à l\'action' : 'Get started'}
      >
        <Container className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
          <RevealV2>
            <h2 className="q2-h2 text-white max-w-[640px]">
              {isFr ? 'Prêt à ne plus manquer un appel ?' : 'Ready to stop missing calls?'}
            </h2>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-1">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr
                ? 'Testez Qwillio gratuitement pendant 7 jours. Sans engagement, configuration en 15 minutes.'
                : 'Try Qwillio free for 7 days. No commitment, set up in 15 minutes.'}
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
