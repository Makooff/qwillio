/**
 * Le VERDICT d'un appel, pris UN APPEL À LA FOIS.
 *
 * Tout ce qui existe aujourd'hui juge une SEMAINE : `receptionist-learning`
 * refuse de conclure sous huit appels et regarde sept jours en arrière, et
 * `call-intelligence` ne juge que la prospection sortante. Conséquence : l'appel
 * qui a mal tourné — l'outil d'agenda en panne, l'appelant qui n'a rien entendu,
 * le rendez-vous écrit sans nom — est invisible jusqu'au dimanche suivant, et
 * encore : noyé dans des moyennes où dix bons appels effacent un mauvais.
 * C'est exactement l'appel qu'on veut réparer, et c'est le seul que personne
 * ne relit.
 *
 * Ce module ne fait QUE juger : aucune I/O, aucun modèle, aucun horaire. Il
 * rend un verdict lisible par une machine et une phrase lisible par un humain.
 * La décision d'agir (écrire une proposition de correctif, prévenir, attendre)
 * appartient à `call-postmortem.service`, et c'est volontaire : une fonction
 * pure se teste sur les transcripts réels, et un test qui passe reste le seul
 * endroit où une règle de diagnostic ne ment pas.
 *
 * Il lit les DEUX formes de métriques que le dépôt produit, parce qu'elles
 * n'ont jamais été unifiées :
 *   - chemin Vapi    : `metadata.realtime` (callerTurns, hardBargeIns, toolCalls,
 *                      llmFailures, latency.{stage}.p95)
 *   - chemin voice-core : `metadata.latency` (tours, total_p95, arrets_pour_rien…)
 * Une lecture qui ne connaîtrait que la première rendrait un verdict « tout va
 * bien » sur cent pour cent des appels voice-core, ce qui est pire qu'aucun
 * verdict : personne ne va vérifier un voyant vert.
 */

export type MortemCode =
  /** Un outil a rendu une erreur pendant l'appel. */
  | 'tool_failed'
  /** Le tour est parti en phrase de repli : le modèle n'a pas répondu. */
  | 'model_failed'
  /** L'appel a duré, et il n'y a rien à lire : personne n'a parlé. */
  | 'dead_line'
  /** Un rendez-vous est sorti de l'appel, sans nom d'appelant. */
  | 'booking_without_name'
  /** L'appelant s'est engagé (4 tours et plus) et l'appel n'a rien produit. */
  | 'engaged_then_lost'
  /** L'agent a parlé par-dessus l'appelant, sur de vraies phrases. */
  | 'agent_talks_over'
  /** La fin de tour a fait attendre l'appelant. */
  | 'slow_turns'
  /** L'agent a dû chercher une réponse : elle manquait dans le prompt. */
  | 'knowledge_lookup'
  /** L'appelant n'était pas satisfait — lu dans l'analyse du transcript. */
  | 'caller_unhappy';

export type Verdict = 'ok' | 'watch' | 'broken';

export interface CallPostMortem {
  verdict: Verdict;
  codes: MortemCode[];
  /** Ce qui a été MESURÉ, chiffre par chiffre. Jamais une conclusion. */
  evidence: string[];
  /** Vrai quand la réparation appartient au code, pas à la configuration. */
  needsDeveloper: boolean;
  /** Ce que le client a à faire, quand c'est à lui. Sinon null. */
  clientAction: string | null;
}

/** Ce qu'un appel terminé porte, réduit à ce qui juge. */
export interface CallSignals {
  transcript: string | null;
  outcome: string | null;
  /** Le sentiment rendu par l'analyse du transcript : l'appelant était-il satisfait. */
  sentiment: string | null;
  callerName: string | null;
  isLead: boolean;
  bookingRequested: boolean;
  /** La date du rendez-vous, sur la LIGNE — pas dans `metadata`. */
  bookingDate?: Date | string | null;
  durationSeconds: number | null;
  metadata: Record<string, any> | null;
}

/** Les issues qui veulent dire « l'appel n'a rien produit ». */
const NOTHING_PRODUCED = new Set(['missed', 'other']);

/**
 * En dessous, l'appel n'a pas eu le temps d'échouer : un appelant qui raccroche
 * en deux secondes n'accuse personne. Au-dessus, un transcript vide est une
 * ligne muette, et c'est ce que `dead-call-watch` surveille en série. Ici on
 * nomme L'APPEL, parce qu'une série dit qu'il y a une panne et pas lesquels des
 * appels elle a coûtés.
 */
const DEAD_LINE_MIN_SECONDS = 5;

/** Interruptions de vraies phrases, dans UN appel, au-delà desquelles c'est trop. */
const TALK_OVER_PER_CALL = 2;

/** Fin de tour au-delà de laquelle l'attente s'entend. */
const SLOW_TURN_MS = 900;

/** Tours appelant à partir desquels l'appel était engagé, donc réparable. */
const ENGAGED_TURNS = 4;

/**
 * Les métriques des deux chemins, ramenées à une seule lecture.
 *
 * `undefined` et non `0` quand le chiffre n'existe pas : un zéro inventé
 * déclencherait un code sur un appel où la mesure n'a jamais eu lieu, et c'est
 * la faute que ce dépôt a déjà payée plusieurs fois.
 */
interface Normalised {
  source: 'vapi' | 'voice-core' | 'unknown';
  callerTurns?: number;
  hardBargeIns?: number;
  totalP95?: number;
  mood?: string;
  toolErrors: string[];
  llmFailures: string[];
  toolCalls: Array<{ name: string; ms: number }>;
  liveBooking: boolean;
}

export function readSignals(metadata: Record<string, any> | null): Normalised {
  const m = metadata ?? {};
  const rt = m.realtime as Record<string, any> | undefined;
  const vc = m.latency as Record<string, any> | undefined;
  const source = m.source === 'voice-core' ? 'voice-core' : rt ? 'vapi' : 'unknown';

  const calls: Array<{ name: string; ms: number }> = Array.isArray(rt?.toolCalls) ? rt!.toolCalls : [];

  return {
    source,
    /* `tours` côté voice-core compte les tours de l'AGENT, pas de l'appelant,
       et les deux ne se confondent pas : l'agent parle une fois par question
       posée plus ses relances. On ne le fait donc PAS passer pour
       `callerTurns` — un chiffre faux vaut moins qu'un chiffre absent. */
    callerTurns: typeof rt?.callerTurns === 'number' ? rt.callerTurns : undefined,
    hardBargeIns: typeof rt?.hardBargeIns === 'number' ? rt.hardBargeIns : undefined,
    totalP95:
      typeof rt?.latency?.total?.p95 === 'number'
        ? rt.latency.total.p95
        : typeof vc?.total_p95 === 'number'
          ? vc.total_p95
          : undefined,
    mood: typeof rt?.mood === 'string' ? rt.mood : undefined,
    toolErrors: calls.filter(c => c.name.endsWith(':error')).map(c => c.name.replace(':error', '')),
    llmFailures: Array.isArray(rt?.llmFailures) ? rt!.llmFailures : [],
    toolCalls: calls.filter(c => !c.name.endsWith(':error')),
    liveBooking: Boolean(rt?.bookingId),
  };
}

/**
 * Le verdict. Les codes de DEVELOPPEUR passent avant : réparer un outil cassé
 * change plus d'appels que raccourcir une réponse.
 */
export function postMortemOf(call: CallSignals): CallPostMortem {
  const s = readSignals(call.metadata);
  const codes: MortemCode[] = [];
  const evidence: string[] = [];
  let clientAction: string | null = null;

  // ── Ce qui appartient au code ────────────────────────────────────────────

  if (s.toolErrors.length) {
    const byTool = new Map<string, number>();
    for (const name of s.toolErrors) byTool.set(name, (byTool.get(name) ?? 0) + 1);
    codes.push('tool_failed');
    evidence.push(
      `outil en erreur: ${[...byTool.entries()].map(([n, c]) => `${n} x${c}`).join(', ')}`,
    );
  }

  if (s.llmFailures.length) {
    codes.push('model_failed');
    evidence.push(`replis du modèle: ${[...new Set(s.llmFailures)].slice(0, 3).join(' | ')}`);
  }

  const transcript = String(call.transcript ?? '');
  if (!transcript.trim() && (call.durationSeconds ?? 0) >= DEAD_LINE_MIN_SECONDS) {
    codes.push('dead_line');
    evidence.push(`aucun mot pour ${call.durationSeconds ?? 0} s d'appel`);
  }

  /* Un rendez-vous SANS nom : la famille qui a déjà écrit trois rendez-vous au
     nom de l'agent. Ici le nom manque franchement, ce qui est la forme
     réparable — un nom FAUX demande la table des prénoms de l'agent, qui vit
     dans client-call.service et ne se devine pas d'ici. */
  const gotBooking = s.liveBooking || (call.bookingRequested && Boolean(call.bookingDate));
  if (gotBooking && !String(call.callerName ?? '').trim()) {
    codes.push('booking_without_name');
    evidence.push('un rendez-vous est sorti de cet appel sans nom d\'appelant');
  }

  // ── Ce qui se règle chez le client, ou se surveille ──────────────────────

  if (call.outcome && NOTHING_PRODUCED.has(call.outcome) && (s.callerTurns ?? 0) >= ENGAGED_TURNS) {
    codes.push('engaged_then_lost');
    evidence.push(`rien produit après ${s.callerTurns} tours d'appelant (issue « ${call.outcome} »)`);
    clientAction = 'L\'appelant était engagé et l\'appel n\'a rien donné. Écouter ce transcript et compléter la base de connaissances.';
  }

  if ((s.hardBargeIns ?? 0) >= TALK_OVER_PER_CALL) {
    codes.push('agent_talks_over');
    evidence.push(`${s.hardBargeIns} interruptions d'une vraie phrase`);
  }

  if ((s.totalP95 ?? 0) > SLOW_TURN_MS) {
    codes.push('slow_turns');
    evidence.push(`latence de fin de tour p95 ${s.totalP95} ms`);
  }

  if (s.toolCalls.some(c => c.name.startsWith('lookupKnowledge'))) {
    codes.push('knowledge_lookup');
    evidence.push('l\'agent a dû chercher une réponse en cours d\'appel');
    clientAction ??= 'Une question a nécessité une recherche : la déplacer dans le prompt la rendra instantanée.';
  }

  /* ── Ce que l'appelant a ressenti ─────────────────────────────────────────
     La seule lecture du CONTENU de l'appel dans ce module, et elle ne coûte
     rien : `sentiment` et `outcome` sortent déjà de l'analyse du transcript
     qui tourne sur CHAQUE appel (`client-call.service`, un modèle par appel).
     On relit donc un verdict de modèle déjà rangé sur la ligne, on n'en
     demande pas un second — c'est le seul modèle qu'on a le droit de lire
     gratuitement.

     Payé le 08/10/2026, et c'est un défaut de conception de ce module :
     `complaint` n'est ni `missed` ni `other`, donc l'appel le plus mécontent
     de la journée ressortait `ok`, et `sentiment` n'était même pas lu. Un
     voyant vert posé précisément sur l'appel qu'il fallait aller écouter.

     Volontairement SANS condition sur les tours d'appelant : `callerTurns`
     n'existe pas sur le chemin voice-core (il n'est jamais inventé, voir
     `readSignals`), et une condition qui ne peut être vraie que d'un côté est
     un voyant vert de l'autre côté.

     `watch` et jamais `broken` : un restaurant reçoit de vraies réclamations.
     En faire des propositions de correctif noierait le salon et apprendrait à
     ignorer les alertes. Ici l'action utile est celle du gérant — écouter. */
  const complained = call.outcome === 'complaint';
  const unhappy = String(call.sentiment ?? '').toLowerCase() === 'negative';
  if (complained || unhappy) {
    codes.push('caller_unhappy');
    evidence.push(complained ? 'issue « réclamation »' : 'appelant mécontent (sentiment négatif)');
    clientAction ??=
      'L\'appelant n\'était pas satisfait. Écouter ce transcript, et le rappeler si l\'appel le justifie.';
  }

  const needsDeveloper = codes.some(c =>
    c === 'tool_failed' || c === 'model_failed' || c === 'dead_line' || c === 'booking_without_name',
  );
  const verdict: Verdict = needsDeveloper ? 'broken' : codes.length ? 'watch' : 'ok';

  return {
    verdict,
    codes,
    evidence,
    needsDeveloper,
    /* Un appel « broken » peut n'avoir AUCUNE action client (une ligne muette
       n'est pas la faute de l'appelant). On ne fabrique pas de conseil pour
       remplir un champ. */
    clientAction: needsDeveloper && codes.length === 1 ? null : clientAction,
  };
}
