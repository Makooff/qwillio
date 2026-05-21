import { Link } from 'react-router-dom';
import QwillioLogo from './QwillioLogo';
import { useLang } from '../stores/langStore';

interface FooterLink {
  to: string;
  label: string;
  external?: boolean;
}

export default function PublicFooter() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: isFr ? 'Produit' : 'Product',
      links: [
        { to: '/receptionist', label: 'Receptionist AI' },
        { to: '/agent',        label: 'Qwillio Agent' },
        { to: '/pricing',      label: isFr ? 'Tarifs' : 'Pricing' },
        { to: '/demo.html',    label: isFr ? 'Démo' : 'Demo', external: true },
      ],
    },
    {
      heading: isFr ? 'Entreprise' : 'Company',
      links: [
        { to: '/about',     label: isFr ? 'À propos' : 'About' },
        { to: '/blog',      label: 'Blog' },
        { to: '/contact',   label: 'Contact' },
        { to: '/affiliate', label: isFr ? 'Affiliation' : 'Affiliate' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { to: '/privacy', label: isFr ? 'Confidentialité' : 'Privacy' },
        { to: '/terms',   label: isFr ? 'Conditions' : 'Terms' },
        { to: '/gdpr',    label: 'GDPR' },
      ],
    },
  ];

  return (
    <footer
      aria-label={isFr ? 'Pied de page' : 'Site footer'}
      className="border-t border-[#1d1d1f]/8 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-[1240px] mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-10">
        {/* Editorial top row: wordmark + tagline */}
        <div className="grid md:grid-cols-[1.4fr_2fr] gap-10 md:gap-16 pb-10 sm:pb-12 border-b border-[#1d1d1f]/8">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/40 focus-visible:ring-offset-2 rounded-md"
            >
              <QwillioLogo size={26} />
              <span className="text-lg font-semibold tracking-tight text-[#1d1d1f]">Qwillio</span>
            </Link>
            <p
              className="text-[clamp(1.15rem,2.2vw,1.6rem)] font-semibold tracking-[-0.025em] leading-[1.2] text-[#1d1d1f] max-w-[380px]"
            >
              {isFr ? (
                <>L'IA qui ne dort jamais. <span className="text-[#86868b] font-normal">Pour les entreprises qui n'arrêtent pas.</span></>
              ) : (
                <>The AI that never sleeps. <span className="text-[#86868b] font-normal">For businesses that don't either.</span></>
              )}
            </p>
          </div>

          <nav
            aria-label={isFr ? 'Liens du pied de page' : 'Footer links'}
            className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8"
          >
            {columns.map((col) => (
              <div key={col.heading}>
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#86868b] mb-4">
                  {col.heading}
                </p>
                <ul role="list" className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.to}>
                      {link.external ? (
                        <a
                          href={link.to}
                          className="text-sm text-[#1d1d1f] hover:text-[#6366f1] transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.to}
                          className="text-sm text-[#1d1d1f] hover:text-[#6366f1] transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom strip */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-8">
          <p className="text-xs text-[#86868b]">
            &copy; {new Date().getFullYear()} Qwillio Inc.{' '}
            {isFr ? 'Tous droits réservés.' : 'All rights reserved.'}
          </p>
          <p className="text-xs text-[#86868b]">
            {isFr ? 'Conçu et bâti à Bruxelles' : 'Designed and built in Brussels'}
          </p>
        </div>
      </div>
    </footer>
  );
}
