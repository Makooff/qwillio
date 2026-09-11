import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Brancher une intégration doit REBÂTIR l'assistant distant.
 *
 * Sixième passage de la famille 6quindecies. Brancher Google Agenda écrivait le
 * jeton et répondait `connected: true`, rien de plus. Or les outils d'agenda ne
 * sont attachés que `if (canBook)`, lu sur le PROFIL au moment où l'assistant
 * est construit. Le client branchait son agenda, l'écran disait branché, et
 * l'agent continuait de répondre qu'il ne peut pas réserver sur cette ligne.
 *
 * Le DÉBRANCHEMENT porte le même défaut en pire: l'agent garderait des outils
 * pointant un jeton révoqué, et proposerait des créneaux qu'il ne peut plus
 * réserver.
 *
 * Le test lit le source, faute d'un harnais capable d'instancier le contrôleur,
 * et retire d'abord les commentaires: celui posé au-dessus du correctif nomme
 * forcément la forme fautive.
 */
function source(): string {
  return readFileSync(join(__dirname, '../../../controllers/client-dashboard.controller.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function method(src: string, name: string): string {
  const start = src.indexOf(`async ${name}(`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return '';
}

const ROUTES = ['connectGoogleCalendar', 'disconnectGoogleCalendar'];

describe('resynchronisation après un changement d\'intégration', () => {
  const src = source();

  it.each(ROUTES)('%s rebâtit l\'assistant distant', name => {
    const body = method(src, name);
    expect(body, `${name} introuvable`).not.toBe('');
    expect(body).toContain('resyncAfterIntegrationChange');
  });

  it('vide le cache du profil AVANT de resynchroniser', () => {
    /* L'ordre inverse rebâtirait les outils sur la configuration d'avant le
       branchement, et le client devrait brancher deux fois. */
    const helper = method(src, 'resyncAfterIntegrationChange') || src;
    const cache = helper.indexOf('invalidateClient');
    const sync = helper.indexOf('syncVapiAssistant');
    expect(cache).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(-1);
    expect(cache).toBeLessThan(sync);
  });

  it('ne fait pas échouer la requête quand Vapi refuse', () => {
    /* Le jeton EST écrit, donc le branchement a eu lieu. Répondre 500 ferait
       croire le contraire et inviterait à rebrancher, ce qui ne réparerait
       rien. L'état réel part dans `agentUpdated`. */
    expect(src).toContain('agentUpdated');
  });

  it('ne redevient pas silencieux sur un refus', () => {
    /* Un `logger.warn` avalé est le mode d'échec des deux pannes de flotte. */
    expect(src).toContain('reportAssistantSyncFailure');
  });
});
