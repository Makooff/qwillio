import { createHash } from 'node:crypto';
import { BEHAVIOUR_ANALYSIS_INSTRUCTION, evidenceForAnalysis, type LearningScope } from './learning-evidence';
import { ANALYSIS_SYSTEM_PROMPT, parsePatterns } from './call-patterns';
import { isGpt6Family, reviewModelOrThrow, servedModelAllowed } from './review-model-policy';

export const REVIEW_VERSION = 1;
export function reviewModel(): string {
  return reviewModelOrThrow();
}
export function transcriptHash(transcript: string): string {
  return createHash('md5').update(transcript).digest('hex');
}
export function pendingReview(transcript: string) {
  return { version: REVIEW_VERSION, status: 'pending', transcriptHash: transcriptHash(transcript) };
}
export async function reviewCall(apiKey: string, transcript: string, scope: LearningScope, context = '') {
  const model = reviewModel();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: `${ANALYSIS_SYSTEM_PROMPT}\nReturn both patterns and ${BEHAVIOUR_ANALYSIS_INSTRUCTION}` },
        { role: 'user', content: JSON.stringify({ scope, context, transcript }) },
      ],
      ...(/^(gpt-[56](?:[.-]|$)|o[1-9](?:[.-]|$))/i.test(model) ? {} : { temperature: 0.1 }),
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = await response.json() as any;
  if (typeof data.model !== 'string' || !data.model.trim()) throw new Error('Modèle servi absent');
  if (isGpt6Family(model) && !isGpt6Family(data.model)) throw new Error('Famille du modèle servi inattendue');
  if (!servedModelAllowed(model, data.model)) throw new Error('Modèle servi hors politique');
  const raw = data.choices?.[0]?.message?.content;
  const patterns = parsePatterns(raw, transcript);
  const parsed = JSON.parse(raw);
  const evidence = evidenceForAnalysis(parsed.learningBehaviour, scope);
  if (!evidence) throw new Error('Preuve comportementale ou scope invalide');
  return {
    patterns, evidence,
    review: { version: REVIEW_VERSION, status: 'succeeded', requestedModel: model,
      actualModel: data.model as string, transcriptHash: transcriptHash(transcript),
      reviewedAt: new Date().toISOString(), scope, patterns, behaviour: evidence.behaviour },
  };
}
