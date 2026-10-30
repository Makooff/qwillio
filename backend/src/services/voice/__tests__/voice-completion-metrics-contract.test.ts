import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../config/database', () => ({ prisma: {} }));
import { validateVoiceCompletionPayload } from '../voice-completion-inbox.service';

// Incident réel du 21/10/2026 à 15:25Z: metrics.summary() contient aussi le
// contexte de mesure. Le validateur rejetait tout l'appel (400) avant l'inbox.
describe('worker mixed metrics completion contract', () => {
  const base = { room: 'room-fixture', clientId: 'client-fixture', transcript: 'User: Bonjour', durationSeconds: 364 };
  it('accepts the deployed worker summary and persists only numeric latency measures', () => {
    const raw = { ...base, latency: { room: base.room, caller: '+32475123456', cerveau: 'cascade', langue: 'fr', tours: 26, eou_p50: 1137.2, eou_au_plafond: 13, arrets_pour_rien: 1 } };
    const parsed = validateVoiceCompletionPayload(raw);
    expect(parsed.latency).toEqual({ tours: 26, eou_p50: 1137.2, eou_au_plafond: 13, arrets_pour_rien: 1 });
    expect(raw.latency.caller).toBe('+32475123456');
  });
  it('preserves worker STT model attribution alongside numeric measures', () => {
    const latency = { stt: 'nova-3', room: base.room, caller: '', cerveau: 'cascade', langue: 'nl', total_p50: 850 };
    expect(validateVoiceCompletionPayload({ ...base, latency }).latency).toEqual({ stt: 'nova-3', total_p50: 850 });
    expect(validateVoiceCompletionPayload({ ...base, latency: { stt: '' } }).latency).toEqual({ stt: '' });
  });
  it.each([true, false, NaN, Infinity, 123, null, [], {}, 'nova 3', 'nova\n3', 'x'.repeat(256)])('rejects malformed STT attribution (%s)', stt => {
    expect(() => validateVoiceCompletionPayload({ ...base, latency: { stt } })).toThrow('Invalid voice completion payload');
  });
  it.each(['room', 'caller', 'cerveau', 'langue'])('bounds contextual string %s', key => {
    for (const value of ['x'.repeat(256), 'bad\ncontext', true, [], {}]) {
      expect(() => validateVoiceCompletionPayload({ ...base, latency: { [key]: value } })).toThrow('Invalid voice completion payload');
    }
  });
  it('rejects arrays and unknown string latency keys', () => {
    for (const latency of [[], { unknown: 'nova-3' }, { total_p50: true }]) {
      expect(() => validateVoiceCompletionPayload({ ...base, latency })).toThrow('Invalid voice completion payload');
    }
  });
  it.each([NaN, Infinity, 'slow', null, [], {}])('rejects malformed numeric measures (%s)', value => {
    expect(() => validateVoiceCompletionPayload({ ...base, latency: { eou_p50: value } })).toThrow('Invalid voice completion payload');
  });
  it('rejects non-string contextual metadata instead of hiding malformed fields', () => {
    expect(() => validateVoiceCompletionPayload({ ...base, latency: { caller: { injected: true } } })).toThrow('Invalid voice completion payload');
  });
});
