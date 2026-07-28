import { logger } from '../config/logger';
import { env } from '../config/env';

// Server-side speech-to-text for the dashboard assistant.
//
// The browser Web Speech API was used before and could not be relied on: it
// does not exist in Firefox, is erratic in Safari, and its language had to be
// chosen up-front by the caller. Doing this server-side means one code path
// that behaves the same in every browser, and a language we control.
//
// Whisper is used because OPENAI_API_KEY already ships and is already used by
// assistant-chat.service. No new credential to provision.

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MODEL = 'whisper-1';
const TIMEOUT_MS = 30_000;

/**
 * Whisper's own cap is 25 MB, but the binding constraint here is the express
 * json limit of 10 MB: base64 inflates by ~4/3, so the cap has to leave room
 * for that expansion or the body parser rejects the request before the handler
 * can answer with a coded error. 6 MB encodes to ~8 MB, comfortably inside.
 * Dictation clips are seconds long, so this is never reached in practice.
 */
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac',
]);

export interface TranscriptionResult {
  text: string;
  language: string;
}

export class TranscriptionService {
  /**
   * @param audio  Raw audio bytes as captured by MediaRecorder.
   * @param mimeType  The blob's MIME type, used to name the upload so Whisper
   *                  can pick a decoder. Anything unknown falls back to webm.
   * @param language  BCP-47-ish hint ('fr', 'en'). Whisper auto-detects when
   *                  omitted, but a hint measurably improves short clips.
   */
  async transcribe(audio: Buffer, mimeType: string, language?: string): Promise<TranscriptionResult> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('transcription_unavailable');
    }
    if (!audio.length) {
      throw new Error('empty_audio');
    }
    if (audio.length > MAX_AUDIO_BYTES) {
      throw new Error('audio_too_large');
    }

    const type = ALLOWED_MIME.has(mimeType) ? mimeType : 'audio/webm';
    const ext = type.split('/')[1].replace('x-', '');

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type }), `dictation.${ext}`);
    form.append('model', MODEL);
    // Whisper wants a bare ISO-639-1 code, not a locale.
    if (language) form.append('language', language.slice(0, 2).toLowerCase());

    // Without a deadline a stalled upstream would hold this request, and the
    // caller's spinner, indefinitely.
    let res: Response;
    try {
      res = await fetch(WHISPER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      logger.error('[Transcription] Whisper request failed or timed out:', err);
      throw new Error('transcription_failed');
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      logger.error(`[Transcription] Whisper ${res.status}: ${detail}`);
      throw new Error('transcription_failed');
    }

    const data = (await res.json()) as { text?: string };
    return {
      text: (data.text || '').trim(),
      language: (language || 'fr').slice(0, 2).toLowerCase(),
    };
  }
}

export const transcriptionService = new TranscriptionService();
