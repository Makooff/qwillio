import { describe, it, expect, afterEach, vi } from 'vitest';
vi.mock('./reducedMotion', () => ({ prefersReducedMotion: () => false }));
vi.mock('./sceneProgress', () => ({ onScrollFrame: () => () => {}, sceneAt: () => 0, sceneStarted: () => false }));
vi.mock('./GlowCard', () => ({ attachGlow: () => () => {} }));
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PinnedScene from './PinnedScene';

afterEach(cleanup);

const mount = () =>
  render(
    <PinnedScene aside={<h2>Titre</h2>}>
      <div>Acte un</div>
      <div>Acte deux</div>
    </PinnedScene>,
  );

describe('la scène épinglée au scroll', () => {
  /**
   * La régression que ce test tient, et elle ne se voit QUE sur téléphone.
   *
   * Sous 1024 px la scène redevient un simple empilement: plus d'épinglage,
   * plus de compteur d'étapes. Mais l'atténuation des actes non actifs
   * (`opacity-40`) restait appliquée en continu, gouvernée par une heuristique
   * JS de scroll: du corps de texte sous le seuil de contraste pendant la
   * lecture au doigt, pour un effet qui n'a de sens que dans la colonne
   * épinglée (desktop), là où le compteur existe.
   *
   * Le contrat: l'atténuation n'existe qu'à partir de `lg`. Sur mobile,
   * chaque acte reste en pleine opacité quel que soit l'état actif.
   */
  it('n’atténue les actes inactifs qu’à partir de lg', () => {
    const { container } = mount();
    const acts = container.querySelectorAll('[data-scene-act]');
    expect(acts.length).toBe(2);

    acts.forEach((act) => {
      const cls = act.className;
      // L'atténuation est réservée au breakpoint lg — jamais en mobile.
      expect(cls).toContain('lg:opacity-40');
      expect(cls.split(/\s+/)).not.toContain('opacity-40');
      // L'acte actif repasse pleine opacité à lg.
      expect(cls).toContain('data-[active=true]:lg:opacity-100');
    });
  });

  /* Le premier acte démarre actif (`active = 0`): son état ne doit pas
     dépendre d'une classe inerte absente. */
  it('marque le premier acte comme actif', () => {
    const { container } = mount();
    const first = container.querySelector('[data-scene-act]')!;
    expect(first).toHaveAttribute('data-active', 'true');
  });
});
