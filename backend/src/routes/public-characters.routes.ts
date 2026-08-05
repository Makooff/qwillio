import { Router } from 'express';
import type { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { CHARACTERS, isValidCharacterId } from '../config/voice-characters';
import { env } from '../config/env';
import { logger } from '../config/logger';

/* Aperçus de voix PUBLICS pour le site marketing : les mêmes clips ElevenLabs
   que le dashboard (previewAudioService, cache serveur + ETag), sans auth.

   Surface volontairement minuscule pour ne pas devenir un proxy TTS ouvert :
   - catalogue uniquement (isValidCharacterId) — jamais `custom`, jamais l'
     override `voiceId` du endpoint authentifié ;
   - texte fixé par le personnage (previewFr/previewEn), le seul choix de
     l'appelant est la langue ;
   - clips immuables donc synthétisés UNE fois puis servis du cache, et
     rate-limit par IP pour borner les synthèses de première demande. */

const previewLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req: any) => req.ip,
  message: { error: 'preview_rate_limited' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.get('/characters/:id/preview', previewLimiter, async (req: any, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!isValidCharacterId(id)) return res.status(404).json({ error: 'Unknown character' });
    if (!env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'elevenlabs_key_missing' });

    const character = CHARACTERS[id];
    const isFrench = String(req.query.lang || 'fr').toLowerCase() !== 'en';
    const text = isFrench ? character.previewFr : character.previewEn;

    const { previewAudioService } = await import('../services/voice/preview-audio.service');
    const { audio, key } = await previewAudioService.get({
      voiceId: character.voiceId,
      text,
      stability: character.stability,
      similarityBoost: character.similarityBoost,
      style: character.style,
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('ETag', `"${key}"`);
    if (req.headers['if-none-match'] === `"${key}"`) return res.status(304).end();
    res.send(audio);
  } catch (error: any) {
    const { PreviewAudioError } = await import('../services/voice/preview-audio.service');
    if (error instanceof PreviewAudioError) {
      return res.status(error.status).json({
        error: error.message,
        status: error.upstream,
        reason: error.reason,
      });
    }
    logger.error('public characterPreview failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
