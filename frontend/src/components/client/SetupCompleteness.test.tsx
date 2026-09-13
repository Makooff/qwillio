import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import SetupCompleteness, { type SetupState } from './SetupCompleteness';

afterEach(cleanup);

const base: SetupState = {
  score: 35, done: 3, total: 10, openGaps: 0, niche: 'dental',
  missing: [
    { id: 'transferNumber', label: 'Vers qui transférer un appel', hint: 'Sans ce numéro…', done: false, weight: 3, to: '/dashboard/setup/guide?step=transferNumber' },
    { id: 'hours', label: 'Vos horaires d’ouverture', hint: 'Sans eux…', done: false, weight: 2, to: '/dashboard/setup/guide?step=hours' },
    { id: 'field:insuranceAccepted', label: 'Mutuelles et conventionnement', hint: 'Cabinet conventionné…', done: false, weight: 2, to: '/dashboard/setup/guide?step=field:insuranceAccepted' },
    { id: 'field:parkingAccess', label: 'Accès et stationnement', hint: 'Zone bleue…', done: false, weight: 1, to: '/dashboard/setup/guide?step=field:parkingAccess' },
    { id: 'faq', label: 'Les questions qu’on vous pose le plus', hint: '…', done: false, weight: 1, to: '/dashboard/setup/guide?step=faq' },
  ],
};

const mount = (setup: SetupState | null) => render(<MemoryRouter><SetupCompleteness setup={setup} /></MemoryRouter>);

describe('SetupCompleteness', () => {
  it('dit le score pour le métier, les trois manques les plus lourds, et mène au parcours guidé', () => {
    mount(base);
    expect(screen.getByText('35 %')).toBeInTheDocument();
    expect(screen.getByText(/cabinet dentaire doit savoir/)).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/dashboard/setup/guide');
    expect(screen.getByText('Vers qui transférer un appel').closest('a')).toHaveAttribute('href', '/dashboard/setup/guide?step=transferNumber');
    expect(screen.queryByText('Accès et stationnement')).toBeNull();
    expect(screen.getByText('Et 2 autres points à compléter.')).toBeInTheDocument();
  });

  it('compte les questions d’appelants sans réponse et mène à la base de connaissances', () => {
    mount({ ...base, openGaps: 2 });
    expect(screen.getByText('2 questions d’appelants sont restées sans réponse').closest('a'))
      .toHaveAttribute('href', '/dashboard/receptionist#connaissances');
  });

  it('disparaît quand tout est rempli et qu’aucune question n’attend', () => {
    const { container } = mount({ ...base, score: 100, missing: [], openGaps: 0 });
    expect(container).toBeEmptyDOMElement();
    expect(mount(null).container).toBeEmptyDOMElement();
  });

  it('à 100 % avec des questions en attente, ne montre que les questions', () => {
    mount({ ...base, score: 100, missing: [], openGaps: 1 });
    expect(screen.getByText('Une question d’appelant est restée sans réponse')).toBeInTheDocument();
    expect(screen.queryByText(/Compléter en quelques minutes/)).toBeNull();
  });
});
