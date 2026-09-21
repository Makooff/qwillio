import { describe, it, expect } from 'vitest';
import { measureDbRoundTrip } from '../db-round-trip';

/**
 * La sonde répond à UNE question: la base est-elle loin du processus qui sert
 * l'appel. Elle ne doit jamais rendre un chiffre qui se lirait « à côté »
 * quand elle n'a rien pu mesurer.
 */
describe('measureDbRoundTrip', () => {
  /** Horloge écrite à la main: une valeur par lecture, dans l'ordre. */
  const clock = (readings: number[]) => {
    let i = 0;
    return () => readings[i++] ?? 0;
  };

  it('rend le PLANCHER et le PIRE, pas une moyenne', async () => {
    /* Les deux répondent à des questions différentes: le plancher est le
       réseau, le pire est un réveil de pool. Une moyenne ne répond ni à l'une
       ni à l'autre, et 126 ms de moyenne se lirait « loin » sur une base qui
       répond en 68. */
    const rt = await measureDbRoundTrip(3, clock([0, 70, 100, 340, 400, 468]), async () => {});
    expect(rt).toEqual({ floorMs: 68, worstMs: 240, samples: 3 });
  });

  it('sonde EN SÉQUENCE: chacune paie son propre trajet', async () => {
    /* En parallèle, trois sondes reviennent ensemble et le plancher serait le
       même quelle que soit la distance: on mesurerait la largeur du pool. */
    let inFlight = 0;
    let worst = 0;
    await measureDbRoundTrip(3, clock([0, 5, 5, 10, 10, 15]), async () => {
      inFlight++;
      worst = Math.max(worst, inFlight);
      await Promise.resolve();
      inFlight--;
    });
    expect(worst).toBe(1);
  });

  it("une base injoignable rend `null`, jamais zéro", async () => {
    /* Un zéro se lirait « la base est à côté », soit l'inverse exact de ce qui
       se passe, et l'audit le noterait VERT. */
    const rt = await measureDbRoundTrip(3, clock([0, 1, 2]), async () => {
      throw new Error('P1001');
    });
    expect(rt).toBeNull();
  });

  it('une sonde qui tombe sur trois ne fait pas tomber la mesure', async () => {
    let n = 0;
    /* Une sonde ratée ne lit pas d'heure de fin: la seconde ne consomme donc
       qu'une valeur d'horloge. */
    const rt = await measureDbRoundTrip(3, clock([0, 70, 100, 200, 272]), async () => {
      if (++n === 2) throw new Error('P1001');
    });
    expect(rt).toEqual({ floorMs: 70, worstMs: 72, samples: 2 });
  });
});
