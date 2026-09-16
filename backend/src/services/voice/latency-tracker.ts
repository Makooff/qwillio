/**
 * Per-stage latency measurement (chantier 1).
 *
 * `medianTurnLatencyMs` told us a turn was slow. It never told us which stage
 * was slow, which makes every tuning decision downstream a guess. This module
 * splits one turn into the three stages that can actually be acted on:
 *
 *   STT   caller stops speaking      → final transcript emitted
 *   PREP  request enters our handler → request sent to OpenAI (our server)
 *   LLM   request sent to OpenAI    → first delta written back
 *   TTS   last delta written         → assistant audio starts
 *   TTFA  first delta written        → assistant audio starts
 *
 * TTS and TTFA measure the same end, from two different starts, because clause
 * streaming makes only one of them exist at a time. When the synthesiser waits
 * for the whole completion, TTS is the number that means something. When it
 * starts speaking on the first clause — the behaviour we are trying to get —
 * the last delta has not happened yet when audio starts, so TTS has no start
 * to measure from and is simply absent. TTFA always has one.
 *
 * Keeping only TTS is what made the metric lie by omission: it reported a
 * number exactly when the pipeline was slow, and nothing at all when it was
 * fast, so the median described the bad path alone.
 *
 * The stages are measured from events we genuinely observe, not derived from
 * each other, so a missing event yields a missing stage rather than a wrong
 * number. `total` is measured independently end-to-end: it is deliberately NOT
 * the sum of the three, because the gaps between them (Vapi's own scheduling,
 * network) are exactly what we want to see when the parts do not add up.
 *
 * The LLM stage only exists on the custom-LLM path. On Vapi's own OpenAI path
 * we never see the request, so that stage stays empty — which is itself a
 * reason to keep custom-LLM on.
 */

export type LatencyStage = 'stt' | 'prep' | 'llm' | 'tts' | 'ttfa' | 'total';

export interface StageStats {
  count: number;
  median: number;
  p95: number;
  max: number;
}

export type LatencyReport = Partial<Record<LatencyStage, StageStats>>;

/** Une fenêtre mesurée, telle qu'un span la porte: un début et une fin. */
export interface TurnStageWindow {
  stage: LatencyStage;
  startedAt: number;
  endedAt: number;
}

/**
 * Le tour qui vient de se fermer, sous la forme que consomme `voice-tracing`.
 *
 * Les MÊMES bornes que les échantillons, pas un second calcul: `push()` reste
 * la seule chose qui décide qu'une mesure est plausible, et un étage écarté
 * pour cause d'événements désordonnés n'apparaît pas non plus dans la trace.
 * Deux règles de validité qui divergeraient finiraient par faire dire à la
 * trace autre chose qu'aux percentiles, sur les mêmes données.
 */
export interface TurnTrace {
  /** 1 pour le premier tour clos de l'appel. */
  turn: number;
  startedAt: number;
  endedAt: number;
  stages: TurnStageWindow[];
  /** L'audio a-t-il commencé avant le dernier jeton, `null` si LLM non vu. */
  streamed: boolean | null;
}

/** Open measurements for one call, keyed by stage. */
interface TurnMarks {
  callerSpeechEndedAt: number | null;
  transcriptFinalAt: number | null;
  llmStartedAt: number | null;
  /** Le moment où la requête PART vers OpenAI: ce qui précède est à nous. */
  llmRequestSentAt: number | null;
  llmFirstDeltaAt: number | null;
  lastDeltaAt: number | null;
}

/**
 * A single call's latency samples. One instance per live call, owned by the
 * call session — nothing here touches I/O or shared state.
 */
export class CallLatencyTracker {
  private samples: Record<LatencyStage, number[]> = { stt: [], prep: [], llm: [], tts: [], ttfa: [], total: [] };
  /**
   * How each turn's audio started, counted only on turns where we saw the LLM.
   *
   * `streamed` = audio began before the completion ended, which is LAT-5's
   * acceptance criterion stated verbatim ("first audio before the last
   * token"). Counting it is what turns that criterion from an assertion into
   * a measurement.
   */
  private turnStarts = { streamed: 0, buffered: 0 };
  /**
   * Les tours dont le modèle a répondu par un OUTIL et non par une phrase.
   * Sur ces tours, le premier son n'arrive qu'après l'outil ET le tour de
   * modèle suivant: compter leur TTFA gonflait la médiane de la synthèse
   * avec du temps d'agenda (« TTFA 3,5 s » le 16/09, alors que le son ne
   * pouvait pas partir). Ils sont comptés à part, et le TOTAL les garde:
   * c'est bien ce que l'appelant attend.
   */
  private toolTurns = 0;
  private marks: TurnMarks = {
    callerSpeechEndedAt: null,
    transcriptFinalAt: null,
    llmStartedAt: null,
    llmRequestSentAt: null,
    llmFirstDeltaAt: null,
    lastDeltaAt: null,
  };
  /** Metrics Vapi reports itself, kept alongside ours for cross-checking. */
  private vendorMetrics: Record<string, unknown> | null = null;
  /** Fenêtres du tour en cours, vidées à chaque `markCallerSpeechEnd`. */
  private windows: TurnStageWindow[] = [];
  /** Combien de tours ont été CLOS sur cet appel. Numérote les spans. */
  private closedTurns = 0;

  /** `speech-update` role=user status=stopped. Opens a turn. */
  markCallerSpeechEnd(at = Date.now()): void {
    // A new turn starts here: drop any half-finished marks from a turn that
    // never produced audio (caller interrupted themselves, call dropped).
    this.marks = {
      callerSpeechEndedAt: at,
      transcriptFinalAt: null,
      llmStartedAt: null,
      llmRequestSentAt: null,
      llmFirstDeltaAt: null,
      lastDeltaAt: null,
    };
    this.windows = [];
  }

  /** Final transcript for the caller's turn. Closes the STT stage. */
  markTranscriptFinal(at = Date.now()): void {
    if (this.marks.callerSpeechEndedAt === null) return;
    this.marks.transcriptFinalAt = at;
    this.push('stt', this.marks.callerSpeechEndedAt, at);
  }

  /** Request entered the custom-LLM handler. */
  markLlmStart(at = Date.now()): void {
    this.marks.llmStartedAt = at;
    this.marks.llmRequestSentAt = null;
  }

  /**
   * La requête part vers OpenAI. Ferme PREP: tout ce qui s'est passé depuis
   * l'entrée du handler (historique de l'appelant, blocs de prompt, lecture
   * du profil) est à nous, et se règle chez nous. Ce qui suit est le
   * fournisseur. Sans cette borne, « LLM 1,8 s » ne disait pas à qui
   * appartenait la seconde de trop.
   */
  markLlmRequestSent(at = Date.now()): void {
    if (this.marks.llmStartedAt === null || this.marks.llmRequestSentAt !== null) return;
    this.marks.llmRequestSentAt = at;
    this.push('prep', this.marks.llmStartedAt, at);
  }

  /** First token written back to Vapi. Closes the LLM stage. */
  markLlmFirstDelta(at = Date.now()): void {
    if (this.marks.llmStartedAt === null || this.marks.llmFirstDeltaAt !== null) return;
    this.marks.llmFirstDeltaAt = at;
    /* Depuis l'envoi quand il a eu lieu; depuis l'entrée sinon (tour local
       ou transfert, sans requête): le sous-milliseconde reste un tour. */
    this.push('llm', this.marks.llmRequestSentAt ?? this.marks.llmStartedAt, at);
  }

  /**
   * Le modèle a répondu par un appel d'outil: aucune phrase ne sortira de CE
   * tour, le son viendra du tour suivant. Les bornes de synthèse sont donc
   * effacées, pour que TTFA, TTS et « son parti avant la fin du texte » ne
   * mesurent que des tours qui pouvaient parler. Le total reste ouvert.
   */
  markToolTurn(): void {
    if (this.marks.llmStartedAt === null) return;
    this.toolTurns++;
    this.marks.llmStartedAt = null;
    this.marks.llmRequestSentAt = null;
    this.marks.llmFirstDeltaAt = null;
    this.marks.lastDeltaAt = null;
  }

  /** Last token of the completion — the moment TTS has everything it needs. */
  markLlmEnd(at = Date.now()): void {
    this.marks.lastDeltaAt = at;
  }

  /**
   * `speech-update` role=assistant status=started. Closes TTS and the turn.
   *
   * TTS is measured from the last delta rather than the first, because that is
   * when the synthesiser stops being blocked on text. Measuring from the first
   * delta would fold the model's generation time into the TTS number and blame
   * the wrong stage.
   */
  markAssistantSpeechStart(at = Date.now()): TurnTrace | null {
    /* TTFA first: it is the one that survives clause streaming, and the one
       the TTS-model criteria are written against ("TTFA p50 under 300ms"). */
    if (this.marks.llmFirstDeltaAt !== null) {
      this.push('ttfa', this.marks.llmFirstDeltaAt, at);
    }

    /* Which of the two shapes this turn had. Only meaningful when we saw the
       request at all: on Vapi's own OpenAI path there is no last delta to
       miss, and calling that "streamed" would invent a result. */
    let streamed: boolean | null = null;
    if (this.marks.llmStartedAt !== null) {
      if (this.marks.lastDeltaAt !== null) {
        this.turnStarts.buffered++;
        streamed = false;
        this.push('tts', this.marks.lastDeltaAt, at);
      } else {
        // Audio before the completion ended: the clause streaming worked.
        this.turnStarts.streamed++;
        streamed = true;
      }
    }

    const turnStartedAt = this.marks.callerSpeechEndedAt;
    if (turnStartedAt !== null) {
      this.push('total', turnStartedAt, at);
      this.marks.callerSpeechEndedAt = null;
    }

    /* A turn with no measured stage produced nothing worth tracing: the events
       arrived out of order, or the assistant spoke without anyone having
       spoken first — the greeting. Returning null keeps that off the trace
       instead of drawing a span nobody can act on. */
    if (!this.windows.length) return null;
    const stages = this.windows;
    this.windows = [];
    this.closedTurns++;
    return {
      turn: this.closedTurns,
      startedAt: turnStartedAt ?? Math.min(...stages.map(w => w.startedAt)),
      endedAt: at,
      stages,
      streamed,
    };
  }

  /**
   * Turns whose audio started before the completion ended, against those that
   * waited for it. LAT-5's criterion reads directly off this pair.
   */
  streamingSplit(): { streamed: number; buffered: number } {
    return { ...this.turnStarts };
  }

  /** `performanceMetrics` from the end-of-call report, when Vapi sends them. */
  attachVendorMetrics(metrics: Record<string, unknown> | null | undefined): void {
    if (metrics && typeof metrics === 'object') this.vendorMetrics = metrics;
  }

  /**
   * One measured stage: the sample AND the window it was measured over.
   *
   * Both come from the same pair of timestamps and the same plausibility rule,
   * so a stage the percentiles reject is a stage the trace does not show
   * either. Two rules would let the trace and the aggregates disagree about
   * the same call, which is worse than having no trace at all.
   */
  private push(stage: LatencyStage, from: number, to: number): void {
    const ms = to - from;
    // A negative or absurd delta means the events arrived out of order, which
    // Vapi does occasionally. Recording it would poison the percentiles.
    if (ms < 0 || ms > 60_000) return;
    this.samples[stage].push(ms);
    this.windows.push({ stage, startedAt: from, endedAt: to });
  }

  report(): LatencyReport {
    const out: LatencyReport = {};
    for (const stage of ['stt', 'prep', 'llm', 'tts', 'ttfa', 'total'] as LatencyStage[]) {
      const stats = summarise(this.samples[stage]);
      if (stats) out[stage] = stats;
    }
    return out;
  }

  /** Full payload for persistence, ours plus the vendor's. */
  snapshot(): Record<string, unknown> {
    const report = this.report();
    const out: Record<string, unknown> = { ...report };
    const { streamed, buffered } = this.turnStarts;
    /* Omitted rather than written as zeros when no turn was observed: a stored
       `0/0` reads as "streaming never worked", which is a different claim from
       "we never saw the LLM on this call". */
    if (streamed + buffered > 0) out.streaming = { streamed, buffered };
    if (this.toolTurns > 0) out.toolTurns = this.toolTurns;
    if (this.vendorMetrics) out.vendor = this.vendorMetrics;
    return out;
  }

  /**
   * One line for the log. Reads at a glance which stage owns a slow call,
   * which is the entire point of splitting them.
   */
  summaryLine(): string {
    const r = this.report();
    const part = (name: string, s?: StageStats) => (s ? `${name} ${s.median}ms (p95 ${s.p95})` : `${name} n/a`);
    const { streamed, buffered } = this.turnStarts;
    const parts = [part('STT', r.stt), part('PREP', r.prep), part('LLM', r.llm), part('TTS', r.tts), part('TTFA', r.ttfa), part('total', r.total)];
    /* Reads as « on how many turns did the first sound beat the last token »,
       which is the one thing LAT-5 asks and the one thing a median hides. */
    if (streamed + buffered > 0) parts.push(`clause-stream ${streamed}/${streamed + buffered}`);
    return parts.join(' | ');
  }
}

/**
 * Le relevé par ÉTAPE d'un appel, tel qu'il est stocké
 * (`metadata.realtime.latency`), rendu lisible pour le docteur.
 *
 * « Il est lent et pas naturel » (15/09/2026) se tranche ici et nulle part
 * ailleurs: le serveur mesurait déjà STT, LLM, TTS et le total à chaque
 * tour, mais ne les montrait que dans les journaux Render. Le docteur ne
 * lisait que le délai global à l'horloge de Vapi, qui dit QUE c'est lent,
 * jamais QUOI. Une ligne par étape, avec ce qu'elle mesure, pour qu'un
 * réglage soit choisi sur un chiffre et non sur un ressenti.
 */
export function describeStoredLatency(raw: unknown): string[] {
  const snap = (raw ?? {}) as Record<string, unknown>;
  const stage = (name: string) => snap[name] as StageStats | undefined;
  const line = (label: string, what: string, s?: StageStats) =>
    s ? `${label}: médiane ${s.median} ms, p95 ${s.p95} ms, max ${s.max} ms sur ${s.count} tour(s) · ${what}`
      : `${label}: pas de mesure · ${what}`;
  const out = [
    line('STT', 'fin de parole de l\'appelant → transcription finale (Vapi, endpointing compris)', stage('stt')),
    line('PREP', 'requête reçue → requête envoyée à OpenAI (notre serveur seul: profil, historique, blocs)', stage('prep')),
    line('LLM', stage('prep') ? 'requête envoyée → premier jeton (OpenAI seul)' : 'requête reçue → premier jeton (notre serveur + OpenAI, non séparés sur cet appel)', stage('llm')),
    line('TTFA', 'premier jeton → premier son (découpe TTS + synthèse), tours à outil exclus', stage('ttfa')),
    line('TOTAL', 'fin de parole → premier son, mesuré de bout en bout', stage('total')),
  ];
  const streaming = snap.streaming as { streamed?: number; buffered?: number } | undefined;
  if (streaming && (streaming.streamed ?? 0) + (streaming.buffered ?? 0) > 0) {
    const total = (streaming.streamed ?? 0) + (streaming.buffered ?? 0);
    out.push(`son parti avant la fin du texte: ${streaming.streamed ?? 0}/${total} tour(s)`);
  }
  const toolTurns = typeof snap.toolTurns === 'number' ? snap.toolTurns : 0;
  if (toolTurns > 0) {
    out.push(`tours répondus par un outil (agenda, fiche): ${toolTurns}, sans son propre, comptés dans TOTAL seulement`);
  }
  const tokens = snap.tokens as { input?: number; cached?: number; output?: number } | undefined;
  if (tokens && (tokens.input ?? 0) > 0) {
    const hit = Math.round(((tokens.cached ?? 0) / (tokens.input ?? 1)) * 100);
    out.push(`cache de préfixe OpenAI: ${hit} % des ${tokens.input} jetons d'entrée servis depuis le cache (${tokens.output ?? 0} en sortie)`
      + (hit === 0 ? ' · 0 % = le préfixe change entre les tours ou est trop court pour être mis en cache' : ''));
  }
  return out;
}

function summarise(values: number[]): StageStats | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
  };
}

/**
 * Nearest-rank percentile on an already-sorted array. With the handful of turns
 * in one call, interpolating between neighbours would invent precision the
 * sample size does not support.
 */
function percentile(sorted: number[], q: number): number {
  const rank = Math.ceil(q * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}
