import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QUEL APPEL L'AUDIT REGARDE (19/09/2026).
 *
 * Deux frictions relevées le même jour, et les deux coûtent un aller-retour.
 *
 * 1. `npm run voice:audit` prend le DERNIER appel. Une séance de test produit
 *    des appels morts (raccroché à 4 s, faux départ), et l'audit a donc porté
 *    sur un appel d'une réplique pendant qu'on lisait le transcript d'un autre
 *    de deux minutes. Tout le relevé était hors sujet sans le dire.
 *
 * 2. L'identifiant qu'on a sous la main est le SID TWILIO (`CAff00102f…`),
 *    parce que c'est ce que la console affiche. Passé à `--call`, il ne
 *    matchait rien et Vapi répondait « ne rend pas l'appel »: ça ressemble à
 *    une panne, alors que c'est un identifiant de l'autre système.
 *
 * Le test lit le SOURCE: le script parle à Vapi et à la base, donc l'exercer
 * demanderait les deux. Les commentaires sont retirés d'abord — celui du
 * correctif nomme forcément la forme fautive (6vicies).
 */
const src = readFileSync(join(__dirname, '../audit-call.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe("l'audit sait quel appel viser", () => {
  it('accepte un décalage pour viser un appel autre que le dernier', () => {
    expect(src).toMatch(/arg\('skip'\)/);
    expect(src).toMatch(/\bskip,/);
  });

  it('reconnaît un SID Twilio au lieu de le passer à Vapi tel quel', () => {
    expect(src).toMatch(/\^CA\[0-9a-f\]\{32\}\$/);
    expect(src).toMatch(/resolveTwilioSid/);
  });

  it('résout le SID en SCANNANT le corps, sans deviner le nom du champ', () => {
    /* `phoneCallProviderId` est le nom probable, mais un champ ne se déduit
       jamais de la documentation (6quinvicies): la recherche reste juste quel
       que soit l'endroit où Vapi le range. */
    expect(src).toMatch(/JSON\.stringify\(c\)\.includes\(sid\)/);
    expect(src).not.toMatch(/phoneCallProviderId/);
  });

  it('dit que le SID est du mauvais système plutôt que « Vapi ne rend pas »', () => {
    expect(src).toMatch(/SID TWILIO, pas un identifiant Vapi/);
  });
});
