import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import ClientSetupGuide from './ClientSetupGuide';

/* Le parcours guidé pose ce qui manque, un par un, et enregistre chaque
   réponse par le PUT partiel de la page Réceptionniste : UNE clé par étape. */

const get = vi.fn();
const put = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } }));
vi.mock('../../services/liveData', () => ({ invalidateLive: vi.fn() }));

const setup = {
  score: 20, openGaps: 0, niche: 'dental',
  missing: [
    { id: 'transferNumber', label: 'Vers qui transférer un appel', hint: 'Sans ce numéro, personne.', done: false, weight: 3, to: '' },
    { id: 'services', label: 'Vos services et tarifs', hint: '…', done: false, weight: 2, to: '' },
    { id: 'field:cancellationPolicy', label: 'Annulation d’un rendez-vous', hint: '24 h avant', done: false, weight: 2, to: '' },
    { id: 'faq', label: 'Les questions qu’on vous pose le plus', hint: '…', done: false, weight: 1, to: '' },
  ],
};
const settings = {
  transferNumber: '', hours: null, knowledge: { parkingAccess: 'Zone bleue' }, faqEntries: [{ q: 'Déjà là ?', a: 'Oui' }],
  knowledgePresets: {
    fields: [{ id: 'cancellationPolicy', label: 'Annulation d’un rendez-vous', placeholder: 'Annulation gratuite jusqu’à 24 h avant' }],
    faq: [{ q: 'Avez-vous un parking ?', a: 'Oui, devant le cabinet.' }],
  },
};

function mount(url = '/dashboard/setup/guide') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/dashboard/setup/guide" element={<ClientSetupGuide />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  get.mockReset(); put.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === '/my-dashboard/setup') return { data: setup };
    if (url === '/my-dashboard/settings') return { data: settings };
    throw new Error(`unexpected ${url}`);
  });
  put.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe('ClientSetupGuide', () => {
  it('pose ce qui manque dans l’ordre, sans les services, et enregistre une clé par étape', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 2, name: 'Vers qui transférer un appel' })).toBeInTheDocument();
    expect(screen.getByText('Question 1 sur 3')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Vers qui transférer un appel' }), { target: { value: '+32475123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et continuer/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/my-dashboard/settings', { transferNumber: '+32475123456' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Annulation d’un rendez-vous' })).toBeInTheDocument();
    expect(screen.getByText(/Annulation gratuite jusqu’à 24 h avant/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Annulation d’un rendez-vous' }), { target: { value: '48 h avant' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et continuer/ }));
    /* L'objet `knowledge` ENTIER, jamais le seul champ : la clé remplace l'objet. */
    await waitFor(() => expect(put).toHaveBeenLastCalledWith('/my-dashboard/settings', { knowledge: { parkingAccess: 'Zone bleue', cancellationPolicy: '48 h avant' } }));
  });

  it('« Passer » avance sans rien enregistrer, et la fin relit le score', async () => {
    mount();
    await screen.findByRole('heading', { level: 2, name: 'Vers qui transférer un appel' });
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    await screen.findByRole('heading', { level: 2, name: 'Annulation d’un rendez-vous' });
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    await screen.findByRole('heading', { level: 2, name: 'Les questions qu’on vous pose le plus' });
    get.mockImplementationOnce(async () => ({ data: { ...setup, score: 20 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    expect(await screen.findByText(/connaît 20 % de son métier/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('la FAQ ajoute les suggestions choisies aux entrées existantes', async () => {
    mount('/dashboard/setup/guide?step=faq');
    await screen.findByRole('heading', { level: 2, name: 'Les questions qu’on vous pose le plus' });
    fireEvent.click(screen.getByRole('button', { name: /Avez-vous un parking/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et terminer/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/my-dashboard/settings', {
      faqEntries: [{ q: 'Déjà là ?', a: 'Oui' }, { q: 'Avez-vous un parking ?', a: 'Oui, devant le cabinet.' }],
    }));
  });

  it('dit pourquoi quand le serveur refuse (transfert qui boucle)', async () => {
    put.mockRejectedValueOnce({ response: { data: { error: 'transfer_loop', message: 'Ce numéro est votre propre ligne.' } } });
    mount();
    await screen.findByRole('heading', { level: 2, name: 'Vers qui transférer un appel' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Vers qui transférer un appel' }), { target: { value: '+32460207490' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et continuer/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce numéro est votre propre ligne.');
  });
});
