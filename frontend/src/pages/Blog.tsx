import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

interface Article {
  slug: string;
  title: string;
  titleFr: string;
  excerpt: string;
  excerptFr: string;
  date: string;
  readTime: number;
  tag: string;
  tagFr: string;
  ready: boolean;
}

const SEO_ARTICLES: Article[] = [
  {
    slug: 'ai-receptionist-plumber-2026',
    title: 'Why Every Plumber Needs an AI Receptionist in 2026',
    titleFr: 'Pourquoi chaque plombier a besoin d\'une réceptionniste IA en 2026',
    excerpt: 'Plumbing businesses miss up to 35% of inbound calls during service hours. An AI receptionist captures every lead, books appointments 24/7, and pays for itself within the first month.',
    excerptFr: 'Les entreprises de plomberie manquent jusqu\'à 35% des appels entrants pendant les heures de service. Une réceptionniste IA capture chaque prospect et prend les rendez-vous 24h/24.',
    date: '2026-04-10',
    readTime: 6,
    tag: 'Home Services',
    tagFr: 'Services à domicile',
    ready: false,
  },
  {
    slug: 'dental-offices-ai-no-shows',
    title: 'How Dental Offices Are Cutting No-Shows by 40% with AI',
    titleFr: 'Comment les cabinets dentaires réduisent les absences de 40% avec l\'IA',
    excerpt: 'Automated confirmation calls, smart rescheduling, and personalized reminders are transforming dental practice management and reclaiming thousands in lost revenue.',
    excerptFr: 'Les appels de confirmation automatisés, la replanification intelligente et les rappels personnalisés transforment la gestion des cabinets dentaires.',
    date: '2026-04-05',
    readTime: 5,
    tag: 'Dental',
    tagFr: 'Dentaire',
    ready: false,
  },
  {
    slug: 'hidden-cost-missed-calls',
    title: 'The Hidden Cost of Missed Calls for Home Service Businesses',
    titleFr: 'Le coût caché des appels manqués pour les entreprises de services',
    excerpt: 'Each missed call costs a home service business an average of $1,200 in lost lifetime value. We break down the true numbers and show how to stop the leak.',
    excerptFr: 'Chaque appel manqué coûte en moyenne 1 200 $ en valeur à vie perdue. Nous analysons les vrais chiffres et montrons comment colmater la fuite.',
    date: '2026-03-28',
    readTime: 7,
    tag: 'Business Growth',
    tagFr: 'Croissance',
    ready: false,
  },
  {
    slug: 'ai-vs-human-receptionist-cost',
    title: 'AI vs Human Receptionist: A Real Cost Comparison',
    titleFr: 'IA vs réceptionniste humaine : une vraie comparaison des coûts',
    excerpt: 'A full-time receptionist costs $38K+/year. An AI receptionist handles unlimited calls for under $200/month with zero sick days, zero turnover, and 24/7 availability.',
    excerptFr: 'Une réceptionniste à temps plein coûte 38 000 $+/an. Une réceptionniste IA gère des appels illimités pour moins de 200 $/mois, disponible 24h/24.',
    date: '2026-03-20',
    readTime: 8,
    tag: 'Cost Analysis',
    tagFr: 'Analyse des coûts',
    ready: false,
  },
];

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
                <article
                  key={article.slug}
                  className="relative rounded-2xl p-6 overflow-hidden transition-colors duration-300 hover:scale-[1.01] group"
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
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: '#86868B' }}>
                        <Clock size={10} aria-hidden="true" /> {formatDate(article.date)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: '#86868B' }}>
                        <BookOpen size={10} aria-hidden="true" /> {article.readTime} min
                      </span>
                    </div>

                    <h3 className="text-base font-semibold leading-snug mb-3" style={{ color: '#F5F5F7' }}>
                      {isFr ? article.titleFr : article.title}
                    </h3>

                    <p className="text-[13px] leading-relaxed mb-5" style={{ color: '#86868B' }}>
                      {isFr ? article.excerptFr : article.excerpt}
                    </p>

                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: '#818cf8',
                        cursor: article.ready ? 'pointer' : 'default',
                      }}
                    >
                      {article.ready
                        ? <>{isFr ? 'Lire' : 'Read'} <ArrowRight size={14} aria-hidden="true" /></>
                        : <>{isFr ? 'Bientôt disponible' : 'Coming soon'}</>
                      }
                    </span>
                  </div>
                </article>
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
