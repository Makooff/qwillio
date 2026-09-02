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
            : onDark ? 'text-white/70 hover:text-white' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        EN
      </button>
      {/* Le séparateur reste le trait le plus discret des trois: il sépare, il
          ne se lit pas. Sur clair il partait de #d2d2d7, presque blanc, et
          au-dessus de la vidéo du hero c'est lui qu'on voyait en premier
          (retour utilisateur: « la barre trop blanche entre FR et EN »). La
          vraie correction est ailleurs, dans le marqueur `data-nav-dark` du
          hero qui fait passer tout le sélecteur en version sombre; ici on ne
          fait que l'abaisser des deux côtés. */}
      <span className={onDark ? 'text-white/25' : 'text-[#c7c7cc]'} aria-hidden="true">|</span>
      <button
        type="button"
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
        aria-label="Français"
        className={`transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fff]/40 rounded-sm ${
          lang === 'fr'
            ? onDark ? 'text-white' : 'text-[#1d1d1f]'
            : onDark ? 'text-white/70 hover:text-white' : 'text-[#86868b] hover:text-[#1d1d1f]'
        }`}
      >
        FR
      </button>
    </div>
  );
}
