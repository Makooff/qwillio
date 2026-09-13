import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ClientBookings from './ClientBookings';

/* Le portail listait les réservations sans jamais permettre d'en annuler
   une (13/09/2026). L'annulation passe par le serveur, qui est le seul à
   pouvoir aussi retirer l'événement Google et oublier le nom en cache. */

const get = vi.fn();
const post = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }));
vi.mock('../../services/liveData', () => ({ invalidateLive: vi.fn() }));

const rows = [
  { id: 'b1', customerName: 'Paul Matthieu', customerPhone: '32483620980', bookingDate: '2026-09-15T00:00:00.000Z', bookingTime: '17:00', serviceType: 'Détartrage', status: 'confirmed' },
  { id: 'b2', customerName: 'Jean-Luc de la Forge', customerPhone: '32483620980', bookingDate: '2026-09-15T00:00:00.000Z', bookingTime: '16:00', serviceType: null, status: 'confirmed' },
];

beforeEach(() => {
  get.mockReset(); post.mockReset();
  get.mockResolvedValue({ data: { data: rows } });
  post.mockResolvedValue({ data: { ok: true } });
});
afterEach(cleanup);

describe('ClientBookings', () => {
  it('liste les rendez-vous à venir', async () => {
    render(<ClientBookings />);
    expect(await screen.findByText('Paul Matthieu')).toBeInTheDocument();
    expect(screen.getByText('Jean-Luc de la Forge')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/my-dashboard/bookings?limit=100');
  });

  it('annule après confirmation, par la route serveur, et retire la ligne', async () => {
    render(<ClientBookings />);
    await screen.findByText('Paul Matthieu');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le rendez-vous de Paul Matthieu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le rendez-vous' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/my-dashboard/bookings/b1/cancel'));
    await waitFor(() => expect(screen.queryByText('Paul Matthieu')).toBeNull());
    expect(screen.getByText('Jean-Luc de la Forge')).toBeInTheDocument();
  });

  it('« Garder » ne fait rien', async () => {
    render(<ClientBookings />);
    await screen.findByText('Paul Matthieu');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le rendez-vous de Paul Matthieu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Garder' }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText('Paul Matthieu')).toBeInTheDocument();
  });

  it('dit quand le serveur refuse', async () => {
    post.mockRejectedValueOnce({ response: { data: { error: 'Réservation introuvable' } } });
    render(<ClientBookings />);
    await screen.findByText('Paul Matthieu');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le rendez-vous de Paul Matthieu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le rendez-vous' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Réservation introuvable');
    expect(screen.getByText('Paul Matthieu')).toBeInTheDocument();
  });

  it('état vide', async () => {
    get.mockResolvedValueOnce({ data: { data: [] } });
    render(<ClientBookings />);
    expect(await screen.findByText('Rien de prévu pour l’instant.')).toBeInTheDocument();
  });
});
