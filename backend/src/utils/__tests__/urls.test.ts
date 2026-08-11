import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  env: { FRONTEND_URL: 'https://qwillio.com,https://www.qwillio.com' },
}));

const { frontendBaseUrl, clientPortalUrl, onboardingFormUrl } = await import('../urls');

describe('URLs publiques écrites dans les emails', () => {
  it('ne garde que la première origine de la liste', () => {
    // Interpolée telle quelle, FRONTEND_URL produisait
    // « https://qwillio.com,https://www.qwillio.com/portal », mort au clic.
    expect(frontendBaseUrl()).toBe('https://qwillio.com');
  });

  it('vise la route qui existe vraiment, avec id et jeton en requête', () => {
    // Les liens pointaient vers /client-portal/:id, absent du frontend.
    expect(clientPortalUrl('abc', 'tok')).toBe('https://qwillio.com/portal?id=abc&token=tok');
  });

  it('renvoie vers la connexion plutôt que vers un portail sans jeton', () => {
    expect(clientPortalUrl('abc', null)).toBe('https://qwillio.com/login');
  });

  it('échappe ce qui part en paramètre', () => {
    expect(clientPortalUrl('a b', 'x&y')).toContain('id=a%20b&token=x%26y');
  });

  it('construit le formulaire d\'installation sur la même convention', () => {
    expect(onboardingFormUrl('abc', 'tok')).toBe('https://qwillio.com/onboarding?id=abc&token=tok');
  });
});
