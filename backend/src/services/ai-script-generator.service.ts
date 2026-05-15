/**
 * AI Script Generator — dynamically creates niche-specific call scripts
 * using OpenAI GPT-4o. Falls back to a generic template when the API is
 * unavailable. Scripts are cached in memory to avoid redundant API calls
 * within the same process lifetime.
 */
import { logger } from '../config/logger';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────

export interface GeneratedScript {
  intro: string;
  painPoint: string;
  pitch: string;
  cta: string;
  objectionHandlers: Record<string, string>;
  rawFull: string;
}

interface ScriptContext {
  businessName: string;
  niche: string;
  city: string;
  reviewCount?: number | null;
  rating?: number | null;
  hasWebsite?: boolean;
  agentName?: 'Ashley' | 'Marie';
  language?: 'en' | 'fr';
}

// ─── In-memory cache (niche + language key) ───────────────
const scriptCache = new Map<string, GeneratedScript>();

// ─── Niche-to-plain-English labels ───────────────────────
const NICHE_LABELS: Record<string, string> = {
  home_services:  'home services (plumber, HVAC, electrician, roofer)',
  dental:         'dental practice',
  auto:           'auto repair shop',
  law:            'law firm',
  medical:        'medical / urgent care clinic',
  salon:          'hair & beauty salon',
  veterinary:     'veterinary clinic / animal hospital',
  restaurant:     'restaurant or catering business',
  fitness:        'gym or fitness studio',
  real_estate:    'real estate agency',
  financial:      'accounting / insurance / financial services',
  childcare:      'daycare or childcare center',
  pet:            'pet grooming or dog daycare',
  hotel:          'boutique hotel or bed & breakfast',
  creative:       'photography or videography studio',
  retail:         'florist or event planner',
  cleaning:       'cleaning service (residential or commercial)',
  funeral:        'funeral home or cremation service',
  travel:         'travel agency',
};

// ─── System prompt ────────────────────────────────────────
function buildSystemPrompt(language: 'en' | 'fr'): string {
  if (language === 'fr') {
    return `Tu es un expert en scripts d'appels commerciaux B2B pour Qwillio, un service de réceptionniste IA.
Qwillio aide les PME à ne jamais manquer un appel entrant grâce à une IA qui répond, prend les rendez-vous et capture les leads — 24h/24, 7j/7.
Tarif : premier mois offert, puis 497 $/mois.
Ton objectif : écrire un script d'appel sortant qui sonne naturel, humain, et déclenche une démo.
Format JSON strict, sans markdown.`;
  }
  return `You are an expert B2B cold-call script writer for Qwillio, an AI receptionist service.
Qwillio helps small businesses never miss an inbound call — the AI answers, books appointments, and captures leads 24/7.
Pricing: first month free, then $497/month flat.
Goal: write an outbound call script that feels natural, human, and drives a demo booking.
Strict JSON output, no markdown.`;
}

// ─── User prompt ──────────────────────────────────────────
function buildUserPrompt(ctx: ScriptContext): string {
  const nicheLabel = NICHE_LABELS[ctx.niche] ?? ctx.niche;
  const agent = ctx.agentName ?? 'Ashley';
  const reviewSignal = ctx.reviewCount
    ? `${ctx.reviewCount} Google reviews (rating: ${ctx.rating ?? 'unknown'})`
    : 'no review data available';
  const websiteSignal = ctx.hasWebsite
    ? 'has a website (so they care about online presence)'
    : 'no website detected (potential digital gap)';

  if (ctx.language === 'fr') {
    return `Crée un script d'appel pour ${agent} (réceptionniste IA Qwillio) ciblant un "${nicheLabel}" à ${ctx.city}.
Nom du commerce : ${ctx.businessName}
Signaux : ${reviewSignal}, ${websiteSignal}.

Retourne UNIQUEMENT ce JSON :
{
  "intro": "phrase d'accroche, présentation de ${agent}",
  "painPoint": "question ouverte qui révèle le problème des appels manqués (1-2 phrases)",
  "pitch": "valeur proposée de Qwillio adaptée à ce niche (2-3 phrases max)",
  "cta": "appel à l'action pour une démo de 5 minutes",
  "objectionHandlers": {
    "voicemail": "réponse si le prospect dit qu'il utilise la messagerie",
    "cost": "réponse si le prospect dit que c'est trop cher",
    "think_about_it": "réponse si le prospect dit qu'il va réfléchir",
    "already_have_receptionist": "réponse si le prospect dit qu'il a déjà une réceptionniste",
    "not_interested": "réponse de récupération"
  },
  "rawFull": "script complet enchaîné, prêt à lire, avec les balises [Écouter] aux moments clés"
}`;
  }

  return `Write a call script for ${agent} (Qwillio AI receptionist) targeting a "${nicheLabel}" in ${ctx.city}.
Business name: ${ctx.businessName}
Signals: ${reviewSignal}, ${websiteSignal}.

Return ONLY this JSON:
{
  "intro": "opening line introducing ${agent}",
  "painPoint": "open-ended question exposing the missed-call problem (1-2 sentences)",
  "pitch": "Qwillio value prop tailored to this niche (max 2-3 sentences)",
  "cta": "call to action for a 5-minute demo",
  "objectionHandlers": {
    "voicemail": "response if they say they use voicemail",
    "cost": "response if they say it's too expensive",
    "think_about_it": "response if they say they'll think about it",
    "already_have_receptionist": "response if they say they already have a receptionist",
    "not_interested": "recovery response"
  },
  "rawFull": "full script chained together, ready to read, with [Listen] tags at key moments"
}`;
}

// ─── Fallback template ────────────────────────────────────
function buildFallbackScript(ctx: ScriptContext): GeneratedScript {
  const agent = ctx.agentName ?? 'Ashley';
  const nicheLabel = NICHE_LABELS[ctx.niche] ?? ctx.niche;
  const isEn = (ctx.language ?? 'en') === 'en';

  if (!isEn) {
    return {
      intro: `Allô bonjour — c'est ${agent} de Qwillio.`,
      painPoint: `Question rapide — quand vous êtes occupé(e), qu'est-ce qui se passe avec les appels entrants de ${ctx.businessName} ?`,
      pitch: `Qwillio est une réceptionniste IA qui répond à chaque appel, prend les rendez-vous et capture les leads — 24h/24. Premier mois offert.`,
      cta: `Je peux vous montrer en 5 minutes comment ça marche pour votre ${nicheLabel} à ${ctx.city} ?`,
      objectionHandlers: {
        voicemail: "La messagerie fait perdre 80% des appelants. Notre IA les retient.",
        cost: "Premier mois entièrement gratuit. Ensuite 497 $/mois — moins d'un client perdu.",
        think_about_it: "Bien sûr — je peux vous envoyer un clip démo de 2 minutes ?",
        already_have_receptionist: "Parfait — notre IA gère le débordement et les appels hors horaires. Votre équipe reste concentrée.",
        not_interested: "Je comprends. Juste une dernière chose — combien d'appels estimez-vous manquer par semaine ?",
      },
      rawFull: `Allô bonjour — c'est ${agent} de Qwillio. Question rapide — quand vous êtes occupé(e), qu'est-ce qui se passe avec les appels entrants de ${ctx.businessName} ?\n[Écouter]\nVoilà exactement le problème qu'on résout. Notre réceptionniste IA répond à chaque appel, prend les rendez-vous, capture les leads — 24h/24, 7j/7. Premier mois offert, zéro frais de setup. Je vous montre en 5 minutes comment ça marche pour votre activité à ${ctx.city} ?`,
    };
  }

  return {
    intro: `Hi, this is ${agent} from Qwillio.`,
    painPoint: `Quick question — when ${ctx.businessName} is busy, what happens to incoming calls?`,
    pitch: `Qwillio gives you an AI receptionist that answers every call, books appointments, and captures leads — 24/7. First month is completely free.`,
    cta: `Can I show you in 5 minutes how it'd work for your ${nicheLabel} in ${ctx.city}?`,
    objectionHandlers: {
      voicemail: "Voicemail loses 80% of callers — they hang up and call a competitor. Our AI keeps every one of them.",
      cost: "First month is completely free. After that, $497 flat — less than one missed job.",
      think_about_it: "Totally fair. Can I send you a 2-minute audio demo? No commitment.",
      already_have_receptionist: "Perfect — Ashley handles overflow and after-hours so your team stays focused.",
      not_interested: "I understand. One last thing — how many calls do you estimate you miss per week?",
    },
    rawFull: `Hi, this is ${agent} from Qwillio. Quick question — when ${ctx.businessName} is busy, what happens to incoming calls?\n[Listen]\nThat's exactly what we fix. Our AI receptionist answers every call, books the job, and captures the customer info — 24/7, even on weekends. First month completely free, no setup fee. Can I show you in 5 minutes how it'd work for your ${nicheLabel} in ${ctx.city}?`,
  };
}

// ─── Main service ─────────────────────────────────────────

export class AiScriptGeneratorService {
  private readonly OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly MODEL = 'gpt-4o-mini'; // cost-efficient for script generation

  /** Generate (or return cached) a script for the given context */
  async generateScript(ctx: ScriptContext): Promise<GeneratedScript> {
    const language = ctx.language ?? 'en';
    const cacheKey = `${ctx.niche}:${language}`;

    // Return cached version if it exists (we cache per niche+language, not per business)
    const cached = scriptCache.get(cacheKey);
    if (cached) return cached;

    if (!env.OPENAI_API_KEY) {
      logger.warn('[AIScript] OPENAI_API_KEY not set — using fallback script');
      return buildFallbackScript(ctx);
    }

    try {
      const res = await fetch(this.OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          temperature: 0.7,
          max_tokens: 800,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt(language) },
            { role: 'user', content: buildUserPrompt(ctx) },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.error(`[AIScript] OpenAI API error HTTP ${res.status}: ${body.slice(0, 200)}`);
        return buildFallbackScript(ctx);
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const raw = data.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(raw) as GeneratedScript;

      // Validate required fields
      if (!parsed.rawFull || !parsed.intro) {
        logger.warn('[AIScript] Incomplete response from OpenAI — using fallback');
        return buildFallbackScript(ctx);
      }

      // Cache the result
      scriptCache.set(cacheKey, parsed);
      logger.info(`[AIScript] Generated & cached script for niche="${ctx.niche}" lang="${language}"`);

      return parsed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AIScript] Script generation failed: ${msg}`);
      return buildFallbackScript(ctx);
    }
  }

  /** Clear the in-memory cache (useful for testing or manual refresh) */
  clearCache(): void {
    scriptCache.clear();
  }

  /** Return cache stats */
  getCacheStats(): { size: number; keys: string[] } {
    return { size: scriptCache.size, keys: [...scriptCache.keys()] };
  }
}

export const aiScriptGeneratorService = new AiScriptGeneratorService();
