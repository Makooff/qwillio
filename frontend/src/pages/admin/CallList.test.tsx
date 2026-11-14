import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ default: apiMock }));

import CallList from './CallList';

const rows = [
  { id: 'a', businessName: 'Chauffage Lambert', city: 'Wavre', phone: '+32470112233', email: 'info@lambert.be', status: 'new', callAttempts: 0, nextActionDate: null, lastLog: null, logCount: 0 },
  { id: 'b', businessName: 'Plomberie Dubois', city: 'Wavre', phone: '+32470998877', email: null, status: 'new', callAttempts: 0, nextActionDate: null, lastLog: null, logCount: 0 },
];
const emptyStats = { days: 30, calls: 0, reached: 0, meetings: 0, reachRate: null, meetingRate: null, byOutcome: [], byObjection: [], byWindow: [], byNiche: [] };

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.get.mockImplementation((url: string) => {
    if (url.includes('/call-list/stats')) return Promise.resolve({ data: emptyStats });
    if (url.endsWith('/call-list')) return Promise.resolve({ data: { data: rows } });
    return Promise.resolve({ data: { data: [] } });
  });
});
afterEach(cleanup);

const page = () => render(<MemoryRouter><CallList /></MemoryRouter>);

describe('À appeler', () => {
  it('consigne un refus avec sa raison et sort la fiche de la liste', async () => {
    apiMock.post.mockResolvedValue({ data: { ok: true, removedFromList: true, log: { id: 'l1', outcome: 'refused', objection: 'anti_ai', note: null, callbackAt: null, createdAt: new Date().toISOString() } } });
    page();
    fireEvent.click(await screen.findByText('Chauffage Lambert'));
    fireEvent.click(screen.getByRole('button', { name: 'Refus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Contre l’IA' }));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Ne veut pas de robot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consigner l’appel' }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/prospects/a/call-logs', {
      outcome: 'refused', objection: 'anti_ai', note: 'Ne veut pas de robot', callbackAt: null,
    }));
    await waitFor(() => expect(screen.queryByText('Chauffage Lambert')).not.toBeInTheDocument());
    expect(screen.getByText('Plomberie Dubois')).toBeInTheDocument();
  });

  it('n’envoie pas la raison d’un refus sur une autre issue', async () => {
    apiMock.post.mockResolvedValue({ data: { ok: true, removedFromList: false, log: { id: 'l2', outcome: 'no_answer', objection: null, note: null, callbackAt: null, createdAt: new Date().toISOString() } } });
    page();
    fireEvent.click(await screen.findByText('Chauffage Lambert'));
    fireEvent.click(screen.getByRole('button', { name: 'Refus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trop cher' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pas de réponse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consigner l’appel' }));
    await waitFor(() => expect(apiMock.post.mock.calls[0][1]).toMatchObject({ outcome: 'no_answer', objection: null }));
    // La fiche reste, et la ligne dit qu'elle a été appelée.
    expect(await screen.findByText(/1 appel/)).toBeInTheDocument();
  });

  it('ne laisse rien consigner sans issue, et retire une fiche à la main', async () => {
    apiMock.post.mockResolvedValue({ data: { id: 'b', callListAt: null } });
    page();
    fireEvent.click(await screen.findByText('Plomberie Dubois'));
    expect(screen.getByRole('button', { name: 'Choisissez une issue' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer Plomberie Dubois de la liste' }));
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/prospects/b/call-list', { inList: false }));
    expect(screen.queryByText('Plomberie Dubois')).not.toBeInTheDocument();
  });
});
