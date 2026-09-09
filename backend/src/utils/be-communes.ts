/**
 * Les communes belges qui portent DEUX noms officiels (BEL-6).
 *
 * À Bruxelles, chaque commune en a un en français et un en néerlandais, et les
 * deux sont également officiels: Ixelles est Elsene, Uccle est Ukkel. En
 * périphérie, un francophone dira souvent le nom français d'une commune
 * pourtant néerlandophone.
 *
 * Sans table d'équivalence, l'agent enregistre « Ixelles » pour l'un et
 * « Elsene » pour l'autre, le CRM croit à deux endroits différents, et le
 * client rappelle pour demander où il doit aller. C'est un défaut invisible en
 * test — on tape toujours le même nom — et systématique en production, où les
 * appelants ne se concertent pas.
 *
 * ## Ce que cette table N'EST PAS
 *
 * Pas un annuaire des communes belges: il y en a 581, et les connaître toutes
 * n'apporterait rien. Seules comptent celles dont les deux noms DIFFÈRENT,
 * parce que ce sont les seules qui créent un doublon. Anderlecht, Jette,
 * Evere, Ganshoren et Koekelberg s'écrivent pareil dans les deux langues: les
 * lister ne changerait aucune sortie, et allongerait une table à maintenir.
 */

export type CommuneRegion = 'bruxelles' | 'peripherie' | 'flandre' | 'wallonie';

export interface Commune {
  fr: string;
  nl: string;
  region: CommuneRegion;
}

/**
 * Chaque entrée est une paire dont les deux noms diffèrent.
 *
 * Les dix-neuf communes bruxelloises d'abord, puis les six communes à
 * facilités de la périphérie, puis les villes que l'on nomme couramment dans
 * l'autre langue. L'ordre est documentaire: la recherche passe par un index.
 */
export const COMMUNES: Commune[] = [
  // ── Bruxelles: les 19, moins celles dont le nom ne change pas ──
  { fr: 'Auderghem', nl: 'Oudergem', region: 'bruxelles' },
  { fr: 'Berchem-Sainte-Agathe', nl: 'Sint-Agatha-Berchem', region: 'bruxelles' },
  { fr: 'Bruxelles', nl: 'Brussel', region: 'bruxelles' },
  { fr: 'Forest', nl: 'Vorst', region: 'bruxelles' },
  { fr: 'Ixelles', nl: 'Elsene', region: 'bruxelles' },
  { fr: 'Molenbeek-Saint-Jean', nl: 'Sint-Jans-Molenbeek', region: 'bruxelles' },
  { fr: 'Saint-Gilles', nl: 'Sint-Gillis', region: 'bruxelles' },
  { fr: 'Saint-Josse-ten-Noode', nl: 'Sint-Joost-ten-Node', region: 'bruxelles' },
  { fr: 'Schaerbeek', nl: 'Schaarbeek', region: 'bruxelles' },
  { fr: 'Uccle', nl: 'Ukkel', region: 'bruxelles' },
  { fr: 'Watermael-Boitsfort', nl: 'Watermaal-Bosvoorde', region: 'bruxelles' },
  { fr: 'Woluwe-Saint-Lambert', nl: 'Sint-Lambrechts-Woluwe', region: 'bruxelles' },
  { fr: 'Woluwe-Saint-Pierre', nl: 'Sint-Pieters-Woluwe', region: 'bruxelles' },

  // ── Périphérie: les communes à facilités, où les deux langues se croisent ──
  { fr: 'Crainhem', nl: 'Kraainem', region: 'peripherie' },
  { fr: 'Rhode-Saint-Genèse', nl: 'Sint-Genesius-Rode', region: 'peripherie' },

  // ── Flandre: ce qu'un francophone nomme spontanément en français ──
  { fr: 'Alost', nl: 'Aalst', region: 'flandre' },
  { fr: 'Anvers', nl: 'Antwerpen', region: 'flandre' },
  { fr: 'Audenarde', nl: 'Oudenaarde', region: 'flandre' },
  { fr: 'Bruges', nl: 'Brugge', region: 'flandre' },
  { fr: 'Courtrai', nl: 'Kortrijk', region: 'flandre' },
  { fr: 'Furnes', nl: 'Veurne', region: 'flandre' },
  { fr: 'Gand', nl: 'Gent', region: 'flandre' },
  { fr: 'Hal', nl: 'Halle', region: 'flandre' },
  { fr: 'Louvain', nl: 'Leuven', region: 'flandre' },
  { fr: 'Malines', nl: 'Mechelen', region: 'flandre' },
  { fr: 'Ostende', nl: 'Oostende', region: 'flandre' },
  { fr: 'Renaix', nl: 'Ronse', region: 'flandre' },
  { fr: 'Saint-Nicolas', nl: 'Sint-Niklaas', region: 'flandre' },
  { fr: 'Saint-Trond', nl: 'Sint-Truiden', region: 'flandre' },
  { fr: 'Termonde', nl: 'Dendermonde', region: 'flandre' },
  { fr: 'Tervueren', nl: 'Tervuren', region: 'flandre' },
  { fr: 'Tirlemont', nl: 'Tienen', region: 'flandre' },
  { fr: 'Tongres', nl: 'Tongeren', region: 'flandre' },
  { fr: 'Vilvorde', nl: 'Vilvoorde', region: 'flandre' },
  { fr: 'Ypres', nl: 'Ieper', region: 'flandre' },

  // ── Wallonie: l'inverse, ce qu'un néerlandophone nomme en néerlandais ──
  { fr: 'Arlon', nl: 'Aarlen', region: 'wallonie' },
  { fr: 'Ath', nl: 'Aat', region: 'wallonie' },
  { fr: 'Liège', nl: 'Luik', region: 'wallonie' },
  { fr: 'Mons', nl: 'Bergen', region: 'wallonie' },
  { fr: 'Namur', nl: 'Namen', region: 'wallonie' },
  { fr: 'Nivelles', nl: 'Nijvel', region: 'wallonie' },
  { fr: 'Soignies', nl: 'Zinnik', region: 'wallonie' },
  { fr: 'Tournai', nl: 'Doornik', region: 'wallonie' },
  { fr: 'Wavre', nl: 'Waver', region: 'wallonie' },
];

/**
 * La forme sous laquelle on compare. Tout ce qui varie sans changer le lieu
 * est écrasé: casse, accents, tirets, espaces.
 *
 * `saint` et `sint` sont ramenés à `st`, et pas l'un vers l'autre: un
 * transcripteur écrit « st gilles », « saint-gilles » ou « sint gillis » selon
 * ce qu'il a entendu, et aucune de ces trois formes n'est plus juste que les
 * autres. Les réduire toutes à la même est ce qui les fait se rejoindre.
 */
function key(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(saint|sint|sainte)\b/g, 'st')
    .replace(/[^a-z0-9]/g, '');
}

/** Index des deux noms vers la paire, construit une fois. */
const INDEX = new Map<string, Commune>();
for (const commune of COMMUNES) {
  INDEX.set(key(commune.fr), commune);
  INDEX.set(key(commune.nl), commune);
}

/**
 * La paire officielle d'une commune, ou `null` si elle n'en a qu'un nom.
 *
 * `null` n'est PAS une erreur: la grande majorité des communes belges
 * s'écrivent pareil dans les deux langues, et pour elles il n'y a rien à
 * canoniser. L'appelant doit donc traiter `null` comme « garde ce que tu as ».
 */
export function findCommune(raw: string | null | undefined): Commune | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return INDEX.get(key(raw)) ?? null;
}

/**
 * Le nom à ÉCRIRE pour cette commune, dans la langue du client.
 *
 * La langue du CLIENT et non celle de l'appelant: c'est le client qui relira
 * la fiche, et deux appelants qui nomment le même endroit dans deux langues
 * doivent produire une seule ligne. C'est tout l'objet de cette table.
 */
export function canonicalCommune(raw: string, lang: 'fr' | 'en' | 'nl'): string {
  const hit = findCommune(raw);
  if (!hit) return raw.trim();
  // L'anglais suit le français: c'est la langue de travail de Bruxelles, et
  // « Ixelles » est ce qu'un anglophone verra sur un panneau.
  return lang === 'nl' ? hit.nl : hit.fr;
}

/**
 * Normalise la commune À L'INTÉRIEUR d'une adresse libre.
 *
 * L'adresse arrive telle que l'appelant l'a dite: « rue de la Loi 155, 1050
 * Elsene ». On ne la réécrit pas, on remplace le seul mot qui a deux formes
 * officielles. Réécrire l'adresse entière supposerait de la comprendre, ce
 * qu'on ne sait pas faire.
 *
 * ## Où la commune se trouve VRAIMENT, et pourquoi ça décide de tout
 *
 * Une adresse belge nomme sa commune après le code postal, ou en fin de ligne.
 * Nulle part ailleurs. Chercher le nom n'importe où fait le contraire du
 * travail: « chaussée de WAVRE, 1160 Oudergem » contient une commune wallonne
 * dans son nom de RUE, et une recherche naïve remplaçait celle-là en laissant
 * la vraie intacte. Vérifié, c'était le comportement.
 *
 * D'où deux ancrages, et deux seulement: juste après un code postal à quatre
 * chiffres, ou à la toute fin. Une mention au milieu est ambiguë par nature —
 * « je passe par Hal » n'est pas une adresse — et devant l'ambiguïté on ne
 * touche à rien: une adresse laissée telle quelle se relit, une adresse
 * réécrite de travers se croit juste.
 */
export function normaliseAddress(address: string, lang: 'fr' | 'en' | 'nl'): string {
  const words = address.split(/\s+/);
  /* Du plus long au plus court: « Sint-Joost-ten-Node » écrit en quatre mots
     ne serait jamais reconnu si l'on essayait « Sint » d'abord, et la commune
     la plus longue est justement celle qu'on rate. */
  for (let size = Math.min(4, words.length); size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const hit = findCommune(words.slice(i, i + size).join(' '));
      if (!hit) continue;

      const afterPostcode = i > 0 && /^\d{4}\W*$/.test(words[i - 1]);
      const atEnd = i + size === words.length;
      if (!afterPostcode && !atEnd) continue;

      const replacement = lang === 'nl' ? hit.nl : hit.fr;
      /* La ponctuation qui suivait est conservée: « 1050 Elsene, » doit
         rester « 1050 Ixelles, ». */
      const trailing = words[i + size - 1].match(/[^\p{L}\p{N}]+$/u)?.[0] ?? '';
      words.splice(i, size, replacement + trailing);
      return words.join(' ');
    }
  }
  return address;
}

/** Nombre de paires connues. Sert au test qui vérifie que la table est peuplée. */
export const COMMUNE_COUNT = COMMUNES.length;
