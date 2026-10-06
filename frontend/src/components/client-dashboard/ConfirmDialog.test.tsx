import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ConfirmDialog from './ConfirmDialog';
afterEach(cleanup);
const props = { open: true, title: 'Annuler ce rendez-vous ?', message: 'Le créneau sera libéré.', confirmLabel: 'Annuler le rendez-vous', cancelLabel: 'Conserver', onConfirm: vi.fn(), onCancel: vi.fn() };
describe('Confirmation du portail', () => {
  it('annonce le titre et la conséquence et focalise le choix non destructif', () => {
    render(<ConfirmDialog {...props} />);
    expect(screen.getByRole('dialog', { name: props.title })).toHaveAccessibleDescription(props.message);
    expect(screen.getByRole('button', { name: 'Conserver' })).toHaveFocus();
  });
  it('ferme avec Echap et restitue le focus au déclencheur', () => {
    const button = document.createElement('button'); document.body.appendChild(button); button.focus();
    const cancel = vi.fn(); const view = render(<ConfirmDialog {...props} onCancel={cancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cancel).toHaveBeenCalledOnce(); view.unmount(); expect(button).toHaveFocus(); button.remove();
  });
  it('garde la navigation Tab dans la fenêtre', () => {
    render(<ConfirmDialog {...props} />);
    screen.getByRole('button', { name: props.confirmLabel }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: props.confirmLabel })).toHaveFocus();
  });
  it('préserve le verrouillage du défilement préexistant', () => {
    document.body.style.overflow = 'clip';
    const view = render(<ConfirmDialog {...props} />);
    expect(document.body.style.overflow).toBe('hidden'); view.unmount();
    expect(document.body.style.overflow).toBe('clip'); document.body.style.overflow = '';
  });
});
