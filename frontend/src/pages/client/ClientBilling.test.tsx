import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import ClientBilling from './ClientBilling';

/* Facturation client — contrats corrigés suite à l'audit source (A3/A6/A7) :
   - A3: la fiche Starter ne promet plus « Intégrations CRM natives » ni
     « Support prioritaire », droits que le serveur réserve à Pro
     (`backend/src/config/plan-features.ts`: crm = pro/enterprise).
   - A6: la carte « Plan actuel » respecte la période RÉELLE de l'aperçu
     (`overview.billingPeriod`), indépendamment du sélecteur du comparateur.
   - A7: une panne de lecture des paiements affiche un état d'erreur avec
     retry (et non « Aucun paiement »); une panne billing n'affiche pas de
     defaults plausibles (Starter / Actif / 0 min) ni d'actions dangereuses. */

const get = vi.fn();
const post = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }));

const overviewMonthly = {
  plan: 'starter',
  status: 'active',
  renewalDate: '2026-11-01T00:00:00.000Z',
  minutesUsed: 120,
  minutesLimit: 750,
  trialEndsAt: null,
  isTrial: false,
  billingPeriod: 'monthly',
  paymentMethod: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 },
};

const overviewAnnual = {
  ...overviewMonthly,
  plan: 'pro',
  billingPeriod: 'annual',
  minutesUsed: 400,
  minutesLimit: 2000,
};

const payments = [
  { id: 'p1', amount: 249, currency: 'EUR', status: 'succeeded', createdAt: '2026-09-01T08:00:00.000Z', description: 'Qwillio Starter' },
];

const mount = () => render(<MemoryRouter><ClientBilling /></MemoryRouter>);

function mockOk(overview = overviewMonthly, rows = payments) {
  get.mockImplementation(async (url: string) => {
    if (url.includes('/my-dashboard/billing')) return { data: overview };
    if (url.includes('/my-dashboard/payments')) return { data: rows };
    return { data: {} };
  });
}

beforeEach(() => {
  get.mockReset(); post.mockReset();
  post.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe('ClientBilling, catalogue des plans (A3)', () => {
  it('la fiche Starter ne promet ni CRM natif ni support prioritaire, réservés au serveur à Pro', async () => {
    mockOk();
    mount();
    await screen.findByText('Plan actuel');

    const starterHeading = await screen.findAllByText('Starter');
    expect(starterHeading.length).toBeGreaterThan(0);
    /* Le droit `crm` est accordé par plan-features.ts à pro/enterprise
       uniquement: aucune carte Starter ne doit l'annoncer. */
    const grids = document.querySelectorAll('ul');
    const starterGrid = [...grids].find(g => g.textContent?.includes('Tout Solo inclus'));
    expect(starterGrid).toBeDefined();
    expect(starterGrid!.textContent).not.toContain('Intégrations CRM natives');
    expect(starterGrid!.textContent).not.toContain('Support prioritaire');
  });

  it('la fiche Pro annonce explicitement le CRM natif et le support prioritaire', async () => {
    mockOk();
    mount();
    await screen.findByText('Plan actuel');
    const grids = document.querySelectorAll('ul');
    const proGrid = [...grids].find(g => g.textContent?.includes('Analytiques avancées'));
    expect(proGrid).toBeDefined();
    expect(proGrid!.textContent).toContain('Intégrations CRM natives');
    expect(proGrid!.textContent).toContain('Support prioritaire');
  });
});

describe('ClientBilling, carte du plan actuel (A6)', () => {
  it('un abonné annuel lit le total annuel et l\u2019équivalent mensuel, pas le mensuel plein', async () => {
    /* Pro annuel : 599 €/mois → total annuel 5 750 € (round(599*12*0,8)),
       équivalent mensuel 479 € (round(5750/12)). */
    mockOk(overviewAnnual);
    mount();
    const planCard = await screen.findByText('Plan actuel');
    const card = planCard.closest('div[class]')!.parentElement!;
    /* fr-FR groupe les milliers avec une espace fine insécable (U+202F). */
    expect(card.textContent).toMatch(/5[\s\u00a0\u202f]750/);
    expect(card.textContent).toContain('479');
    expect(card.textContent).not.toContain('599');
  });

  it('le sélecteur Mensuel/Annuel ne change pas la carte du plan actuel', async () => {
    mockOk(overviewAnnual);
    mount();
    await screen.findByText('Plan actuel');
    fireEvent.click(screen.getByRole('button', { name: /^Mensuel/ }));
    /* La carte du forfait COURANT reste annuelle; seules les cartes du
       comparateur basculent sur les prix mensuels. */
    const planCard = screen.getByText('Plan actuel');
    const card = planCard.closest('div[class]')!.parentElement!;
    expect(card.textContent).toMatch(/5[\s\u00a0\u202f]750/);
    expect(card.textContent).toContain('479');
  });

  it('un abonné mensuel voit son mensuel plein dans la carte du plan actuel', async () => {
    mockOk(overviewMonthly);
    mount();
    await screen.findByText('Plan actuel');
    const planCard = screen.getByText('Plan actuel');
    const card = planCard.closest('div[class]')!.parentElement!;
    expect(card.textContent).toContain('249');
  });
});

describe('ClientBilling, sélecteur du comparateur', () => {
  it('bascule les prix des cartes offres sans toucher à la carte du plan actuel', async () => {
    mockOk(overviewMonthly);
    mount();
    await screen.findByText('Plan actuel');
    fireEvent.click(screen.getByRole('button', { name: /Annuel/ }));
    /* Solo annuel : équivalent 79 €/mois, facturé 950 €/an. */
    await waitFor(() => {
      const soloCard = screen.getByText('Solo').closest('div[class*="rounded-xl"]')!;
      expect(soloCard.textContent).toContain('79');
      expect(soloCard.textContent).toContain('950');
    });
  });
});

describe('ClientBilling, erreur de lecture des paiements (A7)', () => {
  it('affiche une erreur avec retry au lieu de « Aucun paiement » quand la route échoue', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.includes('/my-dashboard/billing')) return { data: overviewMonthly };
      throw new Error('network down');
    });
    mount();
    await screen.findByText('Plan actuel');
    expect(screen.queryByText("Aucun paiement enregistré pour l'instant.")).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(/paiement/i);
    expect(screen.getByRole('button', { name: /Réessayer/i })).toBeInTheDocument();
  });

  it('le retry recharge les paiements et affiche les lignes reçues', async () => {
    let paymentsCalls = 0;
    get.mockImplementation(async (url: string) => {
      if (url.includes('/my-dashboard/billing')) return { data: overviewMonthly };
      paymentsCalls += 1;
      if (paymentsCalls === 1) throw new Error('network down');
      return { data: payments };
    });
    mount();
    await screen.findByText('Plan actuel');
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));
    await waitFor(() => expect(screen.getByText('Qwillio Starter')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Réessayer/i })).toBeNull();
  });

  it('garde le vrai état vide distinct : liste vide valide affiche « Aucun paiement »', async () => {
    mockOk(overviewMonthly, []);
    mount();
    await screen.findByText('Plan actuel');
    expect(screen.getByText("Aucun paiement enregistré pour l'instant.")).toBeInTheDocument();
  });
});

describe('ClientBilling, erreur de lecture billing (A7)', () => {
  it('n\u2019affiche ni forfait Starter par défaut, ni statut Actif, ni zone de résiliation', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.includes('/my-dashboard/billing')) throw new Error('billing down');
      return { data: payments };
    });
    mount();
    /* L'alerte de chargement existe toujours. */
    await screen.findByRole('alert');
    expect(screen.queryByText('Plan actuel')).toBeNull();
    /* Pas de pill « Actif » tombée sur un défaut. */
    expect(screen.queryByText('Actif')).toBeNull();
    /* Pas de jauge de minutes à 0 fondée sur rien. */
    expect(screen.queryByText(/0\s*\/\s*750/)).toBeNull();
    /* Pas d'action dangereuse (résiliation) sans aperçu valide. */
    expect(screen.queryByRole('button', { name: /Annuler l'abonnement/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Upgrader/i })).toBeNull();
  });
});
