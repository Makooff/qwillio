import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Le source SANS ses commentaires (voir assistant-speech-sync.test.ts). */
const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Sixième trou de la famille 6quindecies (13/09/2026).
 *
 * L'assistant ENREGISTRÉ, celui qui décroche sur une ligne dédiée, portait
 * `provider: 'openai'` écrit à la main: Vapi appelait OpenAI lui-même, avec le
 * modèle figé à la synchronisation. Tout ce que le chemin custom-LLM ajoute à
 * chaque tour (mémoire de l'appelant, date, reprise après coupure, étages de
 * modèle, cache de préfixe, relevé du modèle servi) n'atteignait aucun de ces
 * appels. Le docteur l'a dit: « modèle porté par l'assistant (openai) :
 * gpt-4.1 », et « modèles servis : aucun relevé ».
 */
describe('le bloc model de l\'assistant enregistré vient du même constructeur que l\'appel', () => {
  const onboarding = read('services/onboarding.service.ts');

  it('ne pose plus provider openai à la main', () => {
    expect(onboarding).not.toMatch(/provider:\s*'openai'/);
  });

  it('appelle assistantModelBlock sur les DEUX écritures, avec l\'URL custom-LLM du client', () => {
    expect((onboarding.match(/assistantModelBlock\(/g) ?? []).length).toBe(2);
    expect((onboarding.match(/customLlmUrlFor\(client\.id\)/g) ?? []).length).toBe(2);
  });

  it('lit le choix custom-LLM sur le PROFIL, pas sur une seconde règle', () => {
    expect(onboarding).toMatch(/customLlm:\s*profile\.customLlm/);
  });

  it('l\'assistant bâti à l\'appel passe par le même bloc et la même URL', () => {
    const orchestrator = read('services/voice/realtime-orchestrator.service.ts');
    expect(orchestrator).toMatch(/customLlmUrlFor\(clientId\)/);
    expect(orchestrator).not.toMatch(/\/api\/webhooks\/vapi\/llm\//);
    const plans = read('services/voice/speech-plans.ts');
    expect(plans).toMatch(/model:\s*assistantModelBlock\(/);
  });
});
