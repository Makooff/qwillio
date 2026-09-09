/**
 * Ce que l'agent DIT, écrit pour être prononcé et non pour être lu (BEL-12).
 *
 * ── Le principe ───────────────────────────────────────────────────────────
 *
 * Le synthétiseur ne doit jamais avoir à deviner. `02 512 34 56` envoyé tel
 * quel se prononce de trois façons selon le modèle, la langue détectée et
 * l'humeur du normaliseur du fournisseur — sur lequel nous n'avons ni
 * visibilité ni jeu de tests. On envoie donc l'énoncé COMPLET, avec ses
 * pauses.
 *
 * Le contrôle phonémique n'est pas une option: en français, il force chez
 * ElevenLabs sur `eleven_v3`, qui n'est pas le modèle basse latence. On ne peut
 * pas avoir à la fois les 288 ms de Flash et l'API phonétique. Le repli est
 * lexical — écrire ce qui doit être dit — et il a l'avantage de marcher sur
 * tous les modèles, Cartesia compris.
 *
 * ── La relecture d'un numéro se fait chiffre par chiffre ──────────────────
 *
 * Pas « zéro quatre septante-cinq »: pour CONFIRMER, l'appelant doit pouvoir
 * suivre chiffre à chiffre, et une relecture groupée demande un effort de
 * conversion à celui qui écoute. C'est aussi la seule forme qui ne dépende pas
 * de la variante régionale de celui qui écoute.
 */

/**
 * 0 à 19, la base à partir de laquelle tout le reste se compose.
 *
 * Jusqu'à DIX-NEUF et pas seize: la France compose 70 et 90 sur les
 * adolescents (« soixante-dix-sept », « quatre-vingt-dix-neuf »), donc les
 * arrêter à seize laisse trois trous pile là où la variante française se joue.
 */
const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const TENS: Record<number, string> = {
  20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante',
};

export type FrenchVariant = 'fr' | 'be';

/**
 * Un nombre de 0 à 999, en toutes lettres.
 *
 * La variante n'est pas un détail de style: un Belge à qui l'on dit
 * « soixante-quinze » comprend, mais un agent qui dit « soixante-quinze » à
 * Namur s'entend comme un agent français. C'est exactement le contraire de ce
 * que ce produit vend.
 */
export function numberWords(n: number, variant: FrenchVariant = 'be'): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n < 20) return UNITS[n];

  /* Les milliers servent aux codes postaux belges, qui en ont tous quatre:
     1000 Bruxelles se dit « mille », 4000 Liège « quatre mille ». */
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const head = thousands === 1 ? 'mille' : `${UNITS[thousands]} mille`;
    return rest === 0 ? head : `${head} ${numberWords(rest, variant)}`;
  }

  if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const head = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`;
    if (rest === 0) return hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cents`;
    return `${head} ${numberWords(rest, variant)}`;
  }

  const tens = Math.floor(n / 10) * 10;
  const rest = n % 10;

  if (tens === 70 || tens === 90) {
    if (variant === 'be') {
      const base = tens === 70 ? 'septante' : 'nonante';
      if (rest === 0) return base;
      return rest === 1 ? `${base}-et-un` : `${base}-${UNITS[rest]}`;
    }
    // France: 70 et 90 se composent sur 60 et quatre-vingt.
    if (tens === 70) return rest === 1 ? 'soixante-et-onze' : `soixante-${UNITS[10 + rest]}`;
    return `quatre-vingt-${UNITS[10 + rest]}`;
  }

  if (tens === 80) return rest === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITS[rest]}`;

  if (n < 20) return UNITS[n];
  if (rest === 0) return TENS[tens];
  if (rest === 1) return `${TENS[tens]}-et-un`;
  return `${TENS[tens]}-${UNITS[rest]}`;
}

/**
 * Un numéro de téléphone, chiffre par chiffre, groupé par la ponctuation.
 *
 * La virgule est la pause: elle est comprise par les deux synthétiseurs et ne
 * demande aucune balise. Les groupes reprennent le découpage national
 * (`0475 12 34 56`), qui est celui que l'appelant a en tête.
 */
export function phoneWords(national: string): string {
  // \u00A0 en toutes lettres: l'espace insécable des groupes à la française est
  // invisible dans le source, et un jour quelqu'un la retape en espace normale.
  const groups = national.trim().split(/[\s.\u00A0]+/).filter(Boolean);
  if (!groups.length) return '';
  return groups
    .map(group =>
      group
        .split('')
        .filter(c => /\d/.test(c))
        .map(d => UNITS[Number(d)])
        .join(' '),
    )
    .filter(Boolean)
    .join(', ');
}

/** « 9h30 » → « neuf heures trente ». « 14h » → « quatorze heures ». */
export function timeWords(raw: string, variant: FrenchVariant = 'be'): string {
  return raw.replace(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\b/g, (_all, h: string, m?: string) => {
    const hours = Number(h);
    /* « une heure » et non « un heure »: l'accord est le genre de détail qui,
       prononcé, fait entendre une machine en une syllabe. */
    const spoken = hours === 1 ? 'une' : numberWords(hours, variant);
    const head = `${spoken} ${hours <= 1 ? 'heure' : 'heures'}`;
    if (!m) return head;
    const minutes = Number(m);
    if (minutes === 0) return head;
    // « et demie », « et quart »: c'est ainsi qu'on donne une heure de vive voix.
    if (minutes === 30) return `${head} et demie`;
    if (minutes === 15) return `${head} et quart`;
    if (minutes === 45) return `${numberWords(hours + 1, variant)} heures moins le quart`;
    return `${head} ${numberWords(minutes, variant)}`;
  });
}

/** « 45 € » → « quarante-cinq euros ». « 12,50 € » → « douze euros cinquante ». */
export function priceWords(raw: string, variant: FrenchVariant = 'be'): string {
  return raw.replace(
    /* `\b` ne se pose pas après « € », qui n'est pas un caractère de mot: la
       frontière n'est demandée que sur les formes alphabétiques. */
    /\b(\d{1,3})(?:[.,](\d{1,2}))?\s*(?:€|(?:EUR|euros?)\b)/gi, (_all, whole: string, cents?: string) => {
    const amount = Number(whole);
    const head = `${numberWords(amount, variant)} ${amount <= 1 ? 'euro' : 'euros'}`;
    if (!cents) return head;
    const value = Number(cents.padEnd(2, '0'));
    return value === 0 ? head : `${head} ${numberWords(value, variant)}`;
  });
}

/**
 * Les abréviations d'une adresse, écrites en toutes lettres.
 *
 * Un dictionnaire et pas une intelligence: « bd » se lit « bédé » chez tous les
 * synthétiseurs testés, et aucun modèle ne devinera « boulevard » sans qu'on le
 * lui écrive.
 *
 * L'ancrage est une rétro-assertion de début ou d'espace, et non `\b`: `\b` est
 * ASCII, donc il ne se pose pas devant « é » et « étg. » n'aurait jamais été
 * remplacé. Et l'assertion de FIN (un espace attendu après) est ce qui empêche
 * « av. » de couper « avenue » et « pl. » de manger « plusieurs ».
 */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/(?<=^|\s)av\.?(?=\s)/gi, 'avenue'],
  [/(?<=^|\s)bd\.?(?=\s)/gi, 'boulevard'],
  [/(?<=^|\s)bvd\.?(?=\s)/gi, 'boulevard'],
  [/(?<=^|\s)ch\.?(?=\s)/gi, 'chaussée'],
  [/(?<=^|\s)chée\.?(?=\s)/gi, 'chaussée'],
  [/(?<=^|\s)pl\.?(?=\s)/gi, 'place'],
  [/(?<=^|\s)imp\.?(?=\s)/gi, 'impasse'],
  [/(?<=^|\s)sq\.?(?=\s)/gi, 'square'],
  [/(?<=^|\s)st\.?(?=\s)/gi, 'saint'],
  [/(?<=^|\s)ste\.?(?=\s)/gi, 'sainte'],
  [/(?<=^|\s)fg\.?(?=\s)/gi, 'faubourg'],
  [/(?<=^|\s)qu?ai?\.(?=\s)/gi, 'quai'],
  [/(?<=^|\s)rte\.?(?=\s)/gi, 'route'],
  [/(?<=^|\s)M\.(?=\s)/g, 'monsieur'],
  [/(?<=^|\s)Mme\.?(?=\s)/g, 'madame'],
  [/(?<=^|\s)Mlle\.?(?=\s)/g, 'mademoiselle'],
  [/(?<=^|\s)Dr\.?(?=\s)/g, 'docteur'],
  [/(?<=^|\s)n°\s*/gi, 'numéro '],
  [/(?<=^|\s)bte\.?(?=\s)/gi, 'boîte'],
  [/(?<=^|\s)étg\.?(?=\s)/gi, 'étage'],
];

/**
 * Une adresse prête à être dite: abréviations développées, numéro de rue et
 * code postal lus en toutes lettres.
 *
 * Le numéro de rue se dit comme un NOMBRE (« quarante-deux »), le code postal
 * comme un nombre lui aussi (« mille sept cents » se dit « dix-sept cents »
 * chez personne: en Belgique on dit « mille sept cents »). Les deux se
 * distinguent par leur longueur, et c'est le seul indice fiable.
 */
export function addressWords(raw: string, variant: FrenchVariant = 'be'): string {
  let out = raw;
  for (const [pattern, replacement] of ABBREVIATIONS) out = out.replace(pattern, replacement);

  /* Numéro de rue et code postal se disent tous deux comme des NOMBRES, et
     `numberWords` va jusqu'à 9999: un code postal belge en a exactement
     quatre, 1000 Bruxelles se dit « mille » et 4000 Liège « quatre mille ». */
  return out.replace(/\b\d{1,4}\b/g, match => numberWords(Number(match), variant));
}
