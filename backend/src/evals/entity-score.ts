/**
 * L'exactitude par ENTITÉ, et pas un taux d'erreur global (TST-3).
 *
 * ## Pourquoi le taux global ne dit rien
 *
 * Un taux d'erreur de 12 % qui ne touche jamais un champ utile est sans
 * conséquence: l'agent a mal entendu un mot de politesse. Un taux de 4 % qui
 * casse systématiquement les noms de rue est fatal, parce que c'est le rappel
 * qui n'aboutit pas. La moyenne confond les deux et laisse choisir le mauvais
 * moteur.
 *
 * ## Ce que ce fichier mesure, et ce qu'il ne mesure PAS
 *
 * Il mesure la couche qu'on possède: ce que l'agent RETIENT et repose dans les
 * arguments de ses outils. Un appelant dit son nom, l'agent appelle
 * `captureLead({ name: … })`, on compare à la vérité du scénario.
 *
 * Il ne mesure pas la transcription. Les scénarios entrent en TEXTE, donc le
 * STT n'est pas dans la boucle: un nom mal entendu au téléphone ne se verra
 * pas ici. Dire le contraire ferait passer un chiffre flatteur pour une
 * garantie. Ce qui se mesure ici, c'est l'agent qui oublie de demander, qui
 * reformate une date, ou qui invente un champ qu'on ne lui a pas donné.
 *
 * ## Précision et rappel, et pourquoi les deux
 *
 * Le rappel seul récompenserait un agent qui remplit tous les champs au hasard.
 * La précision seule récompenserait un agent qui n'en remplit aucun. Un
 * réceptionniste doit capter ce qui a été dit ET ne rien inventer, et il faut
 * les deux nombres pour le voir.
 */

/** Les cinq entités qui décident d'un rappel. */
export const ENTITY_KINDS = ['name', 'phone', 'date', 'address', 'reason'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/**
 * Les arguments d'outil qui portent chaque entité.
 *
 * Une entité, plusieurs noms d'argument: `captureLead` dit `name` et
 * `bookAppointment` dit `customerName` pour la même chose. Les rassembler ici
 * évite qu'un scénario doive savoir quel outil l'agent a choisi — ce qui est
 * précisément la liberté qu'on lui laisse.
 */
const ARG_TO_ENTITY: Record<string, EntityKind> = {
  name: 'name',
  customerName: 'name',
  phone: 'phone',
  phoneNumber: 'phone',
  date: 'date',
  bookingDate: 'date',
  address: 'address',
  reason: 'reason',
  serviceType: 'reason',
};

export interface ToolInvocation {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Les entités que l'agent a réellement reposées, tous outils confondus.
 *
 * Le PREMIER gagne. Un agent qui appelle `bookAppointment` puis `captureLead`
 * donnerait deux fois le nom, et prendre le dernier ferait dépendre le score de
 * l'ordre des appels, qui n'a aucun sens métier.
 */
export function entitiesFrom(calls: ToolInvocation[]): Partial<Record<EntityKind, string>> {
  const found: Partial<Record<EntityKind, string>> = {};
  for (const call of calls) {
    for (const [arg, raw] of Object.entries(call.args ?? {})) {
      const kind = ARG_TO_ENTITY[arg];
      if (!kind || found[kind] !== undefined) continue;
      if (typeof raw !== 'string' || !raw.trim()) continue;
      found[kind] = raw.trim();
    }
  }
  return found;
}

/**
 * Comparaison tolérante à la forme, stricte sur le fond.
 *
 * Un numéro se compare sur ses CHIFFRES: « +32 475 12 34 56 » et
 * « 0475123456 » sont le même numéro, et exiger la même ponctuation ferait
 * échouer un agent qui a parfaitement fait son travail. Les indicatifs
 * nationaux sont réduits pour la même raison, en comparant par la fin — les
 * neuf derniers chiffres, ce qui suffit à distinguer deux abonnés belges sans
 * dépendre du préfixe choisi.
 *
 * Le reste se compare sur les lettres, accents et casse retirés: « rue de la
 * Loi 16 » vaut « Rue de la Loi, 16 ».
 */
export function entityMatches(kind: EntityKind, expected: string, actual: string): boolean {
  if (kind === 'phone') {
    const digits = (s: string) => s.replace(/\D/g, '');
    const a = digits(expected);
    const b = digits(actual);
    if (!a || !b) return false;
    const tail = Math.min(9, a.length, b.length);
    return a.slice(-tail) === b.slice(-tail);
  }

  const flat = (s: string) =>
    s.normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  return flat(expected) === flat(actual);
}

export interface EntityTally {
  /** Combien de fois cette entité était présente dans la vérité terrain. */
  expected: number;
  /** Combien de fois l'agent a produit une valeur. */
  captured: number;
  /** Combien de fois la valeur produite était la bonne. */
  correct: number;
}

export type EntityReport = Record<EntityKind, EntityTally & { precision: number | null; recall: number | null }>;

/** Une observation: ce que le scénario attendait, ce que l'agent a rendu. */
export interface EntityObservation {
  kind: EntityKind;
  expected: string;
  actual?: string;
}

/**
 * Le tableau par type d'entité que TST-3 réclame.
 *
 * `null` et non zéro quand le dénominateur est vide: une précision de 0 %
 * signifie « tout est faux », une précision inconnue signifie « rien n'a été
 * tenté ». Les afficher pareil ferait sonner l'alarme sur une entité qu'aucun
 * scénario ne couvre, et l'alarme finirait ignorée.
 */
export function scoreEntities(observations: EntityObservation[]): EntityReport {
  const report = {} as EntityReport;
  for (const kind of ENTITY_KINDS) {
    report[kind] = { expected: 0, captured: 0, correct: 0, precision: null, recall: null };
  }

  for (const obs of observations) {
    const row = report[obs.kind];
    if (!row) continue;
    row.expected += 1;
    if (obs.actual === undefined || obs.actual.trim() === '') continue;
    row.captured += 1;
    if (entityMatches(obs.kind, obs.expected, obs.actual)) row.correct += 1;
  }

  for (const kind of ENTITY_KINDS) {
    const row = report[kind];
    row.precision = row.captured > 0 ? row.correct / row.captured : null;
    row.recall = row.expected > 0 ? row.correct / row.expected : null;
  }
  return report;
}

/** Le tableau, en texte, pour la sortie du harnais. */
export function formatEntityReport(report: EntityReport): string {
  const pct = (v: number | null) => (v === null ? '   —' : `${Math.round(v * 100).toString().padStart(3)}%`);
  const lines = ['  entité     attendu  capté  juste  précision  rappel'];
  for (const kind of ENTITY_KINDS) {
    const r = report[kind];
    if (r.expected === 0 && r.captured === 0) continue;
    lines.push(
      `  ${kind.padEnd(10)} ${String(r.expected).padStart(7)} ${String(r.captured).padStart(6)} ` +
        `${String(r.correct).padStart(6)}      ${pct(r.precision)}    ${pct(r.recall)}`,
    );
  }
  return lines.length === 1 ? '  (aucune entité couverte par les scénarios joués)' : lines.join('\n');
}
