import { describe, it, expect, beforeEach } from 'vitest';
import {
  reserveDemoSeconds,
  remainingDemoSeconds,
  __resetDemoQuota,
  DEMO_DAILY_SECONDS,
  DEMO_MAX_CALL_SECONDS,
  __setDemoUsed,
} from '../demo-quota.service';

beforeEach(() => __resetDemoQuota());

describe('quota de la démo publique', () => {
  it("n'accorde qu'un appel au premier essai, pas le quota du jour", () => {
    // Le premier clic prenait la journée entière, même raccroché aussitôt: la
    // démonstration, qui est l'outil de conversion du site, se fermait au
    // premier essai.
    expect(reserveDemoSeconds('1.2.3.4')).toBe(DEMO_MAX_CALL_SECONDS);
    expect(remainingDemoSeconds('1.2.3.4')).toBe(DEMO_DAILY_SECONDS - DEMO_MAX_CALL_SECONDS);
  });

  it('laisse trois essais, puis refuse', () => {
    // Le decompte se fait a l'octroi: raccrocher tot ne rend pas le temps, et
    // c'est le seul cote ou l'erreur ne coute pas d'argent.
    for (let i = 0; i < 3; i++) expect(reserveDemoSeconds('1.2.3.4')).toBe(DEMO_MAX_CALL_SECONDS);
    expect(reserveDemoSeconds('1.2.3.4')).toBe(0);
    expect(remainingDemoSeconds('1.2.3.4')).toBe(0);
  });

  it('compte chaque visiteur séparément', () => {
    reserveDemoSeconds('1.2.3.4');
    expect(remainingDemoSeconds('5.6.7.8')).toBe(DEMO_DAILY_SECONDS);
  });

  it("n'accorde que ce qu'il reste quand c'est moins d'un appel", () => {
    // Ce cas ne se produit pas avec les constantes actuelles (le quota est un
    // multiple exact d'un appel), mais il existe dans le code: sans ce test,
    // changer l'une des deux constantes livrerait un comportement jamais joué.
    reserveDemoSeconds('7.7.7.7');
    reserveDemoSeconds('7.7.7.7');
    __setDemoUsed('7.7.7.7', DEMO_DAILY_SECONDS - 20);
    expect(reserveDemoSeconds('7.7.7.7')).toBe(20);
    expect(remainingDemoSeconds('7.7.7.7')).toBe(0);
  });

  it('annonce le quota entier à qui n’a rien consommé', () => {
    expect(remainingDemoSeconds('9.9.9.9')).toBe(DEMO_DAILY_SECONDS);
  });
});
