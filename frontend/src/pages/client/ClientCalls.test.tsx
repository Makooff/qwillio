import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import ClientCalls from './ClientCalls';

/* Rafraîchissement live de la page Appels, sans rechargement manuel.
 *
 * La liste s'abonne à la clé liveData de la page affichée et la fiche détail
 * doit suivre la ligne qu'elle décrit: quand l'appel en cours passe à
 * « completed » (données poussées par la boucle live côté serveur, simulée ici
 * en réinjectant dans la clé), la liste ET le panneau déjà ouvert doivent
 * révéler durée, sentiment et résumé — sans fermer, rouvrir ou actualiser.
 *
 * Deuxième garantie: la pagination. L'abonnement doit suivre la page
 * AFFICHÉE: un rafraîchissement de la page 1 ne doit pas écraser la page 2
 * que l'utilisateur est en train de lire. */

// ── Faux liveData (même contrat que services/liveData, en mémoire) ──────────

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<(d: unknown) => void>>();
/* Clés actuellement abonnées en RAPIDE (contrat subscribeLiveFast). */
const fastSubscribed = new Set<string>();
/* Réponses fetchLive dont la résolution est sous contrôle du test. */
const deferred = new Map<string, Array<{ resolve: (d: unknown) => void; reject: (e: unknown) => void }>>();

function emit(key: string, data: unknown) {
  cache.set(key, data);
  listeners.get(key)?.forEach(fn => fn(data));
}

/** Fait sortir la ou les réponses en attente d'une clé (simule la fin d'une
 *  requête lente, APRÈS que l'utilisateur a changé de filtre par exemple). */
function release(key: string, data: unknown) {
  cache.set(key, data);
  const pending = deferred.get(key) ?? [];
  deferred.delete(key);
  pending.forEach(p => p.resolve(data));
}

vi.mock('../../services/liveData', () => ({
  fetchLive: vi.fn((key: string, opts?: { force?: boolean }) => {
    if (!opts?.force && cache.has(key)) return Promise.resolve(cache.get(key));
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    // Clé inconnue: on attend qu'un test la « release » (réseau lent simulé).
    return new Promise((resolve, reject) => {
      const arr = deferred.get(key) ?? [];
      arr.push({ resolve, reject });
      deferred.set(key, arr);
    });
  }),
  peekLive: (key: string) => cache.get(key),
  subscribeLive: (key: string, fn: (d: unknown) => void) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(fn);
    return () => { listeners.get(key)?.delete(fn); };
  },
  subscribeLiveFast: (key: string, fn: (d: unknown) => void) => {
    fastSubscribed.add(key);
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(fn);
    return () => {
      fastSubscribed.delete(key);
      listeners.get(key)?.delete(fn);
    };
  },
}));

/* Hors scope de ce fichier: la carte « en cours » (testée dans LiveCalls.test)
   et l'entonnoir de transfert. */
vi.mock('../../components/client-dashboard/LiveCalls', () => ({ default: () => null }));
vi.mock('../../components/client-dashboard/TransferFunnel', () => ({ default: () => null }));

// ── Fixtures ────────────────────────────────────────────────────────────────

const LISTE_PAGE_1 = '/my-dashboard/calls?page=1&limit=20';
const LISTE_PAGE_2 = '/my-dashboard/calls?page=2&limit=20';

function appel(partial: Record<string, unknown>) {
  return {
    id: 'c1',
    callerNumber: '+324****3456',
    callerName: '',
    durationSeconds: 0,
    sentiment: null,
    outcome: null,
    summary: null,
    createdAt: '2026-10-22T09:00:00Z',
    isLead: false,
    bookingRequested: false,
    bookingDetails: null,
    emailCollected: '',
    leadScore: null,
    recordingUrl: '',
    transcript: null,
    status: 'completed',
    ...partial,
  };
}

const PAGINATION_1 = { total: 1, page: 1, limit: 20, totalPages: 1 };
const PAGINATION_2 = { total: 40, page: 2, limit: 20, totalPages: 2 };

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  cache.clear();
  listeners.clear();
  fastSubscribed.clear();
  deferred.clear();
});
afterEach(cleanup);

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ClientCalls — rafraîchissement live', () => {
  it('un appel « en cours » qui se termine met à jour la liste ET la fiche ouverte', async () => {
    const enCours = appel({ status: 'in-progress' });
    cache.set(LISTE_PAGE_1, { data: [enCours], pagination: PAGINATION_1 });

    render(<MemoryRouter><ClientCalls /></MemoryRouter>);
    await flush();

    // La ligne est bien marquée « en direct » (les deux gabarits, mobile et
    // poste, rendent en jsdom).
    expect(screen.getAllByText('en direct').length).toBeGreaterThan(0);

    // On ouvre la fiche détail: pas encore de résumé, l'appel n'est pas fini.
    fireEvent.click(screen.getByRole('listitem'));
    expect(screen.getByText("Détails de l'appel")).toBeInTheDocument();
    expect(screen.queryByText('Résumé IA')).toBeNull();

    // La boucle live réinjecte la même page: l'appel est désormais terminé.
    act(() => {
      emit(LISTE_PAGE_1, {
        data: [appel({
          status: 'completed',
          durationSeconds: 125,
          sentiment: 'positive',
          outcome: 'info_provided',
          summary: 'Le client demande un rappel demain matin.',
        })],
        pagination: PAGINATION_1,
      });
    });

    // La liste se met à jour toute seule… (les deux gabarits rendent en jsdom)
    expect(screen.queryAllByText('en direct')).toHaveLength(0);
    expect(screen.getAllByText('2m 5s').length).toBeGreaterThan(0);

    // … et la fiche DÉJÀ OUVERTE révèle les détails, sans la refermer.
    expect(screen.getByText('Résumé IA')).toBeInTheDocument();
    expect(screen.getByText('Le client demande un rappel demain matin.')).toBeInTheDocument();
    expect(screen.getByText('Renseignement donné')).toBeInTheDocument();
  });

  it("l'abonnement suit la page affichée: un rafraîchissement de la page 1 n'écrase pas la page 2", async () => {
    cache.set(LISTE_PAGE_1, {
      data: [appel({ id: 'c-p1', callerName: 'Première page' })],
      pagination: { total: 40, page: 1, limit: 20, totalPages: 2 },
    });
    cache.set(LISTE_PAGE_2, {
      data: [appel({ id: 'c-p2', callerName: 'Lecture page deux' })],
      pagination: PAGINATION_2,
    });

    render(<MemoryRouter><ClientCalls /></MemoryRouter>);
    await flush();
    expect(screen.getAllByText('Première page').length).toBeGreaterThan(0);

    // Page 2 demandée.
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await flush();
    expect(screen.getAllByText('Lecture page deux').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Première page')).toHaveLength(0);

    // Un rafraîchissement live de la page 1 arrive (boucle de fond).
    act(() => {
      emit(LISTE_PAGE_1, {
        data: [appel({ id: 'c-p1', callerName: 'Première page modifiée' })],
        pagination: { total: 40, page: 1, limit: 20, totalPages: 2 },
      });
    });

    // La page 2 affichée ne doit PAS être remplacée par les données de la page 1.
    expect(screen.getAllByText('Lecture page deux').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Première page modifiée')).toHaveLength(0);
  });

  it('la fiche reste ouverte quand le backend remplace l\'identifiant provisoire (vapiCallId stable)', async () => {
    /* L'appel en cours porte un id de remplacement; vapiCallId est la salle,
       stable. La fiche est ouverte dessus. Quand le backend pose l'id définitif,
       la même ligne (même salle) arrive: ni fermeture, ni flash. */
    cache.set(LISTE_PAGE_1, {
      data: [appel({ id: 'placeholder-id', vapiCallId: 'salle-abc', status: 'in-progress' })],
      pagination: PAGINATION_1,
    });

    render(<MemoryRouter><ClientCalls /></MemoryRouter>);
    await flush();

    fireEvent.click(screen.getByRole('listitem'));
    expect(screen.getByText("Détails de l'appel")).toBeInTheDocument();

    act(() => {
      emit(LISTE_PAGE_1, {
        data: [appel({
          id: 'id-definitif',
          vapiCallId: 'salle-abc',
          status: 'completed',
          durationSeconds: 65,
          outcome: 'booking_made',
          summary: 'Rendez-vous confirmé jeudi 9h.',
        })],
        pagination: PAGINATION_1,
      });
    });

    // Fiche toujours ouverte, sur la MÊME ligne malgré le changement d'id.
    expect(screen.getByText("Détails de l'appel")).toBeInTheDocument();
    expect(screen.getByText('Rendez-vous confirmé jeudi 9h.')).toBeInTheDocument();
    expect(screen.getByText('Rendez-vous pris')).toBeInTheDocument();
    expect(screen.queryAllByText('en direct')).toHaveLength(0);
  });

  it("l'abonnement rapide ne couvre que la clé affichée: filtre → nouvelle clé, pas les clés historiques", async () => {
    cache.set(LISTE_PAGE_1, { data: [appel({ callerName: 'Sans filtre' })], pagination: PAGINATION_1 });
    const CLE_FILTRE = '/my-dashboard/calls?page=1&limit=20&sentiment=positive';
    cache.set(CLE_FILTRE, { data: [appel({ id: 'c-pos', callerName: 'Positif filtré' })], pagination: PAGINATION_1 });

    render(<MemoryRouter><ClientCalls /></MemoryRouter>);
    await flush();

    // La clé active est en rapide…
    expect(fastSubscribed.has(LISTE_PAGE_1)).toBe(true);
    // … et aucune autre clé historique n'a été abonnée en rapide.
    expect(fastSubscribed.size).toBe(1);

    // Le panneau de filtres est replié par défaut: on le déplie d'abord.
    fireEvent.click(screen.getByRole('button', { name: 'Filtres avancés' }));
    // Filtre « positif » appliqué: la boucle rapide SUIT la nouvelle clé…
    fireEvent.click(screen.getByRole('button', { name: 'positive' }));
    await flush();
    expect(fastSubscribed.has(CLE_FILTRE)).toBe(true);
    expect(fastSubscribed.has(LISTE_PAGE_1)).toBe(false);
    expect(screen.getAllByText('Positif filtré').length).toBeGreaterThan(0);
  });

  it("une réponse lente pour l'ancienne clé n'écrase pas le filtre affiché", async () => {
    /* RÉSEAU LENT: le fetch de la page sans filtre est parti mais ne répond
       pas. L'utilisateur applique un filtre; la réponse de l'ancienne requête
       arrive ENFIN. Sans garde anti-stale, elle remettait les anciennes
       données à l'écran (les filtres « ne s'appliquaient pas »). */
    const CLE_FILTRE = '/my-dashboard/calls?page=1&limit=20&sentiment=negative';
    cache.set(CLE_FILTRE, { data: [appel({ id: 'c-neg', callerName: 'Négatif filtré' })], pagination: PAGINATION_1 });

    render(<MemoryRouter><ClientCalls /></MemoryRouter>);
    // Pas de flush complet: la page 1 n'est pas dans le cache, sa réponse est
    // « en vol ».

    fireEvent.click(screen.getByRole('button', { name: 'Filtres avancés' }));
    fireEvent.click(screen.getByRole('button', { name: 'negative' }));
    await flush();
    expect(screen.getAllByText('Négatif filtré').length).toBeGreaterThan(0);

    // La réponse en vol de l'ANCIENNE clé arrive maintenant, trop tard.
    await act(async () => {
      release(LISTE_PAGE_1, { data: [appel({ callerName: 'Réponse périmée' })], pagination: PAGINATION_1 });
      await Promise.resolve();
    });

    // Rien d'écrit: le filtre affiché tient.
    expect(screen.getAllByText('Négatif filtré').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Réponse périmée')).toHaveLength(0);
  });
});
