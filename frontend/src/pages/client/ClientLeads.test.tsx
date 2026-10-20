import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientLeads from './ClientLeads';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), fetch: vi.fn(), add: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: mocks.get, put: mocks.put } }));
vi.mock('../../services/liveData', () => ({ fetchLive: mocks.fetch, peekLive: vi.fn(), invalidateLive: vi.fn() }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ add: mocks.add, remove: vi.fn(), toasts: [] }) }));
vi.mock('../../components/dashboard/PageHeader', () => ({ default: (p: any) => <><h1>{p.title}</h1><div>{p.subtitle}</div><input aria-label="Rechercher les leads" value={p.search.value} onChange={e => p.search.onChange(e.target.value)} />{p.kpis.map((k: any) => <button key={k.label} onClick={k.onClick}>{k.label}: {k.value}</button>)}</> }));
vi.mock('framer-motion', () => ({ motion: { div: ({ children, initial, animate, exit, transition, layout, ...props }: any) => <div {...props}>{children}</div> }, AnimatePresence: ({ children }: any) => <>{children}</> }));

const lead = { id: 'last-call', identityKey: 'phone:+32477123456', callerName: 'Alice Martin', callerNumber: '+32477123456', callCount: 2, callIds: ['old-call', 'last-call'], createdAt: '2026-10-20T12:00:00Z', leadStatus: 'contacted', leadScore: 8, notes: 'Note conservée', tags: [], contactId: 'crm1' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({ data: [lead], pagination: { page: 1, totalPages: 1, total: 1 } });
  mocks.get.mockResolvedValue({ data: { contacts: [{ id: 'crm1', name: 'Alice Martin', phone: '+32477123456', status: 'qualified', tags: [] }, { id: 'manual', name: 'Bob manuel', phone: '+33698765432', status: 'new', tags: [] }], pagination: { pages: 1 } } });
  mocks.put.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

const mount = () => render(<MemoryRouter><ClientLeads /></MemoryRouter>);

describe('leads : contrat CRM, identité et actions', () => {
  it('permet d’effacer une note existante sans la ressusciter côté client', async () => {
    mocks.put.mockImplementationOnce(async () => {
      mocks.fetch.mockResolvedValue({ data: [{ ...lead, notes: '' }], pagination: { totalPages: 1 } });
      return { data: { success: true } };
    });
    mount();
    fireEvent.click(await screen.findByText('Alice Martin'));
    const note = await screen.findByPlaceholderText('Ajouter des notes sur ce lead...');
    fireEvent.change(note, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/my-dashboard/leads/last-call/notes', { notes: '' }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect((note as HTMLTextAreaElement).value).toBe('');
  });

  it('ne prétend pas qu’un statut est enregistré si le serveur le refuse', async () => {
    mocks.put.mockRejectedValueOnce(new Error('offline'));
    mount();
    fireEvent.click(await screen.findByText('Alice Martin'));
    fireEvent.click(screen.getByRole('button', { name: 'Perdu' }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith('Le changement de statut n’a pas été enregistré.', 'error'));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('signale un chargement impossible et permet de réessayer', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Alice Martin')).toBeTruthy();
  });

  it('lit contacts et non data, compte les personnes et préserve le nombre d’appels', async () => {
    mount();
    expect(await screen.findByText('Bob manuel')).toBeTruthy();
    expect(screen.getByText('2 appels')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Total: 2' })).toBeTruthy();
  });

  it('ouvre les détails du lead avec CRM, réhydrate les notes et fournit l’historique', async () => {
    mount();
    fireEvent.click(await screen.findByText('Alice Martin'));
    const note = await screen.findByPlaceholderText('Ajouter des notes sur ce lead...') as HTMLTextAreaElement;
    expect(note.value).toBe('Note conservée');
    expect(screen.getByRole('button', { name: /Historique des 2 appels/ })).toBeTruthy();
    fireEvent.change(note, { target: { value: 'À rappeler mardi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/my-dashboard/leads/last-call/notes', { notes: 'À rappeler mardi' }));
  });

  it('enregistre un statut sur le groupe puis recharge la vérité serveur', async () => {
    mount();
    const name = await screen.findByText('Alice Martin');
    fireEvent.click(name);
    fireEvent.click(screen.getByRole('button', { name: 'Perdu' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/my-dashboard/leads/last-call/status', { status: 'lost' }));
    await waitFor(() => expect(mocks.fetch.mock.calls.length).toBeGreaterThan(1));
  });

  it('cherche dans toutes les pages serveur, pas uniquement la première', async () => {
    mocks.fetch.mockImplementation(async (path: string) => ({ data: path.includes('page=2') ? [{ ...lead, id: 'two', identityKey: 'phone:+32477123457', callerNumber: '+32477123457', callerName: 'Deuxième page', contactId: null }] : [lead], pagination: { totalPages: 2 } }));
    mount();
    expect(await screen.findByText('Deuxième page')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Rechercher les leads'), { target: { value: 'Deuxième' } });
    expect(screen.getByText('Deuxième page')).toBeTruthy();
    expect(screen.queryByText('Alice Martin')).toBeNull();
  });
});
