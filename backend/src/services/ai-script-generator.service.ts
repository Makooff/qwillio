/**
 * AI Script Generator — dynamically creates niche-specific call scripts
 * using OpenAI GPT-4o. Falls back to a generic template when the API is
 * unavailable. Scripts are cached in memory to avoid redundant API calls
 * within the same process lifetime; the key covers everything that ends up in
 * the copy, so two businesses never share a script.
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

export interface ScriptContext {
  businessName: string;
  niche: string;
  city: string;
  reviewCount?: number | null;
  rating?: number | null;
  hasWebsite?: boolean;
  agentName?: 'Ashley' | 'Marie';
  language?: 'en' | 'fr';
}

// ─── In-memory cache (niche + language + business + city) ────
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
const SCRIPT_VERSION = 'founder-discovery-v2';
const NICHE_PAIN: Record<string, { fr: string; en: string }> = {
  auto: { fr: 'quand vous êtes à l’atelier sur une voiture', en: 'when you are working on a vehicle' },
  home_services: { fr: 'quand vous êtes en intervention chez un client', en: 'when you are on a job' },
  salon: { fr: 'pendant une prestation avec un client', en: 'while serving a client' },
  financial: { fr: 'pendant les rendez-vous et les périodes chargées', en: 'during appointments and busy periods' },
  dental: { fr: 'pendant les consultations', en: 'during consultations' },
  restaurant: { fr: 'pendant le service', en: 'during service' },
};
function buildSystemPrompt(language: 'en' | 'fr'): string {
  if (language === 'fr') return `Tu écris un SCRIPT D'AIDE À LA VENTE lu par le fondateur HUMAIN de Qwillio à un responsable de PME belge ou française.
IMPORTANT : ne te présente JAMAIS comme une réceptionniste IA ou comme "Marie". L'appelant est une personne de Qwillio, pas l'agent qui répondra aux clients.
Objectif : découvrir un besoin réel d'appels manqués puis obtenir la permission de faire tester une démo téléphonique de 2 minutes, éventuellement proposer un essai de 7 jours si l'offre le permet.
Structure : permission d'une question rapide, question ouverte sur les appels manqués, [Écouter], reformulation conditionnelle, explication très simple du résultat, proposition de démo. Ne présume jamais qu'ils manquent des appels. Si pas de besoin, remercie et termine poliment.
Style : naturel, chaleureux, sans jargon ni monologue, phrases courtes, vouvoiement, pas de pression.
Ne fais AUCUNE affirmation invérifiable : ni statistiques inventées, ni promesse de zéro appel manqué, ni retour sur investissement garanti, ni tarif ou essai présenté comme contractuellement garanti. Prix à discuter après la démo.
Respecte toute opposition au démarchage ; ne propose pas de relance si la personne refuse.
Format JSON strict avec intro, painPoint, pitch, cta, objectionHandlers (voicemail, cost, think_about_it, already_have_receptionist, not_interested) et rawFull. `;
  return `Write a HUMAN founder-led B2B discovery call script for Qwillio. The caller is a real person, never an AI receptionist. Ask permission, diagnose missed calls without assuming a problem, listen, offer a 2-minute phone demo only if relevant. Short, respectful, natural sentences; no fabricated statistics, promises, pressure, or guaranteed prices. Honor opt-outs. Return strict JSON: intro, painPoint, pitch, cta, objectionHandlers (voicemail, cost, think_about_it, already_have_receptionist, not_interested), rawFull.`;
}
function buildUserPrompt(ctx: ScriptContext): string {
  const nicheLabel = NICHE_LABELS[ctx.niche] ?? ctx.niche;
  const context = NICHE_PAIN[ctx.niche] || { fr: 'quand votre équipe est occupée', en: 'when your team is busy' };
  if (ctx.language === 'fr') return `Entreprise : ${ctx.businessName} ; secteur : ${nicheLabel} ; ville : ${ctx.city}. Situation potentielle : ${context.fr}.
Génère un JSON avec ces champs exacts : intro, painPoint, pitch, cta, objectionHandlers {voicemail,cost,think_about_it,already_have_receptionist,not_interested}, rawFull.
Le script est prononcé par un fondateur HUMAIN de Qwillio. Intro suggérée : "Bonjour, je suis de Qwillio, un service belge. Est-ce que je peux vous poser une question rapide ?"
Question clé : "Quand vous êtes occupés, comment gérez-vous les appels auxquels personne ne peut répondre ?" Puis [Écouter].
Pitch uniquement SI besoin identifié : "Qwillio peut répondre aux appels, noter la demande et vous transmettre les informations." Adapter prudemment au secteur sans inventer de fonctionnalité.
CTA : "Vous voulez appeler notre démo deux minutes pour voir si ça pourrait vous servir ?"
Objections : messagerie, prix, réflexion, secrétaire existante, refus. Refus = remercier et arrêter. Pas de statistiques inventées ni de promesses absolues.`;
  return `Business: ${ctx.businessName}; industry: ${nicheLabel}; city: ${ctx.city}. Potential situation: ${context.en}. Caller: HUMAN Qwillio founder. Generate strict JSON fields intro, painPoint, pitch, cta, objectionHandlers {voicemail,cost,think_about_it,already_have_receptionist,not_interested}, rawFull. Ask permission, ask what happens to unanswered calls, [Listen], pitch only if problem confirmed, offer 2-minute demo. Respect refusal; no fabricated claims.`;
}
function buildFallbackScript(ctx: ScriptContext): GeneratedScript {
  const fr = ctx.language === 'fr';
  const scenario = NICHE_PAIN[ctx.niche] || { fr: 'quand vous êtes occupés', en: 'when you are busy' };
  if (fr) {
    const intro = 'Bonjour, je suis de Qwillio, un service belge. Je peux vous poser une question rapide ?';
    const painPoint = `Chez ${ctx.businessName}, comment gérez-vous les appels quand vous ne pouvez pas décrocher, par exemple ${scenario.fr} ?`;
    const pitch = 'Si vous perdez parfois des demandes, Qwillio peut répondre à votre place, recueillir les informations et vous les transmettre.';
    const cta = 'Ça vous dirait d’appeler notre numéro de démonstration pendant deux minutes pour juger par vous-même ?';
    return { intro, painPoint, pitch, cta, objectionHandlers: {
      voicemail: 'La messagerie peut suffire. Est-ce que vos clients laissent généralement un message ? Si oui, inutile de changer.',
      cost: 'Je comprends. Avant de parler de prix, voyons si le service vous serait vraiment utile. Une courte démo vous conviendrait ?',
      think_about_it: 'Bien sûr. Souhaitez-vous que je vous envoie les informations, ou préférez-vous en rester là ?',
      already_have_receptionist: 'Très bien. Est-ce que votre équipe est aussi couverte pendant les débordements ou après la fermeture ? Sinon, aucun souci.',
      not_interested: 'Je comprends, merci pour votre temps. Bonne journée.',
    }, rawFull: `${intro}\n[Écouter]\n${painPoint}\n[Écouter — ne présenter la solution que si le besoin est confirmé]\n${pitch}\n${cta}\n[Écouter — respecter tout refus]` };
  }
  const intro = 'Hello, I’m calling from Qwillio. May I ask one quick question?';
  const painPoint = `At ${ctx.businessName}, what happens to incoming calls ${scenario.en}?`;
  const pitch = 'If unanswered calls are a problem, Qwillio can answer, capture the request and send the details to you.';
  const cta = 'Would you like to call our demo number for two minutes and see if it fits?';
  return { intro, painPoint, pitch, cta, objectionHandlers: {
    voicemail: 'Voicemail may work well for you. Do most callers leave a message?',
    cost: 'Fair question. First, let’s see if it solves a real problem. Would a quick demo help?',
    think_about_it: 'Of course. Would you like some information, or shall I leave it there?',
    already_have_receptionist: 'Great. Do you ever need overflow or after-hours coverage?',
    not_interested: 'Understood. Thanks for your time.',
  }, rawFull: `${intro}\n[Listen]\n${painPoint}\n[Listen — only pitch if a real need emerges]\n${pitch}\n${cta}\n[Listen — respect any refusal]` };
}

// ─── Main service ─────────────────────────────────────────

export class AiScriptGeneratorService {
  private readonly OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly MODEL = 'gpt-4o-mini'; // cost-efficient for script generation

  /** Generate (or return cached) a script for the given context */
  async generateScript(ctx: ScriptContext): Promise<GeneratedScript> {
    const language = ctx.language ?? 'en';
    // The business name and city are written into the generated copy, so they
    // have to be part of the key. Caching on niche+language alone meant the
    // first business scripted in a niche had its name and city handed to every
    // other prospect in that niche.
    const cacheKey = `${SCRIPT_VERSION}:${ctx.niche}:${language}:${ctx.businessName}:${ctx.city ?? ''}`;

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
