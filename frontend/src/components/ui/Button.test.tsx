import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import Button from './Button';
import { t } from '../../styles/admin-theme';

afterEach(cleanup);

describe('Button (design system)', () => {
  /* Décision utilisateur 2026-10: l'action primaire est en CONTOUR mauve,
     fond transparent — plus de remplissage mauve. Le texte est en `t.brandHi`
     (#8a6fff, AA sur le fond sombre) et non `t.brand` (sous le seuil). */
  it('primary variant is an outlined brand button (no purple fill)', () => {
    render(<Button>Enregistrer</Button>);
    const btn = screen.getByRole('button', { name: 'Enregistrer' });
    expect(btn).toHaveStyle({
      background: 'transparent',
      color: t.brandHi,
      border: `1px solid ${t.brandHi}`,
    });
  });

  it('danger variant uses the danger token', () => {
    render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveStyle({ background: t.danger });
  });

  it('ghost variant is transparent with secondary text', () => {
    render(<Button variant="ghost">Annuler</Button>);
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveStyle({ background: 'transparent', color: t.textSec });
  });

  /* Le survol ne remplit PAS en mauve (demande utilisateur): un lavage
     neutre suffit. */
  it('applies a neutral hover wash on mouse over (no purple fill)', () => {
    render(<Button>OK</Button>);
    const btn = screen.getByRole('button', { name: 'OK' });
    fireEvent.mouseOver(btn);
    expect(btn).toHaveStyle({ background: 'rgba(255,255,255,0.06)' });
  });

  it('loading disables the button and announces busy state', () => {
    render(<Button loading>Envoyer</Button>);
    const btn = screen.getByRole('button', { name: 'Envoyer' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('invokes onClick when enabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Cliquez</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Cliquez' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('forwards ref to the underlying button', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Focus moi</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });

  it('honours an explicit type="submit" (type attribute preserved)', () => {
    render(<Button type="submit">Soumettre</Button>);
    expect(screen.getByRole('button', { name: 'Soumettre' })).toHaveAttribute('type', 'submit');
  });

  it('preserves caller onFocus/onBlur handlers', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(<Button onFocus={onFocus} onBlur={onBlur}>Handlers</Button>);
    const btn = screen.getByRole('button', { name: 'Handlers' });
    fireEvent.focus(btn);
    fireEvent.blur(btn);
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('shows the explicit focus ring on keyboard focus (:focus-visible)', () => {
    render(<Button>Clavier</Button>);
    const btn = screen.getByRole('button', { name: 'Clavier' });
    // jsdom ne calcule pas :focus-visible; on force le match pour le test.
    btn.matches = () => true;
    fireEvent.focus(btn);
    expect(btn).toHaveStyle({ boxShadow: `0 0 0 2px ${t.borderFocus}` });
    fireEvent.blur(btn);
    expect(btn).not.toHaveStyle({ boxShadow: `0 0 0 2px ${t.borderFocus}` });
  });
});
