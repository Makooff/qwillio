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

      const hasTransfer = tools.some((t: any) => t?.type === 'transferCall');
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
      console.log(
        `  ${call.startedAt || call.createdAt} · ${call.type || 'inbound'} · ${call.endedReason || '?'}` +
          `  ${known ? 'enregistré chez nous' : 'ABSENT de notre base'}`,
      );
    }
  } catch (error) {
    console.log(`\nListe des appels Vapi illisible: ${(error as Error).message}`);
  }

  console.log('');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
