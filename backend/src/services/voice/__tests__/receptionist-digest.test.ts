import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendEmail = vi.fn();
const sendSMS = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: {
    client: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));
vi.mock('../../email.service', () => ({ emailService: { send: (...a: unknown[]) => sendEmail(...a) } }));
vi.mock('../../sms.service', () => ({ smsService: { sendSMS: (...a: unknown[]) => sendSMS(...a) } }));

const { receptionistDigestService, isoWeekKey } = await import('../receptionist-digest.service');
import type { Finding, LearningReport } from '../receptionist-learning.service';

const CLIENT = {
  id: 'client_1',
  businessName: 'Garage Leblanc',
  contactName: 'Marc Leblanc',
  contactEmail: 'marc@garage.test',
  contactPhone: '+15145550199',
  agentLanguage: 'fr',
  country: 'CA',
  vapiConfig: null,
};

function finding(over: Partial<Finding>): Finding {
  return { code: 'verbose_agent', severity: 'warn', detail: '', action: '', ...over };
}

function report(...findings: Finding[]): LearningReport {
  return { clientId: 'client_1', callsAnalysed: 20, findings };
}

/** The HTML body of the single email that was sent. */
const emailHtml = () => sendEmail.mock.calls[0][0].html as string;
const smsBody = () => sendSMS.mock.calls[0][1] as string;

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue({ ok: true });
  sendSMS.mockResolvedValue({ success: true });
  findUnique.mockResolvedValue({ vapiConfig: null });
  update.mockResolvedValue({});
});

describe('what the client is told', () => {
  it('reaches both their inbox and their phone', async () => {
    const result = await receptionistDigestService.send(CLIENT, report(finding({ code: 'verbose_agent' })));

    expect(result).toMatchObject({ items: 1, email: true, sms: true });
    expect(sendEmail.mock.calls[0][0].to).toBe('marc@garage.test');
    expect(sendSMS.mock.calls[0][0]).toBe('+15145550199');
    expect(sendSMS.mock.calls[0][2]).toMatchObject({ messageType: 'receptionist_digest', clientId: 'client_1' });
  });

  it('says what is wrong in words the owner can act on, not the internal action', async () => {
    await receptionistDigestService.send(
      CLIENT,
      report(finding({ code: 'verbose_agent', action: 'lower VOICE_MAX_COMPLETION_TOKENS' }))
    );

    expect(emailHtml()).toContain('coupent en pleine phrase');
    expect(emailHtml()).not.toContain('VOICE_MAX_COMPLETION_TOKENS');
  });

  it('keeps the SMS to a nudge and leaves the findings to the email', async () => {
    await receptionistDigestService.send(
      CLIENT,
      report(finding({ code: 'verbose_agent' }), finding({ code: 'knowledge_gaps', severity: 'info' }))
    );

    expect(smsBody()).toContain('Garage Leblanc');
    expect(smsBody()).toContain('2 points');
    expect(smsBody()).toContain('/dashboard/receptionist');
    expect(smsBody()).not.toContain('pleine phrase');
  });

  it('writes in English to an English-speaking client', async () => {
    await receptionistDigestService.send(
      { ...CLIENT, agentLanguage: 'en' },
      report(finding({ code: 'verbose_agent' }))
    );

    expect(emailHtml()).toContain('cut in mid-sentence');
    expect(smsBody()).toContain('this week');
  });
});

describe('which findings are the client\'s to fix', () => {
  it('stays silent when everything found is our own plumbing', async () => {
    const result = await receptionistDigestService.send(
      CLIENT,
      report(
        finding({ code: 'slow_turns' }),
        finding({ code: 'cache_missing' }),
        finding({ code: 'deflection_rate', severity: 'info' })
      )
    );

    expect(result).toMatchObject({ items: 0, skipped: 'no_items' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('tells them about a calendar they alone can reconnect', async () => {
    await receptionistDigestService.send(
      CLIENT,
      report(finding({ code: 'tool_failures', subject: 'checkAvailability' }))
    );

    expect(emailHtml()).toContain('Reconnectez Google Agenda');
  });

  it('does not blame them for a tool failure that is ours', async () => {
    const result = await receptionistDigestService.send(
      CLIENT,
      report(finding({ code: 'tool_failures', subject: 'transferCall' }))
    );

    expect(result.skipped).toBe('no_items');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('sending once and only once', () => {
  it('remembers the week it spoke', async () => {
    await receptionistDigestService.send(CLIENT, report(finding({})), new Date('2026-08-09T02:00:00Z'));

    expect(update.mock.calls[0][0].data.vapiConfig.weeklyDigest.week).toBe('2026-W32');
  });

  it('does not tell the same client twice in one week', async () => {
    const client = { ...CLIENT, vapiConfig: { weeklyDigest: { week: '2026-W32', sentAt: '2026-08-09T02:00:00Z' } } };

    const result = await receptionistDigestService.send(client, report(finding({})), new Date('2026-08-09T02:30:00Z'));

    expect(result.skipped).toBe('already_sent');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('speaks again the following week', async () => {
    const client = { ...CLIENT, vapiConfig: { weeklyDigest: { week: '2026-W32', sentAt: '2026-08-09T02:00:00Z' } } };

    await receptionistDigestService.send(client, report(finding({})), new Date('2026-08-16T02:00:00Z'));

    expect(sendEmail).toHaveBeenCalled();
  });

  it('preserves the rest of vapiConfig when recording the week', async () => {
    findUnique.mockResolvedValue({ vapiConfig: { quotaAlert: { month: '2026-08', firedAt: {} } } });

    await receptionistDigestService.send(CLIENT, report(finding({})));

    expect(update.mock.calls[0][0].data.vapiConfig.quotaAlert).toBeDefined();
  });
});

describe('when a channel is unavailable', () => {
  it('still emails a client who never gave a phone number', async () => {
    const result = await receptionistDigestService.send({ ...CLIENT, contactPhone: null }, report(finding({})));

    expect(result).toMatchObject({ email: true, sms: false });
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('still texts when the email bounces', async () => {
    sendEmail.mockRejectedValue(new Error('resend down'));

    const result = await receptionistDigestService.send(CLIENT, report(finding({})));

    expect(result).toMatchObject({ email: false, sms: true });
  });

  it('does not claim the week when nothing left the building', async () => {
    // Otherwise a Twilio + Resend outage costs the client that week silently.
    sendEmail.mockRejectedValue(new Error('resend down'));
    sendSMS.mockResolvedValue({ success: false, error: 'SMS_ENABLED=false' });

    await receptionistDigestService.send(CLIENT, report(finding({})));

    expect(update).not.toHaveBeenCalled();
  });
});

describe('isoWeekKey', () => {
  it('puts the Sunday run on the week that just ended', () => {
    // Sunday 2026-08-09 closes ISO week 32, which started Monday 2026-08-03.
    expect(isoWeekKey(new Date('2026-08-09T02:00:00Z'))).toBe('2026-W32');
    expect(isoWeekKey(new Date('2026-08-03T00:00:00Z'))).toBe('2026-W32');
  });
});
