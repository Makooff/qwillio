/**
 * L'audit d'UN appel: « est-ce que tout marche, et est-ce que tout est
 * réglé ? », répondu ligne par ligne, avec un levier par ligne.
 *
 * Le docteur (`voice:doctor`) DÉCRIT: il montre tout ce qu'il sait, et c'est
 * au lecteur de conclure. Ce module TRANCHE: chaque vérification a un verdict
 * (ok / à surveiller / défaut), la valeur mesurée, la cible, et ce qu'il faut
 * toucher pour la corriger (variable, commande, code). Le script
 * `voice:audit` collecte les faits (notre base, l'appel chez Vapi, l'assistant
 * distant, l'environnement) et les passe ici; ce fichier ne lit rien lui-même,
 * pour être testable sur des faits écrits à la main.
 *
 * Deux familles. FONCTIONNEMENT: l'appel a-t-il fait ce qu'il devait
 * (décroché, parlé, réservé, prévenu, écrit). LATENCE ET RÉGLAGES: où part le
 * temps et quels curseurs sont à côté. Les seuils sont des cibles de
 * conversation naturelle, pas des records: un tour à 2 s se sent, un tour à
 * 1,2 s ne se sent plus.
 */

import type { StageStats } from './latency-tracker';
import { isPlaceholderName } from '../../utils/spelled-name';
import { VOICE_TIERS, type VoiceTierId } from './voice-tiers';

export type AuditStatus = 'ok' | 'warn' | 'fail' | 'skip';
export type AuditArea = 'fonctionnement' | 'latence' | 'reglages';

export interface AuditCheck {
  id: string;
  area: AuditArea;
  status: AuditStatus;
  label: string;
  /** Ce qui a été mesuré ou observé, en une ligne. */
  value: string;
  /** La cible, quand il y en a une. */
  target?: string;
  /** Ce qu'il faut toucher pour passer au vert. Absent quand c'est vert. */
  lever?: string;
}

export interface ToolEvent {
  name: string;
  args: Record<string, unknown>;
  result: string | null;
  tookSeconds: number | null;
}

export interface EndpointingFacts {
  provider: string;
  waitSeconds: number | null;
  punctuationSeconds: number | null;
}

export interface CallFacts {
  callId: string;
  startedAt: string | null;
  endedReason: string | null;
  durationSeconds: number | null;
  /** Répliques de l'assistant et de l'appelant, comptées chez Vapi. */
  assistantLines: number;
  /** Ce que l'assistant a DIT: sans le texte, « le son n'a pas streamé » ne se juge pas. */
  assistantTexts: string[];
  callerLines: number;
  /** Délai entre la fin de parole de l'appelant et la réponse, horloge Vapi. */
  vapiGapsSeconds: number[];
  tools: ToolEvent[];
  /** `metadata.realtime` de notre ligne d'appel, tel que stocké. `null` = pas relevé. */
  realtime: Record<string, any> | null;
  ours: {
    found: boolean;
    isLead: boolean;
    nameCollected: string | null;
    callerName: string | null;
    summary: string | null;
    language: 'fr' | 'en' | 'nl';
  };
  booking: {
    id: string;
    smsSent: boolean;
    smsLogs: Array<{ status: string; errorMsg: string | null }>;
  } | null;
  /** `null` = non vérifié (pas de clé, pas d'appel réseau). */
  recordingReadable: boolean | null;
  remote: {
    customLlm: boolean | null;
    endpointing: EndpointingFacts | null;
    /**
     * Le moteur que l'assistant DISTANT porte vraiment. `null` = non lu.
     *
     * Lu et pas déduit du réglage: c'est tout l'écart entre « le client a
     * choisi superagent » et « l'appelant a entendu superagent ». Les deux
     * écritures de l'assistant enregistré ont envoyé du classique à tout le
     * monde pendant des semaines, y compris aux clients réglés en temps réel.
     */
    speechToSpeech: boolean | null;
  };
  expected: {
    endpointing: EndpointingFacts;
    fullModel: string;
    miniModel: string;
    /** Le seuil de découpe de la synthèse (`VOICE_TTS_MIN_CHUNK_CHARS`). */
    minChunkChars: number;
    greetingPinned: boolean;
    smsReady: boolean;
    /** Le niveau DEMANDÉ par le client. `null` = rien de choisi. */
    tierRequested: VoiceTierId | null;
    /** Le niveau qui DOIT servir, voix clonée comprise. */
    tierServed: VoiceTierId;
  };
}

export interface AuditReport {
  callId: string;
  checks: AuditCheck[];
  works: boolean;
  /** Nombre de leviers à actionner, défauts puis alertes. */
  todo: AuditCheck[];
}

/** Cibles par étage, en millisecondes: [vert jusqu'à, orange jusqu'à]. */
export const TARGETS = {
  prepMs: [150, 400],
  llmMs: [900, 1500],
  ttfaMs: [700, 1200],
  totalMs: [2000, 3000],
  vapiGapSeconds: [2.0, 3.0],
  toolSeconds: [1.5, 2.5],
  cacheHitPct: [40, 15],
  streamedPct: [50, 25],
} as const;

const BAD_ENDINGS = ['silence-timed-out', 'pipeline-error', 'assistant-error', 'unknown-error', 'exceeded-max-duration', 'worker-shutdown'];

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function grade(value: number, [ok, warn]: readonly [number, number], higherIsBetter = false): AuditStatus {
  if (higherIsBetter) return value >= ok ? 'ok' : value >= warn ? 'warn' : 'fail';
  return value <= ok ? 'ok' : value <= warn ? 'warn' : 'fail';
}

function stage(realtime: Record<string, any> | null, name: string): StageStats | null {
  const s = realtime?.latency?.[name];
  return s && typeof s.median === 'number' ? (s as StageStats) : null;
}

/**
 * Combien de ces répliques POUVAIENT être découpées par la synthèse.
 *
 * `chunkPlan` émet son premier morceau à la première fin de phrase située au
 * moins `minChars` caractères après le début (60 par défaut, et les frontières
 * sont `.`, `!`, `?` seulement: la virgule a été retirée parce qu'elle faisait
 * parler haché). Une réplique courte n'a donc AUCUNE frontière avant sa fin:
 * elle part en un seul morceau, et « le son n'est pas parti avant la fin du
 * texte » n'y décrit aucun défaut.
 *
 * Sans ce compte, l'audit notait 1/5 sur un appel où 4 réponses sur 5 étaient
 * « Un instant, je m'en occupe » (27 caractères), et plaçait « relire le
 * chunkPlan » en tête des choses à faire. Le seul geste que ça appelle est de
 * baisser le seuil, c'est-à-dire de rendre la voix hachée pour gagner cent
 * millisecondes sur des réponses déjà rapides. Un diagnostic FAUX coûte plus
 * cher qu'aucun diagnostic (6sexvicies).
 */
export function chunkableReplies(texts: string[], minChars: number): number {
  return texts.filter(text => {
    const t = text.trim();
    for (let i = minChars - 1; i < t.length - 1; i++) {
      /* `i + 1 < t.length`: une frontière posée sur le DERNIER caractère ne
         découpe rien, elle termine la réplique. */
      if (t[i] === '.' || t[i] === '!' || t[i] === '?') return true;
    }
    return false;
  }).length;
}

/**
 * Combien de tours chaque ÉTAGE de modèle a réellement servis.
 *
 * Deux pièges, et le compte est faux sans les deux.
 *
 * 1. Le nom SERVI est daté. OpenAI rend `gpt-4.1-mini-2025-04-14` là où la
 *    variable dit `gpt-4.1-mini` (6duotrigesies: c'est le flux d'OpenAI qui
 *    nomme le modèle, pas le réglage). Une égalité stricte compterait zéro
 *    partout, pour toujours.
 * 2. Un nom configuré peut être le PRÉFIXE de l'autre: avec `gpt-4.1` en
 *    complet et `gpt-4.1-mini` en rapide, un tour rapide commence aussi par le
 *    nom du complet. Chaque modèle servi va donc au nom configuré le plus
 *    LONG qui le préfixe, jamais au premier trouvé.
 *
 * Les tours répondus sans modèle (acquiescements) ne sont pas ici: rien
 * n'appelle OpenAI, donc rien n'est relevé. Ils se comptent à part
 * (`deflectedTurns`).
 */
export function tierTurns(
  models: Record<string, number> | undefined,
  fullModel: string,
  miniModel: string,
): { full: number; mini: number; other: number; total: number } {
  const out = { full: 0, mini: 0, other: 0, total: 0 };
  for (const [served, count] of Object.entries(models ?? {})) {
    const n = typeof count === 'number' ? count : 0;
    out.total += n;
    const hits: Array<['full' | 'mini', string]> = [];
    if (fullModel && served.startsWith(fullModel)) hits.push(['full', fullModel]);
    if (miniModel && served.startsWith(miniModel)) hits.push(['mini', miniModel]);
    if (!hits.length) {
      out.other += n;
      continue;
    }
    hits.sort((a, b) => b[1].length - a[1].length);
    out[hits[0][0]] += n;
  }
  return out;
}

function resultSays(result: string | null, ...prefixes: string[]): boolean {
  if (!result) return false;
  const head = result.trim().toUpperCase();
  return prefixes.some(p => head.startsWith(p.toUpperCase()));
}

/**
 * Lit les messages d'un appel tels que Vapi les rend (`artifact.messages`)
 * et en tire les faits de conversation: répliques, délais à l'horloge de
 * Vapi, outils appelés avec leur durée et leur réponse. Même lecture que le
 * docteur, isolée ici pour être testée sur des messages écrits à la main.
 */
export function readVapiMessages(messages: Array<Record<string, any>>): {
  assistantLines: number;
  /** Ce que l'assistant a DIT, pour juger la découpe de la synthèse. */
  assistantTexts: string[];
  callerLines: number;
  vapiGapsSeconds: number[];
  tools: ToolEvent[];
} {
  let assistantLines = 0;
  const assistantTexts: string[] = [];
  let callerLines = 0;
  const gaps: number[] = [];
  const tools: ToolEvent[] = [];
  const pending = new Map<string, { at: number | null; args: Record<string, unknown> }>();
  let lastUserEnd: number | null = null;
  for (const m of messages) {
    const at = typeof m.secondsFromStart === 'number' ? m.secondsFromStart : null;
    if (m.role === 'user') {
      callerLines++;
      lastUserEnd = typeof m.endTime === 'number' && typeof m.time === 'number' && at !== null
        ? at + (m.endTime - m.time) / 1000
        : at;
    } else if (m.role === 'bot' || m.role === 'assistant') {
      assistantLines++;
      if (typeof m.message === 'string' && m.message.trim()) assistantTexts.push(m.message);
      else if (typeof m.content === 'string' && m.content.trim()) assistantTexts.push(m.content);
      if (at !== null && lastUserEnd !== null) {
        gaps.push(Math.max(0, at - lastUserEnd));
        lastUserEnd = null;
      }
    }
    if (m.role === 'tool_calls' && Array.isArray(m.toolCalls)) {
      for (const c of m.toolCalls) {
        const name: string = c.function?.name ?? c.name ?? '?';
        let args: Record<string, unknown> = {};
        const raw = c.function?.arguments ?? c.arguments ?? {};
        if (typeof raw === 'string') {
          try { args = JSON.parse(raw); } catch { args = {}; }
        } else if (raw && typeof raw === 'object') {
          args = raw as Record<string, unknown>;
        }
        pending.set(name, { at, args });
      }
    } else if (m.role === 'tool_call_result') {
      const name: string = m.name ?? '?';
      const open = pending.get(name);
      pending.delete(name);
      tools.push({
        name,
        args: open?.args ?? {},
        result: typeof m.result === 'string' ? m.result : m.result == null ? null : JSON.stringify(m.result),
        tookSeconds: at !== null && open?.at != null ? Math.round(Math.max(0, at - open.at) * 100) / 100 : null,
      });
    }
  }
  /* Un outil appelé sans réponse vue (appel coupé pendant l'agenda) compte. */
  for (const [name, open] of pending) tools.push({ name, args: open.args, result: null, tookSeconds: null });
  return { assistantLines, assistantTexts, callerLines, vapiGapsSeconds: gaps, tools };
}

export function auditCall(facts: CallFacts): AuditReport {
  const checks: AuditCheck[] = [];
  const push = (c: AuditCheck) => checks.push(c);
  const rt = facts.realtime;
  /* Ce que chaque étage de modèle a SERVI. Lu une fois: deux lignes s'en
     servent, et l'une propose un levier que l'autre peut démentir. */
  const tiers = tierTurns(rt?.models as Record<string, number> | undefined,
    facts.expected.fullModel, facts.expected.miniModel);
  const fastTierIdle = facts.expected.fullModel !== facts.expected.miniModel
    && tiers.mini === 0 && tiers.total >= 3;

  // ── FONCTIONNEMENT ───────────────────────────────────────────────────────

  {
    const reason = facts.endedReason ?? 'inconnu';
    const bad = BAD_ENDINGS.some(b => reason.startsWith(b));
    push({
      id: 'ended', area: 'fonctionnement', status: bad ? 'fail' : 'ok',
      label: "fin d'appel",
      value: `${reason}${facts.durationSeconds != null ? ` · ${facts.durationSeconds} s` : ''}`,
      lever: bad
        ? reason.startsWith('silence-timed-out') && facts.assistantLines === 0
          ? "l'accueil n'est pas parti: `voice:doctor` lit la première phrase distante; si une URL y est épinglée, `VOICE_GREETING_PINNED` doit être absent"
          : 'lire `endedReason` et les journaux Render `[Voice]` autour de cette heure'
        : undefined,
    });
  }

  push({
    id: 'spoke', area: 'fonctionnement',
    status: facts.assistantLines === 0 ? 'fail' : facts.callerLines === 0 ? 'warn' : 'ok',
    label: 'la conversation a eu lieu',
    value: `${facts.assistantLines} réplique(s) de l'assistant, ${facts.callerLines} de l'appelant`,
    lever: facts.assistantLines === 0
      ? "l'assistant n'a rien dit: première phrase muette ou modèle en panne, voir « fin d'appel » et « tours en repli »"
      : facts.callerLines === 0 ? "l'appelant n'a rien été entendu dire: micro, transcripteur, ou accueil trop long" : undefined,
  });

  push({
    id: 'ours', area: 'fonctionnement',
    status: facts.ours.found ? 'ok' : 'fail',
    label: "l'appel est dans notre base",
    value: facts.ours.found ? 'ligne ClientCall trouvée' : 'ABSENT: le webhook de fin d\'appel n\'est pas arrivé ou a été refusé',
    lever: facts.ours.found ? undefined : "vérifier `VAPI_WEBHOOK_SECRET` et l'URL `server` de l'assistant (`voice:doctor`)",
  });

  {
    const customLlm = facts.remote.customLlm;
    const served = Object.keys(rt?.models ?? {});
    /* En parole-à-parole il n'y a PAS de custom-LLM, et c'est la DÉFINITION du
       mode, pas une panne: le modèle entend l'audio et répond en audio, donc
       Vapi parle à OpenAI directement. Sans ce garde, l'audit annonçait
       « l'assistant distant est en openai, resynchroniser » à tout client
       superagent: un diagnostic faux qui envoie chercher une panne
       inexistante, ce qui coûte plus cher que pas de diagnostic du tout
       (6sexvicies). Ce qui reste VRAI et se dit quand même: sur ce chemin, ce
       que le backend ajoute à chaque tour ne s'applique plus. */
    const s2s = facts.remote.speechToSpeech === true;
    const status: AuditStatus = s2s ? 'skip'
      : customLlm === false ? 'fail'
      : !facts.ours.found ? 'skip'
      : served.length ? 'ok' : rt ? 'fail' : 'warn';
    push({
      id: 'custom-llm', area: 'fonctionnement', status,
      label: s2s ? 'boucle de tour (parole-à-parole)' : 'le chemin custom-LLM a servi',
      value: s2s
        ? "OpenAI tient la boucle en audio: la mémoire de l'appelant, la date et la reprise après coupure ne sont plus ajoutées par tour. Le prompt et les outils, si."
        : customLlm === false
        ? "l'assistant distant est en `openai`: Vapi appelle OpenAI lui-même, rien de ce que le backend ajoute n'atteint l'appel"
        : served.length ? `modèles servis: ${served.map(m => `${m} ×${rt!.models[m]}`).join(', ')}` : 'aucun modèle relevé sur cet appel',
      lever: s2s ? undefined
        : customLlm === false
        ? '`npm run voice:resync -- --confirm` pour reposer le bloc `model` en custom-LLM'
        : status === 'fail' ? "aucun tour n'a atteint le backend: 401 sur l'URL custom-LLM ? journaux Render `[VoiceLLM]`"
        : status === 'warn' ? 'appel antérieur au relevé, ou processus redémarré pendant l\'appel' : undefined,
    });
  }

  {
    const failures = (rt?.llmFailures ?? []) as string[];
    const counts = new Map<string, number>();
    for (const f of failures) counts.set(f, (counts.get(f) ?? 0) + 1);
    push({
      id: 'fallbacks', area: 'fonctionnement',
      status: !rt ? 'skip' : failures.length === 0 ? 'ok' : 'fail',
      label: 'tours en phrase de repli',
      value: failures.length ? [...counts].map(([r, n]) => `${r} ×${n}`).join(' ; ') : '0',
      target: '0',
      lever: failures.length
        ? "la raison est dans la valeur: un 4xx OpenAI se corrige dans `toOpenAiBody`, un délai dépassé se lit sur PREP/LLM avant de toucher `VOICE_FIRST_TOKEN_TIMEOUT_MS`"
        : undefined,
    });
  }

  const booked = facts.tools.find(t => t.name === 'bookAppointment' && resultSays(t.result, 'RESERVE', 'BOOKED', 'GEBOEKT'));
  const bookAttempts = facts.tools.filter(t => t.name === 'bookAppointment');
  const checks_ = facts.tools.filter(t => t.name === 'checkAvailability');
  /* UN DÉPLACEMENT N'EST PAS UNE RÉSERVATION MANQUÉE. « Je dois déplacer mon
     rendez-vous » consulte les créneaux puis appelle `rescheduleBooking`, et
     `bookAppointment` n'a aucune raison d'y apparaître. L'audit criait alors
     « créneaux consultés mais bookAppointment jamais appelé » sur CHAQUE appel
     de déplacement, et plaçait « relire le transcript » dans les choses à
     faire, pour un défaut qui n'existait pas (6sexvicies). */
  const moved = facts.tools.find(t => t.name === 'rescheduleBooking' && resultSays(t.result, 'DEPLACE', 'MOVED', 'VERPLAATST'));
  if (moved) {
    push({
      id: 'reschedule', area: 'fonctionnement', status: 'ok',
      label: 'déplacement du rendez-vous',
      value: `déplacé: ${String(moved.result ?? '').slice(0, 110)}`,
    });
  }
  const wantedBooking = bookAttempts.length > 0 || (checks_.length > 0 && !moved);
  if (wantedBooking) {
    const placeholderTry = bookAttempts.find(t => typeof t.args.customerName === 'string' && isPlaceholderName(String(t.args.customerName)));
    push({
      id: 'booking', area: 'fonctionnement',
      status: booked && facts.booking ? 'ok' : booked ? 'warn' : bookAttempts.length ? 'fail' : 'warn',
      label: 'réservation',
      value: booked
        ? `réservée${facts.booking ? ` (ligne ${facts.booking.id.slice(0, 8)})` : ', mais AUCUNE ligne en base liée à cet appel'}`
        : bookAttempts.length
          ? `bookAppointment appelé ${bookAttempts.length} fois sans RESERVE: ${bookAttempts.map(t => (t.result ?? 'sans réponse').slice(0, 90)).join(' | ')}`
          : `créneaux consultés (${checks_.length}) mais bookAppointment jamais appelé`,
      lever: booked && facts.booking ? undefined
        : booked ? 'le résultat dit RESERVE sans ligne: `markBooked` / `clientCallId` non posés, lire le webhook de fin'
        : placeholderTry ? `nom bidon envoyé (« ${placeholderTry.args.customerName} »): la règle de prompt sur le nom n'a pas tenu, rejouer \`fr-reservation-nom-bidon\``
        : bookAttempts.length ? 'lire la réponse de l\'outil ci-contre: elle dit ce qui manquait (nom, date, jour fermé)'
        : "le modèle a proposé des créneaux sans conclure: relire le transcript, vérifier que le résultat des créneaux dit la suite (nom puis outil)",
    });
  }

  if (booked) {
    const smsOk = !!facts.booking?.smsSent || (facts.booking?.smsLogs ?? []).some(l => l.status === 'sent' || l.status === 'queued' || l.status === 'delivered');
    const lastErr = (facts.booking?.smsLogs ?? []).find(l => l.errorMsg)?.errorMsg ?? null;
    push({
      id: 'sms', area: 'fonctionnement',
      status: smsOk ? 'ok' : facts.expected.smsReady ? 'fail' : 'warn',
      label: 'SMS de confirmation',
      value: smsOk ? 'parti' : lastErr ? `refusé: ${lastErr}` : facts.expected.smsReady ? 'aucune tentative journalisée' : 'SMS non configuré sur ce serveur',
      lever: smsOk ? undefined
        : lastErr ? 'erreur Twilio ci-contre: 21211 = numéro sans « + », 21659 = expéditeur hors compte, 21408 = région non autorisée'
        : facts.expected.smsReady ? "numéro de l'appelant absent de la session ? `callerNumber` sur la ligne d'appel"
        : '`SMS_ENABLED`, identifiants Twilio et une ligne mobile attribuée au client (`smsService.senderFor`)',
    });
  }

  {
    const lead = facts.tools.find(t => t.name === 'captureLead');
    if (lead) {
      const name = typeof lead.args.name === 'string' ? lead.args.name : '';
      const placeholder = name ? isPlaceholderName(name) : false;
      push({
        id: 'lead', area: 'fonctionnement',
        status: placeholder ? 'fail' : facts.ours.found && !facts.ours.isLead ? 'warn' : 'ok',
        label: 'fiche appelant (captureLead)',
        value: `${name || 'sans nom'}${placeholder ? ' (NOM BIDON)' : ''}${facts.ours.found ? facts.ours.isLead ? ' · lead en base' : ' · non marqué lead en base' : ''}`,
        lever: placeholder ? "`captureLead` a reçu un remplissage: `nameProblem()` doit l'écarter, vérifier `isPlaceholderName`"
          : facts.ours.found && !facts.ours.isLead ? "l'outil a tourné mais la ligne d'appel ne porte pas `isLead`: lire `persistLead` dans le webhook de fin" : undefined,
      });
    }
  }

  if (facts.ours.found) {
    const confirmed = facts.ours.nameCollected;
    push({
      id: 'name', area: 'fonctionnement',
      status: confirmed ? 'ok' : facts.ours.callerName ? 'warn' : 'skip',
      label: "nom de l'appelant",
      value: confirmed ? `confirmé: ${confirmed}` : facts.ours.callerName ? `entendu seulement: ${facts.ours.callerName}` : 'aucun',
      lever: !confirmed && facts.ours.callerName ? "le nom n'a été ni épelé ni relu: `needsCallerSpelling` / relecture avant l'agenda (6octotrigesies)" : undefined,
    });
    push({
      id: 'summary', area: 'fonctionnement',
      status: facts.ours.summary ? 'ok' : 'warn',
      label: "résumé d'appel",
      value: facts.ours.summary ? `${facts.ours.summary.slice(0, 100)}${facts.ours.summary.length > 100 ? '…' : ''}` : 'absent',
      lever: facts.ours.summary ? undefined : "l'analyse post-appel n'a pas écrit: journaux Render `[CallIntelligence]`, quota OpenAI",
    });
  }

  if (facts.recordingReadable !== null) {
    push({
      id: 'recording', area: 'fonctionnement',
      status: facts.recordingReadable ? 'ok' : 'warn',
      label: 'enregistrement lisible depuis le portail',
      value: facts.recordingReadable ? 'adresse signée rendue par `/call/:id/mono-recording`' : 'Vapi ne rend pas d\'adresse signée',
      lever: facts.recordingReadable ? undefined : "`recordingEnabled` sur l'assistant distant, ou l'appelant avait coupé l'enregistrement (`recordCalls`)",
    });
  }

  // ── LATENCE ──────────────────────────────────────────────────────────────

  const prep = stage(rt, 'prep');
  const llm = stage(rt, 'llm');
  const ttfa = stage(rt, 'ttfa');
  const total = stage(rt, 'total');

  push({
    id: 'prep', area: 'latence',
    status: prep ? grade(prep.median, TARGETS.prepMs) : 'skip',
    label: 'PREP: notre serveur avant l\'envoi à OpenAI',
    value: prep ? `médiane ${prep.median} ms, p95 ${prep.p95} ms sur ${prep.count} tour(s)` : 'pas de mesure (appel antérieur au partage PREP/LLM)',
    target: `≤ ${TARGETS.prepMs[0]} ms`,
    lever: prep && prep.median > TARGETS.prepMs[0]
      ? "c'est chez nous: profil ou historique relus à chaque tour (cache local ?), blocs de prompt trop lourds; profiler `handle()` avant `proxy()`"
      : undefined,
  });

  push({
    id: 'llm', area: 'latence',
    status: llm ? grade(llm.median, TARGETS.llmMs) : 'skip',
    label: prep ? 'LLM: OpenAI seul, envoi → premier jeton' : 'LLM: serveur + OpenAI (non séparés sur cet appel)',
    value: llm ? `médiane ${llm.median} ms, p95 ${llm.p95} ms sur ${llm.count} tour(s)` : 'pas de mesure',
    target: `≤ ${TARGETS.llmMs[0]} ms`,
    lever: llm && llm.median > TARGETS.llmMs[0]
      ? "d'abord le cache de préfixe (ligne suivante); ensuite la taille du prompt et des outils"
        + (fastTierIdle
          /* Le nommer ici serait envoyer chercher le gain sur un bouton dont
             la ligne « étages de modèle » vient de dire qu'il n'a servi aucun
             tour de CET appel. */
          ? "; pas `VOICE_SMALL_MODEL`, voir « étages de modèle »"
          : "; enfin `VOICE_SMALL_MODEL` pour les tours courts")
      : undefined,
  });

  {
    const tokens = rt?.tokens as { input?: number; cached?: number } | undefined;
    const turns = Object.values((rt?.models ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
    if (tokens && (tokens.input ?? 0) > 0) {
      const hit = Math.round(((tokens.cached ?? 0) / (tokens.input ?? 1)) * 100);
      /* Le premier tour ne peut pas être servi du cache: sur un appel de deux
         tours, 50 % est le maximum. Le seuil ne s'applique qu'avec assez de tours. */
      const status: AuditStatus = turns < 3 ? 'skip' : grade(hit, TARGETS.cacheHitPct, true);
      push({
        id: 'cache', area: 'latence', status,
        label: 'cache de préfixe OpenAI',
        value: `${hit} % des ${tokens.input} jetons d'entrée servis du cache${turns < 3 ? ` (${turns} tour(s), trop peu pour juger)` : ''}`,
        target: `≥ ${TARGETS.cacheHitPct[0]} %`,
        lever: status === 'ok' || status === 'skip' ? undefined
          : hit === 0 ? "la clé n'est jamais posée ou le préfixe change entre les tours: `cacheablePrefixChars` ≥ 4 000 ? un bloc inséré AVANT la conversation ?"
          : 'le préfixe est partiellement stable: un message système de tête qui bouge (date rendue dans le prompt figé ?)',
      });
    }
  }

  push({
    id: 'ttfa', area: 'latence',
    status: ttfa ? grade(ttfa.median, TARGETS.ttfaMs) : 'skip',
    label: 'TTFA: premier jeton → premier son',
    value: ttfa ? `médiane ${ttfa.median} ms, p95 ${ttfa.p95} ms sur ${ttfa.count} tour(s)` : 'pas de mesure',
    target: `≤ ${TARGETS.ttfaMs[0]} ms`,
    lever: ttfa && ttfa.median > TARGETS.ttfaMs[0]
      ? "la synthèse attend trop de texte: `VOICE_TTS_MIN_CHUNK_CHARS` (60) à baisser vers 40, puis `voice:resync --confirm`; vérifier que Cartesia sonic-3.5 est bien la voix distante"
      : undefined,
  });

  {
    const streaming = rt?.latency?.streaming as { streamed?: number; buffered?: number } | undefined;
    const n = (streaming?.streamed ?? 0) + (streaming?.buffered ?? 0);
    /* Le compte ne vaut que sur la chaîne classique: il mesure la découpe de la
       synthèse (`chunkPlan`), qui n'existe pas en parole-à-parole, où l'audio
       EST la réponse. L'afficher à 0/n sur un superagent ferait relire un plan
       qui n'est pas envoyé. */
    if (n > 0 && facts.remote.speechToSpeech !== true) {
      const streamed = streaming!.streamed ?? 0;
      /* LE PLAFOND, et c'est lui qu'on note. Une réplique trop courte n'a
         aucune frontière de découpe avant sa fin: elle ne PEUT pas partir
         avant la fin de son texte, et la compter comme un échec envoie baisser
         le seuil, c'est-à-dire rendre la voix hachée pour gagner cent
         millisecondes sur des réponses déjà rapides. */
      const chunkable = chunkableReplies(facts.assistantTexts, facts.expected.minChunkChars);
      const ceiling = Math.min(chunkable, n);
      if (ceiling === 0) {
        push({
          id: 'streamed', area: 'latence', status: 'ok',
          label: 'son parti avant la fin du texte',
          value: `sans objet: aucune des ${facts.assistantTexts.length} réplique(s) n'atteignait le seuil de découpe `
            + `(${facts.expected.minChunkChars} caractères), elles partent donc en un seul morceau`,
        });
      } else {
        /* SECOND plafond, et il fallait les deux. Une réplique peut être assez
           longue pour être découpée et rester « bufferisée » sans que le plan
           y soit pour rien: `tts` mesure le temps entre le DERNIER jeton et le
           premier son, donc le délai de la SYNTHÈSE seule. Quand ce délai vaut
           la moitié du TTFA ou plus, le modèle a fini d'écrire avant que la
           synthèse ne parle, et découper plus tôt n'avance rien — le son
           attend la voix, pas le texte. Le lever alors, c'est-à-dire baisser
           `VOICE_TTS_MIN_CHUNK_CHARS`, hacherait la voix pour zéro
           milliseconde. Troisième fois que cette ligne envoie au mauvais
           endroit (6novoquadragesies, 6quinquagesies). */
        const tts = stage(rt, 'tts');
        const synthOwnsIt = streamed === 0 && tts !== null && ttfa !== null && tts.median * 2 >= ttfa.median;
        const pct = Math.round((Math.min(streamed, ceiling) / ceiling) * 100);
        const status = synthOwnsIt ? 'ok' : grade(pct, TARGETS.streamedPct, true);
        push({
          id: 'streamed', area: 'latence', status,
          label: 'son parti avant la fin du texte',
          value: synthOwnsIt
            ? `sans objet: le modèle finit son texte avant que la synthèse ne parle `
              + `(synthèse ${tts!.median} ms sur ${ttfa!.median} ms de TTFA), découper plus tôt n'avance rien`
            : `${Math.min(streamed, ceiling)}/${ceiling} réplique(s) découpable(s) (${pct} %)`
              + (chunkable < facts.assistantTexts.length
                ? `, ${facts.assistantTexts.length - chunkable} trop courte(s) pour une découpe`
                : ''),
          target: synthOwnsIt ? undefined : `≥ ${TARGETS.streamedPct[0]} %`,
          lever: status === 'ok' ? undefined : '`chunkPlan` distant à relire: des réponses assez longues pour être découpées ne le sont pas',
        });
      }
    }
  }

  push({
    id: 'total', area: 'latence',
    status: total ? grade(total.median, TARGETS.totalMs) : 'skip',
    label: 'TOTAL: fin de parole → premier son (notre horloge)',
    value: total ? `médiane ${total.median} ms, p95 ${total.p95} ms sur ${total.count} tour(s)` : 'pas de mesure',
    target: `≤ ${TARGETS.totalMs[0]} ms`,
  });

  {
    const gap = median(facts.vapiGapsSeconds);
    push({
      id: 'vapi-gap', area: 'latence',
      status: gap !== null ? grade(gap, TARGETS.vapiGapSeconds) : 'skip',
      label: "délai ressenti: fin de parole → réponse (horloge Vapi)",
      value: gap !== null ? `médiane ${gap.toFixed(1)} s, max ${Math.max(...facts.vapiGapsSeconds).toFixed(1)} s sur ${facts.vapiGapsSeconds.length} tour(s)` : 'pas de mesure',
      target: `≤ ${TARGETS.vapiGapSeconds[0]} s`,
      lever: gap !== null && gap > TARGETS.vapiGapSeconds[0]
        ? total && total.median < gap * 1000 - 600
          ? "l'écart entre TOTAL (nous) et ce délai (Vapi) est la détection de fin de tour: `VOICE_START_WAIT_SECONDS` et `VOICE_ENDPOINTING_PUNCTUATION_SECONDS` à baisser par pas de 0,1, puis `voice:resync --confirm`"
          : 'le temps est dans les étages ci-dessus: les régler dans l\'ordre PREP, LLM, TTFA'
        : undefined,
    });
  }

  {
    const timed = facts.tools.filter(t => t.tookSeconds !== null);
    const slow = timed.filter(t => t.tookSeconds! > TARGETS.toolSeconds[0]);
    if (timed.length) {
      const worst = Math.max(...timed.map(t => t.tookSeconds!));
      push({
        id: 'tools', area: 'latence',
        status: grade(worst, TARGETS.toolSeconds),
        label: 'durée des outils (agenda, fiche)',
        value: timed.map(t => `${t.name} ${t.tookSeconds!.toFixed(1)} s`).join(', '),
        target: `≤ ${TARGETS.toolSeconds[0]} s chacun`,
        lever: slow.length
          ? slow.some(t => t.name === 'checkAvailability')
            ? "l'agenda Google est lu pendant le tour: la spéculation sur la date partielle n'a pas pris (date non détectée dans le transcript partiel ?), ou jeton Google à renouveler"
            : slow.some(t => t.name === 'bookAppointment')
              ? "l'écriture en base est sur le chemin: vérifier que rien d'autre n'est attendu (SMS, agenda sont `void`)"
              : 'lire l\'outil nommé: un appel réseau attendu sur le chemin de la réponse'
          : undefined,
      });
    }
  }

  // ── RÉGLAGES ─────────────────────────────────────────────────────────────

  {
    const got = facts.remote.endpointing;
    const want = facts.expected.endpointing;
    const same = !!got && got.provider === want.provider && got.waitSeconds === want.waitSeconds && got.punctuationSeconds === want.punctuationSeconds;
    push({
      id: 'endpointing', area: 'reglages',
      status: !got ? 'skip' : same ? 'ok' : 'fail',
      label: "détecteur de fin de tour de l'assistant qui décroche",
      value: got ? `${got.provider}, attente ${got.waitSeconds ?? '?'} s, ponctuation ${got.punctuationSeconds ?? '?'} s` : 'assistant distant non lu',
      target: `${want.provider}, attente ${want.waitSeconds} s, ponctuation ${want.punctuationSeconds} s`,
      lever: got && !same ? "l'assistant enregistré est périmé par rapport à l'env: `npm run voice:resync -- --confirm`" : undefined,
    });
  }

  {
    /* Le niveau SERVI se lit sur l'assistant distant, jamais sur le réglage.
       Deux écarts différents, et ils n'ont pas le même levier: un assistant
       périmé se resynchronise, une voix clonée est un choix qui prime et
       n'est pas un défaut. */
    const got = facts.remote.speechToSpeech;
    const want = facts.expected.tierServed === 'superagent';
    const clonePrime = facts.expected.tierRequested === 'superagent' && facts.expected.tierServed === 'base';
    const label = (id: VoiceTierId) => VOICE_TIERS[id].label;
    push({
      id: 'niveau', area: 'reglages',
      status: got === null ? 'skip' : got === want ? 'ok' : 'fail',
      label: 'niveau servi par l\'assistant qui décroche',
      value: got === null
        ? 'assistant distant non lu'
        : `${label(got ? 'superagent' : 'base')}${got ? ' (parole-à-parole)' : ' (transcription, modèle, synthèse)'}`,
      target: clonePrime
        ? `${label('base')}: une voix clonée prime sur le niveau demandé`
        : label(facts.expected.tierServed),
      lever: got !== null && got !== want
        ? "l'assistant enregistré ne porte pas le niveau du client: `npm run voice:tier -- --email=… --tier=… --confirm`"
        : undefined,
    });
  }

  {
    /* Un étage rapide se note sur ce qu'il a SERVI, pas sur le fait d'exister.
       Deux noms différents dans l'environnement disent seulement que le
       réglage est possible; c'est `models` qui dit s'il a atteint un tour.
       Sans ce compte, l'audit recommandait `VOICE_SMALL_MODEL=gpt-4.1-nano`
       à chaque passage, y compris sur un appel où AUCUN tour n'y serait allé:
       le geste ne change alors rien, et il fait chercher le gain là où il
       n'est pas (6novoquadragesies: noter contre ce qui était atteignable). */
    const sameTier = facts.expected.fullModel === facts.expected.miniModel;
    /* Zéro tour rapide N'EST PAS un défaut, et le noter en orange fabriquerait
       le faux positif que cette ligne existe pour retirer. Le modèle complet
       est pris dès qu'un résultat d'outil figure dans l'historique, et Vapi
       renvoie tout l'historique à chaque tour: à partir du premier outil,
       aucun tour ne redescend. C'est voulu — c'est la même condition qui
       empêche un « oui » d'être pris pour un acquiescement et répondu sans
       modèle juste après une proposition de créneau. Sur un appel qui réserve,
       zéro est donc le compte NORMAL. La ligne le DÉCRIT, elle ne le juge
       pas, et c'est le levier de la latence qui cesse alors de nommer ce
       bouton. */
    const shape = `complet ${facts.expected.fullModel}, rapide ${facts.expected.miniModel}`;
    push({
      id: 'tiers', area: 'reglages',
      status: sameTier ? 'warn' : 'ok',
      label: 'étages de modèle',
      value: sameTier
        ? `${shape} (identiques: l'étage rapide n'existe pas)`
        : !tiers.total
        ? `${shape} — aucun tour relevé sur cet appel`
        : `${shape} — ${tiers.mini} tour(s) sur ${tiers.total} servis par le rapide`
          /* La CAUSE ne se dit que si elle a eu lieu. Zéro tour rapide sur un
             appel SANS outil vient d'ailleurs (intention métier, tours de plus
             de cinq mots), et nommer l'outil ici inventerait la raison qu'on
             reproche à l'ancienne ligne. */
          + (fastTierIdle && facts.tools.length
            ? ', normal dès qu\'un outil a tourné: tout l\'appel prend le complet ensuite'
            : ''),
      lever: sameTier
        ? 'poser `VOICE_SMALL_MODEL=gpt-4.1-nano` (tours de moins de six mots sans intention métier) et comparer LLM sur l\'appel suivant'
        : undefined,
    });
  }

  {
    const deflected = typeof rt?.deflectedTurns === 'number' ? rt.deflectedTurns : null;
    const turns = typeof rt?.callerTurns === 'number' ? rt.callerTurns : null;
    if (deflected !== null && turns !== null) {
      push({
        id: 'deflections', area: 'reglages', status: 'ok',
        label: 'tours répondus sans modèle (acquiescements)',
        value: `${deflected} sur ${turns}`,
      });
    }
  }

  push({
    id: 'greeting', area: 'reglages', status: 'ok',
    label: 'accueil pré-enregistré épinglé',
    value: facts.expected.greetingPinned ? 'oui (URL en première phrase)' : 'non: texte synthétisé par Vapi, le chemin prouvé',
  });

  if (rt && typeof rt.disclosureSpoken === 'boolean') {
    push({
      id: 'disclosure', area: 'reglages',
      status: rt.disclosureSpoken ? 'ok' : 'fail',
      label: "annonce IA dite (LEG-1)",
      value: rt.disclosureSpoken ? 'oui' : 'NON',
      lever: rt.disclosureSpoken ? undefined : "la première phrase n'a pas porté l'annonce: `generateFirstMessage` et la première phrase distante (`voice:doctor`)",
    });
  }

  const works = !checks.some(c => c.area === 'fonctionnement' && c.status === 'fail');
  const todo = [...checks.filter(c => c.status === 'fail' && c.lever), ...checks.filter(c => c.status === 'warn' && c.lever)];
  return { callId: facts.callId, checks, works, todo };
}

const ICON: Record<AuditStatus, string> = { ok: '✅', warn: '⚠️ ', fail: '❌', skip: '➖' };
const AREA_TITLE: Record<AuditArea, string> = {
  fonctionnement: 'FONCTIONNEMENT: est-ce que ça a marché',
  latence: 'LATENCE: où part le temps',
  reglages: 'RÉGLAGES: ce qui tourne vraiment',
};

/** Le rapport en lignes, prêt pour la console ou pour être collé. */
export function renderAudit(report: AuditReport, header: string[] = []): string[] {
  const out: string[] = [...header];
  for (const area of ['fonctionnement', 'latence', 'reglages'] as AuditArea[]) {
    const rows = report.checks.filter(c => c.area === area);
    if (!rows.length) continue;
    out.push('', `── ${AREA_TITLE[area]} ──`);
    for (const c of rows) {
      out.push(`${ICON[c.status]} ${c.label}: ${c.value}${c.target && c.status !== 'ok' && c.status !== 'skip' ? `  (cible ${c.target})` : ''}`);
    }
  }
  out.push('', `── VERDICT ──`);
  const fails = report.checks.filter(c => c.status === 'fail').length;
  const warns = report.checks.filter(c => c.status === 'warn').length;
  out.push(report.works ? `L'appel a fait son travail.` : `L'appel N'A PAS fait son travail (${fails} défaut(s)).`);
  const latencyOk = !report.checks.some(c => c.area === 'latence' && (c.status === 'fail' || c.status === 'warn'));
  out.push(latencyOk ? 'Latence dans les cibles.' : `Latence: ${warns + fails} point(s) hors cible.`);
  if (report.todo.length) {
    out.push('', 'À FAIRE, dans l\'ordre:');
    report.todo.forEach((c, i) => out.push(`${i + 1}. [${c.label}] ${c.lever}`));
  } else {
    out.push('Rien à régler sur cet appel.');
  }
  return out;
}
