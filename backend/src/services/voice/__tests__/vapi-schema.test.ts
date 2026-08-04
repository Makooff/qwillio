import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { buildRealtimePlans, buildVoice } = await import('../speech-plans');
const { buildVoiceTools } = await import('../voice-tools');

const profile = (over: Record<string, unknown> = {}) => ({
  clientId: 'c1',
  businessName: 'Hôtel Test',
  businessType: 'hotel',
  agentName: 'Marie',
  language: 'fr',
  timezone: 'Europe/Paris',
  transferNumber: null,
  instructions: null,
  services: [],
  openingHours: null,
  bookingEnabled: false,
  calendarConnected: false,
  planType: 'pro',
  characterId: null,
  customVoice: null,
  country: 'FR',
  customLlm: true,
  hasKnowledgeBase: false,
  ...over,
}) as never;

/**
 * These two assertions exist because Vapi rejected the whole assistant on both
 * counts and every call died — the in-browser test AND real inbound calls,
 * since they share these builders. The failure was invisible from the code and
 * only readable in the SDK's error payload.
 */
describe('what Vapi refuses to accept', () => {
  it('never sends backchannelPlan', () => {
    // "assistant.property backchannelPlan should not exist"
    const plans = buildRealtimePlans('fr') as Record<string, unknown>;
    expect('backchannelPlan' in plans).toBe(false);
    expect('backchannelingEnabled' in plans).toBe(true);
  });

  it('sends the transfer destination in E.164', () => {
    // "each value in destinations.number must be a valid phone number"
    const tools = buildVoiceTools(profile({ transferNumber: '06 12 34 56 78' })) as any[];
    const transfer = tools.find(t => t.type === 'transferCall');
    expect(transfer.destinations[0].number).toBe('+33612345678');
  });

  it('drops the transfer tool rather than ship a number Vapi will reject', () => {
    // One mistyped number in a settings field used to take down every call for
    // that client, transfer or not. Losing the tool is the smaller loss.
    const tools = buildVoiceTools(profile({ transferNumber: 'appelez-moi' })) as any[];
    expect(tools.some(t => t.type === 'transferCall')).toBe(false);
  });

  it('keeps an already-normalised number untouched', () => {
    const tools = buildVoiceTools(profile({ transferNumber: '+32478112233' })) as any[];
    const transfer = tools.find(t => t.type === 'transferCall');
    expect(transfer.destinations[0].number).toBe('+32478112233');
  });

  it('offers no transfer tool when no number is configured', () => {
    expect((buildVoiceTools(profile()) as any[]).some(t => t.type === 'transferCall')).toBe(false);
  });

  /**
   * Second round, same lesson. Saving any setting calls syncVapiAssistant, and
   * Vapi answered 400 with four more violations at once — so the assistant kept
   * whatever config it had before, and the test call reported
   * "assistant.voice.chunkPlan…" while real callers reached a stale agent.
   */
  it('only sends punctuation boundaries Vapi knows', () => {
    // "voice.chunkPlan.each value in punctuationBoundaries must be one of the
    // following values: 。 ， . ! ? ; ) ، - । ॥ | || , :"
    const allowed = new Set(['。', '，', '.', '!', '?', ';', ')', '،', '-', '।', '॥', '|', '||', ',', ':']);
    const boundaries = (buildVoice({ voiceId: 'v1' }) as any).chunkPlan.punctuationBoundaries as string[];
    expect(boundaries.length).toBeGreaterThan(0);
    for (const b of boundaries) expect(allowed.has(b)).toBe(true);
  });

  it('never repeats an interruption phrase', () => {
    // "stopSpeakingPlan.All interruptionPhrases's elements must be unique" —
    // and the bilingual list contains 'stop' in both halves.
    const phrases = (buildRealtimePlans('fr') as any).stopSpeakingPlan.interruptionPhrases as string[];
    expect(new Set(phrases).size).toBe(phrases.length);
  });

  it('uses the idle field names from the messagePlan schema', () => {
    // "messagePlan.property messages / timeoutSeconds / count should not exist".
    const plan = (buildRealtimePlans('fr') as any).messagePlan;
    for (const banned of ['messages', 'timeoutSeconds', 'count']) {
      expect(banned in plan).toBe(false);
    }
    expect(Array.isArray(plan.idleMessages)).toBe(true);
    expect(plan.idleTimeoutSeconds).toBeGreaterThanOrEqual(5);
    expect(plan.idleTimeoutSeconds).toBeLessThanOrEqual(60);
    expect(plan.idleMessageMaxSpokenCount).toBeGreaterThanOrEqual(1);
  });
});

describe('the assistant-level transfer number', () => {
  it('normalises forwardingPhoneNumber, or omits it', async () => {
    // Same failure as the transferCall tool, one level up: "forwardingPhoneNumber
    // must be a valid phone number in the E.164 format".
    const { buildVapiAssistantConfig } = await import('../../../config/vapi-templates');
    const build = (transferNumber?: string) => buildVapiAssistantConfig({
      language: 'fr', niche: 'hotel', businessName: 'Hôtel Test', services: [], faq: {}, transferNumber,
    }) as Record<string, unknown>;

    expect(build('06 12 34 56 78').forwardingPhoneNumber).toBe('+33612345678');
    expect(build('+32478112233').forwardingPhoneNumber).toBe('+32478112233');
    expect('forwardingPhoneNumber' in build('appelez-moi')).toBe(false);
    expect('forwardingPhoneNumber' in build()).toBe(false);
  });
});
