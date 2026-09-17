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
  /** Secondes depuis le début de l'appel, à l'horloge de Vapi. */
  atSeconds: number | null;
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
  /** Voir `readVapiMessages`: deux réponses pour un seul tour d'appelant. */
  doubledReplies?: number;
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
    /**
     * Un transcripteur est-il posé sur l'assistant DISTANT ? `null` = non lu.
     *
     * Lu pour une raison précise (17/09/2026): il permet de distinguer « le
     * niveau n'a pas été écrit » de « le niveau a été écrit et un RESTE l'a
     * annulé ». La mise à jour d'un assistant est un PATCH, donc les clés que
     * le chemin parole-à-parole se contentait de taire — transcripteur et plan
     * d'attente — SURVIVAIENT chez Vapi sur tout client qui basculait. Les deux
     * écarts se réparent différemment, et confondre les deux fait relancer
     * `voice:tier` en boucle sur un réglage déjà correct.
     */
    transcriber?: boolean | null;
    /**
     * Le délai de RACCROCHÉ que l'assistant distant porte. `null` = non lu.
     *
     * Il ne figurait sur aucun écran, et c'est lui qui a tué six appels de test
     * d'affilée le 17/09/2026: posé à 10 s en production, il raccrochait pendant
     * la phrase d'accueil. Les deux diagnostics faits pour répondre à « pourquoi
     * cet appel n'a rien donné » ne le montraient ni l'un ni l'autre.
     */
    silenceTimeoutSeconds?: number | null;
    /**
     * Le plan d'INTERRUPTION que l'assistant distant porte. `null` = non lu.
     *
     * « Quand je le coupe, il ne s'arrête pas » est un retour qui revient
     * depuis trois appels réels, et AUCUN écran ne montrait le réglage mis en
     * cause. `numWords: 0` trie sur la seule énergie: écrit pour un chemin
     * sans transcripteur, il ne coupe pas l'agent quand l'appelant parle.
     * Avec un transcripteur, le plan classique compte les mots.
     */
    stopSpeaking?: { numWords: number | null; voiceSeconds: number | null } | null;
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
    /**
     * Le transcripteur est-il VOULU en parole-à-parole ?
     *
     * Sans ça, un assistant temps réel correctement configuré est lu comme
     * hybride dès que Vapi a besoin d'un transcripteur pour entendre l'appelant
     * (vérifié sur un appel réel le 17/09/2026). La même ligne qui nomme un
     * reste doit savoir quand ce n'en est pas un.
     */
    realtimeTranscriber?: boolean;
    /** Secondes de silence avant « Vous m'entendez ? ». */
    idleNudgeSeconds?: number;
    /** Combien de relances avant de laisser le raccroché faire son office. */
    idleNudgeCount?: number;
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
  /* Ce qu'on peut viser SANS couper la parole: le détecteur intelligent tranche
     en quelques dizaines de millisecondes quand la phrase est clairement
     finie, et le reste est le plancher qu'on pose nous-mêmes. */
  turnDetectMs: [700, 1100],
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
  /**
   * Combien de répliques suivent une AUTRE réplique de l'assistant sans que
   * l'appelant ni un outil se soient glissés entre les deux.
   *
   * La mesure INDÉPENDANTE du plan d'attente (17/09/2026). Deux réponses pour
   * un seul tour, c'est la signature exacte de « il coupe trop »: l'agent
   * répond à un blanc au milieu de la phrase, puis répond une seconde fois
   * quand l'appelant a vraiment fini. Un appel de 108 s en portait quatre.
   *
   * Elle se lit sur le TRANSCRIPT, donc sur la conversation réelle, et pas sur
   * le réglage: c'est elle qui dira si le plan d'attente a servi à quelque
   * chose, sans avoir à croire la ligne de réglage sur parole. Les quatre
   * plafonds de cet audit ont appris la même chose (6terquinquagesies): un
   * chiffre qui ne peut pas être contredit par une autre source ne prouve
   * rien.
   *
   * Un OUTIL entre deux répliques ne compte pas: annoncer puis dire le
   * résultat est le déroulé normal, et c'est aussi là que la phrase d'attente
   * se glisse, qui est un autre défaut et se lit ailleurs.
   */
  doubledReplies: number;
  /** Ce que l'assistant a DIT, pour juger la découpe de la synthèse. */
  assistantTexts: string[];
  callerLines: number;
  vapiGapsSeconds: number[];
  tools: ToolEvent[];
} {
  let assistantLines = 0;
  const assistantTexts: string[] = [];
  let callerLines = 0;
  let doubledReplies = 0;
  let lastWasAssistant = false;
  const gaps: number[] = [];
  const tools: ToolEvent[] = [];
  const pending = new Map<string, { at: number | null; args: Record<string, unknown> }>();
  let lastUserEnd: number | null = null;
  for (const m of messages) {
    const at = typeof m.secondsFromStart === 'number' ? m.secondsFromStart : null;
    if (m.role === 'user') {
      callerLines++;
      lastWasAssistant = false;
      lastUserEnd = typeof m.endTime === 'number' && typeof m.time === 'number' && at !== null
        ? at + (m.endTime - m.time) / 1000
        : at;
    } else if (m.role === 'bot' || m.role === 'assistant') {
      assistantLines++;
      if (lastWasAssistant) doubledReplies++;
      lastWasAssistant = true;
      if (typeof m.message === 'string' && m.message.trim()) assistantTexts.push(m.message);
      else if (typeof m.content === 'string' && m.content.trim()) assistantTexts.push(m.content);
      if (at !== null && lastUserEnd !== null) {
        gaps.push(Math.max(0, at - lastUserEnd));
        lastUserEnd = null;
      }
    }
    if (m.role === 'tool_calls' || m.role === 'tool_call_result') lastWasAssistant = false;
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
        atSeconds: open?.at ?? null,
      });
    }
  }
  /* Un outil appelé sans réponse vue (appel coupé pendant l'agenda) compte. */
  for (const [name, open] of pending) tools.push({ name, args: open.args, result: null, tookSeconds: null, atSeconds: open.at });
  return { assistantLines, assistantTexts, callerLines, doubledReplies, vapiGapsSeconds: gaps, tools };
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

  {
    const doubled = facts.doubledReplies ?? 0;
    push({
      id: 'doubled', area: 'fonctionnement',
      status: facts.doubledReplies == null ? 'skip' : doubled === 0 ? 'ok' : 'fail',
      label: 'répliques doublées: deux réponses pour un seul tour',
      value: facts.doubledReplies == null
        ? 'non lu'
        : doubled === 0
          ? `aucune sur ${facts.assistantLines} réplique(s)`
          : `${doubled} sur ${facts.assistantLines} réplique(s) — il répond à un blanc, puis une seconde fois quand l'appelant a fini`,
      target: 'aucune',
      lever: doubled > 0
        ? "c'est le détecteur de fin de tour, pas le modèle: lire la ligne « détecteur de fin de tour » plus bas. Un plan absent rend la main au défaut de Vapi (0,4 s), qui coupe quelqu'un qui réfléchit"
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

  /* INVARIANT, et il fallait le poser parce qu'il a été violé.
   *
   * Le TTFA (premier jeton → premier son) est un MORCEAU du délai ressenti
   * (fin de parole de l'appelant → réponse), que l'horloge de VAPI mesure
   * indépendamment de nos bornes. Un TTFA plus grand que le pire délai de
   * Vapi est donc arithmétiquement impossible: ce n'est pas une latence, ce
   * sont nos marques qui ont dérivé.
   *
   * Appel réel du 16/09/2026 à 23:12: TTFA médiane 20 175 ms, p95 59 419 ms,
   * quand Vapi disait 2,9 s de médiane et 3,8 s au pire. L'audit a classé ça
   * PREMIER, avec « baisser `VOICE_TTS_MIN_CHUNK_CHARS` vers 40 »: hacher la
   * voix pour un chiffre qui ne pouvait pas exister. Quatrième fois qu'une
   * ligne de cet audit envoie au mauvais endroit; celle-ci se vérifie contre
   * une horloge qui n'est pas la nôtre, ce qu'aucune des trois précédentes ne
   * pouvait faire. */
  const felt = facts.vapiGapsSeconds.length ? Math.max(...facts.vapiGapsSeconds) * 1000 : null;
  const ttfaImpossible = ttfa !== null && felt !== null && ttfa.median > felt;

  push({
    id: 'ttfa', area: 'latence',
    status: !ttfa ? 'skip' : ttfaImpossible ? 'warn' : grade(ttfa.median, TARGETS.ttfaMs),
    label: 'TTFA: premier jeton → premier son',
    value: !ttfa
      ? 'pas de mesure'
      : ttfaImpossible
      ? `MESURE INUTILISABLE: médiane ${ttfa.median} ms alors que l'horloge de Vapi plafonne le délai ressenti à `
        + `${Math.round(felt!)} ms. Le TTFA est un morceau de ce délai, il ne peut pas le dépasser.`
      : `médiane ${ttfa.median} ms, p95 ${ttfa.p95} ms sur ${ttfa.count} tour(s)`,
    target: ttfaImpossible ? undefined : `≤ ${TARGETS.ttfaMs[0]} ms`,
    lever: ttfaImpossible
      ? 'nos bornes ont dérivé, pas la synthèse: un tour non fermé (`markAssistantSpeechStart`) ou des événements Vapi manquants. Ne toucher à AUCUN réglage de voix sur ce relevé'
      : ttfa && ttfa.median > TARGETS.ttfaMs[0]
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
        /* TROISIÈME plafond, et celui-ci retire la ligne du classement dans
           presque tous les cas réels. Ce qu'on compare ici, c'est notre
           horloge LOCALE (le dernier jeton, connu à la milliseconde) et
           l'ARRIVÉE D'UN WEBHOOK de Vapi (« l'assistant parle »), qui traverse
           le réseau et sa file. Pour une réplique écrite en deux ou trois
           cents millisecondes, ce trajet suffit à lui seul à faire conclure
           « bufferisé », quoi que fasse le `chunkPlan`. Le verdict n'est donc
           pas faux, il est INDÉCIDABLE: aucune source ne dit quand la voix a
           réellement commencé par rapport à nos jetons.
           La ligne ne se note que sur des complétions assez longues pour que
           le trajet du webhook ne puisse plus expliquer le résultat, et
           `ttfa - tts` est cette durée d'écriture. Cinquième passage de la
           même leçon (6novoquadragesies, 6duoquinquagesies, 6terquinquagesies)
           et le premier qui conclut que la question ne se pose pas ainsi. */
        const writeMs = tts !== null && ttfa !== null ? ttfa.median - tts.median : null;
        const tooShortToJudge = writeMs !== null && writeMs < 1500;
        const synthOwnsIt = ttfaImpossible
          || tooShortToJudge
          || (streamed === 0 && tts !== null && ttfa !== null && tts.median * 2 >= ttfa.median);
        const pct = Math.round((Math.min(streamed, ceiling) / ceiling) * 100);
        const status = synthOwnsIt ? 'ok' : grade(pct, TARGETS.streamedPct, true);
        push({
          id: 'streamed', area: 'latence', status,
          label: 'son parti avant la fin du texte',
          value: ttfaImpossible
            ? 'sans objet: le TTFA de ce relevé est inutilisable (voir la ligne au-dessus), donc rien ne peut être noté contre lui'
            : tooShortToJudge
            ? `sans objet: les répliques sont écrites en ${writeMs} ms, et ce verdict se joue sur l'arrivée d'un WEBHOOK `
              + `dont le trajet dure du même ordre. En dessous de 1,5 s d'écriture, il ne mesure pas la découpe, il mesure le réseau `
              + `(${streamed}/${ceiling} découpable(s) tout de même, pour information)`
            : synthOwnsIt
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

  /* TOTAL et « délai ressenti » mesurent le MÊME intervalle: la fin de parole
     de l'appelant jusqu'à la réponse. La différence est l'horloge. La nôtre
     borne deux ARRIVÉES DE WEBHOOK, celle de Vapi lit son propre pipeline
     audio. Relevé du 16/09 à 23:28: 3 867 ms chez nous, 2 500 ms chez Vapi,
     pour le même appel. Les noter tous les deux en rouge, c'est compter deux
     fois un seul fait et donner à la mesure la plus indirecte le même poids
     qu'à celle qui touche le phénomène. Quand la ligne de Vapi existe, la
     nôtre l'accompagne sans la juger. */
  const hasVapiClock = facts.vapiGapsSeconds.length > 0;
  push({
    id: 'total', area: 'latence',
    status: !total ? 'skip' : hasVapiClock ? 'ok' : grade(total.median, TARGETS.totalMs),
    label: 'TOTAL: fin de parole → premier son (notre horloge)',
    value: !total
      ? 'pas de mesure'
      : `médiane ${total.median} ms, p95 ${total.p95} ms sur ${total.count} tour(s)`
        + (hasVapiClock ? " — pour information: c'est l'horloge de Vapi, ligne suivante, qui fait foi sur ce délai" : ''),
    target: hasVapiClock ? undefined : `≤ ${TARGETS.totalMs[0]} ms`,
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
        ? 'la ligne suivante dit quelle PART est à nous et laquelle est la détection de fin de tour'
        : undefined,
    });

    /* CE QUE L'APPELANT ATTEND, DÉCOUPÉ EN DEUX.
     *
     * Retour du 17/09/2026: « les outils longs ne me dérangent pas, ça fait
     * réaliste. Ce qui me dérange, c'est qu'après ma phrase il attend une ou
     * deux secondes avant de parler. » Ce délai-là n'est ni celui des outils
     * ni celui du modèle: l'horloge de Vapi mesure l'intervalle ENTIER, nos
     * étages n'en couvrent qu'une partie, et la DIFFÉRENCE est le temps passé
     * à décider que l'appelant a fini de parler, avant même que la requête
     * n'arrive chez nous.
     *
     * Elle n'était nulle part, et c'est pourtant le plus gros poste: 2,5 s de
     * délai ressenti pour 1,28 s chez nous (941 ms d'OpenAI + 342 ms de
     * synthèse) laisse ~1,2 s en amont. Sans cette ligne, on cherche les
     * millisecondes dans les étages qu'on VOIT, c'est-à-dire là où elles ne
     * sont pas.
     *
     * Le réglage attendu est la SOMME des seuils, et la comparer à la mesure
     * dit si les seuils expliquent le délai ou si autre chose le porte
     * (transcription, routage). Sans cette comparaison, on baisserait des
     * seuils qui ne sont pas la cause. */
    const ep = facts.remote.endpointing;
    const stagesMs = (prep?.median ?? 0) + (llm?.median ?? 0) + (ttfa?.median ?? 0);
    const beforeUs = gap !== null && stagesMs > 0 ? Math.round(gap * 1000 - stagesMs) : null;
    if (beforeUs !== null && beforeUs > 0) {
      const configuredMs = Math.round(((ep?.waitSeconds ?? 0) + (ep?.punctuationSeconds ?? 0)) * 1000);
      /* La marge couvre ce que la somme des seuils ne dit pas: le
         transcripteur (`VOICE_ENDPOINTING_MS`, 150 ms), le trajet jusqu'à
         l'Oregon et le routage de Vapi. 600 ms plutôt que 400, et le choix est
         ASYMÉTRIQUE à dessein: se tromper en disant « expliqué » fait baisser
         un plancher et gagner moins que prévu, ce qui se voit au relevé
         suivant et se défait par une variable; se tromper dans l'autre sens
         envoie chercher la cause dans un seuil qui n'y est pour rien. Le
         relevé réel du 17/09 donnait 1 216 ms pour 800 ms de seuils, à 16 ms
         d'une marge de 400. */
      const explained = configuredMs > 0 && beforeUs <= configuredMs + 600;
      push({
        id: 'turn-detect', area: 'latence',
        status: beforeUs <= TARGETS.turnDetectMs[0] ? 'ok' : beforeUs <= TARGETS.turnDetectMs[1] ? 'warn' : 'fail',
        label: "détection de fin de tour: avant que la requête n'arrive chez nous",
        value: `${beforeUs} ms des ${Math.round(gap! * 1000)} ms de délai ressenti (nos étages: ${Math.round(stagesMs)} ms)`
          + (configuredMs > 0
            ? explained
              ? `, cohérent avec les seuils posés (${configuredMs} ms + transcripteur)`
              : `, soit ${beforeUs - configuredMs} ms de PLUS que les seuils posés (${configuredMs} ms): les baisser ne rendra pas tout ça`
            : ''),
        target: `≤ ${TARGETS.turnDetectMs[0]} ms`,
        lever: beforeUs > TARGETS.turnDetectMs[0]
          ? explained
            ? "`VOICE_START_WAIT_SECONDS` (0,4) est un PLANCHER posé au-dessus du détecteur intelligent: c'est le premier à baisser. GARDER `VOICE_ENDPOINTING_PUNCTUATION_SECONDS` à 0,4, c'est lui qui empêche de couper sur une respiration. Variables d'environnement, puis `voice:resync --confirm`"
            : "les seuils ne suffisent pas à l'expliquer: regarder `VOICE_ENDPOINTING_NO_PUNCTUATION_SECONDS` (1,2 s quand le transcripteur ne met pas de point) et `VOICE_ENDPOINTING_MS`, avant de toucher au reste"
          : undefined,
      });
    }
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
        /* QUAND chaque outil a tourné, pas seulement combien de temps. Sur
           trois appels d'affilée, le PREMIER outil a coûté 2,5 s et les
           suivants moins: une moyenne par nom d'outil ne peut pas montrer ça,
           et c'est pourtant la différence entre « cette requête est lente » et
           « le premier accès du processus paie un réveil ». */
        value: timed.map(t => `${t.name} ${t.tookSeconds!.toFixed(1)} s${t.atSeconds != null ? ` (à ${t.atSeconds.toFixed(0)} s)` : ''}`).join(', '),
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
    /* EN PAROLE-À-PAROLE, LE PLAN ATTENDU EST L'ABSENCE DE PLAN (17/09/2026).
       Cette ligne comparait sans condition au plan classique, donc sur un
       client Superagent correctement configuré elle notait « aucun » en ROUGE
       contre « livekit, attente 0.15 s » et conseillait un resync qui ne change
       rien. C'est le faux positif que le docteur venait de fermer, réouvert ici:
       quand une leçon déplace un champ, le code qui le LIT compte autant que
       celui qui l'écrit, et il y en avait DEUX à corriger (6sexvicies).
       Un plan distant sur un assistant temps réel n'est pas jugé ici non plus:
       la ligne « niveau » le nomme déjà HYBRIDE, et compter deux fois un seul
       fait donne à la mesure la plus indirecte le poids de celle qui touche le
       phénomène (6quaterquinquagesies). */
    const s2sWanted = facts.expected.tierServed === 'superagent';
    /* Un plan « vide » n'est pas un plan. Le collecteur rendait un objet
       `{provider: 'aucun', waitSeconds: null, punctuationSeconds: null}` quand
       l'assistant distant n'en portait AUCUN, et la ligne annonçait alors
       « reste d'une synchronisation classique » sur exactement l'état qu'on
       veut. Corrigé à la source, et ici aussi: ce module est pur et testé, son
       verdict ne doit pas dépendre du soin de son appelant. */
    const hasPlan = !!got && (got.provider !== 'aucun' || got.waitSeconds !== null || got.punctuationSeconds !== null);
    if (s2sWanted) {
      /* CETTE LIGNE A DIT L'INVERSE DE LA VÉRITÉ, EN VERT (17/09/2026).
       *
       * Elle affichait « aucun plan: en parole-à-parole, le moment de répondre
       * appartient au modèle » et comptait ça pour un succès. C'est faux, et
       * Vapi le dit lui-même: « Endpointing and interruption management are
       * handled by Vapi's orchestration layer » (page OpenAI Realtime). Un
       * plan absent ne DÉSACTIVE rien, il rend la main au défaut de Vapi,
       * 0,4 s de silence — de quoi couper quelqu'un qui réfléchit au milieu de
       * sa phrase, puis lui répondre une seconde fois quand il a vraiment
       * fini. C'est exactement ce qu'un appel de 108 s a produit: 13 répliques
       * d'assistant pour 10 tours d'appelant, et « il coupe trop ».
       *
       * Ce diagnostic-là a coûté une heure de recherche dans la mauvaise
       * direction pendant que l'écran affirmait que tout allait bien. Un audit
       * qui note un réglage doit noter contre ce que le fournisseur FAIT, pas
       * contre ce qu'on croit qu'il fait (6sexvicies).
       *
       * Avec un transcripteur — et Vapi en exige un ici pour entendre
       * l'appelant — le plan CLASSIQUE est le bon, et son absence est le
       * défaut. Sans transcripteur, il n'y a aucun mot à compter et l'absence
       * redevient correcte. */
      const wantPlan = facts.expected.realtimeTranscriber === true;
      const same = hasPlan && got!.provider === want.provider && got!.waitSeconds === want.waitSeconds && got!.punctuationSeconds === want.punctuationSeconds;
      push({
        id: 'endpointing', area: 'reglages',
        status: !wantPlan ? (hasPlan ? 'skip' : 'ok') : !hasPlan ? 'fail' : same ? 'ok' : 'fail',
        label: "détecteur de fin de tour de l'assistant qui décroche",
        value: hasPlan
          ? `${got!.provider}, attente ${got!.waitSeconds ?? '?'} s, ponctuation ${got!.punctuationSeconds ?? '?'} s`
            + (wantPlan ? '' : ': reste d\'une synchronisation classique, voir la ligne « niveau »')
          : wantPlan
            ? 'AUCUN PLAN, donc le défaut de Vapi (0,4 s de silence): il coupe l\'appelant qui réfléchit, puis lui répond une seconde fois quand il a fini'
            : 'aucun plan, et c\'est correct sans transcripteur: il n\'y a aucun mot à compter',
        target: wantPlan ? `${want.provider}, attente ${want.waitSeconds} s, ponctuation ${want.punctuationSeconds} s` : undefined,
        lever: wantPlan && !same
          ? "l'assistant distant n'a pas le plan d'attente que le transcripteur permet: `npm run voice:resync -- --confirm`"
          : undefined,
      });
    } else {
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
  }

  {
    /* LE PLAN D'INTERRUPTION, LU SUR L'ASSISTANT DISTANT (17/09/2026).
     *
     * « Quand je le coupe, il ne s'arrête pas », trois appels de suite, et
     * aucun des deux diagnostics ne montrait ce réglage: on ne pouvait donc
     * pas distinguer « le correctif n'est pas déployé » de « le correctif ne
     * marche pas ». C'est exactement ce que cet audit existe pour trancher.
     *
     * `numWords: 0` trie sur la seule ÉNERGIE. C'était le bon plan tant que le
     * parole-à-parole n'avait pas de transcripteur — il n'y avait aucun mot à
     * compter — et il est devenu le mauvais le jour où Vapi en a exigé un. */
    const got = facts.remote.stopSpeaking ?? null;
    const wantWords = facts.expected.realtimeTranscriber !== false;
    const energyOnly = got !== null && got.numWords === 0;
    push({
      id: 'barge-in', area: 'reglages',
      status: got === null ? 'skip' : energyOnly && wantWords ? 'fail' : 'ok',
      label: "interruption: l'agent se tait quand l'appelant parle",
      value: got === null
        ? 'assistant distant non lu'
        : energyOnly
          ? `énergie seule (numWords 0, voix ${got.voiceSeconds ?? '?'} s)`
            + (wantWords ? " — il ne coupe pas l'agent quand l'appelant parle" : ", correct sans transcripteur")
          : `${got.numWords} mot(s) transcrit(s), voix ${got.voiceSeconds ?? '?'} s`,
      target: wantWords ? 'au moins un mot transcrit' : undefined,
      lever: energyOnly && wantWords
        ? "l'assistant distant porte encore le plan « énergie seule »: `npm run voice:resync -- --confirm`"
        : undefined,
    });
  }

  {
    /* LE DÉLAI DE RACCROCHÉ, ET LES RELANCES QU'IL DOIT LAISSER PASSER.
     *
     * Ajouté le 17/09/2026 après six appels de test morts d'affilée. Le compte
     * était posé à 10 s en production: l'appel raccrochait PENDANT la phrase
     * d'accueil, en parole-à-parole comme en classique. Ça se lisait comme une
     * panne du moteur vocal, et deux écrans entiers faits pour répondre à
     * « pourquoi cet appel n'a rien donné » ne montraient NI ce chiffre ni le
     * calendrier des relances qu'il annule.
     *
     * Le verdict compare les deux, parce que séparés ils ne disent rien: 10 s
     * est un réglage raisonnable en soi, il ne devient faux qu'en face de
     * relances posées à 10 s et 20 s. C'est la leçon des quatre plafonds de cet
     * audit, appliquée à un réglage au lieu d'un ratio: un nombre se note
     * contre ce à quoi il est censé laisser la place. */
    const got = facts.remote.silenceTimeoutSeconds ?? null;
    const nudge = facts.expected.idleNudgeSeconds ?? null;
    const count = facts.expected.idleNudgeCount ?? null;
    /* La dernière relance parle à `nudge * count`; il faut au moins une fenêtre
       de plus avant de raccrocher, sinon elle n'a pas le temps d'exister. */
    const floor = nudge !== null && count !== null ? nudge * (count + 1) : null;
    const tooShort = got !== null && floor !== null && got < floor;
    /* Un raccroché qui tombe avant la PREMIÈRE relance coupe l'appelant au lieu
       de le relancer: c'est le cas vécu, et il se dit plus fort. */
    const cutsGreeting = got !== null && nudge !== null && got <= nudge;
    push({
      id: 'silence', area: 'reglages',
      status: got === null ? 'skip' : tooShort ? 'fail' : 'ok',
      label: 'délai avant raccroché, contre les relances',
      value: got === null
        ? 'assistant distant non lu'
        : `raccroché à ${got} s`
          + (nudge !== null && count !== null ? `, relances à ${Array.from({ length: count }, (_, i) => (i + 1) * nudge).join(' s et ')} s` : '')
          + (cutsGreeting ? ' — il raccroche PENDANT la phrase d\'accueil, avant la moindre relance' : tooShort ? " — la dernière relance n'a pas le temps d'exister" : ''),
      target: floor !== null ? `au moins ${floor} s` : undefined,
      lever: tooShort
        ? `\`VAPI_SILENCE_TIMEOUT\` à ${floor} s au moins, puis \`npm run voice:resync -- --confirm\`. Un raccroché posé sous le calendrier des relances les supprime en silence, et sous la durée de l'accueil il coupe l'appelant avant qu'il ait parlé`
        : undefined,
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
    /* L'ASSISTANT HYBRIDE, et il faut le nommer pour ne pas envoyer au mauvais
       geste (17/09/2026). Vapi tient le modèle temps réel (`customLlm` faux)
       ET un transcripteur: ce n'est ni du classique ni du parole-à-parole,
       c'est un assistant basculé dont le PATCH a conservé les clés que le
       chemin temps réel se contentait de taire. Deux preneurs de tour de parole
       cohabitent alors, le modèle qui entend l'audio et le plan d'attente qui
       compte des mots; relevé sur le premier appel réel en Superagent:
       répliques qui se chevauchent, l'agent qui répond à sa propre question,
       et `silence-timed-out` au bout de 137 s.
       Relancer `voice:tier` ne répare RIEN ici: le réglage est déjà bon, c'est
       l'assistant distant qui porte un reste. */
    /* Un transcripteur VOULU n'est pas un reste: quand l'interrupteur est
       allumé, un assistant temps réel en porte un par construction. */
    const hybride = got === false && want && facts.remote.customLlm === false
      && facts.remote.transcriber === true && !facts.expected.realtimeTranscriber;
    push({
      id: 'niveau', area: 'reglages',
      status: got === null ? 'skip' : got === want ? 'ok' : 'fail',
      label: 'niveau servi par l\'assistant qui décroche',
      value: got === null
        ? 'assistant distant non lu'
        : hybride
        ? 'HYBRIDE: modèle temps réel ET transcripteur classique sur le même assistant'
        : `${label(got ? 'superagent' : 'base')}${got ? ' (parole-à-parole)' : ' (transcription, modèle, synthèse)'}`,
      target: clonePrime
        ? `${label('base')}: une voix clonée prime sur le niveau demandé`
        : label(facts.expected.tierServed),
      lever: hybride
        ? 'RESTE d\'une synchronisation classique, conservé par le PATCH de Vapi. Le réglage est bon, ne pas relancer `voice:tier`: déployer le correctif qui envoie `transcriber` et `startSpeakingPlan` à `null`, puis `npm run voice:resync -- --confirm`. En attendant, `--tier=base --confirm` rend une ligne qui marche'
        : got !== null && got !== want
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
