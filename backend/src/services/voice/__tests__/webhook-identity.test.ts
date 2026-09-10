import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le secret voyage avec l'assistant, ou l'appel ne laisse rien.
 *
 * Nos endpoints exigent `x-vapi-secret`. Rien dans ce dépôt ne disait à Vapi
 * quoi envoyer: le réglage jumeau vivait dans son tableau de bord, hors du
 * dépôt, et sa divergence était invisible. Quand elle survient, l'appel se
 * déroule parfaitement pour l'appelant et TOUT le reste tombe en 401.
 */
vi.mock('../../../config/env', () => ({ env: { VAPI_WEBHOOK_SECRET: '' } }));
const { env } = await import('../../../config/env');
const { webhookServer } = await import('../webhook-identity');

const URL = 'https://qwillio.onrender.com/api/webhooks/vapi/client/c1';

beforeEach(() => {
  (env as { VAPI_WEBHOOK_SECRET: string }).VAPI_WEBHOOK_SECRET = '';
});

describe('webhookServer', () => {
  it("pose l'en-tête que nos endpoints vérifient", () => {
    (env as { VAPI_WEBHOOK_SECRET: string }).VAPI_WEBHOOK_SECRET = 's3cr3t';

    expect(webhookServer(URL)).toEqual({
      url: URL,
      // Le nom exact compte: `isVapiWebhookAuthorized` lit `x-vapi-secret`,
      // et un en-tête proche est un en-tête absent.
      headers: { 'x-vapi-secret': 's3cr3t' },
    });
  });

  it("ne pose AUCUN en-tête quand le secret n'est pas configuré", () => {
    /* Un en-tête vide vaudrait un en-tête faux: il serait envoyé, comparé, et
       refusé. Sans secret, `isVapiWebhookAuthorized` laisse déjà passer hors
       production; poser une chaîne vide casserait ce chemin-là. */
    expect(webhookServer(URL)).toEqual({ url: URL });
  });
});
