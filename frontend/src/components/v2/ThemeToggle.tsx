import { useEffect, useState } from 'react';
import { Sun, Moon } from '../icons';
import { useTheme } from '../../stores/themeStore';

/**
 * Clair / sombre, deux pastilles dans une gouttière, façon Folio.
 *
 * Le bouton affiche ce qui EST, pas ce qui arriverait au clic: la pastille
 * allumée est le thème en cours. Un bouton qui montre la destination oblige à
 * réfléchir avant de cliquer, ce qui est beaucoup pour un réglage à deux états.
 *
 * L'état affiché est recalculé sur les changements système, parce qu'en mode
 * « système » c'est l'appareil qui décide: sans cet écouteur, la pastille
 * resterait sur le thème du chargement pendant que la page, elle, aurait déjà
 * basculé.
 */
export default function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { theme, setTheme } = useTheme();
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

  const base =
    'inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40';
  const on = onDark ? 'bg-white/15 text-white' : 'bg-q2-plate text-q2-ink';
  const off = onDark ? 'text-white/55 hover:text-white' : 'text-q2-faint hover:text-q2-graphite';

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${
        onDark ? 'bg-white/5' : 'bg-q2-band'
      }`}
      role="group"
      aria-label="Thème"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={!dark}
        aria-label="Thème clair"
        className={`${base} ${dark ? off : on}`}
      >
        <Sun size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={dark}
        aria-label="Thème sombre"
        className={`${base} ${dark ? on : off}`}
      >
        <Moon size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
