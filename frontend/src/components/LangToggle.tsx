import { useLang } from '../stores/langStore';

export default function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${className}`}>
      <button
        onClick={() => setLang('en')}
        className={`transition-colors ${
          lang === 'en' ? 'text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        EN
      </button>
      <span className="text-[#d2d2d7]">|</span>
      <button
        onClick={() => setLang('fr')}
        className={`transition-colors ${
          lang === 'fr' ? 'text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        FR
      </button>
    </div>
  );
}
