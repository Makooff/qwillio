import { describe, it, expect, vi, beforeEach } from 'vitest';

const envState = vi.hoisted(() => ({
  VOICE_TTS_PROVIDER: 'cartesia',
  CARTESIA_VOICES: '',
  CARTESIA_DEFAULT_VOICE_ID: '',
  CARTESIA_MODEL: 'sonic-3.5',
  VOICE_TTS_MODEL: 'eleven_turbo_v2_5',
}));
vi.mock('../../../config/env', () => ({ env: envState }));

const { cartesiaChoice, useCartesia } = await import('../speech-plans');

beforeEach(() => {
  envState.VOICE_TTS_PROVIDER = 'cartesia';
  envState.CARTESIA_VOICES = '';
  envState.CARTESIA_DEFAULT_VOICE_ID = '';
});

/**
 * Relevé du 12/09/2026, sur une vraie ligne: `VOICE_TTS_PROVIDER=cartesia`
 * était posé, et l'assistant parlait quand même chez ElevenLabs. La bascule
 * était donc DEMANDÉE et ignorée, sans une ligne de journal.
 *
 * Quatre causes, quatre gestes, dont un qui consiste à ne rien faire: un clone
 * n'existe que chez ElevenLabs. Un diagnostic qui dit « c'est ElevenLabs »
 * sans dire laquelle envoie chercher au hasard — c'est 6sexvicies, où un
 * docteur faux a coûté une nuit.
 */
describe('cartesiaChoice — le motif autant que la décision', () => {
  it('nomme la voix Cartesia choisie dans le portail, qui court-circuite tout', () => {
    envState.VOICE_TTS_PROVIDER = '11labs';
    const c = cartesiaChoice({ voiceId: 'cart-1', voiceProvider: 'cartesia' });
    expect(c.voiceId).toBe('cart-1');
    expect(c.why).toMatch(/portail/);
  });

  it('nomme le réglage du CLIENT, le seul qui se corrige sans déploiement', () => {
    const c = cartesiaChoice({ voiceId: 'v1', ttsProvider: '11labs' });
    expect(c.voiceId).toBeNull();
    expect(c.why).toMatch(/CE client/);
  });

  it('nomme le réglage de la plateforme quand le client n\'en a pas', () => {
    envState.VOICE_TTS_PROVIDER = '11labs';
    const c = cartesiaChoice({ voiceId: 'v1' });
    expect(c.why).toMatch(/VOICE_TTS_PROVIDER/);
  });

  it('nomme le clone, et ce motif ne se corrige pas: il se comprend', () => {
    const c = cartesiaChoice({ voiceId: 'v1', cloned: true });
    expect(c.voiceId).toBeNull();
    expect(c.why).toMatch(/clon/);
  });

  /**
   * LE cas réel du 12/09. La bascule est demandée, la voix n'est pas un clone,
   * et rien ne se passe: `cartesiaVoiceFor` ne trouve ni correspondance ni
   * voix par défaut, donc il rend null, donc on reste chez ElevenLabs. Le
   * réglage a l'air juste et ne s'applique pas.
   */
  it('nomme la configuration ABSENTE, le silence coûteux', () => {
    const c = cartesiaChoice({ voiceId: 'ErXwobaYiN019PkySvjV' });
    expect(c.voiceId).toBeNull();
    expect(c.why).toMatch(/CARTESIA_VOICES|CARTESIA_DEFAULT_VOICE_ID/);
  });

  it('bascule dès qu\'une voix par défaut existe', () => {
    envState.CARTESIA_DEFAULT_VOICE_ID = 'sonic-fr';
    const c = cartesiaChoice({ voiceId: 'ErXwobaYiN019PkySvjV' });
    expect(c.voiceId).toBe('sonic-fr');
    expect(c.why).toMatch(/traduite/);
  });

  /* Un seul corps de règle: le chemin d'appel ne lit que l'identifiant, le
     docteur lit le motif. Deux règles écrites à la main divergeraient. */
  it('useCartesia rend exactement l\'identifiant de cartesiaChoice', () => {
    envState.CARTESIA_DEFAULT_VOICE_ID = 'sonic-fr';
    for (const opts of [
      { voiceId: 'v1' },
      { voiceId: 'v1', cloned: true },
      { voiceId: 'v1', ttsProvider: '11labs' as const },
      { voiceId: 'c1', voiceProvider: 'cartesia' as const },
    ]) {
      expect(useCartesia(opts)).toBe(cartesiaChoice(opts).voiceId);
    }
  });
});

/**
 * Le genre, tel que Cartesia le déclare, sous une forme qu'on ne peut pas lire
 * d'ici: la lecture est tolérante et ne devine jamais. Une voix sans genre est
 * servie sous « autres » plutôt que cachée.
 */
describe('toCartesiaVoice — le genre', () => {
  it('lit `gender` sous les formes plausibles, et rien d\'autre', async () => {
    const { toCartesiaVoice, normaliseGender } = await import('../cartesia.service');
    expect(normaliseGender('masculine')).toBe('male');
    expect(normaliseGender('Female')).toBe('female');
    expect(normaliseGender('neutral')).toBeNull();
    expect(normaliseGender(42)).toBeNull();
    expect(toCartesiaVoice({ id: 'v1', name: 'Léa', gender: 'feminine' })?.gender).toBe('female');
    expect(toCartesiaVoice({ id: 'v2', name: 'X', labels: { gender: 'male' } })?.gender).toBe('male');
    expect(toCartesiaVoice({ id: 'v3', name: 'Y' })?.gender).toBeNull();
  });
});
