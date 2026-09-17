import { describe, it, expect } from 'vitest';
import { auditCall, chunkableReplies, readVapiMessages, renderAudit, TARGETS, tierTurns, type CallFacts } from '../call-audit';

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

  it('aucun plan est le bon état, pas un défaut', () => {
    const ep = auditCall(s2s()).checks.find(c => c.id === 'endpointing')!;
    expect(ep.status).toBe('ok');
    expect(ep.value).toMatch(/appartient au modèle/);
    expect(ep.lever).toBeUndefined();
    // Et il ne propose pas un resync qui ne changerait rien.
    expect(ep.target).toBeUndefined();
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
