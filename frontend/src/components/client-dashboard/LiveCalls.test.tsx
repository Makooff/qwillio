import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import LiveCalls from './LiveCalls';

/* A8 — le composant doit distinguer « aucun appel » (vraie absence) d'un
   échec du sondage (dernier état connu, horodaté). Avant: l'erreur était
   avalée et la liste passait à vide, faisant disparaître un appel réel sans
   rien dire. */

const fetchLive = vi.fn();
vi.mock('../../services/liveData', () => ({
  fetchLive: (...a: unknown[]) => fetchLive(...a),
}));

beforeEach(() => {
  vi.useFakeTimers();
  fetchLive.mockReset();
  /* jsdom n'implémente pas scrollIntoView (utilisé pour suivre le bas du
     transcript). */
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const APPEL = {
  id: 'call-1',
  callerNumber: '+32470123456',
  startedAt: new Date('2026-10-04T10:00:00Z').toISOString(),
  lines: [{ role: 'user' as const, text: 'Bonjour', at: 1 }],
};

async function avance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('LiveCalls — stale vs vraie absence', () => {
  it('n’affiche rien quand la réponse est une liste vide (vraie absence)', async () => {
    fetchLive.mockResolvedValue({ data: [] });
    const { container } = render(<LiveCalls />);
    await avance(0);
    expect(container).toBeEmptyDOMElement();
  });

  it('success → erreur: garde le dernier état connu et l’annonce comme périmé', async () => {
    fetchLive.mockResolvedValueOnce({ data: [APPEL] });
    render(<LiveCalls lang="fr" />);
    await avance(0);
    expect(screen.getByText('En cours')).toBeInTheDocument();

    fetchLive.mockRejectedValue(new Error('network'));
    await avance(2000);
    // L'appel reste visible, mais marqué comme périmé — pas présenté à jour.
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('horodate la dernière réussite sur l’indicateur stale', async () => {
    fetchLive.mockResolvedValueOnce({ data: [APPEL] });
    render(<LiveCalls lang="fr" />);
    await avance(0);
    fetchLive.mockRejectedValue(new Error('network'));
    await avance(2000);
    expect(screen.getByRole('status').textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('erreur → recovery: l’indicateur disparait et les données fraîches reviennent', async () => {
    fetchLive.mockResolvedValueOnce({ data: [APPEL] });
    render(<LiveCalls lang="fr" />);
    await avance(0);

    fetchLive.mockRejectedValue(new Error('network'));
    await avance(2000);
    expect(screen.getByRole('status')).toBeInTheDocument();

    fetchLive.mockResolvedValueOnce({ data: [] });
    await avance(2000);
    // Vraie absence après récupération: plus rien, et plus d'indicateur.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('n’affiche pas d’état stale avant le premier succès (rien de connu)', async () => {
    fetchLive.mockRejectedValue(new Error('network'));
    const { container } = render(<LiveCalls lang="fr" />);
    await avance(4000);
    expect(container).toBeEmptyDOMElement();
  });

  it('chaînes anglaises quand lang="en"', async () => {
    fetchLive.mockResolvedValueOnce({ data: [APPEL] });
    render(<LiveCalls lang="en" />);
    await avance(0);
    fetchLive.mockRejectedValue(new Error('network'));
    await avance(2000);
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
  });
});
