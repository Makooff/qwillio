import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La langue du site part avec l'inscription.
 *
 * Elle devient la langue de l'agent du client (le back la garde sur
 * l'utilisateur jusqu'à la naissance du client, au webhook Stripe). Sans ce
 * champ, chaque agent naissait en anglais, et le pays devait le rattraper.
 */
const post = vi.fn();
vi.mock('../services/api', () => ({
  default: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
}));
vi.mock('./langStore', () => ({
  useLang: { getState: () => ({ lang: 'fr' }) },
}));

const { useAuthStore } = await import('./authStore');

describe('authStore.register', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { token: 't', user: { id: 'u' }, confirmationEmailSent: true } });
    localStorage.clear();
  });

  it('envoie la langue du site avec l\'inscription', async () => {
    await useAuthStore.getState().register('a@b.c', 'motdepasse', 'A');
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ language: 'fr' }));
  });
});
