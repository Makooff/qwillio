/**
 * Vapi Assistant Templates — 12 total (6 niches × 2 languages)
 * Ashley = English ONLY | Marie = French ONLY
 */

export const VOICE_CONFIG = {
  ashley: {
    name: 'Ashley',
    language: 'en',
    voiceId: '21m00Tcm4TlvDq8ikWAM', // ElevenLabs Rachel
    model: 'eleven_turbo_v2_5',
    stability: 0.45,
    similarityBoost: 0.82,
    style: 0.35,
    speakerBoost: true,
    latency: 4,
    endpointing: 200,
    backgroundSound: 'office',
    fillerInjection: true,
    targetLatencyMs: 800,
  },
  marie: {
    name: 'Marie',
    language: 'fr',
    voiceId: 'pFZP5JQG7iQjIQuC4Bku', // ElevenLabs Amélie
    model: 'eleven_turbo_v2_5',
    stability: 0.38,
    similarityBoost: 0.78,
    style: 0.45,
    speakerBoost: true,
    latency: 4,
    endpointing: 150,
    vadSensitivity: 'maximum',
    streamingTts: true,
    fillerInjection: true, // "Euh" / "Mmh" / "Ouais" / "Ah"
    targetLatencyMs: 600,
    backgroundSound: 'office',
  },
} as const;

// Language detection by phone country code
const QUEBEC_AREA_CODES = ['418', '438', '450', '514', '579', '581', '819', '873'];

export function detectLanguage(phoneNumber: string): 'en' | 'fr' {
  const cleaned = phoneNumber.replace(/\D/g, '');

  // +33 France
  if (cleaned.startsWith('33')) return 'fr';
  // +32 Belgium
  if (cleaned.startsWith('32')) return 'fr';
  // +1 Quebec area codes
  if (cleaned.startsWith('1') && cleaned.length >= 4) {
    const areaCode = cleaned.substring(1, 4);
    if (QUEBEC_AREA_CODES.includes(areaCode)) return 'fr';
  }
  // +44 UK → English
  // +1 US/CA standard → English
  // Default → English
  return 'en';
}

export function getAgentName(language: 'en' | 'fr'): string {
  return language === 'fr' ? 'Marie' : 'Ashley';
}

export type Niche = 'dental' | 'medical' | 'law' | 'salon' | 'restaurant' | 'garage' | 'hotel';

const NICHE_FOLLOW_UP_TIMES: Record<Niche, number> = {
  dental: 9,
  restaurant: 14,
  law: 11,
  salon: 10,
  garage: 8,
  hotel: 14,
  medical: 9,
};

export function getNicheFollowUpHour(niche: Niche): number {
  return NICHE_FOLLOW_UP_TIMES[niche] || 10;
}

// Formality rules for Marie (French)
const FORMAL_NICHES: Niche[] = ['law', 'medical', 'hotel'];
const INFORMAL_NICHES: Niche[] = ['salon', 'restaurant', 'garage'];

function getFrenchFormality(niche: Niche): 'tu' | 'vous' {
  if (FORMAL_NICHES.includes(niche)) return 'vous';
  if (INFORMAL_NICHES.includes(niche)) return 'tu';
  return 'vous'; // default formal
}

// ═══════════════════════════════════════════
// SYSTEM PROMPT GENERATORS
// ═══════════════════════════════════════════

function generateAshleySystemPrompt(niche: Niche, businessName: string, services: string[], faq: Record<string, string>): string {
  const faqBlock = Object.entries(faq)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join('\n\n');

  return `You are Ashley, the AI receptionist for ${businessName}, a ${niche} business.

CORE RULES:
- Never reveal you are AI. You are Ashley, the receptionist.
- Be warm, professional, and helpful.
- Your goal: answer questions, book appointments, take messages, transfer urgent calls.
- Keep responses concise (under 20 words when possible).
- Use natural speech patterns with occasional fillers like "sure", "absolutely", "of course".

BUSINESS INFO:
- Business: ${businessName}
- Industry: ${niche}
- Services: ${services.join(', ')}

FAQ:
${faqBlock || 'No FAQ configured yet.'}

CALL HANDLING:
- If caller wants to book: collect name, phone, preferred date/time, reason for visit.
- If caller has emergency: transfer immediately to the business line.
- If outside hours: take a message with name, phone, and brief reason.
- If caller asks price: provide general range if known, suggest booking a consultation.

TONE: Professional yet warm. Like a real receptionist who's been with the company for years.`;
}

function generateMarieSystemPrompt(niche: Niche, businessName: string, services: string[], faq: Record<string, string>): string {
  const formality = getFrenchFormality(niche);
  const pronoun = formality === 'tu' ? 'tu/toi' : 'vous';

  const faqBlock = Object.entries(faq)
    .map(([q, a]) => `Q: ${q}\nR: ${a}`)
    .join('\n\n');

  return `Tu es Marie, la réceptionniste IA de ${businessName}, un commerce de type ${niche}.

RÈGLES FONDAMENTALES:
- Ne jamais révéler que tu es une IA. Tu es Marie, la réceptionniste.
- Utilise le ${formality} (${pronoun}) avec les interlocuteurs.
- Sois chaleureuse, naturelle et serviable.
- Objectif : répondre aux questions, prendre rendez-vous, prendre des messages, transférer les urgences.
- Réponses courtes (moins de 20 mots quand possible).
- Parle naturellement avec des expressions comme "du coup", "voilà", "ben", "bah".
- Utilise des micro-hésitations naturelles : "euh", "mmh", "ah".
- Fais les liaisons et élisions naturelles du français parlé.

INFOS BUSINESS:
- Entreprise : ${businessName}
- Secteur : ${niche}
- Services : ${services.join(', ')}

FAQ:
${faqBlock || 'Pas de FAQ configurée.'}

GESTION DES APPELS:
- Prise de rendez-vous : collecte nom, téléphone, date/heure souhaitée, motif.
- Urgence : transfert immédiat vers la ligne du commerce.
- Hors horaires : message avec nom, téléphone et motif bref.
- Questions de prix : fourchette générale si connue, sinon proposer un rendez-vous.

TON: Naturel et chaleureux. Comme une vraie réceptionniste qui connaît bien l'entreprise.
${formality === 'tu' ? "Tutoie naturellement, c'est un commerce décontracté." : "Vouvoie par respect, c'est un cabinet/établissement professionnel."}`;
}

// ═══════════════════════════════════════════
// VAPI ASSISTANT TEMPLATE BUILDER
// ═══════════════════════════════════════════

export function buildVapiAssistantConfig(params: {
  language: 'en' | 'fr';
  niche: Niche;
  businessName: string;
  services: string[];
  faq: Record<string, string>;
  transferNumber?: string;
  maxDuration?: number;
}) {
  const voice = params.language === 'fr' ? VOICE_CONFIG.marie : VOICE_CONFIG.ashley;
  const agentName = getAgentName(params.language);
  const systemPrompt = params.language === 'fr'
    ? generateMarieSystemPrompt(params.niche, params.businessName, params.services, params.faq)
    : generateAshleySystemPrompt(params.niche, params.businessName, params.services, params.faq);

  return {
    name: `${agentName} — ${params.businessName}`,
    voice: {
      provider: 'elevenlabs' as const,
      voiceId: voice.voiceId,
      model: voice.model,
      stability: voice.stability,
      similarityBoost: voice.similarityBoost,
      style: voice.style,
      useSpeakerBoost: voice.speakerBoost,
    },
    model: {
      provider: 'openai' as const,
      model: 'gpt-4-turbo' as const,
      messages: [{ role: 'system' as const, content: systemPrompt }],
      temperature: 0.7,
      maxTokens: 150,
    },
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: params.maxDuration || 300,
    endCallAfterSilenceMs: 5000,
    backgroundSound: voice.backgroundSound,
    firstMessage: params.language === 'fr'
      ? `${params.businessName}, bonjour ! C'est Marie, comment je peux vous aider ?`
      : `Thank you for calling ${params.businessName}, this is Ashley. How can I help you today?`,
    endCallMessage: params.language === 'fr'
      ? 'Merci pour votre appel, bonne journée !'
      : 'Thank you for calling, have a great day!',
    ...(params.transferNumber && {
      forwardingPhoneNumber: params.transferNumber,
    }),
  };
}

// All 12 templates (6 niches × 2 languages)
export const NICHES: Niche[] = ['dental', 'medical', 'law', 'salon', 'restaurant', 'garage', 'hotel'];

export function generateAllTemplates(businessName: string = 'Demo Business') {
  const templates: Array<{ niche: Niche; language: 'en' | 'fr'; config: ReturnType<typeof buildVapiAssistantConfig> }> = [];

  for (const niche of NICHES) {
    for (const language of ['en', 'fr'] as const) {
      templates.push({
        niche,
        language,
        config: buildVapiAssistantConfig({
          language,
          niche,
          businessName,
          services: [],
          faq: {},
        }),
      });
    }
  }

  return templates;
}
