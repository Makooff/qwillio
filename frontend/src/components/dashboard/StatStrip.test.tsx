import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StatStrip from './StatStrip';
import { formatDuration } from '../../utils/format';

afterEach(cleanup);

describe('StatStrip', () => {
  it('affiche chaque chiffre avec son libellé', () => {
    render(<StatStrip items={[{ label: 'Total appels', value: 12 }, { label: 'Durée moy.', value: '2:30' }]} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Total appels')).toBeInTheDocument();
    expect(screen.getByText('2:30')).toBeInTheDocument();
  });

  it('montre une variation, avec son signe', () => {
    const { container } = render(<StatStrip items={[{ label: 'Appels', value: 4, delta: -12 }]} />);
    // Le signe est porté par la couleur et la flèche; le nombre reste absolu.
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(container.querySelector('.text-red-400')).not.toBeNull();
  });

  /* Une variation nulle n'est pas une information: l'afficher mettrait une
     flèche verte sur « 0% » à côté de chaque chiffre stable. */
  it('tait une variation nulle', () => {
    render(<StatStrip items={[{ label: 'Appels', value: 4, delta: 0 }]} />);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  /* La seule variation admise entre pages: une cellule qui filtre. Elle doit
     rester une cellule, pas devenir une autre grammaire de rangée. */
  it('rend une cellule qui filtre en bouton, et remonte le clic', () => {
    const onClick = vi.fn();
    render(<StatStrip items={[{ label: 'Nouveau', value: 3, onClick, active: true }]} />);
    const cell = screen.getByRole('button', { pressed: true });
    fireEvent.click(cell);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('n’est pas un bouton quand elle ne filtre rien', () => {
    render(<StatStrip items={[{ label: 'Total appels', value: 12 }]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /* Quatre ou cinq cellules tiennent en largeur, sans jamais se replier en
     2×2, ce qui décalait la troisième cellule sous la première.
     Le test porte sur l'INTENTION et non sur la classe: il vérifiait
     `grid-cols-4`, si bien que passer à des colonnes dimensionnées par leur
     contenu le cassait alors que la rangée restait unique. Ce qui compte,
     c'est qu'il y ait une cellule par chiffre et aucun repli. */
  /* La valeur qui a causé la régression, telle qu'elle sort du formateur:
     une durée insécable de six signes dans une cellule étroite. */
  it('ne coupe pas une durée en deux', () => {
    /* La requête passe par le DOM et non par `getByText`: la bibliothèque
       normalise les espaces avant de comparer, si bien qu'une espace insécable
       et une espace ordinaire lui paraissent identiques. C'est exactement la
       distinction que ce test doit vérifier. */
    const { container } = render(
      <StatStrip items={[{ label: 'Durée moy.', value: formatDuration(152) }]} />,
    );
    const value = container.querySelector('p.whitespace-nowrap');
    expect(value?.textContent).toBe(formatDuration(152));
    expect(value?.textContent).not.toContain(' ');
  });

  it('garde une seule rangée, quel que soit le nombre de cellules', () => {
    const cell = (n: number) => ({ label: `L${n}`, value: n });
    for (const n of [4, 5]) {
      const { container } = render(
        <StatStrip items={Array.from({ length: n }, (_, i) => cell(i + 1))} />,
      );
      const row = container.firstElementChild as HTMLElement;
      expect(row.children).toHaveLength(n);
      expect(row.className).not.toContain('wrap');
      cleanup();
    }
  });
});
