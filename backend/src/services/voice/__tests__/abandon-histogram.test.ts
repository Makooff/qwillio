import { describe, it, expect } from 'vitest';
import { abandonHistogram } from '../receptionist-learning.service';

const ending = (callerTurns: number, outcome: string | null) => ({ callerTurns, outcome });

describe('abandonHistogram — où l\'appelant s\'arrête', () => {
  it('range chaque abandon dans son seau', () => {
    const h = abandonHistogram([
      ending(1, 'missed'),
      ending(2, 'missed'),
      ending(3, null),
      ending(5, 'other'),
      ending(9, 'missed'),
    ]);
    expect(h.buckets.map(b => b.count)).toEqual([1, 1, 1, 1, 1]);
    expect(h.abandoned).toBe(5);
    expect(h.rate).toBe(1);
  });

  it('ne compte comme abandon que la liste POSITIVE des issues', () => {
    // Une plainte et un transfert sont de vraies conversations. Compter « tout
    // ce qui n'est pas un succès » ferait crier au loup dès qu'une issue
    // nouvelle apparaît dans le vocabulaire.
    const h = abandonHistogram([
      ending(2, 'booked'),
      ending(2, 'transferred'),
      ending(2, 'complaint'),
      ending(2, 'missed'),
    ]);
    expect(h.abandoned).toBe(1);
    expect(h.rate).toBe(0.25);
  });

  it('compte un appel sans issue comme un abandon', () => {
    expect(abandonHistogram([ending(1, null)]).abandoned).toBe(1);
  });

  it('ne désigne aucun pire tour quand personne n\'abandonne', () => {
    // Nommer un coupable sur zéro abandon enverrait le client corriger une
    // panne qui n'existe pas.
    const h = abandonHistogram([ending(3, 'booked'), ending(4, 'booked')]);
    expect(h.worst).toBeNull();
    expect(h.rate).toBe(0);
  });

  it('désigne le seau le plus chargé', () => {
    const h = abandonHistogram([
      ending(1, 'missed'),
      ending(1, 'missed'),
      ending(1, 'missed'),
      ending(8, 'missed'),
    ]);
    expect(h.worst?.label).toBe('tour 1');
    expect(h.worst?.count).toBe(3);
  });

  it('met un tour 0 avec le tour 1 — il a raccroché sur l\'accueil', () => {
    const h = abandonHistogram([ending(0, 'missed')]);
    expect(h.buckets[0].count).toBe(1);
  });

  it('ne trébuche pas sur une liste vide', () => {
    const h = abandonHistogram([]);
    expect(h.total).toBe(0);
    expect(h.rate).toBe(0);
    expect(h.worst).toBeNull();
  });
});
