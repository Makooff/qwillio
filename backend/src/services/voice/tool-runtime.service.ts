import { prisma } from '../../config/database';
import { spokenDate, todayIso } from './clock';
import { logger } from '../../config/logger';
import { googleCalendarService } from '../google-calendar.service';
import { realtimeContextService, type ClientVoiceProfile } from './realtime-context.service';
import { isKnownTool } from './voice-tools';
import { callSessionStore } from './call-session.store';
import { voiceTracing } from './voice-tracing';
import { callerMemoryService } from './caller-memory.service';
import { businessMemoryService } from './business-memory.service';
import { knowledgeGapService } from './knowledge-gap.service';
import { availabilitySpeculator } from './availability-speculator';
import { parseSpokenPhone } from '../../utils/phone-spoken';
import { phoneWords } from '../../utils/text-for-speech';
import { normaliseAddress } from '../../utils/be-communes';
import { normaliseSpelledName, familyName, spellOut } from '../../utils/spelled-name';
import { nameSimilarity, NAME_MATCH_THRESHOLD } from '../../utils/name-match';
import { ymdOf } from '../../utils/zoned-time';
import { dayWindow, nextOpenDay, minutesOf } from '../../utils/opening-hours';
import { smsReadiness } from '../sms-ready';
import { env } from '../../config/env';

/**
 * Tool runtime (Phase 4).
 *
 * Executes the function calls the model emits mid-conversation and returns a
 * result the model can read aloud. Three rules govern everything here:
 *
 *  1. **Bounded.** Every external call is raced against a timeout shorter than
 *     Vapi's own tool timeout, so a hung Google API degrades into "let me take
 *     your details instead" rather than dead air.
 *  2. **Short results.** The result string is replayed into the model's context
 *     on every subsequent turn. A verbose JSON blob is paid for repeatedly, so
 *     results are trimmed to what the agent must actually say.
 *  3. **Never throws.** A rejected promise inside a call becomes a spoken
 *     apology, not a 500 on the webhook.
 */

export interface ToolCallInput {
  toolCallId: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolCallResult {
  toolCallId: string;
  result: string;
}

/** Hard ceiling on any single external call inside a tool. */
const EXTERNAL_TIMEOUT_MS = 2_500;
/** Slots we offer in one breath — more than three is unlistenable on a phone. */

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Parse "2026-08-14" (or an ISO datetime) into a Date, rejecting nonsense. */
/**
 * Une date déjà passée ne se consulte pas, elle se CORRIGE.
 *
 * Le modèle qui demande le 17 juin un 12 septembre s'est trompé de mois, pas
 * de créneau: lui répondre « aucun créneau » le ferait proposer le 18 juin.
 * La réponse nomme le jour d'aujourd'hui, seule information qui lui manquait.
 */
function pastDateReply(profile: ClientVoiceProfile, raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const today = todayIso(profile.timezone);
  if (raw.trim() >= today) return null;
  const now = spokenDate(new Date(), profile.language, profile.timezone);
  return profile.language === 'fr'
    ? `DATE PASSEE: le ${raw.trim()} est deja passe. Nous sommes le ${now}. Recalcule la date voulue par l'appelant a partir d'aujourd'hui, puis rappelle l'outil.`
    : `DATE IN THE PAST: ${raw.trim()} is already gone. Today is ${now}. Recompute the date the caller wants from today, then call the tool again.`;
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? `${raw.trim()}T12:00:00Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Un jour FERMÉ n'a pas de créneau, et « aucun créneau » ferait proposer le
 * lendemain, fermé lui aussi le week-end. Un rendez-vous a été pris un
 * dimanche chez un commerce fermé le dimanche (appel réel, 12/09/2026): les
 * horaires du portail n'étaient lus nulle part. La réponse nomme le prochain
 * jour ouvert, avec son jour de semaine.
 */
function closedDayReply(profile: ClientVoiceProfile, raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const ymd = raw.trim();
  if (dayWindow(profile.weekHours, ymd, profile.timezone).open) return null;
  const day = spokenDate(parseDate(ymd)!, profile.language, profile.timezone);
  const next = nextOpenDay(profile.weekHours, ymd, profile.timezone);
  const nextDay = next ? spokenDate(parseDate(next)!, profile.language, profile.timezone) : null;
  if (profile.language === 'fr') {
    return `FERME le ${day}: l'entreprise n'ouvre pas ce jour-la.`
      + (nextDay ? ` Prochain jour ouvert: ${nextDay} (${next}). Propose-le, ou demande un autre jour.` : ' Demande un autre jour.');
  }
  return `CLOSED on ${day}: the business does not open that day.`
    + (nextDay ? ` Next open day: ${nextDay} (${next}). Offer it, or ask for another day.` : ' Ask for another day.');
}

/** Une heure hors de la fenetre d'ouverture du jour ne se reserve pas. */
function outsideHoursReply(profile: ClientVoiceProfile, ymd: string, minutes: number): string | null {
  const window = dayWindow(profile.weekHours, ymd, profile.timezone);
  if (!window.open) return null;
  const from = minutesOf(window.from) ?? 0;
  const to = minutesOf(window.to) ?? 24 * 60;
  if (minutes >= from && minutes < to) return null;
  const day = spokenDate(parseDate(ymd)!, profile.language, profile.timezone);
  return profile.language === 'fr'
    ? `HORS HORAIRES: le ${day}, l'entreprise est ouverte de ${window.from} a ${window.to}. Propose un horaire dans cette plage.`
    : `OUTSIDE OPENING HOURS: on ${day} the business is open from ${window.from} to ${window.to}. Offer a time within that window.`;
}

/**
 * Ce que l'agent doit FAIRE quand le numéro dicté ne tient pas debout.
 *
 * Formulé comme un geste et pas comme un diagnostic: « relis chiffre par
 * chiffre et redemande » se joue, « numéro invalide » se commente. La
 * relecture est aussi la seule chose qui lève une ambiguïté que la machine ne
 * voit pas (un mobile belge et un fixe français peuvent avoir la même suite).
 */
function retryPhone(lang: string, heard: string): string {
  /* Les chiffres ENTENDUS sont rendus à l'agent en toutes lettres, et c'est le
     cœur du geste: relire un numéro faux est précisément ce qui permet à
     l'appelant de repérer LEQUEL de ses chiffres a été mal compris. Lui
     demander de tout redicter à l'aveugle recommence la même erreur.
     En toutes lettres, parce qu'une suite de chiffres bruts envoyée au
     synthétiseur se prononce d'une façon qu'on ne contrôle pas (BEL-12). */
  const spelled = heard ? phoneWords(heard) : '';
  const readBack = {
    fr: spelled ? ` J'ai entendu: ${spelled}.` : '',
    en: spelled ? ` What I heard: ${spelled}.` : '',
    nl: spelled ? ` Wat ik hoorde: ${spelled}.` : '',
  };

  const base: Record<string, string> = {
    fr: 'NUMÉRO NON RECONNU. Le reste de la fiche est noté.' + readBack.fr
      + ' Relis-le à l\'appelant chiffre par chiffre, demande-lui de corriger, '
      + 'puis rappelle captureLead avec le numéro corrigé.',
    en: 'PHONE NOT RECOGNISED. The rest of the lead is saved.' + readBack.en
      + ' Read it back digit by digit, ask the caller to correct it, '
      + 'then call captureLead again with the corrected number.',
    nl: 'NUMMER NIET HERKEND. De rest van de fiche is genoteerd.' + readBack.nl
      + ' Lees het cijfer voor cijfer terug, vraag de beller om te corrigeren, '
      + 'en roep captureLead opnieuw aan met het juiste nummer.',
  };
  return base[lang] ?? base.en;
}

/**
 * Ce que l'agent doit faire quand le numéro dicté est VALIDE: le relire.
 *
 * La validation dit qu'une suite de chiffres forme un numéro, elle ne dit pas
 * que c'est CELUI de l'appelant. Un chiffre mal transcrit au milieu d'un mobile
 * belge donne un autre mobile belge, tout aussi valide: rien ne le signale, la
 * fiche part au CRM, le SMS de rappel porte le mauvais numéro, et le lead est
 * perdu sans que personne ne voie jamais pourquoi. C'est le mode d'échec le
 * plus cher, parce qu'il est silencieux des deux côtés.
 *
 * La relecture chiffre par chiffre est le seul contrôle disponible, et elle est
 * gratuite: l'appelant est en ligne, il vient de le dire. En toutes lettres et
 * par groupes nationaux, pour les mêmes raisons que sur le chemin d'échec — une
 * suite de chiffres bruts se prononce d'une façon qu'on ne contrôle pas.
 *
 * Demandé une seule fois par numéro (`needsPhoneReadBack`): l'agent rappelle
 * `captureLead` avec le numéro confirmé, et redemander la relecture à ce
 * moment-là les ferait tourner en boucle tous les deux.
 */
function readBackPhone(lang: string, national: string): string {
  const spelled = phoneWords(national);
  const base: Record<string, string> = {
    fr: `NUMÉRO NOTÉ: ${spelled}. Relis-le à l'appelant chiffre par chiffre pour confirmer, `
      + 'puis continue. S\'il te corrige, rappelle captureLead avec le numéro corrigé.',
    en: `NUMBER SAVED: ${spelled}. Read it back to the caller digit by digit to confirm, `
      + 'then carry on. If they correct you, call captureLead again with the corrected number.',
    nl: `NUMMER GENOTEERD: ${spelled}. Lees het cijfer voor cijfer terug ter bevestiging, `
      + 'en ga dan verder. Verbetert de beller je, roep captureLead dan opnieuw aan.',
  };
  return base[lang] ?? base.en;
}

/**
 * Le NOM se relit, comme le numéro.
 *
 * « Polle » entendu « Paul », « Mathieu » entendu « Matthieu », sur un appel
 * réel (12/09/2026): un transcripteur n'a aucune chance sur un nom propre
 * qu'il ne connaît pas, et le rendez-vous a été pris au mauvais nom. La
 * relecture est demandée UNE fois par nom et par appel; si l'appelant corrige,
 * on lui demande d'épeler le nom de famille, et un nom épelé est recollé par
 * `normaliseSpelledName`.
 */
function readBackName(lang: string, name: string): string {
  /* L'AGENT épelle le nom de famille lui-même: « Polle » relu se confond
     encore avec « Paul », les lettres non (retour du 12/09/2026). */
  const spelled = spellOut(familyName(name));
  const base: Record<string, string> = {
    fr: `NOM NOTÉ: « ${name} ». Répète-le à l'appelant, puis ÉPELLE toi-même le nom de famille lettre par lettre: ${spelled}. `
      + "Demande si c'est exact. S'il corrige une lettre, rappelle l'outil avec le nom exact.",
    en: `NAME SAVED: "${name}". Repeat it to the caller, then SPELL the family name yourself letter by letter: ${spelled}. `
      + 'Ask if that is right. If they correct a letter, call the tool again with the exact name.',
    nl: `NAAM GENOTEERD: « ${name} ». Herhaal hem voor de beller en SPEL de familienaam zelf letter voor letter: ${spelled}. `
      + 'Vraag of dat klopt. Verbetert de beller een letter, roep de tool opnieuw aan met de exacte naam.',
  };
  return base[lang] ?? base.en;
}

/**
 * Un appelant INCONNU épelle son nom de famille, à la première présentation.
 *
 * Demande du 13/09/2026: « le prénom ça va, mais le nom de famille il faudra
 * demander au client d'épeler, et une fois l'orthographe validée on garde
 * celle-là pour le lead et à chaque rappel ». Rien n'est enregistré avant:
 * un nom entendu qui entre dans la mémoire d'appelant y reste, et l'agent le
 * redit à l'appel suivant (« Jean Lucas » pour « Jean-Luc »).
 */
function askCallerToSpell(lang: string, name: string): string {
  const base: Record<string, string> = {
    fr: `NOM ENTENDU: « ${name} », correspondant INCONNU. Demande-lui d'ÉPELER son nom de famille lettre par lettre (le prénom suffit tel quel). `
      + "Laisse-le finir sans l'interrompre ni dire « merci » entre les lettres, puis rappelle l'outil avec le prénom et le nom tel qu'épelé. Un nom ne contient jamais de chiffre: « O » est la lettre O.",
    en: `NAME HEARD: "${name}", UNKNOWN caller. Ask them to SPELL their family name letter by letter (the first name is fine as is). `
      + 'Let them finish without interrupting, then call the tool again with the first name and the family name exactly as spelled. A name never contains a digit: "O" is the letter O.',
    nl: `NAAM GEHOORD: « ${name} », ONBEKENDE beller. Vraag om de familienaam letter voor letter te SPELLEN (de voornaam volstaat zo). `
      + 'Laat de beller uitspreken zonder te onderbreken en roep de tool daarna opnieuw aan met de voornaam en de gespelde familienaam. Een naam bevat nooit een cijfer: « O » is de letter O.',
  };
  return base[lang] ?? base.en;
}

/**
 * Il manque quelque chose pour réserver: rien n'est pris, et le modèle doit
 * le savoir. Le nom est le cas courant (l'appelant a dit oui à une heure,
 * jamais qui il est): l'agent demande prénom et nom de famille, un inconnu
 * épelle, puis rappelle l'outil. « Je vous réserve ça » ne se dit qu'après
 * un retour RESERVE.
 */
function missingBookingInfo(lang: string, missing: { name: boolean; date: boolean; time: boolean }): string {
  const fr = [missing.name && 'le prénom et le NOM DE FAMILLE', missing.date && 'la date', missing.time && "l'heure exacte"].filter(Boolean).join(', ');
  const en = [missing.name && 'the first name and FAMILY NAME', missing.date && 'the date', missing.time && 'the exact time'].filter(Boolean).join(', ');
  const nl = [missing.name && 'de voornaam en de FAMILIENAAM', missing.date && 'de datum', missing.time && 'het exacte uur'].filter(Boolean).join(', ');
  const base: Record<string, string> = {
    fr: `RIEN N'EST RESERVE: il manque ${fr}. `
      + (missing.name ? "Demande à l'appelant son prénom et son nom de famille (un inconnu l'épelle), " : 'Demande ce qui manque, ')
      + "puis rappelle bookAppointment avec le nom, la date et l'heure. Ne dis pas « je vous réserve » ni « c'est noté » avant un retour RESERVE.",
    en: `NOTHING IS BOOKED: missing ${en}. `
      + (missing.name ? 'Ask the caller for their first name and family name (an unknown caller spells it), ' : 'Ask for what is missing, ')
      + 'then call bookAppointment again with the name, the date and the time. Do not say it is booked before a BOOKED result.',
    nl: `NIETS IS GEBOEKT: ontbreekt ${nl}. `
      + (missing.name ? 'Vraag de beller om voornaam en familienaam (een onbekende beller spelt die), ' : 'Vraag wat ontbreekt, ')
      + 'en roep bookAppointment daarna opnieuw aan met naam, datum en uur. Zeg niet dat het geboekt is voor een GEBOEKT-resultaat.',
  };
  return base[lang] ?? base.en;
}

/** Avant de RÉSERVER: le nom va dans l'agenda du commerçant, il doit être juste. */
function confirmNameBeforeBooking(lang: string, name: string): string {
  const spelled = spellOut(familyName(name));
  const base: Record<string, string> = {
    fr: `NOM À CONFIRMER AVANT DE RÉSERVER: « ${name} ». Répète-le à l'appelant, puis ÉPELLE toi-même le nom de famille lettre par lettre: ${spelled}. `
      + "S'il confirme, rappelle bookAppointment avec ce nom. S'il corrige, demande-lui d'épeler le nom, laisse-le finir sans l'interrompre ni dire « merci » entre les lettres, puis rappelle bookAppointment avec le nom exact, sans le refaire confirmer.",
    en: `CONFIRM THE NAME BEFORE BOOKING: "${name}". Repeat it to the caller, then SPELL the family name yourself letter by letter: ${spelled}. `
      + 'If they confirm, call bookAppointment again with this name. If they correct you, ask them to spell it, then call bookAppointment with the exact name.',
    nl: `NAAM BEVESTIGEN VOOR HET BOEKEN: « ${name} ». Herhaal hem voor de beller en SPEL de familienaam zelf letter voor letter: ${spelled}. `
      + 'Bevestigt de beller, roep bookAppointment opnieuw aan met deze naam. Verbetert hij je, vraag om te spellen en roep bookAppointment aan met de exacte naam.',
  };
  return base[lang] ?? base.en;
}

/**
 * Le repli clavier, au DEUXIÈME échec (BEL-4).
 *
 * Redemander une troisième dictée après deux échecs, c'est refaire ce qui
 * vient de rater deux fois: si le transcripteur n'entend pas ce numéro, il ne
 * l'entendra pas mieux au troisième essai — accent, ligne bruyante, chiffres
 * collés, la cause ne bouge pas. Les touches, elles, ne passent pas par la
 * reconnaissance vocale du tout: c'est le seul canal du téléphone qui ne se
 * trompe jamais, et c'est ce qui sauve l'appel au lieu de le faire abandonner.
 *
 * La phrase dit à l'appelant de terminer par dièse, et c'est utile aux deux
 * bouts: lui sait quand il a fini, et la saisie part sans attendre le délai.
 */
function keypadFallback(lang: string, heard: string): string {
  const spelled = heard ? phoneWords(heard) : '';
  const readBack = {
    fr: spelled ? ` J'ai entendu: ${spelled}.` : '',
    en: spelled ? ` What I heard: ${spelled}.` : '',
    nl: spelled ? ` Wat ik hoorde: ${spelled}.` : '',
  };
  const base: Record<string, string> = {
    fr: 'DEUXIÈME ÉCHEC SUR LE NUMÉRO. Le reste de la fiche est noté.' + readBack.fr
      + ' Ne le fais PAS redicter une troisième fois. Excuse-toi brièvement de la ligne, '
      + 'et demande-lui de composer son numéro sur le clavier du téléphone, puis dièse. '
      + 'Les chiffres tapés te reviendront comme un message: rappelle alors captureLead avec eux.',
    en: 'SECOND FAILURE ON THE PHONE NUMBER. The rest of the lead is saved.' + readBack.en
      + ' Do NOT ask them to say it a third time. Apologise briefly for the line, '
      + 'and ask them to key the number in on their phone keypad, then hash. '
      + 'The typed digits come back to you as a message: call captureLead again with them.',
    nl: 'TWEEDE MISLUKKING OP HET NUMMER. De rest van de fiche is genoteerd.' + readBack.nl
      + ' Vraag het GEEN derde keer. Verontschuldig je kort voor de lijn, '
      + 'en vraag om het nummer op het toetsenbord in te tikken, gevolgd door hekje. '
      + 'De ingetikte cijfers komen als bericht terug: roep captureLead dan opnieuw aan.',
  };
  return base[lang] ?? base.en;
}

/** "14:30" → 870 minutes. Returns null on anything that is not a 24h clock. */
function parseTimeToMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const PART_OF_DAY_WINDOWS: Record<string, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 24 * 60],
  any: [0, 24 * 60],
};

class ToolRuntimeService {
  /**
   * Execute one tool call. `clientId` comes from the webhook path, never from
   * the model's arguments — a prompt-injected transcript must not be able to
   * make the agent read another tenant's calendar.
   */
  async execute(clientId: string, vapiCallId: string | null, call: ToolCallInput): Promise<ToolCallResult> {
    const started = Date.now();

    if (!isKnownTool(call.name)) {
      logger.warn(`[VoiceTools] Unknown tool requested: ${call.name}`);
      return { toolCallId: call.toolCallId, result: 'That action is not available on this line.' };
    }

    const profile = await realtimeContextService.getClientProfile(clientId);
    if (!profile) {
      return { toolCallId: call.toolCallId, result: 'I could not reach the booking system right now.' };
    }

    try {
      let result: string;
      switch (call.name) {
        case 'checkAvailability':
          result = await this.checkAvailability(profile, call.args);
          break;
        case 'bookAppointment':
          result = await this.bookAppointment(profile, vapiCallId, call.args);
          break;
        case 'lookupBooking':
          result = await this.lookupBooking(profile, vapiCallId, call.args);
          break;
        case 'rescheduleBooking':
          result = await this.rescheduleBooking(profile, vapiCallId, call.args);
          break;
        case 'captureLead':
          result = await this.captureLead(profile, vapiCallId, call.args);
          break;
        case 'lookupKnowledge':
          result = await this.lookupKnowledge(profile, call.args);
          break;
        default:
          result = 'That action is not available on this line.';
      }

      const elapsed = Date.now() - started;
      callSessionStore.recordToolCall(vapiCallId, call.name, elapsed);
      voiceTracing.recordTool(vapiCallId, { name: call.name, startedAt: started, endedAt: started + elapsed, ok: true });
      logger.info(`[VoiceTools] ${call.name} for ${profile.businessName} in ${elapsed}ms`);
      return { toolCallId: call.toolCallId, result };
    } catch (error) {
      const message = (error as Error).message;
      logger.error(`[VoiceTools] ${call.name} failed for client ${clientId}: ${message}`);
      callSessionStore.recordToolCall(vapiCallId, `${call.name}:error`, Date.now() - started);
      voiceTracing.recordTool(vapiCallId, { name: call.name, startedAt: started, endedAt: Date.now(), ok: false });
      return {
        toolCallId: call.toolCallId,
        result: this.degradedMessage(profile, call.name),
      };
    }
  }

  /**
   * What the agent says when a tool fails. Always an actionable fallback — the
   * caller must never be told "an error occurred", they must be offered the
   * next best thing.
   */
  private degradedMessage(profile: ClientVoiceProfile, tool: string): string {
    const fr = profile.language === 'fr';
    if (tool === 'checkAvailability' || tool === 'bookAppointment' || tool === 'rescheduleBooking') {
      return fr
        ? 'AGENDA INDISPONIBLE: dis au correspondant que tu ne peux pas confirmer le creneau maintenant, propose de noter ses coordonnees pour un rappel rapide, puis appelle captureLead.'
        : 'CALENDAR UNAVAILABLE: tell the caller you cannot confirm a slot right now, offer to take their details for a quick call back, then call captureLead.';
    }
    return fr
      ? 'ACTION ECHOUEE: continue la conversation normalement sans mentionner de probleme technique.'
      : 'ACTION FAILED: continue the conversation normally without mentioning a technical problem.';
  }

  // ── checkAvailability ───────────────────────────────────────────────────

  private async checkAvailability(profile: ClientVoiceProfile, args: Record<string, any>): Promise<string> {
    const date = parseDate(args.date);
    if (!date) {
      return profile.language === 'fr'
        ? 'DATE INVALIDE: demande au correspondant de preciser le jour souhaite.'
        : 'INVALID DATE: ask the caller which day they would like.';
    }
    const past = pastDateReply(profile, args.date);
    if (past) return past;
    const closed = closedDayReply(profile, args.date);
    if (closed) return closed;

    // Single read path, shared with the speculator: a day already pre-loaded
    // from the transcript is served from cache and costs nothing here.
    const slots = await withTimeout(
      availabilitySpeculator.freeSlots(profile.clientId, date),
      EXTERNAL_TIMEOUT_MS,
      'freeBusy',
    );

    const [windowStart, windowEnd] = PART_OF_DAY_WINDOWS[String(args.partOfDay || 'any')] ?? PART_OF_DAY_WINDOWS.any;
    const filtered = slots.filter(slot => {
      const minutes = parseTimeToMinutes(slot);
      return minutes !== null && minutes >= windowStart && minutes < windowEnd;
    });

    // Also exclude slots already promised on another live call today: two
    // simultaneous callers must not both be offered 14:00.
    const held = callSessionStore.heldSlots(profile.clientId, date);
    const free = filtered.filter(slot => !held.includes(slot));

    /* La fenêtre d'ouverture du jour, DITE avec les créneaux: sans elle,
       une liste coupée à trois faisait dire « le plus tard, c'est 11 heures »
       à un cabinet ouvert jusqu'à 18 h (appel réel, 13/09/2026). Le modèle
       lisait la fin de la liste comme la fin de la journée. La liste est
       désormais ENTIÈRE, et c'est la parole qui se limite à un créneau à la
       fois, pas la connaissance. */
    const window = dayWindow(profile.weekHours, String(args.date).trim(), profile.timezone);
    const hours = window.open ? `${window.from}-${window.to}` : '';
    const day = spokenDate(date, profile.language, profile.timezone);

    if (free.length === 0) {
      const fallback = slots.filter(s => !held.includes(s));
      if (fallback.length === 0) {
        return profile.language === 'fr'
          ? `AUCUN CRENEAU le ${day} (${args.date}, ouvert ${hours}): tout est pris. Propose un autre jour.`
          : `NO SLOTS on ${day} (${args.date}, open ${hours}): fully booked. Offer another day.`;
      }
      return profile.language === 'fr'
        ? `RIEN sur la plage demandee le ${day} (${args.date}, ouvert ${hours}), mais libre a: ${fallback.join(', ')}. Propose ces horaires, un par un.`
        : `NOTHING in the requested window on ${day} (${args.date}, open ${hours}), but free at: ${fallback.join(', ')}. Offer these instead, one at a time.`;
    }

    /* Le jour de la semaine est DIT avec la date: « lundi 17 juin » annoncé
       pour un jour qui n'était pas un lundi (appel réel, 12/09/2026). Le
       modèle ne calcule pas les jours, il les lit. */
    /* La suite est dite ICI, au moment où le modèle la lit: réserver demande
       prénom et nom de famille. Sans cette ligne, « oui je confirme » menait
       droit à « je vous réserve ça » sans nom, donc sans réservation
       (appel réel, 15/09/2026). */
    return profile.language === 'fr'
      ? `LIBRE le ${day} (${args.date}, ouvert ${hours}) a: ${free.join(', ')}. Ce sont TOUS les creneaux libres de la plage. Propose-les un par un, en nommant le jour. Quand l'appelant accepte une heure: prenom et nom de famille (s'il ne les a pas deja donnes, un inconnu epelle le nom), puis bookAppointment; c'est reserve seulement apres son retour RESERVE.`
      : `FREE on ${day} (${args.date}, open ${hours}) at: ${free.join(', ')}. These are ALL the free slots in the window. Offer them one at a time, naming the day. Once the caller accepts a time: first name and family name (unless already given; an unknown caller spells it), then bookAppointment; it is booked only after its BOOKED result.`;
  }

  // ── bookAppointment ─────────────────────────────────────────────────────

  private async bookAppointment(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    args: Record<string, any>,
  ): Promise<string> {
    const date = parseDate(args.date);
    const minutes = parseTimeToMinutes(args.time);
    const customerName = typeof args.customerName === 'string' ? normaliseSpelledName(args.customerName) : '';

    /* RIEN n'est réservé tant qu'il manque quelque chose, et le résultat le
       DIT, en nommant ce qui manque. Appel réel du 15/09/2026, appelant
       inconnu: créneau proposé, « oui je confirme », « parfait, je vous
       réserve ça », au revoir. Aucun nom demandé, aucune réservation, aucun
       SMS. L'ancien « INFOS MANQUANTES » ne disait ni que rien n'était pris,
       ni quoi faire: le modèle a annoncé une réservation qui n'existait pas. */
    if (!date || minutes === null || !customerName) {
      return missingBookingInfo(profile.language, { name: !customerName, date: !date, time: minutes === null });
    }
    const past = pastDateReply(profile, args.date);
    if (past) return past;
    const closed = closedDayReply(profile, args.date);
    if (closed) return closed;
    const outside = outsideHoursReply(profile, String(args.date).trim(), minutes);
    if (outside) return outside;

    /* Un appelant inconnu ÉPELLE d'abord son nom de famille (13/09). */
    if (await this.needsCallerSpelling(profile, vapiCallId)) {
      return askCallerToSpell(profile.language, customerName);
    }
    /* Le nom est relu AVANT d'écrire dans l'agenda: une réservation au
       mauvais nom se corrige à la main par le commerçant, et il ne le sait
       même pas. Une fois par nom et par appel; un nom déjà relu pendant
       `captureLead` ne l'est pas deux fois. */
    if (callSessionStore.needsNameReadBack(vapiCallId, customerName)) {
      return confirmNameBeforeBooking(profile.language, customerName);
    }

    const session = callSessionStore.get(vapiCallId);
    const clientCallId = session?.clientCallId ?? null;

    let booking;
    try {
      booking = await prisma.clientBooking.create({
        data: {
          clientId: profile.clientId,
          clientCallId,
          customerName,
          customerPhone: session?.callerNumber ?? null,
          customerEmail: typeof args.customerEmail === 'string' ? args.customerEmail : null,
          bookingDate: date,
          bookingTime: args.time,
          serviceType: typeof args.serviceType === 'string' ? args.serviceType : null,
          partySize: Number.isFinite(args.partySize) ? Number(args.partySize) : null,
          specialRequests: typeof args.specialRequests === 'string' ? args.specialRequests : null,
          status: 'confirmed',
          notes: 'Booked live during the call by the AI receptionist',
        },
      });
    } catch (error) {
      /* P2002 = l'index unique partiel a parlé: quelqu'un d'autre a pris ce
         créneau entre la vérification de disponibilité et cette écriture. Les
         « holds » en mémoire ne couvrent qu'un processus, donc ce cas est réel
         dès qu'il y a deux appels simultanés ou deux instances.
         L'agent doit proposer autre chose, pas annoncer une réservation qui
         n'existe pas. */
      if ((error as { code?: string }).code === 'P2002') {
        logger.info(`[VoiceTools] créneau déjà pris (${profile.clientId}, ${args.date} ${args.time})`);
        return profile.language === 'fr'
          ? "CRENEAU DEJA PRIS: quelqu'un vient de reserver cet horaire. Excuse-toi brievement et propose un autre creneau."
          : 'SLOT TAKEN: someone just booked that time. Apologise briefly and offer another slot.';
      }
      throw error;
    }

    callSessionStore.holdSlot(profile.clientId, date, String(args.time));
    callSessionStore.markBooked(vapiCallId, booking.id);

    // Calendar write is deliberately NOT awaited: the caller already has their
    // confirmation, and the booking row is the source of truth. A slow Google
    // API must not hold the line open.
    void this.syncBookingToCalendar(profile.clientId, booking.id);

    /* Le SMS de confirmation part PENDANT l'appel, avec le lien d'agenda:
       l'appelant repart avec le rendez-vous dans la poche, et l'agent peut le
       lui dire. Non attendu, comme l'agenda: la ligne ne reste pas ouverte
       sur Twilio. La phrase rendue au modèle dépend de ce qui est possible:
       promettre un SMS sans numéro serait un mensonge de plus. */
    const smsTo = session?.callerNumber ?? null;
    const smsPromised = !!smsTo && (await this.canSendSms(profile.clientId));
    if (smsPromised) {
      void this.sendBookingSms(profile, booking.id, smsTo, customerName, date, String(args.time), args.serviceType);
    }

    const day = spokenDate(date, profile.language, profile.timezone);
    if (profile.language === 'fr') {
      return `RESERVE: ${customerName}, le ${day} a ${args.time}. Confirme a voix haute, en nommant le jour.`
        + (smsPromised ? " Dis-lui qu'un SMS de confirmation avec le lien pour l'agenda part sur son numero." : '')
        + " Demande s'il faut autre chose.";
    }
    return `BOOKED: ${customerName}, ${day} at ${args.time}. Confirm it out loud, naming the day.`
      + (smsPromised ? ' Tell them a confirmation text with a calendar link is on its way to their number.' : '')
      + ' Ask if they need anything else.';
  }

  /** Un SMS ne se promet que s'il peut partir: identifiants, et un expéditeur pour CE client. */
  private async canSendSms(clientId: string): Promise<boolean> {
    if (!smsReadiness().ok) return false;
    const { smsService } = await import('../sms.service');
    return !!(await smsService.senderFor(clientId));
  }

  /** Le SMS de confirmation, avec le lien d'agenda public de la réservation. */
  private async sendBookingSms(
    profile: ClientVoiceProfile,
    bookingId: string,
    to: string,
    customerName: string,
    date: Date,
    time: string,
    serviceType: unknown,
  ): Promise<void> {
    try {
      const { smsService } = await import('../sms.service');
      const sent = await smsService.sendBookingConfirmationSMS({
        customerPhone: to,
        customerName,
        businessName: profile.businessName,
        bookingDate: date.toISOString(),
        bookingTime: time,
        serviceType: typeof serviceType === 'string' ? serviceType : null,
        /* `/agenda`: le gabarit Google Agenda, pour tous (un .ics tapé depuis Messages sur iPhone ouvre un abonnement, pas un rendez-vous). */
        calendarUrl: `${env.API_BASE_URL}/api/public/booking/${bookingId}/agenda`,
        lang: profile.language === 'fr' ? 'fr' : 'en',
        clientId: profile.clientId,
      });
      if (sent) {
        await prisma.clientBooking.update({ where: { id: bookingId }, data: { smsConfirmationSent: true } });
      }
    } catch (error) {
      logger.warn(`[VoiceTools] SMS de confirmation non envoyé (${bookingId}): ${(error as Error).message}`);
    }
  }

  /**
   * Écrit le rendez-vous au calendrier, et — c'est ce qui manquait — laisse une
   * trace de l'issue.
   *
   * L'échec n'est toujours pas remonté à l'appelant: sa réservation existe, la
   * ligne en base fait foi. Mais il n'est plus perdu non plus. Le compteur de
   * tentatives et l'horodatage de succès sont ce qui permet au job de
   * réconciliation (`bot-loop`) de reprendre les seules lignes qui le méritent.
   */
  async syncBookingToCalendar(clientId: string, bookingId: string): Promise<boolean> {
    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { googleCalendarRefreshToken: true, googleCalendarId: true },
      });
      if (!client?.googleCalendarRefreshToken) {
        /* Pas de calendrier lié: il n'y a rien à synchroniser, et ce n'est pas
           un échec. On marque la ligne comme réglée, sinon le job la
           reprendrait indéfiniment. */
        await this.markCalendarSynced(bookingId);
        return true;
      }
      const accessToken = await googleCalendarService.getAccessTokenFromRefresh(client.googleCalendarRefreshToken);
      await googleCalendarService.createEventFromBooking(bookingId, accessToken, client.googleCalendarId || 'primary');
      await this.markCalendarSynced(bookingId);
      return true;
    } catch (error) {
      logger.warn(`[VoiceTools] Calendar sync failed for booking ${bookingId}: ${(error as Error).message}`);
      await prisma.clientBooking
        .update({ where: { id: bookingId }, data: { calendarSyncAttempts: { increment: 1 } } })
        .catch(() => { /* la trace ne doit pas masquer l'erreur d'origine */ });
      return false;
    }
  }

  private async markCalendarSynced(bookingId: string): Promise<void> {
    await prisma.clientBooking
      .update({ where: { id: bookingId }, data: { calendarSyncedAt: new Date() } })
      .catch(() => { /* best-effort */ });
  }

  // ── lookupBooking ───────────────────────────────────────────────────────

  private async lookupBooking(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    args: Record<string, any>,
  ): Promise<string> {
    const session = callSessionStore.get(vapiCallId);
    const found = await this.findCallerBookings(profile, session?.callerNumber ?? null, args);

    if (!found.length) {
      return profile.language === 'fr'
        ? 'AUCUNE RESERVATION trouvee pour ce correspondant. Demande sous quel nom elle a ete prise.'
        : 'NO BOOKING found for this caller. Ask which name it was booked under.';
    }

    /* TOUTES les réservations à venir de l'appelant, pas la première par
       date. Appel réel du 13/09: `findFirst` rendait un autre rendez-vous du
       même numéro (« Lucas van Devel, aujourd'hui 9 h »), et le modèle en
       concluait que celui du 14 n'existait pas, cinq lectures du nom de
       suite. La liste dit ce qu'il y a; le modèle choisit ce que l'appelant
       décrit. */
    const lines = found.slice(0, 3).map((b, i) => {
      const day = spokenDate(b.bookingDate, profile.language, profile.timezone);
      return `${i + 1}) ${b.customerName}, ${profile.language === 'fr' ? 'le ' : ''}${day}${b.bookingTime ? ` ${profile.language === 'fr' ? 'a' : 'at'} ${b.bookingTime}` : ''}${b.serviceType ? ` (${b.serviceType})` : ''}`;
    });
    return profile.language === 'fr'
      ? `RESERVATION(S) DE CE CORRESPONDANT: ${lines.join(' ; ')}. Dis-lui celle qui correspond a ce qu'il decrit, sans lui faire repeter son nom. Le nom ecrit ici est le sien: appelle-le ainsi, pas comme tu l'as entendu. S'il dit que ce n'est PAS lui, crois-le: demande son nom et rappelle lookupBooking avec ce nom.`
        + ' Pour la deplacer: demande la nouvelle date, verifie avec checkAvailability, puis appelle rescheduleBooking avec le nom EXACTEMENT tel qu\'ecrit ici et currentDate. Jamais bookAppointment pour un deplacement.'
      : `BOOKING(S) FOR THIS CALLER: ${lines.join(' ; ')}. Tell the caller the one matching what they describe, without asking their name again. The name written here is theirs: use it, not what you heard. If they say it is NOT them, believe them: ask their name and call lookupBooking again with it.`
        + ' To move it: ask for the new date, check with checkAvailability, then call rescheduleBooking with the name EXACTLY as written here and currentDate. Never bookAppointment for a move.';
  }

  /**
   * Les réservations à venir de l'appelant, les plus probables d'abord.
   *
   * Par le numéro d'abord; par le nom ensuite, mais en RESSEMBLANCE et non en
   * égalité: « de la Ford », « Delaforde », « de la foireux » étaient tous
   * « de la forge » (13/09). Une date ou une heure dites par l'appelant
   * départagent deux rendez-vous du même numéro. Les lignes sont relues en
   * mémoire sur les 90 prochains jours: la base ne sait pas comparer deux
   * noms entendus, et un commerce n'a pas des milliers de rendez-vous à venir.
   */
  private async findCallerBookings(
    profile: ClientVoiceProfile,
    callerNumber: string | null,
    args: Record<string, any>,
  ): Promise<Array<{ id: string; customerName: string; bookingDate: Date; bookingTime: string | null; serviceType: string | null; googleEventId: string | null; score: number }>> {
    const name = typeof args.customerName === 'string' ? normaliseSpelledName(args.customerName) : '';
    /* `currentDate`, jamais `date`: sur rescheduleBooking, `date` est la
       NOUVELLE date, pas celle du rendez-vous à retrouver. */
    const saidYmd = typeof args.currentDate === 'string' && parseDate(args.currentDate) ? args.currentDate.trim() : null;
    const saidTime = typeof args.currentTime === 'string' ? args.currentTime : null;
    if (!callerNumber && !name) return [];

    const now = new Date();
    const horizon = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    const rows = await prisma.clientBooking.findMany({
      where: { clientId: profile.clientId, status: 'confirmed', bookingDate: { gte: now, lte: horizon } },
      orderBy: { bookingDate: 'asc' },
      take: 300,
      select: { id: true, customerName: true, customerPhone: true, bookingDate: true, bookingTime: true, serviceType: true, googleEventId: true },
    });

    return rows
      .map(row => {
        let score = 0;
        if (callerNumber && row.customerPhone === callerNumber) score += 2;
        const sim = name ? nameSimilarity(name, row.customerName) : 0;
        if (name && sim >= NAME_MATCH_THRESHOLD) score += 2 * sim;
        if (score === 0) return null;
        if (saidYmd && ymdOf(row.bookingDate) === saidYmd) score += 1;
        if (saidTime && row.bookingTime === saidTime) score += 0.5;
        return { ...row, score };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.score - a.score || a.bookingDate.getTime() - b.bookingDate.getTime());
  }

  // ── rescheduleBooking ───────────────────────────────────────────────────

  /**
   * Déplace le rendez-vous à venir de l'appelant, au lieu d'en créer un second.
   *
   * « Je dois modifier la date » finissait en bookAppointment: un nouveau
   * rendez-vous, et l'ancien toujours dans l'agenda du commerçant (appel réel,
   * 12/09/2026). La réservation est retrouvée comme dans lookupBooking, par le
   * numéro d'abord; la ligne est mise à jour, l'ancien événement Google
   * supprimé et le nouveau créé, le SMS repart avec le nouveau lien.
   */
  private async rescheduleBooking(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    args: Record<string, any>,
  ): Promise<string> {
    const date = parseDate(args.date);
    const minutes = parseTimeToMinutes(args.time);
    if (!date || minutes === null) {
      return profile.language === 'fr'
        ? 'INFOS MANQUANTES: il faut la nouvelle date et l\'heure exacte avant de deplacer.'
        : 'MISSING INFO: you need the new date and the exact time before moving.';
    }
    const past = pastDateReply(profile, args.date);
    if (past) return past;
    const closed = closedDayReply(profile, args.date);
    if (closed) return closed;
    const outside = outsideHoursReply(profile, String(args.date).trim(), minutes);
    if (outside) return outside;

    const session = callSessionStore.get(vapiCallId);
    /* Le même chercheur que lookupBooking: par numéro, par ressemblance de
       nom, départagé par `currentDate`. Deux rendez-vous à venir et rien
       pour les départager: on demande lequel, on ne déplace pas au hasard. */
    const candidates = await this.findCallerBookings(profile, session?.callerNumber ?? null, args);
    const booking = candidates[0];
    if (booking && candidates.length > 1 && candidates[1].score === booking.score) {
      const list = candidates.slice(0, 3).map(b => `${b.customerName} ${spokenDate(b.bookingDate, profile.language, profile.timezone)}${b.bookingTime ? ` ${b.bookingTime}` : ''}`).join(' ; ');
      return profile.language === 'fr'
        ? `PLUSIEURS RESERVATIONS: ${list}. Demande laquelle deplacer, puis rappelle rescheduleBooking avec currentDate (AAAA-MM-JJ) de celle-la.`
        : `SEVERAL BOOKINGS: ${list}. Ask which one to move, then call rescheduleBooking again with that one's currentDate (YYYY-MM-DD).`;
    }
    if (!booking) {
      return profile.language === 'fr'
        ? 'AUCUNE RESERVATION trouvee pour ce correspondant. Demande sous quel nom elle a ete prise, puis rappelle rescheduleBooking avec ce nom.'
        : 'NO BOOKING found for this caller. Ask which name it was booked under, then call rescheduleBooking again with that name.';
    }

    const time = String(args.time);
    try {
      await prisma.clientBooking.update({
        where: { id: booking.id },
        data: { bookingDate: date, bookingTime: time, googleEventId: null, calendarSyncedAt: null },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return profile.language === 'fr'
          ? "CRENEAU DEJA PRIS: quelqu'un vient de reserver cet horaire. Excuse-toi brievement et propose un autre creneau."
          : 'SLOT TAKEN: someone just booked that time. Apologise briefly and offer another slot.';
      }
      throw error;
    }

    callSessionStore.holdSlot(profile.clientId, date, time);
    callSessionStore.markBooked(vapiCallId, booking.id);
    void this.moveCalendarEvent(profile.clientId, booking.id, booking.googleEventId);

    const smsTo = session?.callerNumber ?? null;
    const smsPromised = !!smsTo && (await this.canSendSms(profile.clientId));
    if (smsPromised) {
      void this.sendBookingSms(profile, booking.id, smsTo, booking.customerName, date, time, booking.serviceType);
    }

    const oldDay = spokenDate(booking.bookingDate, profile.language, profile.timezone);
    const newDay = spokenDate(date, profile.language, profile.timezone);
    if (profile.language === 'fr') {
      return `DEPLACE: ${booking.customerName}, du ${oldDay}${booking.bookingTime ? ` ${booking.bookingTime}` : ''} au ${newDay} a ${time}. L'ancien creneau est libere. Confirme a voix haute, en nommant le nouveau jour.`
        + (smsPromised ? " Dis-lui qu'un SMS de confirmation avec le lien pour l'agenda part sur son numero." : '')
        + " Demande s'il faut autre chose.";
    }
    return `MOVED: ${booking.customerName}, from ${oldDay}${booking.bookingTime ? ` ${booking.bookingTime}` : ''} to ${newDay} at ${time}. The old slot is released. Confirm it out loud, naming the new day.`
      + (smsPromised ? ' Tell them a confirmation text with a calendar link is on its way to their number.' : '')
      + ' Ask if they need anything else.';
  }

  /** L'ancien événement Google part, le nouveau est créé par la synchronisation ordinaire. */
  private async moveCalendarEvent(clientId: string, bookingId: string, oldEventId: string | null): Promise<void> {
    if (oldEventId) {
      try {
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { googleCalendarRefreshToken: true, googleCalendarId: true },
        });
        if (client?.googleCalendarRefreshToken) {
          const accessToken = await googleCalendarService.getAccessTokenFromRefresh(client.googleCalendarRefreshToken);
          await googleCalendarService.deleteEvent(oldEventId, accessToken, client.googleCalendarId || 'primary');
        }
      } catch (error) {
        logger.warn(`[VoiceTools] ancien événement Google non supprimé (${bookingId}): ${(error as Error).message}`);
      }
    }
    await this.syncBookingToCalendar(clientId, bookingId);
  }

  // ── captureLead ─────────────────────────────────────────────────────────

  /**
   * Record the caller and why they rang.
   *
   * This writes to durable storage during the call, not at the end of it, for
   * two reasons: a call that drops mid-sentence still leaves a followable lead,
   * and the sales follow-up can start the second the line clears rather than
   * waiting on the transcript-analysis pass.
   *
   * Three destinations, each with a distinct job:
   *  - `AgentCrmActivity` (status `pending`) — the durable record and the
   *    payload the external CRM sync drains.
   *  - `CallerMemory` — so a callback thirty seconds later already knows them.
   *  - the live session — so the end-of-call rollup can link the lead to the
   *    `ClientCall` row once it exists.
   */
  private async captureLead(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    args: Record<string, any>,
  ): Promise<string> {
    const session = callSessionStore.get(vapiCallId);
    const lead = {
      name: typeof args.name === 'string' ? normaliseSpelledName(args.name) || null : null,
      email: typeof args.email === 'string' ? args.email.trim() || null : null,
      reason: typeof args.reason === 'string' ? args.reason.trim() : '',
      urgency: ['low', 'normal', 'high'].includes(args.urgency) ? String(args.urgency) : 'normal',
    };
    /* `recordLead` attend maintenant le numéro, donc il attend `phone`, calculé
       plus bas. Le lead n'est plus posé ici: le poser avant le numéro était
       exactement ce qui le perdait. */

    /* AVANT toute écriture: un appelant inconnu épelle son nom de famille, et
       c'est l'orthographe épelée qui entre dans le CRM et la mémoire, jamais
       le nom entendu (13/09/2026). */
    if (lead.name && await this.needsCallerSpelling(profile, vapiCallId)) {
      return askCallerToSpell(profile.language, lead.name);
    }

    /* L'adresse, avec sa commune ramenée à UNE forme (BEL-6).
       Ixelles et Elsene sont le même endroit et deux noms également
       officiels. Sans cette normalisation, deux appelants qui donnent la même
       adresse produisent deux lignes différentes dans le CRM, le client croit
       à deux clients, et il rappelle pour demander où il doit aller.
       La langue retenue est celle du CLIENT, pas de l'appelant: c'est lui qui
       relit la fiche. */
    const address = typeof args.address === 'string' && args.address.trim()
      ? normaliseAddress(args.address.trim(), profile.language)
      : null;

    /* Le numéro DICTÉ, validé avant d'être cru (BEL-3).
       Sur une séquence structurée, un transcripteur est juste une fois sur
       deux: enregistrer sans contrôle produit un rappel sur un chiffre faux,
       c'est-à-dire un lead perdu que personne ne voit jamais.
       Le pays de l'appelant vient de sa propre ligne quand elle est connue: il
       tranche l'ambiguïté réelle entre un mobile belge et un fixe français du
       Sud-Est, que le numéro seul ne permet pas de lever. */
    const dictated =
      typeof args.phone === 'string' && args.phone.trim()
        ? parseSpokenPhone(args.phone, { country: profile.country, callerNumber: session?.callerNumber ?? null })
        : null;

    if (dictated && !dictated.ok && dictated.reason === 'invalid') {
      /* Le LEAD est enregistré quand même, sans le numéro: refuser toute la
         fiche pour un chiffre douteux perdrait le nom, le motif et l'urgence
         que l'appelant vient de donner. Seul le numéro est écarté, et le
         modèle sait qu'il doit le redemander. */
      logger.info(
        `[VoiceTools] numéro dicté refusé pour ${profile.businessName}: ` +
          `${dictated.digits.length} chiffre(s) ne formant aucun numéro belge ni français`,
      );
    }

    /* Un numéro donné de vive voix l'emporte sur l'identifiant d'appelant: si
       l'appelant en dicte un autre, c'est là qu'il veut être rappelé. */
    const phone = (dictated?.ok ? dictated.e164 : null) ?? session?.callerNumber ?? null;

    /* APRÈS le numéro, pas avant: c'est tout l'objet du correctif. */
    callSessionStore.recordLead(vapiCallId, { ...lead, phone });

    // Durable first, and awaited: the whole point is that this survives the
    // call. It is one indexed insert, well inside the tool budget.
    const activity = await prisma.agentCrmActivity.create({
      data: {
        clientId: profile.clientId,
        type: 'lead_capture',
        status: 'pending',
        content: {
          source: 'ai_receptionist',
          vapiCallId,
          capturedAt: new Date().toISOString(),
          contact: { name: lead.name, email: lead.email, phone, address },
          reason: lead.reason,
          urgency: lead.urgency,
          language: profile.language,
          businessName: profile.businessName,
        },
      },
      select: { id: true },
    });
    callSessionStore.markLeadActivity(vapiCallId, activity.id);

    // Memory is an enhancement, so it must not be able to fail the tool.
    void callerMemoryService
      .remember({
        clientId: profile.clientId,
        callerNumber: phone,
        name: lead.name,
        email: lead.email,
        summary: lead.reason || null,
        outcome: 'lead',
      })
      .catch(err => logger.warn(`[VoiceTools] caller memory write failed: ${err.message}`));

    if (dictated && !dictated.ok && dictated.reason === 'invalid') {
      /* La consigne nomme le geste attendu, elle ne décrit pas l'erreur: un
         modèle à qui l'on dit « invalide » s'excuse, un modèle à qui l'on dit
         « relis chiffre par chiffre et redemande » le fait.
         Au deuxième échec, le geste change de nature: on quitte la voix. */
      const failures = callSessionStore.recordPhoneCaptureFailure(vapiCallId);
      return failures >= 2
        ? keypadFallback(profile.language, dictated.digits)
        : retryPhone(profile.language, dictated.digits);
    }

    /* Le numéro a passé la validation, ce qui ne veut pas dire qu'il est le
       bon: c'est là que la relecture se demande, et une seule fois. Le nom
       suit la même règle; les deux relectures partent ensemble quand elles
       tombent sur le même appel. */
    const readBacks: string[] = [];
    if (lead.name && callSessionStore.needsNameReadBack(vapiCallId, lead.name)) {
      readBacks.push(readBackName(profile.language, lead.name));
    }
    if (dictated?.ok && callSessionStore.needsPhoneReadBack(vapiCallId, dictated.e164)) {
      readBacks.push(readBackPhone(profile.language, dictated.national));
    }
    if (readBacks.length) return readBacks.join(' ');

    return profile.language === 'fr' ? 'NOTE. Continue la conversation.' : 'NOTED. Continue the conversation.';
  }

  /**
   * L'appelant est-il INCONNU, et l'épellation pas encore demandée ?
   *
   * Connu = un nom sur une réservation confirmée, la mémoire d'appelant ou un
   * appel passé (`getCallerHistory`, lu en cache, une fois par appel). Si
   * l'historique est illisible, on ne demande pas d'épeler: la relecture
   * épelée par l'agent, qui suit, reste le filet.
   */
  private async needsCallerSpelling(profile: ClientVoiceProfile, vapiCallId: string | null): Promise<boolean> {
    const session = callSessionStore.get(vapiCallId);
    if (!session) return false;
    try {
      const history = await realtimeContextService.getCallerHistory(profile.clientId, session.callerNumber ?? null);
      if (history.knownName) return false;
    } catch (error) {
      logger.warn(`[VoiceTools] historique appelant illisible, pas d'épellation demandée: ${(error as Error).message}`);
      return false;
    }
    return callSessionStore.needsNameSpelling(vapiCallId);
  }

  // ── lookupKnowledge ─────────────────────────────────────────────────────

  /**
   * Answer from the client's knowledge base. Only the highest-priority entries
   * live in the prompt; this reaches the rest without paying for them on every
   * model turn.
   */
  private async lookupKnowledge(profile: ClientVoiceProfile, args: Record<string, any>): Promise<string> {
    const query = typeof args.question === 'string' ? args.question : '';
    const hits = await businessMemoryService.search(profile.clientId, query);

    /* Une recherche vide est la seule occasion d'apprendre.
       L'agent promet déjà de « faire remonter la question » — c'est la phrase
       que `formatForSpeech` lui souffle. Elle n'était tenue nulle part: la
       question mourait ici, et l'appelant suivant reposait la même. Elle est
       maintenant consignée, dans SES mots, qui sont les seuls dont on dispose:
       ni le gérant ni nous n'aurions su l'écrire d'avance.
       Sans `await`: le correspondant attend cette réponse, et une écriture en
       base n'a rien à faire dans son tour de parole. */
    if (hits.length === 0 && query.trim()) {
      void knowledgeGapService.record({
        clientId: profile.clientId,
        question: query,
        language: profile.language,
        source: 'lookup',
      });
    }

    return businessMemoryService.formatForSpeech(hits, profile.language);
  }
}

export const toolRuntimeService = new ToolRuntimeService();
