/**
 * Un nom ÉPELÉ arrive lettre par lettre; il faut le recoller.
 *
 * Quand l'agent demande d'épeler (« Polle » entendu « Paul »), le transcripteur
 * rend « P O L L E », « p-o-l-l-e » ou « P. O. L. L. E. ». Enregistrer ça tel
 * quel donne une fiche imprononçable et un agenda illisible. Une suite d'au
 * moins trois lettres isolées est recollée en un mot capitalisé; le reste du
 * nom ne bouge pas.
 */
export function normaliseSpelledName(raw: string): string {
  /* « VAN espace H0LD » (appel réel, 12/09/2026): le transcripteur rend les
     lettres épelées collées et en capitales, entend « O » comme le chiffre
     0, et écrit le mot « espace » que l'appelant a dit. */
  const tokens = raw.trim().split(/\s+/).filter(t => !/^(espace|space|spatie)$/i.test(t));
  const out: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length >= 3) {
      out.push(run[0].toUpperCase() + run.slice(1).join('').toLowerCase());
    } else {
      out.push(...run.map(l => l.toUpperCase()));
    }
    run = [];
  };

  for (const token of tokens) {
    /* Une lettre seule, éventuellement suivie d'un point ou d'une virgule, ou
       plusieurs lettres séparées par des tirets: « p-o-l-l-e ». */
    const dashed = token.split('-');
    if (dashed.length >= 3 && dashed.every(p => /^\p{L}$/u.test(p))) {
      flush();
      out.push(dashed[0].toUpperCase() + dashed.slice(1).join('').toLowerCase());
      continue;
    }
    const letter = token.match(/^(\p{L}|0)[.,]?$/u);
    if (letter) {
      run.push(letter[1] === '0' ? 'O' : letter[1]);
      continue;
    }
    flush();
    /* Un mot en CAPITALES (avec d'éventuels 0 pour O), c'est une épellation
       recollée par le transcripteur: « H0LD » → « Hold ». Deux lettres au
       moins, pour laisser passer une initiale. */
    if (/^[\p{Lu}0]{2,}[.,]?$/u.test(token)) {
      const word = token.replace(/[.,]$/, '').replace(/0/g, 'O');
      out.push(word[0] + word.slice(1).toLowerCase());
      continue;
    }
    out.push(token);
  }
  flush();
  /* Un nom ne contient JAMAIS de chiffre. Le petit modèle écrit « MAR0N »,
     « Mar0n » en épelant (13/09/2026), et la synthèse lit « zéro ». Dans
     tout mot qui porte au moins une lettre, 0 est la lettre O. */
  return out
    .map(w => (/\p{L}/u.test(w) ? w.replace(/0/g, (_m, i: number) => (i === 0 ? 'O' : 'o')) : w))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Le nom de famille: le dernier mot du nom complet. */
export function familyName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/**
 * Un mot épelé PAR L'AGENT, lettre par lettre: « Polle » → « P-O-L-L-E ».
 * Relire « Polle » ne suffit pas quand c'est « Paul » qui a été entendu: les
 * deux se prononcent pareil. Les lettres, elles, ne se confondent pas.
 */
export function spellOut(word: string): string {
  /* 0 est la lettre O: filtrer le chiffre ferait disparaître une lettre
     (« MAR0N » épelé M-A-R-N), et la dire ferait entendre « zéro ». */
  return Array.from(word.normalize('NFC').replace(/0/g, 'O'))
    .filter(c => /\p{L}/u.test(c))
    .map(c => c.toUpperCase())
    .join('-');
}

/**
 * Un nom BIDON n'est pas un nom.
 *
 * Appel réel du 15/09/2026, appelant inconnu qui ne s'est jamais nommé: le
 * modèle a appelé bookAppointment avec `customerName: "client"` pour
 * satisfaire le champ obligatoire, puis a annoncé la réservation. Un
 * remplissage n'identifie personne dans l'agenda; il vaut absence de nom.
 * Les titres seuls (« Monsieur ») aussi.
 */
const PLACEHOLDERS = new Set([
  'client', 'cliente', 'clients', 'inconnu', 'inconnue', 'appelant', 'appelante', 'patient', 'patiente',
  'anonyme', 'personne', 'nom', 'prenom', 'prenom nom', 'nom prenom', 'nom de famille',
  'unknown', 'caller', 'customer', 'anonymous', 'name', 'first name', 'last name', 'full name', 'first last',
  'onbekend', 'onbekende', 'beller', 'klant', 'naam', 'voornaam',
  'n/a', 'na', 'none', 'null', 'undefined', 'x', 'xxx', 'test',
]);
const TITLES = /^(monsieur|madame|mademoiselle|mr|mrs|ms|mme|mlle|m|dr|docteur|meneer|mevrouw|dhr|mevr|sir|madam)\.?$/i;

function fold(word: string): string {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Les mots du nom, sans les titres de civilité. */
function nameWords(name: string): string[] {
  return name.trim().split(/\s+/).filter(w => w && !TITLES.test(w));
}

/**
 * LE NOM DE L'AGENT ET CELUI DU COMMERCE SONT DES REMPLISSAGES (19/09/2026).
 *
 * Relevé sur un compte réel: TROIS rendez-vous au nom de « Marc De La Foi »,
 * une mémoire d'appelant sous ce nom, et un brief d'ouverture qui annonçait
 * « Il s'appelle probablement Marc De La Foi » à chaque appel. L'agent de ce
 * client s'appelle **Marc** et se présente par « Demtalix, bonjour. Je suis
 * Marc, votre assistant IA ».
 *
 * D'où ça vient: l'analyse de fin d'appel lit le TRANSCRIPT, qui contient
 * toujours cette phrase, et rend `callerName`. Sur un appel de quatre secondes
 * où l'appelant n'a RIEN dit, le seul nom propre du transcript est celui de
 * l'agent. Elle l'a donc rendu, et `nameCollected` l'a écrit sans garde.
 *
 * Ensuite tout s'empoisonne en chaîne: la mémoire d'appelant porte ce nom, le
 * brief le dit au modèle, le modèle réserve sous ce nom, et `lookupBooking`
 * ne retrouve plus le VRAI nom de l'appelant.
 *
 * La liste statique ne pouvait pas l'attraper: « Marc » est un prénom
 * parfaitement valide. Ce qui le disqualifie n'est pas sa forme, c'est QUI il
 * désigne, donc la garde doit recevoir les noms de ce client-là.
 *
 * Comparaison par MOT et non sur la chaîne entière: « Marc De La Foi » n'est
 * égal ni à « Marc » ni à « Demtalix », et c'est pourtant le nom de l'agent
 * collé à un nom de famille estropié. Un nom dont le PREMIER mot est celui de
 * l'agent vient de l'accueil, pas de l'appelant.
 */
export function isPlaceholderName(name: string, ownNames: readonly string[] = []): boolean {
  const words = nameWords(name);
  if (words.length === 0) return true;
  const joined = words.map(fold).join(' ');
  if (PLACEHOLDERS.has(joined)) return true;
  /* « le client », « un inconnu », « the caller ». */
  const stripped = joined.replace(/^(le|la|l'|un|une|the|a|an|de|het|een)\s+/, '');
  if (PLACEHOLDERS.has(stripped)) return true;
  if (!words.some(w => /\p{L}/u.test(w))) return true;

  const own = ownNames
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map(n => nameWords(n).map(fold))
    .filter(w => w.length > 0);
  if (own.length) {
    const said = words.map(fold);
    for (const parts of own) {
      /* Le nom entier du client (« Demtalix »), ou le nom de l'agent en tête:
         « Marc », « Marc De La Foi ». Un appelant qui s'appelle vraiment Marc
         donne un nom de famille qui n'est pas celui de l'agent, et il n'est
         de toute façon pas nommé par l'ACCUEIL. */
      if (parts.every(p => said.includes(p))) return true;
      if (said[0] === parts[0] && parts[0].length >= 3) return true;
    }
  }
  return false;
}

/** Prénom ET nom de famille: au moins deux mots portant des lettres. */
export function hasFamilyName(name: string): boolean {
  return nameWords(name).filter(w => /\p{L}/u.test(w)).length >= 2;
}

/**
 * Ce qui manque au nom pour réserver: rien, tout, un remplissage, ou le nom
 * de famille. Un nom épelé lettre par lettre est d'abord recollé par l'appelant.
 */
export type NameProblem = 'missing' | 'placeholder' | 'firstOnly' | null;
export function nameProblem(name: string, ownNames: readonly string[] = []): NameProblem {
  if (!name.trim()) return 'missing';
  if (isPlaceholderName(name, ownNames)) return 'placeholder';
  if (!hasFamilyName(name)) return 'firstOnly';
  return null;
}
