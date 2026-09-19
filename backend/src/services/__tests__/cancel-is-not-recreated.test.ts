import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * UN RENDEZ-VOUS ANNULÉ NE RESSUSCITE PAS AU RACCROCHÉ (19/09/2026).
 *
 * Le post-appel relit la transcription et crée une ligne dès qu'il y voit un
 * rendez-vous demandé. Or un appelant qui ANNULE parle forcément du sien: il
 * en donne la date, l'heure et son nom, c'est-à-dire exactement ce que
 * l'analyse cherche. Sans garde, la séquence était:
 *
 *   1. l'outil annule la ligne et libère le créneau;
 *   2. l'appelant raccroche, rassuré;
 *   3. le post-appel lit « mon rendez-vous du 22 septembre à 14 heures »,
 *      en conclut `bookingRequested`, et écrit une ligne NEUVE au même
 *      créneau;
 *   4. un SMS de confirmation part pour le rendez-vous qu'il vient d'annuler.
 *
 * C'est le doublon du 12/09/2026 (6trigesies) retourné: là, un rendez-vous
 * pris en direct était recréé; ici, c'est un rendez-vous annulé qui revient.
 * Il se ferme au même endroit et de la même façon — ce que l'outil a fait
 * PENDANT l'appel est la vérité, la transcription n'est qu'un souvenir.
 *
 * Test de SOURCE, comme son voisin `analysis-language.test.ts`: ce chemin
 * traverse Prisma, l'analyse OpenAI, le CRM, les SMS et Discord, et le
 * bouchonner en entier mesurerait surtout la qualité des bouchons.
 */
const CALLS = readFileSync(join(__dirname, '..', 'client-call.service.ts'), 'utf8');
const WEBHOOK = readFileSync(join(__dirname, '..', '..', 'controllers', 'voice-webhook.controller.ts'), 'utf8');

/** Le corps de la branche d'annulation, jusqu'à la suivante. */
const branch = (() => {
  const start = CALLS.indexOf('} else if (extra.liveCancelledBookingId) {');
  return start < 0 ? '' : CALLS.slice(start, CALLS.indexOf('} else if', start + 10));
})();

describe('une annulation prise en direct arrête le post-appel', () => {
  it('a sa branche, avant toute création', () => {
    const cancelAt = CALLS.indexOf('extra.liveCancelledBookingId');
    const createAt = CALLS.indexOf('analysis.bookingRequested && bookingDay?.ok');
    expect(cancelAt).toBeGreaterThanOrEqual(0);
    /* L'ORDRE est la moitié du correctif: placée après, la branche ne serait
       jamais atteinte, la création l'ayant déjà emporté. */
    expect(createAt).toBeGreaterThan(cancelAt);
  });

  it('ne crée aucune réservation dans cette branche', () => {
    expect(branch).not.toMatch(/clientBooking\.create/);
  });

  it("n'envoie aucun SMS de confirmation", () => {
    /* Le pire des deux symptômes: l'appelant raccroche en ayant annulé, et
       reçoit une confirmation. */
    expect(branch).not.toMatch(/sendBookingConfirmationSMS/);
  });

  it("ne compte pas l'appel comme un rendez-vous obtenu", () => {
    /* `bookingConfirmed` décide de ce que le gérant lit dans sa notification.
       Un appelant qui annule repart SANS rendez-vous: dire l'inverse ferait
       d'une perte une bonne nouvelle. */
    expect(branch).not.toMatch(/bookingConfirmed = true/);
  });

  it('relie quand même la ligne annulée à son appel', () => {
    // Sinon l'annulation n'a aucune trace dans la fiche d'appel du portail.
    expect(branch).toMatch(/clientCallId: clientCall\.id/);
  });
});

describe("le drapeau voyage depuis l'appel, sinon il ne sert à rien", () => {
  it("le webhook le lit dans les métriques et le passe au post-appel", () => {
    /* Le mécanisme qui n'atteint pas le chemin réel n'existe pas: c'est la
       famille 6quindecies, sept fois payée dans ce dépôt. */
    expect(WEBHOOK).toMatch(/liveCancelledBookingId/);
    expect(WEBHOOK).toMatch(/cancelledBookingId/);
  });

  it('et les métriques le portent depuis la session', () => {
    const metrics = readFileSync(
      join(__dirname, '..', 'voice', 'realtime-orchestrator.service.ts'), 'utf8',
    );
    expect(metrics).toMatch(/cancelledBookingId: session\.cancelledBookingId/);
  });
});
