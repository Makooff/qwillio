import { describe, it, expect, beforeEach } from 'vitest';
import {
  reserveDemoSeconds,
  remainingDemoSeconds,
  __resetDemoQuota,
  DEMO_DAILY_SECONDS,
} from '../demo-quota.service';

beforeEach(() => __resetDemoQuota());

describe('quota de la démo publique', () => {
  it('accorde les deux minutes au premier appel', () => {
    expect(reserveDemoSeconds('1.2.3.4')).toBe(DEMO_DAILY_SECONDS);
  });

  it('refuse le deuxième appel du même visiteur le même jour', () => {
    // Le decompte se fait a l'octroi: raccrocher tot ne rend pas le temps, et
    // c'est le seul cote ou l'erreur ne coute pas d'argent.
    reserveDemoSeconds('1.2.3.4');
    expect(reserveDemoSeconds('1.2.3.4')).toBe(0);
    expect(remainingDemoSeconds('1.2.3.4')).toBe(0);
  });

  it('compte chaque visiteur séparément', () => {
    reserveDemoSeconds('1.2.3.4');
    expect(reserveDemoSeconds('5.6.7.8')).toBe(DEMO_DAILY_SECONDS);
  });

  it('annonce le quota entier à qui n’a rien consommé', () => {
    expect(remainingDemoSeconds('9.9.9.9')).toBe(DEMO_DAILY_SECONDS);
  });
});
