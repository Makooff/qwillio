import { Link } from 'react-router-dom';
import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

const SEO_ARTICLES = [
  {
    slug: 'ai-receptionist-plumber-2026',
    title: 'Why Every Plumber Needs an AI Receptionist in 2026',
    titleFr: 'Pourquoi chaque plombier a besoin d\'une receptionniste IA en 2026',
    excerpt: 'Plumbing businesses miss up to 35% of inbound calls during service hours. An AI receptionist captures every lead, books appointments 24/7, and pays for itself within the first month.',
    excerptFr: 'Les entreprises de plomberie manquent jusqu\'a 35% des appels entrants pendant les heures de service. Une receptionniste IA capture chaque prospect et prend les rendez-vous 24h/24.',
    date: '2026-04-10',
    readTime: 6,
    tag: 'Home Services',
    tagFr: 'Services a domicile',
    ready: false,
  },
  {
    slug: 'dental-offices-ai-no-shows',
    title: 'How Dental Offices Are Cutting No-Shows by 40% with AI',
    titleFr: 'Comment les cabinets dentaires reduisent les absences de 40% avec l\'IA',
    excerpt: 'Automated confirmation calls, smart rescheduling, and personalized reminders are transforming dental practice management and reclaiming thousands in lost revenue.',
    excerptFr: 'Les appels de confirmation automatises, la replanification intelligente et les rappels personnalises transforment la gestion des cabinets dentaires.',
    date: '2026-04-05',
    readTime: 5,
    tag: 'Dental',
    tagFr: 'Dentaire',
    ready: false,
  },
  {
    slug: 'hidden-cost-missed-calls',
    title: 'The Hidden Cost of Missed Calls for Home Service Businesses',
    titleFr: 'Le cout cache des appels manques pour les entreprises de services',
    excerpt: 'Each missed call costs a home service business an average of $1,200 in lost lifetime value. We break down the true numbers and show how to stop the leak.',
    excerptFr: 'Chaque appel manque coute en moyenne 1 200 $ en valeur a vie perdue. Nous analysons les vrais chiffres et montrons comment colmater la fuite.',
    date: '2026-03-28',
    readTime: 7,
    tag: 'Business Growth',
    tagFr: 'Croissance',
    ready: false,
  },
  {
    slug: 'ai-vs-human-receptionist-cost',
    title: 'AI vs Human Receptionist: A Real Cost Comparison',
    titleFr: 'IA vs receptionniste humaine : une vraie comparaison des couts',
    excerpt: 'A full-time receptionist costs $38K+/year. An AI receptionist handles unlimited calls for under $200/month with zero sick days, zero turnover, and 24/7 availability.',
    excerptFr: 'Une receptionniste a temps plein coute 38 000 $+/an. Une receptionniste IA gere des appels illimites pour moins de 200 $/mois, disponible 24h/24.',
    date: '2026-03-20',
    readTime: 8,
    tag: 'Cost Analysis',
    tagFr: 'Analyse des couts',
    ready: false,
  },
];

export default function Blog() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const legacyPosts = [
    {
      title: isFr ? 'Comment l\'IA revolutionne la reception d\'appels' : 'How AI is revolutionizing call reception',
      excerpt: isFr ? 'Decouvrez comment les receptionistes IA permettent aux entreprises de ne plus jamais manquer un appel.' : 'Discover how AI receptionists help businesses never miss a call again.',
      date: 'Mar 15, 2026',
      tag: isFr ? 'IA & Automatisation' : 'AI & Automation',
      ready: true,
    },
    {
      title: isFr ? '5 erreurs qui font perdre des clients au telephone' : '5 mistakes that lose clients on the phone',
      excerpt: isFr ? 'La plupart des entreprises perdent 30% de leurs prospects a cause d\'appels manques. Voici comment y remedier.' : 'Most businesses lose 30% of prospects due to missed calls. Here\'s how to fix it.',
      date: 'Mar 8, 2026',
      tag: isFr ? 'Conseils Business' : 'Business Tips',
      ready: true,
    },
    {
      title: isFr ? 'Qwillio Agent : automatisez votre comptabilite' : 'Qwillio Agent: automate your accounting',
      excerpt: isFr ? 'Notre nouveau module Accounting AI genere vos factures et P&L automatiquement.' : 'Our new Accounting AI module generates your invoices and P&L automatically.',
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

      {/* SEO meta-relevant heading */}
      <section className="pt-32 pb-16 md:pt-44 md:pb-20 text-center px-6">
        <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-4">Blog</p>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
          {isFr ? 'Actualites & ressources' : 'News & resources'}
        </h1>
        <p className="mt-6 text-lg text-[#86868b] max-w-xl mx-auto">
          {isFr ? 'Articles, guides et mises a jour produit sur la receptionniste IA.' : 'Articles, guides, and product updates about AI receptionists.'}
        </p>
      </section>

      {/* ── SEO Articles (dark glassmorphism cards) ── */}
      <section className="pb-16 px-6">
        <div className="max-w-[900px] mx-auto">
          <h2 className="text-sm font-semibold text-[#1d1d1f] uppercase tracking-wider mb-6">
            {isFr ? 'Articles a la une' : 'Featured articles'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SEO_ARTICLES.map((article, i) => (
              <article
                key={article.slug}
                className="relative rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:scale-[1.01] group"
                style={{
                  background: 'linear-gradient(135deg, #111113, #1a1a1f)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Subtle glow */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl"
                  style={{ background: i % 2 === 0 ? '#7B5CF0' : '#3B82F6' }} />

                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(123,92,240,0.15)', color: '#A78BFA' }}>
                      {isFr ? article.tagFr : article.tag}
                    </span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: '#86868B' }}>
                      <Clock size={10} /> {formatDate(article.date)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: '#86868B' }}>
                      <BookOpen size={10} /> {article.readTime} min
                    </span>
                  </div>

                  <h3 className="text-base font-semibold leading-snug mb-3" style={{ color: '#F5F5F7' }}>
                    {isFr ? article.titleFr : article.title}
                  </h3>

                  <p className="text-[13px] leading-relaxed mb-5" style={{ color: '#86868B' }}>
                    {isFr ? article.excerptFr : article.excerpt}
                  </p>

                  <span className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#A78BFA',
                      cursor: article.ready ? 'pointer' : 'default',
                    }}>
                    {article.ready
                      ? <>{isFr ? 'Lire' : 'Read'} <ArrowRight size={14} /></>
                      : <>{isFr ? 'Bientot disponible' : 'Coming soon'}</>
                    }
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Legacy posts ── */}
      <section className="pb-24 md:pb-32 px-6">
        <div className="max-w-[900px] mx-auto space-y-8">
          <h2 className="text-sm font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">
            {isFr ? 'Tous les articles' : 'All articles'}
          </h2>
          {legacyPosts.map((post, i) => (
            <article key={i} className="rounded-2xl border border-[#d2d2d7] p-8 hover:border-[#6366f1]/40 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-medium text-[#6366f1] bg-[#6366f1]/10 px-3 py-1 rounded-full">{post.tag}</span>
                <span className="flex items-center gap-1 text-xs text-[#86868b]"><Clock size={12} /> {post.date}</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
              <p className="text-sm text-[#86868b] leading-relaxed mb-4">{post.excerpt}</p>
              <span className="inline-flex items-center gap-1 text-sm text-[#6366f1] font-medium hover:underline cursor-pointer">
                {isFr ? 'Lire la suite' : 'Read more'} <ArrowRight size={14} />
              </span>
            </article>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
