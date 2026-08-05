import { describe, it, expect } from 'vitest';
import { blobPath, blobKeyframes, BLOB_POINTS } from './blobPath';

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

describe('the keyframes', () => {
  const frames = blobKeyframes(100, 100, 30, 1.2);

  it('every frame has the same structure, or nothing can interpolate', () => {
    // This is the constraint that decides the whole design: an animation
    // between two outlines is only possible when they carry the same points in
    // the same order.
    const shape = commands(frames[0]);
    const count = numbers(frames[0]).length;
    for (const frame of frames) {
      expect(commands(frame)).toEqual(shape);
      expect(numbers(frame)).toHaveLength(count);
    }
  });

  it('calms down rather than wobbling for ever', () => {
    const spread = (d: string) => {
      const points = numbers(d);
      const radii: number[] = [];
      for (let i = 0; i < points.length; i += 2) {
        radii.push(Math.hypot(points[i] - 100, points[i + 1] - 100));
      }
      return Math.max(...radii) - Math.min(...radii);
    };
    expect(spread(frames[0])).toBeGreaterThan(spread(frames[frames.length - 1]));
  });

  it('ends on a circle, so the handover to the real logo has no jump', () => {
    const shapes = blobKeyframes(0, 0, 10, 0.7);
    const last = shapes[shapes.length - 1];
    const points = numbers(last);
    for (let i = 0; i < points.length; i += 2) {
      expect(Math.hypot(points[i], points[i + 1])).toBeLessThanOrEqual(10.6);
    }
  });

  it('gives two bubbles different shapes at the same moment', () => {
    // Twins deforming in unison are the fastest way to make something look
    // computed.
    expect(blobKeyframes(0, 0, 10, 0)[0]).not.toBe(blobKeyframes(0, 0, 10, 3.4)[0]);
  });
});
