import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { formatDuration, daysUntil, exportToCSV } from './format';

describe('formatDuration', () => {
  it('returns a dash for falsy/zero durations', () => {
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(undefined)).toBe('-');
    expect(formatDuration(0)).toBe('-');
  });

  it('formats sub-minute durations as seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minute-plus durations as "Xm Ys"', () => {
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3661)).toBe('61m 1s');
  });
});

describe('daysUntil', () => {
  it('returns 0 for missing dates', () => {
    expect(daysUntil(null)).toBe(0);
    expect(daysUntil(undefined)).toBe(0);
  });

  it('never returns negative values for past dates', () => {
    expect(daysUntil(new Date(Date.now() - 10 * 86_400_000))).toBe(0);
  });

  it('counts whole days remaining for a future date', () => {
    expect(daysUntil(new Date(Date.now() + 5 * 86_400_000))).toBe(5);
  });
});

describe('exportToCSV', () => {
  beforeAll(() => {
    // jsdom does not implement these — provide stubs we can spy on.
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does nothing for empty data', () => {
    const spy = vi.spyOn(URL, 'createObjectURL');
    exportToCSV([], 'empty');
    expect(spy).not.toHaveBeenCalled();
  });

  it('escapes fields containing commas, quotes, and newlines', () => {
    // Capture the CSV string handed to the Blob constructor (jsdom's Blob
    // does not implement .text(), so we intercept the parts directly).
    let csvText = '';
    vi.stubGlobal('Blob', class {
      constructor(parts: string[]) { csvText = parts.join(''); }
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    exportToCSV(
      [{ name: 'Doe, John', note: 'say "hi"', bio: 'line1\nline2' }],
      'people',
    );

    // Comma + quote + newline fields must be wrapped in quotes; inner quotes doubled.
    expect(csvText).toContain('"Doe, John"');
    expect(csvText).toContain('"say ""hi"""');
    expect(csvText).toContain('"line1\nline2"');
  });
});
