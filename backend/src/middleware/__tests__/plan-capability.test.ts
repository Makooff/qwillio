import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le forfait comme condition d'accès.
 *
 * La page tarifs vendait « Analytiques avancées » et « CRM natives » à partir de
 * Pro, alors qu'aucun contrôle n'existait: un client Solo à 99 € recevait ce
 * qu'un client Pro paie 599 €. Ces tests tiennent les deux bouts, le refus et
 * l'ouverture, plus le défaut sûr quand le forfait est inconnu.
 */
const { clientFindUnique } = vi.hoisted(() => ({ clientFindUnique: vi.fn() }));
vi.mock('../../config/database', () => ({
  prisma: { client: { findUnique: clientFindUnique } },
}));

const { requireCapability } = await import('../plan.middleware');
const { planAllows, lowestPlanFor } = await import('../../config/plan-features');

/* `clientId: null` signifie « pas de clientId sur la requête ». Un `undefined`
   ne conviendrait pas: passé à un paramètre par défaut, il réactive le défaut. */
const run = async (planType: string | null, capability: any, clientId: string | null = 'cli_1') => {
  clientFindUnique.mockResolvedValue(planType === null ? null : { planType });
  const req: any = clientId === null ? {} : { clientId };
  const res: any = {
    statusCode: 0,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  const next = vi.fn();
  await requireCapability(capability)(req, res, next);
  return { res, next };
};

beforeEach(() => vi.clearAllMocks());

describe('planAllows', () => {
  it('ouvre les analytiques et le CRM à partir de Pro', () => {
    for (const cap of ['advancedAnalytics', 'crm'] as const) {
      expect(planAllows('pro', cap)).toBe(true);
      expect(planAllows('enterprise', cap)).toBe(true);
      expect(planAllows('starter', cap)).toBe(false);
      expect(planAllows('solo', cap)).toBe(false);
    }
  });

  it('garde l’API à Enterprise, comme la page tarifs l’annonce', () => {
    expect(planAllows('enterprise', 'api')).toBe(true);
    expect(planAllows('pro', 'api')).toBe(false);
  });

  it('ignore la casse, comme le faisait le contrôle d’origine', () => {
    expect(planAllows('PRO', 'crm')).toBe(true);
    expect(planAllows('Enterprise', 'api')).toBe(true);
  });

  it('n’accorde RIEN sur un forfait vide ou inconnu', () => {
    // Défaut sûr, à l'inverse de `planFeatures` qui retombe sur Starter pour
    // avoir quelque chose à afficher: un planType vide en base ne doit pas
    // ouvrir une fonction facturée.
    for (const plan of [null, undefined, '', 'gratuit', 'legacy']) {
      expect(planAllows(plan as any, 'crm')).toBe(false);
      expect(planAllows(plan as any, 'advancedAnalytics')).toBe(false);
    }
  });

  it('nomme le palier le plus bas qui ouvre la capacité', () => {
    expect(lowestPlanFor('crm')).toBe('pro');
    expect(lowestPlanFor('api')).toBe('enterprise');
  });
});

describe('requireCapability', () => {
  it('laisse passer un forfait suffisant', async () => {
    const { res, next } = await run('pro', 'crm');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('refuse un forfait insuffisant en nommant le palier requis', async () => {
    // Le palier voyage dans la réponse pour que l'écran propose la montée de
    // forfait au lieu d'un « accès refusé », qui est un cul-de-sac commercial.
    const { res, next } = await run('solo', 'crm');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ error: 'plan_required', capability: 'crm', requiredPlan: 'pro' });
  });

  it('refuse quand le client est introuvable', async () => {
    const { res, next } = await run(null, 'crm');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('refuse sans clientId, plutôt que de laisser passer', async () => {
    // Sans `clientMiddleware` en amont cette porte n'a pas de sens: elle se
    // referme au lieu de s'ouvrir.
    const { res, next } = await run('enterprise', 'crm', null);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(clientFindUnique).not.toHaveBeenCalled();
  });
});
