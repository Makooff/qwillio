import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Modal from './Modal';

afterEach(cleanup);

const props = {
  open: true,
  onClose: vi.fn(),
  title: 'Modifier le client',
  children: <p>Contenu du formulaire</p>,
};

describe('Modal (ui commun)', () => {
  it('déclare un dialogue modal nommé et décrit', () => {
    render(<Modal {...props} subtitle="Sous-titre" />);
    const dialog = screen.getByRole('dialog', { name: 'Modifier le client' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('donne un nom accessible au bouton de fermeture', () => {
    render(<Modal {...props} />);
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('déplace le focus dans la fenêtre à l\'ouverture', () => {
    render(<Modal {...props} />);
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
  });

  it('restitue le focus au déclencheur à la fermeture', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const view = render(<Modal {...props} />);
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('ferme avec Echap', () => {
    const onClose = vi.fn();
    render(<Modal {...props} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('garde la navigation Tab dans la fenêtre (boucle aux extrémités)', () => {
    render(
      <Modal {...props} footer={<button>Enregistrer</button>}>
        <button>Premier</button>
      </Modal>
    );
    const close = screen.getByRole('button', { name: 'Fermer' });
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    // Dernier élément → Tab boucle sur le premier.
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    // Premier élément → Maj+Tab boucle sur le dernier.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
    /* NOTE: la navigation entre éléments intermédiaires relève du navigateur
       (jsdom ne déplace pas le focus sur Tab) ; seuls les rebouclages aux
       bornes sont vérifiables ici. */
  });

  it('verrouille le défilement du document puis le restitue', () => {
    const view = render(<Modal {...props} />);
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('ne rend rien quand fermée', () => {
    render(<Modal {...props} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
