import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
describe('browser runtime routing security', () => {
 it('public demo only rolls back through server VOICE_RUNTIME', () => {
  const s = source('../../../routes/public-demo.routes.ts');
  expect(s).toContain("env.VOICE_RUNTIME !== 'vapi'");
  expect(s).not.toContain('req.body?.transport');
  expect(s).not.toContain('&& env.LIVEKIT_URL');
  expect(s).toContain("provider: 'vapi'");
 });
 it('test and setup use authenticated tenant and core by default', () => {
  const s = source('../../../controllers/client-dashboard.controller.ts');
  expect(s).toContain('async webSessionVoiceConfig(');
  expect(s).toContain("return this.webSessionVoiceConfig(req, res, 'setup')");
  expect(s).not.toContain('req.query?.transport');
  expect(s).toContain('clientId: req.clientId');
 });
 it('SIP and browser share the saved catalog/custom voice resolver', () => {
  expect(source('../../../routes/voice-core.routes.ts')).toContain('coreProfileVoice(profil)');
  expect(source('../../../controllers/client-dashboard.controller.ts')).toContain('coreProfileVoice(profile)');
 });
});
