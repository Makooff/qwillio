import { normalizeUtterance } from './intent-router';
import type { VoiceLanguage } from './speech-plans';

/**
 * Live caller mood (chantier 6).
 *
 * Sentiment is currently computed after the call, from the full transcript,
 * which makes it useful for reporting and useless for the conversation itself.
 * By the time we know the caller was furious, they have hung up.
 *
 * This detects mood from the first turns, deterministically. Not a model call:
 * a mood classifier in the audio path would add the exact latency that makes
 * angry callers angrier, and it would be running on every turn to change at
 * most one paragraph of the prompt.
 *
 * The output changes how the agent talks, never what it is allowed to do. An
 * annoyed caller does not get different booking rules — they get shorter
 * sentences, no cheerfulness, and an earlier offer of a human.
 */

export type CallerMood = 'neutral' | 'rushed' | 'upset';

export interface MoodAssessment {
  mood: CallerMood;
  /** Which signals fired, for tuning. Never spoken. */
  signals: string[];
}

/**
 * Anger and frustration. These are the words people use when they have already
 * been let down — deliberately including the polite-but-cold register
 * ("inadmissible", "unacceptable"), which is what an upset professional says
 * instead of swearing.
 */
const UPSET_MARKERS: Record<VoiceLanguage, RegExp> = {
  fr: /\b(inadmissible|inacceptable|scandaleux|honteux|ras le bol|marre|enerve|enervee|furieux|furieuse|colere|plainte|reclamation|jamais rappele|personne ne repond|troisieme fois|deuxieme fois|encore une fois|toujours pas|resilier|avocat|rembours)\w*/,
  en: /\b(unacceptable|ridiculous|outrageous|fed up|furious|angry|upset|complaint|complain|third time|second time|again|still no|nobody answers|never called back|cancel my|lawyer|refund)\w*/,
  nl: /\b(onaanvaardbaar|schandalig|belachelijk|beu|boos|kwaad|woedend|klacht|derde keer|tweede keer|alweer|nog steeds niet|niemand neemt op|nooit teruggebeld|opzeggen|advocaat|terugbetal)\w*/,
};

/** Time pressure. Different problem, different fix: brevity, not apology. */
const RUSHED_MARKERS: Record<VoiceLanguage, RegExp> = {
  fr: /\b(vite|rapidement|urgent|urgence|presse|pressee|pas le temps|deux minutes|je conduis|je suis en reunion|faites vite)\w*/,
  en: /\b(quick|quickly|hurry|urgent|emergency|in a rush|no time|two minutes|i m driving|in a meeting|make it fast)\w*/,
  nl: /\b(snel|vlug|dringend|spoed|haast|geen tijd|twee minuten|ik rijd|ik zit in een vergadering|maak het kort)\w*/,
};

/** Turns after which mood stops being re-evaluated. */
const ASSESSMENT_WINDOW_TURNS = 3;

/**
 * Assess one utterance. `previous` lets mood escalate but never silently
 * de-escalate mid-call: a caller who opened angry stays handled carefully even
 * if their third sentence is neutral, because the anger has not been resolved,
 * only paused.
 */
export function assessMood(
  utterance: string,
  lang: VoiceLanguage,
  turnIndex: number,
  previous: CallerMood = 'neutral',
): MoodAssessment {
  if (turnIndex > ASSESSMENT_WINDOW_TURNS) return { mood: previous, signals: [] };

  const text = normalizeUtterance(utterance);
  const signals: string[] = [];

  if (UPSET_MARKERS[lang].test(text)) signals.push('upset_marker');
  if (RUSHED_MARKERS[lang].test(text)) signals.push('rushed_marker');

  // Repetition of the same request is itself a frustration signal even without
  // a single angry word: "j'ai déjà appelé" carries it.
  if (/\b(deja|already)\b/.test(text) && /\b(appel|call|demand|ask)\w*/.test(text)) {
    signals.push('repeat_contact');
  }

  const detected: CallerMood = signals.includes('upset_marker') || signals.includes('repeat_contact')
    ? 'upset'
    : signals.includes('rushed_marker')
      ? 'rushed'
      : 'neutral';

  // Escalate only. Upset outranks rushed outranks neutral.
  const rank: Record<CallerMood, number> = { neutral: 0, rushed: 1, upset: 2 };
  const mood = rank[detected] > rank[previous] ? detected : previous;

  return { mood, signals };
}

/**
 * The prompt fragment for a mood. Empty for neutral — the base prompt already
 * describes the default register, and repeating it would just cost tokens on
 * every turn of every call.
 */
export function moodPromptBlock(mood: CallerMood, lang: VoiceLanguage): string {
  if (mood === 'neutral') return '';
  const fr = lang === 'fr';

  if (mood === 'upset') {
    return fr
      ? [
          'ETAT DU CORRESPONDANT: mecontent.',
          '- Phrases courtes. Aucun enthousiasme, aucune formule commerciale.',
          '- Reconnais le probleme une fois, sans t\'excuser en boucle.',
          '- Ne demande pas d\'informations deja donnees.',
          '- Propose le transfert vers un humain des que c\'est pertinent.',
        ].join('\n')
      : [
          'CALLER STATE: unhappy.',
          '- Short sentences. No enthusiasm, no sales language.',
          '- Acknowledge the problem once; do not keep apologising.',
          '- Do not ask for anything they already told you.',
          '- Offer a transfer to a human as soon as it is relevant.',
        ].join('\n');
  }

  return fr
    ? [
        'ETAT DU CORRESPONDANT: presse.',
        '- Va droit au but. Une phrase par tour maximum.',
        '- Ne propose pas d\'options superflues, propose la plus probable.',
        '- Pas de bavardage de politesse.',
      ].join('\n')
    : [
        'CALLER STATE: in a hurry.',
        '- Get to the point. One sentence per turn at most.',
        '- Do not offer extra options; offer the most likely one.',
        '- Skip the pleasantries.',
      ].join('\n');
}
