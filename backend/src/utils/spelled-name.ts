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
  const tokens = raw.trim().split(/\s+/);
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
    const letter = token.match(/^(\p{L})[.,]?$/u);
    if (letter) {
      run.push(letter[1]);
      continue;
    }
    flush();
    out.push(token);
  }
  flush();
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
