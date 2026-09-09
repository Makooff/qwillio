import { describe, it, expect, vi, beforeEach } from 'vitest';

const { notifyAlerts, error, warn } = vi.hoisted(() => ({
  notifyAlerts: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../../config/logger', () => ({
  logger: { error, warn, info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../discord.service', () => ({ discordService: { notifyAlerts } }));

const { fallbackWatchService } = await import('../fallback-watch.service');

/**
 * `n` tours dont `bad` en repli, RÉPARTIS, pas groupés.
 *
 * La répartition n'est pas un détail de confort: la fenêtre est glissante, donc
 * grouper les replis en tête ferait lire 50 % au vingtième tour à un flux qui
 * n'en compte que 10 % au total. C'est un comportement voulu — voir le test des
 * rafales — mais ce n'est pas ce que « un taux de 10 % » veut dire.
 */
function turns(n: number, bad: number, reason?: string): void {
  let owed = 0;
  for (let i = 0; i < n; i++) {
    owed += bad / n;
    const fellBack = owed >= 1;
    if (fellBack) owed -= 1;
    fallbackWatchService.record(fellBack, reason);
  }
}

/** Le texte de la dernière alerte partie, ou ''. */
function lastAlert(): string {
  return notifyAlerts.mock.calls.at(-1)?.[0] ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  fallbackWatchService.reset();
  notifyAlerts.mockResolvedValue(undefined);
});

/**
 * Le mode d'échec visé est arrivé pour de vrai le 09/09/2026: crédit OpenAI
 * épuisé, chaque tour en repli, et la phrase de repli ne nomme aucune panne.
 * Une flotte morte tenait donc une conversation entière de « pouvez-vous
 * répéter ? » sans qu'aucun voyant ne s'allume.
 */
describe('le canari des replis du modèle', () => {
  it('se tait tant que la fenêtre est trop courte pour parler', () => {
    // Dix tours SUR DIX en repli: le pire taux possible, et pourtant rien.
    // Une nuit calme à un appel raté n'est pas une panne de flotte.
    turns(10, 10, 'OpenAI responded 429');
    expect(fallbackWatchService.rate()).toBeNull();
    expect(notifyAlerts).not.toHaveBeenCalled();
  });

  it('ne dit rien quand tout va bien', () => {
    turns(100, 0);
    expect(fallbackWatchService.rate()).toBe(0);
    expect(notifyAlerts).not.toHaveBeenCalled();
  });

  it('ne dit rien sous le seuil', () => {
    // 10 % de replis: réel, mais pas anormal sur un réseau téléphonique.
    turns(100, 10, 'OpenAI responded 500');
    // Une fourchette et pas une égalité: la répartition est faite à
    // l'accumulateur, donc le compte exact dépend d'un arrondi flottant, et ce
    // que ce test affirme est « sous le seuil », pas « exactement 10 % ».
    expect(fallbackWatchService.rate()).toBeGreaterThan(0.05);
    expect(fallbackWatchService.rate()).toBeLessThan(0.15);
    expect(notifyAlerts).not.toHaveBeenCalled();
  });

  it('alerte au-dessus du seuil, et nomme la cause', () => {
    turns(100, 30, 'OpenAI responded 429');
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    expect(lastAlert()).toMatch(/repli/i);
    expect(lastAlert()).toContain('OpenAI responded 429');
  });

  it('n\'alerte qu\'une fois tant que la panne dure', () => {
    turns(100, 30, 'OpenAI responded 429');
    // La panne continue: cent tours de plus, tous ratés.
    turns(100, 100, 'OpenAI responded 429');
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
  });

  it('annonce le retour à la normale, sinon personne ne sait que c\'est fini', () => {
    turns(100, 30, 'OpenAI responded 429');
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
    // La fenêtre fait 200 tours: 200 tours sains la vident de ses replis.
    turns(200, 0);
    expect(notifyAlerts).toHaveBeenCalledTimes(2);
    expect(lastAlert()).toMatch(/retomb/i);
    expect(fallbackWatchService.summary().alerting).toBe(false);
  });

  it('alerte sur une RAFALE, même si le flux est sain par ailleurs', () => {
    // La fenêtre est glissante, donc dix échecs d'affilée sur vingt tours sont
    // une panne en cours, pas une moyenne rassurante. C'est le comportement
    // voulu: attendre la moyenne longue, c'est alerter une heure trop tard.
    for (let i = 0; i < 10; i++) fallbackWatchService.record(true, 'OpenAI responded 429');
    for (let i = 0; i < 10; i++) fallbackWatchService.record(false);
    expect(notifyAlerts).toHaveBeenCalledTimes(1);
  });

  it('borne sa mémoire, quel que soit le nombre de tours', () => {
    turns(5000, 0);
    expect(fallbackWatchService.summary().turns).toBeLessThanOrEqual(200);
  });

  it('ne compte que les tours servis, pas les tours déviés', () => {
    // Le service ne voit que ce que llm-stream lui donne: rien ici.
    expect(fallbackWatchService.summary().turns).toBe(0);
    expect(fallbackWatchService.summary().rate).toBeNull();
  });

  it('journalise même quand Discord est muet', () => {
    notifyAlerts.mockRejectedValue(new Error('webhook 404'));
    expect(() => turns(100, 30, 'OpenAI responded 429')).not.toThrow();
    // Le journal est le canal qui ne peut pas manquer.
    expect(error).toHaveBeenCalled();
  });

  it('n\'expose aucune donnée d\'appel dans son résumé', () => {
    // Le résumé est servi sur une route SANS authentification.
    turns(100, 30, 'OpenAI responded 429');
    const keys = Object.keys(fallbackWatchService.summary()).sort();
    expect(keys).toEqual(
      ['alerting', 'fallbacks', 'lastReason', 'minTurns', 'rate', 'thresholdRate', 'turns'],
    );
  });
});
