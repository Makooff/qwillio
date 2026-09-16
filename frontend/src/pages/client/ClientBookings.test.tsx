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
  /* Le composant lit « aujourd'hui » (jours à venir, marque du jour): le test
     l'a écrit le 15/09 et tombait le 16. La date est figée, les minuteries
     restent réelles pour que findBy / waitFor gardent leur horloge. */
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
  get.mockReset(); post.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url.includes('/context')) return { data: context };
    return { data: { data: rows } };
  });
  post.mockResolvedValue({ data: { ok: true } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
    /* Le nom paraît DEUX fois depuis que la grille montre le contenu des
       jours (pastille de case, carte du panneau): l'assertion vise le panneau. */
    expect(within(screen.getByRole('complementary', { name: 'Détail' })).getByText('Jean-Luc de la Forge')).toBeInTheDocument();
  });

  it('changer de mois recharge la bonne plage, et vide l\'écran AU CLIC, sans attendre le serveur', async () => {
    /* Retour du 15/09: les rendez-vous de septembre restaient affichés le
       temps de la requête d'octobre, puis disparaissaient. */
    let releaseOctober: (v: unknown) => void = () => {};
    get.mockImplementation((url: string) => {
      if (url.includes('from=2026-10-01')) return new Promise(r => { releaseOctober = r; });
      return Promise.resolve({ data: { data: rows } });
    });
    mount();
    const panel = () => within(screen.getByRole('complementary', { name: 'Détail' }));
    await waitFor(() => expect(panel().getByText('Jean-Luc de la Forge')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByText('Octobre 2026')).toBeInTheDocument();
    expect(screen.queryByText('Jean-Luc de la Forge')).toBeNull();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/my-dashboard/bookings?from=2026-10-01&to=2026-10-31&limit=500'));
    releaseOctober({ data: { data: [] } });
    expect(await screen.findByText('Rien de prévu pour l’instant.')).toBeInTheDocument();
    /* Retour en septembre: servi du cache, sans nouvelle requête. */
    const calls = get.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(panel().getByText('Jean-Luc de la Forge')).toBeInTheDocument();
    await waitFor(() => expect(get.mock.calls.length).toBe(calls + 1));
  });

  it('une case du mois montre l\'heure et le nom, pas seulement un compte', async () => {
    mount();
    const cell = await screen.findByRole('gridcell', { name: /Mardi 15 septembre, 2 rendez-vous/ });
    expect(within(cell).getByText('16:00')).toBeInTheDocument();
    expect(within(cell).getByText('Jean-Luc de la Forge')).toBeInTheDocument();
    expect(within(cell).getByText('17:00')).toBeInTheDocument();
  });

  it('au-delà de deux rendez-vous, la case dit combien il en reste', async () => {
    get.mockImplementation(async () => ({ data: { data: [
      ...rows,
      { id: 'b4', customerName: 'Ana Costa', customerPhone: null, bookingDate: '2026-09-15T10:00:00.000Z', bookingTime: '18:00', serviceType: null, status: 'confirmed' },
      { id: 'b5', customerName: 'Luc Berger', customerPhone: null, bookingDate: '2026-09-15T10:00:00.000Z', bookingTime: '19:00', serviceType: null, status: 'confirmed' },
    ] } }));
    mount();
    const cell = await screen.findByRole('gridcell', { name: /Mardi 15 septembre, 4 rendez-vous/ });
    expect(within(cell).getByText('+2 autres')).toBeInTheDocument();
  });

  it('la recherche interroge le SERVEUR et traverse les mois', async () => {
    /* Une recherche locale ne verrait que le mois chargé: « aucun résultat »
       voudrait dire « pas en septembre ». */
    get.mockImplementation(async (url: string) => {
      if (url.includes('q=')) {
        return { data: { data: [{ id: 'b9', customerName: 'Sophie Dupont', customerPhone: '32470111222', bookingDate: '2026-11-03T10:00:00.000Z', bookingTime: '14:30', serviceType: 'Contrôle', status: 'confirmed' }] } };
      }
      return { data: { data: rows } };
    });
    mount();
    await screen.findByText('Septembre 2026');
    fireEvent.change(screen.getByRole('searchbox', { name: /Rechercher un rendez-vous/ }), { target: { value: 'Dupont' } });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/my-dashboard/bookings?q=Dupont&limit=50'));
    expect(await screen.findByText('Sophie Dupont')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mardi 3 novembre/ })).toBeInTheDocument();
    /* Le mois et la vue n'ont plus de sens pendant une recherche. */
    expect(screen.queryByRole('button', { name: 'Mois suivant' })).toBeNull();
  });

  it('une recherche sans résultat le dit, et ne parle pas du mois affiché', async () => {
    get.mockImplementation(async (url: string) => ({ data: { data: url.includes('q=') ? [] : rows } }));
    mount();
    fireEvent.change(await screen.findByRole('searchbox', { name: /Rechercher un rendez-vous/ }), { target: { value: 'Zzz' } });
    expect(await screen.findByText(/Aucun rendez-vous pour « Zzz »/)).toBeInTheDocument();
  });

  it('effacer la recherche rend le mois', async () => {
    get.mockImplementation(async (url: string) => ({ data: { data: url.includes('q=') ? [] : rows } }));
    mount();
    const box = await screen.findByRole('searchbox', { name: /Rechercher un rendez-vous/ });
    fireEvent.change(box, { target: { value: 'Zzz' } });
    await screen.findByText(/Aucun rendez-vous pour « Zzz »/);
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(await screen.findByRole('button', { name: 'Mois suivant' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Mardi 15 septembre, 2 rendez-vous/ })).toBeInTheDocument();
  });

  it('la barre d\'outils est AU-DESSUS du calendrier, et le champ ne porte aucun anneau mauve', async () => {
    mount();
    const box = await screen.findByRole('searchbox', { name: /Rechercher un rendez-vous/ });
    const grid = screen.getByRole('grid');
    /* DOCUMENT_POSITION_FOLLOWING: la grille vient APRÈS le champ. */
    expect(box.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    /* Assertion de classe, à dessein: la couleur au focus ne se lit pas
       autrement en jsdom, et c'est précisément ce qui a été demandé retiré. */
    expect(box.className).not.toMatch(/7349fe/);
  });

  it("le mauve venait de la feuille GLOBALE: la classe qui le neutralise reste là", async () => {
    /* Ce test existe parce que le précédent PASSAIT pendant que le champ
       s'entourait de mauve au clic. La bordure avait bien été dépouillée de
       `7349fe`; la couleur venait d'ailleurs, de `globals.css`:

         input:focus-visible { outline: 2px solid var(--q-accent-hi) }

       plus spécifique que l'utilitaire `outline-none`, donc gagnante. Le
       commentaire posé au-dessus de cette règle dit que la souris ne déclenche
       pas `:focus-visible`: vrai d'un bouton, FAUX d'un champ de saisie, auquel
       le navigateur le fait toujours correspondre puisqu'il attend des touches.
       `focus-visible:outline-none` reprend la main sur ce champ SEULEMENT:
       l'anneau clavier du reste de l'application reste en place, et le focus
       reste vu ici par la bordure et le fond.

       La règle globale elle-même ne se lit pas depuis un test: vitest rend une
       chaîne vide pour un import CSS, même en `?raw`. C'est donc la classe du
       champ qu'on gèle, et c'est elle qui doit survivre. */
    mount();
    const box = await screen.findByRole('searchbox', { name: /Rechercher un rendez-vous/ });
    expect(box.className).toContain('focus-visible:outline-none');
  });

  it("la barre d'outils s'arrête au bord de l'agenda, pas au bord de la page", () => {
    /* L'agenda ne prend pas toute la page: il est la colonne `1fr` d'une grille
       dont la seconde colonne (420 px) porte « À venir ». Une barre posée
       directement dans `main` passe donc PAR-DESSUS cette colonne, ce qui est le
       défaut relevé en capture. La preuve qu'elle est au bon endroit: son
       conteneur porte la MÊME définition de colonnes que le contenu. jsdom ne
       mesurant aucune largeur, c'est cette égalité qu'on gèle, pas des pixels. */
    mount();
    const box = screen.getByRole('searchbox', { name: /Rechercher un rendez-vous/ });
    const toolbarRail = box.closest('[class*="lg:grid-cols-"]');
    const agendaRail = screen.getByRole('grid').closest('[class*="lg:grid-cols-"]');
    expect(toolbarRail).not.toBeNull();
    expect(agendaRail).not.toBeNull();
    expect(toolbarRail!.className).toBe(agendaRail!.className);
  });

  it("tout tient sur une ligne: la recherche prend ce qui reste", () => {
    /* `flex-1` sur le champ, et le mois, « Aujourd'hui » et le sélecteur sur la
       MÊME rangée. C'est ce qui pousse le sélecteur au bord droit de l'agenda
       sans `ml-auto`, et c'est la forme demandée. */
    mount();
    const box = screen.getByRole('searchbox', { name: /Rechercher un rendez-vous/ });
    const row = box.closest('.flex')!;
    expect(box.parentElement!.className).toContain('flex-1');
    expect(row.contains(screen.getByRole('group', { name: 'Affichage' }))).toBe(true);
    expect(row.contains(screen.getByRole('button', { name: 'Mois précédent' }))).toBe(true);
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
