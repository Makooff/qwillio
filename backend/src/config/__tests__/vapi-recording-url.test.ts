import { describe, it, expect, vi, afterEach } from 'vitest';
import { vapiClient } from '../vapi';

/* Les adresses R2 de l'appel sont privées au stockage de Vapi (13/09/2026):
   la seule qui se lit est celle que rend `GET /call/:id/mono-recording`. */
describe('vapiClient.recordingUrl — l\'adresse signée par la route documentée', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lit le Location du 302 sans suivre la redirection', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 302,
      headers: new Headers({ location: 'https://hipaa-recordings.x.r2.cloudflarestorage.com/a-mono.wav?X-Amz-Signature=abc' }),
      text: async () => '',
    } as unknown as Response);
    const url = await vapiClient.recordingUrl('call_1', 'mono');
    expect(url).toContain('X-Amz-Signature=abc');
    const [target, init] = fetchSpy.mock.calls[0];
    expect(String(target)).toMatch(/\/call\/call_1\/mono-recording$/);
    expect((init as RequestInit).redirect).toBe('manual');
    expect((init as RequestInit).headers).toHaveProperty('Authorization');
  });

  it('rend null sur 404 et lève avec le corps sur tout autre refus', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ status: 404, headers: new Headers(), text: async () => '' } as unknown as Response);
    expect(await vapiClient.recordingUrl('call_1')).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ status: 401, headers: new Headers(), text: async () => '{"message":"Unauthorized"}' } as unknown as Response);
    await expect(vapiClient.recordingUrl('call_1')).rejects.toThrow(/401.*Unauthorized/);
  });
});
