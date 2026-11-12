import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get, post, patch, delete: vi.fn() } }));

import ProspectNotes, { OutcomePicker } from './ProspectNotes';

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('ProspectNotes', () => {
  it('affiche les notes du prospect, et ajoute la nouvelle en tete', async () => {
    get.mockResolvedValue({ data: { data: [
      { id: 'n1', body: 'Rappeler mardi', createdAt: '2026-11-10T10:00:00Z', updatedAt: '2026-11-10T10:00:00Z' },
    ] } });
    post.mockResolvedValue({ data: { id: 'n2', body: 'Intéressé par Pro', createdAt: '2026-11-12T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z' } });
    const onCount = vi.fn();
    render(<ProspectNotes prospectId="p1" onCountChange={onCount} />);

    expect(await screen.findByText('Rappeler mardi')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/prospects/p1/notes');

    fireEvent.change(screen.getByPlaceholderText(/Ce qu'il a dit/), { target: { value: '  Intéressé par Pro ' } });
    fireEvent.click(screen.getByText('Ajouter la note'));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/prospects/p1/notes', { body: 'Intéressé par Pro' }));
    expect(await screen.findByText('Intéressé par Pro')).toBeInTheDocument();
    expect(onCount).toHaveBeenLastCalledWith(2, expect.objectContaining({ id: 'n2' }));
  });

  it("n'envoie pas une note vide", async () => {
    get.mockResolvedValue({ data: { data: [] } });
    render(<ProspectNotes prospectId="p1" />);
    await screen.findByText("Aucune note pour l'instant.");
    fireEvent.click(screen.getByText('Ajouter la note'));
    expect(post).not.toHaveBeenCalled();
  });
});

describe('OutcomePicker', () => {
  it("envoie l'issue choisie et remonte le statut rendu par le serveur", async () => {
    patch.mockResolvedValue({ data: { id: 'p1', status: 'callback' } });
    const onChange = vi.fn();
    render(<OutcomePicker prospectId="p1" status="contacted" onChange={onChange} />);
    fireEvent.click(screen.getByText('À rappeler'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('callback'));
    expect(patch).toHaveBeenCalledWith('/prospects/p1/outcome', { outcome: 'callback' });
  });

  it('ne propose rien pour un client converti', () => {
    render(<OutcomePicker prospectId="p1" status="converted" onChange={vi.fn()} />);
    expect(screen.queryByText('À rappeler')).not.toBeInTheDocument();
    expect(screen.getByText('Ce prospect est devenu client.')).toBeInTheDocument();
  });
});
