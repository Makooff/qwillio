import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: { client: { findUnique: (...a: any[]) => findUnique(...a), update: (...a: any[]) => update(...a) } },
}));

const { forwardingProofService } = await import('../forwarding-proof.service');

/** Un appel entrant renvoyé depuis `from`, tel que Vapi le présente. */
const divertedCall = (from: string) => ({
  message: { call: { sipHeaders: { Diversion: `<sip:${from}@operator.be>;reason=unconditional` } } },
});

describe('forwardingProofService — la preuve est un appel, pas une déclaration', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    update.mockResolvedValue({});
  });

  it('horodate quand l\'appel est renvoyé depuis la ligne du client', async () => {
    findUnique.mockResolvedValue({ contactPhone: '+32 2 555 00 11', forwardingVerifiedAt: null, user: null });
    expect(await forwardingProofService.noteInboundCall('c1', divertedCall('+3225550011'))).toBe(true);
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0].data.forwardingStatus).toBe('verified');
  });

  it('accepte aussi le numéro porté par le compte qui a créé la fiche', async () => {
    findUnique.mockResolvedValue({
      contactPhone: null,
      forwardingVerifiedAt: null,
      user: { businessPhone: '+3225550011' },
    });
    expect(await forwardingProofService.noteInboundCall('c1', divertedCall('+3225550011'))).toBe(true);
  });

  it('n\'écrit rien pour un appel renvoyé depuis une AUTRE ligne', async () => {
    findUnique.mockResolvedValue({ contactPhone: '+3225550011', forwardingVerifiedAt: null, user: null });
    expect(await forwardingProofService.noteInboundCall('c1', divertedCall('+3229999999'))).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('n\'écrit rien pour un appel direct, sans en-tête de diversion', async () => {
    findUnique.mockResolvedValue({ contactPhone: '+3225550011', forwardingVerifiedAt: null, user: null });
    expect(await forwardingProofService.noteInboundCall('c1', { message: { call: {} } })).toBe(false);
    expect(update).not.toHaveBeenCalled();
    // La fiche n'est même pas lue: pas de diversion, pas de question à poser.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('ne réécrit pas la colonne à chaque appel de la journée', async () => {
    findUnique.mockResolvedValue({
      contactPhone: '+3225550011',
      forwardingVerifiedAt: new Date(Date.now() - 60_000),
      user: null,
    });
    expect(await forwardingProofService.noteInboundCall('c1', divertedCall('+3225550011'))).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('rafraîchit une preuve vieille de plus d\'un jour', async () => {
    findUnique.mockResolvedValue({
      contactPhone: '+3225550011',
      forwardingVerifiedAt: new Date(Date.now() - 40 * 60 * 60 * 1000),
      user: null,
    });
    expect(await forwardingProofService.noteInboundCall('c1', divertedCall('+3225550011'))).toBe(true);
  });

  it('ne lève jamais: un appel en cours ne tombe pas sur une écriture ratée', async () => {
    findUnique.mockRejectedValue(new Error('base injoignable'));
    await expect(forwardingProofService.noteInboundCall('c1', divertedCall('+3225550011'))).resolves.toBe(false);
  });
});

describe('bot-loop — le cron ne peut plus prétendre avoir vérifié', () => {
  it('n\'écrit plus forwardingVerifiedAt', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../../jobs/bot-loop.ts', import.meta.url), 'utf8');
    const job = src.slice(src.indexOf("jobGuard.run('forwarding-verification'"));
    const body = job.slice(0, job.indexOf('cron.schedule'));
    expect(body).not.toContain('forwardingVerifiedAt: new Date()');
    expect(body).not.toContain('prisma.client.update');
  });
});
