/**
 * Poser le NIVEAU de réceptionniste et le faire ARRIVER jusqu'à l'appel.
 *
 * Écrire `voiceTier` en base ne change RIEN à l'appel suivant tant que deux
 * autres gestes n'ont pas eu lieu: le profil d'appel est servi depuis un cache,
 * et l'assistant DISTANT garde la configuration figée à la dernière
 * synchronisation. C'est le mode d'échec que ce dépôt a payé sept fois: un
 * réglage enregistré, un écran qui dit « enregistré », et un appelant qui
 * entend l'ancienne configuration pour toujours.
 *
 * Les trois gestes vivent donc ICI, et pas dans chaque appelant. Ils étaient
 * écrits à la main dans `scripts/set-voice-tier.ts`, seul chemin qui savait les
 * faire; la vente de l'option en a ouvert un second (le portail), et deux
 * copies d'une même règle divergent en moins d'un mois. C'est exactement ce que
 * 6vicies raconte sur la langue du transcripteur.
 */
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { onboardingService } from '../onboarding.service';
import { realtimeContextService } from './realtime-context.service';
import { classifyVapiError } from './vapi-error';
import type { VoiceTierId } from './voice-tiers';

export interface ApplyTierResult {
  /** L'écriture en base et l'invalidation du cache ont eu lieu. Toujours vrai si on ne lève pas. */
  written: true;
  /** L'assistant distant porte le nouveau niveau. Faux = il garde l'ancien. */
  synced: boolean;
  /** Pourquoi la synchronisation a échoué, avec le corps de la réponse de Vapi. */
  syncError: string | null;
  /** Aucun assistant distant: sur une ligne partagée, l'assistant est bâti à l'appel. */
  builtAtCallTime: boolean;
}

/**
 * @param tier `null` retire le choix: le réglage global décide à nouveau.
 *
 * Ne vérifie PAS le droit: le contrôle vit chez l'appelant, qui sait s'il vend
 * (le portail répond 403) ou s'il administre (le script refuse la combinaison).
 * `entitledTier` borne de toute façon à la résolution, donc un niveau écrit
 * sans droit est servi en classique plutôt qu'appliqué.
 */
export async function applyVoiceTier(
  clientId: string,
  tier: VoiceTierId | null,
): Promise<ApplyTierResult> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { vapiConfig: true, vapiAssistantId: true, businessName: true },
  });
  if (!client) throw new Error(`Client ${clientId} introuvable`);

  /* Fusion SUPERFICIELLE, comme le PUT du portail: `vapiConfig` porte la base de
     connaissances, la voix et le mode sans enregistrement, et le remplacer en
     entier les effacerait en silence (6sexies). */
  const cfg = ((client.vapiConfig as any) || {}) as Record<string, unknown>;
  await prisma.client.update({
    where: { id: clientId },
    data: { vapiConfig: { ...cfg, voiceTier: tier } as any },
  });

  /* Le profil est relu depuis un cache à chaque appel: sans invalidation,
     l'ANCIEN moteur répond pendant tout le TTL. Sur un réglage qu'on change
     précisément pour changer de moteur, l'oubli fait juger le mauvais. */
  await realtimeContextService.invalidateClient(clientId);

  if (!client.vapiAssistantId) {
    return { written: true, synced: false, syncError: null, builtAtCallTime: true };
  }

  try {
    await onboardingService.syncVapiAssistant(clientId);
    return { written: true, synced: true, syncError: null, builtAtCallTime: false };
  } catch (error) {
    /* Le refus de Vapi n'est PAS avalé: il nomme le champ fautif, et c'est la
       seule chose que le code ne pouvait pas deviner (6nonies). L'appelant
       décide s'il alerte ou s'il affiche. */
    const failure = classifyVapiError(error);
    const detail = `${failure.kind === 'rejected' ? 'REFUSÉ' : 'incident passager'}`
      + `${failure.status ? ` (HTTP ${failure.status})` : ''}: ${failure.detail}`;
    logger.error(`[VoiceTier] synchronisation refusée pour ${client.businessName}: ${detail}`);
    return { written: true, synced: false, syncError: detail, builtAtCallTime: false };
  }
}
