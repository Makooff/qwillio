import { clockLine, spokenDate } from './clock';
import { callerHistoryBlock } from './system-prompt';
import type { CallerHistory, ClientVoiceProfile } from './realtime-context.service';

/**
 * LE BRIEF: ce que l'assistant ENREGISTRÉ ne peut pas savoir, posé dans la
 * conversation au moment où l'appel s'ouvre.
 *
 * Son prompt est figé à la SYNCHRONISATION (6quindecies). Deux choses n'y
 * tiennent donc pas, et ce sont exactement les deux qui ont coûté des appels
 * réels:
 *
 *  - L'HISTORIQUE de l'appelant. Il naît vide, forcément: au moment où on
 *    écrit l'assistant, personne n'appelle. Sur le chemin custom-LLM,
 *    `llm-stream` repose `callerHistoryBlock` à chaque tour et le trou est
 *    bouché (6untrigesies). En parole-à-parole, Vapi parle à OpenAI
 *    directement: `llm-stream` ne tourne pas, donc RIEN de ce qu'il ajoute
 *    n'atteint l'appel (6quaterquadragesies). « On dirait qu'il ne me
 *    reconnaît pas » est le retour du premier appel en Superagent, et il
 *    décrivait le code.
 *
 *  - LA DATE. Le prompt figé porte le gabarit `{{"now" | date: …}}` que Vapi
 *    remplit à chaque appel (`vapiClockLine`), et ce mécanisme n'a jamais été
 *    vu tenir dans une session temps réel. Une date RÉELLE, calculée à
 *    l'instant, ne peut pas être fausse pour CET appel: elle ne dépend de
 *    personne. Et le mode d'échec est documenté et cher (6novovicies « lundi
 *    17 juin » un vendredi 12 septembre, 6octoquadragesies le rendez-vous
 *    parti en 2027).
 *
 * Elle est donc dite FAISANT FOI: si le gabarit n'a pas été rempli, le prompt
 * porte du charabia à cet endroit, et il faut que le modèle sache laquelle des
 * deux lignes croire.
 *
 * Le brief n'est jamais vide: la date vaut pour tout le monde. C'est
 * volontaire, parce qu'un mécanisme qui ne s'exercerait que sur un appelant
 * connu resterait endormi jusqu'au jour où on compte dessus, et un mécanisme
 * qui n'a jamais atteint un appel réel n'est pas une optimisation
 * (6octovicies, 6quinquetrigesies).
 */
/**
 * `YYYY-MM-DD` → midi UTC, la convention de tout le reste du dépôt: un jour
 * posé à minuit se relit la veille depuis l'Oregon (6octoquadragesies).
 */
function dayAtNoon(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function callBrief(
  profile: Pick<ClientVoiceProfile, 'language' | 'timezone'>,
  caller: CallerHistory | null,
  now: Date = new Date(),
): string {
  const lang = profile.language;
  const lines: string[] = [];

  lines.push(
    lang === 'fr'
      ? "CONTEXTE DE CET APPEL. Ce n'est pas l'appelant qui parle: ne réponds pas à ce message, continue la conversation normalement."
      : lang === 'nl'
        ? 'CONTEXT VAN DIT GESPREK. Dit is niet de beller: antwoord niet op dit bericht, zet het gesprek gewoon voort.'
        : 'CONTEXT FOR THIS CALL. This is not the caller speaking: do not answer this message, just carry on with the conversation.',
  );

  lines.push(clockLine(lang, profile.timezone, now));
  lines.push(
    lang === 'fr'
      ? "C'est cette date qui fait foi, avant toute autre date écrite plus haut."
      : lang === 'nl'
        ? 'Deze datum is de juiste, boven elke andere datum hierboven.'
        : 'This is the authoritative date, above any other date written earlier.',
  );

  /* `callerHistoryBlock` et pas une seconde rédaction: c'est le texte que le
     chemin custom-LLM pose à chaque tour, et deux règles écrites à la main
     pour la même question divergent en moins d'un mois (6vicies). Il rend
     `null` quand le numéro n'a jamais appelé, et il porte déjà la
     sanitisation de ce qui vient de la parole d'un appelant précédent. */
  const history = caller ? callerHistoryBlock(lang, caller) : null;
  if (history) lines.push(history);

  /* LES RENDEZ-VOUS, EN CLAIR, et pas seulement « il en a un ».
   *
   * Appel réel de 161 s (17/09/2026): l'appelant veut déplacer un rendez-vous,
   * son numéro le désigne, et `lookupBooking` n'est JAMAIS appelé. Le modèle
   * demande le nom, le fait épeler, consulte QUATRE fois les créneaux, invente
   * une date de septembre pour une réservation de mars, et l'appelant finit
   * par dire « tu as mon numéro, tu as simplement à aller chercher dans ta
   * base de données ». Il a raison.
   *
   * En parole-à-parole, le modèle est notablement plus faible sur l'appel
   * d'outils: lui demander d'en appeler un pour savoir QUI appelle est une
   * marche de trop. Ce que la base sait déjà se DIT, ça ne se fait pas
   * chercher. L'outil reste pour ce que le brief ne peut pas couvrir: un autre
   * nom, un appelant non reconnu, une réservation prise depuis une autre
   * ligne.
   *
   * La DATE est écrite en toutes lettres avec son année, parce que c'est
   * exactement ce que le modèle a raté deux fois: « 22 mars 2027 » entendu
   * puis cherché au 22 septembre 2026. */
  const bookings = caller?.upcomingBookings ?? [];
  if (bookings.length) {
    lines.push(
      lang === 'fr'
        ? 'RENDEZ-VOUS DEJA PRIS PAR CE NUMERO (tu les connais, ne les fais pas chercher):'
        : lang === 'nl'
          ? 'REEDS GEBOEKTE AFSPRAKEN OP DIT NUMMER (je kent ze al, laat ze niet opzoeken):'
          : 'APPOINTMENTS ALREADY BOOKED BY THIS NUMBER (you know them, do not go looking):',
    );
    for (const b of bookings) {
      const when = dayAtNoon(b.date);
      const day = when ? spokenDate(when, lang, profile.timezone) : b.date;
      lines.push(`- ${b.name}, ${day}${b.time ? ` ${lang === 'fr' ? 'a' : 'at'} ${b.time}` : ''}${b.service ? ` (${b.service})` : ''}`);
    }
    lines.push(
      lang === 'fr'
        ? "S'il veut en deplacer un, c'est celui-la: passe directement a checkAvailability pour la NOUVELLE date, puis rescheduleBooking avec currentDate (AAAA-MM-JJ) de la ligne ci-dessus. S'il veut l'ANNULER: cancelBooking avec ce meme currentDate. Ne redemande ni le nom ni la date actuelle."
        : lang === 'nl'
          ? 'Wil hij er een verzetten, dan is het deze: ga meteen naar checkAvailability voor de NIEUWE datum, dan rescheduleBooking met currentDate (JJJJ-MM-DD) van de regel hierboven. Wil hij ze ANNULEREN: cancelBooking met datzelfde currentDate. Vraag naam noch huidige datum opnieuw.'
          : 'If they want to move one, that is the one: go straight to checkAvailability for the NEW date, then rescheduleBooking with the currentDate (YYYY-MM-DD) of the line above. If they want to CANCEL it: cancelBooking with that same currentDate. Do not ask again for the name or the current date.',
    );
  }

  return lines.join('\n');
}
