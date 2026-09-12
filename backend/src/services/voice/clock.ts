import type { VoiceLanguage } from './speech-plans';

/**
 * LA DATE, dite à l'agent. Sans elle, il la devine.
 *
 * Relevé le 12/09/2026 sur un appel entrant réel: « je voudrais un détartrage
 * la semaine prochaine », et l'agent propose « lundi 17 juin », un jour qui
 * n'est pas un lundi et un mois qui est passé. Rien dans le prompt ne disait
 * quel jour on était, et la description de l'outil lui demandait pourtant de
 * « résoudre les dates relatives » avant d'appeler l'agenda: il les résolvait
 * depuis la date que son entraînement lui suggère.
 *
 * Trois endroits la portent, et il faut les trois:
 *  - le prompt bâti À L'APPEL (`buildSystemPrompt`), pour la ligne partagée;
 *  - l'assistant ENREGISTRÉ, dont le prompt est figé à la synchronisation:
 *    une date écrite en dur y serait fausse dès le lendemain, d'où le gabarit
 *    que Vapi remplit à chaque appel (`vapiClockLine`);
 *  - un bloc de queue sur le chemin custom-LLM (`clockBlock`), qui vaut quoi
 *    que Vapi fasse du gabarit, et qui reste hors du préfixe mis en cache.
 * Et l'agenda refuse une date passée en nommant le jour d'aujourd'hui, parce
 * qu'un modèle qui s'est trompé de mois ne se corrige pas seul.
 */
const LOCALE: Record<VoiceLanguage, string> = { fr: 'fr-FR', en: 'en-GB', nl: 'nl-BE' };

/** « vendredi 12 septembre 2026 », dans le fuseau de l'entreprise. */
export function spokenDate(date: Date, lang: VoiceLanguage, timezone: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone,
  }).format(date);
}

/** « 06:31 », dans le fuseau de l'entreprise. */
export function spokenTime(date: Date, lang: VoiceLanguage, timezone: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
  }).format(date);
}

/** `YYYY-MM-DD` du jour courant dans le fuseau de l'entreprise. */
export function todayIso(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone,
  }).format(now);
}

/** La phrase du prompt, avec une date réelle. */
export function clockLine(lang: VoiceLanguage, timezone: string, now: Date = new Date()): string {
  const date = spokenDate(now, lang, timezone);
  const time = spokenTime(now, lang, timezone);
  return lang === 'fr'
    ? `Nous sommes le ${date}, il est ${time} (${timezone}). Toute date relative (« demain », « lundi prochain », « la semaine prochaine ») se compte à partir d'aujourd'hui.`
    : lang === 'nl'
      ? `Vandaag is het ${date}, het is ${time} (${timezone}). Elke relatieve datum (« morgen », « volgende maandag », « volgende week ») telt vanaf vandaag.`
      : `Today is ${date}, the time is ${time} (${timezone}). Every relative date ("tomorrow", "next Monday", "next week") counts from today.`;
}

/**
 * La même phrase pour l'assistant ENREGISTRÉ, dont le prompt est figé: Vapi
 * remplit `{{"now" | date: …}}` à chaque appel, dans le fuseau donné. Les noms
 * de jour et de mois sortent en anglais, ce que le modèle lit sans peine; une
 * date juste en anglais vaut mieux qu'une date fausse en français.
 */
export function vapiClockLine(lang: VoiceLanguage, timezone: string): string {
  const now = `{{"now" | date: "%A %d %B %Y, %H:%M", "${timezone}"}}`;
  return lang === 'fr'
    ? `Nous sommes le ${now} (${timezone}). Toute date relative (« demain », « lundi prochain », « la semaine prochaine ») se compte à partir d'aujourd'hui.`
    : lang === 'nl'
      ? `Vandaag is het ${now} (${timezone}). Elke relatieve datum (« morgen », « volgende maandag », « volgende week ») telt vanaf vandaag.`
      : `Today is ${now} (${timezone}). Every relative date ("tomorrow", "next Monday", "next week") counts from today.`;
}

/** Le bloc de queue du chemin custom-LLM: la même phrase, à chaque tour. */
export function clockBlock(lang: VoiceLanguage, timezone: string, now: Date = new Date()): string {
  return clockLine(lang, timezone, now);
}
