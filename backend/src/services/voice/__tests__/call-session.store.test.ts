import { describe, it, expect, beforeEach } from 'vitest';
import { callSessionStore } from '../call-session.store';

const base = { vapiCallId: 'call_1', clientId: 'client_1', callerNumber: '+33612345678', language: 'fr' as const };

describe('callSessionStore', () => {
  beforeEach(() => callSessionStore.reset());

  it('buffers the transcript in memory instead of writing per utterance', () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'user', 'bonjour');
    callSessionStore.appendTranscript('call_1', 'assistant', 'bonjour, que puis-je faire ?');
    expect(callSessionStore.transcriptText('call_1')).toBe('Caller: bonjour\nAI: bonjour, que puis-je faire ?');
  });

  it('ignores empty utterances and unknown calls', () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'user', '   ');
    callSessionStore.appendTranscript('ghost_call', 'user', 'hello');
    expect(callSessionStore.transcriptText('call_1')).toBe('');
    expect(callSessionStore.get('ghost_call')).toBeNull();
  });

  it('counts caller turns and measures the reply latency', async () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'user', 'je voudrais un rendez-vous');
    await new Promise(r => setTimeout(r, 15));
    callSessionStore.appendTranscript('call_1', 'assistant', 'bien sûr');

    const session = callSessionStore.get('call_1')!;
    expect(session.callerTurns).toBe(1);
    expect(session.turnLatencies).toHaveLength(1);
    expect(session.turnLatencies[0]).toBeGreaterThanOrEqual(10);
  });

  it('does not record a latency for an assistant turn nobody prompted', () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'assistant', 'first message');
    expect(callSessionStore.get('call_1')!.turnLatencies).toHaveLength(0);
  });

  it('hands the session back once and forgets it', () => {
    callSessionStore.start(base);
    callSessionStore.recordDeflection('call_1');
    callSessionStore.recordBargeIn('call_1');

    const ended = callSessionStore.end('call_1');
    expect(ended?.deflectedTurns).toBe(1);
    expect(ended?.bargeIns).toBe(1);
    expect(callSessionStore.end('call_1')).toBeNull();
    expect(callSessionStore.liveCount()).toBe(0);
  });

  describe('slot holds', () => {
    it('keeps a slot promised on one live call away from a parallel call', () => {
      const day = new Date('2026-09-14T12:00:00Z');
      callSessionStore.holdSlot('client_1', day, '14:00');
      expect(callSessionStore.heldSlots('client_1', day)).toEqual(['14:00']);
    });

    it('scopes holds per client and per day', () => {
      const day = new Date('2026-09-14T12:00:00Z');
      const otherDay = new Date('2026-09-15T12:00:00Z');
      callSessionStore.holdSlot('client_1', day, '14:00');
      expect(callSessionStore.heldSlots('client_2', day)).toEqual([]);
      expect(callSessionStore.heldSlots('client_1', otherDay)).toEqual([]);
    });
  });
});
