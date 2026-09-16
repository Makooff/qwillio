import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * « Il est lent » (16/09/2026): ce que le premier tour et la réservation
 * lisaient sur le chemin de la réponse se lit désormais à l'OUVERTURE de
 * l'appel, pendant l'accueil. Deux gardes: le préchauffage est bien branché
 * sur le démarrage de session, et l'expéditeur SMS n'est relu qu'une fois.
 */

const senderFor = vi.fn();
vi.mock('../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../sms-ready', () => ({ smsReadiness: () => ({ ok: true }) }));
vi.mock('../../sms.service', () => ({ smsService: { senderFor: (...a: unknown[]) => senderFor(...a) } }));
vi.mock('../realtime-context.service', () => ({ realtimeContextService: {} }));
vi.mock('../call-session.store', () => ({ callSessionStore: {} }));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: {} }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: {} }));
vi.mock('../availability-speculator', () => ({ availabilitySpeculator: {} }));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const { toolRuntimeService } = await import('../tool-runtime.service');

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('préchauffage à l\'ouverture de l\'appel', () => {
  beforeEach(() => senderFor.mockReset());

  it('l\'expéditeur SMS du client est lu une fois, puis retenu', async () => {
    senderFor.mockResolvedValue('+32460000000');
    await toolRuntimeService.warmSmsSender('c1');
    await toolRuntimeService.warmSmsSender('c1');
    await toolRuntimeService.warmSmsSender('c2');
    expect(senderFor).toHaveBeenCalledTimes(2);
  });

  it('le démarrage de session lance le préchauffage, sans l\'attendre', () => {
    const src = stripComments(readFileSync(join(__dirname, '../realtime-orchestrator.service.ts'), 'utf8'));
    const start = src.indexOf('callSessionStore.start({\n        vapiCallId,\n        clientId,\n        callerNumber: callerNumberOf(event)');
    expect(start).toBeGreaterThan(-1);
    const after = src.slice(start, start + 600);
    expect(after).toMatch(/warmCallerContext\(clientId, callerNumberOf\(event\)\)/);
    expect(after).not.toMatch(/await warmCallerContext/);
    const helper = src.slice(src.indexOf('export function warmCallerContext'));
    expect(helper).toMatch(/getCallerHistory\(clientId, callerNumber\)/);
    expect(helper).toMatch(/warmSmsSender\(clientId\)/);
  });
});
