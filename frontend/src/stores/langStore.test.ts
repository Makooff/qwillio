import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * La langue du site, devinée à partir du FUSEAU HORAIRE.
 *
 * Ce que ces tests tiennent, et qui était le défaut: `navigator.language`
 * décrit la langue de l'appareil, pas le pays. Un Bruxellois dont le téléphone
 * est en anglais — cas courant — recevait un site anglais alors qu'il est
 * précisément le client visé. Le fuseau répond à la bonne question.
 */
function loadWith(zone: string | undefined, navLang: string, saved?: string) {
  vi.resetModules();
  vi.stubGlobal('Intl', {
    ...Intl,
    DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }),
  } as unknown as typeof Intl);
  vi.stubGlobal('navigator', { language: navLang } as Navigator);
  localStorage.clear();
  if (saved) localStorage.setItem('qwillio-lang', saved);
  return import('./langStore');
}

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
beforeEach(() => { vi.resetModules(); });

describe('détection de la langue', () => {
  it('sert le français à Bruxelles même si le téléphone est en anglais', async () => {
    const { useLang } = await loadWith('Europe/Brussels', 'en-US');
    expect(useLang.getState().lang).toBe('fr');
  });

  it('sert le français à Paris et au Québec', async () => {
    expect((await loadWith('Europe/Paris', 'en-GB')).useLang.getState().lang).toBe('fr');
    expect((await loadWith('America/Montreal', 'en-CA')).useLang.getState().lang).toBe('fr');
  });

  /* On ne devine pas au-delà de ce qui est listé: servir du français à Berlin
     serait pire que de servir de l'anglais, parce que ce serait affirmatif. */
  it('ne sert pas le français hors des zones francophones', async () => {
    const { useLang } = await loadWith('Europe/Berlin', 'en-US');
    expect(useLang.getState().lang).toBe('en');
  });

  it('retombe sur la langue de l’appareil quand le fuseau est inconnu', async () => {
    expect((await loadWith(undefined, 'en-US')).useLang.getState().lang).toBe('en');
    expect((await loadWith(undefined, 'fr-FR')).useLang.getState().lang).toBe('fr');
  });

  /* Le choix explicite l'emporte sur tout: sans ça, le sélecteur de la barre
     serait défait à chaque rechargement par la détection. */
  it('respecte le choix enregistré avant toute détection', async () => {
    const { useLang } = await loadWith('Europe/Brussels', 'fr-FR', 'en');
    expect(useLang.getState().lang).toBe('en');
  });
});
