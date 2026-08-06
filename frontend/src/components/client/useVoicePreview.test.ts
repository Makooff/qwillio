import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __audio } from './useVoicePreview';

/**
 * The audio context is where every intermittent preview failure has come from:
 * a page reopened a few times, a phone call, a backgrounded app. None of it is
 * reachable through the hook without a real device, so the plumbing is tested
 * directly.
 */

class FakeContext {
  static made = 0;
  state: 'suspended' | 'running' | 'closed' | 'interrupted' = 'suspended';
  currentTime = 0;
  resumeCalls = 0;
  closed = false;
  /** Set to make resume() never settle, the way iOS does under interruption. */
  resumeHangs = false;

  constructor() { FakeContext.made++; }

  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.resumeHangs) return new Promise<void>(() => undefined);
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

beforeEach(() => {
  FakeContext.made = 0;
  __audio.reset();
  vi.stubGlobal('AudioContext', FakeContext);
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
});

describe('the page keeps exactly one audio context', () => {
  it('reuses it across lists', () => {
    // The character grid and the voice list each used to build their own, and
    // iOS caps how many a page may hold: past the cap the constructor throws
    // and nothing plays again until the tab is closed.
    const first = __audio.liveContext();
    const second = __audio.liveContext();
    expect(second).toBe(first);
    expect(FakeContext.made).toBe(1);
  });

  it('replaces a closed context instead of handing it back', () => {
    const dead = __audio.liveContext() as unknown as FakeContext;
    dead.state = 'closed';
    const fresh = __audio.liveContext();
    expect(fresh).not.toBe(dead);
    expect(FakeContext.made).toBe(2);
  });

  it('keeps a suspended one — it can still be resumed', () => {
    const ctx = __audio.liveContext() as unknown as FakeContext;
    ctx.state = 'suspended';
    expect(__audio.liveContext()).toBe(ctx as unknown as AudioContext);
    expect(FakeContext.made).toBe(1);
  });

  it('closes the old one when recovering', async () => {
    const dead = __audio.liveContext() as unknown as FakeContext;
    const fresh = __audio.replaceContext();
    expect(dead.closed).toBe(true);
    expect(fresh).not.toBe(dead);
  });

  it('survives a constructor that throws', () => {
    // Past the per-page cap, `new AudioContext()` throws. Returning null lets
    // the caller fall back to the browser voice instead of crashing the page.
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('too many'); } });
    (window as unknown as { AudioContext: unknown }).AudioContext = class {
      constructor() { throw new Error('too many'); }
    };
    __audio.reset();
    expect(__audio.liveContext()).toBeNull();
  });
});

describe('coming back from the background', () => {
  it('notices a thaw', () => {
    // An installed app is not reloaded when it is closed and reopened: iOS
    // freezes the page and thaws the same document, so the context and the
    // audio element survive without the audio session they were bound to.
    // Refreshing in Chrome built new ones; reopening the app did not, which is
    // exactly the difference the bug showed.
    expect(__audio.isThawed()).toBe(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(__audio.isThawed()).toBe(true);
  });

  it('builds a working context after the old one is thrown away', async () => {
    const dead = __audio.liveContext() as unknown as FakeContext;
    const fresh = __audio.replaceContext() as unknown as FakeContext;
    expect(dead.closed).toBe(true);
    await __audio.resumeWithin(fresh as unknown as AudioContext, 50);
    expect(fresh.state).toBe('running');
  });
});

describe('resuming never hangs', () => {
  it('returns as soon as the context is running', async () => {
    const ctx = __audio.liveContext() as unknown as FakeContext;
    await __audio.resumeWithin(ctx as unknown as AudioContext, 50);
    expect(ctx.state).toBe('running');
    expect(ctx.resumeCalls).toBe(1);
  });

  it('does not call resume on a running context', async () => {
    const ctx = __audio.liveContext() as unknown as FakeContext;
    ctx.state = 'running';
    await __audio.resumeWithin(ctx as unknown as AudioContext, 50);
    expect(ctx.resumeCalls).toBe(0);
  });

  it('gives up on a resume that never settles', async () => {
    // iOS hands the audio session to another app and resume() simply never
    // resolves. Awaiting it without a bound is how ▶ turned into a permanent ■.
    const ctx = __audio.liveContext() as unknown as FakeContext;
    ctx.resumeHangs = true;
    await expect(
      Promise.race([
        __audio.resumeWithin(ctx as unknown as AudioContext, 20).then(() => 'returned'),
        new Promise(resolve => setTimeout(() => resolve('still waiting'), 200)),
      ]),
    ).resolves.toBe('returned');
  });

  it('treats a rejected resume as done rather than throwing', async () => {
    const ctx = __audio.liveContext() as unknown as FakeContext;
    ctx.resume = () => Promise.reject(new Error('not allowed'));
    await expect(__audio.resumeWithin(ctx as unknown as AudioContext, 20)).resolves.toBeUndefined();
  });
});
