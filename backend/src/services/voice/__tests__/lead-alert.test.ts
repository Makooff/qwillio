import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Prévenir le gérant qu'un appel a produit un lead.
 *
 * Le défaut corrigé ici n'est pas subtil: `captureLead` écrivait en base et ne
 * prévenait personne, `urgency` était relevé puis jamais relu, et le gérant
 * l'apprenait au digest HEBDOMADAIRE. Ces tests portent sur ce qui rendrait la
 * correction inutile ou nuisible: un seuil qui noie, un doublon qui fait
 * douter, ou une alerte qui casse la fin d'appel.
 */

const findUnique = vi.fn();
const findFirst = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: {
    client: { findUnique: (...a: unknown[]) => findUnique(...a) },
    crmIntegration: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const sendSMS = vi.fn().mockResolvedValue({ success: true });
vi.mock('../../sms.service', () => ({ smsService: { sendSMS: (...a: unknown[]) => sendSMS(...a) } }));
const sendEmail = vi.fn().mockResolvedValue({ success: true });
vi.mock('../../email.service', () => ({ emailService: { send: (...a: unknown[]) => sendEmail(...a) } }));

const { leadAlertService, shouldAlert, thresholdOf, buildSms } = await import('../lead-alert.service');

const lead = (over: Record<string, unknown> = {}) => ({
  name: 'Marie Dupont', email: null, reason: 'fuite sous l\'évier', urgency: 'normal', ...over,
});
const client = (over: Record<string, unknown> = {}) => ({
  businessName: 'Plomberie Martin',
  transferNumber: '+32470111222',
  contactPhone: '+32470999888',
  contactEmail: 'patron@plomberie.be',
  agentLanguage: 'fr',
  vapiConfig: {},
  ...over,
});

let n = 0;
const callId = () => `call_${++n}`;

beforeEach(() => {
  vi.clearAllMocks();
  sendSMS.mockResolvedValue({ success: true });
  sendEmail.mockResolvedValue({ success: true });
  findFirst.mockResolvedValue(null);
});

describe('le seuil, que le client règle lui-même', () => {
  it('prévient sur tout, ou sur les urgents seulement, ou jamais', () => {
    expect(shouldAlert('all', 'normal')).toBe(true);
    expect(shouldAlert('all', 'high')).toBe(true);
    expect(shouldAlert('urgent', 'high')).toBe(true);
    expect(shouldAlert('urgent', 'normal')).toBe(false);
    expect(shouldAlert('none', 'high')).toBe(false);
  });

  it('vaut « urgent » par DÉFAUT, et ce défaut compte plus que le réglage', () => {
    /* Jusqu'ici personne n'était prévenu. Basculer tout le monde sur `all`
       enverrait demain matin trente SMS au commerce qui reçoit trente appels,
       et il couperait la notification le jour même. `urgent` est une
       amélioration stricte sur le silence et ne peut noyer personne. */
    expect(thresholdOf(null)).toBe('urgent');
    expect(thresholdOf({})).toBe('urgent');
    expect(thresholdOf({ leadAlert: 'nawak' })).toBe('urgent');
    expect(thresholdOf({ leadAlert: 'all' })).toBe('all');
    expect(thresholdOf({ leadAlert: 'none' })).toBe('none');
  });

  it('respecte un client qui a demandé le silence', async () => {
    findUnique.mockResolvedValue(client({ vapiConfig: { leadAlert: 'none' } }));
    const r = await leadAlertService.notify({
      clientId: 'c1', vapiCallId: callId(), lead: lead({ urgency: 'high' }), callerNumber: '+32470000111',
    });
    expect(r.sent).toBe(false);
    expect(sendSMS).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('le message', () => {
  it('dit QUI, POURQUOI, et comment rappeler, dans cet ordre', () => {
    /* Un gérant lit ça sur un écran verrouillé, entre deux clients. Ce qu'il
       doit pouvoir faire sans déverrouiller, c'est décider si ça attend. */
    const sms = buildSms(lead(), '+32470000111', 'fr');
    expect(sms.indexOf('Marie Dupont')).toBeLessThan(sms.indexOf('évier'));
    expect(sms).toMatch(/Rappeler : \+32470000111/);
  });

  it("crie l'urgence en tête, là où elle se lit sans ouvrir", () => {
    expect(buildSms(lead({ urgency: 'high' }), null, 'fr').startsWith('URGENT')).toBe(true);
    expect(buildSms(lead(), null, 'fr').startsWith('URGENT')).toBe(false);
  });

  it('tronque le motif, jamais le numéro de rappel', () => {
    // Un motif coupé reste lisible; un numéro coupé est inutilisable.
    const sms = buildSms(lead({ reason: 'x'.repeat(500) }), '+32470000111', 'fr');
    expect(sms.length).toBeLessThanOrEqual(320);
  });

  it("tient sans nom ni motif, plutôt que d'écrire « null »", () => {
    const sms = buildSms({ name: null, email: null, reason: '', urgency: 'normal' }, null, 'fr');
    expect(sms).not.toMatch(/null|undefined/);
    expect(sms).toMatch(/Appelant/);
  });
});

describe('les canaux', () => {
  it('vise la ligne où un HUMAIN décroche, pas le contact du compte', async () => {
    /* `contactPhone` peut être un comptable ou un associé; `transferNumber` est
       la ligne que l'agent appelle quand il transfère, donc celle qui répond. */
    findUnique.mockResolvedValue(client({ vapiConfig: { leadAlert: 'all' } }));
    await leadAlertService.notify({ clientId: 'c1', vapiCallId: callId(), lead: lead(), callerNumber: null });
    expect(sendSMS).toHaveBeenCalledWith('+32470111222', expect.any(String), expect.anything());
  });

  it('retombe sur le contact du compte quand aucune ligne de transfert', async () => {
    findUnique.mockResolvedValue(client({ transferNumber: null, vapiConfig: { leadAlert: 'all' } }));
    await leadAlertService.notify({ clientId: 'c1', vapiCallId: callId(), lead: lead(), callerNumber: null });
    expect(sendSMS).toHaveBeenCalledWith('+32470999888', expect.any(String), expect.anything());
  });

  it('envoie sur TOUS les canaux à la fois, pas sur le premier qui marche', async () => {
    /* Le SMS se perd dans une notification balayée, l'email survit à la
       journée. Aucun n'est fiable seul, et aucun ne coûte assez cher pour
       qu'on choisisse. */
    findUnique.mockResolvedValue(client({ vapiConfig: { leadAlert: 'all' } }));
    await leadAlertService.notify({ clientId: 'c1', vapiCallId: callId(), lead: lead(), callerNumber: null });
    expect(sendSMS).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it("n'abandonne pas l'email quand le SMS échoue", async () => {
    // Un opérateur qui rejette un numéro ne doit pas emporter les deux autres
    // canaux avec lui.
    findUnique.mockResolvedValue(client({ vapiConfig: { leadAlert: 'all' } }));
    sendSMS.mockRejectedValue(new Error('numéro invalide'));
    const r = await leadAlertService.notify({
      clientId: 'c1', vapiCallId: callId(), lead: lead(), callerNumber: null,
    });
    expect(sendEmail).toHaveBeenCalled();
    expect(r.sent).toBe(true);
  });
});

describe("le nom vient de l'APPELANT, et il finit dans un email", () => {
  it("échappe le HTML plutôt que de le recopier", async () => {
    /* Un appelant dicte son nom, le modèle le transcrit fidèlement, et il
       atterrit dans un email. Sans échappement, il y injecte du HTML. Le SMS
       n'a pas ce problème, l'email si. */
    findUnique.mockResolvedValue(client({ vapiConfig: { leadAlert: 'all' } }));
    await leadAlertService.notify({
      clientId: 'c1',
      vapiCallId: callId(),
      lead: lead({ name: '<img src=x onerror=alert(1)>' }),
      callerNumber: null,
    });

    const html = sendEmail.mock.calls[0][0].html as string;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it("renvoie vers le RÉGLAGE, pas seulement vers le désabonnement", async () => {
    /* `emailService.send` ajoute un lien de désabonnement global à tout ce
       qu'il envoie. Sur une alerte que le gérant a lui-même demandée, c'est le
       mauvais bouton: il coupe tout au lieu de baisser le seuil. */
    findUnique.mockResolvedValue(client({ vapiConfig: { leadAlert: 'all' } }));
    await leadAlertService.notify({
      clientId: 'c1', vapiCallId: callId(), lead: lead(), callerNumber: null,
    });

    expect(sendEmail.mock.calls[0][0].html).toMatch(/seuil/i);
  });
});

describe('ce qui ferait douter du produit', () => {
  it('ne prévient pas DEUX fois pour le même appel', async () => {
    /* Vapi peut délivrer un rapport de fin d'appel plus d'une fois. Deux SMS
       pour un seul appelant informent moins qu'ils n'inquiètent. */
    findUnique.mockResolvedValue(client({ vapiConfig: { leadAlert: 'all' } }));
    const id = callId();
    const first = await leadAlertService.notify({ clientId: 'c1', vapiCallId: id, lead: lead(), callerNumber: null });
    const second = await leadAlertService.notify({ clientId: 'c1', vapiCallId: id, lead: lead(), callerNumber: null });

    expect(first.sent).toBe(true);
    expect(second).toMatchObject({ sent: false, why: 'duplicate' });
    expect(sendSMS).toHaveBeenCalledTimes(1);
  });

  it("ne dit rien quand aucun lead n'a été capté", async () => {
    // La plupart des appels ne produisent pas de lead. Un message « rien à
    // signaler » après chaque appel se fait couper en un jour.
    const r = await leadAlertService.notify({
      clientId: 'c1', vapiCallId: callId(), lead: null, callerNumber: null,
    });
    expect(r).toMatchObject({ sent: false, why: 'no_lead' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('ne lève jamais sur un client introuvable', async () => {
    findUnique.mockResolvedValue(null);
    await expect(leadAlertService.notify({
      clientId: 'fantome', vapiCallId: callId(), lead: lead(), callerNumber: null,
    })).resolves.toMatchObject({ sent: false });
  });
});

/**
 * Une PROMESSE n'est pas une information, et le seuil ne décide que des
 * informations.
 *
 * Relevé sur un vrai appel, 11/09/2026: « il me dit qu'il va faire passer le
 * message, mais je n'ai pas reçu de message ». Le seuil valait `urgent`, la
 * demande n'était pas urgente, l'alerte a été écartée en silence. L'agent avait
 * promis, le système n'a pas tenu.
 *
 * Le prompt promet un rappel dans TOUS les cas où l'agent ne peut pas servir
 * l'appelant. Deux réglages indépendants pouvaient donc se contredire, et la
 * contradiction ne se voyait que de l'appelant qui attend.
 */
describe('une promesse passe avant le seuil', () => {
  it('alerte sur un message pris SANS rendez-vous, meme non urgent', () => {
    /* Pas de rendez-vous = l'agent a dit « on vous rappelle ». L'urgence est
       jugee par nous, la promesse a ete entendue par lui. */
    expect(shouldAlert('urgent', 'low', true)).toBe(true);
    expect(shouldAlert('urgent', 'medium', true)).toBe(true);
  });

  it('laisse le seuil decider quand le rendez-vous est PRIS', () => {
    /* L'appelant repart avec ce qu'il venait chercher: le SMS n'est qu'un
       agrement, et c'est ce qui evite « un message a chaque appel ». */
    expect(shouldAlert('urgent', 'low', false)).toBe(false);
    expect(shouldAlert('urgent', 'high', false)).toBe(true);
    expect(shouldAlert('all', 'low', false)).toBe(true);
  });

  it('respecte `none`, qui est un choix explicite du gerant', () => {
    /* Le forcer serait decider a sa place. Le service journalise ce cas plutot
       que de l'ecarter sans un mot. */
    expect(shouldAlert('none', 'high', true)).toBe(false);
  });

  it('se comporte comme avant quand la promesse n\'est pas renseignee', () => {
    // Le parametre est optionnel: aucun appelant existant ne change de sens.
    expect(shouldAlert('urgent', 'low')).toBe(false);
    expect(shouldAlert('urgent', 'high')).toBe(true);
  });
});

/**
 * Le numéro DICTÉ atteint enfin la notification.
 *
 * « Quand l'IA demande le numéro de téléphone, elle doit le répéter et
 * l'afficher sur le mail pour avoir directement le numéro à rappeler dans le
 * SMS aussi », 11/09/2026.
 *
 * Le numéro était capté, validé, et il l'emportait bien sur l'identifiant
 * d'appelant au CRM. Mais `recordLead` était appelé AVANT son calcul, avec un
 * lead qui n'avait pas de champ `phone`. Le SMS et l'e-mail, qui lisent ce
 * lead, retombaient donc sur l'identifiant d'appelant: la ligne d'où l'appel
 * partait, et non celle où l'appelant venait de demander qu'on le rappelle.
 */
describe('le numero de rappel dans l\'alerte', () => {
  const lead = (phone: string | null) => ({
    name: 'Marie', email: null, phone, reason: 'devis', urgency: 'normal',
  });

  it('prefere le numero DICTE a l\'identifiant d\'appelant', () => {
    /* Quand l'appelant en donne un autre, c'est celui-la qu'il veut. */
    expect(buildSms(lead('+32470112233'), '+3221234567', 'fr')).toContain('+32470112233');
    expect(buildSms(lead('+32470112233'), '+3221234567', 'fr')).not.toContain('+3221234567');
  });

  it('retombe sur l\'identifiant d\'appelant quand rien n\'a ete dicte', () => {
    expect(buildSms(lead(null), '+3221234567', 'fr')).toContain('+3221234567');
  });

  it('n\'invente pas de ligne de rappel quand les deux manquent', () => {
    /* Un « Rappeler : » vide ferait perdre du temps a le chercher. */
    expect(buildSms(lead(null), null, 'fr')).not.toContain('Rappeler');
  });

  it('garde le numero quand le message est tronque', () => {
    /* Le motif se coupe, jamais le numero: c'est la seule partie inutilisable
       si elle est coupee. */
    const long = { ...lead('+32470112233'), reason: 'x'.repeat(400) };
    const sms = buildSms(long, null, 'fr');
    expect(sms.length).toBeLessThanOrEqual(320);
    expect(sms).toContain('+32470112233');
  });
});
