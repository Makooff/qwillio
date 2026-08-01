import type { VoiceLanguage } from './speech-plans';

/**
 * Intent router (Phase 3).
 *
 * Roughly a third of the turns in a receptionist call carry no information:
 * "hmm", "ok", "oui voilà", "sorry, say that again?", plus the caller's opening
 * "hello". Sending those to GPT-4o costs a full prompt replay — the entire
 * system prompt and conversation history — to produce four words back, and adds
 * a network round-trip to a turn the caller expects to be instant.
 *
 * This module classifies an utterance with deterministic rules and returns a
 * canned reply when it is safe to do so. Anything that could carry business
 * meaning escalates to the model. The bias is deliberately conservative: a
 * false escalation costs tokens, a false short-circuit costs a bad call.
 */

export type IntentKind =
  /** "mhm", "ok", "d'accord" — caller is just acknowledging. */
  | 'backchannel'
  /** "hello?", "are you there?" — caller is checking the line. */
  | 'presence_check'
  /** "sorry?", "pardon?" — caller did not hear, repeat the last line. */
  | 'repeat_request'
  /** "thanks, bye" — closing the call. */
  | 'farewell'
  /** Empty or unintelligible audio. */
  | 'noise'
  /** Needs the model. */
  | 'reasoning';

export interface IntentDecision {
  kind: IntentKind;
  /** True when the turn can be answered without calling the LLM. */
  handledLocally: boolean;
  /** Canned reply to speak, when `handledLocally`. Empty string = stay silent. */
  reply: string;
  /** Why the router decided this — logged for tuning, never spoken. */
  reason: string;
  /**
   * The utterance carries explicit business intent (booking, pricing, a
   * complaint). Consumers use this to decide which model tier a turn deserves —
   * the router itself stays model-agnostic.
   */
  businessIntent: boolean;
  /** Length of the normalised utterance, for the same tiering decision. */
  wordCount: number;
}

/**
 * Utterances that are pure acknowledgement. Matched on the WHOLE normalised
 * utterance, never as a substring: "ok" is a backchannel, "ok can I book for
 * Tuesday" is not.
 */
const BACKCHANNEL: Record<VoiceLanguage, string[]> = {
  fr: [
    'hm', 'hmm', 'mhm', 'mmh', 'euh', 'ah', 'ah oui', 'ok', 'okay', 'd accord',
    'daccord', 'tres bien', 'parfait', 'super', 'oui', 'ouais', 'ouai', 'voila',
    'exactement', 'je vois', 'bien sur', 'entendu', 'nickel', 'ca marche',
  ],
  en: [
    'hm', 'hmm', 'mhm', 'mm', 'uh', 'uh huh', 'ah', 'oh', 'ok', 'okay', 'k',
    'right', 'sure', 'yeah', 'yep', 'yes', 'got it', 'i see', 'gotcha',
    'perfect', 'great', 'cool', 'alright', 'sounds good', 'exactly',
  ],
};

const PRESENCE_CHECK: Record<VoiceLanguage, string[]> = {
  fr: ['allo', 'allo allo', 'vous etes la', 'vous m entendez', 'il y a quelqu un', 'bonjour'],
  en: ['hello', 'hello hello', 'are you there', 'can you hear me', 'anyone there', 'hi'],
};

const REPEAT_REQUEST: Record<VoiceLanguage, string[]> = {
  fr: ['pardon', 'comment', 'quoi', 'repetez', 'vous pouvez repeter', 'j ai pas compris', 'je n ai pas compris', 'excusez moi'],
  en: ['sorry', 'pardon', 'what', 'come again', 'say that again', 'can you repeat that', 'i didn t catch that', 'excuse me'],
};

const FAREWELL: Record<VoiceLanguage, string[]> = {
  fr: ['au revoir', 'merci au revoir', 'bonne journee', 'bonne soiree', 'a bientot', 'salut', 'merci bonne journee'],
  en: ['bye', 'goodbye', 'bye bye', 'thanks bye', 'have a good day', 'have a nice day', 'take care', 'that s all thanks'],
};

/**
 * Words that force an escalation even inside a short utterance. If any of these
 * appear, the turn carries business intent and the model must see it — this is
 * the guard that keeps "ok book it" from being answered with "mhm".
 */
const ESCALATE_MARKERS =
  /\b(rendez[- ]?vous|rdv|reserv|dispo|disponib|annul|reporte|horaire|ouvert|ferme|prix|tarif|devis|adresse|urgen|probleme|commande|livraison|factur|rembours|parler|transfer|responsable|book|booking|appointment|schedul|availab|cancel|reschedul|open|close|hours|price|quote|cost|address|urgent|emergency|order|deliver|invoic|refund|speak|manager|human)\w*/i;

/** Canned replies. Kept short — a long canned line reads as robotic. */
const REPLIES: Record<VoiceLanguage, Record<Exclude<IntentKind, 'reasoning'>, string[]>> = {
  fr: {
    backchannel: [''], // stay silent, let the caller continue
    presence_check: ['Oui, je vous écoute.', 'Oui, je suis là, je vous écoute.'],
    repeat_request: ['Bien sûr, je répète.', 'Pas de souci, je reprends.'],
    farewell: ['Merci pour votre appel, très bonne journée.', 'Avec plaisir, bonne journée à vous.'],
    noise: [''],
  },
  en: {
    backchannel: [''],
    presence_check: ['Yes, I\'m here. Go ahead.', 'Yes, I\'m listening.'],
    repeat_request: ['Of course, let me repeat that.', 'No problem, I\'ll say it again.'],
    farewell: ['Thanks for calling, have a great day.', 'My pleasure, have a good one.'],
    noise: [''],
  },
};

/**
 * Strip accents, punctuation and filler so "D'accord !" and "daccord" collapse
 * to the same key. Apostrophes become spaces rather than being deleted, which
 * keeps "j'ai" as two tokens and matches how the phrase lists are written.
 */
export function normalizeUtterance(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)] ?? '';
}

function matches(list: string[], utterance: string): boolean {
  return list.includes(utterance);
}

/**
 * Classify one caller utterance.
 *
 * @param raw   The final transcript for the turn.
 * @param lang  Assistant language — the phrase lists are language-specific.
 * @param opts.turnIndex  0 for the caller's first words. The opening "hello" is
 *   a presence check; the same word mid-call after a pause is not worth a
 *   canned answer, so it escalates.
 */
export function routeIntent(
  raw: string,
  lang: VoiceLanguage,
  opts: { turnIndex?: number } = {}
): IntentDecision {
  const utterance = normalizeUtterance(raw);
  const turnIndex = opts.turnIndex ?? 0;

  const words = utterance ? utterance.split(' ') : [];
  const businessIntent = ESCALATE_MARKERS.test(utterance);
  const base = { businessIntent, wordCount: words.length };

  if (!utterance) {
    return { kind: 'noise', handledLocally: true, reply: '', reason: 'empty transcript', ...base };
  }

  // Any business marker wins over every short-circuit below.
  if (businessIntent) {
    return { kind: 'reasoning', handledLocally: false, reply: '', reason: 'business marker present', ...base };
  }

  // Long utterances are never small talk. The threshold is low on purpose:
  // beyond ~5 words a caller is making a request, not acknowledging.
  if (words.length > 5) {
    return { kind: 'reasoning', handledLocally: false, reply: '', reason: 'utterance too long for a canned reply', ...base };
  }

  if (matches(REPEAT_REQUEST[lang], utterance)) {
    // The repeat itself needs the conversation state, so the model still runs —
    // but we speak the acknowledgement immediately so the caller is not left
    // hanging while it does.
    return {
      kind: 'repeat_request',
      handledLocally: false,
      reply: pick(REPLIES[lang].repeat_request),
      reason: 'caller asked for a repeat — acknowledge locally, model restates',
      ...base,
    };
  }

  if (matches(FAREWELL[lang], utterance)) {
    return {
      kind: 'farewell',
      handledLocally: true,
      reply: pick(REPLIES[lang].farewell),
      reason: 'closing phrase',
      ...base,
    };
  }

  if (turnIndex === 0 && matches(PRESENCE_CHECK[lang], utterance)) {
    return {
      kind: 'presence_check',
      handledLocally: true,
      reply: pick(REPLIES[lang].presence_check),
      reason: 'opening greeting / line check',
      ...base,
    };
  }

  if (matches(BACKCHANNEL[lang], utterance)) {
    return {
      kind: 'backchannel',
      handledLocally: true,
      reply: pick(REPLIES[lang].backchannel),
      reason: 'acknowledgement only',
      ...base,
    };
  }

  return { kind: 'reasoning', handledLocally: false, reply: '', reason: 'no deterministic rule matched', ...base };
}

/**
 * Token accounting for the ROI digest: what a short-circuited turn would have
 * cost. Based on the measured average receptionist turn — full system prompt
 * plus history replayed as input, a short completion out.
 */
export const AVG_TURN_TOKENS = { input: 1_450, output: 38 };

export function estimateTokensSaved(decisions: IntentDecision[]): number {
  return decisions.filter(d => d.handledLocally).length * (AVG_TURN_TOKENS.input + AVG_TURN_TOKENS.output);
}
