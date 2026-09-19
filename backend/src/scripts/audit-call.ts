/**
 * `npm run voice:audit [-- --call=<vapiCallId|sidTwilio>] [-- --email=<client>] [-- --skip=N]`
 *
 * L'audit d'UN appel, le dernier par défaut: « tout marche ? tout est
 * réglé ? », ligne par ligne avec un verdict et un levier. Ce script ne fait
 * que COLLECTER les faits (notre base, l'appel chez Vapi, l'assistant distant,
 * l'environnement de CE processus) et les passe à `auditCall`, qui tranche.
 * Lancé sur le shell Render, il lit l'env de production; lancé d'un poste, il
 * lit le `.env` du poste, et les lignes « réglages » décrivent alors le poste.
 *
 * Le docteur (`voice:doctor`) reste la lecture complète; l'audit est ce qu'on
 * colle après un appel test pour savoir quoi toucher ensuite.
 */

import { prisma } from '../config/database';
import { env } from '../config/env';
import { vapiClient } from '../config/vapi';
import { smsReadiness } from '../services/sms-ready';
import { buildStartSpeakingPlan, resolveTuning } from '../services/voice/speech-plans';
import { clientLocale } from '../utils/client-locale';
import { auditCall, readVapiMessages, renderAudit, type CallFacts } from '../services/voice/call-audit';
import { voiceForProfile } from '../services/voice/profile-voice';
import { readTierId, requestedTier, tuningFor } from '../services/voice/voice-tiers';
import { PLANS, type PlanId } from '../config/plans';

/**
 * Le forfait, ou `null` quand la colonne ne désigne rien de connu.
 *
 * `getPlan` retombe sur Starter pour toute valeur inconnue, ce qui est juste
 * pour vendre et faux pour AUDITER: ici, juger la minute d'un client contre la
 * recette d'un palier qui n'est pas le sien fabriquerait un verdict. Une
 * colonne vide vaut « je ne sais pas », et la vérification retombe alors sur
 * la recette la plus basse de la grille.
 */
function readPlanId(planType: string | null | undefined): PlanId | null {
  const key = (planType || '').toLowerCase();
  return key in PLANS ? (key as PlanId) : null;
}
import { realtimeContextService } from '../services/voice/realtime-context.service';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/**
 * Un SID Twilio (`CAff00102f…`) n'est PAS un identifiant Vapi.
 *
 * C'est pourtant celui qu'on a sous la main: c'est ce que la console Twilio
 * affiche, et c'est ce qu'on copie quand on veut auditer un appel precis.
 * Passe tel quel a `--call`, il ne matchait aucune ligne et Vapi repondait
 * « ne rend pas l'appel », ce qui ressemble a une panne alors que c'est un
 * identifiant du mauvais systeme.
 *
 * La resolution scanne le CORPS des appels recents plutot que de lire un champ
 * nomme: `phoneCallProviderId` est le nom probable, mais un identifiant ou un
 * champ ne se DEDUIT jamais de la documentation (6quinvicies) et cette
 * recherche est juste quel que soit l'endroit ou Vapi le range.
 */
const TWILIO_SID = /^CA[0-9a-f]{32}$/i;

async function resolveTwilioSid(sid: string): Promise<string | null> {
  try {
    const calls = (await vapiClient.listCalls(50)) as Array<Record<string, any>>;
    const hit = calls.find(c => JSON.stringify(c).includes(sid));
    return typeof hit?.id === 'string' ? hit.id : null;
  } catch (error) {
    console.log(`\nVapi ne rend pas la liste des appels: ${(error as Error).message}\n`);
    return null;
  }
}

async function main() {
  let wantedCall = arg('call');
  const email = arg('email');
  /* Le Nieme appel en partant du dernier. Une seance de test produit des
     appels morts (raccroche a 4 s, faux depart) et l'audit prend le DERNIER:
     `--skip=1` vise celui d'avant sans avoir a retrouver son identifiant. */
  const skip = Math.max(0, parseInt(arg('skip') || '0', 10) || 0);

  if (wantedCall && TWILIO_SID.test(wantedCall)) {
    const resolved = await resolveTwilioSid(wantedCall);
    if (!resolved) {
      console.log(
        `\n${wantedCall} est un SID TWILIO, pas un identifiant Vapi, et aucun des 50 derniers`
        + ` appels Vapi ne le porte.\nUtiliser l'identifiant Vapi (un UUID), ou \`--skip=1\``
        + ` pour l'avant-dernier appel.\n`,
      );
      return;
    }
    console.log(`SID Twilio ${wantedCall} → appel Vapi ${resolved}`);
    wantedCall = resolved;
  }

  const [ours] = await prisma.clientCall.findMany({
    where: {
      vapiCallId: wantedCall ? wantedCall : { not: null },
      ...(email ? { client: { contactEmail: email } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: 1,
    select: {
      id: true,
      vapiCallId: true,
      clientId: true,
      callerName: true,
      nameCollected: true,
      summary: true,
      isLead: true,
      durationSeconds: true,
      metadata: true,
      createdAt: true,
      client: { select: { businessName: true, contactEmail: true, vapiAssistantId: true, country: true, agentLanguage: true, vapiConfig: true, planType: true } },
    },
  });

  const callId = wantedCall ?? ours?.vapiCallId ?? null;
  if (!callId) {
    console.log(email ? `\nAucun appel enregistré pour ${email}.\n` : '\nAucun appel enregistré chez nous. Passer `--call=<vapiCallId>` pour auditer un appel absent de la base.\n');
    return;
  }

  /* L'appel chez Vapi: la conversation, les outils, l'horloge. */
  let vapiCall: Record<string, any> | null = null;
  try {
    vapiCall = (await vapiClient.getCall(callId)) as Record<string, any>;
  } catch (error) {
    console.log(`\nVapi ne rend pas l'appel ${callId}: ${(error as Error).message}\n`);
  }
  const messages: Array<Record<string, any>> = vapiCall?.artifact?.messages ?? vapiCall?.messages ?? [];
  const read = readVapiMessages(messages);

  const realtime = ((ours?.metadata as Record<string, any> | null)?.realtime ?? null) as Record<string, any> | null;
  /* CE QUE VAPI A FACTURÉ POUR CET APPEL, écrit par `persistMetrics` et lu par
     personne jusqu'ici: tous les consommateurs de `billing` ne prenaient que
     `costUsd`, et le détail par poste — la seule réponse chiffrée à « où part
     l'argent, le modèle ou la plateforme » — restait dans le JSON. */
  const billed = ((ours?.metadata as Record<string, any> | null)?.billing ?? null) as Record<string, any> | null;

  /* La réservation liée à CET appel, et ce qu'est devenu son SMS. */
  const bookingRow = ours
    ? await prisma.clientBooking.findFirst({
        where: { OR: [{ clientCallId: ours.id }, ...(realtime?.bookingId ? [{ id: String(realtime.bookingId) }] : [])] },
        select: { id: true, smsConfirmationSent: true, customerPhone: true, createdAt: true },
      })
    : null;
  const smsLogs = bookingRow
    ? await prisma.smsLog.findMany({
        where: { clientId: ours!.clientId, messageType: 'booking_confirmation', createdAt: { gte: bookingRow.createdAt } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { status: true, errorMsg: true },
      })
    : [];

  /* L'assistant DISTANT: c'est lui qui décroche, pas le code. */
  let remoteCustomLlm: boolean | null = null;
  let remoteEndpointing: CallFacts['remote']['endpointing'] = null;
  /* LU sur l'assistant distant, pas déduit du réglage du client: l'écart entre
     les deux est exactement ce que cette ligne existe pour montrer. */
  let remoteSpeechToSpeech: boolean | null = null;
  /** Le modele que l'assistant DISTANT porte: la seule source de « lequel sert ». */
  let remoteModel: string | null = null;
  let remoteTranscriber: boolean | null = null;
  let remoteSttProvider: string | null | undefined = undefined;
  let remoteSilenceTimeout: number | null = null;
  let remoteStopSpeaking: CallFacts['remote']['stopSpeaking'] = null;
  const assistantId = ours?.client?.vapiAssistantId ?? vapiCall?.assistantId ?? null;
  if (assistantId) {
    try {
      const assistant = (await vapiClient.getAssistant(assistantId)) as Record<string, any>;
      remoteCustomLlm = assistant?.model?.provider === 'custom-llm';
      /* Le parole-à-parole se reconnaît au MODÈLE, pas à l'absence de
         transcripteur (17/09/2026).
         La lecture d'avant était « openai ET pas de transcripteur », et elle
         tenait tant que le temps réel en était dépourvu. Un appel réel a montré
         que Vapi en a besoin sur ce chemin pour entendre l'appelant, donc un
         assistant temps réel PARFAITEMENT configuré en porte un désormais, et
         cette lecture le classait « classique » puis « HYBRIDE » — un diagnostic
         faux sur l'état qu'on veut, soit exactement ce que cet audit a déjà
         payé trois fois aujourd'hui.
         L'identifiant du modèle, lui, ne ment pas: seul le temps réel porte un
         `gpt-realtime-*`, et le fournisseur seul ne suffit pas puisqu'un client
         épinglé hors custom-LLM est aussi en `openai`. */
      const remoteModelName = typeof assistant?.model?.model === 'string' ? assistant.model.model : '';
      remoteSpeechToSpeech = assistant?.model?.provider === 'openai' && /realtime/i.test(remoteModelName);
      remoteModel = remoteModelName || null;
      /* Le transcripteur DISTANT, à part: c'est lui qui distingue « le niveau
         n'a pas été écrit » de « un reste l'annule ». Voir `remote.transcriber`
         dans `call-audit.ts`. */
      remoteTranscriber = !!assistant?.transcriber;
      /* Et son FOURNISSEUR, qui est une autre question: `buildTranscriber`
         n'écrit que `deepgram`, donc tout autre nom vient d'une édition faite
         hors du dépôt. Relevé sur un compte réel le 19/09 (Scribe v2), et
         invisible jusque-là: le booléen ci-dessus disait « oui il y en a un ». */
      remoteSttProvider = typeof assistant?.transcriber?.provider === 'string'
        ? assistant.transcriber.provider
        : assistant?.transcriber ? 'inconnu' : null;
      /* Le délai de RACCROCHÉ, lu sur l'assistant distant. Il ne figurait sur
         aucun écran, et c'est lui qui a tué six appels de test d'affilée. */
      remoteSilenceTimeout = typeof assistant?.silenceTimeoutSeconds === 'number'
        ? assistant.silenceTimeoutSeconds : null;
      /* PAS de plan distant reste `null`, et la nuance porte tout: un objet
         rempli de « aucun » et de `null` se lit comme un plan, donc l'audit
         annonçait « reste d'une synchronisation classique » sur un assistant
         temps réel qui n'en porte aucun — précisément l'état qu'on VEUT. Le
         `?? {}` transformait une absence en présence vide (17/09/2026). */
      /* Le plan d'INTERRUPTION distant: « quand je le coupe, il ne s'arrête
         pas » ne se lisait sur aucun écran. Même nuance que ci-dessous: une
         absence reste `null`, jamais un objet vide. */
      const stop = (assistant?.stopSpeakingPlan ?? null) as Record<string, any> | null;
      remoteStopSpeaking = stop === null ? null : {
        numWords: typeof stop.numWords === 'number' ? stop.numWords : null,
        voiceSeconds: typeof stop.voiceSeconds === 'number' ? stop.voiceSeconds : null,
      };
      const got = (assistant?.startSpeakingPlan ?? null) as Record<string, any> | null;
      remoteEndpointing = got === null ? null : {
        provider: got.smartEndpointingPlan?.provider ?? (got.smartEndpointingEnabled ? 'vapi' : 'aucun'),
        waitSeconds: typeof got.waitSeconds === 'number' ? got.waitSeconds : null,
        punctuationSeconds: typeof got.transcriptionEndpointingPlan?.onPunctuationSeconds === 'number' ? got.transcriptionEndpointingPlan.onPunctuationSeconds : null,
      };
    } catch (error) {
      console.log(`Assistant distant illisible: ${(error as Error).message}`);
    }
  }

  /* Le profil, pour savoir quel niveau DOIT servir. Illisible (client parti,
     cache froid): le niveau attendu retombe sur `base`, et la ligne le dira
     plutôt que d'accuser une resynchronisation qui n'a rien à voir. */
  const auditProfile = ours?.clientId
    ? await realtimeContextService.getClientProfile(ours.clientId).catch(() => null)
    : null;

  const language: 'fr' | 'en' | 'nl' = ours?.client ? clientLocale(ours.client) : 'fr';
  /* LE PLAN ATTENDU SE LIT AVEC LE TUNING DU NIVEAU, pas avec l'environnement
   * global (17/09/2026, soir).
   *
   * Sans le tuning, `buildStartSpeakingPlan` retombe sur `VOICE_START_WAIT_SECONDS`
   * et compare donc un assistant Superagent, qui porte 0,6 s et 0,8 s, à la
   * cible de la chaîne CLASSIQUE, 0,4 s et 0,4 s. Relevé sur un appel réel:
   * l'assistant était PARFAITEMENT à jour, la ligne l'a noté en ROUGE, et le
   * levier disait « l'assistant distant n'a pas le plan d'attente: resync » —
   * un geste qui ne pouvait rien changer puisque le resync venait justement
   * d'écrire ces valeurs-là.
   *
   * C'est 6sexvicies pour la cinquième fois, et cette fois la lecture fautive
   * datait du matin même: le plan est devenu propre au NIVEAU, et l'audit a
   * continué de le relire au niveau global. **Quand une leçon déplace un
   * champ, le code qui le LIT compte autant que celui qui l'écrit**, et c'est
   * la phrase que cette entrée répète depuis six semaines. */
  const want = buildStartSpeakingPlan(language, resolveTuning(auditProfile ? tuningFor(auditProfile) : {}));

  let recordingReadable: boolean | null = null;
  try {
    recordingReadable = !!(await vapiClient.recordingUrl(callId, 'mono'));
  } catch {
    recordingReadable = null;
  }

  /* La durée vient d'abord de ce qui a été FACTURÉ: c'est la même que celle du
     montant, donc le rapport des deux est juste même si notre colonne diverge. */
  const billedSeconds = typeof billed?.durationSeconds === 'number'
    ? billed.durationSeconds
    : ours?.durationSeconds ?? null;

  const facts: CallFacts = {
    callId,
    startedAt: vapiCall?.startedAt ?? ours?.createdAt?.toISOString() ?? null,
    endedReason: vapiCall?.endedReason ?? null,
    durationSeconds: ours?.durationSeconds ?? (vapiCall?.startedAt && vapiCall?.endedAt ? Math.round((new Date(vapiCall.endedAt).getTime() - new Date(vapiCall.startedAt).getTime()) / 1000) : null),
    ...read,
    realtime,
    ours: {
      found: !!ours,
      isLead: !!ours?.isLead,
      nameCollected: ours?.nameCollected ?? null,
      callerName: ours?.callerName ?? null,
      summary: ours?.summary ?? null,
      language,
    },
    booking: bookingRow ? { id: bookingRow.id, smsSent: bookingRow.smsConfirmationSent, smsLogs } : null,
    recordingReadable,
    cost: billed
      ? {
          usd: typeof billed.costUsd === 'number' ? billed.costUsd : null,
          breakdown: (billed.costBreakdown ?? null) as Record<string, unknown> | null,
          durationSeconds: billedSeconds,
        }
      : null,
    remote: { customLlm: remoteCustomLlm, endpointing: remoteEndpointing, speechToSpeech: remoteSpeechToSpeech, modelName: remoteModel, transcriber: remoteTranscriber, transcriberProvider: remoteSttProvider, silenceTimeoutSeconds: remoteSilenceTimeout, stopSpeaking: remoteStopSpeaking },
    expected: {
      endpointing: {
        provider: want.smartEndpointingPlan.provider,
        waitSeconds: want.waitSeconds,
        punctuationSeconds: want.transcriptionEndpointingPlan.onPunctuationSeconds,
      },
      fullModel: env.VAPI_MODEL,
      miniModel: env.VOICE_SMALL_MODEL,
      realtimeModel: env.VOICE_REALTIME_MODEL,
      minChunkChars: env.VOICE_TTS_MIN_CHUNK_CHARS,
      greetingPinned: env.VOICE_GREETING_PINNED,
      smsReady: smsReadiness().ok,
      /* Un transcripteur VOULU en parole-à-parole n'est pas un reste. */
      realtimeTranscriber: env.VOICE_REALTIME_TRANSCRIBER,
      /* Le calendrier des relances, pour le comparer au raccroché. */
      idleNudgeSeconds: env.VOICE_IDLE_NUDGE_SECONDS,
      idleNudgeCount: env.VOICE_IDLE_NUDGE_COUNT,
      /* Le forfait, pour juger la minute contre ce qu'elle rapporte. */
      planId: readPlanId(ours?.client?.planType),
      /* Le niveau DEMANDÉ vient de la fiche, celui qui DOIT servir du profil:
         `voiceForProfile` applique la priorité de la voix clonée, qui est la
         seule raison légitime d'un écart entre les deux. */
      tierRequested: requestedTier({
        voiceTier: readTierId(((ours?.client?.vapiConfig as any) || {}).voiceTier),
        voiceMode: ((ours?.client?.vapiConfig as any) || {}).voiceMode,
      }),
      tierServed: auditProfile ? voiceForProfile(auditProfile).tier.id : 'base',
    },
  };

  const report = auditCall(facts);
  const header = [
    `AUDIT D'APPEL · ${facts.startedAt ?? '?'} · ${ours?.client?.businessName ?? 'client inconnu'} (${ours?.client?.contactEmail ?? '?'})`,
    `vapiCallId ${callId} · langue ${language} · env lu: ${process.env.RENDER ? 'Render' : 'ce poste'}`,
  ];
  for (const line of renderAudit(report, header)) console.log(line);
  console.log('');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
