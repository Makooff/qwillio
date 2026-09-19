import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * LE REPLI DE PRISMA EST BORNÉ DES DEUX CÔTÉS (19/09/2026).
 *
 * La branche « démarrage à froid » plafonnait à 10 s, la branche « transitoire »
 * ne plafonnait pas: `250 * 2^attempt` sur douze essais monte à 512 SECONDES au
 * dernier, et la série entière dépasse dix-sept minutes pour UNE requête.
 *
 * Ce qui rend l'asymétrie coûteuse plutôt que théorique: cette enveloppe
 * s'applique à `$allOperations`, donc AUSSI aux requêtes du chemin d'un appel
 * en cours, où un appelant attend et où la cible d'un outil est 1,5 s.
 *
 * Le test lit le SOURCE parce que le module construit un vrai `PrismaClient` à
 * l'import: l'exercer demanderait une base. Les commentaires sont retirés
 * d'abord — celui du correctif nomme forcément la forme fautive (6vicies).
 */
const src = readFileSync(join(__dirname, '../config/database.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('le repli de Prisma', () => {
  it('plafonne le repli TRANSITOIRE, pas seulement celui du démarrage à froid', () => {
    /* La forme fautive exacte: une puissance de deux sans `Math.min`. */
    expect(src).not.toMatch(/:\s*250\s*\*\s*Math\.pow\(2,\s*attempt\)/);
    expect(src).toMatch(/Math\.min\(\s*\d+\s*,\s*250\s*\*\s*Math\.pow\(2,\s*attempt\)\s*\)/);
  });

  it('plafonne toujours le démarrage à froid, qui était déjà juste', () => {
    expect(src).toMatch(/Math\.min\(\s*10000\s*,\s*1000\s*\*\s*Math\.pow\(2,\s*attempt\)\s*\)/);
  });

  it('borne les deux plafonds sous le délai d\'un outil de voix', () => {
    /* Un outil vise 1,5 s et Vapi coupe bien avant une minute: un plafond de
       repli qui dépasserait dix secondes rendrait le retry invisible à
       l'appelant, qui aurait déjà raccroché. */
    const caps = [...src.matchAll(/Math\.min\(\s*(\d+)\s*,\s*\d+\s*\*\s*Math\.pow\(2,\s*attempt\)/g)]
      .map(m => Number(m[1]));
    expect(caps.length).toBe(2);
    for (const cap of caps) expect(cap).toBeLessThanOrEqual(10_000);
  });

  it('rend le PREMIER repli visible en production', () => {
    /* Il était en `debug`, donc muet: une requête pouvait payer 250 ms plus un
       aller-retour sans laisser de trace, et « pourquoi cet outil a mis six
       secondes » restait sans réponse. */
    expect(src).not.toMatch(/logger\.debug\(`\[prisma\]/);
    expect(src).toMatch(/logger\[attempt >= 1 \? 'warn' : 'info'\]/);
  });
});
