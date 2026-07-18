import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface SpamClassification {
  isSpam: boolean;
  score: number; // 0-100
  reasons: string[];
}

// ── Tuning knobs ──────────────────────────────────────────────
// Conservative on purpose: a real customer must never be mistaken for spam.
// A single weak signal never crosses the threshold on its own (except an
// explicit blocklist hit); it takes a combination.
const SPAM_THRESHOLD = 60; // score >= this → spam
const SHORT_CALL_SECONDS = 8; // shorter than this looks like an instant hangup
const MIN_MEANINGFUL_TRANSCRIPT = 15; // chars of real speech
const REPEAT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REPEAT_LIMIT = 4; // more than this many calls from one number in the window
const AUTO_BLOCK_SPAM_HITS = 3; // spam calls from one number before we auto-block it

class SpamDetectionService {
  /**
   * Is this caller already on the client's blocklist? Cheap lookup meant to be
   * called at call start (real-time block, Pro/Enterprise) as well as post-call.
   */
  async isBlocked(clientId: string, callerNumber?: string | null): Promise<boolean> {
    if (!callerNumber) return false;
    const hit = await prisma.spamNumber.findUnique({
      where: { clientId_phoneNumber: { clientId, phoneNumber: callerNumber } },
    });
    return !!hit;
  }

  /**
   * Score an inbound call for spam using signals available at end-of-call.
   * Call this BEFORE inserting the call row so the repeat-frequency count
   * reflects only prior calls.
   */
  async classifyInboundCall(params: {
    clientId: string;
    callerNumber?: string | null;
    transcript?: string | null;
    durationSeconds?: number | null;
  }): Promise<SpamClassification> {
    const { clientId, callerNumber, transcript, durationSeconds } = params;
    const reasons: string[] = [];
    let score = 0;

    const dur = durationSeconds ?? 0;
    const text = (transcript ?? '').trim();

    // Explicit blocklist hit → decisive.
    if (callerNumber && (await this.isBlocked(clientId, callerNumber))) {
      reasons.push('blocklisted_number');
      score += 100;
    }

    // Silent / no meaningful speech (robocall, dead air, DTMF-only).
    if (text.length < MIN_MEANINGFUL_TRANSCRIPT) {
      reasons.push('no_meaningful_speech');
      score += 40;
    }

    // Instant hangup — a real customer rarely hangs up in under 8 seconds.
    if (dur > 0 && dur < SHORT_CALL_SECONDS) {
      reasons.push('instant_hangup');
      score += 30;
    }

    // Same number flooding the line in a short window.
    if (callerNumber) {
      const since = new Date(Date.now() - REPEAT_WINDOW_MS);
      const recent = await prisma.clientCall.count({
        where: { clientId, callerNumber, createdAt: { gte: since } },
      });
      if (recent >= REPEAT_LIMIT) {
        reasons.push('repeat_flooding');
        score += 40;
      }
    }

    const cappedScore = Math.min(score, 100);
    return { isSpam: cappedScore >= SPAM_THRESHOLD, score: cappedScore, reasons };
  }

  /**
   * Record that a number produced a spam call and auto-add it to the blocklist
   * once it crosses the repeat-offender threshold. Non-fatal on error.
   */
  async registerSpamHit(
    clientId: string,
    callerNumber: string | null | undefined,
    reasons: string[],
  ): Promise<void> {
    if (!callerNumber) return;
    try {
      const existing = await prisma.spamNumber.findUnique({
        where: { clientId_phoneNumber: { clientId, phoneNumber: callerNumber } },
      });
      if (existing) {
        await prisma.spamNumber.update({
          where: { id: existing.id },
          data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
        });
        return;
      }

      // Count prior spam calls from this number (current one already written).
      const priorSpam = await prisma.clientCall.count({
        where: { clientId, callerNumber, isSpam: true },
      });
      if (priorSpam >= AUTO_BLOCK_SPAM_HITS) {
        await prisma.spamNumber.create({
          data: {
            clientId,
            phoneNumber: callerNumber,
            reason: reasons.slice(0, 3).join(','),
            source: 'auto',
            hitCount: 1,
          },
        });
        logger.info(
          `🛡️ Auto-blocked spam number ${callerNumber} for client ${clientId} (${reasons.join(',')})`,
        );
      }
    } catch (err) {
      logger.warn('registerSpamHit failed (non-fatal):', err);
    }
  }
}

export const spamDetectionService = new SpamDetectionService();
