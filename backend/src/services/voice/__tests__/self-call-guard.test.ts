import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { isSelfCall, hangUpSelfCall, presentedCaller } from '../self-call-guard';

/* Un transfert vers le mobile du client, ramené chez nous par son renvoi
   « si occupé »: l'appelant présenté est NOTRE ligne. Raccroché, pas
   décroché (15/09/2026). */
const event = (customer: string | undefined, controlUrl?: string) => ({
  message: {
    type: 'status-update', status: 'in-progress',
    call: { id: 'call_1', customer: customer ? { number: customer } : undefined, monitor: controlUrl ? { controlUrl } : undefined },
  },
});
const lines = { dedicated: '+32460207490', shared: '+19345550100' };

describe('isSelfCall', () => {
  it('reconnaît notre ligne dédiée comme appelant, quelle que soit l\'écriture', () => {
    expect(isSelfCall(event('+32460207490'), lines)).toBe(true);
    expect(isSelfCall(event('0460207490'), lines)).toBe(true);
    expect(isSelfCall(event('32460207490'), lines)).toBe(true);
  });
  it('reconnaît la ligne partagée', () => {
    expect(isSelfCall(event('+19345550100'), lines)).toBe(true);
  });
  it('laisse passer un vrai appelant, et un appel sans numéro', () => {
    expect(isSelfCall(event('+32483620980'), lines)).toBe(false);
    expect(isSelfCall(event(undefined), lines)).toBe(false);
  });
  it('ne compare JAMAIS aux numéros déclarés par le client: un opérateur peut les présenter sur un appel renvoyé', () => {
    /* Le mobile du client n'est pas une ligne de plateforme: un appel qui le
       présente est un vrai appel renvoyé (REL-11), pas une boucle. */
    expect(isSelfCall(event('+32470112233'), { dedicated: '+32460207490', shared: null })).toBe(false);
  });
  it('lit l\'appelant tel que présenté, forme brute', () => {
    expect(presentedCaller(event('+32460207490'))).toBe('+32460207490');
  });
});

describe('hangUpSelfCall', () => {
  it('raccroche par l\'adresse de contrôle', async () => {
    const endCall = vi.fn(async () => undefined);
    expect(await hangUpSelfCall(event('+32460207490', 'https://vapi.example/control/abc'), 'c1', endCall)).toBe(true);
    expect(endCall).toHaveBeenCalledWith('https://vapi.example/control/abc');
  });
  it('sans adresse de contrôle, ne lève pas et dit non', async () => {
    const endCall = vi.fn(async () => undefined);
    expect(await hangUpSelfCall(event('+32460207490'), 'c1', endCall)).toBe(false);
    expect(endCall).not.toHaveBeenCalled();
  });
  it('un refus de Vapi ne lève pas', async () => {
    const endCall = vi.fn(async () => { throw new Error('403'); });
    expect(await hangUpSelfCall(event('+32460207490', 'https://vapi.example/control/abc'), 'c1', endCall)).toBe(false);
  });
});
