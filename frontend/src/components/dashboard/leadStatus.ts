/**
 * Les quatre états d'un lead, et leurs couleurs, en un seul endroit.
 *
 * Ils étaient écrits deux fois: dans la page Leads et dans le CRM, avec des
 * teintes qui ne se répondaient pas. Surtout, « nouveau » était BLEU
 * (`#60a5fa`), une couleur qui n'appartient à rien dans Qwillio: la marque est
 * mauve, et le produit n'utilise de couleur que pour dire vert (ça va) ou
 * rouge (ça ne va pas).
 *
 * D'où cette échelle (demande utilisateur): les deux mauves de la marque pour
 * les états en cours, puis le vert et le rouge que l'application emploie déjà
 * ailleurs, à l'identique — celui du transfert vérifié et celui de la
 * déconnexion. Une couleur de plus serait une couleur à interpréter.
 */

export type LeadStatusKey = 'new' | 'contacted' | 'converted' | 'lost';

export interface LeadStatusStyle {
  key: LeadStatusKey;
  label: string;
  /** La teinte, en dur: elle sert aussi bien en SVG qu'en style inline. */
  color: string;
  /** Pastille prête à poser sur une rangée. */
  pill: string;
  border: string;
}

/* Le violet de la marque (`--q2-violet`) et son indigo (`--q2-indigo`), tels
   quels. Le vert et le rouge sont ceux de Tailwind que l'app utilise déjà:
   emerald-400 et red-400. */
export const LEAD_STATUS: Record<LeadStatusKey, LeadStatusStyle> = {
  new: {
    key: 'new', label: 'Nouveau', color: '#cd6bfb',
    pill: 'bg-[#cd6bfb]/10 text-[#cd6bfb]', border: 'border-[#cd6bfb]/20',
  },
  contacted: {
    key: 'contacted', label: 'Contacté', color: '#7a5fff',
    pill: 'bg-[#7a5fff]/10 text-[#7a5fff]', border: 'border-[#7a5fff]/20',
  },
  converted: {
    key: 'converted', label: 'Converti', color: '#34d399',
    pill: 'bg-emerald-400/10 text-emerald-400', border: 'border-emerald-400/20',
  },
  lost: {
    key: 'lost', label: 'Perdu', color: '#f87171',
    pill: 'bg-red-400/10 text-red-400', border: 'border-red-400/20',
  },
};

/** Dans l'ordre du pipeline, pour les colonnes et la bande de chiffres. */
export const LEAD_STATUS_ORDER: LeadStatusStyle[] = [
  LEAD_STATUS.new,
  LEAD_STATUS.contacted,
  LEAD_STATUS.converted,
  LEAD_STATUS.lost,
];

/** Tolère une valeur inconnue venue du serveur plutôt que de rendre du vide. */
export function leadStatusStyle(status: string): LeadStatusStyle {
  return LEAD_STATUS[status as LeadStatusKey] ?? LEAD_STATUS.new;
}
