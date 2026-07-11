import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, BookOpen } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { useSEO } from '../hooks/useSEO';
import { getArticleBySlug, type Block } from '../content/blogArticles';

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
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main aria-labelledby="article-heading">
        <header className="pt-32 md:pt-40 pb-10 px-6">
          <div className="max-w-[760px] mx-auto">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#6366f1] mb-8 transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              {isFr ? 'Retour au blog' : 'Back to blog'}
            </Link>

            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}
              >
                {isFr ? article.tag.fr : article.tag.en}
              </span>
              <span className="flex items-center gap-1 text-xs text-[#6e6e73]">
                <Clock size={12} aria-hidden="true" /> {dateStr}
              </span>
              <span className="flex items-center gap-1 text-xs text-[#6e6e73]">
                <BookOpen size={12} aria-hidden="true" /> {article.readTime} min
              </span>
            </div>

            <h1
              id="article-heading"
              className="text-[clamp(2.2rem,5vw,3.6rem)] font-semibold tracking-[-0.03em] leading-[1.05]"
            >
              {isFr ? article.title.fr : article.title.en}
            </h1>

            <p className="mt-6 text-lg text-[#525257] leading-relaxed max-w-[640px]">
              {isFr ? article.excerpt.fr : article.excerpt.en}
            </p>
          </div>
        </header>

        <article className="px-6 pb-20">
          <div className="max-w-[720px] mx-auto space-y-6">
            {body.map((block, i) => {
              if (block.type === 'h2') {
                return (
                  <h2
                    key={i}
                    className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.02em] mt-10 mb-1 text-[#1d1d1f]"
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.type === 'ul') {
                return (
                  <ul key={i} className="list-disc pl-6 space-y-2 text-[#424245]" role="list">
                    {block.items.map((it, j) => (
                      <li key={j} className="text-[16px] leading-relaxed">{it}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={i} className="text-[17px] leading-[1.75] text-[#424245]">
                  {block.text}
                </p>
              );
            })}
          </div>
        </article>

        <section
          aria-label={isFr ? 'Passer à l\'action' : 'Get started'}
          className="px-6 pb-24 md:pb-32"
        >
          <div className="max-w-[720px] mx-auto rounded-3xl p-8 md:p-10 text-white" style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #6366f1 115%)' }}>
            <h3 className="text-[clamp(1.4rem,2.4vw,2rem)] font-semibold tracking-[-0.02em] mb-3">
              {isFr ? 'Prêt à ne plus manquer un appel ?' : 'Ready to stop missing calls?'}
            </h3>
            <p className="text-white/75 text-[15px] leading-relaxed mb-6 max-w-[480px]">
              {isFr
                ? 'Testez Qwillio gratuitement pendant un mois. Sans carte, sans engagement, configuration en 15 minutes.'
                : 'Try Qwillio free for one month. No credit card, no commitment, set up in 15 minutes.'}
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-white text-[#1d1d1f] text-sm font-medium px-5 py-3 rounded-full hover:bg-[#a5b4fc] transition-colors"
            >
              {isFr ? 'Créer un compte' : 'Create account'}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
