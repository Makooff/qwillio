import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * L'isolation entre clients sur les actions par identifiant.
 *
 * Dix routes de `agent.routes.ts` agissaient sur un enregistrement par son seul
 * identifiant, sans jamais lire `clientId`, et aucun des services appelés ne le
 * faisait non plus: envoyer une facture au client final d'un autre locataire,
 * la marquer payée, décrémenter son stock, envoyer un document à signer.
 *
 * Le motif était net et c'est ce qui le rend inquiétant: dans le même fichier,
 * TOUS les `GET` lisaient `clientId`, et AUCUN `POST` par identifiant ne le
 * faisait. Ce n'est pas un oubli isolé, c'est une classe d'oubli.
 */

const findFirst = vi.fn();
const update = vi.fn();
vi.mock('../config/database', () => ({
  prisma: {
    agentInvoice: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));
vi.mock('../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../services/email.service', () => ({ emailService: { send: vi.fn() } }));
vi.mock('../config/env', () => ({
  env: { API_BASE_URL: 'https://api.test', FRONTEND_URL: 'https://app.test', STRIPE_SECRET_KEY: 'sk_test' },
}));
vi.mock('../config/stripe', () => ({ stripe: {} }));

const { agentPaymentsService } = await import('../services/agent-payments.service');
const { ALL_TENANTS } = await import('../services/tenant-scope');

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({ id: 'inv_1', invoiceNumber: 'F-1' });
});

describe("marquer une facture payée", () => {
  it("REFUSE la facture d'un autre locataire", async () => {
    /* Le pire des dix cas: `update({ where: { id } })` écrivait sans même lire
       d'abord. Une donnée financière, modifiable par n'importe quel client
       authentifié qui connaît un identifiant. */
    findFirst.mockResolvedValue(null); // la facture existe, mais pas chez lui

    await expect(agentPaymentsService.markPaid('inv_dautrui', 'client_1')).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("cherche bien avec le clientId, et pas seulement avec l'identifiant", async () => {
    // L'identifiant seul n'est pas un droit d'accès: il fuit par les URL, les
    // exports et les journaux.
    findFirst.mockResolvedValue({ id: 'inv_1' });
    await agentPaymentsService.markPaid('inv_1', 'client_1');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'inv_1', clientId: 'client_1' }) }),
    );
  });

  it("laisse passer l'administration, et seulement elle", async () => {
    findFirst.mockResolvedValue({ id: 'inv_1' });
    await agentPaymentsService.markPaid('inv_1', ALL_TENANTS);

    const where = findFirst.mock.calls[0][0].where;
    expect(where.clientId).toBeUndefined();
    expect(where.id).toBe('inv_1');
  });
});

describe("la classe d'oubli ne doit pas revenir", () => {
  it("aucune route de agent.routes.ts n'agit par identifiant sans portée", () => {
    /* Garde de lecture plutôt que d'exécution: elle attrape la route qu'on
       écrira dans six mois. Bornée à `agent.routes.ts` et aux POST par
       identifiant, là où le trou a été trouvé, pour ne pas produire un bruit
       qui la ferait désactiver. */
    const src = readFileSync(join(__dirname, '../routes/agent.routes.ts'), 'utf8');
    const lignes = src.split('\n');

    const debuts = lignes
      .map((l, i) => ({ i, m: /^router\.(post|put|patch|delete)\('([^']*:(id|activityId)[^']*)'/.exec(l) }))
      .filter(x => x.m);

    const sansPortee: string[] = [];
    for (let n = 0; n < debuts.length; n++) {
      const debut = debuts[n].i;
      const fin = n + 1 < debuts.length ? debuts[n + 1].i : lignes.length;
      const corps = lignes.slice(debut, fin).join('\n');
      if (!corps.includes('clientId') && !corps.includes('ALL_TENANTS')) {
        sansPortee.push(debuts[n].m![2]);
      }
    }

    expect(sansPortee, `routes agissant par identifiant sans portée: ${sansPortee.join(', ')}`).toEqual([]);
  });
});
