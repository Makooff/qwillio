import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * `voice:validate` doit soumettre la charge que la PRODUCTION envoie.
 *
 * C'est le seul outil qui parle à l'API vivante, et un champ refusé n'abîme pas
 * un appel: il fait refuser l'assistant entier, donc tous les appels du client
 * (6octies). Un script qui valide une charge écrite pour lui ne prouve rien sur
 * celle qui part.
 */
describe('npm run voice:validate — la charge soumise', () => {
  const script = read('scripts/validate-assistant.ts');

  it('compose le modèle et la voix par le constructeur de l\'appel', () => {
    // Le trou qui restait: `provider: 'openai'` écrit à la main, alors que le
    // chemin d'appel passe par `buildSpeech` et que la flotte tourne en
    // custom-LLM. Le bloc `model` réel n'avait jamais été soumis.
    expect(script).toMatch(/buildSpeech\(\{/);
    expect(script).not.toMatch(/model:\s*\{\s*provider:\s*'openai'/);
  });

  it('soumet aussi la forme custom-LLM, celle de la flotte', () => {
    expect(script).toMatch(/customLlmUrl:/);
  });

  it('impose le moteur au lieu de le laisser déduire', () => {
    // `auto` ramènerait les six variantes au même moteur, donc trois essais
    // sur six ne testeraient rien.
    expect(script).toMatch(/voiceMode:\s*speechToSpeech\s*\?\s*'realtime'\s*:\s*'classic'/);
  });

  it('prend ses outils du constructeur, jamais d\'une copie', () => {
    // Une copie écrite pour le test ne vieillirait pas avec l'original, et
    // c'est l'original qui part chez Vapi.
    expect(script).toMatch(/tools:\s*buildVoiceTools\(/);
  });
});
