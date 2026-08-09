import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { LayoutDashboard } from '../icons';
import DashboardShell from './DashboardShell';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { name: 'Mat Pol', email: 'a@b.c' }, logout: () => {} }),
}));

afterEach(cleanup);

function mount() {
  return render(
    <MemoryRouter>
      <DashboardShell
        primaryNav={[{ path: '/dashboard', icon: LayoutDashboard, label: 'Accueil', exact: true }]}
        settingsSub={[{ path: '/dashboard/account', icon: LayoutDashboard, label: 'Compte' }]}
        pageTitles={{ '/': 'Accueil' }}
        mobileNav={[{ path: '/dashboard', icon: LayoutDashboard, label: 'Home', exact: true }]}
        scope="test"
        userFallbackName="Client"
        userFallbackInitials="CL"
      />
    </MemoryRouter>,
  );
}

const header = (c: HTMLElement) => c.querySelector('header')!;

describe('l’entête mobile en vignette', () => {
  /* Ce qu'on a retiré: la plaque opaque et le filet du bas. Les deux
     découpaient l'entête du contenu au lieu de l'y fondre. */
  it('n’a ni fond peint ni bord', () => {
    const { container } = mount();
    const h = header(container);
    expect(h.style.background).toBe('');
    expect(h.style.borderBottom).toBe('');
  });

  /**
   * La régression que ce test tient, et elle ne se voit QUE sur un iPhone.
   *
   * Sur WebKit, un `-webkit-backdrop-filter` posé sur un élément qui porte
   * aussi un `-webkit-mask-image` n'est pas rendu: le voile devient une teinte
   * plate, sans flou. Blink s'en accommode, donc l'erreur passe inaperçue au
   * développement. Le masque et le filtre doivent donc vivre sur DEUX éléments.
   *
   * jsdom ne connaît ni `backdrop-filter` ni son préfixe et les retire de
   * l'attribut `style`: on ne peut pas les lire ici. Ce qui reste vérifiable,
   * et qui est exactement la condition de la correction, c'est la SÉPARATION —
   * la boîte masquée porte une couche fille distincte, reconnaissable au
   * `translateZ(0)` qui accompagne le filtre.
   */
  it('sépare le masque du flou sur deux éléments', () => {
    const { container } = mount();
    const masked = header(container).querySelector<HTMLElement>('[style*="mask-image"]');
    expect(masked).not.toBeNull();

    const layer = masked!.querySelector<HTMLElement>('[style*="translateZ(0)"]');
    expect(layer).not.toBeNull();
    // La couche du filtre ne masque rien, et la boîte masquée ne filtre rien.
    expect(layer!.style.maskImage || '').toBe('');
    expect(layer!.parentElement).toBe(masked);
  });

  /* Le voile déborde sous la barre: c'est ce débordement qui fait la
     dissolution. S'il s'arrêtait à la hauteur de l'entête, il rendrait le bord
     franc qu'on vient d'enlever. */
  it('prolonge le voile sous l’entête', () => {
    const { container } = mount();
    const masked = header(container).querySelector<HTMLElement>('[style*="mask-image"]')!;
    expect(parseInt(masked.style.height, 10)).toBeGreaterThan(100);
  });

  /* Le voile est un élément positionné: il se peint au-dessus du contenu en
     flux. Sans `relative` sur ce qui doit rester lisible, la grille et l'avatar
     passeraient dessous. */
  it('garde le contenu de l’entête au-dessus du voile', () => {
    const { container } = mount();
    const h = header(container);
    const burger = h.querySelector('button')!;
    expect(burger.className).toContain('relative');
  });
});
