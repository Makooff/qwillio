import { describe, it, expect } from 'vitest';
import { createSpringTracker, SPRING_PRESETS } from './springTracker';

/**
 * Le cadre V2 suit le scroll via un RESSORT PHYSIQUE, pas un tween à durée
 * fixe: c'est le scroll qui donne les consignes (position cible), le ressort
 * donne la trajectoire (inertie, rattrapage, rebond contenu). Ces tests
 * tiennent le contrat du helper; StepFrame ne fait que le brancher au scroll.
 */

const stepMany = (
  tracker: ReturnType<typeof createSpringTracker>,
  target: number,
  seconds: number,
  dt = 1 / 60,
) => {
  let v = tracker.value;
  for (let t = 0; t < seconds; t += dt) v = tracker.update(target, dt);
  return v;
};

describe('createSpringTracker', () => {
  it('converge vers la cible sans la dépasser en amortissement fort', () => {
    const tracker = createSpringTracker({ stiffness: 170, damping: 30, mass: 1 });
    tracker.value = 0;
    const v = stepMany(tracker, 2, 2);
    expect(v).toBeCloseTo(2, 3);
    // Amorti fort = pas de dépassement significatif en chemin.
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(2.0001);
  });

  it('dépasse légèrement la cible quand il est sous-amorti (preuve que c’est un ressort, pas un tween)', () => {
    const tracker = createSpringTracker({ stiffness: 170, damping: 6, mass: 1 });
    tracker.value = 0;
    let max = -Infinity;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      const v = tracker.update(1, 1 / 60);
      max = Math.max(max, v);
    }
    expect(max).toBeGreaterThan(1.01);
  });

  it('reste continu quand la cible est inversée au milieu du trajet (retour du scroll)', () => {
    const tracker = createSpringTracker({ stiffness: 170, damping: 22, mass: 1 });
    tracker.value = 0;
    let prev = tracker.value;
    // Vers la cible 3...
    for (let t = 0; t < 0.4; t += 1 / 60) prev = tracker.update(3, 1 / 60);
    // ...retour de la cible à 0 dès l'événement de scroll suivant.
    for (let t = 0; t < 0.2; t += 1 / 60) {
      const v = tracker.update(0, 1 / 60);
      // Aucun saut : le ressort repart de là où il en est, il ne se téléporte pas.
      expect(Math.abs(v - prev)).toBeLessThan(0.35);
      prev = v;
    }
    // Et il finit par revenir vers la nouvelle cible.
    const settled = stepMany(tracker, 0, 2);
    expect(settled).toBeCloseTo(0, 2);
  });

  it('ne produit jamais NaN ni Infinity, même avec un dt nul ou aberrant', () => {
    const tracker = createSpringTracker({ stiffness: 170, damping: 26, mass: 1 });
    for (const dt of [0, 1, -0.5, 10]) {
      const v = tracker.update(1, dt);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('isSettled permet d’arrêter la boucle RAF sans fuite', () => {
    const tracker = createSpringTracker({ stiffness: 170, damping: 26, mass: 1 });
    expect(tracker.isSettled(1)).toBe(false); // valeur 0, cible 1 : le ressort doit encore bouger
    stepMany(tracker, 1, 3);
    expect(tracker.isSettled(1)).toBe(true);
  });

  it('le preset du cadre V2 est sous-amorti modérément (suivi souple, sans rubber exagéré)', () => {
    const { stiffness, damping, mass } = SPRING_PRESETS.stepFrame;
    expect(stiffness).toBeGreaterThan(100);
    expect(stiffness).toBeLessThan(300);
    // damping ratio ζ = damping / (2·√(stiffness·mass)) ∈ ~[0.7, 1]: souple, pas rebondissant.
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    expect(zeta).toBeGreaterThan(0.6);
    expect(zeta).toBeLessThan(1.1);
  });
});
