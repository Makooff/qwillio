import { describe, it, expect } from 'vitest';
import { errorText } from './VapiLiveCall';

describe('errorText', () => {
  it('returns a plain string message', () => {
    expect(errorText({ message: 'Meeting ended' })).toBe('Meeting ended');
  });

  it('returns null when message is an object', () => {
    // This is the crash: Vapi emits `{ message: { message, error } }`, the
    // object reached state, JSX rendered it, and React #31 took the whole
    // dashboard down over a call that had merely failed.
    expect(errorText({ message: { message: 'x', error: 'y' } })).toBeNull();
  });

  it('falls back to a nested error message', () => {
    expect(errorText({ error: { message: 'ejected' } })).toBe('ejected');
  });

  it('accepts a bare string', () => {
    expect(errorText('boom')).toBe('boom');
  });

  it('reads a real Error', () => {
    expect(errorText(new Error('mic_denied'))).toBe('mic_denied');
  });

  it('rejects everything that is not usable text', () => {
    for (const bad of [null, undefined, 42, [], {}, { message: '' }, { message: '   ' }, { message: 7 }]) {
      expect(errorText(bad)).toBeNull();
    }
  });
});
