import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Le pendant ÉCRIVANT de `voice:doctor`.
 *
 * `voice:doctor` dit qu'un assistant est périmé, pas pourquoi la
 * resynchronisation n'a pas eu lieu. Le seul déclencheur était un
 * enregistrement depuis le portail, et ce chemin AVALE l'échec: il attrape,
 * écrit un `logger.warn` et répond `success: true`. Un gérant qui sauve trois
 * fois obtient trois fois « enregistré » et trois fois rien.
 *
 * Ce script refait le même appel sans le filet. Les règles ci-dessous sont ce
 * qui le distingue du chemin qu'il remplace: s'il se mettait lui aussi à
 * attraper en silence, ou à couper le corps de la réponse, il ne servirait
 * plus à rien et personne ne s'en apercevrait.
 */
function source(): string {
  return readFileSync(join(__dirname, '../../../scripts/resync-assistant.ts'), 'utf8');
}

describe('voice:resync', () => {
  const src = source();

  it('appelle la MÊME fonction que le portail, jamais une copie', () => {
    /* Une copie ne vieillirait pas avec l'original, et c'est l'original qui
       part chez Vapi. Même raison que pour `buildVoiceTools` dans
       `voice:validate`. */
    expect(src).toContain('onboardingService.syncVapiAssistant');
  });

  it('imprime le corps de la réponse SANS le tronquer', () => {
    /* Couper la réponse d'une API fabrique une déduction fausse qui a l'air
       d'une lecture: deux identifiants de modèle erronés ont déjà été posés
       comme ça (6quinvicies). */
    expect(src).toContain('failure.detail');
    expect(src).not.toMatch(/detail\.slice\(0,\s*\d+\)/);
    expect(src).not.toMatch(/\.slice\(0,\s*\d+\)/);
  });

  it('distingue un REFUS d\'un incident passager', () => {
    /* Un 4xx porte sur la charge, construite par le même code pour tout le
       monde: c'est un incident de flotte même vu sur un compte. Un 5xx ne dit
       rien et se retentera seul. */
    expect(src).toContain('classifyVapiError');
    expect(src).toContain("failure.kind === 'rejected'");
  });

  it('n\'écrit rien sans --confirm', () => {
    expect(src).toContain("process.argv.includes('--confirm')");
    expect(src).toContain('SIMULATION');
  });

  it('sort en erreur quand au moins un assistant a été refusé', () => {
    // Sinon un lancement en CI ou en cron passerait pour un succès.
    expect(src).toContain('process.exitCode = 1');
  });

  it('ignore les fiches SANS assistant distant', () => {
    /* Sans assistant, il n'y a rien à resynchroniser: c'est une création, et
       elle appartient à l'inscription. */
    expect(src).toContain('vapiAssistantId: { not: null }');
  });
});
