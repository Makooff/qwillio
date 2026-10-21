/**
 * La fusion des leads et des contacts, en une seule liste.
 *
 * « Contacts » et « Leads » listaient les MÊMES personnes: un lead est un appel
 * qualifié, et la fiche CRM naît de ce même appel. Deux entrées de menu, deux
 * vocabulaires d'état, une seule réalité. Cette fonction est ce qui reste de la
 * page Contacts: elle est pure et testée, parce que c'est ici qu'on peut
 * dédoubler quelqu'un ou le faire disparaître.
 *
 * Règles:
 *  - l'appariement se fait sur le TÉLÉPHONE, avec le pays. Couper les neuf
 *    derniers chiffres confondait un Belge et un Français qui se terminent
 *    pareil — la clé porte désormais `pays:numéro`, et deux pays distincts ne
 *    fusionnent jamais. Un numéro national (`0477…`) n'adopte un pays que
 *    si les données le montrent (une forme `+32…`/`+33…` du même numéro);
 *  - plusieurs appels du même numéro = une personne = une ligne. Le
 *    représentant est l'appel le plus récent, quel que soit l'ordre d'entrée,
 *    et l'historique complet survit dans `callIds`/`callCount`;
 *  - le nom de la fiche CRM prime sur le nom collecté lors de l'appel (les
 *    tests d'orthographe laissent des noms périmés); les tags se font l'union;
 *  - une fiche sans appel reste dans la liste, et ne se fusionne avec rien
 *    d'autre que son propre numéro.
 */

export interface LeadLike {
  id: string;
  callerName?: string;
  callerNumber?: string;
  nameCollected?: string;
  phoneCollected?: string;
  emailCollected?: string;
  leadStatus?: string;
  leadScore?: number | null;
  tags?: string[];
  createdAt?: string;
  identityKey?: string;
  contactId?: string | null;
  callIds?: string[];
  callCount?: number;
}

export interface ContactLike {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  leadScore?: number | null;
  tags?: string[];
  createdAt?: string;
}

export interface LeadRow<L = LeadLike> {
  id: string;
  /** L'appel qualifié, quand il y en a un: il porte les notes et le statut. */
  lead: L | null;
  /** La fiche CRM, quand elle existe: c'est elle qu'on ouvre. */
  contactId: string | null;
  name: string;
  phone: string;
  email: string;
  status: string;
  score: number | null;
  tags: string[];
  createdAt: string;
  /** Tous les appels du groupe, du plus récent au plus ancien. */
  callIds?: string[];
  /** Nombre d'appels regroupés derrière cette ligne. */
  callCount?: number;
}

/** Les chiffres bruts, sans découpe nationale: c'était la collision cross-pays. */
function digits(v?: string | null): string {
  return (v || '').replace(/\D/g, '');
}

/**
 * Décomposition pays-aware. Renvoie null quand il n'y a rien à apparier
 * (chaîne vide): un numéro absent ne matche JAMAIS, donc jamais de
 * regroupement anonyme.
 *
 * - `+32…` / `+33…` (ou `0032…` / `0033…`): pays connu, indicatif conservé;
 * - `0…` national (8 à 10 chiffres après le 0): pays ambigu, résolu plus tard
 *   à partir des données;
 * - tout le reste: clé exacte sur tous ses chiffres, sans découpe.
 */
function phoneParts(raw?: string | null): { cc: string | null; nsn: string } | null {
  if (!raw || !/^\s*\+?[\d\s()./-]+\s*$/.test(raw)) return null;
  const d = digits(raw);
  if (d.length < 8 || d.length > 15) return null;
  const ccIntl = d.startsWith('00') ? d.slice(2, 4) : d.slice(0, 2);
  const restIntl = d.startsWith('00') ? d.slice(4) : d.slice(2);
  if ((ccIntl === '32' || ccIntl === '33') && restIntl.length >= 8 && restIntl.length <= 10) {
    return { cc: ccIntl, nsn: restIntl };
  }
  if (d.startsWith('0') && d.length >= 9 && d.length <= 11) {
    return { cc: null, nsn: d.slice(1) };
  }
  return { cc: '', nsn: d };
}

/**
 * La clé finale d'un numéro, pays résolu. Un national ambigu adopte le pays
 * d'une forme internationale du même numéro présente dans les données;
 * s'il reste ambigu, sa clé `?…` ne matche que d'autres nationaux
 * identiques — jamais un `+32` ou un `+33` explicite d'un autre pays.
 */
function makeKeyResolver(all: (string | undefined | null)[]) {
  const knownCc = new Set<string>();
  for (const raw of all) {
    const p = phoneParts(raw);
    if (p && p.cc && p.cc !== '') knownCc.add(`${p.cc}:${p.nsn}`);
  }
  return (raw?: string | null): string | null => {
    const p = phoneParts(raw);
    if (!p) return null;
    if (p.cc === '') return `x:${p.nsn}`;
    if (p.cc) return `${p.cc}:${p.nsn}`;
    const be = knownCc.has(`32:${p.nsn}`);
    const fr = knownCc.has(`33:${p.nsn}`);
    if (be && !fr) return `32:${p.nsn}`;
    if (fr && !be) return `33:${p.nsn}`;
    return `?:${p.nsn}`;
  };
}

/** Deux numéros désignent-ils la même ligne? Exporté pour les filtres de page. */
export function phoneMatches(a?: string | null, b?: string | null): boolean {
  const ka = makeKeyResolver([a, b])(a);
  const kb = makeKeyResolver([a, b])(b);
  return ka !== null && ka === kb;
}

/** L'état d'un lead: la colonne d'abord, sinon ce que disent ses étiquettes. */
export function leadStatusOf(l: LeadLike): string {
  if (l.leadStatus) return l.leadStatus;
  if (l.tags?.includes('converted')) return 'converted';
  if (l.tags?.includes('contacted')) return 'contacted';
  if (l.tags?.includes('lost')) return 'lost';
  return 'new';
}

/**
 * L'état d'une fiche, traduit vers celui des leads.
 *
 * Le CRM parle « prospect / client / actif », le lead parle « nouveau /
 * contacté / converti ». Deux échelles dans une colonne ne se lisent pas.
 */
export function contactStatusOf(status?: string): string {
  if (status === 'client') return 'converted';
  if (status === 'lost') return 'lost';
  if (status === 'active') return 'contacted';
  return 'new';
}

/** Le plus récent d'abord; à dates égales, l'id tranche pour rester déterministe. */
function byNewest(a: LeadLike, b: LeadLike): number {
  const ta = new Date(a.createdAt || 0).getTime();
  const tb = new Date(b.createdAt || 0).getTime();
  if (ta !== tb) return tb - ta;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function mergeLeadsAndContacts<L extends LeadLike>(
  leads: L[],
  contacts: ContactLike[],
): LeadRow<L>[] {
  const keyOf = makeKeyResolver([
    ...leads.map(l => l.callerNumber || l.phoneCollected),
    ...contacts.map(c => c.phone),
  ]);

  /* Les fiches, par numéro: le PREMIER gagne (deux fiches sur le même numéro
     sont un doublon backend, et prendre au hasard ferait bouger la liste d'un
     rechargement à l'autre). */
  const contactByKey = new Map<string, ContactLike>();
  for (const c of contacts) {
    const k = keyOf(c.phone);
    if (k && !contactByKey.has(k)) contactByKey.set(k, c);
  }

  /* Les appels regroupés par personne. Sans numéro fiable, un appel reste
     seul: jamais de fusion anonyme. */
  const groups = new Map<string, L[]>();
  const keyless: L[] = [];
  for (const l of leads) {
    const k = l.identityKey?.startsWith('anon:') ? null
      : l.identityKey?.startsWith('phone:') ? keyOf(l.identityKey.slice(6))
      : keyOf(l.callerNumber || l.phoneCollected);
    if (!k) { keyless.push(l); continue; }
    const g = groups.get(k);
    if (g) g.push(l); else groups.set(k, [l]);
  }

  const used = new Set<string>();
  const usedContactIds = new Set<string>();
  const fromLeads: LeadRow<L>[] = [];
  for (const [k, calls] of groups) {
    const sorted = [...calls].sort(byNewest);
    const rep = sorted[0];
    const c = (rep.contactId ? contacts.find(c => c.id === rep.contactId) : undefined) ?? contactByKey.get(k);
    if (c) { used.add(k); usedContactIds.add(c.id); }
    const manual = c ? contactStatusOf(c.status) : 'new';
    fromLeads.push({
      id: rep.id,
      lead: rep,
      contactId: rep.contactId ?? c?.id ?? null,
      /* La fiche CRM est la source la plus à jour; le nom d'appel est ce
         qu'une transcription a entendu, y compris pendant un test. */
      name: c?.name || rep.callerName || rep.nameCollected || 'Inconnu',
      phone: rep.phoneCollected || c?.phone || rep.callerNumber || '',
      email: rep.emailCollected || c?.email || '',
      /* Le statut saisi à la main dans le CRM prime; sinon celui du lead. */
      status: rep.identityKey ? leadStatusOf(rep) : manual !== 'new' ? manual : leadStatusOf(rep),
      score: rep.identityKey ? rep.leadScore ?? null : rep.leadScore ?? c?.leadScore ?? null,
      tags: [...new Set([...(rep.tags ?? []), ...(c?.tags ?? [])])],
      createdAt: rep.createdAt ?? '',
      callIds: [...new Set(sorted.flatMap(l => l.callIds ?? [l.id]))],
      callCount: sorted.reduce((n, l) => n + (l.callCount ?? 1), 0),
    });
  }

  const keylessRows = keyless.map<LeadRow<L>>(l => ({
    id: l.id,
    lead: l,
    contactId: l.contactId ?? null,
    name: l.callerName || l.nameCollected || 'Inconnu',
    phone: l.phoneCollected || l.callerNumber || '',
    email: l.emailCollected || '',
    status: leadStatusOf(l),
    score: l.leadScore ?? null,
    tags: l.tags ?? [],
    createdAt: l.createdAt ?? '',
    callIds: l.callIds ?? [l.id],
    callCount: l.callCount ?? 1,
  }));

  const orphans = contacts
    .filter(c => !usedContactIds.has(c.id))
    .filter(c => {
      const k = keyOf(c.phone);
      return !k || !used.has(k);
    })
    .map<LeadRow<L>>(c => ({
      /* Préfixé: un identifiant de contact et un identifiant d'appel se
         ressemblent (deux uuid), et une clé React qui collisionne recycle une
         ligne pour une autre personne. */
      id: `contact:${c.id}`,
      lead: null,
      contactId: c.id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      status: contactStatusOf(c.status),
      score: c.leadScore ?? null,
      tags: c.tags ?? [],
      createdAt: c.createdAt ?? '',
    }));

  return [...fromLeads, ...keylessRows, ...orphans];
}
