import { logger } from '../../config/logger';
import { smsService } from '../sms.service';
import { callSessionStore, type CallSession } from './call-session.store';
import type { ClientVoiceProfile } from './realtime-context.service';
import type { VoiceLanguage } from './speech-plans';

/**
 * Warm transfer (chantier 10).
 *
 * Today the transfer is blind: the professional picks up knowing nothing, and
 * the caller repeats everything they just said — which is the moment the whole
 * "AI receptionist" promise unravels, because the agent demonstrably did not
 * hand anything over.
 *
 * A warm transfer carries three things across the bridge:
 *  1. a spoken summary to the operator, before the caller is connected;
 *  2. an SMS with the same facts, so it survives the operator not catching it;
 *  3. the caller's number, so a dropped transfer can still be called back.
 *
 * The summary is built from the in-memory transcript buffer, deterministically.
 * A GPT call here would sit between "I'll put you through" and the ring, with
 * both parties waiting on it — the one place in the call where a 700 ms model
 * round-trip is least affordable.
 */

/** Cap on the spoken summary: an operator stops listening past a few seconds. */
const MAX_SPOKEN_SUMMARY_CHARS = 260;
/** Last caller turns to mine for the reason. */
const TRANSCRIPT_WINDOW = 6;

export interface TransferBrief {
  callerName: string | null;
  callerNumber: string | null;
  reason: string;
  /** Spoken to the operator before the bridge. */
  spoken: string;
  /** Sent by SMS, allowed to be longer and to contain digits. */
  sms: string;
}

function clamp(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Pull the reason for the call out of the transcript.
 *
 * Caller turns only: the assistant's own words describe what IT did, not what
 * the caller wants, and summarising those back to the operator would relay the
 * agent's guesses as if they were the caller's request.
 */
function reasonFromTranscript(session: CallSession | null, lang: VoiceLanguage): string {
  if (!session?.transcript.length) {
    return lang === 'fr' ? 'Motif non precise.' : 'Reason not stated.';
  }
  const callerLines = session.transcript
    .filter(line => line.startsWith('Caller: '))
    .slice(-TRANSCRIPT_WINDOW)
    .map(line => line.slice('Caller: '.length).trim())
    .filter(Boolean);

  if (!callerLines.length) {
    return lang === 'fr' ? 'Motif non precise.' : 'Reason not stated.';
  }
  // Longest caller turn: on a receptionist call the substantive request is
  // almost always the longest thing they said, and the short ones are
  // acknowledgements.
  const longest = callerLines.reduce((a, b) => (b.length > a.length ? b : a));
  return clamp(longest, MAX_SPOKEN_SUMMARY_CHARS);
}

class WarmTransferService {
  /**
   * Build the brief for a transfer that is about to happen.
   *
   * Never throws and never awaits anything remote: it reads memory only, so it
   * cannot add latency to the bridge.
   */
  brief(profile: ClientVoiceProfile, vapiCallId: string | null): TransferBrief {
    const session = callSessionStore.get(vapiCallId);
    const fr = profile.language === 'fr';
    const name = session?.lead?.name ?? null;
    const number = session?.callerNumber ?? null;
    const reason = session?.lead?.reason?.trim() || reasonFromTranscript(session, profile.language);
    const mood = session?.mood ?? 'neutral';

    const who = name ?? (fr ? 'un correspondant' : 'a caller');
    // The operator is told the mood explicitly: walking into an angry call
    // unwarned is the difference between recovering it and losing it.
    const moodNote = mood === 'upset'
      ? (fr ? ' La personne est mecontente.' : ' They are unhappy.')
      : mood === 'rushed'
        ? (fr ? ' La personne est pressee.' : ' They are in a hurry.')
        : '';

    const spoken = clamp(
      fr
        ? `Transfert de ${who}. Motif : ${reason}.${moodNote}`
        : `Transferring ${who}. Reason: ${reason}.${moodNote}`,
      MAX_SPOKEN_SUMMARY_CHARS,
    );

    const smsLines = fr
      ? [
          `Appel transfere — ${profile.businessName}`,
          name ? `Nom : ${name}` : null,
          number ? `Rappel : ${number}` : null,
          `Motif : ${reason}`,
          mood !== 'neutral' ? `Etat : ${mood === 'upset' ? 'mecontent' : 'presse'}` : null,
        ]
      : [
          `Call transferred — ${profile.businessName}`,
          name ? `Name: ${name}` : null,
          number ? `Call back: ${number}` : null,
          `Reason: ${reason}`,
          mood !== 'neutral' ? `State: ${mood}` : null,
        ];

    return { callerName: name, callerNumber: number, reason, spoken, sms: smsLines.filter(Boolean).join('\n') };
  }

  /**
   * Text the brief to the professional. Fire-and-forget by design: the bridge
   * must not wait on Twilio, and a failed SMS still leaves the spoken summary.
   */
  notify(profile: ClientVoiceProfile, brief: TransferBrief): void {
    if (!profile.transferNumber) return;
    void smsService
      .sendSMS(profile.transferNumber, brief.sms)
      .catch(err => logger.warn(`[WarmTransfer] SMS to ${profile.transferNumber} failed: ${err.message}`));
  }

  /**
   * The destination Vapi should dial, with the summary attached.
   *
   * `warm-transfer-say-summary` makes Vapi speak `summaryPlan` to the operator
   * and only then bridge the caller, which is the entire point: the handover
   * happens before the two are connected, not after.
   */
  destination(profile: ClientVoiceProfile, brief: TransferBrief) {
    return {
      type: 'number',
      number: profile.transferNumber,
      message:
        profile.language === 'fr'
          ? 'Je vous mets en relation, un instant.'
          : 'Let me connect you, one moment.',
      transferPlan: {
        mode: 'warm-transfer-say-summary',
        summaryPlan: {
          enabled: true,
          messages: [{ role: 'system', content: brief.spoken }],
        },
      },
    };
  }
}

export const warmTransferService = new WarmTransferService();
