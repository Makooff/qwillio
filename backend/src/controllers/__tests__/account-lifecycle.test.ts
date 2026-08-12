import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le cycle de vie d'un compte client: résilier, changer d'adresse, supprimer.
 *
 * Les trois partagent la même exigence, et c'est elle qu'on vérifie ici: **rien
 * n'est écrit en base tant que l'effet extérieur n'est pas acquis**. Une
 * résiliation affichée sur un abonnement que Stripe prélève encore, une adresse
 * basculée sur une boîte qui n'a jamais reçu son lien, un compte effacé dont
 * l'abonnement continue de courir: ces trois pannes sont invisibles jusqu'au
 * relevé bancaire ou jusqu'à la tentative de connexion suivante.
 */
const {
  clientFindUnique, clientUpdate, clientDelete, clientUpdateMany,
  userFindUnique, userFindFirst, userUpdate, userDelete,
  cancelSubscription, sendEmailChangeEmail, deleteAssistant, compare,
} = vi.hoisted(() => ({
  clientFindUnique: vi.fn(), clientUpdate: vi.fn(), clientDelete: vi.fn(), clientUpdateMany: vi.fn(),
  userFindUnique: vi.fn(), userFindFirst: vi.fn(), userUpdate: vi.fn(), userDelete: vi.fn(),
  cancelSubscription: vi.fn(), sendEmailChangeEmail: vi.fn(), deleteAssistant: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    client: { findUnique: clientFindUnique, update: clientUpdate, delete: clientDelete, updateMany: clientUpdateMany },
    user: { findUnique: userFindUnique, findFirst: userFindFirst, update: userUpdate, delete: userDelete },
  },
}));
vi.mock('../../services/stripe.service', () => ({ stripeService: { cancelSubscription } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendEmailChangeEmail } }));
vi.mock('../../config/vapi', () => ({ vapiClient: { deleteAssistant } }));
vi.mock('bcryptjs', () => ({ default: { compare, hash: vi.fn() } }));
// Construit à l'import du contrôleur d'authentification voisin.
vi.mock('google-auth-library', () => ({ OAuth2Client: class {} }));

import { clientDashboardController } from '../client-dashboard.controller';
import { authController } from '../auth.controller';

function mockRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: any) => { res.body = b; return res; });
  return res;
}

const USER = { id: 'u1', email: 'ancienne@x.be', name: 'Élodie', passwordHash: 'hash' };
const CLIENT = { id: 'c1', businessName: 'Clinique Léopold', stripeSubscriptionId: 'sub_1', vapiAssistantId: 'as_1', subscriptionStatus: 'active' };

beforeEach(() => {
  vi.clearAllMocks();
  compare.mockResolvedValue(true);
  clientFindUnique.mockResolvedValue(CLIENT);
  clientUpdate.mockResolvedValue({});
  clientDelete.mockResolvedValue({});
  clientUpdateMany.mockResolvedValue({});
  userFindUnique.mockResolvedValue(USER);
  userFindFirst.mockResolvedValue(null);
  userUpdate.mockResolvedValue({});
  userDelete.mockResolvedValue({});
  cancelSubscription.mockResolvedValue({ cancelled: true, endsAt: new Date('2026-09-12') });
  sendEmailChangeEmail.mockResolvedValue({ success: true });
  deleteAssistant.mockResolvedValue({});
});

describe('résiliation', () => {
  it('annule CHEZ STRIPE avant de toucher la base', async () => {
    const res = mockRes();
    await clientDashboardController.cancelSubscription({ clientId: 'c1' } as any, res);
    expect(cancelSubscription).toHaveBeenCalledWith(expect.objectContaining({ stripeSubscriptionId: 'sub_1' }));
    expect(clientUpdate).toHaveBeenCalled();
    expect(res.body.success).toBe(true);
  });

  /* Le défaut d'origine, et la raison de ce fichier: la base disait « résilié »
     pendant que Stripe continuait de prélever. */
  it("n'écrit RIEN en base quand Stripe refuse", async () => {
    cancelSubscription.mockRejectedValue(new Error('stripe down'));
    const res = mockRes();
    await clientDashboardController.cancelSubscription({ clientId: 'c1' } as any, res);
    expect(clientUpdate).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(502);
  });

  it('ne rappelle pas Stripe pour un abonnement déjà résilié', async () => {
    clientFindUnique.mockResolvedValue({ ...CLIENT, subscriptionStatus: 'cancelled' });
    const res = mockRes();
    await clientDashboardController.cancelSubscription({ clientId: 'c1' } as any, res);
    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(res.body.alreadyCancelled).toBe(true);
  });
});

describe("changement d'adresse", () => {
  const req = (body: any) => ({ userId: 'u1', body } as any);

  it("n'écrit pas la nouvelle adresse dans `email`, seulement en attente", async () => {
    const res = mockRes();
    await clientDashboardController.requestEmailChange(req({ newEmail: 'Nouvelle@X.be', currentPassword: 'ok' }), res);
    const data = userUpdate.mock.calls[0][0].data;
    expect(data.email).toBeUndefined();
    expect(data.pendingEmail).toBe('nouvelle@x.be');
    expect(data.pendingEmailToken).toEqual(expect.any(String));
    expect(res.body.success).toBe(true);
  });

  it('refuse un mot de passe incorrect', async () => {
    compare.mockResolvedValue(false);
    const res = mockRes();
    await clientDashboardController.requestEmailChange(req({ newEmail: 'n@x.be', currentPassword: 'faux' }), res);
    expect(res.statusCode).toBe(401);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('refuse une adresse déjà prise', async () => {
    userFindFirst.mockResolvedValue({ id: 'autre' });
    const res = mockRes();
    await clientDashboardController.requestEmailChange(req({ newEmail: 'pris@x.be', currentPassword: 'ok' }), res);
    expect(res.statusCode).toBe(409);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  /* Un jeton vivant sur une adresse qui n'a jamais reçu son lien est une porte
     ouverte sans serrure. */
  it("efface la demande quand le courriel ne part pas", async () => {
    sendEmailChangeEmail.mockResolvedValue({ success: false });
    const res = mockRes();
    await clientDashboardController.requestEmailChange(req({ newEmail: 'n@x.be', currentPassword: 'ok' }), res);
    expect(res.statusCode).toBe(502);
    expect(userUpdate.mock.calls[1][0].data).toMatchObject({ pendingEmail: null, pendingEmailToken: null });
  });

  it('bascule `email` à la confirmation, et emporte l’adresse de facturation', async () => {
    userFindFirst
      .mockResolvedValueOnce({ ...USER, pendingEmail: 'nouvelle@x.be', pendingEmailToken: 'tok', pendingEmailExpiry: new Date(Date.now() + 60_000) })
      .mockResolvedValueOnce(null);
    const res = mockRes();
    await authController.confirmEmailChange({ params: { token: 'tok' } } as any, res);
    expect(userUpdate.mock.calls[0][0].data).toMatchObject({ email: 'nouvelle@x.be', pendingEmail: null });
    expect(clientUpdateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { contactEmail: 'nouvelle@x.be' } });
    expect(res.body.success).toBe(true);
  });

  it('refuse un jeton expiré et le consomme', async () => {
    userFindFirst.mockResolvedValueOnce({
      ...USER, pendingEmail: 'n@x.be', pendingEmailToken: 'tok', pendingEmailExpiry: new Date(Date.now() - 1),
    });
    const res = mockRes();
    await authController.confirmEmailChange({ params: { token: 'tok' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(userUpdate.mock.calls[0][0].data).toMatchObject({ pendingEmailToken: null });
  });
});

describe('suppression de compte', () => {
  const req = (body: any) => ({ userId: 'u1', clientId: 'c1', body } as any);

  it('exige le nom exact de l’entreprise', async () => {
    const res = mockRes();
    await clientDashboardController.deleteMyAccount(req({ password: 'ok', confirm: 'Clinique' }), res);
    expect(res.statusCode).toBe(400);
    expect(clientDelete).not.toHaveBeenCalled();
  });

  /* L'ordre est le sujet: effacer d'abord effacerait le `stripeSubscriptionId`,
     et l'abonnement prélèverait un compte devenu introuvable. */
  it('résilie chez Stripe AVANT d’effacer, et n’efface pas si Stripe refuse', async () => {
    cancelSubscription.mockRejectedValue(new Error('stripe down'));
    const res = mockRes();
    await clientDashboardController.deleteMyAccount(req({ password: 'ok', confirm: 'clinique léopold' }), res);
    expect(res.statusCode).toBe(502);
    expect(clientDelete).not.toHaveBeenCalled();
    expect(userDelete).not.toHaveBeenCalled();
  });

  it('efface le client puis l’utilisateur quand tout est en ordre', async () => {
    const res = mockRes();
    await clientDashboardController.deleteMyAccount(req({ password: 'ok', confirm: 'Clinique Léopold' }), res);
    expect(cancelSubscription).toHaveBeenCalledWith(expect.anything(), { immediately: true });
    expect(deleteAssistant).toHaveBeenCalledWith('as_1');
    expect(clientDelete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(res.body.success).toBe(true);
  });

  /* Vapi indisponible ne doit pas retenir un droit du client. */
  it('poursuit l’effacement quand Vapi ne répond pas', async () => {
    deleteAssistant.mockRejectedValue(new Error('vapi down'));
    const res = mockRes();
    await clientDashboardController.deleteMyAccount(req({ password: 'ok', confirm: 'Clinique Léopold' }), res);
    expect(clientDelete).toHaveBeenCalled();
    expect(res.body.success).toBe(true);
  });
});
