import { describe, it, expect } from 'vitest';
import { hashApiKey } from '../api-key-hash';

describe('hashApiKey', () => {
  /**
   * L'invariant qui porte toute la migration.
   *
   * La reprise de l'existant est faite EN SQL par
   * `encode(sha256("key"::bytea), 'hex')`, et l'authentification recalcule le
   * condensat en Node. Si les deux divergeaient d'un iota — encodage, casse
   * hexadécimale, sel implicite — toutes les clés déjà distribuées cesseraient
   * de fonctionner d'un coup, sans moyen de revenir en arrière une fois la
   * colonne en clair retirée.
   *
   * Ce vecteur est le SHA-256 d'ASCII « abc », la valeur de référence du
   * standard: il fixe à la fois l'algorithme, l'encodage d'entrée (UTF-8) et
   * la sortie (hexadécimal minuscule), qui sont exactement les trois points où
   * Node et PostgreSQL pourraient s'écarter.
   */
  it('produit le SHA-256 hexadécimal minuscule standard', () => {
    expect(hashApiKey('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('est déterministe, ce qui permet la recherche par index unique', () => {
    const key = 'qw_0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('sépare deux clés voisines', () => {
    expect(hashApiKey('qw_aaaa')).not.toBe(hashApiKey('qw_aaab'));
  });

  it('ne laisse pas transparaître la clé', () => {
    const key = 'qw_secret_a_ne_pas_fuiter';
    expect(hashApiKey(key)).not.toContain('secret');
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });
});
