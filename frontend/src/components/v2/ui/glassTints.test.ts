import { describe, it, expect } from 'vitest';
import { DARK_GLASS, LIGHT_GLASS } from './glassTints';
/* Les deux fichiers sont lus par le bundler, pas par `node:fs`: ce paquet est
   compile par `tsc -b` avec le reste de `src`, ou les types de Node n'existent
   pas. Un test qui casse le build de production n'est pas un test. */
import navSource from '../NavV2.tsx?raw';
import shellSource from '../../layout/DashboardShell.tsx?raw';

/* Ces deux barres sont le même objet: une pilule flottante en verre, l'une sur
   le site, l'autre dans le tableau de bord. Elles avaient deux recettes, et
   celle du tableau de bord était restée sur un gris bleuté dense, l'erreur
   déjà corrigée une fois sur le site. Ce test n'inspecte pas un rendu, il
   interdit à la valeur d'être réécrite sur place: c'est là que la dérive
   recommencerait, et elle ne se voit qu'à l'œil, sur un téléphone. */
describe('la teinte du verre sombre', () => {
  it('part du noir de la marque, jamais d’un gris', () => {
    expect(DARK_GLASS.tint).toContain('rgba(8,9,10');
    expect(DARK_GLASS.tintFallback).toContain('rgba(8,9,10');
    expect(DARK_GLASS.tint).not.toContain('oklch');
  });

  it('reste basse: c’est le flou qui fait la matière, pas la couleur', () => {
    // La teinte posée sur le verre ne dépasse pas 10 %.
    const opacities = [...DARK_GLASS.tint.matchAll(/,\s*(0\.\d+)\)/g)].map(m => Number(m[1]));
    expect(Math.max(...opacities)).toBeLessThanOrEqual(0.10);
  });

  it('a un repli assez dense pour que la barre ne soit pas traversable', () => {
    const opacities = [...DARK_GLASS.tintFallback.matchAll(/,\s*(0\.\d+)\)/g)].map(m => Number(m[1]));
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.40);
    // …sans redevenir une plaque.
    expect(Math.max(...opacities)).toBeLessThan(0.60);
  });

  it('sert les DEUX barres, qui ne réécrivent pas la valeur chez elles', () => {
    for (const src of [navSource, shellSource]) {
      expect(src).toContain('glassTints');
      // Aucun dégradé de teinte écrit à la main dans le fichier.
      expect(src).not.toMatch(/tint(Fallback)?=["']linear-gradient/);
    }
  });

  it('garde une recette claire distincte, pour la barre au repos', () => {
    expect(LIGHT_GLASS.tint).not.toBe(DARK_GLASS.tint);
    expect(LIGHT_GLASS.tintFallback).toContain('--q2-canvas');
  });
});
