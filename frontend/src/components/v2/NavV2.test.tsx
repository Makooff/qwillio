import type { ReactNode } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import NavV2 from './NavV2';

/* Captures et verre liquide: rien à tester ici, on isole la nav. */
vi.mock('./ScreenShot', () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }));
vi.mock('./TryVoiceButton', () => ({ default: ({ children }: { children: ReactNode }) => <button>{children}</button> }));
vi.mock('./motion/GlowCard', () => ({ useGlow: () => ({ current: null }) }));
vi.mock('./ui/liquid-glass', () => ({
  default: () => <span data-glass-skin="true" />,
  GlassFilter: () => null,
  GLASS_FILTER_ID: 'q2-liquid-glass',
  useLiquidGlassSupport: () => false,
}));

afterEach(cleanup);

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

const wrap = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <NavV2 />
    </MemoryRouter>,
  );

/* Le voile: parent masqué (maskImage/WebkitMaskImage) contenant un enfant qui
   porte le backdrop-filter. C'est la structure qui évite le bug WebKit où un
   backdrop-filter posé sur un élément masqué n'est pas rendu. */
const veil = (container: HTMLElement) => {
  const header = container.querySelector<HTMLElement>('#q2-nav-header');
  expect(header).not.toBeNull();
  const masked = Array.from(header!.querySelectorAll<HTMLElement>('[aria-hidden="true"]')).find(
    (el) => (el.style.maskImage || '').includes('linear-gradient'),
  );
  expect(masked, 'voile masqué présent dans l’en-tête').toBeDefined();
  const filter = masked!.firstElementChild as HTMLElement | null;
  expect(filter, 'enfant portant le backdrop-filter').not.toBeNull();
  return { header: header!, masked: masked!, filter: filter! };
};

const scrollTo = (y: number) => {
  act(() => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  });
};

describe('NavV2 — voile de flou progressif (demande utilisateur: flou en haut sur toutes les pages, comme le dashboard)', () => {
  it('rend le voile de flou sur une page à en-tête simple (/pricing), pas seulement l’accueil', () => {
    const { container } = wrap('/pricing');
    const { masked, filter } = veil(container);
    expect(masked.style.display).not.toBe('none');
    expect(filter.style.backdropFilter).toContain('blur(22px)');
    expect(filter.style.backdropFilter).toContain('saturate(140%)');
  });

  it('sépare le masque (parent) du backdrop-filter (enfant) pour WebKit', () => {
    const { container } = wrap('/');
    const { masked, filter } = veil(container);
    /* jsdom déduplique les préfixes webkit dans l'attribut style; le
       principe testé est la SÉPARATION masque/filter entre parent et enfant. */
    expect(masked.getAttribute('style')).toContain('mask-image');
    expect(masked.getAttribute('style')).toContain('linear-gradient');
    expect(filter.getAttribute('style') || '').not.toContain('mask');
  });

  it('garde le voile pleine largeur, sans interception de pointeur, et qui déborde sous la barre', () => {
    const { container } = wrap('/');
    const { header, masked } = veil(container);
    expect(masked.parentElement).toBe(header);
    expect(masked.className).toContain('pointer-events-none');
    expect(masked.className).toContain('inset-x-0');
    /* Déborde sous la barre: c'est le débordement qui fait la dissolution
       progressive au lieu d'un bord franc. */
    expect(parseFloat(masked.style.height)).toBeGreaterThan(100);
  });

  it('persiste quand la barre se détache en bulle flottante (scroll > 80px)', () => {
    const { container } = wrap('/');
    scrollTo(120);
    const { masked, filter } = veil(container);
    /* La bulle flottante vit, mais le voile pleine largeur ne s'éteint plus:
       c'est précisément la régression corrigée (le haut reste flou partout). */
    expect(masked.style.opacity).toBe('1');
    expect(masked.style.display).not.toBe('none');
    expect(filter.style.backdropFilter).toContain('blur(22px)');
  });

  it('teinte claire: dégradé opaque en haut rendu transparent en bas, jamais une barre opaque', () => {
    const { container } = wrap('/');
    const { filter } = veil(container);
    const bg = filter.style.background;
    expect(bg).toContain('linear-gradient');
    /* Se termine totalement transparent: pas de bande opaque en travers. */
    expect(bg).toMatch(/\/\s*0\)\s*100%/);
  });

  it('teinte sombre en thème dark: dégradé foncé opaque en haut qui s’éteint', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { container } = wrap('/');
    const { filter } = veil(container);
    const bg = filter.style.background;
    expect(bg).toContain('rgba(10,10,10,0.97)');
    expect(bg).toMatch(/rgba\(10,\s*10,\s*10,\s*0\)\s*100%/);
  });

  it('le header lui-même ne porte aucun fond opaque au repos (pas de barre dure sous le voile)', () => {
    const { container } = wrap('/');
    const { header } = veil(container);
    expect(header.style.background || '').toBe('');
    expect(header.className).not.toContain('bg-q2-canvas');
  });
});
