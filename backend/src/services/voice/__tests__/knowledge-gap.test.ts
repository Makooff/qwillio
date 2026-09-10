import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Ce que l'agent ne sait pas, et comment il l'apprend.
 *
 * Deux choses se testent ici, et la première décide si le gérant lit son
 * portail ou le referme: le REGROUPEMENT. Une même question posée dans dix
 * formulations doit produire une ligne à traiter, pas dix. La seconde est le
 * pont entre les mots du gérant et ceux de l'appelant: sans lui, la réponse
 * enregistrée ne serait pas retrouvée par la question même qui l'a fait naître.
 */

const upsert = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const create = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: {
    knowledgeGap: {
      upsert: (...a: unknown[]) => upsert(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    businessKnowledge: { create: (...a: unknown[]) => create(...a) },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../knowledge-embeddings.service', () => ({
  knowledgeEmbeddingsService: { generateMissing: vi.fn().mockResolvedValue(0) },
}));

const { fingerprint, knowledgeGapService } = await import('../knowledge-gap.service');

describe('fingerprint', () => {
  it("efface l'ordre des mots, la politesse et l'accord", () => {
    const same = [
      'Vous êtes ouverts le dimanche ?',
      'ouvert dimanche',
      'dimanche, vous êtes ouvert ?',
      'Bonjour, ouverture dimanche ?',
    ];
    /* Une seule entrée: sinon le gérant ouvre son portail sur quatre lignes
       qui appellent la même réponse, et referme l'onglet. */
    expect(new Set(same.map(fingerprint)).size).toBe(1);
  });

  it("ne réunit PAS deux conjugaisons différentes, et c'est assumé", () => {
    /* « ouvrez » et « ouvert » demandent la même chose et produisent deux
       lignes: aucune troncature lexicale ne les réunit, seul un modèle le
       ferait. Le test fige la limite plutôt que de la taire.
       Ce qui la rend supportable est écrit dans le service: le gérant répond à
       l'une, sa réponse porte les mots de l'appelant, et la seconde variante
       TROUVE alors cette réponse au lieu de créer une lacune de plus. */
    expect(fingerprint('vous ouvrez le dimanche ?')).not.toBe(fingerprint('vous êtes ouvert le dimanche ?'));
  });

  it('ne confond pas deux questions qui partagent leur tournure', () => {
    /* Le risque symétrique du regroupement: retirer trop de mots finit par
       fondre deux questions différentes en une, et le gérant répond à l'une
       en croyant répondre aux deux. */
    expect(fingerprint('avez-vous un parking ?')).not.toBe(fingerprint('avez-vous une terrasse ?'));
  });

  it("rejette ce qui n'est pas une question", () => {
    // Un acquiescement n'est pas une lacune de connaissance.
    expect(fingerprint('oui')).toBe('');
    expect(fingerprint('merci beaucoup')).toBe('');
    expect(fingerprint('ok parfait')).toBe('');
    expect(fingerprint('   ')).toBe('');
  });

  it("garde une question qui ne laisse qu'un seul mot", () => {
    /* « vous avez un parking ? » ne laisse que « parking » une fois
       l'auxiliaire et l'article retirés. Le seuil à deux mots la faisait
       disparaître en silence, et c'est le pire des deux échecs possibles: une
       politesse mal filtrée s'écarte d'un clic, une vraie question perdue ne
       revient jamais. */
    expect(fingerprint('vous avez un parking ?')).toBe('parkin');
    expect(fingerprint('vous avez un parking ?')).not.toBe(fingerprint('vous avez une terrasse ?'));
  });
});

describe('record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({});
  });

  it('incrémente au lieu de créer une seconde ligne', async () => {
    await knowledgeGapService.record({ clientId: 'c1', question: 'Vous êtes ouverts le dimanche ?' });

    const arg = upsert.mock.calls[0][0] as any;
    expect(arg.where.clientId_fingerprint.clientId).toBe('c1');
    expect(arg.update.askedCount).toEqual({ increment: 1 });
    // La question est gardée telle qu'elle a été posée: c'est à ça que le
    // gérant la reconnaît, l'empreinte ne se lit pas.
    expect(arg.create.question).toBe('Vous êtes ouverts le dimanche ?');
  });

  it("n'écrit rien pour une question vide de sens", async () => {
    await knowledgeGapService.record({ clientId: 'c1', question: 'ok' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('ne remonte jamais une erreur de base au chemin de l\'appel', async () => {
    upsert.mockRejectedValue(new Error('db down'));
    // Un apprentissage raté coûte une question; une exception coûterait le tour
    // de parole de l'appelant, qui attend cette réponse.
    await expect(
      knowledgeGapService.record({ clientId: 'c1', question: 'vous livrez à Uccle ?' }),
    ).resolves.toBeUndefined();
  });
});

describe('answer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: 'entry_1' });
    update.mockResolvedValue({});
  });

  it("garde les mots de l'appelant comme mots-clés", async () => {
    findFirst.mockResolvedValue({
      id: 'g1', clientId: 'c1', status: 'open', askedCount: 4,
      question: 'Vous êtes ouverts le dimanche ?', fingerprint: 'dimanche ouverts',
    });

    const result = await knowledgeGapService.answer({
      clientId: 'c1', gapId: 'g1', answer: 'Fermé le dimanche, ouvert du lundi au samedi.',
    });

    expect(result).toEqual({ ok: true, entryId: 'entry_1' });
    const entry = create.mock.calls[0][0].data;
    /* Le pont: le gérant écrit « fermé le dimanche », l'appelant suivant dira
       « ouvert dimanche ». Sans les mots-clés de la question, la nouvelle
       entrée ne serait pas retrouvée par la question qui l'a fait naître. */
    expect(entry.keywords).toEqual(['dimanche', 'ouverts']);
    expect(entry.priority).toBe(4);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'answered', answeredEntryId: 'entry_1' }) }),
    );
  });

  it("refuse une question qui n'appartient pas à ce client", async () => {
    // Le cloisonnement: l'identifiant est le seul paramètre fourni par
    // l'appelant, et il se devine.
    findFirst.mockResolvedValue(null);

    const result = await knowledgeGapService.answer({ clientId: 'c1', gapId: 'volé', answer: 'peu importe' });

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuse une réponse vide sans même lire la question', async () => {
    const result = await knowledgeGapService.answer({ clientId: 'c1', gapId: 'g1', answer: '   ' });
    expect(result).toEqual({ ok: false, reason: 'empty_answer' });
    expect(findFirst).not.toHaveBeenCalled();
  });
});
