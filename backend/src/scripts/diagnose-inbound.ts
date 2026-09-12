/**
 * Pourquoi l'appel entrant n'a rien laissé derrière lui.
 *
 *   npm run voice:doctor                     # tous les clients actifs
 *   npm run voice:doctor -- --email=a@b.com  # un seul compte
 *
 * ## Ce qu'il répond
 *
 * Un appel entrant réel peut très bien se dérouler ET ne rien produire: la
 * conversation se joue chez Vapi, qui n'a besoin de nous pour rien tant qu'il
 * n'y a ni outil à exécuter ni rapport à livrer. Le client entend donc un agent
 * qui répond correctement, puis ne trouve aucun appel dans son tableau de bord,
 * aucune alerte, et un agent qui « prend un message » au lieu de transférer.
 * C'est arrivé le 09/09/2026, et les quatre symptômes n'avaient pas quatre
 * causes.
 *
 * Les trois questions qui les séparent, dans l'ordre où elles se posent:
 *
 *  1. L'assistant qui DÉCROCHE porte-t-il des outils ? C'est l'assistant
 *     enregistré chez Vapi, épinglé sur le numéro, et non celui que
 *     `buildAssistantForCall` compose: ce dernier ne sert qu'à répondre à
 *     `assistant-request`, que Vapi n'émet PAS quand le numéro désigne déjà un
 *     assistant. Sans outils: pas de transfert, pas de lead, donc pas d'alerte.
 *  2. Ses webhooks nous parviennent-ils ? `webhookLog` le dit sans ambiguïté:
 *     une ligne par événement reçu. Zéro ligne alors qu'un appel a eu lieu ne
 *     veut dire qu'une chose, et ce n'est jamais « Vapi n'a pas envoyé ».
 *  3. Ce que Vapi a enregistré correspond-il à ce que nous avons enregistré ?
 *     Un appel chez eux sans appel chez nous situe la perte entre les deux.
 *
 * Le script ne corrige rien. Il lit, et il nomme.
 */
import { prisma } from '../config/database';
import { env } from '../config/env';
import { vapiClient } from '../config/vapi';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/** Une ligne de constat: ce qu'on a regardé, et ce qu'il faut en faire. */
function verdict(ok: boolean, label: string, detail: string): void {
  console.log(`  ${ok ? 'OK  ' : 'NON '} ${label}`);
  if (detail) console.log(`       ${detail}`);
}

async function main() {
  const email = arg('email');

  const clients = await prisma.client.findMany({
    where: {
      ...(email ? { contactEmail: email } : { subscriptionStatus: { in: ['active', 'trialing'] } }),
      vapiAssistantId: { not: null },
    },
    select: {
      id: true,
      businessName: true,
      contactEmail: true,
      vapiAssistantId: true,
      vapiPhoneNumber: true,
      transferNumber: true,
      contactPhone: true,
      googleCalendarRefreshToken: true,
    },
    take: 20,
  });

  if (clients.length === 0) {
    console.log(email ? `\nAucun client actif pour ${email}.\n` : '\nAucun client actif avec un assistant.\n');
    return;
  }

  console.log(`\nVAPI_WEBHOOK_SECRET: ${env.VAPI_WEBHOOK_SECRET ? 'définie' : 'ABSENTE'}`);
  console.log(`API_BASE_URL: ${env.API_BASE_URL}`);

  /* La liste des numéros est relue UNE fois: elle couvre tout le compte, et la
     redemander par client ferait autant d'allers-retours que de clients pour
     la même réponse. */
  let numbers: Array<Record<string, any>> = [];
  try {
    numbers = (await vapiClient.listPhoneNumbers()) as Array<Record<string, any>>;
  } catch (error) {
    console.log(`\nListe des numéros Vapi illisible: ${(error as Error).message}`);
  }

  for (const client of clients) {
    console.log(`\n── ${client.businessName} (${client.contactEmail}) ─────────────`);

    // 1. L'assistant distant, tel que Vapi le détient VRAIMENT.
    let assistant: Record<string, any> | null = null;
    try {
      assistant = (await vapiClient.getAssistant(client.vapiAssistantId!)) as Record<string, any>;
    } catch (error) {
      verdict(false, 'assistant lisible chez Vapi', (error as Error).message);
    }

    if (assistant) {
      /* Les outils vivent dans `model.tools`, PAS à la racine (6novodecies).
       *
       * Ce script lisait la racine, et c'est un mensonge coûteux: Vapi REFUSE
       * un `tools` racine (« property tools should not exist »), donc un
       * assistant distant n'en a jamais. Le docteur annonçait donc « 0 outil »
       * à tout le monde, pour toujours, y compris sur un assistant
       * parfaitement configuré, et son conseil (« enregistrer les paramètres
       * resynchronise l'assistant ») envoyait refaire un geste qui ne
       * changeait rien. Un diagnostic faux coûte plus cher qu'aucun
       * diagnostic: on cherche la panne là où elle n'est pas.
       *
       * La racine est encore lue, mais seulement pour SIGNALER l'anomalie:
       * si elle contenait quoi que ce soit, c'est que Vapi aurait accepté un
       * champ qu'il refuse, et il faudrait le savoir. */
      const modelTools = Array.isArray(assistant.model?.tools) ? assistant.model.tools : [];
      const rootTools = Array.isArray(assistant.tools) ? assistant.tools : [];
      if (rootTools.length > 0) {
        verdict(false, 'outils à la RACINE de l\'assistant', 
          `${rootTools.length} outil(s) à un emplacement que Vapi refuse normalement. À signaler.`);
      }
      const tools = modelTools;
      const names = tools.map((t: any) => (t?.type === 'function' ? t?.function?.name : t?.type)).filter(Boolean);
      verdict(
        tools.length > 0,
        `outils sur l'assistant qui décroche (${tools.length})`,
        tools.length > 0
          ? names.join(', ')
          : "aucun outil: l'agent ne peut ni transférer, ni enregistrer un lead, ni lire la base de connaissances. "
            + 'Relancer `npm run voice:resync -- --email=... --confirm`, qui dit ce que Vapi répond.',
      );

      const expected = `${env.API_BASE_URL}/api/webhooks/vapi/client/${client.id}`;
      const actual = assistant.serverUrl || assistant.server?.url || '';
      verdict(
        actual === expected,
        'adresse de webhook',
        actual === expected ? actual : `distant: ${actual || '(vide)'}\n       attendu: ${expected}`,
      );

      /* QUELLE VOIX PARLE, et ce n'est pas une question de confort.
       *
       * Le client peut croire sa flotte passée chez Cartesia et s'entendre
       * répondre par ElevenLabs, parce que trois réglages décident: la voix
       * choisie dans le portail (qui court-circuite tout), le réglage par
       * client, puis `VOICE_TTS_PROVIDER`, qui vaut « 11labs » s'il n'est pas
       * posé. Aucun des trois ne se voit, et le seul indice était une ligne
       * `[Greeting] ... 401` dans les journaux, qui ne nomme pas la cause.
       * D'où la comparaison: la signature calculée par la MÊME fonction que
       * l'appel, contre ce que l'assistant DISTANT porte vraiment. Un écart
       * dit que l'assistant enregistré est périmé, pas que le réglage est
       * faux — ce sont deux gestes différents. */
      const { realtimeContextService } = await import('../services/voice/realtime-context.service');
      const { voiceSignatureFor } = await import('../services/voice/greeting-audio.service');
      const profile = await realtimeContextService.getClientProfile(client.id).catch(() => null);
      const remote = assistant.voice ?? {};
      const remoteVoice = `${remote.provider ?? '(aucun)'} / ${remote.voiceId ?? '(aucune)'} / ${remote.model ?? '(aucun)'}`;
      if (!profile) {
        verdict(false, 'voix de l\'assistant qui décroche', `distant: ${remoteVoice}. Profil illisible, rien à comparer.`);
      } else {
        const want = voiceSignatureFor(profile);
        const same = remote.provider === want.provider && remote.voiceId === want.voiceId;
        verdict(
          same,
          `voix de l'assistant qui décroche (${remote.provider ?? 'aucune'})`,
          same
            ? remoteVoice
            : `distant: ${remoteVoice}\n       attendu: ${want.provider} / ${want.voiceId} / ${want.model}`
              + `\n       L'assistant enregistré est périmé: \`npm run voice:resync -- --email=${client.contactEmail} --confirm\`.`,
        );
        /* Le réglage lui-même, dit en clair: « attendu 11labs » alors que le
           client croit être chez Cartesia n'est pas une panne de
           synchronisation, c'est le réglage qui n'a jamais basculé. */
        if (want.provider !== 'cartesia' && env.CARTESIA_API_KEY) {
          /* LE MOTIF, pas seulement l'écart. Relevé du 12/09:
             `VOICE_TTS_PROVIDER=cartesia` était bien posé, et la ligne parlait
             quand même chez ElevenLabs. Le docteur disait « le choix vient de
             la voix du portail, sinon du réglage client, sinon de
             VOICE_TTS_PROVIDER »: les trois endroits où chercher, donc une
             liste et pas une réponse. Les quatre causes demandent quatre
             gestes, dont un qui consiste à ne rien faire (un clone ne PEUT pas
             quitter ElevenLabs).
             Le motif voyage avec la signature, il n'est pas recalculé ici:
             relire la règle de personnage une seconde fois est ce que le test
             de ce script interdit, et c'est lui qui l'a attrapé. */
          verdict(
            false,
            'réglage de synthèse',
            `une clé Cartesia est posée mais cette ligne parle chez ElevenLabs.\n       motif: ${want.why}.`
              + `\n       (VOICE_TTS_PROVIDER = « ${env.VOICE_TTS_PROVIDER} », réglage de ce client = « ${profile.ttsProvider ?? 'aucun'} »)`,
          );
        }
      }

      const hasTransfer = tools.some((t: any) => t?.type === 'transferCall');
      /* CE QUE L'ASSISTANT DIT EN PREMIER, et si c'est une URL, si elle répond.
         Deux appels entrants `silence-timed-out` le 12/09/2026: l'assistant
         enregistré portait l'URL de l'accueil pré-enregistré (LAT-7), jamais
         exercée sur un vrai appel jusque-là. Un texte est synthétisé par Vapi
         à coup sûr; une URL dépend de ce que Vapi en fait, et de ce que notre
         route sert. Le docteur lit donc la première phrase DISTANTE et, pour
         une URL, va la chercher comme Vapi le ferait. */
      const first = String(assistant.firstMessage ?? '');
      if (/^https?:\/\//.test(first)) {
        let served = 'injoignable';
        try {
          const r = await fetch(first, { method: 'GET' });
          const bytes = Number(r.headers.get('content-length') ?? (await r.arrayBuffer()).byteLength);
          served = `${r.status} ${r.headers.get('content-type') ?? '(sans type)'} ${bytes} octets`;
        } catch (error) {
          served = `injoignable: ${(error as Error).message}`;
        }
        verdict(
          false,
          "première phrase: une URL audio (accueil pré-enregistré)",
          `${first}\n       servie: ${served}\n       Non prouvée sur un appel réel; `
            + '`VOICE_GREETING_PINNED` absent ou « false » puis `npm run voice:resync` repasse au texte, que Vapi synthétise.',
        );
      } else {
        verdict(first.trim().length > 0, 'première phrase: un texte', first ? `« ${first.slice(0, 90)}${first.length > 90 ? '…' : ''} »` : "vide: l'assistant attendrait l'appelant.");
      }

      verdict(
        hasTransfer,
        'transfert vers un humain',
        hasTransfer
          ? `vers ${tools.find((t: any) => t?.type === 'transferCall')?.destinations?.[0]?.number}`
          : client.transferNumber
            ? `numéro de transfert enregistré (${client.transferNumber}) mais absent de l'assistant distant.`
            : "aucun numéro de transfert dans les paramètres: l'agent prendra un message, par construction.",
      );
    }

    // 2. Le numéro entrant, et l'assistant qu'il désigne.
    const line = numbers.find(n => n.number === client.vapiPhoneNumber);
    if (!client.vapiPhoneNumber) {
      verdict(false, 'ligne entrante', 'aucun numéro attribué à ce client.');
    } else if (!line) {
      verdict(false, 'ligne entrante', `${client.vapiPhoneNumber} inconnu chez Vapi: il sonne dans le vide.`);
    } else {
      verdict(
        line.assistantId === client.vapiAssistantId,
        `ligne ${client.vapiPhoneNumber}`,
        line.assistantId === client.vapiAssistantId
          ? "rattachée à l'assistant de ce client."
          : `rattachée à ${line.assistantId || '(aucun assistant)'}, pas à ${client.vapiAssistantId}.`,
      );
    }

    // 3. Les webhooks reçus. C'est la question qui tranche.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [received, calls] = await Promise.all([
      prisma.webhookLog.count({ where: { source: 'vapi', createdAt: { gte: since } } }),
      prisma.clientCall.count({ where: { clientId: client.id, createdAt: { gte: since } } }),
    ]);
    verdict(
      received > 0,
      `webhooks Vapi reçus (7 jours, toute la flotte): ${received}`,
      received > 0
        ? ''
        : "aucun événement reçu de Vapi. Si un appel a bien eu lieu, l'endpoint les REFUSE: "
          + 'le secret `x-vapi-secret` attendu par le serveur ne correspond pas à celui que Vapi envoie '
          + '(réglé dans le tableau de bord Vapi, section Server URL). Sans lui, tout est rejeté en 401.',
    );
    verdict(calls > 0, `appels enregistrés pour ce client (7 jours): ${calls}`, '');
  }

  // 4. Ce que Vapi a vu, pour situer la perte.
  try {
    const recent = (await vapiClient.listCalls(10)) as Array<Record<string, any>>;
    const ours = new Set(clients.map(c => c.vapiAssistantId));
    const mine = recent.filter(c => ours.has(c.assistantId));
    console.log(`\n── Derniers appels chez Vapi (${mine.length} sur ${recent.length} pour ces clients) ──`);
    for (const call of mine) {
      const known = await prisma.clientCall.findFirst({ where: { vapiCallId: call.id }, select: { id: true } });
      /* Ce que l'assistant a DIT: un `silence-timed-out` sans une seule
         réplique de l'assistant, c'est la première phrase qui n'est pas partie
         (URL audio muette, voix refusée), pas un appelant silencieux. */
      const seen = await callReading(call.id);
      const ours = await prisma.clientCall.findFirst({ where: { vapiCallId: call.id }, select: { recordingUrl: true } });
      console.log(
        `  ${call.startedAt || call.createdAt} · ${call.type || 'inbound'} · ${call.endedReason || '?'}` +
          `  ${known ? 'enregistré chez nous' : 'ABSENT de notre base'}` +
          (seen === null ? '' : seen.said === 0 ? " · L'ASSISTANT N'A RIEN DIT" : ` · ${seen.said} réplique(s) de l'assistant`) +
          /* L'ENREGISTREMENT, des deux côtés: « impossible d'écouter les
             appels » (12/09) est soit Vapi qui n'en rend pas (assistant sans
             `recordingEnabled`), soit nous qui le refusons ou le perdons. */
          (seen === null ? '' : ` · enregistrement: Vapi ${seen.recording ? 'oui' : 'NON'} / chez nous ${ours?.recordingUrl ? 'oui' : 'NON'}`),
      );
      /* Les OUTILS du dernier appel, avec leurs arguments et leurs réponses:
         c'est ce qui dit à quelle heure l'agent a réellement réservé, et ce
         que l'agenda lui a répondu. Sans ça, on devine. */
      if (call === mine[0] && seen?.tools.length) {
        for (const line of seen.tools) console.log(`      ${line}`);
      }
    }
  } catch (error) {
    console.log(`\nListe des appels Vapi illisible: ${(error as Error).message}`);
  }

  console.log('');
}

/**
 * Ce qu'un appel a VRAIMENT contenu chez Vapi: répliques de l'assistant,
 * enregistrement, et appels d'outils avec leurs arguments et leurs réponses.
 * `null` si l'appel est illisible.
 */
async function callReading(callId: string): Promise<{ said: number; recording: boolean; tools: string[] } | null> {
  try {
    const full = (await vapiClient.getCall(callId)) as Record<string, any>;
    const messages: Array<Record<string, any>> = full?.artifact?.messages ?? full?.messages ?? [];
    const said = messages.filter(m => m.role === 'bot' || m.role === 'assistant').length;
    const recording = !!(full?.artifact?.recordingUrl || full?.recordingUrl || full?.artifact?.recording?.mono?.combinedUrl);
    const tools: string[] = [];
    for (const m of messages) {
      if (m.role === 'tool_calls' && Array.isArray(m.toolCalls)) {
        for (const c of m.toolCalls) {
          tools.push(`→ ${c.function?.name ?? c.name ?? '?'} ${String(c.function?.arguments ?? '').slice(0, 160)}`);
        }
      } else if (m.role === 'tool_call_result') {
        tools.push(`← ${m.name ?? '?'}: ${String(m.result ?? '').slice(0, 160)}`);
      }
    }
    return { said, recording, tools };
  } catch {
    return null;
  }
}

/** Compatibilité avec le test de source: le compte des répliques passe par `callReading`. */
async function assistantLines(callId: string): Promise<number | null> {
  return (await callReading(callId))?.said ?? null;
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
