import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

export default function Blog() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const posts = [
    {
      title: isFr ? 'Comment l\'IA revolutionne la reception d\'appels' : 'How AI is revolutionizing call reception',
      excerpt: isFr ? 'Decouvrez comment les receptionistes IA permettent aux entreprises de ne plus jamais manquer un appel.' : 'Discover how AI receptionists help businesses never miss a call again.',
      date: 'Mar 15, 2026',
      tag: isFr ? 'IA & Automatisation' : 'AI & Automation',
    },
    {
      title: isFr ? '5 erreurs qui font perdre des clients au telephone' : '5 mistakes that lose clients on the phone',
      excerpt: isFr ? 'La plupart des entreprises perdent 30% de leurs prospects a cause d\'appels manques. Voici comment y remedier.' : 'Most businesses lose 30% of prospects due to missed calls. Here\'s how to fix it.',
      date: 'Mar 8, 2026',
      tag: isFr ? 'Conseils Business' : 'Business Tips',
    },
    {
      title: isFr ? 'Qwillio Agent : automatisez votre comptabilite' : 'Qwillio Agent: automate your accounting',
      excerpt: isFr ? 'Notre nouveau module Accounting AI genere vos factures et P&L automatiquement.' : 'Our new Accounting AI module generates your invoices and P&L automatically.',
      date: 'Feb 28, 2026',
      tag: isFr ? 'Produit' : 'Product',
    },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <section className="pt-32 pb-16 md:pt-44 md:pb-20 text-center px-6">
        <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-4">Blog</p>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
          {isFr ? 'Actualites & ressources' : 'News & resources'}
        </h1>
        <p className="mt-6 text-lg text-[#86868b] max-w-xl mx-auto">
          {isFr ? 'Articles, guides et mises a jour produit.' : 'Articles, guides, and product updates.'}
        </p>
      </section>

      <section className="pb-24 md:pb-32 px-6">
        <div className="max-w-[900px] mx-auto space-y-8">
          {posts.map((post, i) => (
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
