import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { callSessionStore } = await import('../call-session.store');

/* Trois tours de « Parfait, je vous réserve ça » sur un appel réel (12/09/2026):
   chaque correction du nom relançait une relecture. Une par appel suffit;
   après, c'est l'appelant qui a le dernier mot. */
describe('needsNameReadBack', () => {
  it('relit le premier nom, puis accepte les corrections sans relire', () => {
    callSessionStore.start({ vapiCallId: 'call_rb', clientId: 'c1', callerNumber: null, language: 'fr' });
    expect(callSessionStore.needsNameReadBack('call_rb', 'Stéphane Vonasch')).toBe(true);
    expect(callSessionStore.needsNameReadBack('call_rb', 'Stéphane Van Hold')).toBe(false);
    expect(callSessionStore.needsNameReadBack('call_rb', 'Stéphane Vonasch')).toBe(false);
  });
});
