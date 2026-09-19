import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * LE MODÈLE AVAIT LA RÉPONSE ET NE L'A PAS DITE (19/09/2026).
 *
 * Appel réel, horodaté par Vapi:
 *
 *   17:49:25.500  lookupBooking démarre
 *   17:49:27.457  termine — 1207 ms — « Jean-Luc de la forge, le mardi
 *                 22 septembre 2026 a 14:00 »
 *   17:49:33.287  rappelé
 *   17:49:35.285  termine — 784 ms, MÊME réponse
 *
 * Puis SOIXANTE-HUIT SECONDES de « un instant, je vérifie », « la
 * vérification est toujours en cours », en tenant la réponse. Deux fois.
 * L'appelant a raccroché sur « vous êtes trop lent ».
 *
 * La cause n'est ni la base, ni l'agenda, ni la latence: c'est la FORME du
 * résultat. Il portait un fait suivi de CINQ phrases de procédure, 550
 * caractères. Le petit modèle a lu la procédure au lieu du fait, et le mot
 * qu'il a répété — « je vérifie » — est celui de « verifie avec
 * checkAvailability ».
 *
 * C'est 6sexagesies par l'autre bout: ce que le modèle doit DIRE, il le lit
 * dans un résultat d'outil, il ne le retient pas. La phrase à prononcer est
 * donc la PREMIÈRE ligne, et la procédure vient après.
 */

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const runtime = stripComments(
  readFileSync(join(__dirname, '../tool-runtime.service.ts'), 'utf8'),
);

/** La construction de la réponse de `lookupBooking`, commentaires retirés. */
const reply = runtime.slice(
  runtime.indexOf('const lead = found.length === 1'),
  runtime.indexOf('RESERVATION(S) DE CE CORRESPONDANT') + 1200,
);

describe('le résultat de lookupBooking mène par la phrase à dire', () => {
  it("ouvre par l'ordre de la prononcer, avant toute procédure", () => {
    /* L'ordre compte plus que le contenu: la même information placée après
       cinq phrases de consigne n'a pas été dite pendant 68 secondes. */
    const sayNow = reply.indexOf('DIS CECI MAINTENANT');
    const procedure = reply.indexOf('checkAvailability');
    expect(sayNow).toBeGreaterThanOrEqual(0);
    expect(procedure).toBeGreaterThan(sayNow);
  });

  it("interdit explicitement de dire qu'il vérifie", () => {
    /* Le modèle a prononcé « je vérifie » en tenant la réponse. La consigne
       le nomme, parce que c'est le mot exact qu'il a repris à la procédure. */
    expect(reply).toMatch(/ne dis pas que tu verifies/);
    expect(reply).toMatch(/N'appelle AUCUN outil pour cette phrase/);
  });

  it('ne pose la procédure de déplacement que sous condition', () => {
    /* La poser d'office, c'est souffler « vérifie » à un modèle qui n'a
       qu'une date à lire. Elle devient conditionnelle. */
    expect(reply).toMatch(/S'IL VEUT LA DEPLACER, et seulement alors/);
  });

  it("garde l'anglais aligné sur le français", () => {
    /* Deux rédactions à la main pour la même règle divergent en moins d'un
       mois (6vicies); ici elles vivent dans la même expression. */
    expect(reply).toMatch(/SAY THIS NOW/);
    expect(reply).toMatch(/IF THEY WANT TO MOVE IT, and only then/);
  });
});
