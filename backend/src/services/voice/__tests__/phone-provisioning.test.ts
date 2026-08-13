import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Provisioning automatique de numéros (roadmap 2.4).
 *
 * Le contrat central: OFF par défaut — un achat de numéro est une dépense
 * récurrente, jamais un défaut de code. Et quand il est actif, le numéro
 * acheté atterrit dans `ClientPhoneNumber`, la table que lit le routage.
 */
const { buyPhoneNumber, phoneNumberCreate } = vi.hoisted(() => ({
  buyPhoneNumber: vi.fn(),
  phoneNumberCreate: vi.fn(),
}));

vi.mock('../../../config/vapi', () => ({ vapiClient: { buyPhoneNumber } }));
vi.mock('../../../config/database', () => ({
  prisma: { clientPhoneNumber: { create: phoneNumberCreate } },
}));

import { autoProvisionNumber, autoProvisionEnabled } from '../phone-provisioning.service';
import { env } from '../../../config/env';

function withFlag(value: string, fn: () => Promise<void>) {
  const prev = env.PHONE_AUTO_PROVISION;
  (env as { PHONE_AUTO_PROVISION: string }).PHONE_AUTO_PROVISION = value;
  return fn().finally(() => {
    (env as { PHONE_AUTO_PROVISION: string }).PHONE_AUTO_PROVISION = prev;
  });
}

describe('autoProvisionNumber', () => {
  beforeEach(() => vi.clearAllMocks());

  it('est OFF par défaut: aucun achat, aucun appel API', async () => {
    expect(autoProvisionEnabled()).toBe(false);
    const result = await autoProvisionNumber('c1', 'asst_1');
    expect(result).toBeNull();
    expect(buyPhoneNumber).not.toHaveBeenCalled();
  });

  it("exige le '1' strict, comme ALLOW_DEGRADED_BOOT", () =>
    withFlag('true', async () => {
      expect(autoProvisionEnabled()).toBe(false);
      expect(await autoProvisionNumber('c1', 'asst_1')).toBeNull();
    }));

  it('achète, enregistre dans ClientPhoneNumber et renvoie le numéro', () =>
    withFlag('1', async () => {
      buyPhoneNumber.mockResolvedValue({ id: 'pn_1', number: '+15550001234' });
      phoneNumberCreate.mockResolvedValue({ id: 'row_1' });

      const result = await autoProvisionNumber('c1', 'asst_1');

      expect(result).toEqual({ number: '+15550001234', numberId: 'pn_1' });
      expect(buyPhoneNumber).toHaveBeenCalledWith({ assistantId: 'asst_1' });
      expect(phoneNumberCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clientId: 'c1', number: '+15550001234' }),
        })
      );
    }));

  it('un échec Vapi retombe sur null — le chemin manuel existant reprend', () =>
    withFlag('1', async () => {
      buyPhoneNumber.mockRejectedValue(new Error('VAPI API error (402): payment required'));
      expect(await autoProvisionNumber('c1', 'asst_1')).toBeNull();
      expect(phoneNumberCreate).not.toHaveBeenCalled();
    }));

  it('une réponse sans id/number ne crée rien', () =>
    withFlag('1', async () => {
      buyPhoneNumber.mockResolvedValue({ status: 'pending' });
      expect(await autoProvisionNumber('c1', 'asst_1')).toBeNull();
      expect(phoneNumberCreate).not.toHaveBeenCalled();
    }));
});
