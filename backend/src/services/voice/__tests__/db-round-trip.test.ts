import { describe, it, expect } from 'vitest';
import { measureDbRoundTrip, dbRegion } from '../db-round-trip';

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

/**
 * LA RÉGION SE LIT SUR L'HÔTE, ET RIEN D'AUTRE NE SORT.
 *
 * Sans elle, « 310 ms » ne se compare à aucune distance. Avec elle, on sait que
 * `us-east-1` depuis l'Oregon vaut ~70 ms, donc que 310 ms est un multiple et
 * pas la distance.
 */
describe('dbRegion', () => {
  const real = 'postgresql://user:MOTDEPASSE@ep-delicate-silence-amnou7z5-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

  it("lit la région d'un hôte Neon réel", () => {
    expect(dbRegion(real)).toBe('us-east-1');
  });

  it('ne laisse RIEN sortir que la région', () => {
    /* Un relevé voyage jusque dans un journal et dans une conversation: il ne
       transporte que ce qu'il doit prouver. */
    const got = dbRegion(real) ?? '';
    expect(got).not.toContain('MOTDEPASSE');
    expect(got).not.toContain('neondb');
    expect(got).not.toContain('ep-delicate');
  });

  it("rend `null` sur un hôte qu'elle ne sait pas lire, au lieu de deviner", () => {
    /* Une région devinée conclut sur une distance qu'on n'a pas lue. */
    expect(dbRegion('postgresql://u:p@localhost:5432/db')).toBeNull();
    expect(dbRegion('')).toBeNull();
  });

  it('lit les autres formes de région AWS', () => {
    expect(dbRegion('postgresql://u:p@x.eu-central-1.aws.neon.tech/db')).toBe('eu-central-1');
    expect(dbRegion('postgresql://u:p@x.ap-southeast-2.aws.neon.tech/db')).toBe('ap-southeast-2');
  });
});
