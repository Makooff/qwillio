/**
 * Harness d'évals du réceptionniste (roadmap 2.5) — `npm run evals`.
 *
 * Chaque modification de prompt partait en production à l'aveugle: aucun
 * signal de régression comportementale. Ce harness joue les scénarios de
 * `scenarios.ts` contre le VRAI prompt (`buildSystemPrompt`) et les VRAIS
 * outils (`buildVoiceTools`), via l'API OpenAI directement — le même modèle
 * que la production (`VAPI_MODEL`), sans passer par Vapi ni par le réseau
 * téléphonique. Ce qu'il teste, c'est la couche qu'on possède: le prompt et
 * le contrat d'outils.
 *
 * Sans OPENAI_API_KEY, il SKIPPE (exit 0) — la CI peut l'embarquer sans
 * exiger le secret. Une assertion échouée = exit 1 = CI rouge.
 *
 * Coût: ~9 scénarios × 1-2 tours de gpt-4o ≈ quelques centimes par run.
 */

import { buildSystemPrompt } from '../services/voice/system-prompt';
import { buildVoiceTools } from '../services/voice/voice-tools';
import { SCENARIOS, profileFor, type EvalScenario } from './scenarios';
import { env } from '../config/env';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

interface ModelAnswer {
  text: string;
  toolCalls: string[];
}

/** Les outils au format OpenAI: le `function` de Vapi, sans le transport Vapi. */
function openAiTools(profile: ReturnType<typeof profileFor>) {
  return buildVoiceTools(profile)
    .filter(t => t.type === 'function' && t.function)
    .map(t => ({ type: 'function', function: t.function }));
}

async function askModel(messages: ChatMessage[], tools: unknown[]): Promise<ModelAnswer> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.EVAL_MODEL || env.VAPI_MODEL,
      temperature: 0.3,
      max_tokens: 200,
      messages,
      ...(tools.length ? { tools } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const body = (await response.json()) as {
    choices: Array<{ message: { content: string | null; tool_calls?: Array<{ function: { name: string } }> } }>;
  };
  const message = body.choices?.[0]?.message;
  return {
    text: message?.content ?? '',
    toolCalls: (message?.tool_calls ?? []).map(c => c.function.name),
  };
}

/** Rejoue les tours du scénario et interroge le modèle sur le dernier. */
async function playScenario(scenario: EvalScenario): Promise<ModelAnswer> {
  const profile = profileFor(scenario);
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(profile, {
      previousCalls: 0, lastCallAt: null, lastSummary: null, knownName: null, hasUpcomingBooking: false,
    }) },
  ];

  let pendingToolCallId = 0;
  for (const turn of scenario.turns) {
    if (turn.role === 'tool-result') {
      // Simule le cycle outil: l'assistant a appelé l'outil, voici sa réponse.
      const id = `call_${++pendingToolCallId}`;
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [{ id, type: 'function', function: { name: turn.toolName || 'tool', arguments: '{}' } }],
      });
      messages.push({ role: 'tool', tool_call_id: id, content: turn.content });
    } else {
      messages.push({ role: turn.role, content: turn.content });
    }
  }

  return askModel(messages, openAiTools(profile));
}

function checkAssertions(scenario: EvalScenario, answer: ModelAnswer): string[] {
  const failures: string[] = [];
  for (const assertion of scenario.assertions) {
    switch (assertion.kind) {
      case 'reply-matches':
        if (!new RegExp(String(assertion.value), 'i').test(answer.text)) {
          failures.push(`attendu /${assertion.value}/i (${assertion.description}) — réponse: "${answer.text}"`);
        }
        break;
      case 'reply-not-matches':
        if (new RegExp(String(assertion.value), 'i').test(answer.text)) {
          failures.push(`interdit /${assertion.value}/i (${assertion.description}) — réponse: "${answer.text}"`);
        }
        break;
      case 'calls-tool':
        if (!answer.toolCalls.includes(String(assertion.value))) {
          failures.push(`outil ${assertion.value} non appelé (${assertion.description}) — appels: [${answer.toolCalls.join(', ')}], réponse: "${answer.text}"`);
        }
        break;
      case 'does-not-call-tool':
        if (answer.toolCalls.includes(String(assertion.value))) {
          failures.push(`outil ${assertion.value} appelé à tort (${assertion.description})`);
        }
        break;
      case 'reply-shorter-than':
        if (answer.text.length >= Number(assertion.value)) {
          failures.push(`réponse trop longue (${answer.text.length} >= ${assertion.value}): "${answer.text}"`);
        }
        break;
    }
  }
  return failures;
}

async function main() {
  if (!env.OPENAI_API_KEY) {
    console.log('[evals] OPENAI_API_KEY absent — évals sautées (exit 0).');
    return;
  }

  const only = process.argv[2];
  const scenarios = only ? SCENARIOS.filter(s => s.id.includes(only)) : SCENARIOS;
  if (!scenarios.length) {
    console.error(`[evals] aucun scénario ne matche "${only}"`);
    process.exit(1);
  }

  let failed = 0;
  for (const scenario of scenarios) {
    try {
      const answer = await playScenario(scenario);
      const failures = checkAssertions(scenario, answer);
      if (failures.length) {
        failed += 1;
        console.error(`✗ ${scenario.id} — ${scenario.description}`);
        for (const f of failures) console.error(`    ${f}`);
      } else {
        console.log(`✓ ${scenario.id}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`✗ ${scenario.id} — erreur d'exécution: ${(error as Error).message}`);
    }
  }

  console.log(`\n[evals] ${scenarios.length - failed}/${scenarios.length} scénarios verts`);
  if (failed > 0) process.exit(1);
}

// Exécution directe seulement: les tests importent les helpers sans lancer
// une campagne d'appels au modèle.
if (require.main === module) {
  void main();
}

export { checkAssertions, openAiTools };
