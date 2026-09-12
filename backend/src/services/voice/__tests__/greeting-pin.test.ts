import { describe, it, expect, vi } from 'vitest';

/**
 * L'URL de l'accueil pré-enregistré ne part QUE sur opt-in.
 *
 * Le 12/09/2026, les deux premiers appels entrants reçus par un assistant
 * portant cette URL comme première phrase se sont terminés en
 * `silence-timed-out`: personne n'a rien entendu. Le mécanisme n'avait jamais
 * été exercé sur un vrai appel. Le texte, synthétisé par Vapi, est le chemin
 * prouvé: c'est lui qui part tant que `VOICE_GREETING_PINNED` n'est pas posé.
 */
vi.mock('../../../config/env', () => ({ env: { VOICE_GREETING_PINNED: false, CARTESIA_API_KEY: '', ELEVENLABS_API_KEY: '', API_BASE_URL: 'https://x' } }));
vi.mock('../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../config/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { firstMessageToPin } = await import('../greeting-audio.service');

describe('firstMessageToPin', () => {
  it('sert le TEXTE par défaut, même quand une URL existe', () => {
    expect(firstMessageToPin('Bonjour', 'https://x/api/voice/greeting/c/0')).toBe('Bonjour');
  });

  it("n'épingle l'URL que sur opt-in explicite", () => {
    expect(firstMessageToPin('Bonjour', 'https://x/api/voice/greeting/c/0', true)).toBe('https://x/api/voice/greeting/c/0');
  });

  it('retombe sur le texte quand il n\'y a pas d\'URL, opt-in ou non', () => {
    expect(firstMessageToPin('Bonjour', null, true)).toBe('Bonjour');
  });
});
