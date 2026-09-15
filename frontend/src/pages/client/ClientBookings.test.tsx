import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import ClientBookings from './ClientBookings';

/* Le calendrier des rendez-vous (15/09/2026): la grille du mois porte un
   compte par jour, un jour choisi ouvre ses rendez-vous, un rendez-vous
   déplié lit la fiche de l'appelant et mène aux appels et au lead filtrés
   sur son numéro. L'annulation passe toujours par le serveur. */

const get = vi.fn();
const post = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }));
vi.mock('../../services/liveData', () => ({ invalidateLive: vi.fn() }));

const rows = [
  { id: 'b1', customerName: 'Paul Matthieu', customerPhone: '32483620980', bookingDate: '2026-09-15T10:00:00.000Z', bookingTime: '17:00', serviceType: 'Détartrage', status: 'confirmed' },
  { id: 'b2', customerName: 'Jean-Luc de la Forge', customerPhone: '32483620980', bookingDate: '2026-09-15T10:00:00.000Z', bookingTime: '16:00', serviceType: null, status: 'confirmed' },
  { id: 'b3', customerName: 'Marie Client', customerPhone: null, bookingDate: '2026-09-22T10:00:00.000Z', bookingTime: '09:00', serviceType: 'Carie', status: 'confirmed' },
];
const context = {
  booking: { id: 'b2', customerName: 'Jean-Luc de la Forge', customerPhone: '32483620980' },
  caller: { knownName: 'Jean-Luc de la Forge', totalCalls: 3, lastCallAt: '2026-09-13T04:11:18.000Z', lastSummary: 'Déplacement du rendez-vous' },
  calls: [{ id: 'c1', callerName: 'Jean-Luc', createdAt: '2026-09-13T04:11:18.000Z', durationSeconds: 120, summary: 'Prise de rendez-vous', isLead: true, leadScore: 80 }],
  lead: { id: 'c1', callerName: 'Jean-Luc', createdAt: '2026-09-13T04:11:18.000Z', durationSeconds: 120, summary: 'Souhaite un détartrage', isLead: true, leadScore: 80 },
  otherBookings: [],
};

const mount = () => render(<MemoryRouter><ClientBookings initialMonth={new Date(2026, 8, 1)} /></MemoryRouter>);

beforeEach(() => {
  get.mockReset(); post.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url.includes('/context')) return { data: context };
    return { data: { data: rows } };
  });
  post.mockResolvedValue({ data: { ok: true } });
});
afterEach(cleanup);

describe('ClientBookings, le calendrier', () => {
  it('charge le mois affiché et porte le compte sur chaque jour', async () => {
    mount();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/my-dashboard/bookings?from=2026-09-01&to=2026-09-30&limit=500'));
    const day15 = await screen.findByRole('gridcell', { name: /Mardi 15 septembre, 2 rendez-vous/ });
    expect(day15).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Mardi 22 septembre, 1 rendez-vous/ })).toBeInTheDocument();
    expect(screen.getByText('Septembre 2026')).toBeInTheDocument();
    expect(screen.getByText(/3 rendez-vous en septembre 2026/)).toBeInTheDocument();
  });

  it('un jour choisi ouvre ses rendez-vous, triés par heure', async () => {
    mount();
    fireEvent.click(await screen.findByRole('gridcell', { name: /Mardi 15 septembre/ }));
    const panel = screen.getByRole('complementary', { name: 'Détail' });
    expect(within(panel).getByRole('heading', { name: 'Mardi 15 septembre' })).toBeInTheDocument();
    const names = within(panel).getAllByRole('button', { expanded: false }).map(b => b.textContent);
    expect(names[0]).toMatch(/16:00.*Jean-Luc de la Forge/);
    expect(names[1]).toMatch(/17:00.*Paul Matthieu/);
    expect(within(panel).queryByText('Marie Client')).toBeNull();
  });

  it('un rendez-vous déplié lit la fiche et mène aux appels et au lead de ce numéro', async () => {
    mount();
    fireEvent.click(await screen.findByRole('gridcell', { name: /Mardi 15 septembre/ }));
    fireEvent.click(screen.getByRole('button', { name: /Jean-Luc de la Forge/ }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/my-dashboard/bookings/b2/context'));
    expect(await screen.findByText(/3 appels, dernier le 13 sept/)).toBeInTheDocument();
    expect(screen.getByText(/Souhaite un détartrage · score 80/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tous ses appels/ })).toHaveAttribute('href', '/dashboard/calls?phone=32483620980');
    expect(screen.getByRole('link', { name: /Voir le lead/ })).toHaveAttribute('href', '/dashboard/leads?phone=32483620980');
  });

  it('annule après confirmation, par la route serveur, et retire la carte', async () => {
    mount();
    fireEvent.click(await screen.findByRole('gridcell', { name: /Mardi 15 septembre/ }));
    fireEvent.click(screen.getByRole('button', { name: /Paul Matthieu/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le rendez-vous de Paul Matthieu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le rendez-vous' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/my-dashboard/bookings/b1/cancel'));
    await waitFor(() => expect(screen.queryByText('Paul Matthieu')).toBeNull());
    expect(screen.getByText('Jean-Luc de la Forge')).toBeInTheDocument();
  });

  it('changer de mois recharge la bonne plage', async () => {
    mount();
    await screen.findByText('Septembre 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/my-dashboard/bookings?from=2026-10-01&to=2026-10-31&limit=500'));
    expect(screen.getByText('Octobre 2026')).toBeInTheDocument();
  });

  it('la vue liste montre tout le mois, groupé par jour', async () => {
    mount();
    await screen.findByText('Septembre 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Vue liste' }));
    expect(screen.getByRole('heading', { name: /Mardi 15 septembre/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mardi 22 septembre/ })).toBeInTheDocument();
    expect(screen.getByText('Marie Client')).toBeInTheDocument();
  });

  it('état vide', async () => {
    get.mockResolvedValueOnce({ data: { data: [] } });
    mount();
    expect(await screen.findByText('Rien de prévu pour l’instant.')).toBeInTheDocument();
  });
});
