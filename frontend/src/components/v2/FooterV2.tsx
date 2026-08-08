import { Link } from 'react-router-dom';
import QwillioLogo from '../QwillioLogo';
import { useLang } from '../../stores/langStore';

/* Footer V2 — crème compact, wordmark + tagline whisper, 3 colonnes hairline. */

interface FooterLink {
  to: string;
  label: string;
  external?: boolean;
}

export default function FooterV2() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: isFr ? 'Produit' : 'Product',
      links: [
        { to: '/receptionist', label: 'Receptionist AI' },
        { to: '/agent', label: 'Qwillio Agent' },
        { to: '/pricing', label: isFr ? 'Tarifs' : 'Pricing' },
      ],
    },
    {
      heading: isFr ? 'Entreprise' : 'Company',
      links: [
        { to: '/about', label: isFr ? 'À propos' : 'About' },
        { to: '/blog', label: 'Blog' },
        { to: '/faq', label: 'FAQ' },
        { to: '/contact', label: 'Contact' },
        { to: '/affiliate', label: isFr ? 'Affiliation' : 'Affiliate' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { to: '/privacy', label: isFr ? 'Confidentialité' : 'Privacy' },
        { to: '/terms', label: isFr ? 'Conditions' : 'Terms' },
        { to: '/gdpr', label: 'GDPR' },
        { to: '/sla', label: 'SLA' },
      ],
    },
  ];

  return (
    <footer
      aria-label={isFr ? 'Pied de page' : 'Site footer'}
      className="bg-q2-canvas border-t border-q2-plate"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 lg:px-10 pt-10 sm:pt-14 pb-8 sm:pb-10">
        <div className="grid md:grid-cols-[1.4fr_2fr] gap-8 sm:gap-10 md:gap-16 pb-9 sm:pb-12 border-b border-q2-plate">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-0 mb-3 sm:mb-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2 rounded-md"
            >
              <QwillioLogo size={26} />
              <span className="text-[15px] font-semibold tracking-tight text-q2-ink">Qwillio</span>
            </Link>
            <p className="text-[clamp(1.3rem,2.4vw,1.8rem)] font-light tracking-[-0.02em] leading-[1.2] text-q2-ink max-w-[380px]">
              {isFr ? (
                <>
                  L'IA qui ne dort jamais.{' '}
                  <span className="text-q2-body">Pour les entreprises qui n'arrêtent pas.</span>
                </>
              ) : (
                <>
                  The AI that never sleeps.{' '}
                  <span className="text-q2-body">For businesses that don't either.</span>
                </>
              )}
            </p>
          </div>

          <nav
            aria-label={isFr ? 'Liens du pied de page' : 'Footer links'}
            className="grid grid-cols-2 sm:grid-cols-3 gap-8"
          >
            {columns.map((col) => (
              <div key={col.heading}>
                <p className="q2-eyebrow text-q2-body mb-2 sm:mb-4">{col.heading}</p>
                {/* Au doigt chaque lien fait 44px de haut, les rangées se
                    touchent donc sans interligne; au pointeur on retrouve la
                    liste aérée d'origine. */}
                <ul role="list" className="sm:space-y-2.5">
                  {col.links.map((link) => {
                    const cls =
                      'inline-flex items-center min-h-[44px] sm:min-h-0 text-sm text-q2-graphite hover:text-q2-ink transition-colors duration-150';
                    return (
                      <li key={link.to}>
                        {link.external ? (
                          <a href={link.to} className={cls}>
                            {link.label}
                          </a>
                        ) : (
                          <Link to={link.to} className={cls}>
                            {link.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-8">
          <p className="text-xs text-q2-body">
            &copy; {new Date().getFullYear()} Qwillio Inc.{' '}
            {isFr ? 'Tous droits réservés.' : 'All rights reserved.'}
          </p>
          <p className="text-xs text-q2-body">
            {isFr ? 'Conçu et bâti à Bruxelles' : 'Designed and built in Brussels'}
          </p>
        </div>
      </div>
    </footer>
  );
}
