import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import StepFrame from './StepFrame';

const scene = vi.hoisted(() => ({
  position: 0,
  reduced: false,
  onScroll: null as (() => void) | null,
}));
vi.mock('./reducedMotion', () => ({ prefersReducedMotion: () => scene.reduced }));
vi.mock('./sceneProgress', () => ({
  sceneAt: () => scene.position,
  sceneStarted: () => true,
  staggeredAt: (position: number) => position,
  onScrollFrame: (callback: () => void) => {
    scene.onScroll = callback;
    callback();
    return () => { scene.onScroll = null; };
  },
}));

let root: HTMLDivElement;
let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
let now = 0;

beforeEach(() => {
  frames = new Map();
  frameId = 0;
  now = 0;
  scene.position = 0;
  scene.reduced = false;
  scene.onScroll = null;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  root = document.createElement('div');
  root.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  for (const y of [0, 300]) {
    const step = document.createElement('div');
    step.dataset.stepFrame = '';
    step.getBoundingClientRect = () => new DOMRect(20, y, 300, 120);
    root.appendChild(step);
  }
  document.body.appendChild(root);
});

afterEach(() => {
  cleanup();
  root.remove();
  vi.unstubAllGlobals();
});

function advance(count: number) {
  act(() => {
    for (let i = 0; i < count; i++) {
      now += 1000 / 60;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(now));
    }
  });
}

function scrollTo(position: number) {
  act(() => {
    scene.position = position;
    scene.onScroll?.();
  });
}

describe('StepFrame scroll spring lifecycle', () => {
  it('restarts from rest when scrolling, settles, and follows a reversed scroll', () => {
    const { container } = render(<StepFrame scope={{ current: root }} />);
    advance(120);
    const path = container.querySelector('[data-frame-path]')!;
    const initial = path.getAttribute('d');
    expect(frames.size).toBe(0);

    scrollTo(1);
    expect(frames.size).toBe(1);
    advance(1);
    expect(path.getAttribute('d')).not.toBe(initial);
    const intermediate = path.getAttribute('d');
    advance(120);
    const final = path.getAttribute('d');
    expect(final).not.toBe(intermediate);
    expect(frames.size).toBe(0);

    scrollTo(0);
    expect(frames.size).toBe(1);
    advance(120);
    expect(path.getAttribute('d')).toBe(initial);
    expect(frames.size).toBe(0);
  });

  it('cancels the pending spring frame and scroll subscription when unmounted', () => {
    const { unmount } = render(<StepFrame scope={{ current: root }} />);
    advance(120);
    scrollTo(1);
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    expect(scene.onScroll).toBeNull();
  });

  it('does not render or subscribe when reduced motion is requested', () => {
    scene.reduced = true;
    const { container } = render(<StepFrame scope={{ current: root }} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(frames.size).toBe(0);
    expect(scene.onScroll).toBeNull();
  });
});
