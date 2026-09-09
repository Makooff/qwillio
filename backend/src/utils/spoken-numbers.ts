/**
 * Les nombres tels qu'un francophone les DIT, ramenés à des chiffres.
 *
 * ── Pourquoi ce fichier existe (BEL-1) ─────────────────────────────────────
 *
 * Un appelant belge dit « septante-cinq », « nonante-et-un », « zéro quatre
 * septante-cinq douze trente-quatre cinquante-six ». Le normaliseur de
 * référence en français (NeMo) connaît `septante` et `nonante` mais pas les
 * formes en « et un »: 71 et 91 échouent donc SILENCIEUSEMENT, ce qui est le
 * pire des deux mondes — rien dans les journaux, et un client qui ne se fait
 * jamais rappeler.
 *
 * Le formateur du fournisseur (`formatPlan` de Vapi) travaille dans l'autre
 * sens et hors de notre vue: il met en forme ce que l'agent DIT, pas ce que
 * l'appelant dicte, et nous n'avons aucun jeu de tests dessus.
 *
 * ── Ce que ce module fait, et ne fait pas ──────────────────────────────────
 *
 * Il rend des CHIFFRES, pas un numéro de téléphone. La validité d'un numéro
 * est une autre question, tranchée par libphonenumber dans `phone-spoken.ts`:
 * séparer les deux est ce qui permet à une segmentation douteuse de finir en
 * « pouvez-vous répéter ? » au lieu d'un mauvais numéro enregistré.
 */

/** Les mots-nombres, valeur par valeur. Les variantes régionales incluses. */
const WORDS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
  sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
  quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30,
  quarante: 40, cinquante: 50, soixante: 60,
  /* Belgique et Suisse. `octante` et `huitante` ne sont pas belges mais ne
     coûtent rien et évitent un échec silencieux sur un appelant suisse. */
  septante: 70, octante: 80, huitante: 80, nonante: 90,
  cent: 100, cents: 100,
};

function tokenize(raw: string): string[] {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    /* Le trait d'union ET l'apostrophe deviennent des espaces: « quatre-vingt »
       et « quatre vingt » sont le même nombre dit par deux claviers. */
    .replace(/[-'’]/g, ' ')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const isUnit = (v: number | undefined) => v !== undefined && v >= 1 && v <= 9;
const isTeen = (v: number | undefined) => v !== undefined && v >= 10 && v <= 16;
const isTens = (v: number | undefined) => v !== undefined && v >= 20 && v <= 90 && v % 10 === 0;

/**
 * Un nombre de 0 à 999, lu à partir de `i`.
 *
 * Descente récursive plutôt qu'un tableau de correspondances: les formes
 * françaises se COMPOSENT (« quatre-vingt-dix-sept » vaut 80 + 10 + 7) et
 * énumérer les compositions revient à écrire la grammaire en moins lisible.
 *
 * Rend `null` quand le mot ne commence aucun nombre, ce qui laisse l'appelant
 * dire ce qu'il veut entre deux groupes de chiffres.
 */
function readNumber(tokens: string[], i: number): { value: number; next: number } | null {
  const at = (k: number) => WORDS[tokens[k]];
  if (at(i) === undefined) return null;

  let value = 0;
  let k = i;

  // ── Les centaines: « cinq cent douze », le groupement de « 02 512 34 56 ».
  if (isUnit(at(k)) && at(k + 1) === 100) {
    value = at(k)! * 100;
    k += 2;
  } else if (at(k) === 100) {
    value = 100;
    k += 1;
  }

  const startedHundreds = k > i;
  if (at(k) === undefined) return startedHundreds ? { value, next: k } : null;

  // ── « quatre-vingt » et sa descendance.
  let tens = 0;
  if (at(k) === 4 && at(k + 1) === 20) {
    tens = 80;
    k += 2;
  } else if (isTens(at(k))) {
    tens = at(k)!;
    k += 1;
  }

  if (tens) {
    value += tens;
    // « vingt-et-un », « septante-et-un », « soixante-et-onze ».
    if (tokens[k] === 'et' && (isUnit(at(k + 1)) || at(k + 1) === 11)) {
      value += at(k + 1)!;
      return { value, next: k + 2 };
    }
    /* 60 et 80 absorbent une dizaine complète (« soixante-douze »,
       « quatre-vingt-dix-sept »), les autres non: « septante-douze » ne se dit
       pas, et l'accepter fabriquerait un nombre là où l'appelant en dictait
       deux. C'est toute la différence entre la France et la Belgique, et elle
       tient dans cette condition. */
    if ((tens === 60 || tens === 80) && (isTeen(at(k)) || at(k) === 10)) {
      const teen = readTeen(tokens, k);
      value += teen.value;
      return { value, next: teen.next };
    }
    if (isUnit(at(k))) return { value: value + at(k)!, next: k + 1 };
    return { value, next: k };
  }

  // ── Dix à dix-neuf, puis les unités.
  if (at(k) === 10 || isTeen(at(k))) {
    const teen = readTeen(tokens, k);
    return { value: value + teen.value, next: teen.next };
  }
  if (at(k) !== undefined && at(k)! <= 9) return { value: value + at(k)!, next: k + 1 };

  return startedHundreds ? { value, next: k } : null;
}

/** « dix », « douze », « dix-sept ». */
function readTeen(tokens: string[], k: number): { value: number; next: number } {
  const v = WORDS[tokens[k]]!;
  if (v === 10) {
    const unit = WORDS[tokens[k + 1]];
    if (unit !== undefined && unit >= 7 && unit <= 9) return { value: 10 + unit, next: k + 2 };
  }
  return { value: v, next: k + 1 };
}

/**
 * La suite de chiffres dictée dans une phrase.
 *
 * Chaque groupe est écrit tel qu'il se prononce: « zéro » donne `0`,
 * « septante-cinq » donne `75`, « cinq cent douze » donne `512`. La
 * concaténation reproduit alors la dictée, y compris le zéro initial, qu'un
 * calcul aurait perdu.
 *
 * `double sept` vaut `77`: c'est une dictée courante, et la rater coûte un
 * chiffre au milieu d'un numéro.
 */
export function spokenDigits(raw: string): string {
  const tokens = tokenize(raw);
  let out = '';

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];

    if (/^\d+$/.test(token)) {
      out += token;
      i += 1;
      continue;
    }

    if (token === 'double' || token === 'triple') {
      const times = token === 'double' ? 2 : 3;
      const read = readNumber(tokens, i + 1);
      if (read && read.value <= 9) {
        out += String(read.value).repeat(times);
        i = read.next;
        continue;
      }
    }

    const read = readNumber(tokens, i);
    if (read) {
      out += String(read.value);
      i = read.next;
      continue;
    }

    /* Un mot qui n'est pas un nombre sépare deux groupes, qu'il soit du
       remplissage attendu ou une phrase entière: dans les deux cas il ferme le
       groupe en cours sans rien écrire. */
    i += 1;
  }

  return out;
}
