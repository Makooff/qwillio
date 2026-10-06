import { describe, it, expect, beforeEach } from 'vitest';
import {
  SIGNUP_PLANS,
  normalizeSignupPlan,
  captureSignupPlan,
  readSignupPlan,
  clearSignupPlan,
} from './signupSelection';

/* A4 — le forfait cliqué sur la page tarifs doit survivre jusqu'à la caisse,
   comme le fait déjà la période de facturation. Même mécanisme, mêmes règles:
   une valeur inconnue est rejetée, pas « dégradée » vers un forfait au hasard. */

beforeEach(() => {
  sessionStorage.clear();
});

describe('normalizeSignupPlan', () => {
  it('accepte les quatre forfaits vendus, quel que soit le casse', () => {
    expect(normalizeSignupPlan('solo')).toBe('solo');
    expect(normalizeSignupPlan('Starter')).toBe('starter');
    expect(normalizeSignupPlan('PRO')).toBe('pro');
    expect(normalizeSignupPlan('enterprise')).toBe('enterprise');
  });

  it('rejette toute valeur inconnue au lieu de deviner', () => {
    expect(normalizeSignupPlan('free_forever')).toBeNull();
    expect(normalizeSignupPlan('platinum')).toBeNull();
    expect(normalizeSignupPlan('')).toBeNull();
    expect(normalizeSignupPlan(null)).toBeNull();
    expect(normalizeSignupPlan(undefined)).toBeNull();
    expect(normalizeSignupPlan(42)).toBeNull();
  });

  it('expose exactement les forfaits du catalogue', () => {
    expect([...SIGNUP_PLANS]).toEqual(['solo', 'starter', 'pro', 'enterprise']);
  });
});

describe('captureSignupPlan / readSignupPlan', () => {
  it('conserve le forfait passé en query string', () => {
    captureSignupPlan('?plan=enterprise&billing=annual');
    expect(readSignupPlan()).toBe('enterprise');
  });

  it('ignore un forfait inconnu: le défaut reste une décision de l\'écran', () => {
    captureSignupPlan('?plan=free_forever');
    expect(readSignupPlan()).toBeNull();
  });

  it('ignore une query sans plan', () => {
    captureSignupPlan('?billing=annual');
    expect(readSignupPlan()).toBeNull();
  });

  it('renvoie null quand le stockage contient une valeur corrompue', () => {
    sessionStorage.setItem('qwillio.signupPlan', 'platinum');
    expect(readSignupPlan()).toBeNull();
  });

  it('survit à une sessionStorage refusée (navigation privée stricte)', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: () => { throw new Error('denied'); },
        setItem: () => { throw new Error('denied'); },
        removeItem: () => { throw new Error('denied'); },
        clear: () => { throw new Error('denied'); },
      },
      configurable: true,
    });
    try {
      captureSignupPlan('?plan=solo');
      expect(readSignupPlan()).toBeNull();
      expect(() => clearSignupPlan()).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });
});

describe('clearSignupPlan', () => {
  it('efface le choix après usage, comme la période', () => {
    captureSignupPlan('?plan=solo');
    clearSignupPlan();
    expect(readSignupPlan()).toBeNull();
  });
});
