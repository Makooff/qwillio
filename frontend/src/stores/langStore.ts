import { create } from 'zustand';
import type { Lang, TranslationKey } from '../i18n';
import { t as translate } from '../i18n';

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

/**
 * Les fuseaux où l'on est servi en français.
 *
 * C'est notre géolocalisation, et le mot mérite d'être précisé: pas le GPS.
 * Demander la position réelle ouvre une invite du navigateur, qu'un visiteur
 * refuse à juste titre quand il vient seulement lire une page — et il faudrait
 * l'avoir obtenue AVANT le premier rendu, ce qui est impossible. Le fuseau
 * horaire, lui, est déjà là, connu instantanément, sans permission ni requête.
 *
 * Il est aussi plus juste que ce qu'on utilisait. `navigator.language` décrit
 * la langue du TÉLÉPHONE, pas le pays: un Bruxellois dont l'iPhone est en
 * anglais — cas courant — recevait un site anglais alors qu'il est exactement
 * le client visé. Le fuseau dit où il se trouve, ce qui est la question posée.
 */
const FRENCH_ZONES = new Set([
  'Europe/Brussels', 'Europe/Paris', 'Europe/Luxembourg', 'Europe/Monaco',
  'Europe/Zurich', 'Europe/Vaduz',
  // Le Québec: francophone, et le produit y est vendable tel quel.
  'America/Montreal', 'America/Toronto',
]);

function detectLang(): Lang {
  // Un choix explicite l'emporte toujours: le sélecteur de la barre du site
  // écrit ici, et rien de ce qui est deviné ne doit le contredire ensuite.
  try {
    const saved = localStorage.getItem('qwillio-lang');
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* navigateur restreint: on devine, c'est tout */ }

  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && FRENCH_ZONES.has(zone)) return 'fr';
    /* Tout le reste de l'Europe francophone ou limitrophe qu'on n'a pas
       listée: on ne devine pas au-delà, sinon on servirait du français à
       Berlin. */
    if (zone && zone.startsWith('Africa/') && /Abidjan|Dakar|Bamako|Ouagadougou|Niamey|Lome|Cotonou|Libreville|Brazzaville|Kinshasa|Tunis|Algiers|Casablanca/.test(zone)) {
      return 'fr';
    }
  } catch { /* Intl absent: on retombe sur la langue du navigateur */ }

  // Dernier recours, et seulement là: la langue de l'appareil.
  return navigator.language?.startsWith('en') ? 'en' : 'fr';
}

export const useLang = create<LangState>((set, get) => ({
  lang: detectLang(),
  setLang: (lang: Lang) => {
    localStorage.setItem('qwillio-lang', lang);
    set({ lang });
  },
  t: (key: TranslationKey) => translate(key, get().lang),
}));
