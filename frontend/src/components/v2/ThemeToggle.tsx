import { useEffect, useState } from 'react';
import { Sun, Moon } from '../icons';
import { useTheme } from '../../stores/themeStore';

/**
 * Interrupteur clair / sombre.
 *
 * Un vrai interrupteur, pas deux boutons: le réglage n'a que deux états et
 * l'un exclut l'autre, c'est exactement ce qu'un switch raconte. Le curseur
 * porte l'icône de l'état COURANT, la piste garde l'autre en filigrane, si
 * bien qu'on lit d'un coup où on est et où on irait.
 *
 * Fond transparent (retour utilisateur): sur le verre de la barre, une piste
 * pleine se voyait comme une tache blanche. Seul un filet la dessine.
 *
 * L'état affiché est recalculé sur les changements système, parce qu'en mode
 * « système » c'est l'appareil qui décide: sans cet écouteur, le curseur
 * resterait du côté du thème au chargement pendant que la page, elle, aurait
 * déjà basculé.
 */
export default function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { theme, toggle } = useTheme();
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      onClick={toggle}
      className={`relative inline-flex items-center w-[42px] h-[23px] rounded-full border transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 ${
        /* Contour transparent au repos (retour utilisateur): sur le verre de
           la barre, `border-q2-plate` dessinait un anneau clair qui se lisait
           comme une tache blanche. Le filet n'apparaît qu'au survol, pour dire
           que c'est cliquable. */
        onDark ? 'border-transparent hover:border-white/25' : 'border-transparent hover:border-q2-plate'
      }`}
    >
      {/* Les deux repères restent en place, très bas, sous le curseur. */}
      <span
        className={`absolute left-[5px] ${onDark ? 'text-white/35' : 'text-q2-faint'}`}
        aria-hidden="true"
      >
        <Sun size={12} />
      </span>
      <span
        className={`absolute right-[5px] ${onDark ? 'text-white/35' : 'text-q2-faint'}`}
        aria-hidden="true"
      >
        <Moon size={12} />
      </span>

      {/* Curseur: `translate` et non `left`, pour rester sur le compositeur. */}
      <span
        aria-hidden="true"
        className={`relative z-10 flex items-center justify-center w-[17px] h-[17px] ml-[2px] rounded-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          /* En sombre, le curseur ne porte plus de fond (demande utilisateur):
             il est TRANSPARENT et FLOU comme le verre de la barre, et c'est
             son seul contour qui dit où l'on est. Le disque noir plein qui
             était là faisait une pastille opaque au milieu d'une barre en
             verre, donc deux matières pour un même objet.
             Le `backdrop-blur` est admis ici sans déroger au bandissement du
             glassmorphisme: CLAUDE.md en excepte explicitement le chrome de la
             barre, et c'est précisément lui.
             Le filet monte à 45 %: sans fond pour porter le contraste, c'est
             lui seul qui doit rester lisible sur le verre. */
          onDark
            ? 'bg-white/[0.06] backdrop-blur-md text-white ring-1 ring-white/45'
            /* Sur clair aussi (retour utilisateur): le curseur était un disque
               NOIR plein, une pastille opaque au milieu d'une barre en verre.
               Même traitement que sur sombre, avec les valeurs inversées: un
               voile d'encre à 6 %, un filet d'encre, et l'icône en encre. */
            : 'bg-q2-ink/[0.06] backdrop-blur-md text-q2-ink ring-1 ring-q2-ink/25'
        }`}
        style={{ transform: dark ? 'translateX(19px)' : 'translateX(0)' }}
      >
        {dark ? <Moon size={11} /> : <Sun size={11} />}
      </span>
    </button>
  );
}
