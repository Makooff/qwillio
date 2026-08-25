// Single validated writer for a client's receptionist configuration (the
// vapiConfig JSON blob). Both the settings form (updateMySettings) and the
// conversational assistant (assistant-chat) go through here so validation and
// the Vapi re-sync happen in exactly one place.

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { isValidCharacterId, CUSTOM_CHARACTER_ID } from '../config/voice-characters';
import { PERSONALITY_PROMPTS } from '../config/personalities';

export interface VapiConfigPatch {
  items?: Array<{ id?: string; category?: string; name?: string; price?: string }>;
  hours?: Record<string, unknown> | null;
  faq?: string;
  /**
   * La FAQ en questions/réponses séparées, plutôt qu'un bloc de texte libre.
   *
   * `faq` reste la forme que TOUT lit en aval (le prompt de l'assistant, la
   * sync Vapi, le chat). Elle n'est plus saisie: elle est rendue à partir de
   * ces entrées. Une seule source, donc, et la mise en forme cesse de dépendre
   * de la discipline du client à écrire « Q : » puis « R : ».
   */
  faqEntries?: Array<{ q?: string; a?: string }>;
  /**
   * Les champs nommés du métier, par identifiant de preset.
   *
   * Avant, tout ce qui n'était ni un service ni un horaire finissait dans une
   * zone de texte libre, et le client devait deviner ce que sa réceptionniste
   * avait besoin de savoir. Ici la question est posée (« Mutuelles acceptées »,
   * « Protocole d'urgence ») et la réponse est rangée sous son identifiant.
   */
  knowledge?: Record<string, unknown>;
  personalityPreset?: string;
  personalityNotes?: string;
  characterId?: string;
  /**
   * The voice the client chose for themselves. An override on top of the
   * character, not a character: null (or a blank voiceId) means "use the
   * character's own voice".
   */
  customVoice?: { voiceId?: string; name?: string; cloned?: boolean; provider?: string } | null;
  /** `11labs` ou `cartesia`; vide rend le client au réglage global. */
  ttsProvider?: string;
  /**
   * Quelle chaîne vocale sert cet agent.
   *
   * `auto` suit le réglage global, `realtime` force le parole-à-parole,
   * `classic` force la chaîne ElevenLabs. Réglable par compte, pour pouvoir
   * comparer les deux à l'oreille sans engager tous les clients d'un coup.
   */
  voiceMode?: 'auto' | 'realtime' | 'classic';
  /**
   * Par où partent les messages de la réceptionniste: SMS ou WhatsApp.
   *
   * `whatsapp` est une PRÉFÉRENCE, jamais une garantie: WhatsApp exige un
   * modèle approuvé par Meta pour chaque type de message, et un type sans
   * modèle retombe sur le SMS (voir `sms.service.ts`). Le client ne perd donc
   * jamais un message parce qu'il a coché cette case.
   */
  notificationChannel?: 'sms' | 'whatsapp';
}

const PERSONA_KEYS = new Set(Object.keys(PERSONALITY_PROMPTS));

export interface FaqEntry { q: string; a: string }

/**
 * Rendre les entrées en texte, dans la forme que le prompt lit déjà.
 *
 * C'est la seule écriture de `faq` quand des entrées existent: rien d'autre ne
 * doit la composer, sinon les deux formes divergent et personne ne sait
 * laquelle l'agent a réellement en tête.
 */
export function renderFaq(entries: FaqEntry[]): string {
  return entries
    .map(e => `Q : ${e.q}\nR : ${e.a}`)
    .join('\n\n')
    .slice(0, 8000);
}

/**
 * Relire un ancien bloc de texte comme des questions/réponses.
 *
 * Les clients existants ont tapé leur FAQ à la main, en suivant plus ou moins
 * l'exemple affiché. Sans cette lecture, passer à la forme structurée leur
 * présenterait une liste vide au-dessus d'un texte qu'ils ne verraient plus:
 * la donnée serait là, et perdue pour eux.
 *
 * Volontairement permissif sur le marqueur (Q, R, A, question, réponse, avec ou
 * sans accent, deux-points ou point). Ce qui précède la première question est
 * ignoré, et une réponse peut tenir sur plusieurs lignes.
 */
export function parseFaq(text: string): FaqEntry[] {
  if (typeof text !== 'string' || !text.trim()) return [];
  const isQ = (l: string) => /^\s*(q|question)\s*[:.\-)]/i.test(l);
  const isA = (l: string) => /^\s*(r|a|r[ée]ponse|answer)\s*[:.\-)]/i.test(l);
  const strip = (l: string) => l.replace(/^\s*[a-zé]+\s*[:.\-)]\s*/i, '').trim();

  const entries: FaqEntry[] = [];
  let current: FaqEntry | null = null;
  let inAnswer = false;

  for (const line of text.split('\n')) {
    if (isQ(line)) {
      if (current?.q) entries.push(current);
      current = { q: strip(line), a: '' };
      inAnswer = false;
    } else if (isA(line) && current) {
      current.a = strip(line);
      inAnswer = true;
    } else if (inAnswer && current && line.trim()) {
      current.a = `${current.a}\n${line.trim()}`.trim();
    }
  }
  if (current?.q) entries.push(current);
  // Une question sans réponse reste une question: le client la voit et la
  // complète. La jeter serait effacer ce qu'il a écrit.
  return entries.filter(e => e.q);
}

/**
 * Merge a validated patch into an existing vapiConfig object. Pure — no I/O —
 * so it can be unit-tested and reused. Unknown/invalid values are dropped or
 * clamped; only keys present in `patch` are touched.
 */
export function buildVapiConfigPatch(
  prev: Record<string, any>,
  patch: VapiConfigPatch,
): Record<string, any> {
  const next: Record<string, any> = { ...prev };
  // Legacy free-text keys superseded by the structured fields.
  delete next.priceList;
  delete next.services;

  if (patch.items !== undefined) {
    const arr = Array.isArray(patch.items) ? patch.items : [];
    next.items = arr
      .slice(0, 200)
      .map((it: any) => ({
        id:       String(it?.id || Math.random().toString(36).slice(2, 10)),
        category: String(it?.category || 'service').slice(0, 40),
        name:     String(it?.name || '').trim().slice(0, 200),
        price:    String(it?.price || '').trim().slice(0, 80),
      }))
      // A nameless or priceless line is not a half-saved entry, it is a trap:
      // the receptionist reads the item list aloud and would announce a service
      // it cannot quote. The setup assistant is instructed to ask for the price
      // before saving, but an instruction is not a guarantee — this is.
      .filter((it: { name: string; price: string }) => it.name !== '' && it.price !== '');
  }
  if (patch.hours !== undefined) {
    next.hours = patch.hours && typeof patch.hours === 'object' && !Array.isArray(patch.hours)
      ? patch.hours
      : null;
  }
  if (patch.faq !== undefined) {
    next.faq = typeof patch.faq === 'string' ? patch.faq.slice(0, 8000) : '';
    // L'assistant conversationnel écrit encore la FAQ en texte. Sans cette
    // relecture, ses ajouts resteraient invisibles dans la liste du tableau de
    // bord, puis seraient écrasés par le premier enregistrement de celle-ci.
    // Les entrées postées explicitement corrigent ceci juste en dessous.
    next.faqEntries = parseFaq(next.faq);
  }
  // Après `faq`, et non avant: quand les deux arrivent ensemble, ce sont les
  // entrées qui font foi, et le texte rendu remplace celui qui a été posté.
  if (patch.faqEntries !== undefined) {
    const arr = Array.isArray(patch.faqEntries) ? patch.faqEntries : [];
    next.faqEntries = arr
      .slice(0, 60)
      .map((e: any) => ({
        q: String(e?.q ?? '').trim().slice(0, 300),
        a: String(e?.a ?? '').trim().slice(0, 1500),
      }))
      .filter((e: FaqEntry) => e.q !== '');
    next.faq = renderFaq(next.faqEntries);
  }
  if (patch.voiceMode !== undefined) {
    // Une valeur inconnue vaut `auto` plutôt que d'être écrite telle quelle:
    // une faute de frappe ne doit pas décider en silence de ce que l'appelant
    // entend, ni faire tomber un assistant refusé par Vapi.
    next.voiceMode = ['auto', 'realtime', 'classic'].includes(String(patch.voiceMode))
      ? patch.voiceMode
      : 'auto';
  }
  if (patch.notificationChannel !== undefined) {
    // Même règle que `voiceMode`: une valeur inconnue vaut le défaut sûr plutôt
    // que d'être écrite telle quelle.
    next.notificationChannel = patch.notificationChannel === 'whatsapp' ? 'whatsapp' : 'sms';
  }
  if (patch.knowledge !== undefined) {
    const src = patch.knowledge && typeof patch.knowledge === 'object' && !Array.isArray(patch.knowledge)
      ? patch.knowledge as Record<string, unknown>
      : {};
    const out: Record<string, string> = {};
    for (const key of Object.keys(src).slice(0, 40)) {
      // Les identifiants viennent des presets, donc d'un catalogue fermé. On
      // les borne quand même: la route est publique, et un client peut poster
      // ce qu'il veut.
      const id = key.replace(/[^A-Za-z0-9_]/g, '').slice(0, 60);
      if (!id) continue;
      const value = String(src[key] ?? '').trim().slice(0, 2000);
      if (value) out[id] = value;
    }
    next.knowledge = out;
  }
  if (patch.personalityPreset !== undefined) {
    const v = String(patch.personalityPreset || '');
    next.personalityPreset = PERSONA_KEYS.has(v) ? v : 'warm';
  }
  if (patch.personalityNotes !== undefined) {
    next.personalityNotes = typeof patch.personalityNotes === 'string'
      ? patch.personalityNotes.slice(0, 4000)
      : '';
    delete next.specialNotes; // legacy key superseded
  }
  if (patch.characterId !== undefined) {
    const v = String(patch.characterId || '');
    // The cloned voice is a valid selection but is not in the catalog: it has
    // no fixed voiceId, it lives per-tenant in the client's own config.
    if (isValidCharacterId(v) || v === CUSTOM_CHARACTER_ID) next.characterId = v;
  }
  if (patch.ttsProvider !== undefined) {
    /* Le fournisseur de synthèse, par client. Sert à comparer ElevenLabs et
       Cartesia sur le même compte, à l'oreille, sans redéployer entre deux
       appels. Une valeur vide efface le réglage et rend le client au défaut de
       la plateforme, ce qui doit rester possible en un clic. */
    const v = String(patch.ttsProvider || '');
    if (v === '11labs' || v === 'cartesia') next.ttsProvider = v;
    else delete next.ttsProvider;
  }
  if (patch.customVoice !== undefined) {
    const voiceId = String(patch.customVoice?.voiceId || '').trim();
    if (!voiceId) {
      // Deleted rather than set to null: readCustomVoice treats both as "no
      // override", and an absent key keeps the stored config honest.
      delete next.customVoice;
    } else {
      const prevVoice = (prev.customVoice || {}) as Record<string, unknown>;
      next.customVoice = {
        voiceId: voiceId.slice(0, 64),
        name: String(patch.customVoice?.name || prevVoice.name || 'Ma voix').slice(0, 80),
        // The date marks when this voice was chosen, so re-picking the same one
        // must not reset it.
        createdAt: prevVoice.voiceId === voiceId && typeof prevVoice.createdAt === 'string'
          ? prevVoice.createdAt
          : new Date().toISOString(),
        ...(patch.customVoice?.cloned === true ? { cloned: true } : {}),
        /* Le catalogue d'origine, validé contre une liste fermée: c'est un
           champ qui décide À QUI on envoie l'identifiant, donc une valeur
           inconnue ne doit pas s'y glisser. Absent = ElevenLabs, ce qu'étaient
           toutes les configurations écrites jusqu'ici. */
        ...(patch.customVoice?.provider === 'cartesia' ? { provider: 'cartesia' } : {}),
      };
    }
  }
  return next;
}

/**
 * Load the client's config, apply a validated patch, persist it, and re-sync
 * the Vapi assistant (best-effort). Returns the resulting merged config.
 */
export async function applyConfigPatch(
  clientId: string,
  patch: VapiConfigPatch,
): Promise<Record<string, any>> {
  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { vapiConfig: true, vapiAssistantId: true },
  });
  const prev = (existing?.vapiConfig as any) || {};
  const next = buildVapiConfigPatch(prev, patch);

  await prisma.client.update({
    where: { id: clientId },
    data: { vapiConfig: next },
  });

  if (existing?.vapiAssistantId) {
    try {
      const { onboardingService } = await import('./onboarding.service');
      await onboardingService.syncVapiAssistant(clientId);
    } catch (err) {
      logger.warn(`applyConfigPatch: Vapi sync failed for client ${clientId}:`, err);
    }
  }
  return next;
}
