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

/**
 * Ce que Whisper écrit quand il n'entend RIEN.
 *
 * Sur un clip silencieux ou trop faible, le modèle ne rend pas une chaîne
 * vide: il produit la phrase la plus probable de son entraînement pour cette
 * langue, et son entraînement est plein de sous-titres. En français cela donne
 * « Sous-titrage ST' 501 », « Sous-titres réalisés par la communauté
 * d'Amara.org », en anglais « Thanks for watching! ». Relevé en production le
 * 09/09: l'owner a parlé, et son message est parti dans la conversation sous la
 * forme d'un générique de sous-titrage.
 *
 * Rendre ce texte est pire que ne rien rendre: l'assistant répond à une phrase
 * que personne n'a dite, et l'owner croit que sa dictée est comprise de
 * travers alors qu'elle n'est pas arrivée.
 *
 * DEUX PRUDENCES, sans lesquelles ce filtre ferait plus de mal que de bien:
 *  - la comparaison porte sur la transcription ENTIÈRE, jamais sur un morceau:
 *    « merci d'avoir regardé la vidéo que je vous ai envoyée » est une vraie
 *    phrase, et elle doit passer;
 *  - la politesse nue (« merci », « thank you ») n'est PAS dans la liste, alors
 *    que Whisper la produit aussi sur du silence: c'est une réponse plausible
 *    de l'owner, et la perdre coûterait plus cher que de la laisser passer.
 */
/* Chaque motif est BORNÉ: quelques mots de queue au plus, jamais `.*`. Un
   « .* » faisait correspondre « thanks for watching the shop while I was away »,
   une vraie phrase d'owner, et la faisait disparaître. Un artefact de silence
   est court par nature; une phrase humaine ne l'est pas longtemps. */
const TAIL = String.raw`( [\w'’.\-]+){0,4}`;

const SILENCE_ARTIFACTS = [
  // Génériques de sous-titrage, toutes déclinaisons vues.
  new RegExp(String.raw`^sous[- ]?titrage${TAIL}$`),
  /* Le crédit de sous-titres prend trop de formes pour être décrit token par
     token. On exige donc les DEUX bouts: la phrase commence par « sous-titres »
     ET porte une signature de crédit, le tout dans une longueur d'artefact. Une
     vraie phrase qui parlerait de sous-titrage ne commence pas par là. */
  new RegExp(String.raw`^sous[- ]?titres?\b.{0,60}\b(amara|communaute|societe|radio-?canada|realises? par)\b.{0,20}$`),
  new RegExp(String.raw`^merci d'avoir regarde (cette|la) video$`),
  new RegExp(String.raw`^abonne[- ]?toi${TAIL}$`),
  // Anglais.
  new RegExp(String.raw`^thanks? for watching${TAIL}$`),
  new RegExp(String.raw`^subtitles?( (by|created by|amara))${TAIL}$`),
  new RegExp(String.raw`^\[?(music|musique|applause|applaudissements|silence|blank_audio|inaudible)\]?$`),
  // Néerlandais, la troisième langue de la flotte.
  /* Même forme que le crédit français: le préfixe ET une signature, parce que
     « Ondertitels ingediend door de Amara.org gemeenschap » compte plus de mots
     que la queue bornée n'en autorise. */
  new RegExp(String.raw`^ondertitels?\b.{0,60}\b(amara|gemeenschap|ingediend)\b.{0,20}$`),
  new RegExp(String.raw`^bedankt voor het kijken${TAIL}$`),
];

/** Sans accents, sans ponctuation de fin, en minuscules: la comparaison est sur le FOND. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?…]+$/, '')
    .trim();
}

/** Vrai quand la transcription ENTIÈRE n'est qu'un artefact de silence. */
export function looksLikeSilenceArtifact(text: string): boolean {
  const folded = fold(text);
  if (!folded) return false;
  return SILENCE_ARTIFACTS.some(pattern => pattern.test(folded));
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
    const text = (data.text || '').trim();
    /* Un générique de sous-titrage ne vaut pas mieux qu'un silence: il vaut
       moins, puisqu'il fait répondre l'assistant à une phrase que personne n'a
       dite. Rendu vide, l'interface dit « je n'ai rien entendu », ce qui est
       exactement ce qui s'est passé. */
    if (looksLikeSilenceArtifact(text)) {
      logger.warn(`[Transcription] artefact de silence écarté: "${text.slice(0, 80)}"`);
      return { text: '', language: (language || 'fr').slice(0, 2).toLowerCase() };
    }
    return {
      text,
      language: (language || 'fr').slice(0, 2).toLowerCase(),
    };
  }
}

export const transcriptionService = new TranscriptionService();
