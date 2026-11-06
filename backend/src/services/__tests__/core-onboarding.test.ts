import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';

const boundary = vi.hoisted(() => ({
  findUnique: vi.fn(), update: vi.fn(), createAssistant: vi.fn(),
  ensureLine: vi.fn(), sendWelcomeEmail: vi.fn(), notify: vi.fn(),
  getClientProfile: vi.fn(), invalidateClient: vi.fn(),
}));
vi.mock('../../config/database', () => ({ prisma: { client: { findUnique: boundary.findUnique, update: boundary.update } } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../config/vapi', () => ({ vapiClient: { createAssistant: boundary.createAssistant } }));
vi.mock('../voice/phone-setup.service', () => ({ phoneSetupService: { ensureLine: boundary.ensureLine } }));
vi.mock('../email.service', () => ({ emailService: { sendWelcomeEmail: boundary.sendWelcomeEmail } }));
vi.mock('../discord.service', () => ({ discordService: { notify: boundary.notify } }));
vi.mock('../voice/realtime-context.service', () => ({ realtimeContextService: { getClientProfile: boundary.getClientProfile, invalidateClient: boundary.invalidateClient }, shouldRecord: () => false }));
vi.mock('../voice/greeting-audio.service', () => ({ greetingAudioService: { invalidate: vi.fn(), generate: vi.fn() } }));
import { OnboardingService } from '../onboarding.service';
const client = { id: 'core-tenant', businessName: 'Atelier exemple', contactName: 'Test', contactEmail: 'test@example.invalid', businessType: 'other', country: 'BE', agentLanguage: 'fr', planType: 'pro', dashboardToken: 'synthetic', subscriptionStatus: 'active', vapiAssistantId: null, vapiConfig: { retainedSetting: true }, onboardingStatus: 'pending' };
let service: OnboardingService;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { VOICE_RUNTIME: 'core' });
  boundary.findUnique.mockResolvedValue({ ...client });
  boundary.update.mockResolvedValue({ ...client });
  boundary.createAssistant.mockResolvedValue({ id: 'legacy-created' });
  boundary.ensureLine.mockResolvedValue({ state: 'active', number: 'synthetic-assigned-line', numberId: null });
  boundary.getClientProfile.mockResolvedValue({ clientId: client.id, businessName: client.businessName, language: 'fr' });
  service = new OnboardingService();
  // Only the inactive legacy builder boundaries are stubbed, not the bootstrap.
  for (const [method, result] of Object.entries({ buildAssistantTools: [], speechProfile: null, assistantPrompt: 'Test prompt', assistantFirstMessage: 'Bonjour', verifyAssistantHealth: true, regenerateGreetings: undefined })) {
    vi.spyOn(service as any, method).mockResolvedValue(result);
  }
});

describe('core-first onboarding', () => {
  it('activates an assigned SIP line and the real tenant profile without creating a Vapi assistant', async () => {
    await service.onboardClient(client.id);
    expect(boundary.createAssistant).not.toHaveBeenCalled();
    expect(boundary.getClientProfile).toHaveBeenCalledWith(client.id);
    expect(boundary.ensureLine).toHaveBeenCalledWith(client.id, undefined, { runtime: 'core' });
    expect(boundary.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ onboardingStatus: 'completed', vapiConfig: expect.objectContaining({ retainedSetting: true, voiceRuntime: 'core' }) }) }));
    expect(boundary.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(boundary.update.mock.calls.some(([argument]) => 'vapiAssistantId' in argument.data)).toBe(false);
  });

  it('keeps an unsuccessful line assignment pending instead of sending a false welcome', async () => {
    boundary.ensureLine.mockResolvedValue({ state: 'failed', number: null, numberId: null });
    await service.onboardClient(client.id);
    expect(boundary.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(boundary.update.mock.calls.some(([argument]) => argument.data.onboardingStatus === 'completed')).toBe(false);
    expect(boundary.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ onboardingStatus: 'retry_pending' }) }));
  });

  it('refuses a missing or different tenant profile', async () => {
    boundary.getClientProfile.mockResolvedValue({ clientId: 'another-tenant' });
    await service.onboardClient(client.id);
    expect(boundary.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(boundary.update.mock.calls.some(([argument]) => argument.data.onboardingStatus === 'completed')).toBe(false);
  });

  it('does not repeat onboarding messages when already completed', async () => {
    boundary.findUnique.mockResolvedValue({ ...client, onboardingStatus: 'completed' });
    await service.onboardClient(client.id);
    expect(boundary.ensureLine).not.toHaveBeenCalled();
    expect(boundary.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(boundary.createAssistant).not.toHaveBeenCalled();
  });

  it('retains the explicit Vapi rollback bootstrap', async () => {
    Object.assign(env, { VOICE_RUNTIME: 'vapi' });
    await service.onboardClient(client.id);
    expect(boundary.createAssistant).toHaveBeenCalledTimes(1);
    expect(boundary.ensureLine).toHaveBeenCalledWith(client.id, 'legacy-created');
  });

  it('invalidates the active core profile on settings sync even without a legacy assistant', async () => {
    await service.syncVapiAssistant(client.id);
    expect(boundary.invalidateClient).toHaveBeenCalledWith(client.id);
    expect(boundary.createAssistant).not.toHaveBeenCalled();
  });
});
