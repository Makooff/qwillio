import { Link } from 'react-router-dom';
import { ArrowUpRight } from '../../components/icons';
import { useLang } from '../../stores/langStore';
import { useSEO } from '../../hooks/useSEO';
import { BLOG_ARTICLES } from '../../content/blogArticles';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import RevealV2 from '../../components/v2/RevealV2';

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

export default function Blog() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  /* Seule page publique qui n'avait pas de SEO: pas de titre propre, pas de
     description, pas de canonique, donc invisible là où le blog sert. */
  useSEO({
    // `useSEO` ajoute lui-même « – Qwillio »: le porter ici donnerait
    // « Blog · Qwillio – Qwillio » dans l'onglet.
    title: 'Blog',
    description: isFr
      ? "Articles et guides sur la réceptionniste IA: appels manqués, prise de rendez-vous, RGPD, coûts réels."
      : 'Articles and guides on AI receptionists: missed calls, appointment booking, GDPR, real costs.',
    canonical: 'https://qwillio.com/blog',
  });

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <PublicShell>
      {/* Hero éditorial asymétrique */}
      <Section aria-label={isFr ? 'Blog Qwillio' : 'Qwillio Blog'} className="relative !pt-16 md:!pt-24">
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

      {/* Les articles, tous cliquables. La section « Tous les articles » qui
          suivait montrait trois billets sans page, donc trois liens morts, dont
          un vantant un module d'agent qui ne s'ouvre pas. */}
      <Section variant="band" hairline aria-labelledby="featured-heading">
        <Container>
          <RevealV2 className="mb-12">
            <H2 id="featured-heading">{isFr ? 'Articles' : 'Articles'}</H2>
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

    </PublicShell>
  );
}
