/**
 * Qui édite Qwillio, et qui répond des données.
 *
 * Les pages légales annonçaient « Qwillio LLC », et les CGU invoquaient le
 * droit du Delaware pour les clients américains. **Cette société n'existe
 * pas.** Nommer une entité inexistante n'est pas un détail de rédaction: le
 * RGPD impose d'identifier le responsable du traitement (art. 13), c'est lui
 * qui répond des données, et c'est la première chose qu'un client vérifie.
 *
 * En attendant une immatriculation, la formulation honnête est celle d'une
 * personne physique. Elle est parfaitement valable: un indépendant est un
 * responsable de traitement comme un autre.
 *
 * ⚠️ DEUX VALEURS À RENSEIGNER AVANT LE PROCHAIN DÉPLOIEMENT. Elles sont
 * ici, et nulle part ailleurs: le jour où la société existera, ce fichier
 * sera le seul à changer.
 */

export interface LegalEntity {
  /** Nom affiché comme responsable du traitement. */
  name: string;
  /** Forme juridique, si elle existe. `null` = personne physique. */
  legalForm: string | null;
  /** Numéro d'entreprise (BCE/KBO, SIREN…). `null` tant qu'il n'y en a pas. */
  companyNumber: string | null;
  /** Adresse postale. Obligatoire: le RGPD exige des coordonnées, pas juste un email. */
  address: string | null;
  email: string;
  /** Droit applicable et juridiction, pour les CGU. */
  governingLaw: { fr: string; en: string };
}

export const LEGAL_ENTITY: LegalEntity = {
  // TODO(propriétaire): ton nom légal complet, tel qu'il figure sur ta carte d'identité.
  name: '',
  legalForm: null,
  companyNumber: null,
  // TODO(propriétaire): l'adresse postale de contact (l'adresse belge).
  address: null,
  email: 'hello@qwillio.com',
  governingLaw: {
    // Plus de mention du Delaware: il n'y a pas d'entité américaine à rattacher
    // à ce droit. Le droit belge seul, cohérent avec le marché visé.
    fr: 'Les présentes conditions sont régies par le droit belge. Tout litige sera soumis aux tribunaux de Bruxelles.',
    en: 'These terms are governed by Belgian law. Any dispute shall be submitted to the courts of Brussels.',
  },
};

/**
 * Le nom à afficher. Tant que le nom légal n'est pas renseigné, on montre
 * « Qwillio » seul: c'est le nom commercial, il est vrai, et il vaut mieux
 * qu'une société inventée. Ce n'est PAS suffisant au regard du RGPD, d'où
 * l'avertissement de `legalIdentityIsComplete`.
 */
export function legalEntityName(): string {
  if (!LEGAL_ENTITY.name) return 'Qwillio';
  return LEGAL_ENTITY.legalForm
    ? `${LEGAL_ENTITY.name} ${LEGAL_ENTITY.legalForm}`
    : LEGAL_ENTITY.name;
}

/**
 * L'identité est-elle publiable en l'état ?
 *
 * Sert au test qui garde ce fichier: il ne peut pas deviner le nom, mais il
 * peut refuser qu'on réintroduise une société inexistante, et rappeler que
 * les deux champs manquent encore.
 */
export function legalIdentityIsComplete(): boolean {
  return !!LEGAL_ENTITY.name && !!LEGAL_ENTITY.address;
}
