/**
 * La date qu'un MODÈLE a écrite ne se pose pas en base sans être relue.
 *
 * ## Ce que ça a coûté, relevé au docteur le 16/09/2026
 *
 * Sur un vrai compte, la réservation la plus récemment créée portait
 * `2023-09-18` alors que la conversation parlait du vendredi 18 septembre
 * 2026. Trois ans dans le passé, et personne ne l'a vu, parce qu'une
 * réservation passée ne fait rien de visible : elle ne s'affiche pas dans le
 * calendrier du portail (chargé par mois), le gérant ne la voit donc jamais,
 * et surtout `lookupBooking` et `rescheduleBooking` ne cherchent QUE les
 * rendez-vous à venir (`bookingDate: { gte: now }`).
 *
 * D'où le symptôme, qui n'avait rien à voir avec ce qu'on cherchait :
 * l'appelant demande à déplacer son rendez-vous, il en a bien un, et l'agent
 * répond « AUCUNE RESERVATION trouvee » neuf fois de suite. La boucle a été
 * bornée (le résultat cesse d'inviter au deuxième échec) mais la CAUSE était
 * ici : la ligne existait, illisible par construction.
 *
 * ## Pourquoi le modèle invente une année
 *
 * Parce qu'on ne la lui donnait pas. Le transcript dit « vendredi 18
 * septembre », jamais l'année, et la consigne d'analyse ne disait pas quel
 * jour on était. C'est 6novovicies (« L'agent ne connaissait pas la date »)
 * appliqué à l'agent et oublié sur le modèle d'ANALYSE : la même règle posée
 * sur un chemin et pas sur l'autre.
 *
 * ## La règle : refuser, jamais corriger
 *
 * On pourrait « rattraper » une année passée en la remplaçant par celle qui
 * met la date dans le futur. Ce serait fabriquer un rendez-vous que personne
 * n'a dit, c'est-à-dire exactement 6quinvicies : une déduction qui a l'air
 * d'une lecture. Une date invalide ou passée est donc REFUSÉE, et le refus
 * est bruyant : un appelant qui voulait un rendez-vous et n'en a aucun en
 * base est quelque chose que le gérant doit apprendre, pas une ligne de
 * journal.
 *
 * Ce chemin ne concerne QUE le rattrapage d'après-appel. Une réservation
 * prise pendant l'appel passe par `bookAppointment`, qui a déjà ses gardes
 * (format strict, date passée, jour fermé, hors horaires).
 */

export type AnalysisDate =
  | { ok: true; date: Date; ymd: string }
  | { ok: false; reason: string };

/**
 * @param raw ce que le modèle a rendu pour `bookingDate`.
 * @param todayYmd aujourd'hui dans le fuseau de l'ENTREPRISE (`todayIso`),
 *   jamais celui du serveur : à Bruxelles il est déjà demain quand le
 *   processus d'Oregon croit qu'on est la veille.
 */
export function parseAnalysisDate(raw: unknown, todayYmd: string): AnalysisDate {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, reason: 'aucune date rendue' };
  }
  const text = raw.trim();

  /* Les dix premiers caractères, et ils doivent avoir la bonne FORME. La
     consigne demande « ISO string », donc le modèle rend tantôt
     `2026-09-18`, tantôt `2026-09-18T09:00:00Z`. Tout le reste
     (« 18/09/2026 », « next Friday », « September 18 ») est refusé plutôt
     que confié à `new Date`, qui accepte des formes dont le résultat dépend
     du moteur. */
  const ymd = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { ok: false, reason: `date illisible: « ${text.slice(0, 40)} »` };
  }

  /* Midi UTC, comme `parseDate` côté outils: un jour stocké à minuit se relit
     la veille dans un fuseau à l'ouest, et le serveur est en Oregon. */
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== ymd) {
    /* `new Date('2026-02-31T12:00:00Z')` ne lève pas, il glisse au 3 mars.
       Comparer la relecture est ce qui écarte un jour qui n'existe pas. */
    return { ok: false, reason: `jour inexistant: ${ymd}` };
  }

  if (ymd < todayYmd) {
    return {
      ok: false,
      reason: `date PASSÉE: ${ymd}, alors que nous sommes le ${todayYmd}. `
        + "L'année vient du modèle, pas de l'appelant: aucune réservation n'est créée.",
    };
  }

  return { ok: true, date, ymd };
}

/**
 * La ligne donnée au modèle d'analyse pour qu'il cesse d'inventer l'année.
 *
 * Écrite en anglais comme le reste de la consigne d'analyse : la langue de la
 * consigne décide de la langue de la réponse (`ANALYSIS_LANGUAGE` existe
 * précisément pour forcer l'autre sens sur les champs libres), donc la
 * traduire ferait basculer le reste.
 */
export function analysisDateRule(todayYmd: string): string {
  return `Today is ${todayYmd}. bookingDate must be YYYY-MM-DD and must not be before today: `
    + 'when the transcript names a day without a year (for example "Friday the 18th"), '
    + 'use the next occurrence of that day on or after today. Never guess a year.';
}
