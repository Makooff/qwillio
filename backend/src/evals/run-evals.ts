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

/**
 * Les outils au format OpenAI: le `function` de Vapi, sans le transport Vapi.
 *
 * Le transfert est le cas particulier qui rendait un scénario INTESTABLE.
 * `buildVoiceTools` le pose en outil NATIF Vapi (`{ type: 'transferCall',
 * destinations: [...] }`): il n'a pas de bloc `function`, donc le filtre le
 * jetait, et le modèle n'avait jamais `transferCall` dans sa liste. Le scénario
 * `fr-transfert-humain` exigeait alors un appel d'outil que le modèle n'avait
 * aucun moyen d'émettre: il échouait toujours, et il ne passait que les jours
 * où le harnais sautait faute de clé.
 *
 * En production, c'est Vapi qui présente ce même outil au modèle et qui exécute
 * le pont téléphonique. On reconstitue donc ici sa DÉCLARATION, pas son
 * transport: le modèle choisit ou non de transférer, ce qui est précisément ce
 * que le scénario mesure, et c'est tout ce que cette couche peut mesurer.
 */
function openAiTools(profile: ReturnType<typeof profileFor>) {
  const native = buildVoiceTools(profile);
  const functions = native
    .filter(t => t.type === 'function' && t.function)
    .map(t => ({ type: 'function', function: t.function }));

  if (native.some(t => t.type === 'transferCall')) {
    functions.push({
      type: 'function',
      function: {
        name: 'transferCall',
        description:
          'Transfer the call to a human on the team. Use it as soon as the caller asks for a person, a manager, or reports an emergency.',
        parameters: { type: 'object', properties: {} },
      },
    } as (typeof functions)[number]);
  }

  return functions;
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

/**
 * Que faire quand la clé manque.
 *
 * Le harness sautait en sortant en **0**, et la CI affichait donc une étape
 * « Évals réceptionniste » verte en n'ayant rien testé. Un filet de sécurité
 * dont on ne peut pas distinguer « a tenu » de « n'existait pas » ne protège
 * personne: c'est le seul défaut sérieux que le ré-audit a trouvé au harness.
 *
 * Le comportement par défaut reste non bloquant — exiger le secret de tous les
 * contributeurs casserait les forks — mais le saut devient VISIBLE:
 *  - en local, un avertissement explicite;
 *  - dans GitHub Actions, une annotation `::warning::`, qui remonte dans
 *    l'interface de la PR au lieu de se perdre dans les logs.
 *
 * `EVALS_REQUIRE_KEY=1` transforme l'absence de clé en échec: c'est le réglage
 * à poser une fois le secret configuré sur le dépôt, pour que l'étape cesse
 * d'être décorative.
 */
export function missingKeyBehaviour(opts: { requireKey: boolean; isCI: boolean }): {
  fatal: boolean;
  message: string;
} {
  if (opts.requireKey) {
    return {
      fatal: true,
      message:
        '[evals] ÉCHEC: OPENAI_API_KEY est absente alors que EVALS_REQUIRE_KEY est posé. ' +
        'Les évals ne peuvent pas être considérées comme passées.',
    };
  }
  const warning =
    'OPENAI_API_KEY absente — évals NON EXÉCUTÉES. Cette étape ne prouve rien. ' +
    'Posez le secret sur le dépôt, puis EVALS_REQUIRE_KEY=1 pour en faire un vrai garde-fou.';
  return {
    fatal: false,
    message: opts.isCI ? `::warning::${warning}` : `[evals] ${warning}`,
  };
}

async function main() {
  if (!env.OPENAI_API_KEY) {
    const { fatal, message } = missingKeyBehaviour({
      requireKey: !!process.env.EVALS_REQUIRE_KEY && process.env.EVALS_REQUIRE_KEY !== '0',
      isCI: !!process.env.GITHUB_ACTIONS,
    });
    if (fatal) {
      console.error(message);
      process.exit(1);
    }
    console.warn(message);
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
