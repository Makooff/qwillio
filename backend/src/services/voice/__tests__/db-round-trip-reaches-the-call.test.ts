import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * UN MÉCANISME QUI N'ATTEINT PAS UN APPEL RÉEL N'EST PAS PROUVÉ.
 *
 * C'est la règle la plus chère de ce dépôt (6quindecies, 6vicies, 6octovicies,
 * 6quinquetrigesies, 6sexsexagesies): le vocabulaire du transcripteur, le
 * constructeur de prompt, le bloc d'humeur et l'accueil pré-enregistré ont tous
 * été écrits, testés, et passés à un chemin qu'aucun appel n'emprunte. La sonde
 * de distance a exactement la même forme — un module pur, testable sur des
 * horloges écrites à la main — donc le même angle mort.
 *
 * Ce test lit le SOURCE et vérifie les trois choses qu'un test unitaire ne peut
 * pas voir: qu'elle part, qu'elle ne coûte rien à l'appelant, et que son relevé
 * survit jusqu'à l'audit.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const orchestrator = () =>
  stripComments(readFileSync(join(__dirname, '../realtime-orchestrator.service.ts'), 'utf8'));

describe('la sonde de distance atteint un appel réel', () => {
  it("part à l'ouverture de l'appel", () => {
    expect(orchestrator()).toMatch(/void noteDbRoundTrip\(vapiCallId\)/);
  });

  it("n'est JAMAIS attendue: l'accueil se dit pendant ce temps", () => {
    /* Trois allers-retours vers une base à l'autre bout du pays, attendus sur
       le chemin de l'appel, retarderaient exactement ce qu'ils mesurent. */
    expect(orchestrator()).not.toMatch(/await noteDbRoundTrip/);
  });

  it('son relevé voyage avec les métriques, sinon il meurt avec le processus', () => {
    /* La session vit en mémoire: sans cette ligne, la mesure existe pendant
       l'appel et l'audit ne la voit jamais. */
    expect(orchestrator()).toMatch(/dbRoundTrip: session\.dbRoundTrip/);
  });

  it("mesure avec le client NU, pas celui qui reprend tout seul", () => {
    /* `prisma` porte l'enveloppe de reprise (`$allOperations`, jusqu'à 4 s de
       replis, 6tersexagesies). Une sonde qui retenterait en silence mesurerait
       la reprise et rendrait un chiffre qui a l'air d'une lecture. */
    const src = stripComments(readFileSync(join(__dirname, '../db-round-trip.ts'), 'utf8'));
    expect(src).toMatch(/import \{ basePrisma \}/);
    expect(src).not.toMatch(/import \{ prisma \}/);
  });
});

/**
 * Même règle pour le compteur de replis Prisma: le journal existait déjà
 * (19/09, passé en `info`), et il se lisait dans Render, à la main, en
 * connaissant l'heure de l'appel. Un fait qui demande ça n'est pas lu.
 */
describe('le compteur de replis Prisma atteint un appel réel', () => {
  const database = () =>
    stripComments(readFileSync(join(__dirname, '../../../config/database.ts'), 'utf8'));

  it('compte AVANT de dormir: un processus tué pendant le repli a déjà payé', () => {
    /* Compter après l'attente ferait disparaître le pire cas, qui est
       justement celui qu'on cherche. */
    const src = database();
    const tally = src.indexOf('dbRetryTally.count++');
    const sleep = src.indexOf('await new Promise(r => setTimeout(r, backoff))');
    expect(tally).toBeGreaterThan(0);
    expect(sleep).toBeGreaterThan(tally);
  });

  it("compte l'attente ET les démarrages à froid, qui ne se réparent pas pareil", () => {
    expect(database()).toMatch(/dbRetryTally\.waitedMs \+= backoff/);
    expect(database()).toMatch(/if \(isColdStart\) dbRetryTally\.coldStarts\+\+/);
  });

  it('le relevé de départ est pris DANS `start()`, donc sur les trois chemins', () => {
    /* Posé chez un seul appelant, il manquerait aux autres et l'écart se
       lirait comme « aucun repli » sur les appels de ces chemins-là (6vicies). */
    const store = stripComments(readFileSync(join(__dirname, '../call-session.store.ts'), 'utf8'));
    expect(store).toMatch(/dbRetriesAtStart: dbRetrySnapshot\(\)/);
  });

  it("l'écart voyage avec les métriques, sinon il meurt avec le processus", () => {
    expect(orchestrator()).toMatch(/dbRetries: \(\(\) => \{/);
  });
});
