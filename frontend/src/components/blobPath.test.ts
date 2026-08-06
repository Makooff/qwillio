import { describe, it, expect } from 'vitest';
import { blobPath, liquidJourney, BLOB_POINTS } from './blobPath';

const commands = (d: string) => d.trim().split(/(?=[MCZ])/).map(part => part.trim()[0]);
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

const bounds = (d: string) => {
  const points = numbers(d);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < points.length; i += 2) { xs.push(points[i]); ys.push(points[i + 1]); }
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
    w: Math.max(...xs) - Math.min(...xs),
  };
};

/** Every vertex's distance from the outline's own centre. */
const radii = (d: string) => {
  const c = bounds(d);
  const points = numbers(d);
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) out.push(Math.hypot(points[i] - c.x, points[i + 1] - c.y));
  return out;
};

describe('the outline', () => {
  it('closes, and is all cubic curves', () => {
    // Straight segments would show as flat spots on something meant to read as
    // a membrane.
    const d = blobPath(50, 50, 20, Array(BLOB_POINTS).fill(1));
    expect(commands(d)).toEqual(['M', ...Array(BLOB_POINTS).fill('C'), 'Z']);
  });

  it('draws a circle when every radius is the same', () => {
    const d = blobPath(0, 0, 10, Array(BLOB_POINTS).fill(1));
    // Every vertex of the path sits on the circle it approximates.
    for (const r of radii(d)) {
      // Vertices are exact; control points sit outside, hence the loose bound.
      expect(r).toBeLessThanOrEqual(10.2);
    }
  });

  it('swells only where the radius says to', () => {
    const all = Array(BLOB_POINTS).fill(1);
    all[0] = 1.4;
    const d = blobPath(0, 0, 10, all);
    const [firstX, firstY] = numbers(d);
    // Vertex 0 is at three o'clock, so a longer radius moves it right and
    // nowhere else.
    expect(firstX).toBeCloseTo(14, 1);
    expect(firstY).toBeCloseTo(0, 1);
  });
});

describe('the journey', () => {
  const from = { x: 60, y: 400 };
  const to = { x: 180, y: 371 };
  const frames = liquidJourney({ from, to, r0: 120, r1: 38, seed: 7 });

  it('every frame has the same structure, or nothing can interpolate', () => {
    // The constraint that decides the whole design: an animation between two
    // outlines is only possible when they carry the same points in the same
    // order.
    const shape = commands(frames[0]);
    const count = numbers(frames[0]).length;
    for (const frame of frames) {
      expect(commands(frame)).toEqual(shape);
      expect(numbers(frame)).toHaveLength(count);
    }
  });

  it('holds its ground first, deforming where it was put', () => {
    // The shapes are not flown in from off-screen: they are already there, big
    // and still, and they deform before they set off.
    const early = bounds(frames[Math.floor(frames.length * 0.15)]);
    const home = Math.hypot(early.x - from.x, early.y - from.y);
    const away = Math.hypot(early.x - to.x, early.y - to.y);
    // It does not sit perfectly still: a lopsided outline pulls its own middle
    // about, and the deeper the hollows the more it pulls. But it is still far
    // more where it was put than where it is going — that is the difference
    // between deforming in place and setting off.
    expect(home).toBeLessThan(away);
    // Still, but not frozen — the outline has moved on from the first frame.
    expect(early).not.toBe(frames[0]);
  });

  it('carries the travel in the path, not in a transform', () => {
    // This is what makes the shape move by itself rather than be slid across:
    // the outline is somewhere different in each frame, on its own coordinates.
    const last = bounds(frames[frames.length - 1]);
    expect(last.x).toBeCloseTo(to.x, 0);
    expect(last.y).toBeCloseTo(to.y, 0);
  });

  it('shrinks from the size it starts at down to a lobe of the mark', () => {
    expect(bounds(frames[0]).w).toBeGreaterThan(200);
    expect(bounds(frames[frames.length - 1]).w).toBeCloseTo(76, 0);
  });

  it('deforms locally: a swell one side, a hollow the other', () => {
    // The character of the reference, and what a whole-outline pulse cannot do.
    // Somewhere on this outline the radius is well over nominal and somewhere
    // else it is well under, at the same moment.
    const early = radii(frames[Math.floor(frames.length * 0.15)]);
    const mean = early.reduce((sum, r) => sum + r, 0) / early.length;
    expect(Math.max(...early) / mean).toBeGreaterThan(1.1);
    expect(Math.min(...early) / mean).toBeLessThan(0.9);
  });

  it('calms down on the way in, and ends round', () => {
    // The last frame has to be a circle, or the real mark taking over is a cut.
    const spread = (d: string) => {
      const all = radii(d);
      return (Math.max(...all) - Math.min(...all)) / Math.max(...all);
    };
    expect(spread(frames[0])).toBeGreaterThan(0.1);
    expect(spread(frames[frames.length - 1])).toBeLessThan(0.01);
  });

  it('is random-looking but identical on every launch', () => {
    // A sine wave reads as a pulse once you have watched it twice; Math.random
    // would give a different splash every time and an untestable one.
    const again = liquidJourney({ from, to, r0: 120, r1: 38, seed: 7 });
    expect(again).toEqual(frames);
    const other = liquidJourney({ from, to, r0: 120, r1: 38, seed: 21 });
    expect(other[0]).not.toBe(frames[0]);
  });
});
