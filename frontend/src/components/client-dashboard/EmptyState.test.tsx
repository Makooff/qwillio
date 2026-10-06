import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EmptyState from './EmptyState';
import { t } from '../../styles/admin-theme';

afterEach(cleanup);

describe('EmptyState (design system)', () => {
  it('renders title and description with token colors', () => {
    render(<EmptyState title="Aucun appel" description="Les enregistrements apparaîtront ici." />);
    expect(screen.getByRole('heading', { name: 'Aucun appel' })).toHaveStyle({ color: t.text });
    expect(screen.getByText('Les enregistrements apparaîtront ici.')).toHaveStyle({ color: t.textSec });
  });

  /* Décision utilisateur 2026-10: contour mauve, fond transparent — plus de
     remplissage mauve sur les actions. */
  it('action button is outlined brand (transparent, brand border) and fires onClick', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Vide" action={{ label: 'Créer', onClick }} />);
    const btn = screen.getByRole('button', { name: 'Créer' });
    expect(btn).toHaveStyle({ background: 'transparent', border: `1px solid ${t.brandHi}` });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
