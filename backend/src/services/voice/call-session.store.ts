import { logger } from '../../config/logger';
import { CallLatencyTracker } from './latency-tracker';
import type { VoiceLanguage } from './speech-plans';
import type { CallerMood } from './caller-mood';
import { newRepairState, recoveryLine, type RepairState } from './conversational-repair';
import { isFalseCut } from './false-cut';
import { voiceTracing } from './voice-tracing';
import type { DbRoundTrip } from './db-round-trip';

/**
 * In-process state for calls that are currently on the line (Phase 1.3).
 *
 * The old pipeline wrote to Postgres on every partial transcript event:
 *
 *     case 'transcript':
 *       await prisma.call.updateMany({ where: { vapiCallId }, data: { transcript } })
 *
 * At two to five transcript events per second per call, that is a database
 * round-trip inside the webhook's response path, on a Neon instance that may be
 * cold. It bought nothing — the full transcript arrives again in
 * `end-of-call-report` — and it was the single largest source of webhook
 * latency, which back-pressures the whole streaming channel.
 *
 * Live state now lives here and is flushed once, at the end of the call.
 * Losing this state on a process restart is acceptable: the end-of-call report
 * is authoritative and replays the entire transcript.
 */

export interface LeadCapture {
  name: string | null;
  email: string | null;
  /**
   * Le numéro où RAPPELER, validé, quand il y en a un.
   *
   * Il manquait, et c'est ce qui perdait le numéro dicté en route. `captureLead`
   * le validait, le faisait gagner sur l'identifiant d'appelant et l'écrivait
   * au CRM, puis posait dans la session un lead qui ne le portait pas. Le SMS
   * et l'e-mail, qui lisent CE lead, retombaient donc sur l'identifiant
   * d'appelant, c'est-à-dire sur la ligne d'où l'appel partait et non sur celle
   * où l'appelant a demandé qu'on le rappelle.
   */
  phone: string | null;
  reason: string;
  urgency: string;
}

export interface CallSession {
  vapiCallId: string;
  clientId: string;
  callerNumber: string | null;
  startedAt: number;
  language: VoiceLanguage;
  /** Row id once the call has been persisted, for tools that link to it. */
  clientCallId: string | null;
  /**
   * Le moteur RÉELLEMENT retenu pour cet appel, décidé par `buildSpeech`.
   *
   * C'est une donnée de facturation, pas un réglage: le temps réel se vend au
   * supplément, et une voix clonée force le classique même quand le client a
   * choisi le temps réel. Facturer le réglage surfacturerait donc tout client
   * ayant enregistré sa voix. `null` tant que l'assistant n'est pas construit.
   */
  speechToSpeech: boolean | null;
  /**
   * L'annonce IA a-t-elle été prononcée sur cet appel (LEG-1) ?
   *
   * Consignée par appel parce que le critère l'exige, et parce qu'autrement
   * « l'annonce a-t-elle été faite » ne se répond qu'en réécoutant l'audio,
   * c'est-à-dire jamais.
   */
  disclosureSpoken: boolean | null;
  /** Rolling transcript, appended per final utterance. */
  transcript: string[];
  /** How many caller turns we have seen — drives first-turn intent rules. */
  callerTurns: number;
  /** Turns answered by the intent router without touching the LLM. */
  deflectedTurns: number;
  /** Times the caller cut the assistant off. High counts mean bad pacing. */
  bargeIns: number;
  toolCalls: Array<{ name: string; ms: number }>;
  /**
   * L'aller-retour vers notre propre base, sondé à l'ouverture de l'appel.
   *
   * Il voyage avec les métriques parce qu'il ne se lit QUE depuis le processus
   * qui a servi l'appel: le backend est déclaré en `oregon` et l'URL de
   * production nomme `us-east-1`, mais cette URL vit dans l'environnement de
   * Render, et un audit lancé depuis un poste lirait le `.env` de ce poste
   * (6duotrigesies, 6quinquesexagesies). Voir `db-round-trip.ts`.
   */
  dbRoundTrip: DbRoundTrip | null;
  /**
   * Combien de fois un outil a échoué de la MÊME façon sur cet appel.
   *
   * Clé = `outil:raison`. Ce compteur existe parce qu'un résultat d'outil qui
   * dit « demande le nom, puis rappelle-moi » invite le rappel, et que rien ne
   * comptait les tentatives: le 16/09/2026, `rescheduleBooking` a été appelé
   * NEUF fois avec les mêmes arguments, chacune de 2,4 à 9,4 secondes, pendant
   * que l'appelant entendait « je déplace votre rendez-vous » à chaque tour.
   *
   * C'est la leçon 6septies, déjà payée sur les numéros dictés, appliquée aux
   * outils: au deuxième échec identique on change de canal, on ne refait pas ce
   * qui vient de rater deux fois. La cause (nom introuvable, réservation
   * inexistante) ne bouge pas entre deux essais.
   */
  toolFailures: Record<string, number>;
  lead: LeadCapture | null;
  /** AgentCrmActivity row created for the lead, linked to the call at the end. */
  leadActivityId: string | null;
  bookingId: string | null;
  /**
   * La réservation ANNULÉE en direct par l'outil.
   *
   * Elle existe pour une raison précise: le post-appel relit la transcription
   * et crée une ligne dès qu'il y voit un rendez-vous demandé. Un appelant qui
   * ANNULE parle forcément de son rendez-vous, donc sans ce drapeau il
   * repartait avec une réservation toute neuve, à la date qu'il venait de
   * libérer, et un SMS de confirmation pour aller avec. C'est le doublon du
   * 12/09/2026 (6trigesies) retourné, et il se ferme au même endroit.
   */
  cancelledBookingId: string | null;
  /** ms between the caller's last word and the assistant's first audio. */
  turnLatencies: number[];
  lastCallerSpeechEndedAt: number | null;
  /** Per-stage timings (STT / LLM / TTS), owned by the call. */
  latency: CallLatencyTracker;
  /** When the assistant started its current utterance, null when silent. */
  assistantSpeakingSince: number | null;
  /** Interruptions that cut a substantive utterance, not a backchannel. */
  hardBargeIns: number;
  /**
   * Les fois où c'est l'AGENT qui a coupé l'appelant (TUR-13).
   *
   * L'autre sens des deux compteurs au-dessus, et le côté cher de l'arbitrage:
   * 250 ms de silence en trop se pardonnent, se faire couper la parole non.
   * Sans ce compte, le seuil d'endpointing se règle à l'oreille.
   */
  falseCuts: number;
  /** Live read on how the caller sounds — drives register, never permissions. */
  mood: CallerMood;
  /** Token accounting, so the prompt cache is verified rather than assumed. */
  tokens: { input: number; cached: number; output: number };
  /**
   * Le modèle qui a RÉELLEMENT servi chaque tour, tel qu'OpenAI le nomme dans
   * son flux (`gpt-4.1-mini-2025-04-14`), compté par nom. Ce n'est pas ce que
   * l'assistant enregistré porte chez Vapi: sur custom-LLM ce champ est
   * décoratif, le modèle se choisit ici à chaque tour depuis l'environnement
   * de Render. Sans ce relevé, « est-ce que gpt-4.1-mini tourne vraiment ? »
   * n'a pas de réponse, seulement une lecture de variable.
   */
  models: Record<string, number>;
  /** Chaque tour parti en phrase de repli, avec la raison: « OpenAI responded 429 », délai au premier jeton… */
  llmFailures: string[];
  /**
   * LE BRIEF D'OUVERTURE A-T-IL ATTEINT L'APPEL ? `null` = pas encore tenté.
   *
   * Le mécanisme pose la mémoire de l'appelant et ses rendez-vous dans la
   * session temps réel, par `add-message`. Il n'avait aucune trace lisible
   * après coup, et le retour du 17/09 — « il me redemande mon nom à chaque
   * fois alors que c'est relié à mon numéro » — ne permettait pas de trancher
   * entre « le brief n'est pas parti » et « le modèle l'ignore ». Ce sont deux
   * pannes différentes et deux correctifs opposés.
   *
   * La règle du dépôt: un mécanisme qui n'a jamais été VU atteindre un appel
   * réel n'est pas prouvé (6octovicies, 6quinquetrigesies).
   */
  callBrief: string | null;
  /**
   * Combien de fois le numéro dicté n'a rien donné, sur CET appel (BEL-4).
   *
   * Par appel et non par tour: c'est la répétition de l'échec qui décide de
   * passer au clavier, et un compteur remis à zéro à chaque tentative ne
   * compterait jamais jusqu'à deux. Il ne redescend pas non plus après un
   * succès: un appelant qui a raté deux fois puis réussi n'a plus à être
   * renvoyé au clavier, mais le fait qu'il ait ramé reste vrai pour la suite
   * de l'appel.
   */
  phoneCaptureFailures: number;
  /**
   * Le dernier numéro pour lequel une RELECTURE a déjà été demandée, ou `null`.
   *
   * Un numéro qui passe la validation peut être faux: « zéro quatre sept cinq
   * douze trente-quatre cinquante-six » transcrit avec un chiffre de travers
   * reste un mobile belge parfaitement valide, donc rien ne le signale, et le
   * rappel part sur la mauvaise ligne. Seule la relecture à l'appelant lève ce
   * doute, et elle ne se demande qu'UNE fois par numéro: l'agent rappelle
   * `captureLead` avec le même numéro pour confirmer, et lui redemander de
   * relire à ce moment-là ferait tourner les deux en boucle.
   */
  phoneReadBack: string | null;
  /** Le nom déjà relu à l'appelant dans cet appel (minuscules), pour ne le relire qu'une fois. */
  nameReadBack: string | null;
  /** L'épellation du nom de famille a déjà été demandée à cet appelant inconnu. */
  nameSpellingAsked: boolean;
  /**
   * L'agent a-t-il été coupé au milieu d'une VRAIE phrase, sans avoir encore
   * repris la parole depuis ? Posé par `recordBargeIn`, consommé au tour
   * suivant.
   *
   * Un drapeau et pas un compteur: ce qui compte est « le dernier tour a-t-il
   * été cassé », pas combien de fois l'appel l'a été. Le compte, avec sa
   * retenue, vit dans `repair`.
   */
  pendingHardBargeIn: boolean;
  /**
   * Depuis combien de MILLISECONDES l'agent parlait quand il a été coupé, ou
   * `null` (TUR-9).
   *
   * Séparé de `pendingHardBargeIn` bien que posé par le même événement: les
   * deux sont consommés par des étapes différentes du tour suivant, et un
   * drapeau partagé ferait dépendre la troncature de l'ordre dans lequel la
   * phrase de reprise a été lue.
   */
  interruptedSpeechMs: number | null;
  /** La retenue de la phrase de reprise: au plus deux par appel, jamais deux d'affilée. */
  repair: RepairState;
  /**
   * L'adresse de CONTRÔLE de l'appel, retenue dès qu'un événement la porte.
   *
   * C'est par elle que passe tout ce qu'on dit au modèle PENDANT l'appel
   * (`add-message`), et elle ne vit que dans l'événement de Vapi. Le brief
   * d'ouverture la lisait sur l'événement qu'il tenait; un message posé plus
   * tard n'a pas cette chance, et « SANS ADRESSE DE CONTROLE » est un mode
   * d'échec déjà relevé. Retenue ici, elle survit à un événement qui ne la
   * porte pas.
   */
  controlUrl: string | null;
  /**
   * L'issue du bloc d'HUMEUR posé en cours d'appel, ou `null` s'il n'y avait
   * rien à poser. Même rôle que `callBrief`: un mécanisme qui n'a jamais été
   * VU atteindre un appel réel n'est pas prouvé (6octovicies).
   */
  moodNudge: string | null;
}

/** A slot promised on a live call, so a parallel call cannot double-book it. */
interface SlotHold {
  clientId: string;
  day: string;
  time: string;
  expiresAt: number;
}

/** Calls never outlive VAPI_MAX_DURATION by much; sweep well past that. */
const SESSION_TTL_MS = 30 * 60 * 1000;
const SLOT_HOLD_TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
/**
 * An assistant utterance shorter than this was a backchannel, not a sentence.
 * Cutting one off is not an interruption worth counting or apologising for.
 */
const MIN_UTTERANCE_FOR_HARD_BARGE_IN_MS = 900;

/** Le dernier tour de l'appelant, tel qu'il est rangé dans le tampon. */
function lastCallerLine(session: CallSession): string | null {
  for (let i = session.transcript.length - 1; i >= 0; i--) {
    const line = session.transcript[i];
    if (line.startsWith('Caller: ')) return line.slice('Caller: '.length);
  }
  return null;
}

class CallSessionStore {
  private sessions = new Map<string, CallSession>();
  private holds: SlotHold[] = [];
  /** Pics de concurrence depuis le démarrage. Voir `concurrency()`. */
  private peakLive = 0;
  private peakPerClient = new Map<string, number>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor() {
    this.startSweeper();
  }

  private startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Never hold the process open for a cache sweep.
    this.sweeper.unref?.();
  }

  /** Drop sessions and slot holds that outlived any plausible call. */
  private sweep(): void {
    const now = Date.now();
    let dropped = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.startedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
        /* Le balayage est le SEUL chemin de sortie quand `end()` n'est jamais
           appelé (process redémarré côté Vapi, rapport de fin perdu). Sans
           ça, le span racine resterait ouvert et la trace de l'appel ne
           partirait jamais. */
        voiceTracing.endCall(id, { endedReason: 'swept' });
        dropped++;
      }
    }
    this.holds = this.holds.filter(h => h.expiresAt > now);
    if (dropped) logger.debug(`[CallSession] swept ${dropped} stale session(s)`);
  }

  start(input: {
    vapiCallId: string;
    clientId: string;
    callerNumber: string | null;
    language: VoiceLanguage;
  }): CallSession {
    const session: CallSession = {
      vapiCallId: input.vapiCallId,
      clientId: input.clientId,
      callerNumber: input.callerNumber,
      startedAt: Date.now(),
      language: input.language,
      clientCallId: null,
      speechToSpeech: null,
      disclosureSpoken: null,
      transcript: [],
      callerTurns: 0,
      deflectedTurns: 0,
      bargeIns: 0,
      toolCalls: [],
      dbRoundTrip: null,
      toolFailures: {},
      lead: null,
      leadActivityId: null,
      bookingId: null,
      cancelledBookingId: null,
      turnLatencies: [],
      lastCallerSpeechEndedAt: null,
      latency: new CallLatencyTracker(),
      assistantSpeakingSince: null,
      hardBargeIns: 0,
      falseCuts: 0,
      mood: 'neutral',
      tokens: { input: 0, cached: 0, output: 0 },
      models: {},
      llmFailures: [],
      callBrief: null,
      phoneCaptureFailures: 0,
      phoneReadBack: null,
      nameReadBack: null,
      nameSpellingAsked: false,
      pendingHardBargeIn: false,
      interruptedSpeechMs: null,
      repair: newRepairState(),
      controlUrl: null,
      moodNudge: null,
    };
    this.sessions.set(input.vapiCallId, session);
    this.notePeak(input.clientId);
    voiceTracing.startCall({
      vapiCallId: input.vapiCallId,
      clientId: input.clientId,
      language: input.language,
      at: session.startedAt,
    });
    return session;
  }

  /**
   * Consigne le moteur retenu, une fois l'assistant construit.
   *
   * Séparé de `start()` parce que la session s'ouvre AVANT que le modèle et la
   * voix soient choisis: c'est `buildSpeech` qui tranche, quelques lignes plus
   * bas, et lui seul connaît l'effet de la voix clonée.
   */
  setSpeechToSpeech(vapiCallId: string | null, speechToSpeech: boolean): void {
    const session = this.get(vapiCallId);
    if (session) session.speechToSpeech = speechToSpeech;
  }

  setDisclosure(vapiCallId: string | null, spoken: boolean): void {
    const session = this.get(vapiCallId);
    if (session) session.disclosureSpoken = spoken;
  }

  get(vapiCallId: string | null): CallSession | null {
    if (!vapiCallId) return null;
    return this.sessions.get(vapiCallId) ?? null;
  }

  /** Append one final utterance. No I/O — this runs on the hot path. */
  appendTranscript(vapiCallId: string | null, role: 'user' | 'assistant', text: string): void {
    const session = this.get(vapiCallId);
    if (!session || !text.trim()) return;
    session.transcript.push(`${role === 'user' ? 'Caller' : 'AI'}: ${text.trim()}`);
    if (role === 'user') {
      session.callerTurns++;
      session.lastCallerSpeechEndedAt = Date.now();
    } else if (session.lastCallerSpeechEndedAt) {
      session.turnLatencies.push(Date.now() - session.lastCallerSpeechEndedAt);
      session.lastCallerSpeechEndedAt = null;
    }
  }

  /** Stage marks. No-ops on an unknown call, so callers need no guard. */
  markLatency(
    vapiCallId: string | null,
    mark: 'callerSpeechEnd' | 'transcriptFinal' | 'llmStart' | 'llmRequestSent' | 'llmFirstDelta' | 'llmEnd' | 'toolTurn' | 'assistantSpeechStart',
  ): void {
    const session = this.get(vapiCallId);
    if (!session) return;
    switch (mark) {
      case 'callerSpeechEnd':
        return session.latency.markCallerSpeechEnd();
      case 'transcriptFinal':
        return session.latency.markTranscriptFinal();
      case 'llmStart':
        return session.latency.markLlmStart();
      case 'llmRequestSent':
        return session.latency.markLlmRequestSent();
      case 'toolTurn':
        return session.latency.markToolTurn();
      case 'llmFirstDelta':
        return session.latency.markLlmFirstDelta();
      case 'llmEnd':
        return session.latency.markLlmEnd();
      case 'assistantSpeechStart': {
        /* Le tour se ferme ici, et c'est le seul endroit qui connaît à la fois
           ses bornes et l'état de la session. Le span est écrit avec les
           horodatages du tracker, pas avec l'heure de cette ligne. */
        const trace = session.latency.markAssistantSpeechStart();
        voiceTracing.recordTurn(vapiCallId, trace, {
          tokens: { ...session.tokens },
          bargeIn: session.pendingHardBargeIn,
        });
        return;
      }
    }
  }

  setMood(vapiCallId: string | null, mood: CallerMood): void {
    const session = this.get(vapiCallId);
    if (session) session.mood = mood;
  }

  /** Un tour tombé en repli, et pourquoi: c'est ce que le docteur lit après coup. */
  recordLlmFailure(vapiCallId: string | null, reason: string): void {
    const session = this.get(vapiCallId);
    if (!session) return;
    session.llmFailures.push(reason.slice(0, 200));
  }

  /**
   * Retient l'adresse de contrôle. Ne l'ÉCRASE PAS par une absence: tous les
   * événements ne la portent pas, et la perdre en cours d'appel rendrait muet
   * tout ce qui parle au modèle après l'accueil.
   */
  noteControlUrl(vapiCallId: string | null, url: string | null): void {
    const session = this.get(vapiCallId);
    if (session && url) session.controlUrl = url;
  }

  controlUrlFor(vapiCallId: string | null): string | null {
    return this.get(vapiCallId)?.controlUrl ?? null;
  }

  /** Voir `moodNudge`: « pose (upset) », « REFUSE: 404 », « sans adresse ». */
  noteMoodNudge(vapiCallId: string | null, outcome: string): void {
    const session = this.get(vapiCallId);
    if (session) session.moodNudge = outcome.slice(0, 120);
  }

  /** Voir `callBrief`: « pose (3 rendez-vous) », « refuse: 404 », « sans adresse ». */
  noteCallBrief(vapiCallId: string | null, outcome: string): void {
    const session = this.get(vapiCallId);
    if (session) session.callBrief = outcome.slice(0, 120);
  }

  /** Un tour servi par `model`, tel qu'OpenAI l'a nommé dans son flux. */
  recordModel(vapiCallId: string | null, model: string): void {
    const session = this.get(vapiCallId);
    if (!session || !model) return;
    session.models[model] = (session.models[model] ?? 0) + 1;
  }

  recordTokens(vapiCallId: string | null, usage: { input: number; cached: number; output: number }): void {
    const session = this.get(vapiCallId);
    if (!session) return;
    session.tokens.input += usage.input;
    session.tokens.cached += usage.cached;
    session.tokens.output += usage.output;
  }

  /**
   * Compte un numéro dicté illisible et rend le total pour cet appel.
   *
   * Rend le compte plutôt que de le stocker en silence, parce que l'appelant
   * est en ligne: c'est ce nombre, et lui seul, qui décide entre « relis-lui
   * les chiffres » et « propose le clavier ». Sur un appel inconnu (session
   * balayée, processus redémarré) il rend 1, donc la relecture: proposer le
   * clavier à quelqu'un qui n'a encore rien raté serait pire que de le
   * refaire dicter une fois.
   */
  recordPhoneCaptureFailure(vapiCallId: string | null): number {
    const session = this.get(vapiCallId);
    if (!session) return 1;
    session.phoneCaptureFailures++;
    return session.phoneCaptureFailures;
  }

  /**
   * Ce numéro doit-il être relu à l'appelant ? Vrai une seule fois par numéro.
   *
   * L'appel pose le drapeau en même temps qu'il répond, parce que les deux
   * gestes sont le même: demander la relecture, c'est décider qu'elle a été
   * demandée. Un second numéro, dicté après correction, en redemande une —
   * c'est lui, désormais, qu'on rappellera.
   *
   * Sur un appel inconnu (session balayée, processus redémarré) il rend faux:
   * sans mémoire, on ne peut pas distinguer la première demande de la
   * confirmation, et redemander en boucle est pire que ne pas demander.
   */
  /**
   * Vrai UNE fois par nom et par appel: « Polle » entendu « Paul » (appel réel,
   * 12/09/2026). Le nom se relit à l'appelant avant d'être tenu pour bon, et
   * un nom corrigé est un nom nouveau, relu à son tour.
   */
  needsNameReadBack(vapiCallId: string | null, name: string): boolean {
    const session = this.get(vapiCallId);
    if (!session) return false;
    const key = name.trim().toLowerCase();
    if (!key) return false;
    /* UNE relecture par APPEL, pas par nom. « Un nom corrigé est un nom
       nouveau, relu à son tour » a produit trois tours de « Parfait, je vous
       réserve ça » sur un appel réel (12/09/2026, « Van Hold »): chaque
       correction de l'appelant déclenchait une nouvelle relecture, et lui
       corrigeait la relecture. Après la première, c'est l'appelant qui a
       le dernier mot. */
    if (session.nameReadBack) return false;
    session.nameReadBack = key;
    return true;
  }

  /**
   * Vrai UNE fois par appel: un appelant INCONNU épelle son nom de famille
   * avant que quoi que ce soit ne soit enregistré (demande du 13/09/2026:
   * « la première fois que le client se présente, il devrait épeler son
   * nom »). Ensuite l'orthographe validée est celle du lead, et l'appelant
   * suivant qui redit ce nom n'est plus interrogé.
   */
  needsNameSpelling(vapiCallId: string | null): boolean {
    const session = this.get(vapiCallId);
    if (!session || session.nameSpellingAsked) return false;
    session.nameSpellingAsked = true;
    return true;
  }

  needsPhoneReadBack(vapiCallId: string | null, e164: string): boolean {
    const session = this.get(vapiCallId);
    if (!session) return false;
    if (session.phoneReadBack === e164) return false;
    session.phoneReadBack = e164;
    return true;
  }

  recordDeflection(vapiCallId: string | null): void {
    const session = this.get(vapiCallId);
    if (session) session.deflectedTurns++;
  }

  assistantStartedSpeaking(vapiCallId: string | null, at = Date.now()): void {
    const session = this.get(vapiCallId);
    if (session) session.assistantSpeakingSince = at;
  }

  assistantStoppedSpeaking(vapiCallId: string | null): void {
    const session = this.get(vapiCallId);
    if (session) session.assistantSpeakingSince = null;
  }

  /**
   * Record an interruption and report whether it was a HARD one.
   *
   * Now that the assistant emits backchannels while the caller talks, a naive
   * counter would log a barge-in every time the caller keeps going after an
   * "mm-hmm" — which is not an interruption at all, it is the backchannel
   * working. Anything shorter than the floor is treated as such.
   *
   * The same distinction drives the recovery line: apologising for cutting the
   * caller off only makes sense when the assistant was genuinely mid-sentence.
   */
  recordBargeIn(vapiCallId: string | null, at = Date.now()): boolean {
    const session = this.get(vapiCallId);
    if (!session) return false;
    session.bargeIns++;

    const speakingFor = session.assistantSpeakingSince === null ? 0 : at - session.assistantSpeakingSince;

    /* Relevé AVANT de trancher sur la dureté, parce que les deux lectures d'un
       même événement ne s'excluent pas: une reprise très rapide n'est pas une
       interruption dure (l'agent parlait à peine), et c'est exactement là que
       le faux découpage se cache. */
    if (session.assistantSpeakingSince !== null
        && isFalseCut(speakingFor, lastCallerLine(session), session.language)) {
      session.falseCuts++;
    }

    const isHard = speakingFor >= MIN_UTTERANCE_FOR_HARD_BARGE_IN_MS;
    if (isHard) {
      session.hardBargeIns++;
      /* Ce qui manquait: le compteur montait, et rien ne s'en servait. Un tour
         cassé se répare au tour SUIVANT, quand l'appelant a fini de parler —
         d'où le drapeau plutôt qu'une action ici. */
      session.pendingHardBargeIn = true;
      /* Ce que l'appelant a eu le temps d'entendre. Relevé ICI et nulle part
         ailleurs: `assistantSpeakingSince` est remis à null trois lignes plus
         bas, et c'est la seule mesure de la chaîne qui dise quoi que ce soit
         de la durée réellement jouée. */
      session.interruptedSpeechMs = speakingFor;
    }
    session.assistantSpeakingSince = null;
    return isHard;
  }

  /**
   * La phrase à dire parce que le tour précédent a été cassé, ou `null`.
   *
   * « Take » et pas « get »: le drapeau est consommé à la lecture, sinon la
   * même interruption se ferait excuser à chaque tour qui suit.
   *
   * La retenue appartient à `conversational-repair` et non à cet appelant: une
   * phrase de reprise à CHAQUE interruption est pire que le silence, elle
   * transforme un chevauchement naturel en échange d'excuses. Le module rend
   * donc `null` la plupart du temps, et c'est le comportement voulu.
   */
  takeRecoveryLine(vapiCallId: string | null, lang: VoiceLanguage): string | null {
    const session = this.get(vapiCallId);
    if (!session || !session.pendingHardBargeIn) return null;
    session.pendingHardBargeIn = false;
    return recoveryLine(session.repair, true, session.callerTurns, lang);
  }

  /**
   * La durée d'énoncé jouée avant la coupure, consommée à la lecture (TUR-9).
   *
   * « Take » pour la même raison que la phrase de reprise: sans consommation,
   * la même interruption tronquerait l'historique à chaque tour suivant, et
   * l'agent perdrait au troisième tour ce qu'il avait bel et bien dit au
   * second.
   */
  takeInterruptedSpeechMs(vapiCallId: string | null): number | null {
    const session = this.get(vapiCallId);
    if (!session || session.interruptedSpeechMs === null) return null;
    const ms = session.interruptedSpeechMs;
    session.interruptedSpeechMs = null;
    return ms;
  }

  recordToolCall(vapiCallId: string | null, name: string, ms: number): void {
    const session = this.get(vapiCallId);
    if (session) session.toolCalls.push({ name, ms });
  }

  /** Le relevé de distance à la base, pour cet appel. Voir `db-round-trip.ts`. */
  noteDbRoundTrip(vapiCallId: string | null, rt: DbRoundTrip | null): void {
    const session = this.get(vapiCallId);
    if (session && rt) session.dbRoundTrip = rt;
  }

  /**
   * Compte un échec d'outil et rend le nombre d'essais, celui-ci compris.
   *
   * Sans session (appel qui a traversé un déploiement, cas réel du 13/09), on
   * rend 1: le doute penche vers « laisse-le réessayer une fois » plutôt que
   * vers un blocage qu'on ne saurait pas expliquer à l'appelant.
   */
  noteToolFailure(vapiCallId: string | null, key: string): number {
    const session = this.get(vapiCallId);
    if (!session) return 1;
    const next = (session.toolFailures[key] ?? 0) + 1;
    session.toolFailures[key] = next;
    return next;
  }

  /**
   * Une date LOINTAINE s'annonce une fois, puis elle est acquise.
   *
   * Rend le nombre d'annonces pour cette date, celle-ci comprise: 1 la première
   * fois (il faut la dire à voix haute avec l'année et faire confirmer), 2 et
   * au-delà quand l'appelant a confirmé et que l'outil peut écrire.
   *
   * Sans session, on rend 2: le doute penche vers « laisse-le faire », parce
   * qu'un blocage qu'on ne saurait pas lever ferait raccrocher l'appelant sans
   * son rendez-vous. Voir `farDateReply`.
   */
  noteFarDateAnnounced(vapiCallId: string | null, ymd: string): number {
    const session = this.get(vapiCallId);
    if (!session) return 2;
    const key = `farDate:${ymd}`;
    const next = (session.toolFailures[key] ?? 0) + 1;
    session.toolFailures[key] = next;
    return next;
  }

  recordLead(vapiCallId: string | null, lead: LeadCapture): void {
    const session = this.get(vapiCallId);
    if (session) session.lead = lead;
  }

  markLeadActivity(vapiCallId: string | null, activityId: string): void {
    const session = this.get(vapiCallId);
    if (session) session.leadActivityId = activityId;
  }

  markBooked(vapiCallId: string | null, bookingId: string): void {
    const session = this.get(vapiCallId);
    if (session) session.bookingId = bookingId;
  }

  markCancelled(vapiCallId: string | null, bookingId: string): void {
    const session = this.get(vapiCallId);
    if (!session) return;
    session.cancelledBookingId = bookingId;
    /* La réservation prise EN DIRECT puis annulée dans le même appel ne doit
       plus être présentée comme le rendez-vous de l'appelant: c'est elle que
       le post-appel relie à la fiche, et le nom qu'elle porte est celui que le
       prochain appel redira. Poser l'un sans retirer l'autre laisserait les
       deux drapeaux se contredire (6duovicies). */
    if (session.bookingId === bookingId) session.bookingId = null;
  }

  attachClientCall(vapiCallId: string | null, clientCallId: string): void {
    const session = this.get(vapiCallId);
    if (session) session.clientCallId = clientCallId;
  }

  /** Full transcript as one string, for the end-of-call write. */
  transcriptText(vapiCallId: string | null): string {
    return this.get(vapiCallId)?.transcript.join('\n') ?? '';
  }

  /** Remove the session and hand back its final state for persistence. */
  end(vapiCallId: string): CallSession | null {
    const session = this.sessions.get(vapiCallId);
    if (session) this.sessions.delete(vapiCallId);
    voiceTracing.endCall(vapiCallId);
    return session ?? null;
  }

  // ── Slot holds ──────────────────────────────────────────────────────────

  /**
   * Reserve a slot for the duration of a call so two callers on the line at the
   * same time are not offered — and cannot both take — the same time. Expires
   * on its own; the booking row is what makes it permanent.
   */
  holdSlot(clientId: string, date: Date, time: string): void {
    this.holds.push({
      clientId,
      day: date.toISOString().slice(0, 10),
      time,
      expiresAt: Date.now() + SLOT_HOLD_TTL_MS,
    });
  }

  heldSlots(clientId: string, date: Date): string[] {
    const now = Date.now();
    const day = date.toISOString().slice(0, 10);
    return this.holds
      .filter(h => h.clientId === clientId && h.day === day && h.expiresAt > now)
      .map(h => h.time);
  }

  /** Observability: how many calls this process is currently handling. */
  liveCount(): number {
    return this.sessions.size;
  }

  /**
   * Combien d'appels sont EN CE MOMENT sur la ligne de ce client.
   *
   * Rien n'oblige un client à n'avoir qu'un appel à la fois: l'assistant est
   * reconstruit à chaque `assistant-request`, donc deux appelants simultanés
   * obtiennent deux assistants et deux sessions. Ce compteur ne LIMITE donc
   * rien, il MESURE.
   *
   * Il existe parce que la promesse vendue est « la ligne ne sonne jamais
   * occupé », et que cette promesse était jusqu'ici invérifiable: le seul vrai
   * plafond est la concurrence du compte Vapi, il est partagé par toute la
   * flotte, et le jour où il sera atteint c'est un appelant qui l'apprendra en
   * premier. Compter est ce qui permet d'alerter avant.
   */
  liveCountFor(clientId: string): number {
    let n = 0;
    for (const session of this.sessions.values()) {
      if (session.clientId === clientId) n++;
    }
    return n;
  }

  /**
   * Le pic observé depuis le démarrage, global et par client.
   *
   * Le compteur instantané ne sert à rien pour dimensionner: il vaut zéro la
   * plupart du temps, et personne ne regarde l'écran à l'instant précis où deux
   * appels se croisent. C'est le PIC qui dit s'il faut relever le plafond du
   * compte, et il ne coûte que deux entiers.
   *
   * Remis à zéro au redémarrage, volontairement: c'est une mesure
   * d'exploitation, pas une donnée. La persister demanderait une écriture sur
   * le chemin critique de l'appel, ce qui est exactement ce que ce magasin a
   * été créé pour éviter.
   */
  /** Relève les pics. Appelé à l'ouverture d'une session, jamais ailleurs. */
  private notePeak(clientId: string): void {
    const live = this.sessions.size;
    if (live > this.peakLive) this.peakLive = live;
    const forClient = this.liveCountFor(clientId);
    if (forClient > (this.peakPerClient.get(clientId) ?? 0)) {
      this.peakPerClient.set(clientId, forClient);
    }
  }

  /**
   * L'état de la concurrence SANS identifier personne.
   *
   * C'est la seule forme publiable: le point de santé `/api/webhooks/vapi/health`
   * vit sur le routeur des webhooks, qui n'a pas d'authentification, et y écrire
   * des identifiants de clients les publierait à qui interroge l'URL. Les
   * chiffres, eux, ne disent rien de personne et répondent à la seule question
   * posée là: est-ce que la flotte approche du plafond.
   */
  concurrencySummary(): { live: number; peakLive: number; busiestLive: number } {
    const full = this.concurrency();
    return {
      live: full.live,
      peakLive: full.peakLive,
      busiestLive: full.busiest?.live ?? 0,
    };
  }

  /**
   * L'état de la concurrence, client par client. **Réservé à l'administration.**
   *
   * `busiest` plutôt que la liste entière: un tableau de bord qui afficherait
   * une ligne par client vivant deviendrait illisible dès la dixième vente, et
   * la seule question posée ici est « qui est le plus proche du plafond ».
   */
  concurrency(): {
    live: number;
    peakLive: number;
    busiest: { clientId: string; live: number } | null;
    peakPerClient: Array<{ clientId: string; peak: number }>;
  } {
    const perClient = new Map<string, number>();
    for (const session of this.sessions.values()) {
      perClient.set(session.clientId, (perClient.get(session.clientId) ?? 0) + 1);
    }
    let busiest: { clientId: string; live: number } | null = null;
    for (const [clientId, live] of perClient) {
      if (!busiest || live > busiest.live) busiest = { clientId, live };
    }
    return {
      live: this.sessions.size,
      peakLive: this.peakLive,
      busiest,
      peakPerClient: [...this.peakPerClient]
        .map(([clientId, peak]) => ({ clientId, peak }))
        .sort((a, b) => b.peak - a.peak)
        .slice(0, 10),
    };
  }

  /** Test seam. */
  reset(): void {
    this.sessions.clear();
    this.holds = [];
    this.peakLive = 0;
    this.peakPerClient.clear();
  }
}

export const callSessionStore = new CallSessionStore();
