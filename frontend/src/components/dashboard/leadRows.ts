/**
 * La fusion des leads et des contacts, en une seule liste.
 *
 * « Contacts » et « Leads » listaient les MÊMES personnes: un lead est un appel
 * qualifié, et la fiche CRM naît de ce même appel. Deux entrées de menu, deux
 * vocabulaires d'état, une seule réalité. Cette fonction est ce qui reste de la
 * page Contacts: elle est pure et testée, parce que c'est ici qu'on peut
 * dédoubler quelqu'un ou le faire disparaître.
 *
 * Deux règles portent tout:
 *  - l'appariement se fait sur le TÉLÉPHONE réduit à ses chiffres, la clé que
 *    le dédoublonnage backend emploie déjà. Le nom ne marcherait pas
 *    (« M. Dupont » contre « Dupont »), l'e-mail manque une fois sur deux;
 *  - une fiche sans appel reste dans la liste. Sans elle, fermer la page
 *    Contacts ferait disparaître les fiches saisies à la main.
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
}

/**
 * La clé d'un téléphone: ses chiffres, réduits aux NEUF DERNIERS.
 *
 * Les chiffres seuls ne suffisent pas, et c'est un test qui l'a montré:
 * `+32 477 12 34 56` donne `32477123456`, `0477 12 34 56` donne `0477123456`.
 * Le même client, deux clés, donc deux lignes pour une personne, ce que cette
 * fusion existe précisément pour éviter. Le préfixe international et le zéro
 * national portent la même information et occupent la même place: en coupant
 * par la fin, les deux écritures retombent sur `477123456`.
 *
 * Neuf parce que c'est la longueur du numéro national en Belgique et en
 * France, les deux pays servis. Deux numéros de pays différents partageant
 * leurs neuf derniers chiffres seraient confondus: c'est improbable, et c'est
 * le même compromis que le dédoublonnage backend.
 */
export function digits(v?: string | null): string {
  const d = (v || '').replace(/\D/g, '');
  return d.length > 9 ? d.slice(-9) : d;
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

export function mergeLeadsAndContacts<L extends LeadLike>(
  leads: L[],
  contacts: ContactLike[],
): LeadRow<L>[] {
  const byPhone = new Map<string, ContactLike>();
  for (const c of contacts) {
    const k = digits(c.phone);
    /* Le PREMIER gagne: deux fiches sur le même numéro sont un doublon que le
       backend n'a pas vu, et en prendre une au hasard ferait bouger la liste
       d'un rechargement à l'autre. */
    if (k && !byPhone.has(k)) byPhone.set(k, c);
  }

  const used = new Set<string>();
  const fromLeads = leads.map<LeadRow<L>>(l => {
    const k = digits(l.callerNumber || l.phoneCollected);
    const c = k ? byPhone.get(k) : undefined;
    if (c && k) used.add(k);
    return {
      id: l.id,
      lead: l,
      contactId: c?.id ?? null,
      name: l.callerName || l.nameCollected || c?.name || 'Inconnu',
      phone: l.callerNumber || l.phoneCollected || c?.phone || '',
      email: l.emailCollected || c?.email || '',
      status: leadStatusOf(l),
      score: l.leadScore ?? c?.leadScore ?? null,
      tags: c?.tags ?? [],
      createdAt: l.createdAt ?? '',
    };
  });

  const orphans = contacts
    .filter(c => {
      const k = digits(c.phone);
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

  return [...fromLeads, ...orphans];
}
