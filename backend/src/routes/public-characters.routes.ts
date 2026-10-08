import { Router } from 'express';
import type { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { CHARACTERS, isValidCharacterId, listCharacters, voiceForLanguage } from '../config/voice-characters';
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

/* Le CATALOGUE, sans la voix.
 *
 * La page d'essai monte le même carrousel que le tableau de bord, qui attend
 * cette liste. Elle ne contient que ce qui s'affiche (nom, accent, genre,
 * accroche, phrase de l'aperçu): jamais le `voiceId` ElevenLabs, qui reste au
 * serveur et n'a rien à faire dans une page publique. */
router.get('/characters', (_req, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(
    listCharacters().map(c => ({
      id: c.id,
      name: c.name,
      accent: c.accent,
      gender: c.gender,
      personaKey: c.personaKey,
      taglineFr: c.taglineFr,
      taglineEn: c.taglineEn,
      previewFr: c.previewFr,
      previewEn: c.previewEn,
    })),
  );
});

router.get('/characters/:id/preview', previewLimiter, async (req: any, res: Response) => {
  try {
    const id = String(req.params.id || '');
    if (!isValidCharacterId(id)) return res.status(404).json({ error: 'Unknown character' });
    if (!env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'elevenlabs_key_missing' });

    const character = CHARACTERS[id];
    const lang = String(req.query.lang || 'fr').toLowerCase() === 'en' ? 'en' : 'fr';
    const isFrench = lang === 'fr';
    const text = isFrench ? character.previewFr : character.previewEn;
    /* La voix suit la langue, ET sa provenance est transmise. L'omettre était
       exactement la panne: un identifiant Cartesia partait se faire lire comme
       de l'ElevenLabs, ne trouvait rien, et l'aperçu retombait sur la voix par
       défaut. */
    const voice = voiceForLanguage(character, lang);

    const { previewAudioService } = await import('../services/voice/preview-audio.service');
    const { audio, key } = await previewAudioService.get({
      voiceId: voice.voiceId,
      voiceProvider: voice.voiceProvider,
      text,
      lang,
      stability: character.stability,
      similarityBoost: character.similarityBoost,
      style: character.style,
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    /* Le clip est immuable pour un couple (voix, ligne) — MAIS la voix d'un
       personnage change (voix FR distinctes, réassignation portail). Une
       semaine sans revalidation servait l'ancienne voix pendant 7 jours après
       un changement, soit exactement « j'entends encore la même voix ». On
       force donc la revalidation par ETag: inchangé → 304 (rapide, rien n'est
       re-synthétisé), changé → 200 (le nouveau timbre arrive tout de suite). */
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
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

/* ── TEMP DEBUG (à retirer) : pays + accent de chaque voix Cartesia fr, pour
   trancher québécois / métropolitain sans deviner. ── */
router.get('/debug-voices', async (_req, res: Response) => {
  try {
    const { listCartesiaVoices } = await import('../services/voice/cartesia.service');
    const voices = await listCartesiaVoices('fr');
    res.json(voices.map(v => ({
      voiceId: v.voiceId,
      name: v.name,
      gender: v.gender,
      country: v.country,
      accent: v.accent,
      accentsRaw: v.accentsRaw,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
