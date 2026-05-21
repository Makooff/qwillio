import { useLang } from '../stores/langStore';

export default function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div
      role="group"
      aria-label="Language selector"
      className={`flex items-center gap-1 text-xs font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        aria-label="English"
        className={`transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/40 rounded-sm ${
          lang === 'en' ? 'text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        EN
      </button>
      <span className="text-[#d2d2d7]" aria-hidden="true">|</span>
      <button
        type="button"
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
        aria-label="Français"
        className={`transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/40 rounded-sm ${
          lang === 'fr' ? 'text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        FR
      </button>
    </div>
  );
}
