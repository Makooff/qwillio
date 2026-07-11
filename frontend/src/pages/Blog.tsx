import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import { BLOG_ARTICLES } from '../content/blogArticles';

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
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main aria-label={isFr ? 'Blog Qwillio' : 'Qwillio Blog'}>
        <header className="pt-32 pb-16 md:pt-44 md:pb-20 text-center px-6">
          <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-4">Blog</p>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
            {isFr ? 'Actualités & ressources' : 'News & resources'}
          </h1>
          <p className="mt-6 text-lg text-[#86868b] max-w-xl mx-auto">
            {isFr ? 'Articles, guides et mises à jour produit sur la réceptionniste IA.' : 'Articles, guides, and product updates about AI receptionists.'}
          </p>
        </header>

        {/* SEO Articles */}
        <section aria-labelledby="featured-heading" className="pb-16 px-6">
          <div className="max-w-[900px] mx-auto">
            <h2 id="featured-heading" className="text-sm font-semibold text-[#1d1d1f] uppercase tracking-wider mb-6">
              {isFr ? 'Articles à la une' : 'Featured articles'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SEO_ARTICLES.map((article, i) => (
                <Link
                  key={article.slug}
                  to={`/blog/${article.slug}`}
                  aria-label={isFr ? article.titleFr : article.title}
                  className="relative rounded-2xl p-6 overflow-hidden transition-transform duration-300 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/40 block"
                  style={{
                    background: 'linear-gradient(135deg, #111113, #1a1a1f)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl"
                    style={{ background: i % 2 === 0 ? '#6366F1' : '#3B82F6' }}
                  />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                      >
                        {isFr ? article.tagFr : article.tag}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: '#a1a1a6' }}>
                        <Clock size={10} aria-hidden="true" /> {formatDate(article.date)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: '#a1a1a6' }}>
                        <BookOpen size={10} aria-hidden="true" /> {article.readTime} min
                      </span>
                    </div>

                    <h3 className="text-base font-semibold leading-snug mb-3" style={{ color: '#F5F5F7' }}>
                      {isFr ? article.titleFr : article.title}
                    </h3>

                    <p className="text-[13px] leading-relaxed mb-5" style={{ color: '#a1a1a6' }}>
                      {isFr ? article.excerptFr : article.excerpt}
                    </p>

                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#818cf8' }}
                    >
                      {isFr ? 'Lire' : 'Read'} <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Legacy posts */}
        <section aria-labelledby="all-heading" className="pb-24 md:pb-32 px-6">
          <div className="max-w-[900px] mx-auto space-y-8">
            <h2 id="all-heading" className="text-sm font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">
              {isFr ? 'Tous les articles' : 'All articles'}
            </h2>
            {legacyPosts.map((post) => (
              <article key={post.title} className="rounded-2xl border border-[#d2d2d7] p-8 hover:border-[#6366f1]/40 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-medium text-[#6366f1] bg-[#6366f1]/10 px-3 py-1 rounded-full">{post.tag}</span>
                  <span className="flex items-center gap-1 text-xs text-[#86868b]"><Clock size={12} aria-hidden="true" /> {post.date}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{post.title}</h3>
                <p className="text-sm text-[#86868b] leading-relaxed mb-4">{post.excerpt}</p>
                <span className="inline-flex items-center gap-1 text-sm text-[#6366f1] font-medium hover:underline cursor-pointer">
                  {isFr ? 'Lire la suite' : 'Read more'} <ArrowRight size={14} aria-hidden="true" />
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
