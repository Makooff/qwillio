import { describe, it, expect, vi, beforeEach } from 'vitest';

const { create, getProfile, session, recordLead, remember, failures, needsReadBack } = vi.hoisted(() => ({
  create: vi.fn(),
  getProfile: vi.fn(),
  session: vi.fn(),
  recordLead: vi.fn(),
  remember: vi.fn(),
  failures: vi.fn(),
  needsReadBack: vi.fn(),
}));

vi.mock('../../../config/database', () => ({ prisma: { agentCrmActivity: { create } } }));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: session,
    recordLead,
    markLeadActivity: vi.fn(),
    recordToolCall: vi.fn(),
    recordPhoneCaptureFailure: failures,
    needsPhoneReadBack: needsReadBack,
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({ availabilitySpeculator: { take: vi.fn(), speculate: vi.fn() } }));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const { toolRuntimeService } = await import('../tool-runtime.service');

const profile = { clientId: 'c1', businessName: 'Chez Marie', language: 'fr', country: 'BE' };

/** Ce que le CRM a reçu comme numéro de contact, ou `undefined`. */
function storedPhone(): string | undefined {
  return create.mock.calls[0]?.[0]?.data?.content?.contact?.phone;
}

async function capture(args: Record<string, unknown>) {
  return toolRuntimeService.execute('c1', 'call_1', { name: 'captureLead', args, toolCallId: 't1' } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  create.mockResolvedValue({ id: 'act_1' });
  remember.mockResolvedValue(undefined);
  session.mockReturnValue({ callerNumber: '+32475987654' });
  // Le vrai compteur vit dans la session; ici on décide du rang de l'échec.
  failures.mockReturnValue(1);
  // Premier passage sur ce numéro: la vraie session répond vrai une fois.
  needsReadBack.mockReturnValue(true);
});

/**
 * Jusqu'ici aucun numéro dicté n'était capté: la fiche ne portait que
 * l'identifiant d'appelant, absent dès qu'un appelant masque son numéro ou
 * demande à être rappelé ailleurs.
 */
describe('captureLead — le numéro que l\'appelant dicte', () => {
  it('enregistre un numéro dicté en toutes lettres, en E.164', async () => {
    await capture({ reason: 'devis toiture', phone: 'zéro quatre septante-cinq douze trente-quatre cinquante-six' });
    expect(storedPhone()).toBe('+32475123456');
  });

  it('préfère le numéro dicté à l\'identifiant d\'appelant', async () => {
    // L'appelant appelle du bureau et veut être rappelé sur son portable:
    // c'est le numéro qu'il DIT qui compte.
    await capture({ reason: 'rappel', phone: 'zéro quatre huit six douze trente-quatre cinquante-six' });
    expect(storedPhone()).toBe('+32486123456');
  });

  it('retombe sur l\'identifiant d\'appelant quand rien n\'est dicté', async () => {
    await capture({ reason: 'question tarif' });
    expect(storedPhone()).toBe('+32475987654');
  });

  /**
   * Le cœur de BEL-3. Sur une séquence structurée, un transcripteur se trompe
   * une fois sur deux: un rappel sur un chiffre faux est un lead perdu que
   * personne ne voit jamais.
   */
  it('n\'enregistre PAS un numéro qui ne tient pas debout', async () => {
    await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze' });
    // Ni le numéro douteux, ni un mélange: on retombe sur la ligne appelante.
    expect(storedPhone()).toBe('+32475987654');
  });

  it('garde la fiche et demande de relire le numéro, plutôt que de tout refuser', async () => {
    const r = await capture({ name: 'Dupont', reason: 'devis toiture', phone: 'zéro quatre septante-cinq douze' });
    // La fiche EST écrite: refuser le nom, le motif et l'urgence pour un
    // chiffre douteux perdrait tout ce que l'appelant vient de donner.
    expect(create).toHaveBeenCalledTimes(1);
    // Et la consigne nomme le geste attendu, pas l'erreur.
    expect(r.result).toMatch(/relis-le à l'appelant chiffre par chiffre/i);
    expect(r.result).toMatch(/captureLead/);
  });

  /**
   * Relire un numéro FAUX est ce qui permet à l'appelant de repérer lequel de
   * ses chiffres a été mal compris. Lui demander de tout redicter à l'aveugle
   * recommence la même erreur.
   */
  it('rend à l\'agent les chiffres entendus, en toutes lettres', async () => {
    const r = await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze' });
    expect(r.result).toContain('zéro quatre sept cinq un deux');
    // En toutes lettres et pas en chiffres bruts: une suite de chiffres
    // envoyée au synthétiseur se prononce d'une façon qu'on ne contrôle pas.
    expect(r.result).not.toContain('047512');
  });

  it('ne demande rien de plus quand aucun numéro n\'a été proposé', async () => {
    const r = await capture({ reason: 'question tarif' });
    expect(r.result).not.toMatch(/relis/i);
  });
});

/**
 * BEL-4. Redemander une troisième dictée après deux échecs refait ce qui vient
 * de rater deux fois: la cause (accent, ligne, chiffres collés) ne bouge pas
 * entre deux essais. Le clavier ne passe pas par la reconnaissance vocale, donc
 * il ne se trompe pas — c'est lui qui sauve l'appel.
 */
describe('captureLead — la bascule clavier au deuxième échec', () => {
  it('fait relire au premier échec, sans parler du clavier', async () => {
    failures.mockReturnValue(1);
    const r = await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze' });
    expect(r.result).toMatch(/relis-le à l'appelant chiffre par chiffre/i);
    expect(r.result).not.toMatch(/clavier/i);
  });

  it('propose le clavier au deuxième échec, et interdit une troisième dictée', async () => {
    failures.mockReturnValue(2);
    const r = await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze' });
    expect(r.result).toMatch(/clavier/i);
    expect(r.result).toMatch(/dièse/i);
    expect(r.result).toMatch(/redicter une troisième fois/i);
  });

  it('reste sur le clavier aux échecs suivants', async () => {
    failures.mockReturnValue(4);
    const r = await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze' });
    expect(r.result).toMatch(/clavier/i);
  });

  it('relit quand même les chiffres entendus avant de basculer', async () => {
    // L'appelant doit pouvoir dire « non, c'est un huit » avant de taper.
    failures.mockReturnValue(2);
    const r = await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze' });
    expect(r.result).toContain('zéro quatre sept cinq un deux');
  });

  it('garde la fiche, comme au premier échec', async () => {
    failures.mockReturnValue(2);
    await capture({ name: 'Dupont', reason: 'devis toiture', phone: 'zéro quatre septante-cinq douze' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('ne compte un échec QUE sur un numéro illisible', async () => {
    await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze trente-quatre cinquante-six' });
    expect(failures).not.toHaveBeenCalled();
  });

  it('accepte les chiffres tapés, qui reviennent bruts et sans mots', async () => {
    // C'est la forme que Vapi remonte après une saisie clavier: des chiffres.
    await capture({ reason: 'devis', phone: '0475123456' });
    expect(storedPhone()).toBe('+32475123456');
  });
});


/**
 * Un numéro VALIDE peut être faux.
 *
 * « zéro quatre sept cinq douze trente-quatre cinquante-six » transcrit avec un
 * chiffre de travers reste un mobile belge que `libphonenumber` accepte sans
 * broncher. Rien ne le signale: la fiche part au CRM, le SMS de rappel porte le
 * mauvais numéro, et le lead est perdu des deux côtés sans trace. La relecture
 * à l'appelant est le seul contrôle disponible, et il est gratuit — il est
 * encore en ligne.
 */
describe('captureLead — la relecture d\'un numéro VALIDE', () => {
  it('demande de relire le numéro accepté, chiffre par chiffre', async () => {
    const r = await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze trente-quatre cinquante-six' });
    expect(r.result).toMatch(/relis-le à l'appelant chiffre par chiffre/i);
  });

  it('rend le numéro en toutes lettres, jamais en chiffres bruts', async () => {
    const r = await capture({ reason: 'devis', phone: '0475123456' });
    expect(r.result).toContain('zéro quatre sept cinq');
    expect(r.result).not.toContain('0475123456');
  });

  it('ne la demande qu\'une fois: le second appel confirme, il ne relance pas', async () => {
    needsReadBack.mockReturnValue(false);
    const r = await capture({ reason: 'devis', phone: '0475123456' });
    expect(r.result).not.toMatch(/relis/i);
  });

  it('interroge la session avec le numéro NORMALISÉ, pas avec ce qui a été dit', async () => {
    // Deux dictées de la même ligne (« zéro quatre... » puis les chiffres tapés)
    // doivent désigner le même numéro, sinon la confirmation en redemande une.
    await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze trente-quatre cinquante-six' });
    expect(needsReadBack).toHaveBeenCalledWith('call_1', '+32475123456');
  });

  it('ne relit rien quand le numéro vient de l\'identifiant d\'appelant', async () => {
    // Personne ne l'a dicté: il n'y a rien à confirmer, et le relire à quelqu'un
    // qui ne l'a pas donné fait perdre un tour.
    const r = await capture({ reason: 'question tarif' });
    expect(r.result).not.toMatch(/relis/i);
    expect(needsReadBack).not.toHaveBeenCalled();
  });

  it('ne relit pas un numéro refusé: c\'est la correction qui est demandée', async () => {
    const r = await capture({ reason: 'devis', phone: 'zéro quatre septante-cinq douze' });
    expect(r.result).toMatch(/non reconnu/i);
    expect(needsReadBack).not.toHaveBeenCalled();
  });
});
