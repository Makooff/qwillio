/**
 * `npm run voice:audit [-- --call=<vapiCallId>] [-- --email=<client>]`
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
import { buildStartSpeakingPlan } from '../services/voice/speech-plans';
import { clientLocale } from '../utils/client-locale';
import { auditCall, readVapiMessages, renderAudit, type CallFacts } from '../services/voice/call-audit';
import { voiceForProfile } from '../services/voice/profile-voice';
import { readTierId, requestedTier } from '../services/voice/voice-tiers';
import { realtimeContextService } from '../services/voice/realtime-context.service';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

async function main() {
  const wantedCall = arg('call');
  const email = arg('email');

  const ours = await prisma.clientCall.findFirst({
    where: {
      vapiCallId: wantedCall ? wantedCall : { not: null },
      ...(email ? { client: { contactEmail: email } } : {}),
    },
    orderBy: { createdAt: 'desc' },
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
      client: { select: { businessName: true, contactEmail: true, vapiAssistantId: true, country: true, agentLanguage: true, vapiConfig: true } },
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
  let remoteTranscriber: boolean | null = null;
  let remoteSilenceTimeout: number | null = null;
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
      /* Le transcripteur DISTANT, à part: c'est lui qui distingue « le niveau
         n'a pas été écrit » de « un reste l'annule ». Voir `remote.transcriber`
         dans `call-audit.ts`. */
      remoteTranscriber = !!assistant?.transcriber;
      /* Le délai de RACCROCHÉ, lu sur l'assistant distant. Il ne figurait sur
         aucun écran, et c'est lui qui a tué six appels de test d'affilée. */
      remoteSilenceTimeout = typeof assistant?.silenceTimeoutSeconds === 'number'
        ? assistant.silenceTimeoutSeconds : null;
      /* PAS de plan distant reste `null`, et la nuance porte tout: un objet
         rempli de « aucun » et de `null` se lit comme un plan, donc l'audit
         annonçait « reste d'une synchronisation classique » sur un assistant
         temps réel qui n'en porte aucun — précisément l'état qu'on VEUT. Le
         `?? {}` transformait une absence en présence vide (17/09/2026). */
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
  const want = buildStartSpeakingPlan(language);

  let recordingReadable: boolean | null = null;
  try {
    recordingReadable = !!(await vapiClient.recordingUrl(callId, 'mono'));
  } catch {
    recordingReadable = null;
  }

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
    remote: { customLlm: remoteCustomLlm, endpointing: remoteEndpointing, speechToSpeech: remoteSpeechToSpeech, transcriber: remoteTranscriber, silenceTimeoutSeconds: remoteSilenceTimeout },
    expected: {
      endpointing: {
        provider: want.smartEndpointingPlan.provider,
        waitSeconds: want.waitSeconds,
        punctuationSeconds: want.transcriptionEndpointingPlan.onPunctuationSeconds,
      },
      fullModel: env.VAPI_MODEL,
      miniModel: env.VOICE_SMALL_MODEL,
      minChunkChars: env.VOICE_TTS_MIN_CHUNK_CHARS,
      greetingPinned: env.VOICE_GREETING_PINNED,
      smsReady: smsReadiness().ok,
      /* Un transcripteur VOULU en parole-à-parole n'est pas un reste. */
      realtimeTranscriber: env.VOICE_REALTIME_TRANSCRIBER,
      /* Le calendrier des relances, pour le comparer au raccroché. */
      idleNudgeSeconds: env.VOICE_IDLE_NUDGE_SECONDS,
      idleNudgeCount: env.VOICE_IDLE_NUDGE_COUNT,
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
