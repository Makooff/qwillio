import { create } from 'zustand';
import type { Lang, TranslationKey } from '../i18n';
import { t as translate } from '../i18n';

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

export const useLang = create<LangState>((set, get) => ({
  lang: (localStorage.getItem('qwillio-lang') as Lang) || 'en',
  setLang: (lang: Lang) => {
    localStorage.setItem('qwillio-lang', lang);
    set({ lang });
  },
  t: (key: TranslationKey) => translate(key, get().lang),
}));
