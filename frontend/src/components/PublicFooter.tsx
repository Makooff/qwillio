import { Link } from 'react-router-dom';
import QwillioLogo from './QwillioLogo';
import { useLang } from '../stores/langStore';

export default function PublicFooter() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  return (
    <footer className="border-t border-[#d2d2d7]/60 bg-[#f5f5f7]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-[1120px] mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <QwillioLogo size={24} />
              <p className="text-base font-semibold">Qwillio</p>
            </div>
            <p className="text-sm text-[#86868b] leading-relaxed">
              {isFr ? "L'IA qui ne dort jamais." : 'The AI that never sleeps.'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{isFr ? 'Produit' : 'Product'}</p>
            <div className="space-y-2">
              <Link to="/receptionist" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">Receptionist AI</Link>
              <Link to="/agent" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">Qwillio Agent</Link>
              <Link to="/pricing" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Tarifs' : 'Pricing'}</Link>
              <a href="/demo.html" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Demo' : 'Demo'}</a>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{isFr ? 'Entreprise' : 'Company'}</p>
            <div className="space-y-2">
              <Link to="/about" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'A propos' : 'About'}</Link>
              <Link to="/blog" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">Blog</Link>
              <Link to="/contact" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">Contact</Link>
              <Link to="/affiliate" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Affiliation' : 'Affiliate'}</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{isFr ? 'Legal' : 'Legal'}</p>
            <div className="space-y-2">
              <Link to="/privacy" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Confidentialite' : 'Privacy'}</Link>
              <Link to="/terms" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{isFr ? 'Conditions' : 'Terms'}</Link>
              <Link to="/gdpr" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">GDPR</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-[#d2d2d7]/60 pt-6">
          <p className="text-xs text-[#86868b]">&copy; {new Date().getFullYear()} Qwillio Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
