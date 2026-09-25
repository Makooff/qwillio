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
import { PLANS, type PlanId } from '../../config/plans';
import { superagentCost, inclusionCostEur, eur, revenuePerIncludedMinuteEur } from '../../config/voice-economics';
import { PRICED_FOR_MODEL } from '../../config/superagent-option';
import { isPlaceholderName } from '../../utils/spelled-name';
import { VOICE_TIERS, type VoiceTierId } from './voice-tiers';
import { llmStreamRuns } from './profile-voice';
import { isKnownTool } from './voice-tools';

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
  /**
   * CE QUE CET APPEL A COÛTÉ, d'après VAPI (`metadata.billing`).
   *
   * C'est le seul chiffre de coût qui ne vienne pas de nous. `REALTIME_RATES`
   * est une table relevée à la main sur un tableau de bord, donc elle vieillit
   * et elle suppose un modèle; celui-ci est facturé. Quand les deux divergent,
   * c'est Vapi qui a raison, et c'est tout l'intérêt d'une source indépendante
   * (6terquinquagesies: un audit doit pouvoir CONTREDIRE son propre chiffre).
   *
   * Il était déjà en base et personne ne le lisait: `finalizeCall` assemble
   * `costBreakdown` depuis le rapport de fin d'appel, `persistMetrics` l'écrit
   * dans `metadata.billing`, et TOUS ses lecteurs ne prenaient que `costUsd`.
   * Cinquième fois de la journée que le fait est dans les données et que
   * personne ne l'ouvre, et la première où ça coûte de l'argent plutôt que du
   * temps.
   */
  cost: {
    /** Le total de l'appel en dollars, tel que Vapi le facture. */
    usd: number | null;
    /**
     * Le détail par poste, TEL QUE VAPI L'ENVOIE. Forme non figée ici à
     * dessein: elle n'a pas été lue sur la documentation vivante, donc
     * l'écrire en dur serait une déduction qui a l'air d'une lecture
     * (6quinvicies). Le VERDICT ne s'appuie que sur `usd`, qui est sans
     * ambiguïté; le détail est affiché pour information.
     */
    breakdown: Record<string, unknown> | null;
    durationSeconds: number | null;
  } | null;
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
     * Le nom du modele porte par l'assistant DISTANT. `null` = non lu.
     *
     * Deja lu par `audit-call.ts` pour en tirer `speechToSpeech`, puis jete:
     * l'audit affichait donc `VAPI_MODEL` et `VOICE_SMALL_MODEL` sur un appel
     * en parole-a-parole, ou ni l'un ni l'autre ne tourne, et ne nommait
     * NULLE PART celui qui sert. « Le real-time est con » n'etait pas
     * verifiable: on ne savait pas lequel des six c'etait (19/09/2026).
     */
    modelName: string | null;
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
     * Le FOURNISSEUR du transcripteur distant. `null` = aucun transcripteur,
     * absent = pas lu.
     *
     * Le booléen au-dessus répond à « y en a-t-il un », pas à « lequel », et
     * c'est la seconde question qui débusque une configuration qui ne vient
     * pas du dépôt: `buildTranscriber` écrit `provider: 'deepgram'` SANS
     * CONDITION, et c'est le seul constructeur de transcripteur du code. Un
     * assistant distant qui en porte un autre a donc été écrit ailleurs.
     */
    transcriberProvider?: string | null;
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
    /** `VOICE_REALTIME_MODEL`: celui qui sert en parole-a-parole, et lui seul. */
    realtimeModel: string;
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
    /** Le forfait du client, pour juger le coût de la minute. `null` = inconnu. */
    planId?: PlanId | null;
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
  /* Une base dans la même région répond en quelques millisecondes; une côte à
     l'autre des États-Unis coûte 60 à 80 ms, un océan davantage. Le seuil
     orange est donc posé là où « ailleurs » devient la seule explication. */
  dbRoundTripMs: [15, 60],
  /* GÉNÉREUX À DESSEIN: cet écart ne contient pas que du réseau (voir
     `vapiHopMs`), et une ligne qui crie au loup sur un chiffre composite est
     exactement ce que cet audit a déjà fait neuf fois. */
  vapiHopMs: [120, 250],
} as const;

/**
 * L'ALLER-RETOUR ENTRE VAPI ET NOTRE BACKEND, lu sur DEUX horloges.
 *
 * Vapi chronomètre chaque outil depuis son propre pipeline (`secondsFromStart`
 * du transcript); nous chronométrons la MÊME exécution depuis `recordToolCall`.
 * La différence est tout ce qui se passe entre les deux: le trajet réseau
 * aller, notre file HTTP, le trajet retour, et la reprise en main de Vapi.
 *
 * C'est donc un PLAFOND du trajet réseau, jamais le trajet lui-même, et la
 * ligne le dit: annoncer « 90 ms de réseau » sur un chiffre qui contient aussi
 * notre file serait une déduction qui a l'air d'une lecture (6quinvicies).
 *
 * Ce qu'il tranche, et c'est la seule question qui engage une facture
 * d'infrastructure: si cet écart est petit, l'orchestration de Vapi est proche
 * de l'Oregon, et déplacer le backend en Europe AJOUTERAIT cette distance à
 * chaque outil et à chaque tour de modèle custom-LLM. S'il est grand, la
 * question de la région est ouverte. Aucun raisonnement ne remplace ce relevé:
 * l'API de Vapi répond derrière Cloudflare, donc son nom de domaine ne dit rien
 * de l'endroit où tourne son orchestration.
 *
 * L'appariement se fait par NOM et dans l'ORDRE: un même outil peut être appelé
 * plusieurs fois dans un appel, et les deux listes les voient dans le même
 * ordre. Nos noms d'échec portent un suffixe `:error`, retiré ici — sinon un
 * appel où un outil a levé n'apparierait rien et la ligne se tairait
 * précisément sur l'appel qui a mal tourné.
 */
export function vapiHopMs(
  vapiTools: Array<{ name: string; tookSeconds: number | null }>,
  ours: Array<{ name: string; ms: number }> | undefined,
): { medianMs: number; pairs: number } | null {
  if (!ours?.length) return null;
  const queues = new Map<string, number[]>();
  for (const c of ours) {
    const name = c.name.replace(/:error$/, '');
    const q = queues.get(name) ?? [];
    q.push(c.ms);
    queues.set(name, q);
  }
  const gaps: number[] = [];
  for (const t of vapiTools) {
    if (t.tookSeconds === null) continue;
    const q = queues.get(t.name);
    if (!q?.length) continue;
    gaps.push(t.tookSeconds * 1000 - q.shift()!);
  }
  const m = median(gaps);
  return m === null ? null : { medianMs: Math.round(m), pairs: gaps.length };
}

/**
 * L'ALLER-RETOUR D'OUTIL, DÉCOMPOSÉ (22/09/2026).
 *
 * `vapiHopMs` ci-dessus compare DEUX horloges et rend un PLAFOND: tout ce que
 * Vapi compte en plus de notre exécution, sans dire quoi. Il valait ~2 s sur
 * deux appels indépendants, et le levier qui en sortait était de déménager la
 * région. Or ce plafond contient au moins trois choses, et elles ne se
 * réparent pas au même endroit:
 *
 *  - `dispatch`: de notre émission de l'appel d'outil à l'arrivée de la
 *    requête chez nous. Mesuré sur UNE horloge, la nôtre, des deux côtés — la
 *    réaction de Vapi plus les deux trajets réseau. C'est le seul des trois
 *    qui parle vraiment de distance.
 *  - `overhead`: ce que notre processus fait autour de l'outil (Express,
 *    décodage du corps). À nous, et invisible jusqu'ici.
 *  - le RESTE: ce que Vapi compte APRÈS notre réponse. Il peut contenir le
 *    TOUR DE MODÈLE SUIVANT, mesuré à 1513 ms sur le même appel, ce qui
 *    suffirait à expliquer presque tout l'écart. Dans ce cas l'aller-retour
 *    n'est pas en cause du tout et déménager la région ne rendrait rien.
 *
 * `dispatch` est `null` là où `llm-stream` ne tourne pas (parole-à-parole,
 * custom-LLM éteint): le modèle est alors chez Vapi et l'émission ne passe pas
 * par nous. On ne conclut alors rien, plutôt que d'attribuer par défaut.
 */
export function hopBreakdown(
  dispatch: Array<{ name: string; dispatchMs: number | null; handlerMs: number }> | undefined,
  ours: Array<{ name: string; ms: number }> | undefined,
): { dispatchMs: number | null; overheadMs: number | null; samples: number } | null {
  if (!dispatch?.length) return null;
  const dispatches = dispatch.map(d => d.dispatchMs).filter((n): n is number => typeof n === 'number' && n >= 0);
  const handler = median(dispatch.map(d => d.handlerMs));
  const exec = median((ours ?? []).map(c => c.ms));
  const d = median(dispatches);
  /* L'overhead est une SOUSTRACTION de deux médianes, donc il peut sortir
     négatif quand les deux listes n'ont pas la même longueur (un outil exécuté
     sans que le dispatch soit consigné). Négatif, il ne veut rien dire: on le
     tait au lieu d'afficher un nombre qui a l'air d'une mesure. */
  const overhead = handler === null || exec === null ? null : Math.round(handler - exec);
  return {
    dispatchMs: d === null ? null : Math.round(d),
    overheadMs: overhead === null || overhead < 0 ? null : overhead,
    samples: dispatch.length,
  };
}

/**
 * LE LEVIER DE L'ALLER-RETOUR, choisi par la PART qui le porte (22/09/2026).
 *
 * L'ancienne version en nommait un seul — « l'orchestration de Vapi est LOIN,
 * c'est l'argument pour déplacer la région » — sur un nombre qui ne disait pas
 * où le temps passait. C'est la faute que cet audit a déjà commise neuf fois:
 * noter un composite, puis appeler un geste qui n'en répare qu'une part,
 * parfois celle qui allait bien. Ici le geste coûte un déménagement
 * d'infrastructure, donc l'erreur se paie plus cher que d'habitude.
 *
 * Trois sorties, trois réparations sans rapport — et un REFUS quand la mesure
 * ne permet pas de choisir, qui est le cas le plus important des quatre.
 */
function hopLever(
  hopMs: number,
  parts: { dispatchMs: number | null; overheadMs: number | null } | null,
): string {
  if (!parts || parts.dispatchMs === null) {
    return "chiffre COMPOSITE, aucun levier: sans la borne d'émission, rien ne dit si ces millisecondes sont le réseau, notre overhead, "
      + "ou le tour de modèle que Vapi compte APRÈS notre réponse. Ne pas déménager la région là-dessus";
  }
  const rest = Math.max(0, Math.round(hopMs - parts.dispatchMs - (parts.overheadMs ?? 0)));
  if (parts.dispatchMs > TARGETS.vapiHopMs[1]) {
    return `le TRAJET porte l'essentiel (${parts.dispatchMs} ms de notre émission à l'arrivée de la requête, une seule horloge): `
      + "c'est l'argument pour rapprocher le backend de Vapi, et il se pèse contre la ligne `aller-retour vers notre propre base`, qui tire dans l'autre sens";
  }
  if (parts.overheadMs !== null && parts.overheadMs > rest && parts.overheadMs > 200) {
    return `l'essentiel est CHEZ NOUS et autour de l'outil (${parts.overheadMs} ms hors exécution): regarder ce que le contrôleur et Express font avant \`execute\`, pas la région`;
  }
  return `le trajet ne fait que ${parts.dispatchMs} ms: le reste (~${rest} ms) est compté par Vapi APRÈS notre réponse, et c'est là que tombe le tour de modèle suivant. `
    + "NE PAS déménager la région sur ce chiffre — lire la ligne `LLM`";
}

const BAD_ENDINGS = ['silence-timed-out', 'pipeline-error', 'assistant-error', 'unknown-error', 'exceeded-max-duration', 'worker-shutdown'];

/** Les seuls outils qui lisent ou écrivent l'agenda Google. Les autres sont des
 *  requêtes Prisma: leur lenteur ne se répare pas sur un jeton Google. */
const GOOGLE_BACKED_TOOLS = new Set(['checkAvailability', 'bookAppointment', 'rescheduleBooking']);

/** Les replis que `degradedMessage` renvoie quand un outil a LEVÉ. C'est ce que
 *  le modèle traduit à voix haute par « il y a eu un problème technique ». */
const DEGRADED_PREFIXES = ['AGENDA INDISPONIBLE', 'CALENDAR UNAVAILABLE', 'AGENDA NIET BESCHIKBAAR', 'ACTION ECHOUEE', 'ACTION FAILED', 'ACTIE MISLUKT'];

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

  /* `llm-stream` A-T-IL TOURNÉ SUR CET APPEL ? Lu une fois, par tout le monde.
   *
   * Il ne tourne ni en parole-à-parole ni chez un client dont `customLlm` est
   * éteint: Vapi parle alors à OpenAI lui-même et rien ne passe par nous. Deux
   * lignes en dépendent et concluaient chacune de son côté, sur la même
   * question posée deux fois à la main (6vicies).
   *
   * Ce qui se perd quand il ne tourne pas: le brief d'ouverture, mais AUSSI
   * les étages PREP, LLM et TTFA, qu'aucune requête de modèle ne vient plus
   * poser. Leur absence est alors STRUCTURELLE, pas un défaut. L'audit
   * l'expliquait par « appel antérieur au partage PREP/LLM », une cause
   * inventée qui envoie chercher un vieux relevé là où la réponse est « ce
   * chemin n'a pas cet étage » — neuvième ligne de cet audit à trancher sur ce
   * qu'elle ne peut pas voir (6sexvicies, 6unsexagesies). Et comme la découpe
   * du délai ressenti se calcule par soustraction de ces étages, la ligne qui
   * nomme le PLUS GROS poste ne s'affichait pas du tout sur ces appels: le
   * seul écran qui réponde à « il attend une seconde avant de parler » était
   * muet précisément sur le moteur que le propriétaire dit préférer.
   *
   * La lecture se fait sur l'assistant DISTANT — ce qui a décroché, jamais le
   * réglage du client — et par `llmStreamRuns`, partagé avec `needsCallBrief`
   * pour que les deux ne puissent pas répondre autrement l'un que l'autre.
   * `null` veut dire « pas lu », et on ne conclut alors rien: une absence sans
   * cause connue se dit telle quelle plutôt que de se ranger du côté le plus
   * commode. */
  const ownStages: boolean | null =
    facts.remote.speechToSpeech === null || facts.remote.customLlm === null
      ? null
      : llmStreamRuns({ speechToSpeech: facts.remote.speechToSpeech, customLlm: facts.remote.customLlm });
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
    /* LE BRIEF D'OUVERTURE, VU OU PAS VU (17/09/2026).
     *
     * « Il me redemande mon nom à chaque fois alors que c'est relié à mon
     * numéro. » Sans cette ligne, ce retour ne distingue pas deux pannes
     * opposées: le brief n'est PAS parti (adresse de contrôle absente, Vapi
     * qui refuse `add-message`), ou il est parti et le modèle l'ignore. Le
     * premier se répare dans le webhook, le second dans le prompt.
     *
     * `skip` quand il n'y a rien à poser: sur le chemin custom-LLM,
     * `llm-stream` repose la mémoire à chaque tour et le brief n'existe pas.
     */
    const brief = typeof facts.realtime?.callBrief === 'string' ? facts.realtime.callBrief : null;
    /* `ownStages`, pas une seconde lecture écrite ici. Elle l'était, et elle
       rangeait un assistant JAMAIS LU du côté custom-LLM: « sans objet » sur
       un appel dont on ignore le chemin, c'est-à-dire un vert inventé sur la
       ligne qui existe pour distinguer deux pannes opposées. */
    const wanted = ownStages === false;
    push({
      id: 'brief', area: 'fonctionnement',
      status: ownStages === null || !wanted ? 'skip' : brief === null ? 'fail' : brief.startsWith('pose') ? 'ok' : 'fail',
      label: "brief d'ouverture: ce que l'agent SAIT avant le premier mot",
      value: ownStages === null
        ? "l'assistant distant n'a pas été lu: on ne sait pas si ce chemin attend un brief"
        : !wanted
        ? "sans objet: `llm-stream` repose la mémoire à chaque tour sur ce chemin"
        : brief === null
          ? "JAMAIS TENTÉ sur cet appel: l'agent a décroché sans mémoire de l'appelant ni rendez-vous"
          : brief,
      target: wanted ? 'posé, avec les rendez-vous du numéro' : undefined,
      /* ET LE CAS OÙ IL EST POSÉ SANS NOM (18/09/2026). Un brief posé compte
         22 appels et un rendez-vous, et ne nomme personne: ce n'est alors ni un
         défaut de plomberie ni un défaut de prompt, c'est `getCallerHistory`
         qui n'a pas résolu le nom — et le prompt n'y peut RIEN. Les deux
         réparations sont dans des fichiers différents, d'où deux leviers. */
      lever: wanted && (brief === null || !brief.startsWith('pose'))
        ? "journaux Render autour de l'heure de l'appel: `[Voice] brief`. Un `status-update` non reçu, une adresse de contrôle absente ou un refus de Vapi sur `add-message` se lisent là, et aucun des trois ne se répare dans le prompt"
        : wanted && brief?.includes('SANS NOM CONNU') && !brief.includes('0 appels')
          ? "le brief est posé mais ne NOMME personne, alors que ce numéro a déjà appelé: c'est `getCallerHistory` qu'il faut lire (mémoire d'appelant, nom de la dernière réservation confirmée, `nameCollected` des appels passés), pas le prompt. Tant que le nom manque là, l'agent a raison de le demander"
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
      /* LE LEVIER SE LIT SUR LE PLAN RÉELLEMENT POSÉ (18/09/2026).
         Il nommait « un plan absent » sans condition, y compris — relevé sur un
         appel réel — quand la ligne « détecteur de fin de tour » deux écrans
         plus bas était VERTE à 0,6 / 0,8. L'audit se contredisait donc lui-même
         en tête de sa propre liste de choses à faire, et envoyait reposer un
         plan qui était déjà là. Sixième fois qu'une de ces lignes envoie au
         mauvais endroit (6novoquadragesies, 6duoquinquagesies,
         6terquinquagesies, 6quaterquinquagesies, 6novoquinquagesies). */
      lever: doubled > 0
        ? (() => {
            /* Le MÊME test que la ligne « détecteur de fin de tour » plus bas,
               qui traite `{provider: 'aucun', …}` comme une absence: deux
               lectures différentes du même champ finiraient par se contredire,
               ce qui est précisément le défaut qu'on ferme ici. */
            const ep = facts.remote.endpointing;
            const hasPlan = !!ep && (ep.provider !== 'aucun' || ep.waitSeconds !== null || ep.punctuationSeconds !== null);
            return hasPlan
              ? `le plan est POSÉ (${ep!.provider}, attente ${ep!.waitSeconds ?? '?'} s, ponctuation ${ep!.punctuationSeconds ?? '?'} s): ce n'est donc PAS une absence de plan, et le reposer ne changera rien. Comparer à la ligne « détecteur de fin de tour » plus bas; ce qui reste ensuite, ce sont des seuils trop courts pour ce mode, ou le modèle qui reprend la parole seul`
              : "aucun plan sur l'assistant qui décroche: la main est rendue au défaut de Vapi (0,4 s), qui coupe quelqu'un qui réfléchit. `voice:resync --confirm` le repose";
          })()
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

  /* UN OUTIL QUI A LEVÉ SE VOIT, et il ne se voyait NULLE PART (18/09/2026).
     Appel réel: l'agent dit « Je suis désolé, il y a eu un problème technique »,
     puis demande un numéro de rappel et appelle `captureLead` — c'est-à-dire,
     mot pour mot, ce que `degradedMessage` lui ordonne de faire. L'audit, lui,
     affichait cinq outils avec leurs durées et AUCUN signe d'échec: la ligne
     « durée des outils » lit le transcript de Vapi, où un repli est un résultat
     comme un autre.
     Le fait était donc déjà dans les données, jamais lu — et sans lui, « il a
     dit problème technique » n'est rattachable à rien. C'est 6sexvicies: le
     code qui LIT un champ compte autant que celui qui l'écrit. */
  {
    const degraded = facts.tools.filter(t => resultSays(t.result, ...DEGRADED_PREFIXES));
    if (degraded.length) {
      push({
        id: 'tool-degraded', area: 'fonctionnement', status: 'fail',
        label: "outils tombés en repli: ce qui a fait dire « problème technique »",
        value: degraded
          .map(t => `${t.name}${t.atSeconds != null ? ` (à ${t.atSeconds.toFixed(0)} s)` : ''}: ${String(t.result).split(':')[0]}`)
          .join(', '),
        target: 'aucun',
        lever: degraded.some(t => GOOGLE_BACKED_TOOLS.has(t.name))
          ? "l'outil a LEVÉ, il n'a pas rendu une liste vide: journaux Render `[VoiceTools] ... failed`. Premier suspect, `EXTERNAL_TIMEOUT_MS` (2,5 s) sur la lecture Google, et le cache du spéculateur qui ne tient que 30 s — une seconde lecture du MÊME jour, une minute plus tard, repaie plein tarif"
          : "l'outil a LEVÉ: journaux Render `[VoiceTools] ... failed` nomment l'exception",
      });
    }
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

  const noStagesWhy = ownStages === false
    ? facts.remote.speechToSpeech
      ? "sans objet: en parole-à-parole, Vapi parle à OpenAI en audio direct, `llm-stream` ne tourne pas et cet étage n'existe pas"
      : "sans objet: `customLlm` est éteint sur l'assistant distant, Vapi appelle OpenAI lui-même, `llm-stream` ne tourne pas et cet étage n'existe pas"
    : null;

  push({
    id: 'prep', area: 'latence',
    status: prep ? grade(prep.median, TARGETS.prepMs) : 'skip',
    label: 'PREP: notre serveur avant l\'envoi à OpenAI',
    value: prep
      ? `médiane ${prep.median} ms, p95 ${prep.p95} ms sur ${prep.count} tour(s)`
      : noStagesWhy
      ? noStagesWhy
      /* Le SEUL cas où « appel antérieur » est vrai: le LLM a été mesuré et
         PREP non, donc le partage n'existait pas encore à ce relevé. Sans
         cette distinction, la phrase s'appliquait aussi aux appels qui n'ont
         tout simplement pas cet étage. */
      : llm
      ? 'pas de mesure (appel antérieur au partage PREP/LLM)'
      : 'pas de mesure',
    target: !prep && noStagesWhy ? undefined : `≤ ${TARGETS.prepMs[0]} ms`,
    lever: prep && prep.median > TARGETS.prepMs[0]
      ? "c'est chez nous: profil ou historique relus à chaque tour (cache local ?), blocs de prompt trop lourds; profiler `handle()` avant `proxy()`"
      : undefined,
  });

  push({
    id: 'llm', area: 'latence',
    status: llm ? grade(llm.median, TARGETS.llmMs) : 'skip',
    label: prep || (!llm && noStagesWhy) ? 'LLM: OpenAI seul, envoi → premier jeton' : 'LLM: serveur + OpenAI (non séparés sur cet appel)',
    value: llm
      ? `médiane ${llm.median} ms, p95 ${llm.p95} ms sur ${llm.count} tour(s)`
      : noStagesWhy ?? 'pas de mesure',
    target: !llm && noStagesWhy ? undefined : `≤ ${TARGETS.llmMs[0]} ms`,
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
      ? noStagesWhy ?? 'pas de mesure'
      : ttfaImpossible
      ? `MESURE INUTILISABLE: médiane ${ttfa.median} ms alors que l'horloge de Vapi plafonne le délai ressenti à `
        + `${Math.round(felt!)} ms. Le TTFA est un morceau de ce délai, il ne peut pas le dépasser.`
      : `médiane ${ttfa.median} ms, p95 ${ttfa.p95} ms sur ${ttfa.count} tour(s)`,
    target: ttfaImpossible || (!ttfa && noStagesWhy) ? undefined : `≤ ${TARGETS.ttfaMs[0]} ms`,
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
    const configuredMs = Math.round(((ep?.waitSeconds ?? 0) + (ep?.punctuationSeconds ?? 0)) * 1000);
    const stagesMs = (prep?.median ?? 0) + (llm?.median ?? 0) + (ttfa?.median ?? 0);
    const beforeUs = gap !== null && stagesMs > 0 ? Math.round(gap * 1000 - stagesMs) : null;

    /* DEUX FORMES DE DÉCOUPE, et une seule est possible par appel.
     *
     * La soustraction quand nos étages existent; sinon le PLANCHER seul,
     * parce que soustraire zéro rendrait le délai ENTIER et attribuerait à la
     * détection de fin de tour le temps qu'OpenAI passe à répondre. Ce geste-là
     * envoie baisser un seuil pour une seconde qui n'est pas la sienne, et
     * c'est très exactement la faute que cet audit a déjà commise huit fois,
     * avec à chaque fois un levier qui DÉGRADE ce qui marche
     * (6novoquadragesies, 6duoquinquagesies, 6terquinquagesies). */
    const splits = beforeUs !== null && beforeUs > 0;
    const floorOnly = !splits && ownStages === false && gap !== null && configuredMs > 0;

    push({
      id: 'vapi-gap', area: 'latence',
      status: gap !== null ? grade(gap, TARGETS.vapiGapSeconds) : 'skip',
      label: "délai ressenti: fin de parole → réponse (horloge Vapi)",
      value: gap !== null ? `médiane ${gap.toFixed(1)} s, max ${Math.max(...facts.vapiGapsSeconds).toFixed(1)} s sur ${facts.vapiGapsSeconds.length} tour(s)` : 'pas de mesure',
      target: `≤ ${TARGETS.vapiGapSeconds[0]} s`,
      /* Le levier ne renvoie à la ligne suivante que si elle EXISTE et
         répond bien à la question posée. Il envoyait lire « quelle part est à
         nous » sur tout appel hors cible, y compris ceux où cette ligne
         n'était jamais poussée faute d'étages — c'est-à-dire précisément les
         appels en parole-à-parole, où le propriétaire dit préférer parler. */
      lever: gap === null || gap <= TARGETS.vapiGapSeconds[0]
        ? undefined
        : splits
        ? 'la ligne suivante dit quelle PART est à nous et laquelle est la détection de fin de tour'
        : floorOnly
        ? "la ligne suivante dit ce que les seuils posés pèsent là-dedans; le reste est la réponse d'OpenAI, que ce chemin ne laisse pas mesurer"
        : "rien ne permet de le découper sur ce relevé: ni nos étages (`llm-stream` n'a pas tourné) ni les seuils de l'assistant distant n'ont été lus",
    });

    if (splits) {
      /* La marge couvre ce que la somme des seuils ne dit pas: le
         transcripteur (`VOICE_ENDPOINTING_MS`, 150 ms), le trajet jusqu'à
         l'Oregon et le routage de Vapi. 600 ms plutôt que 400, et le choix est
         ASYMÉTRIQUE à dessein: se tromper en disant « expliqué » fait baisser
         un plancher et gagner moins que prévu, ce qui se voit au relevé
         suivant et se défait par une variable; se tromper dans l'autre sens
         envoie chercher la cause dans un seuil qui n'y est pour rien. Le
         relevé réel du 17/09 donnait 1 216 ms pour 800 ms de seuils, à 16 ms
         d'une marge de 400. */
      const before = beforeUs!;
      const explained = configuredMs > 0 && before <= configuredMs + 600;
      push({
        id: 'turn-detect', area: 'latence',
        status: before <= TARGETS.turnDetectMs[0] ? 'ok' : before <= TARGETS.turnDetectMs[1] ? 'warn' : 'fail',
        label: "détection de fin de tour: avant que la requête n'arrive chez nous",
        value: `${before} ms des ${Math.round(gap! * 1000)} ms de délai ressenti (nos étages: ${Math.round(stagesMs)} ms)`
          + (configuredMs > 0
            ? explained
              ? `, cohérent avec les seuils posés (${configuredMs} ms + transcripteur)`
              : `, soit ${before - configuredMs} ms de PLUS que les seuils posés (${configuredMs} ms): les baisser ne rendra pas tout ça`
            : ''),
        target: `≤ ${TARGETS.turnDetectMs[0]} ms`,
        lever: before > TARGETS.turnDetectMs[0]
          ? explained
            ? "`VOICE_START_WAIT_SECONDS` (0,4) est un PLANCHER posé au-dessus du détecteur intelligent: c'est le premier à baisser. GARDER `VOICE_ENDPOINTING_PUNCTUATION_SECONDS` à 0,4, c'est lui qui empêche de couper sur une respiration. Variables d'environnement, puis `voice:resync --confirm`"
            : "les seuils ne suffisent pas à l'expliquer: regarder `VOICE_ENDPOINTING_NO_PUNCTUATION_SECONDS` (1,2 s quand le transcripteur ne met pas de point) et `VOICE_ENDPOINTING_MS`, avant de toucher au reste"
          : undefined,
      });
    } else if (floorOnly) {
      /* LE PLANCHER, ET RIEN QUE LUI.
       *
       * Ce qui reste vrai sans nos étages: les seuils posés sur l'assistant
       * distant sont du temps dépensé AVANT que quoi que ce soit ne commence,
       * quel que soit le chemin. On note donc ce plancher, et le reste est
       * nommé « non mesuré » plutôt que deviné.
       *
       * ET ON NE LE NOTE PAS EN ROUGE SUR SA SEULE VALEUR, ce qui serait le
       * neuvième faux diagnostic: le niveau superagent porte 0,6 / 0,8 s, soit
       * 1 400 ms, au-dessus de la cible — et ces valeurs ont été MONTÉES
       * exprès le 17/09 après « je dis bonjour et il pose direct une question
       * alors que j'ai pas fini ma phrase » (6octoquinquagesies). Les noter
       * rouges enverrait défaire un réglage posé contre un retour réel.
       *
       * La question à laquelle ce chiffre PEUT répondre n'est donc pas « est-il
       * grand » mais « pèse-t-il la majorité d'un délai déjà hors cible »
       * (6quaterquinquagesies). Sur un appel dans les clous, il n'y a rien à
       * faire et la ligne est informative. Le rouge, lui, reste sur la ligne
       * au-dessus, une seule fois: `vapi-gap` et celle-ci mesurent le même
       * fait, et le noter deux fois lui donnerait deux fois son poids. */
      const feltMs = Math.round(gap! * 1000);
      const restMs = feltMs - configuredMs;
      const overTarget = gap! > TARGETS.vapiGapSeconds[0];
      const majority = configuredMs * 2 >= feltMs;
      push({
        id: 'turn-detect', area: 'latence',
        status: overTarget && majority ? 'warn' : 'ok',
        label: "détection de fin de tour: le plancher posé (le reste n'est pas mesurable ici)",
        value: `${configuredMs} ms de seuils sur ${feltMs} ms de délai ressenti`
          + (restMs > 0
            ? `; les ${restMs} ms restants sont la réponse d'OpenAI et le routage, que ce chemin ne nous laisse pas mesurer`
            : '')
          + (overTarget
            ? majority
              ? '. Les seuils portent la MAJORITÉ de ce délai: les baisser rendra vraiment quelque chose'
              : ". Les seuils sont MINORITAIRES: les baisser ne rendra qu'une fraction, la cause est ailleurs"
            : ''),
        lever: overTarget && majority
          ? "les seuils du NIVEAU (`VOICE_REALTIME_START_WAIT_SECONDS` et ses voisines, portées par le `tuning` de `superagent`), jamais les variables globales: elles ont été SÉPARÉES parce qu'en parole-à-parole le modèle répond une seconde plus tôt, donc à seuil égal il pose sa voix trop tôt (6octoquinquagesies). Puis `voice:resync --confirm`"
          : overTarget
          ? "pas les seuils: regarder le modèle temps réel servi (`remote.modelName`) et la durée des outils, qui sont dans le délai sans être dans ce plancher"
          : undefined,
      });
    }
  }

  {
    /* CE QUE NOUS EXECUTONS, ET RIEN D'AUTRE (21/09/2026).
     *
     * `facts.tools` vient du TRANSCRIPT de Vapi, qui y range aussi ses outils a
     * LUI. Relevé réel: `endCall 5.5 s`, classé le plus lent de l'appel, avec
     * pour levier « qui ne lit PAS l'agenda: c'est une requête Prisma. Regarder
     * Neon ». Or `endCall` n'est ni dans `KNOWN_TOOLS` ni nulle part dans notre
     * runtime: il ne touche jamais notre backend, encore moins Neon. Ces cinq
     * secondes sont Vapi qui VIDE SA FILE DE PAROLE avant de raccrocher
     * (6quatersexagesies), donc l'au revoir que l'appelant entend.
     *
     * Dixième diagnostic faux de cet audit, et il avait les deux défauts de la
     * famille: il envoie réparer au mauvais endroit, ET il rougit une ligne sur
     * un chiffre qui n'est pas le nôtre. Les outils de Vapi restent AFFICHES —
     * cinq secondes avant le raccroché, l'appelant les vit — mais hors du
     * verdict et hors du levier. */
    const ours = facts.tools.filter(t => isKnownTool(t.name));
    const theirs = facts.tools.filter(t => !isKnownTool(t.name) && t.tookSeconds !== null);
    const timed = ours.filter(t => t.tookSeconds !== null);
    const slow = timed.filter(t => t.tookSeconds! > TARGETS.toolSeconds[0]);

    /* LES OUTILS EXÉCUTÉS EN LIGNE NE SONT PAS AU TRANSCRIPT DE VAPI
       (25/09/2026), puisqu'il ne les a pas vus passer. Sans cette ligne,
       l'audit d'un appel où TOUT a marché dirait « aucun outil », et on
       chercherait une panne qui n'existe pas — la faute que cet audit a déjà
       commise dix fois. C'est notre propre relevé qui fait foi ici. */
    const inline = (rt?.inlineTools as string[] | undefined) ?? [];
    if (inline.length) {
      const mine = (rt?.toolCalls as Array<{ name: string; ms: number }> | undefined) ?? [];
      const inlineTimed = mine.filter(c => inline.includes(c.name.replace(/:error$/, '')));
      const worstMs = inlineTimed.length ? Math.max(...inlineTimed.map(c => c.ms)) : 0;
      push({
        id: 'tools-inline', area: 'latence',
        /* Sans durée relevée, on ne note pas: on dit seulement qu'ils ont
           tourné ici. Un vert inventé vaudrait moins que rien. */
        status: inlineTimed.length ? grade(worstMs / 1000, TARGETS.toolSeconds) : 'skip',
        label: 'outils exécutés dans notre flux (sans aller-retour Vapi)',
        value: (inlineTimed.length
          ? inlineTimed.map(c => `${c.name} ${(c.ms / 1000).toFixed(1)} s`).join(', ')
          : inline.join(', '))
          + `. Vapi ne les a pas vus passer, donc ils ne comptent NI dans « durée des outils » NI dans l'aller-retour: c'est exactement ce qu'on voulait`,
        target: `≤ ${TARGETS.toolSeconds[0]} s chacun`,
        lever: inlineTimed.length && worstMs / 1000 > TARGETS.toolSeconds[0]
          ? "ce qui reste est notre exécution seule, sans réseau: regarder la requête elle-même (`aller-retour vers notre propre base`, l'agenda Google), jamais la région"
          : undefined,
      });
    }

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
        value: timed.map(t => `${t.name} ${t.tookSeconds!.toFixed(1)} s${t.atSeconds != null ? ` (à ${t.atSeconds.toFixed(0)} s)` : ''}`).join(', ')
          + (theirs.length
            ? ` — et chez VAPI, hors de notre portée: ${theirs.map(t => `${t.name} ${t.tookSeconds!.toFixed(1)} s`).join(', ')}`
            : ''),
        target: `≤ ${TARGETS.toolSeconds[0]} s chacun`,
        /* LE LEVIER SUIT L'OUTIL LE PLUS LENT, PAS LE PREMIER NOM RECONNU
           (18/09/2026). Il nommait l'agenda Google dès qu'un `checkAvailability`
           dépassait la cible, même quand les deux pires de la liste étaient
           `captureLead` (7,7 s) et `lookupBooking` (6,1 s) — deux outils qui ne
           lisent JAMAIS Google: ce sont des requêtes Prisma. Envoyer renouveler
           un jeton Google pour une lenteur de base de données, c'est un
           diagnostic FAUX, et il coûte plus cher que pas de diagnostic
           (6sexvicies). */
        lever: slow.length
          ? (() => {
              const worstTool = timed.reduce((a, b) => (b.tookSeconds! > a.tookSeconds! ? b : a));
              if (!GOOGLE_BACKED_TOOLS.has(worstTool.name)) {
                return `le plus lent est \`${worstTool.name}\` (${worstTool.tookSeconds!.toFixed(1)} s), qui ne lit PAS l'agenda: c'est une requête Prisma. Regarder Neon (réveil, pool) et ce qui est attendu sur le chemin de la réponse, pas le jeton Google`;
              }
              return "l'agenda Google est lu pendant le tour: la spéculation sur la date partielle n'a pas pris (date non détectée dans le transcript partiel ?), ou jeton Google à renouveler";
            })()
          : undefined,
      });
    }
  }

  /* OÙ SONT LES MACHINES, mesuré et non déduit.
   *
   * Ces deux lignes existent pour une décision qui engage une facture: faut-il
   * déplacer le backend. Elle se prenait jusqu'ici au raisonnement, et le
   * raisonnement a déjà eu tort — la table de coûts disait que le modèle pesait
   * le plus quand la facture disait la plateforme (6quinquesexagesies).
   *
   * Elles mesurent les DEUX distances qui comptent, et elles tirent dans des
   * sens opposés: la base est à l'est, l'orchestration de Vapi est où elle est.
   * Déplacer le backend vers l'une l'éloigne de l'autre, donc aucune des deux
   * ne suffit seule à trancher. */
  {
    const db = rt?.dbRoundTrip as { floorMs?: number; worstMs?: number; samples?: number } | undefined;
    if (db && typeof db.floorMs === 'number') {
      const far = db.floorMs > TARGETS.dbRoundTripMs[1];
      /* LES DEUX SONDES, ET C'EST LEUR ÉCART QUI DIT QUOI RÉPARER.
       *
       * Celle de l'OUVERTURE peut payer l'établissement d'une connexion (TCP,
       * TLS, authentification: quatre à cinq allers-retours). Celle de la FIN
       * tombe sur un pool que l'appel entier vient de chauffer. Si la seconde
       * s'effondre, le coût était la connexion et c'est le pool qu'il faut
       * tenir chaud; si elle tient, c'est la DISTANCE, et là seulement la
       * région est la réponse.
       *
       * Sans cette comparaison, 310 ms se lisait « chaque requête du chemin
       * d'appel paie ça » — une lecture que rien n'établissait, et qui engage
       * une migration. */
      const end = rt?.dbRoundTripEnd as { floorMs?: number } | undefined;
      const warmMs = typeof end?.floorMs === 'number' ? end.floorMs : null;
      /* La moitié: assez pour que l'écart ne soit pas du bruit, et le seuil
         est franc parce que les deux causes ne se ressemblent pas — un
         établissement de connexion coûte plusieurs fois la distance. */
      const wasHandshake = warmMs !== null && warmMs * 2 <= db.floorMs;
      const region = typeof rt?.dbRegion === 'string' ? rt.dbRegion : null;
      push({
        id: 'db-distance', area: 'latence',
        status: wasHandshake ? 'warn' : grade(db.floorMs, TARGETS.dbRoundTripMs),
        label: 'aller-retour vers notre propre base',
        /* Le PLANCHER et le PIRE séparément: le premier est le réseau seul et
           répond à « la base est-elle loin », le second est ce qu'un réveil de
           pool ou de calcul Neon ajoute, et c'est une autre réparation. Une
           moyenne ne répondrait à aucune des deux. */
        value: `${db.floorMs} ms au plancher à l'ouverture, ${db.worstMs} ms au pire, sur ${db.samples} sonde(s)`
          + (region ? `, base en ${region}` : '')
          + (warmMs === null
            ? " — pas de seconde sonde: impossible de dire si c'est la distance ou l'établissement de connexion"
            : wasHandshake
            ? `. POOL CHAUD EN FIN D'APPEL: ${warmMs} ms. L'écart dit que l'ouverture payait l'ÉTABLISSEMENT d'une connexion, pas la distance`
            : `. Pool chaud en fin d'appel: ${warmMs} ms, donc c'est bien la DISTANCE que chaque requête paie`)
          + (far && !wasHandshake ? " — une distance de continent, pas de centre de données" : ''),
        target: `≤ ${TARGETS.dbRoundTripMs[0]} ms`,
        lever: wasHandshake
          ? "ce n'est PAS la région: une connexion neuve coûte quatre à cinq allers-retours (TCP, TLS, authentification), et le pool en ouvre pendant que l'appelant écoute l'accueil. Regarder `connection_limit` et ce qui garde le pool chaud entre deux appels, PAS `render.yaml`"
          : db.floorMs > TARGETS.dbRoundTripMs[0]
          ? `le backend et la base ne sont pas dans la même région (\`render.yaml\` déclare \`oregon\`${region ? `, la base répond en ${region}` : ''}): CHAQUE requête Prisma du chemin d'appel paie ça, et les outils sont le plus gros poste qui reste. Les rapprocher vaut plus que n'importe quel réglage de voix — et déplacer le backend SANS déplacer la base allonge cet aller-retour au lieu de le raccourcir`
          : undefined,
      });
    }
  }

  {
    /* LES REPLIS PRISMA PAYÉS PENDANT CET APPEL.
     *
     * Question laissée ouverte le 19/09 et jamais refermée: le relevé du 18/09
     * montre des outils qui RALENTISSENT au fil de l'appel (2,2 puis 6,1, 2,9,
     * 4,5, 7,7 s), ce qui est l'inverse d'un démarrage à froid. Le journal de
     * repli a été passé en `info` pour répondre, mais il se lit dans Render, à
     * la main, en connaissant l'heure de l'appel — donc le fait existait sans
     * que personne ne l'ouvre, encore (6unsexagesies).
     *
     * ZÉRO N'EST PAS UNE LIGNE. Un appel sain n'en paie aucun, et afficher
     * « 0 repli » à chaque passage ajouterait une ligne verte de plus à un
     * écran qu'il faut déjà relire en entier. Elle n'apparaît que quand il y a
     * quelque chose à dire. */
    const retries = rt?.dbRetries as { count?: number; waitedMs?: number; coldStarts?: number } | undefined;
    if (retries && (retries.count ?? 0) > 0) {
      const waited = retries.waitedMs ?? 0;
      const cold = retries.coldStarts ?? 0;
      push({
        id: 'db-retries', area: 'latence',
        status: waited >= 1000 ? 'fail' : 'warn',
        label: 'replis Prisma payés pendant cet appel',
        value: `${retries.count} repli(s), ${waited} ms d'attente pure`
          + (cold > 0 ? `, dont ${cold} sur un démarrage à froid` : '')
          /* La réserve fait partie du chiffre: une extension Prisma ne sait pas
             quel appel est en vol, donc deux appels simultanés se partagent le
             compteur. Le dire vaut mieux qu'un chiffre précis et faux. */
          + '. Compteur PROCESSUS-LARGE: avec des appels simultanés, il les compte pour les deux',
        target: 'aucun',
        lever: cold > 0
          ? "démarrage à froid de Neon: le calcul s'était endormi. C'est le `keepalive` qu'il faut regarder, pas la requête — et ça explique à soi seul un outil qui dépasse la cible"
          : "replis transitoires (pool, connexion fermée): ils s'ajoutent à la durée des outils sans apparaître dans la requête. Journaux Render `[prisma]` autour de l'heure de l'appel pour la cause exacte",
      });
    }
  }

  {
    const hop = vapiHopMs(facts.tools, rt?.toolCalls as Array<{ name: string; ms: number }> | undefined);
    const parts = hopBreakdown(
      rt?.toolDispatch as Array<{ name: string; dispatchMs: number | null; handlerMs: number }> | undefined,
      rt?.toolCalls as Array<{ name: string; ms: number }> | undefined,
    );
    if (hop && hop.pairs > 0) {
      /* UN ÉCART NÉGATIF N'EST PAS UNE DISTANCE NÉGATIVE: c'est que les deux
         horloges ne parlent pas du même intervalle, ou que l'appariement s'est
         décalé. On le dit inutilisable plutôt que de le noter, exactement comme
         un TTFA plus grand que le pire délai de Vapi (6terquinquagesies). */
      const unusable = hop.medianMs < 0;
      push({
        id: 'vapi-hop', area: 'latence',
        status: unusable ? 'warn' : grade(hop.medianMs, TARGETS.vapiHopMs),
        label: 'aller-retour entre Vapi et notre backend (deux horloges)',
        value: unusable
          ? `MESURE INUTILISABLE: ${hop.medianMs} ms, donc Vapi compterait un outil plus court que nous ne l'avons exécuté. `
            + `Les deux horloges ne bornent pas le même intervalle sur cet appel`
          : `${hop.medianMs} ms de médiane sur ${hop.pairs} outil(s): ce que Vapi compte en plus de notre propre exécution`
            + (parts?.dispatchMs === null || parts === null
              /* SANS la borne d'émission, on en est au plafond d'avant: on le
                 DIT, au lieu de laisser croire que le chiffre désigne le
                 réseau. En parole-à-parole le modèle est chez Vapi, donc cette
                 borne n'existe pas et ne peut pas exister. */
              ? `. PLAFOND, pas le trajet: sans la borne d'émission (\`llm-stream\` n'a pas tourné sur cet appel), rien ne dit ce qu'il y a dedans`
              : `, DÉCOMPOSÉ: ${parts.dispatchMs} ms entre notre émission de l'appel d'outil et l'arrivée de la requête chez nous`
                + (parts.overheadMs === null ? '' : `, ${parts.overheadMs} ms d'overhead chez nous autour de l'outil`)
                + `, le reste étant ce que Vapi compte APRÈS notre réponse`)
            /* LA CONCLUSION EST DANS LA VALEUR, PAS DANS LE LEVIER. Une ligne
               verte sans lever ne dit rien, et c'est précisément le cas qui
               répond « non » à la question qui coûte cher. Un audit qui ne
               parle que quand ça va mal laisse décider au raisonnement le jour
               où ça va bien. */
            + (hop.medianMs <= TARGETS.vapiHopMs[0]
              ? `. Vapi est donc PROCHE du backend: déplacer celui-ci en Europe ajouterait cette distance à chaque outil ET à chaque tour de modèle custom-LLM`
              : ''),
        target: unusable ? undefined : `≤ ${TARGETS.vapiHopMs[0]} ms`,
        lever: unusable
          ? "apparier les outils dans l'ordre suppose que les deux listes les voient dans le même: vérifier `recordToolCall` et `readVapiMessages` avant de conclure quoi que ce soit sur la région"
          : hop.medianMs > TARGETS.vapiHopMs[0]
          ? hopLever(hop.medianMs, parts)
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
    /* CE QUE L'APPEL A COÛTÉ POUR DE VRAI (19/09/2026).
       « Ça coûte hyper cher » ne se vérifiait nulle part: l'audit ne parlait
       d'argent qu'à travers `REALTIME_RATES`, une table relevée à la main qui
       SUPPOSE le modèle servi. Or Vapi facture et le dit, appel par appel, et
       ce chiffre dormait en base depuis le début.
       Le VERDICT ne s'appuie que sur le total et la durée, deux nombres sans
       ambiguïté. Le détail par poste est affiché SANS être jugé: sa forme n'a
       pas été lue sur la documentation vivante de Vapi, donc un poste mal
       reconnu ne doit pas pouvoir fabriquer un verdict (c'est la leçon des
       sept diagnostics faux: on note ce qu'on peut trancher, on montre le
       reste). */
    const money = facts.cost;
    const minutes = money?.durationSeconds ? money.durationSeconds / 60 : null;
    if (money && typeof money.usd === 'number' && minutes && minutes > 0) {
      const eurPerMin = eur(money.usd / minutes);
      const plan = facts.expected.planId ? PLANS[facts.expected.planId] : null;
      const revenue = plan ? revenuePerIncludedMinuteEur(plan) : null;
      /* Sans forfait connu, on juge contre la recette la PLUS BASSE de la
         grille: au-dessus d'elle, la minute est déficitaire quelque part. */
      const floor = revenue ?? Math.min(...Object.values(PLANS).map(revenuePerIncludedMinuteEur));
      const loses = eurPerMin > floor;
      /* Les postes, par ordre de poids. Les compteurs (jetons, caractères,
         secondes) ne sont pas des montants: écartés par leur NOM, ce qui est
         une heuristique assumée — elle ne peut que mal afficher une ligne,
         jamais changer le verdict. */
      const lines = Object.entries(money.breakdown ?? {})
        .filter(([k, v]) => typeof v === 'number' && v > 0 && !/tokens?$|characters?$|seconds?$|ms$|count$/i.test(k))
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 4)
        .map(([k, v]) => `${k} ${(v as number).toFixed(3)} $`);
      push({
        id: 'cout', area: 'reglages',
        status: loses ? 'fail' : 'ok',
        label: 'ce que cet appel a coûté chez Vapi',
        value: [
          `${money.usd.toFixed(3)} $ pour ${minutes.toFixed(1)} min, soit ${eurPerMin.toFixed(3)} €/min`,
          lines.length ? lines.join(', ') : null,
          loses
            ? `la minute ${plan ? `d'un ${plan.name}` : 'la moins chère de la grille'} en rapporte ${floor.toFixed(3)} €`
            : null,
        ].filter(Boolean).join(' — '),
        target: `≤ ${floor.toFixed(3)} €/min`,
        lever: loses
          ? "cette minute coûte plus qu'elle ne rapporte. Le poste le plus lourd est en tête de la valeur: si c'est le modèle, c'est `VOICE_REALTIME_MODEL` (facteur dix entre les six); si c'est la plateforme, c'est la part que supprimerait un trunk SIP direct. `npm run voice:pricing` donne la feuille par palier"
          : undefined,
      });
    }

    /* CE QUI NE VIENT PAS DU DÉPÔT (19/09/2026).
       Relevé sur un compte réel: l'assistant portait `gpt-realtime-2` ET un
       transcripteur ElevenLabs Scribe v2. Le modèle, la nouvelle ligne
       ci-dessous le voit; le transcripteur, personne: il n'était lu qu'en
       BOOLÉEN, « y en a-t-il un », jamais « lequel ».
       Or `buildTranscriber` écrit `provider: 'deepgram'` sans condition, et
       c'est le SEUL constructeur de transcripteur du code (le repli de
       `VOICE_STT_FALLBACK_PROVIDER` vit dans `fallbackPlan`, pas en tête). Un
       autre fournisseur ne peut donc pas venir d'ici: il a été posé à la main
       dans le tableau de bord Vapi, ou par un bouton « Model Presets », qui
       réécrit transcripteur, modèle et voix d'un coup.
       C'est un DÉFAUT et pas une remarque, pour une raison qui dépasse le
       réglage lui-même: cet état est INSTABLE. Le prochain enregistrement du
       portail renvoie `transcriber` explicitement et l'écrase. Deux appels de
       test encadrant une sauvegarde n'ont donc pas tourné sur la même
       configuration, et aucune lecture du code ne prédit ce qu'on a entendu.
       C'est 6duodecies vu de l'autre bout: un réglage fait à la main dans le
       tableau de bord d'un fournisseur, que le code ignore, et qui décide de
       ce que quelqu'un paie. */
    const remoteStt = facts.remote.transcriberProvider;
    if (remoteStt !== undefined) {
      const foreign = !!remoteStt && remoteStt.toLowerCase() !== 'deepgram';
      push({
        id: 'transcripteur-source', area: 'reglages',
        status: foreign ? 'fail' : 'ok',
        label: 'transcripteur de l\'assistant qui décroche',
        value: remoteStt === null
          ? 'aucun (parole-à-parole sans transcripteur)'
          : foreign
            ? `${remoteStt}: le code n'écrit QUE deepgram, donc ce réglage a été posé hors du dépôt`
            : remoteStt,
        target: 'deepgram',
        lever: foreign
          ? "l'assistant a été édité dans le tableau de bord Vapi (à la main, ou par un bouton « Model Presets »). Ne pas publier ce brouillon: `npm run voice:resync -- --confirm` remet la configuration du dépôt, et les deux se battraient à chaque enregistrement du portail"
          : undefined,
      });
    }

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

    /* EN PAROLE-À-PAROLE, CES DEUX MODÈLES NE TOURNENT PAS (19/09/2026).
       `VAPI_MODEL` et `VOICE_SMALL_MODEL` sont les étages du chemin
       custom-LLM, et sur ce chemin-ci Vapi parle à OpenAI directement. L'audit
       les affichait quand même, et ne nommait NULLE PART celui qui sert. Le
       retour « le real-time est con » n'était donc pas vérifiable: on ne
       savait pas lequel des six modèles temps réel c'était, et ils vont de
       0,060 $ à 0,645 $ la minute, soit un facteur dix qui s'entend.
       Le nom est LU sur l'assistant distant, jamais déduit du réglage
       (6quinvicies, et c'est le même écart que « niveau servi »). */
    if (facts.remote.speechToSpeech) {
      const got = facts.remote.modelName;
      const want = facts.expected.realtimeModel;
      /* LE VERDICT PORTE SUR CE QUE L'ASSISTANT PORTE, PAS SUR L'ÉCART AVEC
         L'ENVIRONNEMENT (19/09/2026), et le levier d'avant était DESTRUCTEUR.
         `facts.expected.realtimeModel` est `env.VOICE_REALTIME_MODEL` lu par le
         script, donc celui de la MACHINE QUI LANCE L'AUDIT, jamais celui de
         Render. Les deux n'ont aucune raison de coïncider: l'assistant est
         écrit par le code qui tourne sur Render, à chaque enregistrement du
         portail. Un écart ne dit donc pas « l'assistant est périmé », il dit
         « ces deux lectures ne viennent pas du même endroit » (6duotrigesies).
         La ligne d'avant tranchait quand même, et conseillait le resync: ce
         geste aurait écrit le modèle du POSTE sur l'assistant, c'est-à-dire,
         `.env` absent, le défaut `gpt-realtime-2025-08-28`, dont le tarif n'a
         jamais été relevé. Huitième diagnostic faux de cet audit, et le
         premier dont le geste dégrade ce qui marchait.
         Le juge est donc une source qui ne vient ni de l'env ni de l'assistant:
         `REALTIME_RATES`, relevé sur le tableau de bord Vapi. Elle répond à la
         seule question qui engage de l'argent, et le facteur dix entre les six
         modèles la rend décisive: cette minute coûte-t-elle plus qu'elle ne
         rapporte ? Relevé sur un compte réel le 19/09: l'assistant portait
         `gpt-realtime-2` (0,645 $/min) quand Render disait le mini
         (0,060 $/min), et rien ne le montrait nulle part. */
      const cost = got ? superagentCost(got) : null;
      const priced = cost && 'eurPerMinute' in cost ? cost : null;
      const proCost = got ? inclusionCostEur(PLANS.pro, got) : null;
      const ruinous = typeof proCost === 'number' && proCost > PLANS.pro.monthlyPriceEur;
      const diverges = !!got && got !== want;
      /* Le chiffre dans la valeur, la phrase dans le levier: une valeur qui
         porte toute l'explication ne se lit plus d'un coup d'œil. */
      const money = priced ? `${priced.eurPerMinute.toFixed(3)} €/min` : 'tarif jamais relevé';
      push({
        id: 'tiers', area: 'reglages',
        status: !got ? 'skip' : ruinous ? 'fail' : !priced || diverges ? 'warn' : 'ok',
        label: 'modèle temps réel servi par l\'assistant qui décroche',
        value: !got
          ? 'assistant distant non lu'
          : [
              `${got} (${money})`,
              ruinous
                ? `un client ${PLANS.pro.name} à pleines minutes coûte ${Math.round(proCost as number)} € par mois, pour un forfait vendu ${PLANS.pro.monthlyPriceEur} €`
                : null,
              diverges ? `l'environnement lu ICI dit ${want}` : null,
            ].filter(Boolean).join(' — '),
        target: got && priced && !ruinous ? got : PRICED_FOR_MODEL,
        lever: ruinous
          ? `ce modèle coûte plus qu'une minute ne rapporte: poser \`VOICE_REALTIME_MODEL=${PRICED_FOR_MODEL}\` sur RENDER, puis \`voice:validate\` et \`voice:resync -- --confirm\` depuis un poste dont le \`.env\` porte la MÊME valeur. \`npm run voice:pricing\` donne la feuille`
          : !priced
            ? `son tarif n'a jamais été relevé, donc ce que coûte la minute est INCONNU: le lire sur le tableau de bord Vapi et le poser dans \`REALTIME_RATES\`, ou revenir à \`${PRICED_FOR_MODEL}\``
            : diverges
              ? `NE PAS resynchroniser sur cette seule ligne: \`${want}\` est lu dans l'environnement de CE poste, pas dans celui de Render, et un resync écrirait \`${want}\` sur l'assistant. Vérifier d'abord lequel des deux est voulu`
              : undefined,
      });
      push({
        id: 'tiers-classic', area: 'reglages', status: 'skip',
        label: 'étages de modèle du chemin classique',
        value: `${shape}: sans objet ici, Vapi parle à OpenAI directement`,
      });
    } else
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
