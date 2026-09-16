import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Une date rendue par le MODÈLE ne se pose jamais en base sans être relue.
 *
 * `client-call.service.ts` faisait `new Date(analysis.bookingDate)` à DEUX
 * endroits, sans format, sans borne, sans rien. Conséquence relevée sur un
 * compte réel le 16/09/2026: une réservation datée `2023-09-18` pour une
 * conversation de septembre 2026. Une ligne pareille est invisible partout
 * (le calendrier du portail charge un mois, `lookupBooking` et
 * `rescheduleBooking` ne lisent que les rendez-vous à venir), donc l'appelant
 * avait bien un rendez-vous et l'agent répondait « AUCUNE RESERVATION » neuf
 * fois de suite.
 *
 * Ce test lit le SOURCE, comme ceux de 6novodecies et 6tertrigesies: il ne
 * remplace pas les tests du parseur, il empêche la forme fautive de revenir
 * par un troisième chemin d'écriture.
 *
 * PIÈGE DE MÉTHODE, déjà payé (6vicies): un test qui lit le source doit
 * d'abord RETIRER les commentaires. Le commentaire posé au-dessus d'un
 * correctif nomme forcément la forme fautive, donc le test tomberait sur sa
 * propre explication. C'est le cas ici, mot pour mot.
 */
const SOURCE = readFileSync(
  join(__dirname, '..', 'client-call.service.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('la date du modèle passe par le parseur, jamais par `new Date`', () => {
  it('aucun `new Date(analysis.bookingDate)` ne subsiste dans le code', () => {
    expect(CODE).not.toMatch(/new\s+Date\s*\(\s*analysis\.bookingDate/);
  });

  it('le parseur est bien appelé', () => {
    expect(CODE).toMatch(/parseAnalysisDate\s*\(/);
  });

  it("la date du jour vient du fuseau de l'ENTREPRISE, pas du serveur", () => {
    /* Le serveur est en Oregon: `new Date()` y est encore la veille quand il
       est déjà demain à Bruxelles, et « date passée » se jugerait alors sur
       le mauvais jour. */
    expect(CODE).toMatch(/todayIso\s*\(\s*businessTimezone\s*\(/);
  });

  it("la consigne d'analyse dit la date du jour au modèle", () => {
    /* Sans elle, le modèle lit « vendredi 18 septembre » et pose l'année
       qu'il veut: c'est la cause, le parseur n'est que le filet. */
    expect(CODE).toMatch(/analysisDateRule\s*\(/);
  });

  it('le commentaire qui explique le correctif nomme bien la forme fautive', () => {
    /* La preuve que le retrait des commentaires n'est pas décoratif: sans
       lui, le premier test de ce fichier tomberait sur cette phrase-là. */
    expect(SOURCE).toMatch(/new Date\(analysis\.bookingDate\)/);
  });
});
