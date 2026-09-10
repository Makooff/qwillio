import { logger } from '../../config/logger';
import type { LatencyStage } from './latency-tracker';
import type { TurnTrace } from './latency-tracker';

/**
 * Spans OpenTelemetry pour le pipeline vocal (TST-7).
 *
 * Ce que les agrégats ne peuvent pas dire
 * ───────────────────────────────────────
 * `latency-tracker` rend une MÉDIANE par appel et `voice-metrics` des
 * percentiles de flotte. Les deux répondent à « la flotte a-t-elle ralenti ? »
 * et à aucune des questions qu'on se pose vraiment quand un client rappelle:
 * « sur CET appel, à CE tour, quel étage a pris les 2,4 s ? ». Un percentile
 * n'a pas de tour, pas d'appel et pas d'ordre; il ne se remonte pas jusqu'à un
 * incident. Une trace, si.
 *
 * Retroactif, et pourquoi
 * ───────────────────────
 * Les spans ne sont PAS ouverts en direct autour du code du tour. Le pipeline
 * est un flux d'événements Vapi (`speech-update`, transcript, deltas) qui
 * n'ont ni pile d'appel ni contexte commun: envelopper le tour demanderait de
 * porter un contexte OTel à travers un webhook, un flux SSE et un pool de
 * promesses, pour instrumenter du code qui n'attend rien. Les marques sont
 * donc relevées comme aujourd'hui, sans coût, et le span est CRÉÉ à la
 * fermeture du tour avec ses horodatages explicites (`startTime` / `end(at)`).
 * La trace est identique, la mesure ne bouge pas d'une milliseconde, et le
 * chemin chaud ne gagne pas une allocation.
 *
 * Conventions
 * ───────────
 * Les conventions OpenTelemetry pour la voix N'EXISTENT PAS: chaque éditeur
 * invente les siennes. Deux registres, donc, et jamais mélangés:
 *   - `gen_ai.*`, la convention OFFICIELLE, pour ce qu'elle couvre déjà: le
 *     modèle et les outils (`gen_ai.operation.name`, `gen_ai.system`,
 *     `gen_ai.request.model`, `gen_ai.usage.*`, `gen_ai.tool.name`).
 *   - `qwillio.voice.*`, préfixé maison, pour ce qu'elle ne couvre pas: STT,
 *     TTS, TTFA, barge-in, SIP. Le préfixe est ce qui rend la bascule
 *     mécanique le jour où une convention sort: on renomme un préfixe, on ne
 *     démêle pas des attributs qui se seraient fait passer pour standard.
 *
 * Ce qui n'entre JAMAIS dans un span
 * ──────────────────────────────────
 * Aucun transcript, aucun texte d'énoncé, aucun argument d'outil, aucun numéro
 * d'appelant. Une trace part chez un tiers (collecteur, éditeur APM) qui n'est
 * pas dans le périmètre de traitement du client: y verser une conversation
 * serait une divulgation, pas une observabilité. Les spans ne portent que des
 * durées, des compteurs et des identifiants techniques. `clientId` est un
 * identifiant interne et reste, sinon la trace ne se remonte à personne.
 *
 * Éteint par défaut
 * ─────────────────
 * Sans `OTEL_EXPORTER_OTLP_ENDPOINT`, ce module ne charge même pas le SDK:
 * chaque méthode retourne immédiatement. C'est voulu — la production n'a pas de
 * collecteur aujourd'hui, et une dépendance qui s'initialise « au cas où »
 * finit par coûter au démarrage d'un service qui redéploie plusieurs fois par
 * jour.
 */

/** Nom du tracer, et préfixe des attributs maison. */
const TRACER_NAME = 'qwillio.voice';
const NS = 'qwillio.voice';

/** Ce que porte un span d'étage, par étage. */
const STAGE_SPAN: Record<LatencyStage, string> = {
  stt: `${NS}.stt`,
  llm: 'chat', // gen_ai: le nom du span est l'opération, pas un chemin maison
  tts: `${NS}.tts`,
  ttfa: `${NS}.ttfa`,
  total: `${NS}.turn.total`,
};

export interface CallSpanInput {
  vapiCallId: string;
  clientId: string;
  language: string;
  /** `true` speech-to-speech, `false` classique, `null` pas encore tranché. */
  speechToSpeech?: boolean | null;
  at?: number;
}

export interface ToolSpanInput {
  name: string;
  startedAt: number;
  endedAt: number;
  ok: boolean;
}

export interface TurnSpanExtras {
  /** Modèle réellement servi sur ce tour, quand on le connaît. */
  model?: string | null;
  tokens?: { input: number; cached: number; output: number } | null;
  /** L'appelant a-t-il coupé l'agent pendant ce tour. */
  bargeIn?: boolean;
}

/* Le SDK n'est jamais importé statiquement: voir « Éteint par défaut ». Les
   types sont volontairement larges, ce module ne dépend d'aucun d'eux à la
   compilation. */
type AnySpan = {
  setAttribute(key: string, value: string | number | boolean): unknown;
  setStatus(status: { code: number; message?: string }): unknown;
  end(at?: number): void;
  spanContext(): unknown;
};
type AnyTracer = {
  startSpan(name: string, options?: Record<string, unknown>, context?: unknown): AnySpan;
};

/** Codes `SpanStatusCode`, recopiés pour ne pas importer le SDK. */
const STATUS_ERROR = 2;

class VoiceTracing {
  private tracer: AnyTracer | null = null;
  private enabled = false;
  private provider: { forceFlush(): Promise<void>; shutdown(): Promise<void> } | null = null;
  /** Un span racine par appel en cours, et le contexte pour l'y rattacher. */
  private calls = new Map<string, { span: AnySpan; context: unknown; turns: number }>();
  private api: typeof import('@opentelemetry/api') | null = null;

  /**
   * Démarre l'export. Idempotent, et silencieux quand rien n'est configuré.
   *
   * Async parce que le SDK est importé dynamiquement: l'appelant peut ignorer
   * la promesse, l'instrumentation s'allumera simplement un instant plus tard,
   * et les appels reçus avant restent des no-ops plutôt que des erreurs.
   */
  async init(options: { endpoint: string; serviceName: string; headers?: string }): Promise<void> {
    if (this.enabled || !options.endpoint) return;
    try {
      const [api, sdk, otlp, resources] = await Promise.all([
        import('@opentelemetry/api'),
        import('@opentelemetry/sdk-trace-node'),
        import('@opentelemetry/exporter-trace-otlp-http'),
        import('@opentelemetry/resources'),
      ]);

      const exporter = new otlp.OTLPTraceExporter({
        url: options.endpoint,
        headers: parseHeaders(options.headers),
      });
      const provider = new sdk.NodeTracerProvider({
        resource: resources.resourceFromAttributes({
          'service.name': options.serviceName,
        }),
        spanProcessors: [new sdk.BatchSpanProcessor(exporter)],
      });
      provider.register();

      this.api = api;
      this.tracer = provider.getTracer(TRACER_NAME) as unknown as AnyTracer;
      this.provider = provider;
      this.enabled = true;
      logger.info(`[VoiceTracing] spans OTLP vers ${options.endpoint}`);
    } catch (error) {
      /* Une trace absente ne doit jamais coûter un appel: on renonce et on le
         dit une fois, plutôt que de laisser le service refuser de démarrer. */
      logger.warn(`[VoiceTracing] désactivé, initialisation impossible: ${(error as Error).message}`);
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Span racine de l'appel. Tout le reste s'y rattache. */
  startCall(input: CallSpanInput): void {
    if (!this.enabled || !this.tracer || !this.api) return;
    try {
      const span = this.tracer.startSpan(`${NS}.call`, {
        startTime: input.at ?? Date.now(),
        attributes: {
          [`${NS}.call_id`]: input.vapiCallId,
          [`${NS}.client_id`]: input.clientId,
          [`${NS}.language`]: input.language,
          ...(typeof input.speechToSpeech === 'boolean'
            ? { [`${NS}.speech_to_speech`]: input.speechToSpeech }
            : {}),
        },
      });
      const context = this.api.trace.setSpan(this.api.context.active(), span as never);
      this.calls.set(input.vapiCallId, { span, context, turns: 0 });
    } catch (error) {
      logger.debug(`[VoiceTracing] startCall: ${(error as Error).message}`);
    }
  }

  /**
   * Un tour fermé: un span parent, et un span par étage MESURÉ.
   *
   * Un étage sans mesure n'existe pas dans la trace. Écrire un span à zéro
   * pour un étage qu'on n'a pas vu (le LLM sur le chemin OpenAI de Vapi, TTS
   * sur un tour en streaming de clauses) affirmerait une mesure qui n'a pas eu
   * lieu, et c'est exactement le mensonge que `latency-tracker` évite déjà.
   */
  recordTurn(vapiCallId: string | null, trace: TurnTrace | null, extras: TurnSpanExtras = {}): void {
    if (!this.enabled || !this.tracer || !trace || !vapiCallId) return;
    const call = this.calls.get(vapiCallId);
    try {
      const turnIndex = call ? ++call.turns : trace.turn;
      const turn = this.tracer.startSpan(
        `${NS}.turn`,
        {
          startTime: trace.startedAt,
          attributes: {
            [`${NS}.turn.index`]: turnIndex,
            [`${NS}.call_id`]: vapiCallId,
            ...(trace.streamed === null ? {} : { [`${NS}.turn.clause_streamed`]: trace.streamed }),
            ...(extras.bargeIn ? { [`${NS}.turn.barge_in`]: true } : {}),
          },
        },
        call?.context,
      );
      const turnContext = this.api
        ? this.api.trace.setSpan(this.api.context.active(), turn as never)
        : undefined;

      for (const stage of trace.stages) {
        const span = this.tracer.startSpan(
          STAGE_SPAN[stage.stage],
          { startTime: stage.startedAt, attributes: this.stageAttributes(stage.stage, extras) },
          turnContext,
        );
        span.end(stage.endedAt);
      }

      turn.end(trace.endedAt);
    } catch (error) {
      logger.debug(`[VoiceTracing] recordTurn: ${(error as Error).message}`);
    }
  }

  /** Un appel d'outil, sous la convention GenAI `execute_tool`. */
  recordTool(vapiCallId: string | null, input: ToolSpanInput): void {
    if (!this.enabled || !this.tracer) return;
    try {
      const call = vapiCallId ? this.calls.get(vapiCallId) : null;
      const span = this.tracer.startSpan(
        `execute_tool ${input.name}`,
        {
          startTime: input.startedAt,
          attributes: {
            'gen_ai.operation.name': 'execute_tool',
            'gen_ai.tool.name': input.name,
            'gen_ai.tool.type': 'function',
          },
        },
        call?.context,
      );
      if (!input.ok) span.setStatus({ code: STATUS_ERROR, message: 'tool failed' });
      span.end(input.endedAt);
    } catch (error) {
      logger.debug(`[VoiceTracing] recordTool: ${(error as Error).message}`);
    }
  }

  /** Ferme le span racine. Sans lui, l'appel reste ouvert jusqu'au batch. */
  endCall(vapiCallId: string | null, meta: { at?: number; endedReason?: string | null } = {}): void {
    if (!vapiCallId) return;
    const call = this.calls.get(vapiCallId);
    if (!call) return;
    this.calls.delete(vapiCallId);
    try {
      if (meta.endedReason) call.span.setAttribute(`${NS}.ended_reason`, meta.endedReason);
      call.span.setAttribute(`${NS}.turns`, call.turns);
      call.span.end(meta.at ?? Date.now());
    } catch (error) {
      logger.debug(`[VoiceTracing] endCall: ${(error as Error).message}`);
    }
  }

  /**
   * Vide le lot en attente SANS fermer l'exportateur.
   *
   * Séparé de `shutdown()` de propos délibéré: `provider.shutdown()` éteint
   * l'exportateur pour de bon, et un « flush » qui rendrait l'instrumentation
   * muette pour le reste de la vie du process est un piège qu'on ne remarque
   * qu'en cherchant les traces qui manquent.
   */
  async flush(): Promise<void> {
    if (!this.provider) return;
    try {
      await this.provider.forceFlush();
    } catch (error) {
      logger.debug(`[VoiceTracing] flush: ${(error as Error).message}`);
    }
  }

  /** Vide puis ferme. À l'extinction du process, et nulle part ailleurs. */
  async shutdown(): Promise<void> {
    const provider = this.provider;
    if (!provider) return;
    this.provider = null;
    this.enabled = false;
    try {
      await provider.shutdown();
    } catch (error) {
      logger.debug(`[VoiceTracing] shutdown: ${(error as Error).message}`);
    }
  }

  private stageAttributes(stage: LatencyStage, extras: TurnSpanExtras): Record<string, string | number | boolean> {
    if (stage !== 'llm') return { [`${NS}.stage`]: stage };
    /* Seul l'étage LLM est couvert par la convention officielle, donc seul lui
       la porte. Les autres restent sous le préfixe maison. */
    const attrs: Record<string, string | number | boolean> = {
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': 'openai',
      [`${NS}.stage`]: stage,
    };
    if (extras.model) attrs['gen_ai.request.model'] = extras.model;
    if (extras.tokens) {
      attrs['gen_ai.usage.input_tokens'] = extras.tokens.input;
      attrs['gen_ai.usage.output_tokens'] = extras.tokens.output;
      if (extras.tokens.cached) attrs[`${NS}.tokens.cached`] = extras.tokens.cached;
    }
    return attrs;
  }
}

/**
 * `a=b,c=d` → objet. C'est la forme d'`OTEL_EXPORTER_OTLP_HEADERS`, telle que
 * la spécification l'écrit, et c'est ainsi que les collecteurs hébergés
 * demandent leur clé d'API.
 */
export function parseHeaders(raw?: string): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

export const voiceTracing = new VoiceTracing();
