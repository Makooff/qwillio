import { describe, it, expect } from 'vitest';
import { blobPath, blobJourney, BLOB_POINTS } from './blobPath';

const commands = (d: string) => d.trim().split(/(?=[MCZ])/).map(part => part.trim()[0]);
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

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
    const points = numbers(d);
    for (let i = 0; i < points.length; i += 2) {
      const radius = Math.hypot(points[i], points[i + 1]);
      // Vertices are exact; control points sit outside, hence the loose bound.
      expect(radius).toBeLessThanOrEqual(10.6);
    }
  });

  it('swells only where the radius says to', () => {
    const radii = Array(BLOB_POINTS).fill(1);
    radii[0] = 1.4;
    const d = blobPath(0, 0, 10, radii);
    const [firstX, firstY] = numbers(d);
    // Vertex 0 is at three o'clock, so a longer radius moves it right and
    // nowhere else.
    expect(firstX).toBeCloseTo(14, 1);
    expect(firstY).toBeCloseTo(0, 1);
  });
});

describe('the journey', () => {
  const frames = blobJourney({ from: { x: -300, y: -300 }, to: { x: 100, y: 100 }, r: 30, seed: 7 });

  const centre = (d: string) => {
    const points = numbers(d);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < points.length; i += 2) { xs.push(points[i]); ys.push(points[i + 1]); }
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  };

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

  it('carries the travel in the path, not in a transform', () => {
    // This is what makes the shape move by itself rather than be slid across:
    // the outline is somewhere different in each frame, on its own coordinates.
    const first = centre(frames[0]);
    const last = centre(frames[frames.length - 1]);
    expect(first.x).toBeLessThan(-100);
    expect(last.x).toBeCloseTo(100, 0);
    expect(last.y).toBeCloseTo(100, 0);
  });

  it('covers most of the ground early, then settles', () => {
    const distance = (d: string) => Math.hypot(centre(d).x - 100, centre(d).y - 100);
    const half = frames[Math.floor(frames.length / 2)];
    // Past the midpoint it should be much closer to the target than to home.
    expect(distance(half)).toBeLessThan(distance(frames[0]) * 0.35);
  });

  it('calms down rather than wobbling for ever', () => {
    const spread = (d: string) => {
      const c = centre(d);
      const points = numbers(d);
      const radii: number[] = [];
      for (let i = 0; i < points.length; i += 2) radii.push(Math.hypot(points[i] - c.x, points[i + 1] - c.y));
      return Math.max(...radii) - Math.min(...radii);
    };
    expect(spread(frames[0])).toBeGreaterThan(spread(frames[frames.length - 1]));
  });

  it('ends on a circle, so the handover to the real logo has no jump', () => {
    const last = frames[frames.length - 1];
    const c = centre(last);
    const points = numbers(last);
    for (let i = 0; i < points.length; i += 2) {
      // Vertices are exact; control points sit outside, hence the loose bound.
      expect(Math.hypot(points[i] - c.x, points[i + 1] - c.y)).toBeLessThanOrEqual(31.8);
    }
  });

  it('is random-looking but identical on every launch', () => {
    // A sine wave reads as a pulse once you have watched it twice; Math.random
    // would give a different splash every time and an untestable one.
    const again = blobJourney({ from: { x: -300, y: -300 }, to: { x: 100, y: 100 }, r: 30, seed: 7 });
    expect(again).toEqual(frames);
    const other = blobJourney({ from: { x: -300, y: -300 }, to: { x: 100, y: 100 }, r: 30, seed: 8 });
    expect(other[0]).not.toBe(frames[0]);
  });
});
