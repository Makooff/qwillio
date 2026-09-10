import { describe, it, expect, vi, beforeEach } from 'vitest';

const { notifyAlerts, error, warn } = vi.hoisted(() => ({
  notifyAlerts: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../../config/logger', () => ({
  logger: { error, warn, info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../discord.service', () => ({ discordService: { notifyAlerts } }));

const { classifyVapiError, reportAssistantSyncFailure, reportRejectedWebhook, resetVapiSyncAlerts } =
  await import('../vapi-error');

/** La forme exacte que `config/vapi.ts` produit. */
const vapiError = (status: number, body: string) =>
  new Error(`VAPI API error (${status}): ${body}`);

beforeEach(() => {
  vi.clearAllMocks();
  resetVapiSyncAlerts();
  notifyAlerts.mockResolvedValue(undefined);
});

/**
 * Le silence réparé: `syncVapiAssistant` lève, ses deux appelants attrapent
 * pour écrire un `warn`, puis répondent `success: true`. Le client voit son
 * réglage enregistré pendant que l'assistant DISTANT garde l'ancien, pour
 * toujours. C'est le mode d'échec qui a coupé la flotte deux fois.
 */
describe('lire un refus de Vapi', () => {
  it('range un 400 en refus: la charge est mauvaise', () => {
    const f = classifyVapiError(vapiError(400, 'property backchannelPlan should not exist'));
    expect(f.kind).toBe('rejected');
    expect(f.status).toBe(400);
    // Le corps EST le diagnostic: il nomme le champ fautif.
    expect(f.detail).toContain('backchannelPlan');
  });

  it('range un 500 en passager: ça ne dit rien sur la charge', () => {
    expect(classifyVapiError(vapiError(503, 'upstream unavailable')).kind).toBe('transient');
  });

  /**
   * 429 est un 4xx qui ne dit RIEN sur la forme de la charge: c'est un débit.
   * Le ranger avec les refus ferait chercher un champ fautif qui n'existe pas.
   */
  it('ne prend pas un 429 pour un refus de charge', () => {
    const f = classifyVapiError(vapiError(429, 'rate limit'));
    expect(f.kind).toBe('transient');
    expect(f.status).toBe(429);
  });

  it('range une panne réseau en passager, sans inventer de code', () => {
    const f = classifyVapiError(new Error('fetch failed: ECONNRESET'));
    expect(f.kind).toBe('transient');
    expect(f.status).toBeNull();
  });

  it('survit à ce qui n\'est pas une Error', () => {
    expect(classifyVapiError('boom').kind).toBe('transient');
    expect(classifyVapiError(null).kind).toBe('transient');
  });

  it('borne le détail plutôt que de noyer une alerte', () => {
    const f = classifyVapiError(vapiError(400, 'x'.repeat(5000)));
    expect(f.detail.length).toBeLessThanOrEqual(500);
  });
});

describe('signaler un assistant que Vapi refuse', () => {
  const call = (err: unknown) =>
    reportAssistantSyncFailure({ clientId: 'c1', businessName: 'Chez Marie', error: err });

  it('alerte sur un refus, et met le champ fautif dans le message', () => {
    call(vapiError(400, 'property keypadInputPlan should not exist'));
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    expect(notifyAlerts.mock.calls[0][0]).toContain('keypadInputPlan');
    // Et il dit ce qui est vrai maintenant: l'agent distant est périmé.
    expect(notifyAlerts.mock.calls[0][0]).toMatch(/ancienne configuration/i);
  });

  it('n\'alerte PAS sur un incident passager', () => {
    // Alerter avec la même force apprendrait à ignorer l'alerte, ce qui
    // coûterait la suivante.
    call(vapiError(503, 'upstream unavailable'));
    call(new Error('fetch failed'));
    expect(notifyAlerts).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('ne spamme pas quand une sauvegarde tourne en boucle', () => {
    for (let i = 0; i < 20; i++) call(vapiError(400, 'property x should not exist'));
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    // Le JOURNAL, lui, garde chaque occurrence: c'est là qu'on compte.
    expect(error).toHaveBeenCalledTimes(20);
  });

  it('ne lève jamais: elle est appelée depuis un catch', () => {
    notifyAlerts.mockRejectedValue(new Error('discord down'));
    expect(() => call(vapiError(400, 'nope'))).not.toThrow();
  });

  it('rend la lecture à l\'appelant', () => {
    expect(call(vapiError(400, 'nope')).kind).toBe('rejected');
  });
});

/**
 * Un webhook refusé n'est pas une dégradation, c'est un effacement.
 *
 * L'appel se déroule normalement pour l'appelant — Vapi tient la conversation
 * avec l'assistant qu'il détient déjà — et tout ce qui devait en rester tombe:
 * pas d'appel au tableau de bord, pas d'alerte de lead, pas de facturation. Le
 * client voit un agent qui répond bien et un tableau de bord vide.
 */
describe('un webhook refusé', () => {
  it('alerte, en nommant le chemin refusé', () => {
    reportRejectedWebhook('/webhooks/vapi/client/c1');

    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    const message = String(notifyAlerts.mock.calls[0][0]);
    expect(message).toContain('/webhooks/vapi/client/c1');
    // Le remède est dans l'alerte: le secret ne se règle pas dans ce dépôt, et
    // une alerte qui ne dit pas où regarder fait perdre le temps qu'elle gagne.
    expect(message).toContain('VAPI_WEBHOOK_SECRET');
  });

  it("n'envoie qu'une alerte par heure, et compte le reste", () => {
    /* L'endpoint est PUBLIC: n'importe qui peut le marteler. Une alerte par
       requête refusée serait un canal de spam offert à l'extérieur. */
    for (let i = 0; i < 50; i++) reportRejectedWebhook('/webhooks/vapi');

    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    // Le NOMBRE distingue les deux causes: une poignée est un scanner, un refus
    // par appel est un secret désaccordé.
    expect(String(notifyAlerts.mock.calls[0][0])).toContain('1 webhook');
  });

  it('repart à zéro après une alerte, pour que le compte suivant soit vrai', () => {
    reportRejectedWebhook('/webhooks/vapi');
    for (let i = 0; i < 4; i++) reportRejectedWebhook('/webhooks/vapi');

    resetVapiSyncAlerts();
    reportRejectedWebhook('/webhooks/vapi');

    expect(String(notifyAlerts.mock.calls[1][0])).toContain('1 webhook');
  });
});
