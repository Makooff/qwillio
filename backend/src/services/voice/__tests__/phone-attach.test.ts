import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findFirst, create, importTwilioNumber, envMock } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  importTwilioNumber: vi.fn(),
  envMock: { TWILIO_ACCOUNT_SID: 'AC_test', TWILIO_AUTH_TOKEN: 'tok', PHONE_AUTO_PROVISION: '' },
}));

vi.mock('../../../config/database', () => ({
  prisma: { clientPhoneNumber: { findFirst, create } },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../config/env', () => ({ env: envMock }));
vi.mock('../../../config/vapi', () => ({ vapiClient: { importTwilioNumber } }));

import { attachOwnedNumber } from '../phone-provisioning.service';

const BE_NUMBER = '+3223215400';

beforeEach(() => {
  vi.clearAllMocks();
  envMock.TWILIO_ACCOUNT_SID = 'AC_test';
  envMock.TWILIO_AUTH_TOKEN = 'tok';
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({});
  importTwilioNumber.mockResolvedValue({ id: 'pn_1', number: BE_NUMBER });
});

describe('rattachement d’un numéro possédé', () => {
  it('rattache un numéro belge valide et l’enregistre', async () => {
    const result = await attachOwnedNumber('client_1', 'asst_1', BE_NUMBER);

    expect(result).toEqual({ number: BE_NUMBER, numberId: 'pn_1' });
    // Les identifiants Twilio doivent partir avec: c'est ce qui distingue le
    // rattachement d'un numéro possédé d'un achat chez Vapi.
    expect(importTwilioNumber).toHaveBeenCalledWith(
      expect.objectContaining({ number: BE_NUMBER, twilioAccountSid: 'AC_test', twilioAuthToken: 'tok' }),
    );
    expect(create).toHaveBeenCalled();
  });

  it('REFUSE un numéro déjà attribué à un autre client', async () => {
    /* Le piège documenté dans CLAUDE.md: recopier un numéro entrant sur deux
       fiches rend les DEUX clients injoignables. La garde doit précéder tout
       appel réseau. */
    findFirst.mockResolvedValue({ clientId: 'client_2' });

    const result = await attachOwnedNumber('client_1', 'asst_1', BE_NUMBER);

    expect(result).toEqual({ error: expect.stringContaining('AUTRE client') });
    expect(importTwilioNumber).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('refuse un format non E.164', async () => {
    const result = await attachOwnedNumber('client_1', 'asst_1', '02 321 54 00');
    expect(result).toEqual({ error: expect.stringContaining('E.164') });
    expect(importTwilioNumber).not.toHaveBeenCalled();
  });

  it('refuse si les identifiants Twilio manquent', async () => {
    envMock.TWILIO_ACCOUNT_SID = '';
    const result = await attachOwnedNumber('client_1', 'asst_1', BE_NUMBER);
    expect(result).toEqual({ error: expect.stringContaining('TWILIO_ACCOUNT_SID') });
  });

  it('n’enregistre rien en base si Vapi refuse le numéro', async () => {
    // Sinon la base annoncerait une ligne que le routage entrant ne trouvera
    // jamais: un client qu'on croit joignable et qui ne l'est pas.
    importTwilioNumber.mockResolvedValue({});

    const result = await attachOwnedNumber('client_1', 'asst_1', BE_NUMBER);

    expect(result).toEqual({ error: expect.stringContaining('Vapi') });
    expect(create).not.toHaveBeenCalled();
  });
});
