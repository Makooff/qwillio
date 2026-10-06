import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Pagination from './Pagination';

afterEach(cleanup);

describe('Pagination (ui commun)', () => {
  it('nomme les boutons de navigation icône seule', () => {
    render(<Pagination page={2} total={30} limit={10} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page suivante' })).toBeInTheDocument();
  });

  it('annonce la page courante sans dépendre de la couleur', () => {
    render(<Pagination page={2} total={30} limit={10} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute('aria-current');
  });

  it('désactive les extrémités aux bornes', () => {
    render(<Pagination page={1} total={20} limit={10} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Page suivante' })).toBeEnabled();
  });

  it('appelle onChange avec la page choisie', () => {
    const onChange = vi.fn();
    render(<Pagination page={1} total={30} limit={10} onChange={onChange} />);
    screen.getByRole('button', { name: '3' }).click();
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('ne rend rien pour une seule page', () => {
    render(<Pagination page={1} total={5} limit={10} onChange={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
