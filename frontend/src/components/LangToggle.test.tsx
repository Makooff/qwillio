import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import LangToggle from './LangToggle';
import { useLang } from '../stores/langStore';

afterEach(cleanup);

describe('LangToggle (sélecteur de langue partagé)', () => {
  it('groupe nommé avec deux boutons à bascule, l’état sélectionné en aria-pressed', () => {
    useLang.setState({ lang: 'fr' });
    render(<LangToggle />);
    expect(screen.getByRole('group', { name: 'Language selector' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('cibles tactiles ≥ 28 px même sur libellé court (WCAG 2.5.8)', () => {
    render(<LangToggle />);
    for (const name of ['English', 'Français']) {
      const btn = screen.getByRole('button', { name });
      expect(btn).toHaveClass('min-w-[28px]');
      expect(btn).toHaveClass('min-h-[28px]');
    }
  });

  it('anneau de focus visible au clavier', () => {
    render(<LangToggle />);
    expect(screen.getByRole('button', { name: 'English' })).toHaveClass('focus-visible:ring-2');
  });
});
