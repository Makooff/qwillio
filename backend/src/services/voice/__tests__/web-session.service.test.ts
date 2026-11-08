import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenVerifier } from 'livekit-server-sdk';
import { env } from '../../../config/env';
import {
  WEB_SESSION_MAX_DURATION_SECONDS,
  WEB_SESSION_TOKEN_TTL_SECONDS,
  WebSessionError,
  issueWebSession,
} from '../web-session.service';

const original = { ...env };
afterEach(() => { Object.assign(env, original); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function configured(overrides: Partial<typeof env> = {}) {
  Object.assign(env, {
    LIVEKIT_URL: 'wss://test.livekit.cloud',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'synthetic-secret-for-tests-only-0000',
    LIVEKIT_AGENT_NAME: 'inbound-agent-eu',
    JWT_SECRET: 'synthetic-jwt-signing-secret-for-tests-0000',
    ...overrides,
  });
}

async function verified(token: string) {
  return new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET).verify(token) as Promise<any>;
}

describe('issueWebSession guards', () => {
  it('refuses to run when LiveKit is not configured', async () => {
    Object.assign(env, { LIVEKIT_URL: '', LIVEKIT_API_KEY: '', LIVEKIT_API_SECRET: '' });
    await expect(issueWebSession({ mode: 'client-test', profile: { business: 'A' } }))
      .rejects.toMatchObject({ code: 'livekit_not_configured' });
  });

  it.each(['ws://insecure.example', 'http://evil.example', 'https://rest.example', 'wss:/malformed'])(
    'rejects a non-wss LIVEKIT_URL (%s)',
    async (url) => {
      configured({ LIVEKIT_URL: url });
      await expect(issueWebSession({ mode: 'client-test', profile: { business: 'A' } }))
        .rejects.toMatchObject({ code: 'insecure_livekit_url' });
    },
  );

  it('rejects an unknown mode', async () => {
    configured();
    await expect(issueWebSession({ mode: 'setup' as any, profile: { business: 'A' }, setupMode: 'config' }))
      .rejects.toBeInstanceOf(WebSessionError);
    await expect(issueWebSession({ mode: 'nope' as any, profile: { business: 'A' } }))
      .rejects.toMatchObject({ code: 'invalid_mode' });
  });

  it('requires a business name', async () => {
    configured();
    await expect(issueWebSession({ mode: 'client-test', profile: { business: '  ' } }))
      .rejects.toMatchObject({ code: 'profile_business_missing' });
  });
});

describe('issueWebSession token boundaries', () => {
  it(`issues a token whose TTL is exactly ${WEB_SESSION_TOKEN_TTL_SECONDS}s`, async () => {
    configured();
    const s = await issueWebSession({ mode: 'client-test', profile: { business: 'Atelier' } });
    const claims = await verified(s.token);
    expect(claims.exp - claims.nbf).toBe(WEB_SESSION_TOKEN_TTL_SECONDS);
    expect(claims.sub).toBe(s.participantIdentity);
    expect(claims.metadata).toBeUndefined();
    expect(claims.sip).toBeUndefined();
    expect(claims.video.roomAdmin).toBeUndefined();
    expect(claims.video.room).toBe(s.roomName);
    expect(claims.video.canPublish).toBe(true);
    expect(claims.video.canPublishSources).toEqual(['microphone']);
    expect(claims.video.canPublishData).toBe(false);
    expect(claims.video.canUpdateOwnMetadata).toBe(false);
  });

  it('strips tenant identity from public-demo profiles', async () => {
    configured();
    const s = await issueWebSession({
      mode: 'public-demo',
      profile: { business: 'Démo', clientId: 'tenant-123' },
    });
    const claims = await verified(s.token);
    const metadata = JSON.parse(claims.roomConfig.agents[0].metadata).qwillioWeb;
    expect(metadata.mode).toBe('public-demo');
    expect(metadata.profile.clientId).toBe('');
  });

  it('clamps the duration into 1..120 and derives expiresAt from it', async () => {
    configured();
    const before = Math.floor(Date.now() / 1000);
    const s = await issueWebSession({
      mode: 'client-test',
      profile: { business: 'Atelier' },
      maxDurationSeconds: 9999,
    });
    expect(s.maxDurationSeconds).toBe(WEB_SESSION_MAX_DURATION_SECONDS);
    expect(s.expiresAt).toBeGreaterThanOrEqual(before + WEB_SESSION_MAX_DURATION_SECONDS - 2);
    const sMin = await issueWebSession({ mode: 'client-test', profile: { business: 'Atelier' }, maxDurationSeconds: 0 });
    expect(sMin.maxDurationSeconds).toBe(1);
  });

  it('sanitizes profile and knowledge to the core bounds and forces no-write flags', async () => {
    configured();
    const s = await issueWebSession({
      mode: 'client-test',
      profile: {
        business: 'Boutique',
        agent: 'Salomé',
        language: 'nl',
        clientId: 'tenant-abc',
        services: ['a', '', 'b', ...Array.from({ length: 150 }, (_, i) => `s${i}`)] as string[],
        notes: 'x'.repeat(5000),
        voice: { voiceId: 'voice-1', provider: 'cartesia', cloned: true },
      },
      knowledge: [
        'brute',
        { question: 'Horaires ?', answer: '9h-18h', keywords: ['heures', 'ouverture'] },
        { title: 'Parking', content: 'Gratuit' },
        { answer: 'incomplet' },
        42,
        ...Array.from({ length: 250 }, (_, i) => `k${i}`),
      ] as any[],
    });
    const claims = await verified(s.token);
    const metadata = JSON.parse(claims.roomConfig.agents[0].metadata).qwillioWeb;
    expect(metadata.version).toBe(1);
    expect(metadata.profile.services).toHaveLength(100);
    expect(metadata.profile.notes).toHaveLength(2000);
    expect(metadata.profile.bookingEnabled).toBe(false);
    expect(metadata.profile.enregistrement).toBe(false);
    expect(metadata.profile.voice).toMatchObject({ voiceId: 'voice-1', provider: 'cartesia', cloned: true });
    // 255 entrées en entrée → 200 tronquées, dont 2 invalides écartées
    // ({answer:'incomplet'} sans question, et 42).
    expect(metadata.knowledge).toHaveLength(198);
    expect(metadata.knowledge[0]).toBe('brute');
    expect(metadata.knowledge[1]).toEqual({ question: 'Horaires ?', answer: '9h-18h', keywords: ['heures', 'ouverture'] });
    expect(metadata.knowledge[2]).toEqual({ question: 'Parking', answer: 'Gratuit' });
    // Invalid entries dropped: string knowledge starts at index 0, then the two
    // valid objects; entry "incomplet" and 42 are gone.
    expect(JSON.stringify(metadata.knowledge)).not.toContain('incomplet');
  });

  it('keeps the API secret out of the session payload', async () => {
    configured();
    const s = await issueWebSession({ mode: 'client-test', profile: { business: 'Atelier' } });
    expect(JSON.stringify(s)).not.toContain(env.LIVEKIT_API_SECRET);
  });
});

describe('issueWebSession setup mode', () => {
  it('requires an authenticated tenant and a controller-chosen setupMode', async () => {
    configured();
    await expect(issueWebSession({ mode: 'setup', profile: { business: 'Atelier' }, setupMode: 'config' }))
      .rejects.toMatchObject({ code: 'setup_requires_tenant' });
    await expect(issueWebSession({ mode: 'setup', profile: { business: 'Atelier', clientId: 't-1' } }))
      .rejects.toMatchObject({ code: 'setup_requires_mode' });
  });

  it('seals a setupTicket bound to the same sessionId/clientId/mode', async () => {
    configured();
    const s = await issueWebSession({
      mode: 'setup',
      setupMode: 'config',
      profile: { business: 'Atelier', clientId: 'tenant-42' },
    });
    expect(s.mode).toBe('setup');
    const claims = await verified(s.token);
    const metadata = JSON.parse(claims.roomConfig.agents[0].metadata).qwillioWeb;
    expect(metadata.mode).toBe('setup');
    expect(metadata.setupMode).toBe('config');
    expect(metadata.profile.clientId).toBe('tenant-42');
    expect(typeof metadata.setupTicket).toBe('string');
    // The ticket is verifiable with the same server-only secret and binds the
    // same identities (web-setup-ticket is the parent-owned module).
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.verify(metadata.setupTicket, env.JWT_SECRET, {
      algorithms: ['HS256'], audience: 'qwillio-web-setup', issuer: 'qwillio-bridge', subject: 'tenant-42',
    }) as any;
    expect(decoded.sessionId).toBe(s.sessionId);
    expect(decoded.mode).toBe('config');
  });
});
