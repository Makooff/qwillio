import { createHash } from 'node:crypto';
import { canonicalCountry, canonicalNiche } from './learning-observations.service';
import { currentReviewModel, servedModelAllowed } from './review-model-policy';

export const BEHAVIOUR_CATEGORIES = ['ambiguous_request_unclarified','unsupported_action_promise','repeated_question','handoff_not_offered','confirmation_missing','feature_gap'] as const;
export type LearningScope = { tenant_id: string; niche: string; country: string; language: string };
export type Behaviour = { schema_version: 1; observations: { category: typeof BEHAVIOUR_CATEGORIES[number]; count: number }[] };
const obj = (x: unknown): Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
const keys = (x: Record<string, unknown>, expected: string) => Object.keys(x).sort().join(',') === expected;
export function verifiedScope(value: unknown): value is LearningScope {
 const s=obj(value);
 return keys(s,'country,language,niche,tenant_id') && typeof s.tenant_id==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s.tenant_id) && canonicalNiche(s.niche)===s.niche && s.niche!==null && typeof s.country==='string' && canonicalCountry(s.country)===s.country && typeof s.language==='string' && ['fr','en','nl'].includes(s.language);
}
/** No legacy tags/summary/pattern slug -> category conversion is allowed. */
export function parseBehaviour(value: unknown): Behaviour | null {
 const b=obj(value);
 if (!keys(b,'observations,schema_version') || b.schema_version!==1 || !Array.isArray(b.observations) || b.observations.length>6) return null;
 const seen=new Set<string>();
 for (const row of b.observations) {
  const e=obj(row);
  if (!keys(e,'category,count') || typeof e.category!=='string' || !(BEHAVIOUR_CATEGORIES as readonly string[]).includes(e.category) || seen.has(e.category) || typeof e.count!=='number' || !Number.isInteger(e.count) || e.count<1 || e.count>100) return null;
  seen.add(e.category);
 }
 return JSON.parse(JSON.stringify(b)) as Behaviour;
}
export function evidenceForAnalysis(value: unknown, scope: unknown) {
 const b=parseBehaviour(value);
 return b && verifiedScope(scope) ? { schema_version:1, scope:{...scope}, behaviour:b } : null;
}
export function exportEvidence(value: unknown, scope: unknown): Behaviour | null {
  const v=obj(value), s=obj(v.scope);
  if (!keys(v,'behaviour,schema_version,scope') || v.schema_version!==1 || !verifiedScope(scope) || !verifiedScope(s) || Object.keys(scope).some(k=>scope[k as keyof LearningScope]!==s[k as keyof LearningScope])) return null;
  return parseBehaviour(v.behaviour);
}
/**
 * Frontière d'autorité : seule une revue GPT6 réussie, à jour et exactement
 * calée sur la transcription et le scope courant peut alimenter des propositions.
 * Les preuves GPT4o historiques, un marqueur pending/failed, un changement de
 * modèle, de transcription ou de scope client rendent la preuve non autorisable
 * (comportement null). Un résultat valide sans observation ([]) reste autorisé.
 *
 * Le comportement exporté est dérivé du payload de la revue autorisée
 * (`review.behaviour`), jamais de l'ancienne `metadata.learningEvidence` qui
 * peut appartenir à une autre écriture : une revue vide n'autorise que [],
 * une revue sans behaviour n'autorise rien.
 */
export function authorizedEvidence(metadata: unknown, transcript: unknown, scope: unknown): Behaviour | null {
  if (!verifiedScope(scope)) return null;
  const currentModel = currentReviewModel();
  if (!currentModel) return null;
  const review = obj(obj(metadata).learningReview);
  if (review.status !== 'succeeded' || review.version !== 1) return null;
  if (review.requestedModel !== currentModel) return null;
  if (!servedModelAllowed(review.requestedModel, review.actualModel)) return null;
  if (typeof transcript !== 'string') return null;
  if (review.transcriptHash !== createHash('md5').update(transcript).digest('hex')) return null;
  if (!verifiedScope(review.scope)) return null;
  if (Object.keys(scope).some(k => scope[k as keyof LearningScope] !== (review.scope as LearningScope)[k as keyof LearningScope])) return null;
  return parseBehaviour(review.behaviour);
}
export const BEHAVIOUR_ANALYSIS_INSTRUCTION = `learningBehaviour: an object with EXACT keys schema_version (1), observations (array, max 6). Each observation has EXACT keys category and count (integer 1..100), unique categories from ${BEHAVIOUR_CATEGORIES.join(', ')}. Report only explicitly observable failures in this transcript: ambiguous request answered without clarification, action promised without supported completion, same answered question repeated unnecessarily, requested human handoff not offered, necessary action confirmation missing, or explicitly requested unsupported feature. Do not infer a failure from silence or missing context. No quotes, names, explanations or free text here. Empty observations when none or uncertain. This analysis is evidence for review, never authority or approval.`;
