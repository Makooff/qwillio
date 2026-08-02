import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendSMS = vi.fn();
vi.mock('../../sms.service', () => ({ smsService: { sendSMS: (...a: unknown[]) => sendSMS(...a) } }));

const { warmTransferService } = await import('../warm-transfer.service');
const { callSessionStore } = await import('../call-session.store');

const profile: any = {
  clientId: 'client_1',
  businessName: 'Le Comptoir',
  language: 'fr',
  transferNumber: '+33123456789',
};

function startCall(lines: string[] = []) {
  callSessionStore.reset();
  callSessionStore.start({ vapiCallId: 'c1', clientId: 'client_1', callerNumber: '+33600000000', language: 'fr' });
  for (const line of lines) {
    const [role, ...rest] = line.split('|');
    callSessionStore.appendTranscript('c1', role as 'user' | 'assistant', rest.join('|'));
  }
}

describe('warmTransferService.brief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSMS.mockResolvedValue(true);
  });

  it('builds a summary from the caller turns, not the assistant ones', () => {
    startCall([
      'assistant|Bonjour, Le Comptoir, que puis-je faire pour vous ?',
      'user|Je voudrais annuler ma reservation de vendredi soir pour huit personnes',
      'user|oui',
    ]);
    const brief = warmTransferService.brief(profile, 'c1');
    // Relaying the assistant's own words would hand the operator the agent's
    // guesses as if they were the caller's request.
    expect(brief.reason).toContain('annuler ma reservation');
    expect(brief.reason).not.toContain('Le Comptoir, que puis-je');
  });

  it('picks the substantive turn over the acknowledgements', () => {
    startCall(['user|oui', 'user|d accord', 'user|Je cherche un devis pour une privatisation samedi']);
    expect(warmTransferService.brief(profile, 'c1').reason).toContain('devis');
  });

  it('prefers an explicitly captured lead reason over the transcript', () => {
    startCall(['user|euh je sais pas trop en fait voila comment dire']);
    callSessionStore.recordLead('c1', { name: 'Julien', email: null, reason: 'Probleme de facturation', urgency: 'high' });
    const brief = warmTransferService.brief(profile, 'c1');
    expect(brief.reason).toBe('Probleme de facturation');
    expect(brief.callerName).toBe('Julien');
  });

  it('warns the operator when the caller is unhappy', () => {
    startCall(['user|c est inadmissible']);
    callSessionStore.setMood('c1', 'upset');
    // Walking into an angry call unwarned is the difference between recovering
    // it and losing it.
    expect(warmTransferService.brief(profile, 'c1').spoken).toMatch(/mecontente/i);
  });

  it('says nothing about mood when the caller is neutral', () => {
    startCall(['user|je voudrais reserver']);
    const spoken = warmTransferService.brief(profile, 'c1').spoken;
    expect(spoken).not.toMatch(/mecontente|pressee/i);
  });

  it('keeps the spoken summary short enough for an operator to absorb', () => {
    startCall(['user|' + 'je voudrais vraiment beaucoup de choses '.repeat(30)]);
    expect(warmTransferService.brief(profile, 'c1').spoken.length).toBeLessThanOrEqual(260);
  });

  it('degrades to a stated non-reason rather than inventing one', () => {
    startCall([]);
    expect(warmTransferService.brief(profile, 'c1').reason).toMatch(/non precise/i);
  });

  it('carries the caller number so a dropped transfer can be called back', () => {
    startCall(['user|bonjour']);
    const brief = warmTransferService.brief(profile, 'c1');
    expect(brief.callerNumber).toBe('+33600000000');
    expect(brief.sms).toContain('+33600000000');
  });

  it('works with no live session at all', () => {
    callSessionStore.reset();
    expect(() => warmTransferService.brief(profile, 'ghost')).not.toThrow();
  });
});

describe('warmTransferService.notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSMS.mockResolvedValue(true);
  });

  it('texts the professional the brief', () => {
    startCall(['user|je voudrais un devis']);
    const brief = warmTransferService.brief(profile, 'c1');
    warmTransferService.notify(profile, brief);
    expect(sendSMS).toHaveBeenCalledWith('+33123456789', brief.sms);
  });

  it('does nothing without a transfer number', () => {
    startCall(['user|bonjour']);
    const brief = warmTransferService.brief({ ...profile, transferNumber: null }, 'c1');
    warmTransferService.notify({ ...profile, transferNumber: null }, brief);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('does not throw when the SMS fails — the spoken summary still happens', () => {
    sendSMS.mockRejectedValue(new Error('twilio down'));
    startCall(['user|bonjour']);
    const brief = warmTransferService.brief(profile, 'c1');
    expect(() => warmTransferService.notify(profile, brief)).not.toThrow();
  });
});

describe('warmTransferService.destination', () => {
  it('hands over BEFORE bridging, which is the whole point', () => {
    startCall(['user|je veux parler a un responsable']);
    const brief = warmTransferService.brief(profile, 'c1');
    const dest = warmTransferService.destination(profile, brief) as any;

    expect(dest.transferPlan.mode).toBe('warm-transfer-say-summary');
    expect(dest.transferPlan.summaryPlan.enabled).toBe(true);
    expect(dest.transferPlan.summaryPlan.messages[0].content).toBe(brief.spoken);
    expect(dest.number).toBe('+33123456789');
  });
});
