import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import OnboardingChecklist from './OnboardingChecklist';
import type { SetupState } from './setup-state';

afterEach(cleanup);

/* Le score de complétude vit DANS le bandeau, comme une étape : deux blocs
   « il vous manque ceci » sur la même page se contredisaient (13/09/2026). */

const client = { hasTestCall: true, hasCustomConfig: true, isActive: true, transferNumber: '+32475000000', forwardingStatus: 'verified', vapiPhoneNumber: '+32460207490' };
const setup = (over: Partial<SetupState> = {}): SetupState => ({
  score: 12, done: 1, total: 10, openGaps: 0, niche: 'dental',
  missing: [
    { id: 'hours', label: 'Vos horaires d’ouverture', hint: '…', done: false, weight: 2, to: '/dashboard/setup/guide?step=hours' },
    { id: 'field:insuranceAccepted', label: 'Mutuelles et conventionnement', hint: '…', done: false, weight: 2, to: '/dashboard/setup/guide?step=field:insuranceAccepted' },
  ],
  ...over,
});

const mount = (s: SetupState | null) => render(<MemoryRouter><OnboardingChecklist client={client} setup={s} /></MemoryRouter>);

describe('OnboardingChecklist, l’étape « apprendre son métier »', () => {
  it('porte le score par métier, les manques, et mène au parcours guidé', () => {
    mount(setup());
    const row = screen.getByText('Apprendre son métier à votre réceptionniste').closest('a')!;
    expect(row).toHaveAttribute('href', '/dashboard/setup/guide');
    expect(row).toHaveTextContent(/12 % de ce qu’un cabinet dentaire doit savoir/);
    expect(row).toHaveTextContent(/horaires d’ouverture, Mutuelles/);
  });

  it('se coche à partir de 70 %, pas à 100', () => {
    mount(setup({ score: 72, missing: [] }));
    expect(screen.getByText('Vous êtes prêt')).toBeInTheDocument();
  });

  it('les questions d’appelants sans réponse sont une étape à part, vers la base de connaissances', () => {
    mount(setup({ score: 90, missing: [], openGaps: 2 }));
    const row = screen.getByText('2 questions d’appelants restées sans réponse').closest('a')!;
    expect(row).toHaveAttribute('href', '/dashboard/receptionist#connaissances');
    expect(screen.queryByText('Vous êtes prêt')).toBeNull();
  });

  it('sans score du serveur, l’ancienne condition tient', () => {
    mount(null);
    expect(screen.getByText('Vous êtes prêt')).toBeInTheDocument();
  });
});
