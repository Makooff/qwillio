import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CE QUE L'APPELANT ATTEND PENDANT QUE L'OUTIL TOURNE (20/09/2026).
 *
 * Le propriétaire a tranché la priorité le 17/09: « les outils un peu longs ne
 * me dérangent pas, ça rajoute du réalisme ». Mais le relevé du 18/09 montre
 * `lookupBooking` à 6,1 s et `captureLead` à 7,7 s, et l'audit avait déjà
 * écarté l'agenda Google: ce sont des requêtes Prisma (6unsexagesies).
 *
 * Et la lenteur ne fait pas qu'attendre, elle FABRIQUE le chevauchement:
 * « il met du temps à répondre donc il répond en même temps que moi »
 * (6octoquinquagesies), plus le bavardage que le modèle produit pour meubler
 * (6sexagesies).
 *
 * Deux gains SÛRS ici, sans toucher à un seuil que personne n'a mesuré.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const RUNTIME = stripComments(readFileSync(join(__dirname, '..', 'tool-runtime.service.ts'), 'utf8'));
const ORCHESTRATOR = stripComments(
  readFileSync(join(__dirname, '..', 'realtime-orchestrator.service.ts'), 'utf8'),
);

describe('les deux lectures de réservations partent ensemble', () => {
  it('une seule attente, pas deux allers-retours enchaînés', () => {
    /* Elles sont indépendantes par construction: la recherche par nom EXCLUT
       les numéros que la recherche par numéro sélectionne (`notIn`), donc
       aucune ne peut dépendre de l'autre. */
    const fn = RUNTIME.slice(
      RUNTIME.indexOf('const numberForms = callerNumber'),
      RUNTIME.indexOf('const rows = [...byNumber, ...byName]'),
    );
    expect(fn).toMatch(/await Promise\.all\(\[/);
    expect(fn).not.toMatch(/const byNumber = numberForms\.length\s*\?\s*await/);
  });

  it("garde l'exclusion qui rend les deux lectures indépendantes", () => {
    // Sans `notIn`, les paralléliser ferait compter deux fois le même rendez-vous.
    expect(RUNTIME).toMatch(/customerPhone: \{ notIn: numberForms \}/);
  });
});

describe('le jeton Google est frappé pendant que l\'accueil se dit', () => {
  it('le préchauffage existe', () => {
    expect(RUNTIME).toMatch(/async warmCalendarToken\(clientId: string\)/);
    expect(RUNTIME).toMatch(/getAccessTokenFromRefresh\(client\.googleCalendarRefreshToken\)/);
  });

  it("est appelé à l'ouverture de l'appel, avec les autres préchauffages", () => {
    /* Un préchauffage jamais branché ne réchauffe rien, et le premier
       `checkAvailability` continuerait de payer la frappe sur le tour où
       l'appelant attend (6quindecies). */
    expect(ORCHESTRATOR).toMatch(/warmCalendarToken\(clientId\)/);
  });

  it("n'est jamais attendu par l'appel", () => {
    // Un échec de préchauffage ne doit pas peser sur l'accueil: l'outil relira.
    const warm = ORCHESTRATOR.slice(
      ORCHESTRATOR.indexOf('export function warmCallerContext'),
      ORCHESTRATOR.indexOf('export function warmCallerContext') + 600,
    );
    expect(warm).toMatch(/void toolRuntimeService\.warmCalendarToken\(clientId\)\.catch/);
  });

  it('ne frappe rien quand le client n\'a pas connecté son agenda', () => {
    // Une lecture inutile par appel, sur tous les clients sans agenda.
    expect(RUNTIME).toMatch(/if \(!client\?\.googleCalendarRefreshToken\) return;/);
  });
});
