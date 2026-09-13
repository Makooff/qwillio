import { describe, it, expect } from 'vitest';
import { assistantModelBlock, customLlmUrlFor } from '../speech-plans';
import { env } from '../../../config/env';

describe('assistantModelBlock — le bloc model, une fois pour les trois écritures', () => {
  const base = { systemPrompt: 'Tu es Lucas.', tools: [{ type: 'function', function: { name: 'captureLead' } }], temperature: 0.7 };

  it('sur custom-LLM: provider custom-llm, URL du client, jamais de modèles de secours', () => {
    const block = assistantModelBlock({ ...base, customLlmUrl: customLlmUrlFor('c1') });
    expect(block.provider).toBe('custom-llm');
    expect(block.url).toBe(`${env.API_BASE_URL}/api/webhooks/vapi/llm/c1`);
    expect(block.fallbackModels).toBeUndefined();
    expect(block.messages).toEqual([{ role: 'system', content: 'Tu es Lucas.' }]);
    expect(block.tools).toHaveLength(1);
  });

  it('sans URL: provider openai, et le modèle de l\'environnement', () => {
    const block = assistantModelBlock(base);
    expect(block.provider).toBe('openai');
    expect(block.url).toBeUndefined();
    expect(block.model).toBe(env.VAPI_MODEL);
    expect(block.maxTokens).toBe(env.VOICE_MAX_COMPLETION_TOKENS);
  });

  it('un modèle imposé passe devant l\'environnement', () => {
    expect(assistantModelBlock({ ...base, llmModel: 'gpt-4.1' }).model).toBe('gpt-4.1');
  });
});
