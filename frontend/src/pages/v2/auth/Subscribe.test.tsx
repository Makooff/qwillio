import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Subscribe from './Subscribe';
import { captureSignupPlan } from '../../../lib/signupSelection';
import { captureBillingPeriod } from '../../../lib/billingPeriod';
import api from '../../../services/api';

/* A4 + A5 — le forfait choisi sur les tarifs pré-coche la caisse, et le pays
   est demandé explicitement (BE/FR) puis envoyé au serveur. Rien n'est déduit
   de la langue, rien ne repart en Belgique par défaut pour un Français. */

vi.mock('../../../services/api', () => ({
  default: { post: vi.fn() },
}));

const checkAuth = vi.fn();
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => ({ logout: vi.fn() })),
    { getState: () => ({ checkAuth, user: null }) },
  ),
}));

vi.mock('../../../stores/langStore', () => ({
  useLang: () => ({ lang: 'fr', setLang: vi.fn() }),
}));

vi.mock('../../../components/LangToggle', () => ({ default: () => null }));

/* La coquille réelle embarque NavV2/RevealV2/Google: inutile ici, on teste la
   page, pas le décor. Les classes exportées servent à l'assertion du bouton. */
vi.mock('./AuthShell', () => ({
  __esModule: true,
  default: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  AUTH_ALERT: 'alert',
  AUTH_FIELD: 'field',
  AUTH_LABEL: 'label',
  AUTH_SELECT: 'select',
  AUTH_SUBMIT: 'submit',
}));

const mockedPost = vi.mocked(api.post);

function renderSubscribe() {
  return render(
    <MemoryRouter>
      <Subscribe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockedPost.mockResolvedValue({ data: { checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test' } } as never);
});

describe('présélection du forfait (A4)', () => {
  it('pré-coche le forfait porté depuis la page tarifs', () => {
    captureSignupPlan('?plan=solo');
    renderSubscribe();
    const solo = screen.getByRole('button', { name: /Solo/ });
    expect(solo).toHaveAttribute('aria-pressed', 'true');
  });

  it('pré-coche Pro quand aucun forfait n\'a été choisi', () => {
    renderSubscribe();
    const pro = screen.getByRole('button', { name: /Pro/ });
    expect(pro).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignore un forfait inconnu dans la query: Pro reste le défaut', () => {
    captureSignupPlan('?plan=platinum');
    renderSubscribe();
    expect(screen.getByRole('button', { name: /Pro/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('pays de facturation (A5)', () => {
  it('affiche un choix de pays Belgique/France', () => {
    renderSubscribe();
    const group = screen.getByRole('combobox', { name: /Pays|Country/i });
    const options = within(group).getAllByRole('option');
    expect(options.map(o => (o as HTMLOptionElement).value)).toEqual(['BE', 'FR']);
  });

  it('envoie le pays choisi au checkout, avec le forfait présélectionné', async () => {
    captureSignupPlan('?plan=starter');
    renderSubscribe();
    await userEvent.type(screen.getByPlaceholderText('Acme Inc.'), 'Chez Marie');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Pays|Country/i }), 'FR');
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer ma carte|Add my card/ }));

    expect(mockedPost).toHaveBeenCalledWith('/auth/checkout', expect.objectContaining({
      planType: 'starter',
      country: 'FR',
    }));
  });

  it('envoie la Belgique par défaut (compatibilité des anciennes sessions)', async () => {
    renderSubscribe();
    await userEvent.type(screen.getByPlaceholderText('Acme Inc.'), 'Chez Marie');
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer ma carte|Add my card/ }));

    expect(mockedPost).toHaveBeenCalledWith('/auth/checkout', expect.objectContaining({ country: 'BE' }));
  });

  it('nettoie le forfait choisi après ouverture de la caisse, comme la période', async () => {
    captureSignupPlan('?plan=solo');
    captureBillingPeriod('?billing=annual');
    renderSubscribe();
    await userEvent.type(screen.getByPlaceholderText('Acme Inc.'), 'Chez Marie');
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer ma carte|Add my card/ }));

    expect(sessionStorage.getItem('qwillio.signupPlan')).toBeNull();
    expect(sessionStorage.getItem('qwillio.billingPeriod')).toBeNull();
  });
});
