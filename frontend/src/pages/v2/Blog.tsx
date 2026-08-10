import { Link } from 'react-router-dom';
import { ArrowUpRight } from '../../components/icons';
import { useLang } from '../../stores/langStore';
import { BLOG_ARTICLES } from '../../content/blogArticles';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import RevealV2 from '../../components/v2/RevealV2';
import ShapeDrift from '../../components/v2/motion/ShapeDrift';

/* Blog V2 « Papier & Signal », voir DA/v2-direction.md.
   Liste éditoriale hairline au lieu de la grille de cards sombres de la V1.
   Contrat conservé: les articles de content/blogArticles.ts sont les seuls liens
   vers /blog/:slug, les billets historiques restent du texte. */

const SEO_ARTICLES = BLOG_ARTICLES.map((a) => ({
  slug: a.slug,
  title: a.title.en,
  titleFr: a.title.fr,
  excerpt: a.excerpt.en,
  excerptFr: a.excerpt.fr,
  date: a.date,
  readTime: a.readTime,
  tag: a.tag.en,
  tagFr: a.tag.fr,
  ready: true,
}));

interface LegacyPost {
  title: string;
  excerpt: string;
  date: string;
  tag: string;
  ready: boolean;
}

export default function Blog() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const legacyPosts: LegacyPost[] = [
    {
      title: isFr ? 'Comment l\'IA révolutionne la réception d\'appels' : 'How AI is revolutionizing call reception',
      excerpt: isFr ? 'Découvrez comment les réceptionnistes IA permettent aux entreprises de ne plus jamais manquer un appel.' : 'Discover how AI receptionists help businesses never miss a call again.',
      date: 'Mar 15, 2026',
      tag: isFr ? 'IA & Automatisation' : 'AI & Automation',
      ready: true,
    },
    {
      title: isFr ? '5 erreurs qui font perdre des clients au téléphone' : '5 mistakes that lose clients on the phone',
      excerpt: isFr ? 'La plupart des entreprises perdent 30% de leurs prospects à cause d\'appels manqués. Voici comment y remédier.' : 'Most businesses lose 30% of prospects due to missed calls. Here\'s how to fix it.',
      date: 'Mar 8, 2026',
      tag: isFr ? 'Conseils Business' : 'Business Tips',
      ready: true,
    },
    {
      title: isFr ? 'Qwillio Agent : automatisez votre comptabilité' : 'Qwillio Agent: automate your accounting',
      excerpt: isFr ? 'Notre nouveau module Accounting AI génère vos factures et P&L automatiquement.' : 'Our new Accounting AI module generates your invoices and P&L automatically.',
      date: 'Feb 28, 2026',
      tag: isFr ? 'Produit' : 'Product',
      ready: true,
    },
  ];

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <PublicShell>
      {/* Hero éditorial asymétrique */}
      <Section aria-label={isFr ? 'Blog Qwillio' : 'Qwillio Blog'} className="relative !pt-16 md:!pt-24">
        <ShapeDrift shapes={[{ kind: 'columnAlt', x: '87%', y: '18%', size: 145, drift: 85, opacity: 0.22 }]} />
        <Container className="grid lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-20 items-end">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-6">
              Blog
            </Eyebrow>
            <Display>
              {isFr ? (
                <>
                  Actualités &amp; <SerifWord>ressources.</SerifWord>
                </>
              ) : (
                <>
                  News &amp; <SerifWord>resources.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1}>
            <Lead className="max-w-[420px] q2-body-text lg:pb-3">
              {isFr
                ? 'Articles, guides et mises à jour produit sur la réceptionniste IA.'
                : 'Articles, guides, and product updates about AI receptionists.'}
            </Lead>
          </RevealV2>
        </Container>
      </Section>

      {/* Articles à la une: rangées hairline, date à gauche, extrait au centre */}
      <Section variant="band" hairline aria-labelledby="featured-heading">
        <Container>
          <RevealV2 className="mb-12">
            <H2 id="featured-heading">{isFr ? 'Articles à la une' : 'Featured articles'}</H2>
          </RevealV2>

          <ol className="border-t border-q2-plate" role="list">
            {SEO_ARTICLES.map((article, i) => (
              <RevealV2 key={article.slug} index={i} as="li" className="border-b border-q2-plate">
                <Link
                  to={`/blog/${article.slug}`}
                  aria-label={isFr ? article.titleFr : article.title}
                  className="group grid md:grid-cols-[150px_1fr_auto] gap-3 md:gap-10 py-8 md:py-10 items-start rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
                >
                  <p className="text-sm text-q2-body tabular-nums md:pt-1.5">{formatDate(article.date)}</p>

                  <div>
                    <h3 className="q2-h3 text-q2-ink mb-2 max-w-[560px] transition-colors duration-150 group-hover:text-q2-graphite">
                      {isFr ? article.titleFr : article.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-q2-body max-w-[560px] q2-body-text">
                      {isFr ? article.excerptFr : article.excerpt}
                    </p>
                    <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-q2-body">
                      <span className="q2-eyebrow text-q2-indigo">{isFr ? article.tagFr : article.tag}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{article.readTime}&nbsp;min</span>
                    </p>
                  </div>

                  <span
                    aria-hidden="true"
                    className="hidden md:inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-ink transition-transform duration-200 group-hover:-translate-y-0.5"
                  >
                    <ArrowUpRight size={16} />
                  </span>
                </Link>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Billets historiques: pas encore de page dédiée, donc pas de lien */}
      <Section aria-labelledby="all-heading" className="relative">
        <ShapeDrift shapes={[{ kind: 'twin', x: '-9%', y: '46%', size: 215, drift: -75, opacity: 0.2 }]} />
        <Container>
          <RevealV2 className="mb-12">
            <H2 id="all-heading">{isFr ? 'Tous les articles' : 'All articles'}</H2>
          </RevealV2>

          <div className="border-t border-q2-plate">
            {legacyPosts.map((post, i) => (
              <RevealV2 key={post.title} index={i} as="article" className="border-b border-q2-plate">
                <div className="grid md:grid-cols-[150px_1fr] gap-3 md:gap-10 py-8 md:py-10 items-start">
                  <p className="text-sm text-q2-body md:pt-1.5">{post.date}</p>
                  <div>
                    <h3 className="q2-h3 text-q2-ink mb-2 max-w-[560px]">{post.title}</h3>
                    <p className="text-[15px] leading-relaxed text-q2-body max-w-[560px] q2-body-text">
                      {post.excerpt}
                    </p>
                    <p className="mt-4 q2-eyebrow text-q2-body">{post.tag}</p>
                  </div>
                </div>
              </RevealV2>
            ))}
          </div>
        </Container>
      </Section>
    </PublicShell>
  );
}
