import { prisma } from '../config/database';
import { logger } from '../config/logger';

// Lazy prompt resolver: DB-first, falls back to inline defaults.
// Admin UI writes new versions to `AgentPromptConfig`; this service
// reads the latest active row and caches it for 60s to avoid hammering
// the DB on hot paths. Cache is cleared on PUT via `invalidatePrompt`.

export type AgentType =
  | 'marketing'
  | 'reputation'
  | 'scheduling'
  | 'support'
  | 'email'
  | 'accounting'
  | 'inventory'
  | 'payments'
  | 'closer'
  | 'branding'
  | 'business_plan'
  | 'work_planner'
  | 'ai_script_generator';

export type Lang = 'fr' | 'en';

export interface Prompt {
  system: string;
  user: string;
}

const cache = new Map<string, { value: Prompt; expiresAt: number }>();
const TTL_MS = 60_000;

function cacheKey(agentType: AgentType, language: Lang) {
  return `${agentType}:${language}`;
}

export function invalidatePrompt(agentType: AgentType, language: Lang) {
  cache.delete(cacheKey(agentType, language));
}

export async function getPrompt(agentType: AgentType, language: Lang): Promise<Prompt> {
  const key = cacheKey(agentType, language);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    const row = await prisma.agentPromptConfig.findFirst({
      where: { agentType, language, active: true },
      orderBy: { version: 'desc' },
    });
    if (row) {
      const value: Prompt = { system: row.systemPrompt, user: row.userPromptTemplate };
      cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
      return value;
    }
  } catch (e) {
    logger.warn(`[prompt-loader] DB lookup failed for ${agentType}/${language}, using fallback`, e);
  }

  const fallback = FALLBACK_PROMPTS[agentType]?.[language] ?? FALLBACK_PROMPTS[agentType]?.en;
  if (!fallback) {
    throw new Error(`No fallback prompt defined for agent ${agentType}`);
  }
  cache.set(key, { value: fallback, expiresAt: Date.now() + TTL_MS });
  return fallback;
}

// Inline defaults — admin UI can override via DB. Keep these tight; the
// admin should be able to tune without needing to redeploy code.
const FALLBACK_PROMPTS: Partial<Record<AgentType, Partial<Record<Lang, Prompt>>>> = {
  marketing: {
    en: {
      system: `You are a marketing assistant for a small service business. Output concise, on-brand posts/emails in JSON. Never use marketing jargon. Never use em dashes. Respect tone and channel constraints.`,
      user: `Generate a {{contentType}} for {{businessName}} (niche: {{niche}}, tone: {{tone}}, channel: {{channel}}). Topic: {{topic}}. Respond as JSON: { "title": string, "body": string, "callToAction": string }.`,
    },
    fr: {
      system: `Tu es un assistant marketing pour une petite entreprise de service. Produis des publications et emails concis, alignés à la marque, en JSON. Jamais de jargon marketing. Jamais de tirets cadratins. Respecte le ton et le canal demandés.`,
      user: `Génère un {{contentType}} pour {{businessName}} (niche: {{niche}}, ton: {{tone}}, canal: {{channel}}). Sujet: {{topic}}. Réponds en JSON: { "title": string, "body": string, "callToAction": string }.`,
    },
  },
  reputation: {
    en: {
      system: `You are a reputation assistant. Draft polite, professional, brand-appropriate replies to customer reviews. Acknowledge concerns. Never argue. Output JSON.`,
      user: `Draft a reply to this {{rating}}-star review on {{platform}} for {{businessName}}: "{{reviewText}}". Tone: {{tone}}. Respond as JSON: { "reply": string, "shouldEscalate": boolean, "escalationReason": string|null }.`,
    },
    fr: {
      system: `Tu es un assistant réputation. Rédige des réponses polies, professionnelles et alignées à la marque pour les avis clients. Reconnais les préoccupations. Ne discute jamais. Sortie en JSON.`,
      user: `Rédige une réponse à cet avis {{rating}} étoiles sur {{platform}} pour {{businessName}}: "{{reviewText}}". Ton: {{tone}}. Réponds en JSON: { "reply": string, "shouldEscalate": boolean, "escalationReason": string|null }.`,
    },
  },
  scheduling: {
    en: {
      system: `You are a scheduling assistant. Optimize appointment slots, recommend best times, draft reminder messages to reduce no-shows. Output JSON.`,
      user: `Suggest the best {{slotCount}} slots for {{businessName}} in {{timezone}} on {{date}}. Consider working hours and existing bookings. Respond as JSON: { "slots": [{ "datetime": string, "reason": string }] }.`,
    },
    fr: {
      system: `Tu es un assistant de planification. Optimise les créneaux de rendez-vous, recommande les meilleures heures, rédige les rappels pour réduire les no-shows. Sortie en JSON.`,
      user: `Propose les {{slotCount}} meilleurs créneaux pour {{businessName}} en {{timezone}} le {{date}}. Tiens compte des horaires et des rendez-vous existants. Réponds en JSON: { "slots": [{ "datetime": string, "reason": string }] }.`,
    },
  },
  support: {
    en: {
      system: `You are a customer support assistant. Triage incoming tickets, draft helpful replies, escalate when keywords or sentiment require human attention. Output JSON.`,
      user: `Classify and draft a reply to this {{channel}} ticket for {{businessName}}: "{{ticketText}}". Respond as JSON: { "category": string, "priority": "low"|"normal"|"high", "reply": string, "shouldEscalate": boolean, "escalationReason": string|null }.`,
    },
    fr: {
      system: `Tu es un assistant support client. Trie les tickets entrants, rédige des réponses utiles, escalade quand des mots-clés ou le ressenti exigent une attention humaine. Sortie en JSON.`,
      user: `Classe et rédige une réponse à ce ticket {{channel}} pour {{businessName}}: "{{ticketText}}". Réponds en JSON: { "category": string, "priority": "low"|"normal"|"high", "reply": string, "shouldEscalate": boolean, "escalationReason": string|null }.`,
    },
  },
};
