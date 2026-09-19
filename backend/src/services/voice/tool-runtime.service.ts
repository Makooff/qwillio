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
import { normaliseSpelledName, familyName, spellOut, nameProblem, isPlaceholderName, type NameProblem } from '../../utils/spelled-name';
import { nameSimilarity, NAME_MATCH_THRESHOLD } from '../../utils/name-match';
import { ymdOf } from '../../utils/zoned-time';
import { dayWindow, nextOpenDay, minutesOf } from '../../utils/opening-hours';
import { smsReadiness } from '../sms-ready';

/** Durée de validité de « ce client a un expéditeur SMS », lu en base sinon. */
const SMS_SENDER_MEMO_MS = 5 * 60 * 1000;
import { env } from '../../config/env';
import { phoneForms } from '../../utils/phone-forms';

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

/**
 * UN DEPLACEMENT DE PLUSIEURS MOIS SE CONFIRME, AVEC L'ANNEE (17/09/2026).
 *
 * Appel reel. L'appelant dit « le 22 MARDI ». Le modele entend « le 22 MARS »,
 * constate que mars 2026 est passe, et projette donc sur 2027. Il annonce meme
 * « lundi 22 mars », ce qui est exact pour 2027 — l'appelant disait mardi, et
 * personne n'a releve. Un rendez-vous du 24 septembre est parti six mois plus
 * loin, et il a DISPARU de la vue du gerant: le calendrier charge un mois, donc
 * rien ne montre un rendez-vous expedie en 2027.
 *
 * Le garde-fou « date passee » ne pouvait rien: 2027 est dans le futur.
 *
 * LE SIGNAL EST L'ANNEE, pas la distance. Un premier essai bornait l'ECART a
 * deux mois, et c'etait faux: un controle dentaire a six mois est la norme du
 * metier, et douze tests existants sont tombes en le disant. Ce que personne ne
 * fait, en revanche, c'est demander en septembre un rendez-vous l'annee
 * SUIVANTE sans jamais prononcer l'annee. C'est exactement ce que le modele a
 * insere en silence, et c'est donc cela qu'on fait confirmer.
 *
 * On ne REFUSE pas, on fait confirmer: c'est une conversation, l'appelant peut
 * trancher lui-meme, et un refus sec lui ferait perdre son rendez-vous pour une
 * homophonie. L'annonce vaut une fois par date (`noteFarDateAnnounced`): sans
 * ca, le modele repasserait par la meme question a l'infini.
 */
function farDateReply(
  profile: ClientVoiceProfile,
  vapiCallId: string | null,
  raw: unknown,
): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const ymd = raw.trim();
  const year = ymd.slice(0, 4);
  /* Meme annee que le jour de l'appel: rien a confirmer, quelle que soit la
     distance. Decembre depuis septembre reste une date que l'appelant a
     nommee en clair. */
  if (year === todayIso(profile.timezone).slice(0, 4)) return null;
  /* Deja annonce pour CETTE date: l'appelant a eu l'occasion de dire non. */
  if (callSessionStore.noteFarDateAnnounced(vapiCallId, ymd) > 1) return null;
  const spoken = spokenDate(parseDate(ymd)!, profile.language, profile.timezone);
  return profile.language === 'fr'
    ? `RIEN N'EST ENCORE ENREGISTRE. La date que tu t'apprêtes a poser tombe en ${year}, pas cette annee: le ${spoken} ${year}. Dis-la a voix haute AVEC L'ANNEE et demande a l'appelant si c'est bien ce qu'il veut. S'il confirme, rappelle l'outil avec la meme date. Sinon, demande-lui la date exacte: il a peut-etre dit un JOUR DE LA SEMAINE que tu as pris pour un mois.`
    : `NOTHING IS SAVED YET. The date you are about to set falls in ${year}, not this year: ${spoken} ${year}. Say it out loud WITH THE YEAR and ask the caller to confirm. If they confirm, call the tool again with the same date. If not, ask for the exact date: they may have said a WEEKDAY you took for a month.`;
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
function missingBookingInfo(lang: string, missing: { name: NameProblem; date: boolean; time: boolean }, given = ''): string {
  /* Le nom, selon ce qui cloche: absent, bidon (« client », posé par le modèle
     pour remplir le champ, appel réel du 15/09/2026), ou prénom seul. */
  const nameFr = missing.name === 'placeholder' ? `un vrai nom (« ${given} » n'est pas un nom, ne l'invente pas)`
    : missing.name === 'firstOnly' ? `le NOM DE FAMILLE (tu n'as que « ${given} »)`
    : missing.name ? 'le prénom et le NOM DE FAMILLE' : '';
  const nameEn = missing.name === 'placeholder' ? `a real name ("${given}" is not a name, do not make one up)`
    : missing.name === 'firstOnly' ? `the FAMILY NAME (you only have "${given}")`
    : missing.name ? 'the first name and FAMILY NAME' : '';
  const nameNl = missing.name === 'placeholder' ? `een echte naam (« ${given} » is geen naam, verzin er geen)`
    : missing.name === 'firstOnly' ? `de FAMILIENAAM (je hebt alleen « ${given} »)`
    : missing.name ? 'de voornaam en de FAMILIENAAM' : '';
  const fr = [nameFr, missing.date && 'la date', missing.time && "l'heure exacte"].filter(Boolean).join(', ');
  const en = [nameEn, missing.date && 'the date', missing.time && 'the exact time'].filter(Boolean).join(', ');
  const nl = [nameNl, missing.date && 'de datum', missing.time && 'het exacte uur'].filter(Boolean).join(', ');
  const askFr = missing.name === 'firstOnly' ? "Demande à l'appelant son nom de famille (un inconnu l'épelle), "
    : missing.name ? "Demande à l'appelant son prénom et son nom de famille (un inconnu l'épelle), " : 'Demande ce qui manque, ';
  const askEn = missing.name === 'firstOnly' ? 'Ask the caller for their family name (an unknown caller spells it), '
    : missing.name ? 'Ask the caller for their first name and family name (an unknown caller spells it), ' : 'Ask for what is missing, ';
  const askNl = missing.name === 'firstOnly' ? 'Vraag de beller om de familienaam (een onbekende beller spelt die), '
    : missing.name ? 'Vraag de beller om voornaam en familienaam (een onbekende beller spelt die), ' : 'Vraag wat ontbreekt, ';
  const base: Record<string, string> = {
    fr: `RIEN N'EST RESERVE: il manque ${fr}. ` + askFr
      + "puis rappelle bookAppointment avec le nom, la date et l'heure. Ne dis pas « je vous réserve » ni « c'est noté » avant un retour RESERVE, et ne raccroche pas.",
    en: `NOTHING IS BOOKED: missing ${en}. ` + askEn
      + 'then call bookAppointment again with the name, the date and the time. Do not say it is booked before a BOOKED result, and do not hang up.',
    nl: `NIETS IS GEBOEKT: ontbreekt ${nl}. ` + askNl
      + 'en roep bookAppointment daarna opnieuw aan met naam, datum en uur. Zeg niet dat het geboekt is voor een GEBOEKT-resultaat, en hang niet op.',
  };
  return base[lang] ?? base.en;
}

/**
 * Posé devant toute relecture ou épellation demandée par bookAppointment:
 * le modèle a lu « demande-lui d'épeler » et a quand même annoncé la
 * réservation avant de raccrocher (appel réel, 15/09/2026). Le résultat
 * commence donc par l'état, avant la consigne.
 */
function notBookedYet(lang: string): string {
  const base: Record<string, string> = {
    fr: "RIEN N'EST ENCORE RESERVE, ne l'annonce pas et ne raccroche pas. ",
    en: 'NOTHING IS BOOKED YET, do not announce it and do not hang up. ',
    nl: 'ER IS NOG NIETS GEBOEKT, kondig het niet aan en hang niet op. ',
  };
  return base[lang] ?? base.en;
}

/** Avant de RÉSERVER: le nom va dans l'agenda du commerçant, il doit être juste. */
function confirmNameBeforeBooking(lang: string, name: string): string {
  const spelled = spellOut(familyName(name));
  const base: Record<string, string> = {
    fr: `NOM À CONFIRMER AVANT DE RÉSERVER: « ${name} ». Répète-le EXACTEMENT ainsi, sans recoller les mots, puis épelle le nom de famille en redisant ces lettres telles quelles: ${spelled}. `
      + 'Recopie-les sans en changer aucune et sans les coller: un nom ne contient JAMAIS de chiffre, écris O et pas zéro. '
      + "S'il confirme, rappelle bookAppointment avec ce nom. S'il corrige, demande-lui d'épeler le nom, laisse-le finir sans l'interrompre ni dire « merci » entre les lettres, puis rappelle bookAppointment avec le nom exact, sans le refaire confirmer.",
    en: `CONFIRM THE NAME BEFORE BOOKING: "${name}". Repeat it EXACTLY as written, without merging the words, then spell the family name back using these letters as they are: ${spelled}. `
      + 'Copy them without changing or joining any: a name never contains a digit, write O and not zero. '
      + 'If they confirm, call bookAppointment again with this name. If they correct you, ask them to spell it, then call bookAppointment with the exact name.',
    nl: `NAAM BEVESTIGEN VOOR HET BOEKEN: « ${name} ». Herhaal hem PRECIES zo, zonder de woorden aan elkaar te plakken, en spel de familienaam met deze letters zoals ze staan: ${spelled}. `
      + 'Neem ze letterlijk over zonder er een te wijzigen of samen te voegen: een naam bevat NOOIT een cijfer, schrijf O en geen nul. '
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

const PART_OF_DAY_LABELS: Record<string, { fr: string; en: string }> = {
  morning: { fr: 'le MATIN', en: 'the MORNING' },
  afternoon: { fr: "l'APRES-MIDI", en: 'the AFTERNOON' },
  evening: { fr: 'la SOIREE', en: 'the EVENING' },
};

/**
 * Ce que le résultat doit dire quand la liste a été FILTRÉE sur une plage.
 *
 * Appel réel du 16/09/2026, cabinet ouvert 9 h-18 h le vendredi. L'appelant
 * veut « plus tôt », le modèle appelle l'outil avec `partOfDay: 'morning'`, et
 * le résultat rend les créneaux du matin en disant « Ce sont TOUS les creneaux
 * libres de la plage ». Le modèle a lu la fin de la liste comme la fin de la
 * journée, a répondu « on est fermé l'après-midi », et l'a CONFIRMÉ quand
 * l'appelant l'a répété. Une fermeture inventée est pire qu'un créneau manqué:
 * c'est un fait sur l'entreprise, faux, dit à un client qui voulait venir.
 *
 * C'est 6untrigesies (« le plus tard, c'est 11 heures ») d'un cran plus haut:
 * le correctif d'alors a ajouté la fenêtre d'ouverture au résultat, mais
 * jamais le nom du FILTRE. Un résultat tronqué doit dire qu'il est tronqué,
 * et par quoi.
 */
/**
 * LE JOUR DE LA SEMAINE FAIT FOI, ET IL FAUT LE DIRE (17/09/2026).
 *
 * « J'avais demandé lundi prochain, et il a dit lundi 22 septembre. Sauf que
 * le 22 septembre, c'est un mardi, il n'a pas vérifié. »
 *
 * Le résultat de l'outil disait pourtant « LIBRE le mardi 22 septembre »: le
 * jour y est depuis 6novovicies. Ce qui manquait n'est pas le FAIT, c'est la
 * consigne de s'y tenir. Le modèle a gardé sa propre résolution (« lundi
 * prochain ») et l'a collée devant la date du résultat, exactement comme il
 * annonçait une fermeture par-dessus une fenêtre d'ouverture qui la
 * contredisait (6duoquinquagesies). Ajouter un fait ne suffit pas quand le
 * modèle a déjà une phrase à lui; il faut lui dire laquelle des deux gagne.
 *
 * Vit dans le RÉSULTAT D'OUTIL, donc zéro caractère au prompt rejoué.
 */
function weekdayNote(day: string, lang: string): string {
  /* « mardi 22 septembre 2026 » → « mardi ». `spokenDate` met toujours le jour
     de semaine en tête, dans les trois langues. */
  const weekday = day.split(' ')[0];
  if (lang === 'fr') {
    return ` Ce jour est un ${weekday.toUpperCase()}, et c'est cette date qui fait foi: si l'appelant a nomme un AUTRE jour de la semaine, dis-lui que c'est un ${weekday} et demande lequel il veut. N'annonce jamais un jour de semaine different de celui-ci.`;
  }
  if (lang === 'nl') {
    return ` Die dag is een ${weekday.toUpperCase()}: noemde de beller een ANDERE weekdag, zeg het hem en vraag welke hij wil. Noem nooit een andere weekdag dan deze.`;
  }
  return ` That day is a ${weekday.toUpperCase()}, and this date is authoritative: if the caller named a DIFFERENT weekday, tell them and ask which one they want. Never announce a weekday other than this one.`;
}

/**
 * L'heure demandée, ramenée à la forme des créneaux (« 13:00 »).
 *
 * TOLÉRANTE À DESSEIN, et ce n'est pas du confort. `parseTimeToMinutes` exige
 * `HH:MM` strict, ce qui est juste pour l'heure qu'on ÉCRIT en base; ici on lit
 * ce qu'un modèle a tapé d'après une phrase parlée, et il écrit « 13h »,
 * « 13 » ou « 13h00 » aussi souvent que « 13:00 ». Une heure qu'on ne sait pas
 * lire retombe en silence sur la liste entière, c'est-à-dire exactement le
 * défaut que cet argument existe pour fermer.
 */
function slotForm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().toLowerCase().replace(/\s+/g, '').match(/^(\d{1,2})(?:[:h](\d{2}))?h?$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = m[2] === undefined ? 0 : Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Les deux créneaux libres les plus proches de l'heure demandée, rendus dans
 * l'ordre de la journée: « le plus proche » se calcule sur l'écart, mais se DIT
 * dans l'ordre, sinon « 14:00 et 12:00 » sort de la bouche de l'agent.
 */
function nearestSlots(free: string[], wantedMinutes: number, howMany = 2): string[] {
  return [...free]
    .sort((a, b) => {
      const da = Math.abs((parseTimeToMinutes(a) ?? 0) - wantedMinutes);
      const db = Math.abs((parseTimeToMinutes(b) ?? 0) - wantedMinutes);
      return da - db;
    })
    .slice(0, howMany)
    .sort((a, b) => (parseTimeToMinutes(a) ?? 0) - (parseTimeToMinutes(b) ?? 0));
}

function windowNote(partOfDay: unknown, lang: string, open: string): string {
  const key = String(partOfDay || 'any');
  const label = PART_OF_DAY_LABELS[key];
  if (lang === 'fr') {
    const jamais = ` N'annonce JAMAIS une fermeture que les horaires ne disent pas: ce jour est ouvert ${open}.`;
    if (!label) return ` Ce sont TOUS les creneaux libres de la journee.${jamais}`;
    return ` Liste filtree sur ${label.fr} UNIQUEMENT: le reste de la journee n'a pas ete regarde.`
      + ` Si l'appelant veut une autre plage, rappelle checkAvailability avec partOfDay=any.${jamais}`;
  }
  const never = ` NEVER announce a closing the opening hours do not state: this day is open ${open}.`;
  if (!label) return ` These are ALL the free slots of the day.${never}`;
  return ` List filtered to ${label.en} ONLY: the rest of the day was not checked.`
    + ` If the caller wants another range, call checkAvailability again with partOfDay=any.${never}`;
}

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
    /* Pas de garde « date lointaine » ici: `checkAvailability` ne fait que
       LIRE, et regarder un jour dans six mois ne coûte rien. La confirmation
       est due au moment d'ÉCRIRE, sur les deux outils qui posent la ligne. */
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

    const note = windowNote(args.partOfDay, profile.language, hours || '?') + weekdayNote(day, profile.language);

    if (free.length === 0) {
      const fallback = slots.filter(s => !held.includes(s));
      if (fallback.length === 0) {
        /* « Tout est pris » n'est pas « c'est fermé », et le résultat le dit:
           sans cette ligne le modèle transforme un agenda plein en fermeture. */
        return profile.language === 'fr'
          ? `AUCUN CRENEAU le ${day} (${args.date}, ouvert ${hours}): tout est pris, l'entreprise est OUVERTE ce jour-la. Propose un autre jour.${weekdayNote(day, profile.language)}`
          : `NO SLOTS on ${day} (${args.date}, open ${hours}): fully booked, the business IS open that day. Offer another day.${weekdayNote(day, profile.language)}`;
      }
      return profile.language === 'fr'
        ? `RIEN sur la plage demandee le ${day} (${args.date}, ouvert ${hours}), mais libre a: ${fallback.join(', ')}. Propose ces horaires, un par un.${note}`
        : `NOTHING in the requested window on ${day} (${args.date}, open ${hours}), but free at: ${fallback.join(', ')}. Offer these instead, one at a time.${note}`;
    }

    /* L'HEURE DEMANDÉE EST RENDUE AVANT LA LISTE, et elle est la seule chose à
       dire quand elle est libre. Appel réel du 18/09/2026: neuf créneaux lus à
       voix haute (« 09, 10 heures, 11 heures... 17 heures »), l'appelant répond
       « 13 heures », et l'agent propose « 14 heures » — l'heure de son
       rendez-vous existant — trois fois, malgré deux corrections.
       « Propose-les un par un » était déjà écrit ici et n'a pas été suivi: une
       consigne noyée dans un résultat ne gagne pas contre une liste que le
       modèle a sous les yeux. Ce qu'il faut lui donner, c'est la PHRASE à dire,
       pas la règle à appliquer (6novoquadragesies, weekdayNote). */
    const wanted = slotForm(args.preferredTime);
    const wantedMinutes = wanted === null ? null : parseTimeToMinutes(wanted);
    if (wanted && wantedMinutes !== null) {
      if (free.includes(wanted)) {
        return profile.language === 'fr'
          ? `${wanted} EST LIBRE le ${day} (${args.date}, ouvert ${hours}). C'est l'heure que l'appelant vient de demander: confirme ${wanted}, exactement ce chiffre, et ne propose AUCUNE autre heure.${note} Il te faut son prenom et son nom de famille (s'il ne les a pas deja donnes, un inconnu epelle le nom), puis bookAppointment, ou rescheduleBooking s'il deplace un rendez-vous existant; c'est fait seulement apres le retour de l'outil.`
          : `${wanted} IS FREE on ${day} (${args.date}, open ${hours}). That is the time the caller just asked for: confirm ${wanted}, that exact figure, and offer NO other time.${note} You need their first name and family name (unless already given; an unknown caller spells it), then bookAppointment, or rescheduleBooking if they are moving an existing appointment; it is done only after the tool returns.`;
      }
      const near = nearestSlots(free, wantedMinutes);
      return profile.language === 'fr'
        ? `${wanted} N'EST PAS LIBRE le ${day} (${args.date}, ouvert ${hours}). Dis-lui que ${wanted} est deja pris, puis propose ${near[0]} — une seule heure, pas la liste.${near[1] ? ` S'il refuse: ${near[1]}.` : ''}${note}`
        : `${wanted} IS NOT FREE on ${day} (${args.date}, open ${hours}). Tell them ${wanted} is taken, then offer ${near[0]} — one time only, not the list.${near[1] ? ` If they decline: ${near[1]}.` : ''}${note}`;
    }

    /* Le jour de la semaine est DIT avec la date: « lundi 17 juin » annoncé
       pour un jour qui n'était pas un lundi (appel réel, 12/09/2026). Le
       modèle ne calcule pas les jours, il les lit. */
    /* La suite est dite ICI, au moment où le modèle la lit: réserver demande
       prénom et nom de famille. Sans cette ligne, « oui je confirme » menait
       droit à « je vous réserve ça » sans nom, donc sans réservation
       (appel réel, 15/09/2026). */
    return profile.language === 'fr'
      ? `LIBRE le ${day} (${args.date}, ouvert ${hours}) a: ${free.join(', ')}.${note} NE LIS PAS CETTE LISTE A VOIX HAUTE: propose ${free[0]} d'abord, et une autre heure seulement s'il refuse. Quand l'appelant accepte ou nomme une heure: prenom et nom de famille (s'il ne les a pas deja donnes, un inconnu epelle le nom), puis bookAppointment; c'est reserve seulement apres son retour RESERVE.`
      : `FREE on ${day} (${args.date}, open ${hours}) at: ${free.join(', ')}.${note} DO NOT READ THIS LIST OUT LOUD: offer ${free[0]} first, and another time only if they decline. Once the caller accepts or names a time: first name and family name (unless already given; an unknown caller spells it), then bookAppointment; it is booked only after its BOOKED result.`;
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
    /* Les noms de CE client sont interdits: l'agent se presente a chaque appel,
       donc son prenom est le seul nom propre d'un transcript ou l'appelant n'a
       rien dit (19/09/2026, trois rendez-vous au nom de l'agent). */
    const nameIssue = nameProblem(customerName, [profile.agentName, profile.businessName]);
    if (!date || minutes === null || nameIssue) {
      return missingBookingInfo(profile.language, { name: nameIssue, date: !date, time: minutes === null }, customerName);
    }
    const past = pastDateReply(profile, args.date);
    if (past) return past;
    const far = farDateReply(profile, vapiCallId, args.date);
    if (far) return far;
    const closed = closedDayReply(profile, args.date);
    if (closed) return closed;
    const outside = outsideHoursReply(profile, String(args.date).trim(), minutes);
    if (outside) return outside;

    /* Un appelant inconnu ÉPELLE d'abord son nom de famille (13/09). */
    if (await this.needsCallerSpelling(profile, vapiCallId)) {
      return notBookedYet(profile.language) + askCallerToSpell(profile.language, customerName);
    }
    /* Le nom est relu AVANT d'écrire dans l'agenda: une réservation au
       mauvais nom se corrige à la main par le commerçant, et il ne le sait
       même pas. Une fois par nom et par appel; un nom déjà relu pendant
       `captureLead` ne l'est pas deux fois. */
    if (callSessionStore.needsNameReadBack(vapiCallId, customerName)) {
      return notBookedYet(profile.language) + confirmNameBeforeBooking(profile.language, customerName);
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

  /**
   * Un SMS ne se promet que s'il peut partir: identifiants, et un expéditeur
   * pour CE client. La réponse est retenue quelques minutes par client: elle
   * était relue en base sur le chemin critique de `bookAppointment`, entre
   * l'écriture de la réservation et la phrase rendue au modèle, alors que
   * l'expéditeur d'un client ne change qu'à l'attribution d'une ligne.
   */
  private readonly smsSenderMemo = new Map<string, { ok: boolean; at: number }>();
  /** Le même relevé, lancé à l'ouverture de l'appel pour ne pas le payer à la réservation. */
  async warmSmsSender(clientId: string): Promise<void> {
    await this.canSendSms(clientId);
  }
  private async canSendSms(clientId: string): Promise<boolean> {
    if (!smsReadiness().ok) return false;
    const memo = this.smsSenderMemo.get(clientId);
    if (memo && Date.now() - memo.at < SMS_SENDER_MEMO_MS) return memo.ok;
    const { smsService } = await import('../sms.service');
    const ok = !!(await smsService.senderFor(clientId));
    this.smsSenderMemo.set(clientId, { ok, at: Date.now() });
    return ok;
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
      return this.bookingNotFoundReply(profile, vapiCallId, 'lookupBooking');
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
  /**
   * « Aucune réservation trouvée », dit une fois comme une invitation à
   * chercher, la seconde fois comme un arrêt.
   *
   * Le 16/09/2026, `rescheduleBooking` a été appelé NEUF fois avec les mêmes
   * arguments. Deux causes qui se renforçaient: le résultat disait « puis
   * rappelle rescheduleBooking avec ce nom », donc il INVITAIT le rappel; et
   * rien ne comptait les essais. L'appelant a entendu « je déplace votre
   * rendez-vous » sept fois, puis l'agent a inventé un repli qui n'existe pas
   * (« je note votre demande et je transmets à l'équipe ») sans appeler le
   * moindre outil: personne n'a jamais été rappelé.
   *
   * La règle vient de 6septies, payée sur les numéros dictés: au DEUXIÈME
   * échec on change de canal. La cause (réservation inexistante, nom qui ne
   * correspond à rien) ne bouge pas entre deux essais, donc un troisième essai
   * refait ce qui vient de rater deux fois.
   *
   * Le second message dit AUSSI d'appeler `captureLead`: annoncer un rappel
   * sans l'enregistrer est le plus coûteux des défauts de cette nuit, parce
   * que l'appelant raccroche en croyant qu'on s'occupe de lui.
   */
  private bookingNotFoundReply(
    profile: ClientVoiceProfile,
    vapiCallId: string | null,
    tool: 'lookupBooking' | 'rescheduleBooking',
  ): string {
    const attempts = callSessionStore.noteToolFailure(vapiCallId, `${tool}:not-found`);
    const fr = profile.language === 'fr';

    if (attempts >= 2) {
      return fr
        ? `AUCUNE RESERVATION trouvee, et c'est le ${attempts}e essai. N'appelle PLUS ${tool} sur cet appel: `
          + 'la cause ne changera pas. Dis simplement que tu ne retrouves pas la reservation, '
          + 'puis appelle captureLead pour enregistrer la demande et le rappel. '
          + "N'annonce ni deplacement ni rappel tant que captureLead n'a pas repondu."
        : `NO BOOKING found, and this is attempt ${attempts}. Do NOT call ${tool} again on this call: `
          + 'the cause will not change. Say plainly that you cannot find the booking, '
          + 'then call captureLead to record the request and the callback. '
          + 'Do not promise a move or a callback until captureLead has answered.';
    }

    return fr
      ? 'AUCUNE RESERVATION trouvee pour ce correspondant. Demande sous quel nom elle a ete prise, '
        + `puis rappelle ${tool} avec ce nom. Une seule fois: si ca echoue encore, prends le message.`
      : 'NO BOOKING found for this caller. Ask which name it was booked under, '
        + `then call ${tool} again with that name. Once only: if it fails again, take a message.`;
  }

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
    const select = { id: true, customerName: true, customerPhone: true, bookingDate: true, bookingTime: true, serviceType: true, googleEventId: true };

    /* LE NUMÉRO DE L'APPELANT N'A PAS D'HORIZON, et c'est le correctif du
       17/09/2026. La lecture unique bornait à 90 jours, avec un `take: 300`
       pris sur les plus PROCHES. Un rendez-vous plus loin était donc
       invisible, et `lookupBooking` répondait « AUCUNE RESERVATION trouvee »
       sur une réservation qui existait, sous le bon nom et le bon numéro:
       relevé sur un appel réel, trois échecs de suite, l'appelant raccrochant
       avec un rappel promis. Le rendez-vous était au 22 mars 2027, poussé là
       par la dérive d'année de 6octoquadragesies — mais 90 jours coupent aussi
       un simple contrôle dentaire à six mois, qui est la NORME du métier
       (douze tests l'ont dit quand on a essayé de borner `farDateReply` à deux
       mois). La borne était une commodité de lecture, jamais une règle.

       Le numéro se compare par ses ÉCRITURES (`phoneForms`): stocké tantôt
       « 32483620980 » par `normalizeNumber`, tantôt « +32… » selon la source.
       Une égalité exacte ratait donc le même numéro sans rien dire. */
    const numberForms = callerNumber ? phoneForms(callerNumber) : [];
    const byNumber = numberForms.length
      ? await prisma.clientBooking.findMany({
          where: { clientId: profile.clientId, status: 'confirmed', bookingDate: { gte: now }, customerPhone: { in: numberForms } },
          orderBy: { bookingDate: 'asc' },
          take: 20,
          select,
        })
      : [];

    /* La recherche par NOM garde une fenêtre: elle est relue en mémoire sur
       toutes les réservations à venir du commerce, pas sur celles d'un
       appelant, parce que la base ne sait pas comparer deux noms ENTENDUS
       (« de la Ford », « Delaforde » et « de la foireux » sont tous « de la
       forge »). Un an couvre ce que prend un client qui réserve à l'avance,
       et `take` garde la lecture petite. */
    const byName = name
      ? await prisma.clientBooking.findMany({
          where: {
            clientId: profile.clientId,
            status: 'confirmed',
            bookingDate: { gte: now, lte: new Date(now.getTime() + 366 * 24 * 3600 * 1000) },
            ...(numberForms.length ? { customerPhone: { notIn: numberForms } } : {}),
          },
          orderBy: { bookingDate: 'asc' },
          take: 300,
          select,
        })
      : [];

    const rows = [...byNumber, ...byName];

    return rows
      .map(row => {
        let score = 0;
        if (row.customerPhone && numberForms.includes(row.customerPhone)) score += 2;
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
    const far = farDateReply(profile, vapiCallId, args.date);
    if (far) return far;
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
      return this.bookingNotFoundReply(profile, vapiCallId, 'rescheduleBooking');
    }

    const time = String(args.time);

    /* DÉJÀ LÀ: on ne redéplace pas un rendez-vous vers l'endroit où il est.
     *
     * Appel réel du 17/09/2026: `rescheduleBooking` appelé DEUX fois à quatre
     * secondes d'intervalle, avec les mêmes arguments, et l'agenda Google du
     * gérant s'est retrouvé avec DEUX événements sur le même créneau, pour une
     * seule ligne en base. La capture d'écran le montre: « Appointment - la
     * forge » et « Appointment - Jean-Luc de la », mardi 22, 14 h.
     *
     * La course: la mise à jour posait `googleEventId: null` AVANT un
     * `moveCalendarEvent` qui n'est pas attendu. Le second appel relisait donc
     * `null`, n'avait plus rien à supprimer, et créait un second événement.
     * Le correctif d'en dessous ferme la course; celui-ci ferme la CAUSE, car
     * un modèle qui rappelle un outil avec les mêmes arguments est le
     * comportement connu de ce chemin (6sexquadragesies, neuf appels).
     *
     * Et c'est aussi la bonne réponse métier: l'appelant n'a rien demandé de
     * neuf, donc il n'y a rien à faire ni à annoncer autrement. */
    if (ymdOf(booking.bookingDate) === ymdOf(date) && booking.bookingTime === time) {
      const already = spokenDate(date, profile.language, profile.timezone);
      return profile.language === 'fr'
        ? `DEJA FAIT: le rendez-vous de ${booking.customerName} est deja au ${already} a ${time}. N'appelle PLUS rescheduleBooking. Confirme simplement a voix haute, en nommant le jour, et demande s'il faut autre chose.`
        : `ALREADY DONE: ${booking.customerName}'s appointment is already on ${already} at ${time}. Do NOT call rescheduleBooking again. Just confirm out loud, naming the day, and ask if they need anything else.`;
    }

    try {
      await prisma.clientBooking.update({
        where: { id: booking.id },
        /* `googleEventId` N'EST PAS EFFACÉ ICI. L'effacer avant un déplacement
           d'agenda qu'on n'attend pas perd la seule référence de l'ancien
           événement, et c'est ce qui a produit le doublon. `moveCalendarEvent`
           écrit le nouvel identifiant quand il a fini; d'ici là, l'ancien
           reste la bonne réponse à « quel événement porte ce rendez-vous ». */
        data: { bookingDate: date, bookingTime: time, calendarSyncedAt: null },
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
      /* Un nom bidon (« client », « inconnu ») n'entre ni dans le CRM ni
         dans la mémoire d'appelant: il y resterait, et l'agent le redirait. */
      name: typeof args.name === 'string' && !isPlaceholderName(args.name, [profile.agentName, profile.businessName]) ? normaliseSpelledName(args.name) || null : null,
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
