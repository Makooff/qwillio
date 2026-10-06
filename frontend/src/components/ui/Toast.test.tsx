import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ToastContainer from './Toast';
import type { Toast } from '../../hooks/useToast';

afterEach(cleanup);

const toasts: Toast[] = [
  { id: 'a', type: 'success', message: 'Enregistré.' },
  { id: 'b', type: 'error', message: 'Échec de l’envoi.' },
];

describe('ToastContainer (ui commun)', () => {
  it('nomme le bouton de fermeture de chaque notification', () => {
    render(<ToastContainer toasts={toasts} remove={() => {}} />);
    const dismissButtons = screen.getAllByRole('button', { name: 'Fermer la notification' });
    expect(dismissButtons).toHaveLength(2);
  });

  it('appelle remove avec l’identifiant du toast', () => {
    const remove = vi.fn();
    render(<ToastContainer toasts={toasts} remove={remove} />);
    screen.getAllByRole('button', { name: 'Fermer la notification' })[1].click();
    expect(remove).toHaveBeenCalledWith('b');
  });

  it('annonce le message dans le document', () => {
    render(<ToastContainer toasts={toasts} remove={() => {}} />);
    expect(screen.getByText('Enregistré.')).toBeInTheDocument();
  });
});
