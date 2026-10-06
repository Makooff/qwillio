import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ConfirmDialog from './ConfirmDialog';

afterEach(cleanup);

const props = {
  open: true,
  title: 'Supprimer ce devis ?',
  message: 'Le devis sera définitivement perdu.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog (ui commun)', () => {
  it('déclare un dialogue modal nommé et décrit, focalise l\'annulation', () => {
    render(<ConfirmDialog {...props} />);
    const dialog = screen.getByRole('dialog', { name: 'Supprimer ce devis ?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Le devis sera définitivement perdu.');
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
  });

  it('ferme avec Echap et restitue le focus au déclencheur', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onCancel = vi.fn();
    const view = render(<ConfirmDialog {...props} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('boucle la navigation Tab aux extrémités des deux actions', () => {
    render(<ConfirmDialog {...props} />);
    const cancel = screen.getByRole('button', { name: 'Annuler' });
    const confirm = screen.getByRole('button', { name: 'Confirmer' });
    // Dernier → Tab → premier.
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    // Premier → Maj+Tab → dernier.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it('verrouille le défilement du document puis le restitue', () => {
    const view = render(<ConfirmDialog {...props} />);
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('préserve le verrouillage de défilement préexistant', () => {
    document.body.style.overflow = 'clip';
    const view = render(<ConfirmDialog {...props} />);
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('clip');
    document.body.style.overflow = '';
  });

  it('désactive le bouton de confirmation pendant le chargement', () => {
    render(<ConfirmDialog {...props} loading />);
    // En chargement le libellé est remplacé par « ... » (le focus reste sur
    // l'annulation, action non destructive).
    const confirm = screen.getByRole('button', { name: '...' });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
  });
});
