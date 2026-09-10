import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';

/**
 * Le modèle temps réel doit être un identifiant que VAPI accepte.
 *
 * `gpt-realtime-2.1` était posé ici, lu dans le catalogue d'OpenAI. Vapi ne le
 * connaît pas, et un modèle refusé ne dégrade pas un appel: il fait refuser
 * l'assistant entier (6octies). Les trois variantes temps réel étaient donc
 * mortes, et rien ne le montrait avant que `voice:validate` ne se mette à
 * soumettre le vrai bloc `model`.
 *
 * Cette liste est celle que l'API a RENDUE dans son message d'erreur du
 * 10/09/2026. Elle n'est pas devinée, et elle ne remplace pas le script — lui
 * seul parle à Vapi — elle empêche la valeur de repartir dans le catalogue
 * d'OpenAI entre deux passages.
 */
const ACCEPTED_BY_VAPI = [
  'gpt-4o-realtime-preview-2024-10-01',
  'gpt-4o-realtime-preview-2024-12-17',
  'gpt-4o-mini-realtime-preview-2024-12-17',
  'gpt-realtime-2025-08-28',
  'gpt-realtime',
];

describe('VOICE_REALTIME_MODEL', () => {
  it('est un identifiant que Vapi accepte', () => {
    expect(ACCEPTED_BY_VAPI).toContain(env.VOICE_REALTIME_MODEL);
  });

  it('n\'est plus la valeur qui a fait refuser les trois variantes', () => {
    // Le nom venait du catalogue d'OpenAI. Les deux catalogues ne coïncident
    // pas, et c'est Vapi qui valide la charge.
    expect(env.VOICE_REALTIME_MODEL).not.toBe('gpt-realtime-2.1');
  });
});
