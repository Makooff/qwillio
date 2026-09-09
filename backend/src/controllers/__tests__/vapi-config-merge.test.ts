import { describe, it, expect } from 'vitest';
import { mergeVapiConfig } from '../client-dashboard.controller';

/**
 * `vapiConfig` était REMPLACÉ par ce que l'appel envoyait.
 *
 * Tout tient dans ce seul champ: le moteur de synthèse choisi pour ce client,
 * le chemin custom-LLM, la base de connaissances, le mode sans enregistrement.
 * Une omission les effaçait tous, en silence, et personne ne s'en apercevait
 * avant le prochain appel entrant.
 */
describe('mergeVapiConfig', () => {
  const current = {
    ttsProvider: 'cartesia',
    customLlm: true,
    recordCalls: false,
    notifications: { sms: true, email: false },
  };

  it('garde ce que l\'appel ne renvoie pas', () => {
    const merged = mergeVapiConfig(current, { ttsProvider: '11labs' });
    expect(merged.ttsProvider).toBe('11labs');
    // Les trois autres réglages survivent, alors qu'ils n'étaient pas dans
    // l'appel: c'est toute la différence entre fusionner et remplacer.
    expect(merged.customLlm).toBe(true);
    expect(merged.recordCalls).toBe(false);
    expect(merged.notifications).toEqual({ sms: true, email: false });
  });

  it('retire une clé avec null, seul moyen de nettoyer sans tout renvoyer', () => {
    const merged = mergeVapiConfig(current, { ttsProvider: null });
    expect('ttsProvider' in merged).toBe(false);
    expect(merged.customLlm).toBe(true);
  });

  it('remplace un sous-objet en entier plutôt que de le fusionner', () => {
    // Une fusion profonde rendrait impossible de RETIRER une entrée, et une
    // base de connaissances dont on ne peut plus retirer une ligne est pire
    // qu'un réglage écrasé.
    const merged = mergeVapiConfig(current, { notifications: { sms: false } });
    expect(merged.notifications).toEqual({ sms: false });
  });

  it('part d\'un objet vide quand il n\'y a rien en base', () => {
    expect(mergeVapiConfig(null, { recordCalls: false })).toEqual({ recordCalls: false });
    expect(mergeVapiConfig(undefined, undefined)).toEqual({});
  });

  it('ignore un corps qui n\'est pas un objet plutôt que d\'écraser', () => {
    expect(mergeVapiConfig(current, 'nawak')).toEqual(current);
    expect(mergeVapiConfig(current, null)).toEqual(current);
  });
});
