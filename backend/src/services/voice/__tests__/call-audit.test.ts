import { describe, it, expect } from 'vitest';
import { auditCall, chunkableReplies, readVapiMessages, renderAudit, TARGETS, tierTurns, vapiHopMs, type CallFacts } from '../call-audit';

/**
 * L'audit tranche sur des faits: un appel qui a tout fait est vert, un
 * appel qui a annoncé une réservation sans la prendre est rouge sur la
 * ligne « réservation » avec le levier qui nomme la cause, et la latence
 * hors cible désigne l'étage et la variable à toucher.
 */

const good = (): CallFacts => ({
  callId: 'call_1',
  startedAt: '2026-09-16T08:00:00.000Z',
  endedReason: 'customer-ended-call',
  durationSeconds: 95,
  assistantLines: 8,
  /* Cinq répliques portent une fin de phrase au-delà de 60 caractères, donc
     cinq sont découpables: c'est le plafond contre lequel `streamed` se note. */
  assistantTexts: [
    'Cabinet Martin, bonjour. Je suis Lucas, votre assistant IA. Cet appel est enregistré. Que puis-je faire pour vous ?',
    'Je regarde ça tout de suite.',
    'Pour vendredi je peux vous proposer neuf heures ou dix heures, laquelle préférez-vous ? Je vous les redonne si besoin.',
    'Un instant, je m\'en occupe.',
    "C'est bien réservé pour le vendredi 18 septembre à 10 heures, Jean-Luc. Vous allez recevoir un SMS de confirmation.",
    'Très bien, je note votre demande et je vous rappelle rapidement. Autre chose pour vous aujourd\'hui ?',
    "Je vous confirme que tout est en ordre de notre côté, vous recevrez le message d'ici quelques instants.",
    'Au revoir.',
  ],
  callerLines: 7,
  vapiGapsSeconds: [1.4, 1.6, 1.2, 1.9],
  tools: [
    { name: 'checkAvailability', args: { date: '2026-09-18' }, result: 'CRENEAUX: 09:00, 10:00', tookSeconds: 0.6, atSeconds: 12 },
    { name: 'bookAppointment', args: { customerName: 'Jean-Luc de la Forge', date: '2026-09-18', time: '10:00' }, result: 'RESERVE: Jean-Luc de la Forge, le vendredi 18 septembre a 10:00.', tookSeconds: 0.4, atSeconds: 40 },
    { name: 'captureLead', args: { name: 'Jean-Luc de la Forge' }, result: 'ok', tookSeconds: 0.2, atSeconds: 60 },
  ],
  realtime: {
    models: { 'gpt-4.1-mini-2025-04-14': 6 },
    llmFailures: [],
    tokens: { input: 30_000, cached: 21_000, output: 500 },
    deflectedTurns: 1,
    callerTurns: 7,
    disclosureSpoken: true,
    latency: {
      prep: { count: 6, median: 40, p95: 90, max: 90 },
      llm: { count: 6, median: 650, p95: 900, max: 900 },
      ttfa: { count: 5, median: 450, p95: 600, max: 600 },
      total: { count: 5, median: 1500, p95: 1900, max: 1900 },
      streaming: { streamed: 4, buffered: 1 },
      toolTurns: 2,
    },
  },
  ours: { found: true, isLead: true, nameCollected: 'Jean-Luc de la Forge', callerName: 'Jean Lucas', summary: 'Prise de rendez-vous pour un détartrage.', language: 'fr' },
  booking: { id: 'bk_0000001', smsSent: true, smsLogs: [{ status: 'sent', errorMsg: null }] },
  recordingReadable: true,
  /* Un appel sain sur le mini: 0,11 €/min, sous la recette de tous les
     paliers. La vérification est donc exercée par TOUS les autres tests, au
     lieu d'être sautée faute de donnée. */
  cost: { usd: 0.24, breakdown: { vapi: 0.09, llm: 0.11, transport: 0.02 }, durationSeconds: 120 },
  remote: { customLlm: true, endpointing: { provider: 'livekit', waitSeconds: 0.4, punctuationSeconds: 0.4 }, speechToSpeech: false },
  expected: {
    endpointing: { provider: 'livekit', waitSeconds: 0.4, punctuationSeconds: 0.4 },
    fullModel: 'gpt-4.1-mini',
    miniModel: 'gpt-4.1-nano',
    minChunkChars: 60,
    greetingPinned: false,
    tierRequested: null,
    tierServed: 'base',
    smsReady: true,
  },
});

describe('auditCall — un appel qui a tout fait', () => {
  it('est vert partout, sans rien à faire', () => {
    const report = auditCall(good());
    expect(report.works).toBe(true);
    expect(report.todo).toEqual([]);
    expect(report.checks.filter(c => c.status === 'fail')).toEqual([]);
    const lines = renderAudit(report);
    expect(lines).toContain("L'appel a fait son travail.");
    expect(lines).toContain('Rien à régler sur cet appel.');
  });
});

describe('auditCall — fonctionnement', () => {
  it('une réservation annoncée sans ligne en base est un défaut nommé', () => {
    const f = good();
    f.booking = null;
    const report = auditCall(f);
    const booking = report.checks.find(c => c.id === 'booking')!;
    expect(booking.status).toBe('warn');
    expect(booking.value).toMatch(/AUCUNE ligne en base/);
  });

  it('bookAppointment appelé avec un nom bidon: rouge, et le levier nomme le nom', () => {
    const f = good();
    f.tools = [
      { name: 'checkAvailability', args: {}, result: 'CRENEAUX: 09:00', tookSeconds: 0.5 },
      { name: 'bookAppointment', args: { customerName: 'client', date: '2026-09-18', time: '09:00' }, result: "RIEN N'EST RESERVE: il manque le nom", tookSeconds: 0.1 },
    ];
    f.booking = null;
    const report = auditCall(f);
    const booking = report.checks.find(c => c.id === 'booking')!;
    expect(booking.status).toBe('fail');
    expect(booking.lever).toMatch(/nom bidon.*client/);
    expect(report.works).toBe(false);
    expect(report.todo[0].id).toBe('booking');
  });

  it('des créneaux consultés sans réservation: à surveiller, pas rouge', () => {
    const f = good();
    f.tools = [{ name: 'checkAvailability', args: {}, result: 'CRENEAUX: 09:00', tookSeconds: 0.5 }];
    f.booking = null;
    const booking = auditCall(f).checks.find(c => c.id === 'booking')!;
    expect(booking.status).toBe('warn');
    expect(booking.value).toMatch(/jamais appelé/);
  });

  it('un SMS refusé porte l\'erreur Twilio et son levier', () => {
    const f = good();
    f.booking = { id: 'bk_1', smsSent: false, smsLogs: [{ status: 'failed', errorMsg: "Invalid 'To' Phone Number [21211]" }] };
    const sms = auditCall(f).checks.find(c => c.id === 'sms')!;
    expect(sms.status).toBe('fail');
    expect(sms.value).toMatch(/21211/);
    expect(sms.lever).toMatch(/21211/);
  });

  it('sans SMS configuré, le SMS manquant n\'est qu\'une alerte', () => {
    const f = good();
    f.expected.smsReady = false;
    f.booking = { id: 'bk_1', smsSent: false, smsLogs: [] };
    expect(auditCall(f).checks.find(c => c.id === 'sms')!.status).toBe('warn');
  });

  it('un silence-timed-out sans réplique de l\'assistant désigne l\'accueil', () => {
    const f = good();
    f.endedReason = 'silence-timed-out';
    f.assistantLines = 0;
    const report = auditCall(f);
    expect(report.works).toBe(false);
    expect(report.checks.find(c => c.id === 'ended')!.lever).toMatch(/accueil/);
    expect(report.checks.find(c => c.id === 'spoke')!.status).toBe('fail');
  });

  it('les tours en repli sont rouges avec leur raison', () => {
    const f = good();
    f.realtime!.llmFailures = ['OpenAI responded 400: Unrecognized request argument', 'OpenAI responded 400: Unrecognized request argument'];
    const c = auditCall(f).checks.find(x => x.id === 'fallbacks')!;
    expect(c.status).toBe('fail');
    expect(c.value).toBe('OpenAI responded 400: Unrecognized request argument ×2');
  });

  it('un assistant distant en openai est un défaut de fonctionnement avec la commande de resync', () => {
    const f = good();
    f.remote.customLlm = false;
    const c = auditCall(f).checks.find(x => x.id === 'custom-llm')!;
    expect(c.status).toBe('fail');
    expect(c.lever).toMatch(/voice:resync/);
  });

  it('un nom seulement entendu, jamais confirmé, est signalé', () => {
    const f = good();
    f.ours.nameCollected = null;
    const c = auditCall(f).checks.find(x => x.id === 'name')!;
    expect(c.status).toBe('warn');
    expect(c.value).toMatch(/entendu seulement: Jean Lucas/);
  });
});

describe('auditCall — latence', () => {
  it('un LLM lent avec un cache à 0 % désigne le cache en premier', () => {
    const f = good();
    f.realtime!.latency.llm = { count: 6, median: 1800, p95: 2600, max: 2600 };
    f.realtime!.tokens = { input: 30_000, cached: 0, output: 500 };
    const report = auditCall(f);
    expect(report.checks.find(c => c.id === 'llm')!.status).toBe('fail');
    const cache = report.checks.find(c => c.id === 'cache')!;
    expect(cache.status).toBe('fail');
    expect(cache.lever).toMatch(/cacheablePrefixChars/);
  });

  it('un cache bas sur deux tours n\'est pas jugé', () => {
    const f = good();
    f.realtime!.models = { 'gpt-4.1-mini-2025-04-14': 2 };
    f.realtime!.tokens = { input: 8_000, cached: 3_000, output: 100 };
    expect(auditCall(f).checks.find(c => c.id === 'cache')!.status).toBe('skip');
  });

  it('le délai ressenti se DÉCOUPE: ce qui est à nous, et la détection de fin de tour', () => {
    /* Retour du 17/09/2026: « les outils longs ne me dérangent pas, ça fait
       réaliste; ce qui me dérange, c'est qu'après ma phrase il attend une ou
       deux secondes ». Ce délai n'est ni les outils ni le modèle: il est en
       AMONT de notre serveur, et il n'apparaissait sur aucune ligne. */
    const f = good();
    f.vapiGapsSeconds = [2.4, 2.5, 2.6];
    f.realtime!.latency.prep = { count: 9, median: 1, p95: 300, max: 300 };
    f.realtime!.latency.llm = { count: 9, median: 941, p95: 1500, max: 1500 };
    f.realtime!.latency.ttfa = { count: 9, median: 342, p95: 800, max: 800 };
    const c = auditCall(f).checks.find(x => x.id === 'turn-detect')!;
    /* 2 500 - (1 + 941 + 342) = 1 216 ms passés à décider qu'on a fini. */
    expect(c.value).toMatch(/1216 ms des 2500 ms/);
    expect(c.status).toBe('fail');
    /* Les seuils posés (0,4 + 0,4 = 800 ms) plus la marge du transcripteur
       expliquent ces 1 216 ms: le levier nomme donc le PLANCHER à baisser, et
       dit lequel garder. */
    expect(c.value).toMatch(/cohérent avec les seuils posés/);
    expect(c.lever).toMatch(/VOICE_START_WAIT_SECONDS/);
    expect(c.lever).toMatch(/GARDER `VOICE_ENDPOINTING_PUNCTUATION_SECONDS`/);
  });

  it("un délai que les seuils n'expliquent pas ne renvoie PAS aux seuils", () => {
    /* Sinon on baisse un plancher qui n'est pas la cause, et on coupe la
       parole pour rien. */
    const f = good();
    f.vapiGapsSeconds = [4.0, 4.2];
    f.realtime!.latency.prep = { count: 9, median: 1, p95: 300, max: 300 };
    f.realtime!.latency.llm = { count: 9, median: 900, p95: 1500, max: 1500 };
    f.realtime!.latency.ttfa = { count: 9, median: 300, p95: 800, max: 800 };
    const c = auditCall(f).checks.find(x => x.id === 'turn-detect')!;
    expect(c.value).toMatch(/de PLUS que les seuils posés/);
    expect(c.lever).toMatch(/NO_PUNCTUATION/);
    expect(c.lever).not.toMatch(/VOICE_START_WAIT_SECONDS/);
  });

  it('une détection de fin de tour rapide ne propose aucun levier', () => {
    const f = good();
    f.vapiGapsSeconds = [1.2, 1.3];
    f.realtime!.latency.prep = { count: 9, median: 1, p95: 50, max: 50 };
    f.realtime!.latency.llm = { count: 9, median: 600, p95: 900, max: 900 };
    f.realtime!.latency.ttfa = { count: 9, median: 300, p95: 400, max: 400 };
    const c = auditCall(f).checks.find(x => x.id === 'turn-detect')!;
    expect(c.status).toBe('ok');
    expect(c.lever).toBeUndefined();
  });

  it('un agenda lent désigne la spéculation', () => {
    const f = good();
    f.tools[0].tookSeconds = 2.8;
    const c = auditCall(f).checks.find(x => x.id === 'tools')!;
    expect(c.status).toBe('fail');
    expect(c.lever).toMatch(/spéculation/);
  });

  it('sans relevé, chaque étage est dit non mesuré, jamais rouge', () => {
    const f = good();
    f.realtime = null;
    const report = auditCall(f);
    for (const id of ['prep', 'llm', 'ttfa', 'total']) expect(report.checks.find(c => c.id === id)!.status).toBe('skip');
    expect(report.checks.find(c => c.id === 'custom-llm')!.status).toBe('warn');
  });

  it('les cibles sont celles annoncées', () => {
    expect(TARGETS.totalMs[0]).toBe(2000);
    expect(TARGETS.llmMs[0]).toBe(900);
  });
});

describe('auditCall — réglages', () => {
  it('un assistant distant périmé sur la fin de tour renvoie au resync', () => {
    const f = good();
    f.remote.endpointing = { provider: 'vapi', waitSeconds: 0.12, punctuationSeconds: 0.1 };
    const c = auditCall(f).checks.find(x => x.id === 'endpointing')!;
    expect(c.status).toBe('fail');
    expect(c.lever).toMatch(/voice:resync/);
  });

  it('deux étages de modèle identiques: alerte avec la variable à poser', () => {
    const f = good();
    f.expected.miniModel = 'gpt-4.1-mini';
    const c = auditCall(f).checks.find(x => x.id === 'tiers')!;
    expect(c.status).toBe('warn');
    expect(c.lever).toMatch(/VOICE_SMALL_MODEL/);
  });

  it('deux étages différents: la ligne DIT ce que le rapide a servi', () => {
    /* Le compte vient de `models`, donc du flux d'OpenAI, et le nom y est
       DATÉ: c'est ce qui fait qu'une égalité stricte compterait zéro. */
    const f = good();
    f.realtime!.models = { 'gpt-4.1-mini-2025-04-14': 4, 'gpt-4.1-nano-2025-04-14': 3 };
    const c = auditCall(f).checks.find(x => x.id === 'tiers')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/3 tour\(s\) sur 7/);
    expect(c.lever).toBeUndefined();
  });

  it("zéro tour rapide n'est PAS un défaut, et la ligne dit pourquoi", () => {
    /* `good()` est un appel parfait QUI A APPELÉ DES OUTILS: dès le premier,
       tout l'historique en porte un et chaque tour suivant prend le modèle
       complet. Noter ça en orange remettrait le faux positif que cette ligne
       existe pour retirer (6novoquadragesies). */
    const c = auditCall(good()).checks.find(x => x.id === 'tiers')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/0 tour\(s\) sur 6/);
    expect(c.value).toMatch(/normal dès qu'un outil a tourné/);
    expect(c.lever).toBeUndefined();
  });

  it("sans outil, la ligne ne nomme PAS l'outil comme cause", () => {
    /* Zéro tour rapide sur un appel sans outil vient d'ailleurs: donner la
       raison de l'autre cas serait inventer une lecture (6quinvicies). */
    const f = good();
    f.tools = [];
    const c = auditCall(f).checks.find(x => x.id === 'tiers')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/0 tour\(s\) sur 6/);
    expect(c.value).not.toMatch(/outil a tourné/);
  });

  it('la latence ne renvoie plus à `VOICE_SMALL_MODEL` quand il ne sert rien', () => {
    /* Le geste ne changerait rien sur un appel où aucun tour ne descend au
       rapide: le nommer envoie chercher le gain là où il n'est pas. */
    const f = good();
    f.realtime!.latency.llm = { count: 6, median: 1465, p95: 1800, max: 1800 };
    const c = auditCall(f).checks.find(x => x.id === 'llm')!;
    expect(c.status).not.toBe('ok');
    expect(c.lever).toMatch(/pas `VOICE_SMALL_MODEL`/);

    /* Et il le nomme de nouveau dès qu'un tour y est réellement passé. */
    f.realtime!.models = { 'gpt-4.1-mini-2025-04-14': 4, 'gpt-4.1-nano-2025-04-14': 2 };
    const c2 = auditCall(f).checks.find(x => x.id === 'llm')!;
    expect(c2.lever).toMatch(/enfin `VOICE_SMALL_MODEL`/);
  });

  it('l\'annonce IA absente est un défaut', () => {
    const f = good();
    f.realtime!.disclosureSpoken = false;
    expect(auditCall(f).checks.find(x => x.id === 'disclosure')!.status).toBe('fail');
  });
});

/**
 * LA MESURE INDÉPENDANTE DU RÉGLAGE (17/09/2026).
 *
 * « Il coupe trop » se lit dans le TRANSCRIPT, pas dans la configuration:
 * l'agent répond à un blanc au milieu de la phrase, puis répond une seconde
 * fois quand l'appelant a vraiment fini. Deux réponses pour un tour. Un appel
 * réel de 108 s en portait quatre, pour 13 répliques et 10 tours d'appelant,
 * pendant que la ligne de réglage affichait « tout va bien » en vert.
 *
 * C'est la leçon des quatre plafonds de cet audit (6terquinquagesies): un
 * chiffre qu'aucune autre source ne peut contredire ne prouve rien.
 */
/**
 * LE BRIEF D'OUVERTURE, VU OU PAS VU (17/09/2026).
 *
 * « Il me redemande mon nom à chaque fois alors que c'est relié à mon
 * numéro. » Sans cette ligne, ce retour ne distingue pas deux pannes opposées:
 * le brief n'est PAS parti (pas d'adresse de contrôle, Vapi qui refuse
 * `add-message`), ou il est parti et le modèle l'ignore. Le premier se répare
 * dans le webhook, le second dans le prompt, et se tromper coûte un cycle.
 */
describe('auditCall — le brief d\'ouverture', () => {
  const s2s = (callBrief: unknown) => {
    const f = good();
    f.remote.speechToSpeech = true;
    f.realtime = { ...(f.realtime ?? {}), callBrief };
    return auditCall(f).checks.find(c => c.id === 'brief')!;
  };

  it('posé avec des rendez-vous: vert', () => {
    expect(s2s('pose (3 appels, 1 rdv)').status).toBe('ok');
  });

  it('jamais tenté: DÉFAUT, et le levier renvoie aux journaux, pas au prompt', () => {
    const c = s2s(undefined);
    expect(c.status).toBe('fail');
    expect(c.value).toMatch(/JAMAIS TENTÉ/);
    expect(c.lever).toMatch(/journaux Render/);
    /* Et surtout: il dit que ça ne se répare PAS dans le prompt. Un levier
       qui envoie au mauvais endroit coûte plus cher qu'aucun levier. */
    expect(c.lever).toMatch(/ne se réparent? dans le prompt|aucun des trois ne se répare dans le prompt/);
  });

  it('refusé par Vapi: défaut, et la raison est dite telle quelle', () => {
    const c = s2s('REFUSE: VAPI control error (404)');
    expect(c.status).toBe('fail');
    expect(c.value).toMatch(/404/);
  });

  it("sans objet sur le chemin custom-LLM: `llm-stream` repose la mémoire à chaque tour", () => {
    const f = good();
    f.remote.speechToSpeech = false;
    f.remote.customLlm = true;
    expect(auditCall(f).checks.find(c => c.id === 'brief')!.status).toBe('skip');
  });
});

describe('readVapiMessages — répliques doublées', () => {
  it('compte une réplique qui suit une réplique, sans que l\'appelant ait parlé', () => {
    const read = readVapiMessages([
      { role: 'user', message: 'je voudrais déplacer mon rendez-vous' },
      { role: 'bot', message: 'Quel serait le prénom et le nom de famille' },
      { role: 'bot', message: "D'accord, je vous écoute. Vous pouvez me donner le nom" },
      { role: 'user', message: 'de la Forge' },
      { role: 'bot', message: 'Merci.' },
    ]);
    expect(read.doubledReplies).toBe(1);
    expect(read.assistantLines).toBe(3);
  });

  it("un OUTIL entre deux répliques ne compte pas: annoncer puis dire le résultat est normal", () => {
    const read = readVapiMessages([
      { role: 'user', message: 'lundi matin' },
      { role: 'bot', message: 'Je regarde ça tout de suite.' },
      { role: 'tool_calls', toolCalls: [{ function: { name: 'checkAvailability', arguments: '{}' } }] },
      { role: 'tool_call_result', name: 'checkAvailability', result: 'CRENEAUX' },
      { role: 'bot', message: 'Il me reste neuf heures.' },
    ]);
    expect(read.doubledReplies).toBe(0);
  });

  it('une conversation propre en compte zéro', () => {
    const read = readVapiMessages([
      { role: 'bot', message: 'Demtalix, bonjour.' },
      { role: 'user', message: 'bonjour' },
      { role: 'bot', message: 'Que puis-je faire pour vous ?' },
      { role: 'user', message: 'un rendez-vous' },
    ]);
    expect(read.doubledReplies).toBe(0);
  });

  it("l'audit le note en défaut et renvoie au détecteur de fin de tour, pas au modèle", () => {
    const f = good();
    f.doubledReplies = 4;
    f.assistantLines = 13;
    const c = auditCall(f).checks.find(x => x.id === 'doubled')!;
    expect(c.status).toBe('fail');
    expect(c.value).toMatch(/4 sur 13/);
    expect(c.lever).toMatch(/détecteur de fin de tour/);
  });

  it('et se tait quand il ne peut pas lire: `skip`, jamais un vert inventé', () => {
    const f = good();
    delete (f as { doubledReplies?: number }).doubledReplies;
    expect(auditCall(f).checks.find(x => x.id === 'doubled')!.status).toBe('skip');
  });
});

describe('readVapiMessages', () => {
  it('compte les répliques, mesure le délai de réponse et apparie outil et résultat', () => {
    const read = readVapiMessages([
      { role: 'bot', message: 'Bonjour', secondsFromStart: 0.5 },
      { role: 'user', message: 'un rendez-vous jeudi', secondsFromStart: 3, time: 3000, endTime: 4500 },
      { role: 'tool_calls', secondsFromStart: 6, toolCalls: [{ function: { name: 'checkAvailability', arguments: '{"date":"2026-09-18"}' } }] },
      { role: 'tool_call_result', name: 'checkAvailability', result: 'CRENEAUX: 09:00', secondsFromStart: 6.8 },
      { role: 'bot', message: 'Jeudi à 9h ?', secondsFromStart: 7.5 },
      { role: 'tool_calls', secondsFromStart: 12, toolCalls: [{ function: { name: 'bookAppointment', arguments: { customerName: 'X' } } }] },
    ]);
    expect(read.assistantLines).toBe(2);
    expect(read.callerLines).toBe(1);
    expect(read.vapiGapsSeconds).toEqual([3]);
    /* `atSeconds`: quand l'outil a tourné, pas seulement combien de temps. Le
       premier outil d'un appel est lent sur trois relevés d'affilée, et une
       moyenne par nom ne peut pas montrer ça. */
    expect(read.tools[0]).toEqual({ name: 'checkAvailability', args: { date: '2026-09-18' }, result: 'CRENEAUX: 09:00', tookSeconds: 0.8, atSeconds: 6 });
    /* Un outil sans réponse (appel coupé) compte, sans durée. */
    expect(read.tools[1]).toEqual({ name: 'bookAppointment', args: { customerName: 'X' }, result: null, tookSeconds: null, atSeconds: 12 });
  });
});

/**
 * Les deux FAUX POSITIFS relevés sur l'appel test du 16/09/2026 au soir.
 *
 * L'audit y a noté « son parti avant la fin du texte: 1/5 » et « créneaux
 * consultés mais bookAppointment jamais appelé », et a placé le premier en
 * tête des choses à faire. Les deux étaient faux, et le geste qu'ils
 * appelaient (baisser le seuil de découpe) aurait rendu la voix hachée pour
 * gagner cent millisecondes sur des réponses déjà rapides, juste après que le
 * propriétaire ait dit « c'est mieux niveau naturel ».
 */
describe("auditCall — ce qui n'est PAS un défaut", () => {
  /** Les cinq répliques réelles de l'appel du 16/09 au soir. */
  const repliquesDuSoir = [
    'Je regarde ça tout de suite.',
    'Pour mardi prochain, je peux vous proposer 9 heures. Que cette heure vous conviendrait ?',
    "Un instant, je m'en occupe.",
    'Vous êtes bien Jean-Luc Delaforge, F-O-R-G-E.',
    "C'est bien réservé pour mardi 22 septembre à 9 heures, Jean-Luc. Vous allez recevoir un SMS de confirmation avec le lien pour l'agenda. Je peux faire autre chose pour vous ?",
  ];

  it('compte comme découpable la seule réplique qui pouvait l\'être', () => {
    /* Quatre répliques sur cinq n'ont aucune fin de phrase au-delà de 60
       caractères: elles partent en un seul morceau, par construction. */
    expect(chunkableReplies(repliquesDuSoir, 60)).toBe(1);
  });

  it("une réplique écrite en 300 ms ne peut pas juger la découpe", () => {
    /* Cinquième passage de la même ligne, et le premier qui conclut que la
       question ne se pose pas ainsi: le verdict compare notre horloge locale
       (dernier jeton) à l'ARRIVÉE d'un webhook de Vapi. Pour une réplique
       écrite en trois cents millisecondes, le trajet du webhook suffit seul à
       faire conclure « bufferisé », quoi que fasse le chunkPlan. */
    const f = good();
    f.realtime!.latency.streaming = { streamed: 0, buffered: 4 };
    f.realtime!.latency.ttfa = { count: 8, median: 342, p95: 3732, max: 3732 };
    f.realtime!.latency.tts = { count: 4, median: 40, p95: 60, max: 60 };
    const c = auditCall(f).checks.find(x => x.id === 'streamed')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/sans objet/);
    expect(c.value).toMatch(/WEBHOOK/);
    expect(c.lever).toBeUndefined();
  });

  it("le TOTAL ne double PAS le délai que l'horloge de Vapi mesure déjà", () => {
    /* Relevé du 16/09 à 23:28: 3 867 ms chez nous, 2 500 ms chez Vapi, pour le
       MÊME intervalle. Deux rouges pour un seul fait, et le poids donné à la
       mesure la plus indirecte. */
    const f = good();
    f.realtime!.latency.total = { count: 3, median: 3867, p95: 5809, max: 5809 };
    f.vapiGapsSeconds = [2.4, 2.5, 2.7];
    const report = auditCall(f);
    const t = report.checks.find(x => x.id === 'total')!;
    expect(t.status).toBe('ok');
    expect(t.value).toMatch(/horloge de Vapi.*fait foi/);
    expect(t.target).toBeUndefined();
    /* Et c'est bien la ligne de Vapi qui porte le verdict. */
    expect(report.checks.find(x => x.id === 'vapi-gap')!.status).not.toBe('ok');
  });

  it("sans horloge de Vapi, notre TOTAL redevient le juge", () => {
    const f = good();
    f.realtime!.latency.total = { count: 3, median: 3867, p95: 5809, max: 5809 };
    f.vapiGapsSeconds = [];
    const t = auditCall(f).checks.find(x => x.id === 'total')!;
    expect(t.status).toBe('fail');
    expect(t.target).toMatch(/2000 ms/);
  });

  it("un TTFA que l'horloge de Vapi rend impossible n'est pas une latence", () => {
    /* Relevé du 16/09/2026 à 23:12: TTFA médiane 20 175 ms, p95 59 419 ms,
       quand Vapi disait 2,9 s de médiane et 3,8 s au pire. L'audit a classé
       ça PREMIER avec « baisser VOICE_TTS_MIN_CHUNK_CHARS »: hacher la voix
       pour un chiffre qui ne pouvait pas exister. Le TTFA est un morceau du
       délai ressenti, il ne peut pas le dépasser. */
    const f = good();
    f.realtime!.latency.ttfa = { count: 9, median: 20175, p95: 59419, max: 59419 };
    f.vapiGapsSeconds = [2.4, 2.9, 3.8];
    const report = auditCall(f);
    const c = report.checks.find(x => x.id === 'ttfa')!;
    expect(c.status).toBe('warn');
    expect(c.value).toMatch(/MESURE INUTILISABLE/);
    expect(c.lever).toMatch(/bornes ont dérivé/);
    expect(c.lever).toMatch(/AUCUN réglage de voix/);

    /* Et la ligne de découpe, qui se compare au TTFA, ne juge plus rien. */
    const s = report.checks.find(x => x.id === 'streamed')!;
    expect(s.status).toBe('ok');
    expect(s.value).toMatch(/inutilisable/);
  });

  it('un TTFA lent mais POSSIBLE reste un défaut avec son levier', () => {
    /* L'autre moitié: 1,2 s de TTFA sous un délai ressenti de 3,8 s est
       parfaitement cohérent, et c'est bien la synthèse qu'on regarde. */
    const f = good();
    f.realtime!.latency.ttfa = { count: 9, median: 1200, p95: 1500, max: 1500 };
    f.vapiGapsSeconds = [2.4, 2.9, 3.8];
    const c = auditCall(f).checks.find(x => x.id === 'ttfa')!;
    expect(c.status).not.toBe('ok');
    expect(c.value).not.toMatch(/INUTILISABLE/);
    expect(c.lever).toMatch(/VOICE_TTS_MIN_CHUNK_CHARS/);
  });

  it("le modèle qui finit avant la synthèse n'est pas un défaut de découpe", () => {
    /* Relevé du 16/09/2026 au soir: 6 répliques découpables, 0 streamées, et
       la ligne partait en tête des choses à faire avec « relire le chunkPlan ».
       Or `tts` (dernier jeton → premier son) valait la moitié du TTFA: le
       texte était écrit avant que la voix ne parle, donc découper plus tôt
       n'avance rien. Baisser le seuil aurait haché la voix pour zéro gain. */
    const f = good();
    f.assistantTexts = [
      'Le vendredi 18 septembre, on a un créneau à 9 heures. Je peux vous le poser si vous voulez.',
      "Votre rendez-vous est bien avancé au vendredi 18 septembre à 9 heures. Un SMS de confirmation part tout de suite.",
    ];
    f.realtime!.latency.streaming = { streamed: 0, buffered: 6 };
    /* Écriture longue (4 000 - 2 500 = 1 500 ms), donc le verdict est
       DÉCIDABLE: ce n'est pas le trajet du webhook qui décide. Et la synthèse
       porte plus de la moitié du TTFA, donc découper plus tôt n'avance rien. */
    f.realtime!.latency.ttfa = { count: 6, median: 4000, p95: 4200, max: 4200 };
    f.realtime!.latency.tts = { count: 6, median: 2500, p95: 2700, max: 2700 };
    /* Le délai ressenti doit pouvoir CONTENIR ce TTFA, sinon l'invariant le
       déclare inutilisable avant d'en arriver là. */
    f.vapiGapsSeconds = [4.4, 4.8, 5.2];
    const c = auditCall(f).checks.find(x => x.id === 'streamed')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/sans objet/);
    expect(c.value).toMatch(/avant que la synthèse ne parle/);
    expect(c.lever).toBeUndefined();
  });

  it('une synthèse RAPIDE laisse la découpe responsable, et la ligne reste rouge', () => {
    /* L'autre moitié: si la voix répond en 40 ms et que le TTFA reste à
       394 ms, c'est bien le texte qu'on a attendu, donc la découpe. */
    const f = good();
    f.assistantTexts = [
      'Le vendredi 18 septembre, on a un créneau à 9 heures. Je peux vous le poser si vous voulez.',
      "Votre rendez-vous est bien avancé au vendredi 18 septembre à 9 heures. Un SMS de confirmation part tout de suite.",
    ];
    f.realtime!.latency.streaming = { streamed: 0, buffered: 6 };
    /* 3 000 - 200 = 2 800 ms d'écriture: largement au-dessus du trajet d'un
       webhook, donc le « bufferisé » ne s'explique plus par le réseau. */
    f.realtime!.latency.ttfa = { count: 6, median: 3000, p95: 3200, max: 3200 };
    f.realtime!.latency.tts = { count: 6, median: 200, p95: 260, max: 260 };
    f.vapiGapsSeconds = [3.4, 3.8, 4.1];
    const c = auditCall(f).checks.find(x => x.id === 'streamed')!;
    expect(c.status).toBe('fail');
    expect(c.lever).toMatch(/chunkPlan/);
  });

  it('une fin de phrase sur le DERNIER caractère ne découpe rien', () => {
    /* Sinon toute réplique de plus de 60 caractères passerait pour
       découpable, et le plafond redeviendrait faux dans l'autre sens. */
    expect(chunkableReplies(['a'.repeat(70) + '.'], 60)).toBe(0);
    expect(chunkableReplies(['a'.repeat(70) + '. Et ensuite.'], 60)).toBe(1);
  });

  it('1 tour streamé sur 1 réplique découpable est VERT, pas 20 %', () => {
    const f = good();
    f.assistantTexts = repliquesDuSoir;
    f.realtime!.latency.streaming = { streamed: 1, buffered: 4 };
    const report = auditCall(f);
    const streamed = report.checks.find(c => c.id === 'streamed');
    expect(streamed?.status).toBe('ok');
    expect(streamed?.value).toMatch(/1\/1/);
    expect(streamed?.value).toMatch(/4 trop courte/);
    expect(report.todo.find(c => c.id === 'streamed')).toBeUndefined();
  });

  it('aucune réplique découpable: la ligne dit « sans objet », elle ne juge pas', () => {
    const f = good();
    f.assistantTexts = ["Un instant, je m'en occupe.", 'Je regarde ça.'];
    f.realtime!.latency.streaming = { streamed: 0, buffered: 2 };
    const report = auditCall(f);
    const streamed = report.checks.find(c => c.id === 'streamed');
    expect(streamed?.status).toBe('ok');
    expect(streamed?.value).toMatch(/sans objet/);
    expect(report.todo.find(c => c.id === 'streamed')).toBeUndefined();
  });

  it('une VRAIE découpe manquée reste rouge', () => {
    /* Le garde-fou ne doit pas avaler le défaut qu'il est censé voir: cinq
       répliques longues dont aucune n'a streamé, c'est le chunkPlan. */
    const f = good();
    f.assistantTexts = Array.from({ length: 5 }, (_, i) =>
      `Voici une réponse suffisamment longue pour porter une frontière de découpe, numéro ${i}. Et une seconde phrase ensuite.`);
    f.realtime!.latency.streaming = { streamed: 0, buffered: 5 };
    const report = auditCall(f);
    const streamed = report.checks.find(c => c.id === 'streamed');
    expect(streamed?.status).not.toBe('ok');
    expect(streamed?.lever).toMatch(/chunkPlan/);
  });

  it("un appel de DÉPLACEMENT ne réclame pas bookAppointment", () => {
    /* « Je dois déplacer mon rendez-vous »: créneaux consultés puis
       `rescheduleBooking`. Réclamer `bookAppointment` là envoie relire un
       transcript pour un défaut qui n'existe pas. */
    const f = good();
    f.tools = [
      { name: 'lookupBooking', args: {}, result: 'RESERVATION: mardi 22 septembre a 09:00', tookSeconds: 1.2 },
      { name: 'checkAvailability', args: { date: '2026-09-24' }, result: 'LIBRE le jeudi 24 septembre a: 09:00, 10:00', tookSeconds: 0.9 },
      { name: 'rescheduleBooking', args: { date: '2026-09-24', time: '09:00' }, result: 'DEPLACE: Jean-Luc de la forge, du mardi 22 au jeudi 24 a 09:00.', tookSeconds: 1.1 },
    ];
    const report = auditCall(f);
    expect(report.checks.find(c => c.id === 'booking')).toBeUndefined();
    const moved = report.checks.find(c => c.id === 'reschedule');
    expect(moved?.status).toBe('ok');
    expect(report.todo.find(c => c.id === 'booking')).toBeUndefined();
  });

  it("des créneaux consultés SANS conclure restent un défaut", () => {
    /* L'autre moitié: sans déplacement, « créneaux consultés et rien de
       pris » est le vrai défaut du 15/09, il ne doit pas disparaître. */
    const f = good();
    f.tools = [
      { name: 'checkAvailability', args: { date: '2026-09-18' }, result: 'LIBRE a 09:00', tookSeconds: 0.5 },
    ];
    f.booking = null;
    const report = auditCall(f);
    const booking = report.checks.find(c => c.id === 'booking');
    expect(booking?.status).toBe('warn');
    expect(booking?.value).toMatch(/jamais appelé/);
  });
});

describe('tierTurns — attribuer un modèle SERVI à son étage', () => {
  it('reconnaît un nom daté, que le réglage ne porte pas', () => {
    /* 6duotrigesies: c'est le flux d'OpenAI qui nomme le modèle servi, et il
       le date. `gpt-4.1-mini` ne sera JAMAIS égal à ce qui revient. */
    const t = tierTurns({ 'gpt-4.1-mini-2025-04-14': 5 }, 'gpt-4.1-mini', 'gpt-4.1-nano');
    expect(t).toEqual({ full: 5, mini: 0, other: 0, total: 5 });
  });

  it('donne le tour au nom configuré le plus LONG qui le préfixe', () => {
    /* Avec `gpt-4.1` en complet, un tour `gpt-4.1-mini-...` commence aussi par
       le nom du complet: le premier trouvé serait le mauvais. */
    const t = tierTurns(
      { 'gpt-4.1-2025-04-14': 2, 'gpt-4.1-mini-2025-04-14': 3 },
      'gpt-4.1',
      'gpt-4.1-mini',
    );
    expect(t.full).toBe(2);
    expect(t.mini).toBe(3);
  });

  it('range à part un modèle qu\'aucun réglage ne décrit', () => {
    /* Un modèle servi que personne n'a demandé est une information: il ne se
       tait pas en étant compté avec les autres. */
    const t = tierTurns({ 'gpt-4o-mini': 4 }, 'gpt-4.1-mini', 'gpt-4.1-nano');
    expect(t).toEqual({ full: 0, mini: 0, other: 4, total: 4 });
  });

  it('ne tombe pas sur un appel sans relevé', () => {
    expect(tierTurns(undefined, 'a', 'b')).toEqual({ full: 0, mini: 0, other: 0, total: 0 });
  });
});

/**
 * L'ASSISTANT HYBRIDE (17/09/2026).
 *
 * Premier appel réel d'un client basculé en Superagent: `silence-timed-out` au
 * bout de 137 s, répliques qui se chevauchent, agent qui répond à sa propre
 * question, `lookupBooking` jamais appelé. La cause n'était pas le réglage —
 * il était bon — mais un RESTE: `vapiClient.updateAssistant` est un PATCH, et
 * le chemin parole-à-parole se contentait de TAIRE le transcripteur et le plan
 * d'attente, donc Vapi les gardait. Deux preneurs de tour de parole sur le même
 * assistant.
 *
 * Ce que l'audit doit dire, et qui fait toute la différence: relancer
 * `voice:tier` ne répare rien ici. La ligne doit nommer le reste, pas accuser
 * un réglage correct — un levier qui envoie au mauvais geste coûte plus cher
 * que pas de levier (6sexvicies).
 */
describe('auditCall — un assistant basculé dont le PATCH a gardé le classique', () => {
  const hybride = () => {
    const f = good();
    f.expected.tierRequested = 'superagent';
    f.expected.tierServed = 'superagent';
    // Ce que l'assistant distant porte vraiment: modèle temps réel (donc pas de
    // custom-LLM) ET le transcripteur de la synchronisation précédente.
    f.remote.customLlm = false;
    f.remote.speechToSpeech = false;
    f.remote.transcriber = true;
    return f;
  };

  it('nomme le RESTE au lieu d\'accuser le niveau', () => {
    const niveau = auditCall(hybride()).checks.find(c => c.id === 'niveau')!;
    expect(niveau.status).toBe('fail');
    expect(niveau.value).toMatch(/HYBRIDE/);
    expect(niveau.lever).toMatch(/PATCH/);
    expect(niveau.lever).toMatch(/voice:resync/);
  });

  it('interdit explicitement le geste qui ne répare rien', () => {
    const niveau = auditCall(hybride()).checks.find(c => c.id === 'niveau')!;
    expect(niveau.lever).toMatch(/ne pas relancer/i);
  });

  it('garde le levier ORDINAIRE quand le niveau n\'a vraiment pas été écrit', () => {
    /* Sans transcripteur distant, un assistant qui sert le classique alors que
       le client veut le Superagent est bien un niveau jamais écrit: c'est là,
       et là seulement, que `voice:tier` est le bon geste. */
    const f = hybride();
    f.remote.transcriber = false;
    f.remote.customLlm = true;
    const niveau = auditCall(f).checks.find(c => c.id === 'niveau')!;
    expect(niveau.status).toBe('fail');
    expect(niveau.value).not.toMatch(/HYBRIDE/);
    expect(niveau.lever).toMatch(/voice:tier/);
  });

  it('reste muet quand l\'assistant distant sert bien le parole-à-parole', () => {
    const f = hybride();
    f.remote.speechToSpeech = true;
    f.remote.transcriber = false;
    const niveau = auditCall(f).checks.find(c => c.id === 'niveau')!;
    expect(niveau.status).toBe('ok');
    expect(niveau.lever).toBeUndefined();
  });
});

/**
 * Le plan d'attente en parole-à-parole (17/09/2026).
 *
 * Premier appel sur un assistant Superagent PROPRE: la ligne « détecteur de fin
 * de tour » a noté « aucun » en ROUGE contre « livekit, attente 0.15 s », et
 * conseillé un resync. Or l'absence de plan est exactement ce que le mode
 * demande. C'est le faux positif que le docteur venait de fermer, réouvert dans
 * l'audit: quand une leçon déplace un champ, il y a souvent DEUX lecteurs.
 */
describe('auditCall — le plan d\'attente attendu dépend du niveau', () => {
  const s2s = () => {
    const f = good();
    f.expected.tierRequested = 'superagent';
    f.expected.tierServed = 'superagent';
    f.remote.customLlm = false;
    f.remote.speechToSpeech = true;
    f.remote.transcriber = false;
    f.remote.endpointing = null;
    return f;
  };

  it('aucun plan est le bon état SANS transcripteur: il n\'y a aucun mot à compter', () => {
    const ep = auditCall(s2s()).checks.find(c => c.id === 'endpointing')!;
    expect(ep.status).toBe('ok');
    expect(ep.value).toMatch(/aucun mot à compter/);
    expect(ep.lever).toBeUndefined();
    // Et il ne propose pas un resync qui ne changerait rien.
    expect(ep.target).toBeUndefined();
  });

  /**
   * ET AVEC UN TRANSCRIPTEUR, L'ABSENCE EST LE DÉFAUT (17/09/2026).
   *
   * Cette ligne s'affichait en VERT avec « le moment de répondre appartient au
   * modèle » pendant que l'appelant vivait le contraire: « s'il y a un léger
   * blanc dans ma réponse il commence à parler ». Vapi documente que
   * l'endpointing est fait par SON orchestration sur ce chemin, donc un plan
   * absent n'est pas « le modèle décide », c'est le défaut de Vapi à 0,4 s.
   * Un audit qui note un réglage doit le noter contre ce que le fournisseur
   * FAIT (6sexvicies).
   */
  it("avec transcripteur, l'absence de plan est un DÉFAUT et le levier est un resync", () => {
    const f = s2s();
    f.remote.transcriber = true;
    f.expected.realtimeTranscriber = true;
    const ep = auditCall(f).checks.find(c => c.id === 'endpointing')!;
    expect(ep.status).toBe('fail');
    expect(ep.value).toMatch(/AUCUN PLAN/);
    expect(ep.lever).toMatch(/voice:resync/);
  });

  it('avec transcripteur, le plan CLASSIQUE attendu passe au vert', () => {
    const f = s2s();
    f.remote.transcriber = true;
    f.expected.realtimeTranscriber = true;
    f.remote.endpointing = { ...f.expected.endpointing };
    expect(auditCall(f).checks.find(c => c.id === 'endpointing')!.status).toBe('ok');
  });

  it('ne juge pas DEUX fois un plan resté en place: la ligne « niveau » le porte', () => {
    const f = s2s();
    f.remote.speechToSpeech = false;
    f.remote.transcriber = true;
    f.remote.endpointing = { provider: 'livekit', waitSeconds: 0.15, punctuationSeconds: 0.4 };
    const checks = auditCall(f).checks;
    expect(checks.find(c => c.id === 'endpointing')!.status).toBe('skip');
    expect(checks.find(c => c.id === 'niveau')!.value).toMatch(/HYBRIDE/);
  });

  it('garde le jugement ORDINAIRE sur un client classique', () => {
    const f = good();
    f.remote.endpointing = { provider: 'vapi', waitSeconds: 0.4, punctuationSeconds: 0.1 };
    const ep = auditCall(f).checks.find(c => c.id === 'endpointing')!;
    expect(ep.status).toBe('fail');
    expect(ep.lever).toMatch(/voice:resync/);
  });
});

/**
 * LE DÉLAI DE RACCROCHÉ, QUI NE FIGURAIT SUR AUCUN ÉCRAN (17/09/2026).
 *
 * `VAPI_SILENCE_TIMEOUT` valait 10 s en production. L'appel raccrochait PENDANT
 * la phrase d'accueil, en parole-à-parole comme en classique, et le mécanisme de
 * relance (« Vous m'entendez ? » à 10 s puis 20 s) n'a jamais pu tourner. Six
 * appels de test morts d'affilée, lus comme une panne du moteur vocal, pendant
 * que deux écrans de diagnostic ne montraient ni ce chiffre ni les relances.
 *
 * Le verdict COMPARE les deux: 10 s est un réglage raisonnable en soi, il ne
 * devient faux qu'en face de relances posées à 10 s et 20 s.
 */
describe('auditCall — le raccroché doit laisser passer les relances', () => {
  const withSilence = (silence: number | null) => {
    const f = good();
    f.remote.silenceTimeoutSeconds = silence;
    f.expected.idleNudgeSeconds = 10;
    f.expected.idleNudgeCount = 2;
    return f;
  };
  const line = (silence: number | null) =>
    auditCall(withSilence(silence)).checks.find(c => c.id === 'silence')!;

  it('nomme le cas vécu: raccroché pendant la phrase d\'accueil', () => {
    const c = line(10);
    expect(c.status).toBe('fail');
    expect(c.value).toMatch(/PENDANT la phrase d'accueil/);
    expect(c.lever).toMatch(/VAPI_SILENCE_TIMEOUT/);
    expect(c.target).toBe('au moins 30 s');
  });

  it('tombe aussi quand seule la DERNIÈRE relance est étouffée', () => {
    /* 25 s laisse parler les deux relances (10 s, 20 s) mais ne laisse aucune
       fenêtre après la seconde: elle est dite puis l'appel meurt aussitôt. */
    const c = line(25);
    expect(c.status).toBe('fail');
    expect(c.value).not.toMatch(/PENDANT la phrase/);
    expect(c.value).toMatch(/dernière relance/);
  });

  it('accepte un réglage qui laisse la place', () => {
    const c = line(30);
    expect(c.status).toBe('ok');
    expect(c.lever).toBeUndefined();
    expect(c.value).toMatch(/relances à 10 s et 20 s/);
  });

  it('se tait quand l\'assistant distant n\'a pas été lu', () => {
    expect(line(null).status).toBe('skip');
  });
});

/**
 * UN PLAN « VIDE » N'EST PAS UN PLAN (17/09/2026).
 *
 * Le collecteur faisait `assistant.startSpeakingPlan ?? {}`, donc une ABSENCE de
 * plan rendait un objet `{provider: 'aucun', waitSeconds: null, ...}`. La ligne
 * le lisait comme un plan présent et annonçait « reste d'une synchronisation
 * classique » sur un assistant temps réel qui n'en porte aucun — précisément
 * l'état qu'on veut. Relevé sur un vrai écran, deux heures après avoir corrigé
 * le faux positif d'à côté.
 */
describe('auditCall — absence de plan contre plan vide', () => {
  const s2sWith = (endpointing: CallFacts['remote']['endpointing']) => {
    const f = good();
    f.expected.tierRequested = 'superagent';
    f.expected.tierServed = 'superagent';
    f.remote.customLlm = false;
    f.remote.speechToSpeech = true;
    f.remote.transcriber = false;
    f.remote.endpointing = endpointing;
    return auditCall(f).checks.find(c => c.id === 'endpointing')!;
  };

  it('lit un objet tout vide comme une absence, pas comme un reste', () => {
    const c = s2sWith({ provider: 'aucun', waitSeconds: null, punctuationSeconds: null });
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/aucun mot à compter/);
    expect(c.value).not.toMatch(/reste/);
  });

  it('reconnaît toujours un VRAI reste', () => {
    const c = s2sWith({ provider: 'livekit', waitSeconds: 0.15, punctuationSeconds: 0.4 });
    expect(c.status).toBe('skip');
    expect(c.value).toMatch(/reste d'une synchronisation classique/);
  });

  it("suffit d'un seul champ renseigné pour que ce soit un reste", () => {
    const c = s2sWith({ provider: 'aucun', waitSeconds: 0.4, punctuationSeconds: null });
    expect(c.status).toBe('skip');
    expect(c.value).toMatch(/reste/);
  });
});

/**
 * L'INTERRUPTION, LUE SUR L'ASSISTANT DISTANT (17/09/2026).
 *
 * « Quand je le coupe, il ne s'arrête pas », trois appels de suite, et aucun
 * des deux diagnostics ne montrait le réglage mis en cause. On ne pouvait donc
 * pas distinguer « le correctif n'est pas déployé » de « le correctif ne
 * marche pas », qui appellent des gestes opposés.
 */
describe('auditCall — le plan d\'interruption distant', () => {
  const s2s = (stop: CallFacts['remote']['stopSpeaking']) => {
    const f = good();
    f.expected.tierRequested = 'superagent';
    f.expected.tierServed = 'superagent';
    f.expected.realtimeTranscriber = true;
    f.remote.customLlm = false;
    f.remote.speechToSpeech = true;
    f.remote.transcriber = true;
    f.remote.stopSpeaking = stop;
    return auditCall(f).checks.find(c => c.id === 'barge-in')!;
  };

  it('« énergie seule » est un DÉFAUT quand un transcripteur fournit des mots', () => {
    const c = s2s({ numWords: 0, voiceSeconds: 0.2 });
    expect(c.status).toBe('fail');
    expect(c.value).toMatch(/énergie seule/);
    expect(c.lever).toMatch(/voice:resync/);
  });

  it('un plan qui compte des mots passe au vert', () => {
    expect(s2s({ numWords: 2, voiceSeconds: 0.2 }).status).toBe('ok');
  });

  it("sans transcripteur, « énergie seule » redevient correct: il n'y a aucun mot", () => {
    const f = good();
    f.expected.tierServed = 'superagent';
    f.expected.realtimeTranscriber = false;
    f.remote.speechToSpeech = true;
    f.remote.transcriber = false;
    f.remote.stopSpeaking = { numWords: 0, voiceSeconds: 0.2 };
    const c = auditCall(f).checks.find(x => x.id === 'barge-in')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/correct sans transcripteur/);
  });

  it('non lu se dit `skip`, jamais un vert inventé', () => {
    expect(s2s(null).status).toBe('skip');
  });
});

/**
 * TROIS LIGNES DE L'AUDIT LUES SUR UN APPEL RÉEL (18/09/2026), et les trois
 * envoyaient au mauvais endroit ou se taisaient.
 *
 * Relevé: 22 répliques, 1 doublée, outils à 2,2 / 6,1 / 2,9 / 4,5 / 7,7 s,
 * plan d'endpointing VERT à 0,6 / 0,8, et l'agent qui dit « il y a eu un
 * problème technique » sans qu'aucune ligne ne l'explique.
 */
describe("l'audit ne s'envoie pas au mauvais endroit", () => {
  const find = (facts: CallFacts, id: string) => auditCall(facts).checks.find(c => c.id === id);

  it("ne dit pas « un plan absent » quand le plan est POSÉ", () => {
    /* Le défaut exact: l'audit plaçait ça en tête des choses à faire pendant
       que sa propre ligne « détecteur de fin de tour » était verte. */
    const facts = good();
    facts.doubledReplies = 1;
    facts.remote.endpointing = { provider: 'livekit', waitSeconds: 0.6, punctuationSeconds: 0.8 };
    const lever = String(find(facts, 'doubled')!.lever);
    expect(lever).toContain('le plan est POSÉ');
    expect(lever).toContain('attente 0.6 s, ponctuation 0.8 s');
    expect(lever).not.toContain('plan absent');
    expect(lever).toMatch(/ne changera rien/);
  });

  it("nomme bien l'absence de plan quand il est vraiment absent", () => {
    const facts = good();
    facts.doubledReplies = 1;
    facts.remote.endpointing = { provider: 'aucun', waitSeconds: null, punctuationSeconds: null };
    const lever = String(find(facts, 'doubled')!.lever);
    expect(lever).toContain('aucun plan');
    expect(lever).toContain('voice:resync');
  });

  it("ne blâme pas Google pour un outil qui ne lit pas Google", () => {
    /* `captureLead` 7,7 s et `lookupBooking` 6,1 s sont des requêtes Prisma.
       L'audit envoyait renouveler un jeton Google, parce qu'un
       `checkAvailability` figurait aussi dans les lents. */
    const facts = good();
    facts.tools = [
      { name: 'lookupBooking', args: {}, result: 'RESERVATION: ...', tookSeconds: 6.1, atSeconds: 47 },
      { name: 'checkAvailability', args: {}, result: 'LIBRE ...', tookSeconds: 2.9, atSeconds: 71 },
      { name: 'captureLead', args: {}, result: 'ok', tookSeconds: 7.7, atSeconds: 117 },
    ];
    const lever = String(find(facts, 'tools')!.lever);
    expect(lever).toContain('captureLead');
    expect(lever).toContain('Prisma');
    /* La phrase qui distingue le mauvais levier: le texte peut dire « pas le
       jeton Google », il ne doit pas envoyer le RENOUVELER. */
    expect(lever).not.toMatch(/jeton Google à renouveler/);
    expect(lever).toContain('Neon');
  });

  it("blâme l'agenda quand c'est bien l'agenda le plus lent", () => {
    const facts = good();
    facts.tools = [
      { name: 'captureLead', args: {}, result: 'ok', tookSeconds: 1.9, atSeconds: 20 },
      { name: 'checkAvailability', args: {}, result: 'LIBRE ...', tookSeconds: 6.5, atSeconds: 71 },
    ];
    expect(String(find(facts, 'tools')!.lever)).toMatch(/agenda Google/);
  });

  it("dit QUEL outil est tombé en repli, ce que rien ne montrait", () => {
    /* « Je suis désolé, il y a eu un problème technique » n'était rattachable
       à aucune ligne: le transcript de Vapi rend un repli comme un résultat
       ordinaire, et la ligne « durée des outils » ne lit pas le résultat. */
    const facts = good();
    facts.tools = [
      { name: 'checkAvailability', args: {}, result: 'LIBRE ...', tookSeconds: 2.9, atSeconds: 71 },
      { name: 'checkAvailability', args: {}, result: "AGENDA INDISPONIBLE: dis au correspondant que tu ne peux pas confirmer le creneau maintenant, propose de noter ses coordonnees.", tookSeconds: 4.5, atSeconds: 110 },
    ];
    const check = find(facts, 'tool-degraded')!;
    expect(check.status).toBe('fail');
    expect(check.value).toContain('checkAvailability');
    expect(check.value).toContain('à 110 s');
    expect(check.value).toContain('AGENDA INDISPONIBLE');
    expect(String(check.lever)).toContain('EXTERNAL_TIMEOUT_MS');
    expect(String(check.lever)).toContain('LEVÉ');
  });

  it('se tait quand aucun outil n\'est tombé', () => {
    expect(find(good(), 'tool-degraded')).toBeUndefined();
  });

  /**
   * LE BRIEF POSÉ SANS NOM (18/09/2026). « Il ne me reconnaît pas alors que je
   * suis déjà client. » La note ne portait que des COMPTES, donc elle ne
   * distinguait pas les deux pannes OPPOSÉES: le nom est là et le modèle
   * redemande (prompt), ou le nom manque (getCallerHistory). Elles ne se
   * réparent pas dans le même fichier.
   */
  it("envoie lire getCallerHistory quand le brief ne nomme personne", () => {
    const facts = good();
    facts.remote.speechToSpeech = true;
    facts.realtime!.callBrief = 'pose (SANS NOM CONNU, 22 appels, 1 rdv)';
    const lever = String(find(facts, 'brief')!.lever);
    expect(lever).toContain('getCallerHistory');
    expect(lever).toMatch(/pas le prompt/);
  });

  it('se tait quand le brief NOMME bien l\'appelant', () => {
    const facts = good();
    facts.remote.speechToSpeech = true;
    facts.realtime!.callBrief = 'pose (nom: Jean-Luc de la Forge, 22 appels, 1 rdv)';
    expect(find(facts, 'brief')!.lever).toBeUndefined();
  });

  it("ne réclame pas un nom à un numéro qui n'a jamais appelé", () => {
    /* Un premier appel SANS nom est normal, pas un défaut de lecture. */
    const facts = good();
    facts.remote.speechToSpeech = true;
    facts.realtime!.callBrief = 'pose (SANS NOM CONNU, 0 appels, 0 rdv)';
    expect(find(facts, 'brief')!.lever).toBeUndefined();
  });
});

/**
 * QUEL MODÈLE TEMPS RÉEL SERT, ET IL N'ÉTAIT NOMMÉ NULLE PART (19/09/2026).
 *
 * Retour du propriétaire: « le plan de base allait très bien, c'est le
 * real-time qui est con ». Invérifiable en l'état: sur un appel Superagent,
 * l'audit affichait « complet gpt-4.1-mini, rapide gpt-4.1-nano », c'est-à-dire
 * les deux étages du chemin custom-LLM, qui ne tournent PAS ici puisque Vapi
 * parle à OpenAI directement. Et il ne nommait nulle part celui qui sert.
 *
 * Or le catalogue va de 0,060 $ à 0,645 $ la minute (6quinvicies), un facteur
 * dix qui s'entend. « Il est con » n'est pas une opinion sur le temps réel
 * tant qu'on ne sait pas lequel des six tournait.
 *
 * Le nom est LU sur l'assistant distant, jamais déduit du réglage: c'est le
 * même écart que « niveau servi », et `audit-call.ts` le lisait déjà pour en
 * tirer un booléen avant de le jeter.
 */
/*
 * CE QUI NE VIENT PAS DU DÉPÔT (19/09/2026).
 *
 * Relevé sur un compte réel: l'assistant qui décroche portait un transcripteur
 * ElevenLabs Scribe v2. `buildTranscriber` écrit `provider: 'deepgram'` SANS
 * CONDITION, et c'est le seul constructeur de transcripteur du code: ce réglage
 * a donc été posé dans le tableau de bord Vapi.
 *
 * L'audit ne pouvait pas le voir: il lisait `!!assistant.transcriber`, un
 * BOOLÉEN. « Y en a-t-il un » répondait oui, et « lequel » n'était posé nulle
 * part. Encore une fois le fait était dans les données et personne ne le lisait.
 */
/*
 * CE QUE L'APPEL A COÛTÉ, LU CHEZ VAPI (19/09/2026).
 *
 * « Ça coûte hyper cher » ne se vérifiait nulle part: l'audit ne parlait
 * d'argent qu'à travers `REALTIME_RATES`, une table relevée à la main qui
 * SUPPOSE quel modèle sert. Vapi, lui, facture et le dit appel par appel, et
 * ce chiffre dormait dans `metadata.billing` depuis le début: `finalizeCall`
 * assemble `costBreakdown`, `persistMetrics` l'écrit, et tous ses lecteurs ne
 * prenaient que `costUsd`.
 *
 * C'est la source INDÉPENDANTE qui manquait à la ligne « modèle temps réel »:
 * celle-ci juge sur notre table, celle-là sur la facture.
 */
describe('le coût réel de l\'appel', () => {
  const find = (facts: CallFacts, id: string) => auditCall(facts).checks.find(c => c.id === id);

  it('accepte une minute qui rapporte plus qu\'elle ne coûte', () => {
    const check = find(good(), 'cout')!;
    expect(check.status).toBe('ok');
    expect(check.value).toMatch(/\u20ac\/min/);
    expect(check.lever).toBeUndefined();
  });

  it('REFUSE une minute déficitaire, et nomme le poste le plus lourd', () => {
    const f = good();
    f.expected.planId = 'pro';
    /* 0,71 $/min pendant deux minutes: le relevé réel du 19/09, modèle
       `gpt-realtime-2`. Un Pro rapporte 0,299 € la minute incluse. */
    f.cost = { usd: 1.42, breakdown: { llm: 1.29, vapi: 0.09, transport: 0.02 }, durationSeconds: 120 };
    const check = find(f, 'cout')!;
    expect(check.status).toBe('fail');
    /* Le poste le plus lourd d'abord: c'est lui qui dit s'il faut changer de
       modèle ou changer de plateforme. */
    expect(check.value).toMatch(/llm 1\.290/);
    expect(check.value).toMatch(/Pro/);
    expect(String(check.lever)).toMatch(/VOICE_REALTIME_MODEL/);
  });

  it('juge contre la recette la plus basse quand le forfait est inconnu', () => {
    const f = good();
    f.expected.planId = null;
    f.cost = { usd: 0.60, breakdown: null, durationSeconds: 60 };
    const check = find(f, 'cout')!;
    /* 0,556 €/min, au-dessus des 0,258 € d'Enterprise: déficitaire partout. */
    expect(check.status).toBe('fail');
    expect(check.value).toMatch(/la moins chère de la grille/);
  });

  it('écarte les COMPTEURS du détail, qui ne sont pas des montants', () => {
    const f = good();
    f.cost = {
      usd: 0.24,
      breakdown: { vapi: 0.09, llmPromptTokens: 4210, ttsCharacters: 980, transport: 0.02 },
      durationSeconds: 120,
    };
    const check = find(f, 'cout')!;
    expect(check.value).not.toMatch(/llmPromptTokens/);
    expect(check.value).not.toMatch(/ttsCharacters/);
    expect(check.value).toMatch(/vapi 0\.090/);
  });

  it('se tait sans montant ou sans durée', () => {
    /* Un total sans durée ne fait pas un tarif à la minute, et inventer la
       durée fabriquerait le verdict. */
    const noAmount = good(); noAmount.cost = { usd: null, breakdown: null, durationSeconds: 120 };
    expect(find(noAmount, 'cout')).toBeUndefined();
    const noTime = good(); noTime.cost = { usd: 0.24, breakdown: null, durationSeconds: 0 };
    expect(find(noTime, 'cout')).toBeUndefined();
    const nothing = good(); nothing.cost = null;
    expect(find(nothing, 'cout')).toBeUndefined();
  });
});

describe('le transcripteur distant vient-il du dépôt', () => {
  const find = (facts: CallFacts, id: string) => auditCall(facts).checks.find(c => c.id === id);
  const withStt = (provider: string | null | undefined): CallFacts => {
    const f = good();
    f.remote.transcriberProvider = provider;
    return f;
  };

  it('accepte deepgram, le seul que le code écrive', () => {
    const check = find(withStt('deepgram'), 'transcripteur-source')!;
    expect(check.status).toBe('ok');
    expect(check.lever).toBeUndefined();
  });

  it("REFUSE un fournisseur que le code ne peut pas avoir écrit", () => {
    const check = find(withStt('11labs'), 'transcripteur-source')!;
    expect(check.status).toBe('fail');
    expect(check.value).toContain('11labs');
    expect(check.value).toMatch(/hors du dépôt/);
    /* Le levier dit de NE PAS publier le brouillon: publier le ferait gagner
       jusqu'au prochain enregistrement du portail, et les deux se battraient. */
    expect(String(check.lever)).toMatch(/Ne pas publier/);
  });

  it("ne dit rien d'un assistant sans transcripteur, qui est l'état voulu en parole-à-parole", () => {
    const check = find(withStt(null), 'transcripteur-source')!;
    expect(check.status).toBe('ok');
    expect(check.value).toMatch(/aucun/);
  });

  it('se tait quand le fournisseur n\'a pas été lu', () => {
    /* `undefined` et `null` ne disent pas la même chose: l'un est « pas lu »,
       l'autre « aucun transcripteur ». Les confondre ferait annoncer un état
       voulu sur un assistant qu'on n'a pas pu ouvrir. */
    expect(find(withStt(undefined), 'transcripteur-source')).toBeUndefined();
  });
});

describe('le modèle temps réel est nommé', () => {
  const s2s = (over: Record<string, unknown> = {}): CallFacts => {
    const f = good();
    f.remote.speechToSpeech = true;
    f.remote.modelName = 'gpt-realtime-mini-2025-12-15';
    f.expected.realtimeModel = 'gpt-realtime-mini-2025-12-15';
    Object.assign(f.remote, over);
    return f;
  };
  const find = (facts: CallFacts, id: string) => auditCall(facts).checks.find(c => c.id === id);

  it("nomme le modèle DISTANT et ce que sa minute coûte", () => {
    const check = find(s2s(), 'tiers')!;
    expect(check.label).toMatch(/temps réel/);
    expect(check.value).toContain('gpt-realtime-mini-2025-12-15');
    /* Le tarif dans la valeur: c'est lui qui rend le facteur dix lisible sans
       aller ouvrir la feuille de prix. */
    expect(check.value).toMatch(/\u20ac\/min/);
    expect(check.status).toBe('ok');
    /* Vert: pas de levier (`AuditCheck.lever` est « absent quand c'est vert »),
       et surtout AUCUN conseil de resync, qui écraserait ce qui marche. */
    expect(check.lever).toBeUndefined();
  });

  it("écarte explicitement les étages du chemin classique", () => {
    /* Les afficher sans le dire envoyait régler `VOICE_SMALL_MODEL` pour un
       appel où aucun tour n'y passe jamais. */
    const check = find(s2s(), 'tiers-classic')!;
    expect(check.status).toBe('skip');
    expect(check.value).toMatch(/sans objet/);
    expect(check.value).toContain('gpt-4.1-mini');
  });

  /*
   * LE LEVIER D'AVANT ÉTAIT DESTRUCTEUR (19/09/2026).
   *
   * `expected.realtimeModel` est `env.VOICE_REALTIME_MODEL` lu par le SCRIPT,
   * donc celui du poste qui lance l'audit. L'assistant, lui, est écrit par le
   * code qui tourne sur Render. Les deux n'ont aucune raison de coïncider, et
   * la ligne concluait quand même « le resync n'a pas été rejoué » en
   * conseillant `voice:resync`: ce geste aurait écrit le modèle du POSTE sur
   * l'assistant, c'est-à-dire le défaut `gpt-realtime-2025-08-28` quand le
   * poste n'a pas de `.env`. Un modèle dont le tarif n'a JAMAIS été relevé,
   * posé à la place de celui que Render avait choisi.
   */
  it("ne conseille PAS le resync sur un écart avec l'environnement du poste", () => {
    const facts = s2s({ modelName: 'gpt-realtime-2025-08-28' });
    const check = find(facts, 'tiers')!;
    expect(check.status).toBe('warn');
    /* L'écart est dit, et dit pour ce qu'il est: deux lectures qui ne
       viennent pas du même endroit. */
    expect(check.value).toContain('gpt-realtime-2025-08-28');
    expect(check.value).toContain('gpt-realtime-mini-2025-12-15');
    expect(String(check.lever)).toMatch(/NE PAS resynchroniser|jamais été relevé/);
    expect(String(check.lever)).not.toMatch(/^`npm run voice:resync -- --confirm`$/);
  });

  /*
   * LE FAIT LE PLUS CHER QUE CET AUDIT PUISSE SORTIR.
   *
   * Relevé sur un compte réel le 19/09/2026: l'assistant qui décroche portait
   * `gpt-realtime-2` (0,645 $/min) quand Render disait le mini (0,060 $/min).
   * Rien ne le montrait, et personne ne l'aurait vu avant la facture Vapi.
   */
  it("REFUSE un modèle qui coûte plus qu'une minute ne rapporte", () => {
    const facts = s2s({ modelName: 'gpt-realtime-2' });
    facts.expected.realtimeModel = 'gpt-realtime-2';
    const check = find(facts, 'tiers')!;
    expect(check.status).toBe('fail');
    /* Le coût mensuel d'un Pro à pleines minutes, en face du prix de vente:
       c'est la phrase qui fait prendre la décision. */
    expect(check.value).toMatch(/Pro/);
    expect(check.value).toMatch(/599/);
    expect(String(check.lever)).toContain('gpt-realtime-mini-2025-12-15');
    /* Le verdict ne dépend PAS de l'environnement: ici les deux coïncident,
       et l'ancienne ligne aurait dit « ok ». */
    expect(check.value).not.toMatch(/l'environnement lu ICI/);
  });

  it("dit qu'un tarif jamais relevé empêche de chiffrer la minute", () => {
    const facts = s2s({ modelName: 'gpt-realtime-2025-08-28' });
    facts.expected.realtimeModel = 'gpt-realtime-2025-08-28';
    const check = find(facts, 'tiers')!;
    expect(check.status).toBe('warn');
    expect(check.value).toContain('tarif jamais relevé');
    expect(String(check.lever)).toMatch(/tableau de bord Vapi/);
  });

  it('se tait quand l\'assistant distant n\'a pas été lu', () => {
    const facts = s2s({ modelName: null });
    expect(find(facts, 'tiers')!.status).toBe('skip');
  });

  it('la chaîne classique garde sa ligne d\'étages, inchangée', () => {
    const check = find(good(), 'tiers')!;
    expect(check.label).toBe('étages de modèle');
    expect(find(good(), 'tiers-classic')).toBeUndefined();
  });
});

/**
 * LES ÉTAGES QUI N'EXISTENT PAS SUR CE CHEMIN.
 *
 * PREP, LLM et TTFA sont posés par `llm-stream`, qui ne tourne ni en
 * parole-à-parole ni chez un client dont `customLlm` est éteint. L'audit
 * expliquait leur absence par « appel antérieur au partage PREP/LLM », une
 * cause inventée qui envoie chercher un vieux relevé là où la réponse est
 * « ce chemin n'a pas cet étage ». Et comme la découpe du délai ressenti se
 * calcule par soustraction de ces étages, la ligne qui nomme le PLUS GROS
 * poste ne s'affichait pas du tout sur ces appels: le seul écran qui réponde
 * à « il attend une seconde avant de parler » était muet précisément sur le
 * moteur que le propriétaire dit préférer.
 */
describe('auditCall — un étage absent dit POURQUOI', () => {
  /** Un appel en parole-à-parole: la session vit, mais `llm-stream` non. */
  const s2s = (): CallFacts => {
    const f = good();
    f.expected.tierRequested = 'superagent';
    f.expected.tierServed = 'superagent';
    f.expected.realtimeTranscriber = true;
    f.remote.customLlm = false;
    f.remote.speechToSpeech = true;
    f.remote.transcriber = true;
    f.remote.modelName = 'gpt-realtime-mini-2025-12-15';
    /* Ce que ce chemin laisse vraiment en base: le TOTAL, dont les deux
       bornes sont des webhooks de Vapi, et rien d'autre. */
    f.realtime!.latency = { total: { count: 5, median: 1500, p95: 1900, max: 1900 } };
    return f;
  };

  const lat = (f: CallFacts, id: string) => auditCall(f).checks.find(c => c.id === id)!;

  it('nomme le parole-à-parole, et jamais « appel antérieur au partage »', () => {
    for (const id of ['prep', 'llm', 'ttfa']) {
      const c = lat(s2s(), id);
      expect(c.status).toBe('skip');
      expect(c.value).toMatch(/parole-à-parole/);
      expect(c.value).toMatch(/llm-stream/);
      expect(c.value).not.toMatch(/antérieur au partage/);
      /* Pas de cible non plus: en afficher une pour un étage qui n'existe pas
         fait lire un manque comme un retard. */
      expect(c.target).toBeUndefined();
    }
  });

  it('nomme `customLlm` éteint quand c\'est ça, pas le parole-à-parole', () => {
    const f = good();
    f.remote.customLlm = false;
    f.remote.speechToSpeech = false;
    f.realtime!.latency = { total: { count: 5, median: 1500, p95: 1900, max: 1900 } };
    const c = lat(f, 'prep');
    expect(c.value).toMatch(/customLlm/);
    expect(c.value).not.toMatch(/parole-à-parole/);
  });

  it("ne conclut RIEN quand l'assistant distant n'a pas été lu", () => {
    const f = good();
    f.remote.customLlm = null;
    f.remote.speechToSpeech = null;
    f.realtime!.latency = { total: { count: 5, median: 1500, p95: 1900, max: 1900 } };
    const c = lat(f, 'prep');
    expect(c.value).toBe('pas de mesure');
    expect(c.value).not.toMatch(/sans objet/);
  });

  it('garde « appel antérieur au partage » pour le SEUL cas où c\'est vrai', () => {
    /* LLM mesuré, PREP non, sur la chaîne classique: le partage n'existait
       pas encore à ce relevé. C'est la phrase d'origine, et elle reste. */
    const f = good();
    f.realtime!.latency = {
      llm: { count: 6, median: 650, p95: 900, max: 900 },
      total: { count: 5, median: 1500, p95: 1900, max: 1900 },
    };
    expect(lat(f, 'prep').value).toMatch(/antérieur au partage/);
  });

  it('la chaîne classique complète garde ses trois étages notés', () => {
    for (const id of ['prep', 'llm', 'ttfa']) {
      const c = lat(good(), id);
      expect(c.value).toMatch(/médiane/);
      expect(c.target).toBeDefined();
    }
  });
});

/**
 * LA DÉCOUPE DU DÉLAI RESSENTI QUAND NOS ÉTAGES N'EXISTENT PAS.
 *
 * Soustraire zéro rendrait le délai ENTIER et attribuerait à la détection de
 * fin de tour le temps qu'OpenAI passe à répondre, donc enverrait baisser un
 * seuil pour une seconde qui n'est pas la sienne. Ce qui reste vrai est le
 * PLANCHER: les seuils posés sont dépensés avant que quoi que ce soit ne
 * commence. Il se décrit; il ne se note que s'il pèse la majorité d'un délai
 * déjà hors cible.
 */
describe('auditCall — le plancher de fin de tour en parole-à-parole', () => {
  const s2s = (gaps: number[], ep = { provider: 'livekit', waitSeconds: 0.6, punctuationSeconds: 0.8 }): CallFacts => {
    const f = good();
    f.expected.tierServed = 'superagent';
    f.expected.realtimeTranscriber = true;
    f.remote.customLlm = false;
    f.remote.speechToSpeech = true;
    f.remote.transcriber = true;
    f.remote.endpointing = ep;
    f.expected.endpointing = ep;
    f.vapiGapsSeconds = gaps;
    f.realtime!.latency = { total: { count: 5, median: 1500, p95: 1900, max: 1900 } };
    return f;
  };
  const turn = (f: CallFacts) => auditCall(f).checks.find(c => c.id === 'turn-detect');

  it('la ligne EXISTE, alors qu\'elle était absente faute d\'étages', () => {
    const c = turn(s2s([1.6, 1.8, 1.7]))!;
    expect(c).toBeDefined();
    expect(c.value).toMatch(/1400 ms de seuils/);
    expect(c.value).toMatch(/que ce chemin ne nous laisse pas mesurer/);
  });

  it("un appel DANS les clous ne devient pas rouge à cause de seuils montés exprès", () => {
    /* 0,6 / 0,8 sont les valeurs du niveau superagent, montées le 17/09 après
       « il pose direct une question alors que j'ai pas fini ma phrase ». Les
       noter rouges sur leur seule valeur enverrait défaire un réglage posé
       contre un retour réel: c'est le geste que cet audit a déjà appelé huit
       fois à tort. */
    const c = turn(s2s([1.6, 1.8, 1.7]))!;
    expect(c.status).toBe('ok');
    expect(c.lever).toBeUndefined();
  });

  it('hors cible ET majoritaire: il note, et nomme les seuils du NIVEAU', () => {
    const c = turn(s2s([2.4, 2.6, 2.5]))!;
    expect(c.status).toBe('warn');
    expect(c.value).toMatch(/MAJORITÉ/);
    expect(String(c.lever)).toMatch(/VOICE_REALTIME_START_WAIT_SECONDS/);
    /* Surtout pas la variable globale: elle sert la chaîne classique, dont la
       latence vient APRÈS la décision. */
    expect(String(c.lever)).not.toMatch(/`VOICE_START_WAIT_SECONDS`/);
    expect(String(c.lever)).toMatch(/voice:resync/);
  });

  it('hors cible mais MINORITAIRE: il renvoie ailleurs plutôt qu\'aux seuils', () => {
    const c = turn(s2s([5.0, 5.2, 5.1], { provider: 'livekit', waitSeconds: 0.2, punctuationSeconds: 0.2 }))!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/MINORITAIRES/);
    expect(String(c.lever)).toMatch(/pas les seuils/);
  });

  it('le délai ressenti n\'est noté QU\'UNE fois, sur sa propre ligne', () => {
    /* `vapi-gap` et le plancher mesurent le même fait. Les noter tous les
       deux, c'est compter deux fois (6quaterquinquagesies). */
    const report = auditCall(s2s([2.4, 2.6, 2.5]));
    expect(report.checks.find(c => c.id === 'vapi-gap')!.status).toBe('warn');
    expect(report.checks.find(c => c.id === 'turn-detect')!.status).not.toBe('fail');
  });

  it("le levier du délai ressenti ne renvoie jamais à une ligne absente", () => {
    /* Sans seuils lus ET sans étages, aucune ligne ne suit: le levier disait
       quand même « la ligne suivante dit quelle PART est à nous ». */
    const f = s2s([2.4, 2.6, 2.5]);
    f.remote.endpointing = null;
    const report = auditCall(f);
    expect(report.checks.find(c => c.id === 'turn-detect')).toBeUndefined();
    const gap = report.checks.find(c => c.id === 'vapi-gap')!;
    expect(String(gap.lever)).not.toMatch(/ligne suivante/);
    expect(String(gap.lever)).toMatch(/rien ne permet de le découper/);
  });

  it('la chaîne classique garde la soustraction, inchangée', () => {
    const c = turn(good())!;
    expect(c.label).toMatch(/avant que la requête n'arrive chez nous/);
    expect(c.value).toMatch(/nos étages/);
  });
});

/**
 * LE BRIEF ET LES ÉTAGES RÉPONDENT À LA MÊME QUESTION, UNE SEULE FOIS.
 *
 * Les deux dépendent de « `llm-stream` tourne-t-il », et chacune la posait de
 * son côté. Celle du brief rangeait un assistant JAMAIS LU du côté custom-LLM
 * et concluait « sans objet », c'est-à-dire un vert inventé sur la ligne qui
 * existe précisément pour distinguer deux pannes opposées.
 */
describe('auditCall — le brief lit la même règle que les étages', () => {
  const brief = (f: CallFacts) => auditCall(f).checks.find(c => c.id === 'brief')!;

  it("ne conclut pas « sans objet » sur un assistant distant non lu", () => {
    const f = good();
    f.remote.customLlm = null;
    f.remote.speechToSpeech = null;
    const c = brief(f);
    expect(c.status).toBe('skip');
    expect(c.value).toMatch(/n'a pas été lu/);
    expect(c.value).not.toMatch(/sans objet/);
    expect(c.target).toBeUndefined();
  });

  it('reste « sans objet » sur la chaîne custom-LLM, qui repose tout à chaque tour', () => {
    const c = brief(good());
    expect(c.status).toBe('skip');
    expect(c.value).toMatch(/sans objet/);
  });

  it('et le réclame en parole-à-parole, où rien ne le repose', () => {
    const f = good();
    f.remote.customLlm = false;
    f.remote.speechToSpeech = true;
    expect(brief(f).status).toBe('fail');
  });
});

/**
 * OÙ SONT LES MACHINES, mesuré et non déduit.
 *
 * Deux lignes pour une décision qui engage une facture d'infrastructure, et
 * elles tirent dans des sens OPPOSÉS: la base est à l'est, l'orchestration de
 * Vapi est où elle est. Déplacer le backend vers l'une l'éloigne de l'autre,
 * donc aucune des deux ne tranche seule. Jusqu'ici la décision se prenait au
 * raisonnement, et le raisonnement a déjà eu tort sur exactement ce sujet
 * (6quinquesexagesies: la table de coûts disait le modèle, la facture disait la
 * plateforme).
 */
describe('vapiHopMs — l\'écart entre deux horloges', () => {
  it('apparie par nom ET dans l\'ordre, un même outil pouvant revenir', () => {
    const hop = vapiHopMs(
      [
        { name: 'lookupBooking', tookSeconds: 1.2 },
        { name: 'checkAvailability', tookSeconds: 1.6 },
        { name: 'lookupBooking', tookSeconds: 0.9 },
      ],
      [
        { name: 'lookupBooking', ms: 1100 },
        { name: 'checkAvailability', ms: 1500 },
        { name: 'lookupBooking', ms: 800 },
      ],
    );
    expect(hop).toEqual({ medianMs: 100, pairs: 3 });
  });

  it('lit nos échecs malgré leur suffixe, sinon il se tait sur l\'appel qui a mal tourné', () => {
    /* `recordToolCall` écrit `checkAvailability:error` quand l'outil lève. Sans
       retirer le suffixe, rien ne s'apparie précisément sur l'appel dont on
       veut comprendre la lenteur. */
    const hop = vapiHopMs(
      [{ name: 'checkAvailability', tookSeconds: 2.5 }],
      [{ name: 'checkAvailability:error', ms: 2400 }],
    );
    expect(hop).toEqual({ medianMs: 100, pairs: 1 });
  });

  it('ne rend rien sans nos propres relevés', () => {
    expect(vapiHopMs([{ name: 'lookupBooking', tookSeconds: 1.2 }], undefined)).toBeNull();
    expect(vapiHopMs([{ name: 'lookupBooking', tookSeconds: 1.2 }], [])).toBeNull();
  });

  it('ignore un outil que Vapi n\'a pas chronométré', () => {
    expect(vapiHopMs(
      [{ name: 'lookupBooking', tookSeconds: null }, { name: 'captureLead', tookSeconds: 0.5 }],
      [{ name: 'lookupBooking', ms: 900 }, { name: 'captureLead', ms: 400 }],
    )).toEqual({ medianMs: 100, pairs: 1 });
  });
});

describe('auditCall — les deux distances', () => {
  const find = (f: CallFacts, id: string) => auditCall(f).checks.find(c => c.id === id);

  const withDb = (floorMs: number, worstMs = floorMs + 20): CallFacts => {
    const f = good();
    f.realtime!.dbRoundTrip = { floorMs, worstMs, samples: 3 };
    /* La région vient du SERVEUR depuis le 21/09, plus d'un littéral dans le
       levier: la fixture doit donc la porter pour que la ligne la nomme. */
    f.realtime!.dbRegion = 'us-east-1';
    return f;
  };

  it('une base dans la même région passe au vert, sans levier', () => {
    const c = find(withDb(4), 'db-distance')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/4 ms au plancher/);
    expect(c.lever).toBeUndefined();
  });

  it("une base à l'autre bout du pays nomme la cause et le piège du déplacement", () => {
    /* Oregon → us-east-1: 60 à 80 ms, payés par CHAQUE requête Prisma du
       chemin d'appel, c'est-à-dire par les outils, qui sont le plus gros poste
       de latence restant (6unsexagesies). */
    const c = find(withDb(72, 310), 'db-distance')!;
    expect(c.status).toBe('fail');
    expect(c.value).toMatch(/distance de continent/);
    expect(String(c.lever)).toMatch(/oregon/);
    expect(String(c.lever)).toMatch(/us-east-1/);
    /* LE PIÈGE, et c'est la moitié de la ligne: déplacer le backend sans
       déplacer la base ALLONGE cet aller-retour. */
    expect(String(c.lever)).toMatch(/SANS déplacer la base/);
  });

  it('sépare le plancher du pire: un réveil de pool n\'est pas une distance', () => {
    const c = find(withDb(4, 310), 'db-distance')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/310 ms au pire/);
  });

  it('se tait quand la sonde n\'a rien rendu', () => {
    expect(find(good(), 'db-distance')).toBeUndefined();
  });

  it('un Vapi PROCHE dit lui-même que déplacer le backend coûterait', () => {
    /* La conclusion vit dans la VALEUR, pas dans le levier: c'est le cas vert
       qui répond « non » à la question qui coûte cher, et un audit muet quand
       tout va bien laisse décider au raisonnement. */
    const f = good();
    f.realtime!.toolCalls = [
      { name: 'checkAvailability', ms: 570 },
      { name: 'bookAppointment', ms: 370 },
      { name: 'captureLead', ms: 170 },
    ];
    const c = find(f, 'vapi-hop')!;
    expect(c.status).toBe('ok');
    expect(c.value).toMatch(/30 ms de médiane sur 3 outil/);
    expect(c.value).toMatch(/Vapi est donc PROCHE/);
    expect(c.value).toMatch(/ajouterait cette distance/);
  });

  it('un TRAJET long devient l\'argument pour la région, pesé contre la base', () => {
    /* La région ne s'invoque plus sur le composite mais sur la part MESURÉE du
       trajet, sur une seule horloge (22/09/2026). */
    const f = good();
    f.realtime!.toolCalls = [
      { name: 'checkAvailability', ms: 400 },
      { name: 'bookAppointment', ms: 200 },
      { name: 'captureLead', ms: 20 },
    ];
    f.realtime!.toolDispatch = [
      { name: 'checkAvailability', dispatchMs: 900, handlerMs: 410 },
      { name: 'bookAppointment', dispatchMs: 880, handlerMs: 210 },
      { name: 'captureLead', dispatchMs: 910, handlerMs: 25 },
    ];
    const c = find(f, 'vapi-hop')!;
    expect(c.status).not.toBe('ok');
    expect(String(c.lever)).toMatch(/TRAJET porte l'essentiel/);
    expect(String(c.lever)).toMatch(/aller-retour vers notre propre base/);
  });

  it('un trajet COURT interdit la région et renvoie au tour de modèle', () => {
    /* Le cas qui renverse l'ancien levier: Vapi compte ~2 s, mais le trajet
       mesuré n'en fait que 80, donc le reste tombe APRÈS notre réponse — le
       tour de modèle suivant. Déménager la région n'y changerait rien, et
       c'est un déménagement d'infrastructure. */
    const f = good();
    f.realtime!.toolCalls = [{ name: 'checkAvailability', ms: 400 }];
    f.realtime!.toolDispatch = [{ name: 'checkAvailability', dispatchMs: 80, handlerMs: 420 }];
    const c = find(f, 'vapi-hop')!;
    expect(String(c.lever)).toMatch(/NE PAS déménager la région/);
    expect(String(c.lever)).not.toMatch(/rapprocher le backend/);
  });

  it('notre propre overhead se nomme, et il n\'envoie pas à la région', () => {
    const f = good();
    f.realtime!.toolCalls = [{ name: 'checkAvailability', ms: 400 }];
    f.realtime!.toolDispatch = [{ name: 'checkAvailability', dispatchMs: 60, handlerMs: 1800 }];
    const c = find(f, 'vapi-hop')!;
    expect(String(c.lever)).toMatch(/CHEZ NOUS/);
    expect(String(c.lever)).toMatch(/pas la région/);
  });

  it('SANS borne d\'émission, aucun levier: c\'est le refus qui compte', () => {
    /* En parole-à-parole le modèle est chez Vapi, donc l'émission ne passe pas
       par nous et cette borne ne peut PAS exister. L'audit doit alors refuser
       de nommer un geste, au lieu de retomber sur « la région »: c'est le
       neuvième faux levier de cette ligne qu'on ferme ici. */
    const f = good();
    f.realtime!.toolCalls = [
      { name: 'checkAvailability', ms: 400 },
      { name: 'bookAppointment', ms: 200 },
    ];
    delete (f.realtime as Record<string, unknown>).toolDispatch;
    const c = find(f, 'vapi-hop')!;
    expect(String(c.lever)).toMatch(/aucun levier/);
    expect(String(c.lever)).toMatch(/Ne pas déménager la région/);
  });

  it('dit PLAFOND, jamais « réseau »: notre file HTTP est dedans', () => {
    /* Annoncer « 90 ms de réseau » sur un chiffre composite serait une
       déduction qui a l'air d'une lecture (6quinvicies). */
    const f = good();
    f.realtime!.toolCalls = [{ name: 'checkAvailability', ms: 570 }];
    delete (f.realtime as Record<string, unknown>).toolDispatch;
    const value = find(f, 'vapi-hop')!.value;
    expect(value).toMatch(/PLAFOND, pas le trajet/);
    /* Et surtout: la valeur ne doit PAS affirmer que c'est du réseau. */
    expect(value).not.toMatch(/ms de réseau/);
  });

  it('un écart NÉGATIF se dit inutilisable, il ne se note pas', () => {
    /* Vapi ne peut pas compter un outil plus court que notre exécution: c'est
       l'appariement ou les horloges, pas une distance négative. Même
       traitement qu'un TTFA plus grand que le pire délai de Vapi. */
    const f = good();
    f.realtime!.toolCalls = [
      { name: 'checkAvailability', ms: 900 },
      { name: 'bookAppointment', ms: 900 },
      { name: 'captureLead', ms: 900 },
    ];
    const c = find(f, 'vapi-hop')!;
    expect(c.status).toBe('warn');
    expect(c.value).toMatch(/MESURE INUTILISABLE/);
    expect(c.target).toBeUndefined();
    expect(String(c.lever)).toMatch(/avant de conclure quoi que ce soit sur la région/);
  });

  it('se tait quand nous n\'avons pas chronométré nos outils', () => {
    expect(find(good(), 'vapi-hop')).toBeUndefined();
  });
});

/**
 * LES REPLIS PRISMA, QUESTION LAISSÉE OUVERTE LE 19/09.
 *
 * Le relevé du 18/09 montre des outils qui RALENTISSENT au fil de l'appel
 * (2,2 puis 6,1, 2,9, 4,5, 7,7 s), ce qui est l'inverse d'un démarrage à
 * froid. Le journal de repli a été passé en `info` pour répondre, mais il se
 * lit dans Render, à la main, en connaissant l'heure de l'appel: le fait
 * existait sans que personne ne l'ouvre.
 */
describe('auditCall — les replis Prisma de cet appel', () => {
  const withRetries = (r: { count: number; waitedMs: number; coldStarts: number }): CallFacts => {
    const f = good();
    f.realtime!.dbRetries = r;
    return f;
  };
  const line = (f: CallFacts) => auditCall(f).checks.find(c => c.id === 'db-retries');

  it("ZÉRO n'affiche rien: un écran qu'on relit en entier n'a pas besoin d'un vert de plus", () => {
    expect(line(withRetries({ count: 0, waitedMs: 0, coldStarts: 0 }))).toBeUndefined();
    expect(line(good())).toBeUndefined();
  });

  it("nomme l'attente PURE, celle qui s'ajoute à la durée des outils sans être dans la requête", () => {
    const c = line(withRetries({ count: 2, waitedMs: 750, coldStarts: 0 }))!;
    expect(c.status).toBe('warn');
    expect(c.value).toMatch(/2 repli\(s\), 750 ms d'attente pure/);
    expect(String(c.lever)).toMatch(/\[prisma\]/);
  });

  it('une seconde ou plus devient un DÉFAUT: la cible d\'un outil est 1,5 s', () => {
    expect(line(withRetries({ count: 4, waitedMs: 1900, coldStarts: 0 }))!.status).toBe('fail');
  });

  it("un démarrage à froid envoie au keepalive, pas à la requête", () => {
    /* Les deux réparations n'ont rien à voir: un calcul Neon endormi se règle
       en l'empêchant de s'endormir, jamais en relisant un `findMany`. */
    const c = line(withRetries({ count: 3, waitedMs: 7000, coldStarts: 2 }))!;
    expect(c.value).toMatch(/dont 2 sur un démarrage à froid/);
    expect(String(c.lever)).toMatch(/keepalive/);
    expect(String(c.lever)).not.toMatch(/\[prisma\]/);
  });

  it('dit sa propre réserve: le compteur est processus-large', () => {
    /* Une extension Prisma ne sait pas quel appel est en vol. Taire ça ferait
       lire un chiffre partagé comme un chiffre par appel. */
    expect(line(withRetries({ count: 1, waitedMs: 250, coldStarts: 0 }))!.value)
      .toMatch(/PROCESSUS-LARGE/);
  });
});

/**
 * `endCall` N'EST PAS UN DE NOS OUTILS, et l'audit le comptait quand même.
 *
 * Relevé réel du 21/09: `endCall 5.5 s` classé le plus lent de l'appel, avec
 * pour levier « qui ne lit PAS l'agenda: c'est une requête Prisma. Regarder
 * Neon ». `endCall` n'est ni dans `KNOWN_TOOLS` ni nulle part dans le runtime:
 * il ne touche jamais notre backend. Ces cinq secondes sont Vapi qui vide sa
 * file de parole avant de raccrocher. Dixième diagnostic faux de cet audit.
 */
describe('auditCall — les outils de Vapi ne sont pas les nôtres', () => {
  const withEndCall = (): CallFacts => {
    const f = good();
    f.tools = [
      { name: 'lookupBooking', args: {}, result: 'RDV', tookSeconds: 1.2, atSeconds: 18 },
      { name: 'endCall', args: {}, result: null, tookSeconds: 5.5, atSeconds: 101 },
    ];
    return f;
  };
  const tools = (f: CallFacts) => auditCall(f).checks.find(c => c.id === 'tools')!;

  it("ne rougit pas la ligne sur un chiffre qui n'est pas le nôtre", () => {
    const c = tools(withEndCall());
    expect(c.status).toBe('ok');
  });

  it("n'envoie JAMAIS à Neon pour un outil que nous n'exécutons pas", () => {
    /* Le geste appelé n'avait aucun rapport avec la cause: cinq secondes de
       file de parole chez Vapi ne se réparent pas dans une requête Prisma. */
    expect(tools(withEndCall()).lever).toBeUndefined();
  });

  it("les affiche quand même: l'appelant vit ces secondes avant le raccroché", () => {
    const c = tools(withEndCall());
    expect(c.value).toMatch(/chez VAPI, hors de notre portée/);
    expect(c.value).toMatch(/endCall 5\.5 s/);
  });

  it('un de NOS outils trop lent reste un défaut, avec son levier', () => {
    const f = good();
    f.tools = [
      { name: 'lookupBooking', args: {}, result: 'RDV', tookSeconds: 3.0, atSeconds: 18 },
      { name: 'endCall', args: {}, result: null, tookSeconds: 5.5, atSeconds: 101 },
    ];
    const c = tools(f);
    expect(c.status).not.toBe('ok');
    /* Le plus lent des NÔTRES, pas le plus lent du transcript. */
    expect(String(c.lever)).toMatch(/lookupBooking/);
    expect(String(c.lever)).not.toMatch(/endCall/);
  });
});

/**
 * DEUX SONDES, PARCE QU'UNE SEULE NE TRANCHE PAS.
 *
 * Relevé réel du 21/09: 310 ms de plancher pour un `SELECT 1`, quand
 * Oregon → us-east-1 coûte ~70 ms. Deux lectures, deux réparations opposées:
 * 310 ms PAR REQUÊTE (c'est la région), ou 310 ms PAR CONNEXION NEUVE (TCP,
 * TLS, authentification font quatre à cinq allers-retours, ce qui tombe pile
 * sur ce chiffre — et là c'est le pool).
 *
 * La stabilité des trois sondes d'ouverture (310 contre 316) écarte un pic
 * transitoire, PAS un coût payé identiquement par chacune. La seconde sonde
 * tombe en fin d'appel, sur un pool que l'appel entier vient de chauffer.
 */
describe('auditCall — la distance à la base se tranche à deux sondes', () => {
  const find = (f: CallFacts, id: string) => auditCall(f).checks.find(c => c.id === id);
  const withProbes = (openMs: number, warmMs: number | null, region: string | null = 'us-east-1'): CallFacts => {
    const f = good();
    f.realtime!.dbRoundTrip = { floorMs: openMs, worstMs: openMs + 6, samples: 3 };
    if (warmMs !== null) f.realtime!.dbRoundTripEnd = { floorMs: warmMs, worstMs: warmMs + 4, samples: 3 };
    if (region) f.realtime!.dbRegion = region;
    return f;
  };

  it("un pool chaud qui s'effondre dit l'ÉTABLISSEMENT, et interdit la région", () => {
    const c = find(withProbes(310, 72), 'db-distance')!;
    expect(c.value).toMatch(/POOL CHAUD EN FIN D'APPEL: 72 ms/);
    expect(c.value).toMatch(/ÉTABLISSEMENT d'une connexion, pas la distance/);
    expect(String(c.lever)).toMatch(/ce n'est PAS la région/);
    expect(String(c.lever)).toMatch(/connection_limit/);
    /* Il NOMME `render.yaml` pour l'écarter: c'est le geste qu'on empêche. */
    expect(String(c.lever)).toMatch(/PAS `render\.yaml`/);
  });

  it('un pool chaud qui TIENT dit la distance, et là la région est la réponse', () => {
    const c = find(withProbes(310, 305), 'db-distance')!;
    expect(c.value).toMatch(/c'est bien la DISTANCE/);
    expect(String(c.lever)).toMatch(/render\.yaml/);
    expect(String(c.lever)).toMatch(/us-east-1/);
  });

  it('nomme la région lue sur le serveur, jamais celle du poste', () => {
    expect(find(withProbes(310, 305, 'eu-central-1'), 'db-distance')!.value).toMatch(/base en eu-central-1/);
  });

  it("sans seconde sonde, il DIT qu'il ne peut pas trancher", () => {
    /* Une ligne qui conclurait quand même enverrait migrer sur une lecture
       qu'elle n'a pas faite. */
    const c = find(withProbes(310, null), 'db-distance')!;
    expect(c.value).toMatch(/impossible de dire si c'est la distance ou l'établissement/);
  });

  it('une base vraiment proche reste verte, sans levier', () => {
    const c = find(withProbes(4, 3), 'db-distance')!;
    expect(c.status).toBe('ok');
    expect(c.lever).toBeUndefined();
  });
});
