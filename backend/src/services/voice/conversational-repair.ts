import type { VoiceLanguage } from './speech-plans';

/**
 * Conversational repair — what the agent says after being cut off, and how it
 * handles silence (chantiers 3 and 5).
 *
 * Both are the same class of problem: the conversation broke its rhythm, and a
 * human says something small to put it back. The agent currently says nothing,
 * which is what makes an interruption feel like a crash and a pause feel like a
 * dropped line.
 *
 * The hard rule in here is restraint. A recovery line on EVERY interruption is
 * worse than silence — it turns a natural overlap into a stilted exchange of
 * apologies. So the line fires only when the interruption actually broke
 * something, and never twice in a row.
 */

/** Said after the caller cuts off a substantive utterance. */
const RECOVERY: Record<VoiceLanguage, string[]> = {
  fr: ['Pardon, allez-y.', 'Je vous en prie.', 'Oui, je vous écoute.'],
  en: ['Sorry, go ahead.', 'Please, go on.', 'Yes, I\'m listening.'],
  nl: ['Sorry, gaat u verder.', 'Zegt u maar.', 'Ja, ik luister.'],
};

/** Said when the line has been quiet and the caller may think it dropped. */
const SILENCE_NUDGE: Record<VoiceLanguage, string[]> = {
  fr: ['Vous êtes toujours là ?', 'Vous m\'entendez ?'],
  en: ['Are you still there?', 'Can you still hear me?'],
  nl: ['Bent u er nog?', 'Hoort u mij nog?'],
};

/**
 * Turns since the last recovery line before another may fire. Two consecutive
 * apologies read as nervousness, not politeness.
 */
const RECOVERY_COOLDOWN_TURNS = 3;
/** Never say it more than this per call, however choppy the conversation. */
const MAX_RECOVERIES_PER_CALL = 2;

export interface RepairState {
  /** Caller turn index at which the last recovery line was spoken. */
  lastRecoveryTurn: number;
  recoveryCount: number;
}

export function newRepairState(): RepairState {
  return { lastRecoveryTurn: -Infinity, recoveryCount: 0 };
}

function pick(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)] ?? '';
}

/**
 * Decide whether to speak a recovery line after an interruption.
 *
 * @param isHard      The interruption cut a real sentence, not a backchannel.
 * @param currentTurn Caller turn index, for the cooldown.
 * @returns The line to speak, or null to stay silent — which is the default.
 */
export function recoveryLine(
  state: RepairState,
  isHard: boolean,
  currentTurn: number,
  lang: VoiceLanguage,
): string | null {
  // Cutting off an "mm-hmm" is not an interruption. Apologising for it would
  // draw attention to something the caller did not even notice.
  if (!isHard) return null;
  if (state.recoveryCount >= MAX_RECOVERIES_PER_CALL) return null;
  if (currentTurn - state.lastRecoveryTurn < RECOVERY_COOLDOWN_TURNS) return null;

  state.lastRecoveryTurn = currentTurn;
  state.recoveryCount++;
  return pick(RECOVERY[lang]);
}

export function silenceNudge(lang: VoiceLanguage): string {
  return pick(SILENCE_NUDGE[lang]);
}

/**
 * Vapi's message plan for an idle line (chantier 5).
 *
 * `VAPI_SILENCE_TIMEOUT` is the hang-up deadline and stays where it is. This is
 * the separate, much earlier nudge: by ten seconds the caller has already
 * concluded the line dropped, so the useful moment is around four. Nudging is
 * not hanging up, and conflating the two is why the agent used to sit silent
 * until it gave up.
 *
 * The field names are Vapi's, not ours: `messages` / `timeoutSeconds` / `count`
 * were rejected outright ("messagePlan.property messages should not exist"),
 * which killed every call for the client whose settings had just been saved.
 * The bounds are Vapi's too — 5 s is the floor it accepts, so the nudge lands
 * there even though four would be better.
 */
const IDLE_TIMEOUT_MIN = 5;
const IDLE_TIMEOUT_MAX = 60;
const IDLE_COUNT_MIN = 1;
const IDLE_COUNT_MAX = 10;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function buildIdleMessagePlan(lang: VoiceLanguage, timeoutSeconds: number, maxCount: number) {
  return {
    idleMessages: SILENCE_NUDGE[lang],
    idleMessageMaxSpokenCount: clamp(maxCount, IDLE_COUNT_MIN, IDLE_COUNT_MAX),
    idleTimeoutSeconds: clamp(timeoutSeconds, IDLE_TIMEOUT_MIN, IDLE_TIMEOUT_MAX),
  };
}
