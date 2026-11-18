import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenVerifier, TrackSource } from 'livekit-server-sdk';
import { env } from '../../../config/env';
import { issueWebSession } from '../web-session.service';

const original = { ...env };
afterEach(() => { Object.assign(env, original); vi.restoreAllMocks(); });
function configured() {
  Object.assign(env, { LIVEKIT_URL: 'wss://test.livekit.cloud', LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'synthetic-secret-for-tests-only-0000', LIVEKIT_AGENT_NAME: 'inbound-agent-eu' });
}

describe('voice-core browser session', () => {
  it('dispatches the core with trusted profile metadata and a short-lived microphone-only room token', async () => {
    configured();
    const session = await issueWebSession({ mode: 'public-demo', profile: { business: 'Atelier exemple', agent: 'Emma', language: 'fr', clientId: '', bookingEnabled: false, enregistrement: false } });
    expect(session.provider).toBe('livekit');
    expect(session.maxDurationSeconds).toBe(120);
    const claims: any = await new TokenVerifier('test-key', 'synthetic-secret-for-tests-only-0000').verify(session.token);
    expect(claims.exp - claims.nbf).toBeLessThanOrEqual(65);
    // Le SDK 2.19.2 sérialise les sources en chaînes (`trackSourceToString`)
    // à l'émission ET ne les re-convertit pas à la vérification : le round-trip
    // rend ['microphone'], jamais l'enum numérique.
    expect(claims.video).toMatchObject({ room: session.roomName, roomJoin: true, canPublishData: false, canUpdateOwnMetadata: false, canPublishSources: ['microphone' as unknown as TrackSource] });
    expect(claims.video.roomAdmin).not.toBe(true);
    expect(claims.sip).toBeUndefined();
    expect(claims.roomConfig.agents[0].agentName).toBe('inbound-agent-eu');
    const metadata = JSON.parse(claims.roomConfig.agents[0].metadata).qwillioWeb;
    expect(metadata).toMatchObject({ version: 1, mode: 'public-demo', participantIdentity: claims.sub, maxDurationSeconds: 120, profile: { business: 'Atelier exemple', clientId: '' } });
    expect(claims.metadata).toBeUndefined();
    expect(JSON.stringify(session)).not.toContain('synthetic-secret');
  });
});
