import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AnimatePresence } from 'framer-motion';
import SlideOver from './SlideOver';

afterEach(cleanup);

function renderOver(onClose = vi.fn()) {
  return render(
    <AnimatePresence>
      <SlideOver title="Détails du lead" onClose={onClose}>
        <div className="p-6"><p>Contenu de la fiche</p></div>
      </SlideOver>
    </AnimatePresence>
  );
}

describe('SlideOver (fiche appel / fiche lead)', () => {
  it('déclare un dialogue modal nommé et focalise la fermeture', () => {
    renderOver();
    expect(screen.getByRole('dialog', { name: 'Détails du lead' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toHaveFocus();
  });

  it('ferme avec Echap et restitue le focus au déclencheur', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const view = renderOver(onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('ferme au clic sur le voile', () => {
    const onClose = vi.fn();
    renderOver(onClose);
    fireEvent.click(document.querySelector('.fixed.inset-0') as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('garde la navigation Tab dans le panneau', () => {
    renderOver();
    const close = screen.getByRole('button', { name: 'Fermer le panneau' });
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
  });

  it('verrouille le défilement du document puis le restitue', () => {
    const view = renderOver();
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('le bouton Fermer porte un anneau de focus clavier visible', () => {
    renderOver();
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toHaveClass(
      'focus-visible:ring-2'
    );
  });
});
