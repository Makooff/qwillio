import { useLang } from '../stores/langStore';

/* `onDark` : la nav V2 passe au-dessus de sections sombres, où l'encre du
   sélecteur devient illisible. Optionnel et faux par défaut, donc les usages V1
   ne changent pas d'un pixel. */
export default function LangToggle({
  className = '',
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
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
        className={`transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fff]/40 rounded-sm ${
          lang === 'en'
            ? onDark ? 'text-white' : 'text-[#1d1d1f]'
            : onDark ? 'text-white/55 hover:text-white' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        EN
      </button>
      <span className={onDark ? 'text-white/30' : 'text-[#d2d2d7]'} aria-hidden="true">|</span>
      <button
        type="button"
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
        aria-label="Français"
        className={`transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fff]/40 rounded-sm ${
          lang === 'fr'
            ? onDark ? 'text-white' : 'text-[#1d1d1f]'
            : onDark ? 'text-white/55 hover:text-white' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        FR
      </button>
    </div>
  );
}
