import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { CONSENT_STATEMENTS } from '../consent-statements';

/**
 * Le libellé affiché et le libellé enregistré doivent être le MÊME texte.
 *
 * Le formulaire montre sa propre copie (le serveur ne la lui envoie pas), et
 * le serveur enregistre la sienne (il ne fait jamais confiance à celle du
 * navigateur). Ce découplage est délibéré: il empêche qu'un texte réécrit côté
 * client devienne la preuve. Mais il crée un risque symétrique — que les deux
 * copies divergent, auquel cas on prouverait un consentement à une phrase que
 * la personne n'a jamais lue.
 *
 * Ce test est le seul point qui les tient ensemble.
 */

const FRONT_FILE = join(__dirname, '../../../../frontend/src/config/consent-statements.ts');

describe('libellés de consentement', () => {
  it('sont identiques côté serveur et côté formulaire', () => {
    const front = readFileSync(FRONT_FILE, 'utf8');

    for (const [locale, statement] of Object.entries(CONSENT_STATEMENTS)) {
      expect(
        front.includes(statement),
        `Le libellé « ${locale} » du serveur est absent du fichier frontend. ` +
        'Les deux copies ont divergé: le texte affiché ne serait plus celui enregistré.',
      ).toBe(true);
    }
  });

  it('nomment l’appelant, l’objet et le droit de retrait', () => {
    /* Les trois éléments qui rendent le consentement « spécifique, éclairé et
       révocable » au sens de la loi n° 2025-594. Un libellé qui en perdrait un
       resterait une case cochée, mais cesserait d'être une preuve. */
    for (const [locale, statement] of Object.entries(CONSENT_STATEMENTS)) {
      expect(statement, `${locale}: l'appelant doit être nommé`).toContain('Qwillio');
      expect(statement.length, `${locale}: libellé suspicieusement court`).toBeGreaterThan(80);
      expect(
        /retirer|intrekken|withdraw/i.test(statement),
        `${locale}: le droit de retrait doit être annoncé AVANT le clic`,
      ).toBe(true);
    }
  });
});
