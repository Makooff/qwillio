import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VAPI_ASSISTANT_NAME_MAX, fitAssistantName } from '../vapi-limits';

const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Le nom de l'assistant RENDU à `assistant-request` tient dans la borne.
 *
 * C'est le seul chemin qui échappe à `vapiClient`: cet assistant n'est pas créé
 * par l'API, il est rendu en réponse à un webhook, donc `fitAssistantLabel`,
 * appliqué dans `config/vapi.ts` sur create et update, ne le voyait jamais.
 * Et ce chemin sert la LIGNE PARTAGÉE, celle des essais.
 */
describe('le nom de l\'assistant rendu au webhook', () => {
  it('passe par la borne, comme les deux autres écritures', () => {
    const orchestrator = read('services/voice/realtime-orchestrator.service.ts');
    expect(orchestrator).toMatch(/name:\s*fitAssistantName\('Receptionist',\s*profile\.businessName\)/);
    expect(orchestrator).not.toMatch(/name:\s*`Receptionist - \$\{profile\.businessName\}`/);
  });

  it('tient sous quarante caractères sur le nom qui a servi d\'exemple', () => {
    // « Receptionist - Boulangerie Saint-Michel Uccle » fait 45 caractères, et
    // un nom trop long ne dégrade pas l'assistant: il le fait refuser en entier.
    const name = fitAssistantName('Receptionist', 'Boulangerie Saint-Michel Uccle');
    expect(name.length).toBeLessThanOrEqual(VAPI_ASSISTANT_NAME_MAX);
    expect(name).toContain('Receptionist');
  });

  it('tient sur un nom absurde', () => {
    const name = fitAssistantName('Receptionist', 'A'.repeat(300));
    expect(name.length).toBeLessThanOrEqual(VAPI_ASSISTANT_NAME_MAX);
  });
});
