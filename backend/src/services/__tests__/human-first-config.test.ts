import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../config/database', () => ({ prisma: {} }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { buildVapiConfigPatch } from '../client-config.service';

describe('la plage « mon téléphone d\'abord » dans la configuration du client', () => {
  it('s\'enregistre nettoyée, sans effacer le reste', () => {
    const next = buildVapiConfigPatch(
      { transferMode: 'hours', knowledge: { parkingAccess: 'Rue arrière' } },
      { humanFirst: { enabled: true, days: [5, 1, 1], from: '09:00', to: '12:30' } },
    );
    expect(next.humanFirst).toEqual({ enabled: true, days: [1, 5], from: '09:00', to: '12:30' });
    expect(next.transferMode).toBe('hours');
    expect(next.knowledge).toEqual({ parkingAccess: 'Rue arrière' });
  });

  it('s\'enregistre éteinte quand elle est à moitié valide', () => {
    const next = buildVapiConfigPatch({}, { humanFirst: { enabled: true, days: [1], from: 'neuf heures', to: '17:00' } });
    expect(next.humanFirst.enabled).toBe(false);
  });

  it('n\'y touche pas quand l\'appel n\'en parle pas', () => {
    const stored = { enabled: true, days: [1], from: '09:00', to: '17:00' };
    expect(buildVapiConfigPatch({ humanFirst: stored }, { transferMode: 'never' }).humanFirst).toEqual(stored);
  });
});

/* Le réglage n'existe que s'il traverse TOUS les maillons. C'est le piège que
   `voiceMode` a tendu une fois: validé de bout en bout, mais jamais passé par
   la route, donc impossible à enregistrer. Ces lectures de source tiennent les
   quatre maillons ensemble. */
describe('la chaîne du portail jusqu\'au moteur', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

  it('la route du portail accepte, passe et rend le réglage', () => {
    const controller = read('controllers/client-dashboard.controller.ts');
    expect(controller).toContain('body.humanFirst !== undefined');
    expect(controller).toMatch(/humanFirst:\s+body\.humanFirst/);
    expect(controller).toContain('humanFirst: parseHumanFirst(cfg.humanFirst)');
  });

  it('le profil d\'appel le porte', () => {
    expect(read('services/voice/realtime-context.service.ts')).toContain('humanFirst: vapiConfig.humanFirst');
  });

  it('le pont le calcule à l\'instant de l\'appel, dans le fuseau du commerce', () => {
    expect(read('routes/voice-core.routes.ts'))
      .toContain('humanFirstNow: humanFirstActive(profil.humanFirst, new Date(), profil.timezone)');
  });
});
