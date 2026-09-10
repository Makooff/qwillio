/**
 * Les codes de renvoi d'appel, par TYPE de renvoi.
 *
 * La page d'installation donnait `*21*` à tout le monde, c'est-à-dire le renvoi
 * INCONDITIONNEL, y compris au client qui venait de choisir « Si occupé » dans
 * ses réglages. Il croyait ne renvoyer que ce qu'il rate et renvoyait tout, sans
 * que rien ne le lui dise: son téléphone ne sonnait plus du tout.
 *
 * `forwardingType` était par ailleurs un champ mort, enregistré et relu par
 * personne. Le brancher ici lui donne enfin l'effet qu'il annonçait.
 *
 * ── Sur la provenance de ces codes ──────────────────────────────────────────
 *
 * Ce sont les codes MMI du GSM, normalisés (3GPP TS 22.030), et non des codes
 * propres à un opérateur: ils valent donc sur n'importe quel MOBILE, iPhone
 * comme Android. Sur une ligne FIXE, chaque opérateur a les siens, et la page
 * ne les promet pas.
 */

export type ForwardingType = '' | 'unconditional' | 'busy' | 'no_answer' | 'scheduled';

export interface ForwardingCode {
  /** Le préfixe MMI, sans le numéro. */
  activate: string;
  /** Ce qui coupe ce renvoi précis. */
  cancel: string;
  /** Ce que ça FAIT, en une phrase. Pas le nom du code. */
  effect: string;
  /** L'effet de bord qui surprend, quand il y en a un. */
  caveat?: string;
  /**
   * Ce renvoi peut-il être devancé par la messagerie de l'OPÉRATEUR ?
   *
   * Faux uniquement pour le renvoi inconditionnel, qui prend l'appel avant
   * qu'aucune condition ne s'évalue. Pour tous les autres, la messagerie est
   * elle-même un renvoi conditionnel posé sur le réseau, souvent avec un
   * délai plus court: elle capte l'appel et l'agent ne sonne jamais.
   */
  voicemailRisk: boolean;
}

/**
 * Le code qui efface TOUS les renvois de la ligne, messagerie de l'opérateur
 * comprise (REL-10).
 *
 * C'est l'étape que personne ne documente et qui cause le premier appel au
 * support: « le renvoi ne marche pas ». La messagerie d'un opérateur n'est pas
 * un service à part, c'est un renvoi conditionnel posé sur la ligne à la
 * livraison, vers un numéro interne. Quand le client pose SON renvoi sans
 * effacer celui-là, les deux coexistent, et c'est le plus court délai qui
 * gagne — la messagerie, systématiquement.
 *
 * `##002#` est le code MMI normalisé d'effacement global (3GPP TS 22.030). Il
 * se compose AVANT le renvoi voulu, jamais après: composé après, il effacerait
 * aussi celui qu'on vient de poser.
 */
export const CLEAR_ALL_FORWARDS = '##002#';

export const FORWARDING_CODES: Record<Exclude<ForwardingType, ''>, ForwardingCode> = {
  unconditional: {
    activate: '*21*',
    cancel: '##21#',
    effect: "Tous vos appels partent vers l'IA. Votre téléphone ne sonne plus.",
    voicemailRisk: false,
    caveat: "Vous ne verrez plus passer un seul appel: c'est le bon choix si l'IA doit tout prendre, jamais si vous voulez décrocher parfois.",
  },
  busy: {
    activate: '*67*',
    cancel: '##67#',
    effect: "L'IA prend l'appel seulement quand vous êtes déjà en ligne.",
    voicemailRisk: true,
    caveat: 'Un appel que vous laissez sonner sans répondre ne part PAS vers l\'IA: il tombe sur votre messagerie.',
  },
  no_answer: {
    activate: '*61*',
    cancel: '##61#',
    effect: "L'IA prend l'appel quand vous ne répondez pas après quelques sonneries.",
    voicemailRisk: true,
    caveat: "L'appelant patiente pendant les sonneries avant d'entendre l'IA.",
  },
  scheduled: {
    /* Le renvoi « conditionnel complet »: occupé, sans réponse ET injoignable.
       C'est ce qui se rapproche le plus d'un horaire sans en être un: aucun
       réseau mobile ne sait renvoyer selon l'heure, seul l'appareil ou un
       opérateur d'entreprise le fait. Le dire vaut mieux que promettre. */
    activate: '**004*',
    cancel: '##002#',
    effect: "L'IA prend tout ce que vous ne prenez pas: occupé, sans réponse, ou téléphone éteint.",
    voicemailRisk: true,
    caveat: "Le renvoi selon l'HEURE n'existe pas sur un mobile. Coupez le renvoi le matin, remettez-le le soir, ou passez en renvoi total hors de vos horaires.",
  },
};

/** Le renvoi par défaut quand le client n'a rien choisi. */
export const DEFAULT_FORWARDING: Exclude<ForwardingType, ''> = 'unconditional';

export function forwardingFor(type: string | null | undefined): ForwardingCode & { type: Exclude<ForwardingType, ''> } {
  const key = (type || '') as ForwardingType;
  const resolved = key && key in FORWARDING_CODES ? (key as Exclude<ForwardingType, ''>) : DEFAULT_FORWARDING;
  return { ...FORWARDING_CODES[resolved], type: resolved };
}

/** Le code complet à composer, numéro inclus. */
export function activationCode(type: string | null | undefined, number: string): string {
  const digits = (number || '').replace(/[^\d+]/g, '');
  const { activate } = forwardingFor(type);
  return digits ? `${activate}${digits}#` : `${activate}NUMERO#`;
}

/** Le lien `tel:` correspondant, `#` échappé pour que le clavier l'accepte. */
export function activationLink(type: string | null | undefined, number: string): string | undefined {
  const digits = (number || '').replace(/[^\d+]/g, '');
  if (!digits) return undefined;
  return `tel:${forwardingFor(type).activate}${digits}%23`;
}

export function cancelLink(type: string | null | undefined): string {
  return `tel:${forwardingFor(type).cancel.replace(/#/g, '%23')}`;
}

/** Le lien `tel:` qui efface tous les renvois, messagerie de l'opérateur comprise. */
export function clearAllLink(): string {
  return `tel:${CLEAR_ALL_FORWARDS.replace(/#/g, '%23')}`;
}
