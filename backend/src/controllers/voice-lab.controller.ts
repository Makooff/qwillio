import { Response } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { listCharacters, resolveCharacter } from '../config/voice-characters';

/**
 * Le banc d'essai, côté serveur.
 *
 * Trois routes, et la seule qui compte vraiment est la deuxième: elle assemble
 * l'assistant avec les MÊMES fonctions que l'appel entrant réel. Tout l'intérêt
 * du banc tient là. Un banc qui monterait sa propre chaîne testerait autre
 * chose que ce que l'appelant entendra, et c'est exactement le piège qu'on a
 * dû retirer deux fois de l'aperçu du sélecteur de voix.
 */

/** Les curseurs offerts à l'écran, avec leurs bornes. Voir `resolveTuning`. */
const KNOBS = [
  { key: 'speed', label: 'Vitesse de parole', min: 0.8, max: 1.2, step: 0.01,
    help: '1,0 est la vitesse d\'entraînement du modèle. S\'en écarter dégrade la diction.' },
  { key: 'styleCap', label: 'Plafond d\'expressivité', min: 0, max: 1, step: 0.05,
    help: 'Au delà de ~0,6 la diction devient théâtrale.' },
  { key: 'minChunkChars', label: 'Taille du premier morceau', min: 10, max: 200, step: 5,
    help: 'Plus bas, le son part plus tôt mais se hache. Plus haut, plus naturel, premier mot plus tardif.' },
  { key: 'bargeInWords', label: 'Mots avant interruption', min: 0, max: 5, step: 1,
    help: '0 coupe sur la moindre activité vocale. 2 exige des mots transcrits, donc trie le bruit.' },
  { key: 'bargeInVoiceSeconds', label: 'Seuil de bruit (s)', min: 0.1, max: 1.5, step: 0.05,
    help: 'Agit SEUL, sans passer par le transcripteur. C\'est le curseur du « il se tait au moindre bruit ».' },
  { key: 'backoffSeconds', label: 'Pause après interruption (s)', min: 0.3, max: 3, step: 0.1,
    help: 'Trop bas, les deux parlent en boucle par dessus l\'autre.' },
  { key: 'silenceTimeout', label: 'Silence avant raccrochage (s)', min: 10, max: 120, step: 5,
    help: 'Sous 10 s, la réceptionniste raccroche au nez de quelqu\'un qui réfléchit.' },
  { key: 'temperature', label: 'Température du modèle', min: 0, max: 1.2, step: 0.05,
    help: 'Plus haut, plus varié et moins prévisible.' },
] as const;

export class VoiceLabController {
  /**
   * GET /admin/lab/options — tout ce que l'écran peut proposer.
   *
   * Les catalogues de voix sont servis pour LES DEUX fournisseurs, ce que
   * l'écran client ne fait pas: là-bas on ne propose que ce qui sert, ici on
   * compare. Une liste qui échoue n'en fait pas échouer une autre: sans clé
   * Cartesia, l'écran doit encore pouvoir régler ElevenLabs.
   */
  async options(req: any, res: Response) {
    try {
      const { voiceCatalogService } = await import('../services/voice/voice-catalog.service');
      const { resolveTuning } = await import('../services/voice/speech-plans');

      const lang = (['fr', 'en', 'nl'] as const).includes(req.query?.lang)
        ? (req.query.lang as 'fr' | 'en' | 'nl')
        : 'fr';

      const [eleven, cartesia, clients] = await Promise.all([
        voiceCatalogService.list(undefined, lang, '11labs').catch((e: Error) => ({ error: e.message })),
        voiceCatalogService.list(undefined, lang, 'cartesia').catch((e: Error) => ({ error: e.message })),
        prisma.client.findMany({
          where: { subscriptionStatus: { in: ['active', 'trialing', 'paused'] } },
          select: { id: true, businessName: true, agentLanguage: true },
          orderBy: { businessName: 'asc' },
          take: 100,
        }),
      ]);

      res.json({
        clients,
        characters: listCharacters().map(c => ({
          id: c.id, name: c.name, gender: c.gender, personaKey: c.personaKey,
        })),
        voices: {
          '11labs': Array.isArray(eleven) ? eleven : [],
          cartesia: Array.isArray(cartesia) ? cartesia : [],
          errors: {
            '11labs': Array.isArray(eleven) ? null : (eleven as any).error,
            cartesia: Array.isArray(cartesia) ? null : (cartesia as any).error,
          },
        },
        /* Les valeurs de DÉPART sont celles de la production: le banc s'ouvre
           sur ce que les clients entendent aujourd'hui, pas sur des valeurs
           neutres qu'il faudrait d'abord retrouver. */
        defaults: resolveTuning(),
        knobs: KNOBS,
        models: {
          /* Listes ouvertes: l'écran propose, le champ reste libre. Figer une
             liste fermée ici obligerait à un déploiement le jour où un
             fournisseur sort un modèle, ce qui est exactement ce que ce banc
             existe pour éviter. */
          tts: ['eleven_turbo_v2_5', 'eleven_flash_v2_5', 'eleven_multilingual_v2'],
          cartesia: ['sonic-3.5', 'sonic-3', 'sonic-2'],
          realtime: ['gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-realtime-2025-08-28'],
          llm: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
        },
      });
    } catch (error: any) {
      logger.error('[VoiceLab] options:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /admin/lab/session — l'assistant d'essai, monté à la demande.
   *
   * Il porte un `serverUrl` propre à la session, contrairement à l'appel de
   * test du tableau de bord: c'est ce qui fait revenir les appels d'outils
   * jusqu'à nous, donc ce qui permet au moniteur de dire ce que l'agent a fait.
   * Sans lui on entendrait l'agent annoncer un rendez-vous sans jamais savoir
   * s'il l'a réellement demandé.
   *
   * RIEN N'EST ENREGISTRÉ. Les réglages vivent dans la réponse, pas en base: le
   * client dont on emprunte le profil ne doit pas sortir modifié d'un essai.
   */
  async session(req: any, res: Response) {
    try {
      const b = req.body || {};
      const clientId = String(b.clientId || '');
      if (!clientId) return res.status(400).json({ error: 'clientId requis' });

      const { realtimeContextService } = await import('../services/voice/realtime-context.service');
      const { buildSystemPrompt } = await import('../services/voice/system-prompt');
      const { firstMessageVariants } = await import('../services/voice/system-prompt');
      const { buildVoiceTools } = await import('../services/voice/voice-tools');
      const { buildSpeech, buildRealtimePlans } = await import('../services/voice/speech-plans');
      const { voiceLabService } = await import('../services/voice/voice-lab.service');

      const profile = await realtimeContextService.getClientProfile(clientId);
      if (!profile) return res.status(404).json({ error: 'client_introuvable' });

      const lab = voiceLabService.open(clientId);

      /* Le personnage et la voix viennent de l'écran, pas du client: c'est tout
         l'objet du banc. Absents, on retombe sur ce que ce client a vraiment,
         ce qui donne un point de comparaison honnête au premier essai. */
      const character = resolveCharacter({
        characterId: b.characterId || profile.characterId,
        isFrench: profile.language === 'fr',
        country: profile.country,
        customVoice: b.voiceId
          ? { voiceId: String(b.voiceId), name: 'Banc d\'essai', createdAt: new Date().toISOString(),
              ...(b.voiceProvider === 'cartesia' ? { provider: 'cartesia' as const } : {}) }
          : profile.customVoice,
      });

      const notice = profile.language === 'fr'
        ? '\n\nCONTEXTE: banc d\'essai. Comporte-toi exactement comme sur un vrai appel.'
        : '\n\nCONTEXT: test bench. Behave exactly as on a real call.';

      const { model, voice, speechToSpeech } = buildSpeech({
        lang: profile.language,
        systemPrompt: buildSystemPrompt(profile, { isReturning: false } as any, '') + notice,
        /* TOUS les outils, y compris ceux qui écrivent. Ils ne s'exécuteront
           pas (voir le webhook), mais l'agent doit pouvoir les APPELER: c'est
           la seule façon de voir s'il prend un rendez-vous au bon moment. */
        tools: buildVoiceTools(profile),
        character,
        hasCustomVoice: !!b.voiceId || !!profile.customVoice,
        voiceMode: b.voiceMode || profile.voiceMode,
        ttsProvider: b.ttsProvider || profile.ttsProvider,
        tuning: b.tuning,
        fallbacks: false,
      });

      res.json({
        sessionId: lab.id,
        publicKey: env.VAPI_PUBLIC_KEY,
        /* Le moteur RÉELLEMENT retenu, renvoyé avec la config: c'est ce que le
           moniteur affiche, et le déduire à l'écran le ferait mentir le jour où
           une voix clonée l'emporte sur le réglage. */
        resolved: {
          engine: speechToSpeech ? 'realtime' : 'classic',
          voiceProvider: voice.provider,
          voiceId: voice.voiceId,
          voiceModel: voice.model ?? null,
          llm: model.model,
          character: character.name,
        },
        assistant: {
          name: `Banc — ${character.name}`,
          model,
          voice,
          firstMessage: firstMessageVariants(profile, null)[0],
          ...buildRealtimePlans(profile.language, speechToSpeech, { fallbacks: false }, b.tuning || {}),
          backgroundSound: b.backgroundSound || env.VOICE_BACKGROUND_SOUND,
          serverUrl: voiceLabService.webhookUrl(lab.id),
        },
      });
    } catch (error: any) {
      logger.error('[VoiceLab] session:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /admin/lab/session/:id — ce que l'agent a fait, pour le moniteur. */
  async events(req: any, res: Response) {
    const { voiceLabService } = await import('../services/voice/voice-lab.service');
    const session = voiceLabService.get(String(req.params.id || ''));
    // 200 avec une liste vide plutôt que 404: une session expirée pendant que
    // l'écran interroge ne doit pas peindre une erreur sur un essai terminé.
    res.json({ events: session?.events ?? [], expired: !session });
  }
}

export const voiceLabController = new VoiceLabController();

/**
 * POST /webhooks/lab/:sessionId — les outils, pendant un essai.
 *
 * C'est ici que se joue la promesse du banc: montrer ce qui SERAIT arrivé sans
 * que ça arrive. Un outil qui lit s'exécute pour de bon, parce qu'entendre
 * l'agent proposer les vrais créneaux du client est tout l'intérêt; un outil
 * qui écrit ou qui envoie est décrit, jamais exécuté. La frontière n'est pas
 * « dangereux ou non », elle est « laisse une trace chez quelqu'un d'autre ».
 *
 * Pas de secret de webhook exigé: cette route n'écrit rien, et l'identifiant de
 * session est un UUID qui vit dix minutes en mémoire. Exiger le secret Vapi
 * aurait été plus symétrique, mais il n'est pas posé sur un assistant transient
 * monté à la volée, et une route qui refuse tout ne protège rien.
 */
export async function labToolWebhook(req: any, res: Response) {
  const { voiceLabService, isWritingTool, describeEffect, simulatedResult } =
    await import('../services/voice/voice-lab.service');

  const sessionId = String(req.params.sessionId || '');
  const session = voiceLabService.get(sessionId);
  if (!session) return res.json({ results: [] });

  const message = req.body?.message || {};
  const type = message.type;

  // Les jalons de l'appel: utiles au moniteur pour situer les outils dans le
  // temps, et pour voir un raccrochage prématuré à l'endroit où il arrive.
  if (type === 'status-update' || type === 'end-of-call-report') {
    voiceLabService.record(sessionId, {
      kind: 'call',
      name: String(message.status || message.endedReason || type),
      mode: 'real',
      wouldHave: message.endedReason
        ? `Appel terminé par Vapi: ${message.endedReason}`
        : `État de l'appel: ${message.status}`,
    });
    return res.json({ results: [] });
  }

  const calls: any[] = message.toolCalls || message.toolCallList || [];
  if (!calls.length) return res.json({ results: [] });

  const results = await Promise.all(calls.map(async (c: any) => {
    const name = String(c.function?.name || c.name || '');
    const rawArgs = c.function?.arguments ?? c.arguments ?? {};
    const args = typeof rawArgs === 'string'
      ? (() => { try { return JSON.parse(rawArgs); } catch { return {}; } })()
      : rawArgs;
    const toolCallId = String(c.id || c.toolCallId || '');

    voiceLabService.record(sessionId, {
      kind: 'tool',
      name,
      mode: isWritingTool(name) ? 'simulated' : 'real',
      wouldHave: describeEffect(name, args),
      args,
    });

    if (isWritingTool(name)) {
      return { toolCallId, result: simulatedResult(name, args) };
    }

    /* Lecture: on passe par le runtime de production, avec l'identifiant du
       client emprunté. Même code, même résultat, mêmes limites de temps: c'est
       ce qui rend l'essai comparable à un vrai appel. */
    try {
      const { toolRuntimeService } = await import('../services/voice/tool-runtime.service');
      return await toolRuntimeService.execute(session.clientId, null, { toolCallId, name, args });
    } catch (error: any) {
      logger.warn(`[VoiceLab] outil ${name} en échec: ${error.message}`);
      return { toolCallId, result: 'Not available right now.' };
    }
  }));

  res.json({ results });
}
