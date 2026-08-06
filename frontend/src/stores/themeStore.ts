import { create } from 'zustand';

/**
 * Clair ou sombre, pour le SITE (les pages marketing et l'accès clients).
 *
 * Le tableau de bord n'est pas concerné: il est sombre par nature, c'est son
 * registre produit, pas une préférence.
 *
 * Trois états et non deux: « système » est le défaut, et c'est le seul qui
 * respecte le réglage de l'appareil. Un défaut « clair » en dur imposerait une
 * page blanche à qui a mis son téléphone en sombre pour la nuit.
 */
export type Theme = 'light' | 'dark' | 'system';

const KEY = 'qwillio.theme';

function read(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const raw = localStorage.getItem(KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/**
 * Pose (ou retire) l'attribut sur la racine.
 *
 * En mode système, l'attribut est RETIRÉ plutôt que calculé ici: c'est la
 * requête média de `v2.css` qui tranche, et elle suit l'appareil en direct.
 * Calculer la valeur en JS figerait le thème au chargement, et l'utilisateur
 * qui bascule son système à la tombée du jour ne verrait rien changer.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Bascule explicite: depuis « système », on part vers le contraire de l'affiché. */
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: read(),
  setTheme: (theme) => {
    localStorage.setItem(KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => {
    const current = get().theme;
    const showingDark =
      current === 'dark' ||
      (current === 'system' &&
        typeof matchMedia !== 'undefined' &&
        matchMedia('(prefers-color-scheme: dark)').matches);
    get().setTheme(showingDark ? 'light' : 'dark');
  },
}));

/** Le thème est appliqué avant le premier rendu: pas de flash de page claire. */
export function bootTheme(): void {
  applyTheme(read());
}
