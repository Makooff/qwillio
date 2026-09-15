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
    effect: "L'IA prend l'appel quand vous ne répondez pas après 30 secondes de sonnerie.",
    voicemailRisk: true,
    caveat: "L'appelant patiente pendant les sonneries avant d'entendre l'IA. En échange, l'IA peut vous transférer un appel sur ce même téléphone.",
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

/**
 * Le délai du renvoi sur NON-RÉPONSE, en secondes, écrit dans le code composé
 * (`*61*numéro**30#`, la syntaxe MMI, bornée à 30 par le GSM).
 *
 * Il doit être PLUS LONG que la sonnerie d'un transfert (20 s côté serveur,
 * `VOICE_TRANSFER_RING_SECONDS`): quand l'IA transfère vers le mobile du
 * client et qu'il ne répond pas, Vapi abandonne à 20 s, avant que le renvoi
 * ne ramène le transfert chez nous. C'est ce qui rend le montage à UN numéro
 * possible (15/09/2026). Sans délai écrit, l'opérateur applique le sien,
 * souvent 15 s, et le transfert reviendrait vers l'IA.
 */
export const NO_ANSWER_DELAY_SECONDS = 30;

/** Le suffixe de délai, seulement pour les renvois qui en portent un. */
function delaySuffix(type: Exclude<ForwardingType, ''>): string {
  return type === 'no_answer' || type === 'scheduled' ? `**${NO_ANSWER_DELAY_SECONDS}` : '';
}

/** Le code complet à composer, numéro inclus. */
export function activationCode(type: string | null | undefined, number: string): string {
  const digits = (number || '').replace(/[^\d+]/g, '');
  const renvoi = forwardingFor(type);
  return `${renvoi.activate}${digits || 'NUMERO'}${delaySuffix(renvoi.type)}#`;
}

/** Le lien `tel:` correspondant, `#` échappé pour que le clavier l'accepte. */
export function activationLink(type: string | null | undefined, number: string): string | undefined {
  const digits = (number || '').replace(/[^\d+]/g, '');
  if (!digits) return undefined;
  const renvoi = forwardingFor(type);
  return `tel:${renvoi.activate}${digits}${delaySuffix(renvoi.type)}%23`;
}

export function cancelLink(type: string | null | undefined): string {
  return `tel:${forwardingFor(type).cancel.replace(/#/g, '%23')}`;
}

/** Le lien `tel:` qui efface tous les renvois, messagerie de l'opérateur comprise. */
export function clearAllLink(): string {
  return `tel:${CLEAR_ALL_FORWARDS.replace(/#/g, '%23')}`;
}

/**
 * Ce que le client doit comprendre AVANT de saisir un numéro de transfert.
 *
 * ## Le malentendu que ça dissipe
 *
 * « Je ne peux pas mettre mon numéro, il renvoie vers l'IA. » C'est exact, et
 * le refus de boucle le dit déjà, mais il le dit trop tard : au moment où
 * l'enregistrement échoue, donc après la saisie. Le client en conclut que le
 * produit exige deux numéros, alors que la vraie règle est plus simple et
 * moins exigeante : **une même ligne ne peut pas être à la fois celle qui
 * renvoie vers l'IA et celle vers qui l'IA renvoie.**
 *
 * ## Pourquoi le champ n'est pas grisé
 *
 * Première idée, écartée : couper le champ dès que le renvoi est conditionnel.
 * C'est faux. Avec un renvoi sur non-réponse, transférer vers un COLLÈGUE
 * reste parfaitement sensé, et griser le champ retirerait cette possibilité à
 * tous ceux qui l'ont. On explique la conséquence, on ne décide pas à la
 * place du client.
 *
 * ## Pourquoi une phrase par type de renvoi
 *
 * La raison pour laquelle la ligne d'origine ne convient pas n'est pas la même
 * dans les quatre cas, et une formule générique les décrirait tous mal :
 * occupé retombe sur une ligne occupée, non-réponse sonne dans le vide,
 * inconditionnel repart en boucle. Nommer la bonne raison est ce qui fait
 * comprendre du premier coup au lieu d'obliger à essayer.
 */
export interface TransferAdvice {
  /** Ce qui arrive à l'appel, selon que le champ est rempli ou vide. */
  effect: string;
  /** Pourquoi la ligne qui renvoie ne peut pas être la cible. */
  constraint: string;
}

export const TRANSFER_CONSTRAINT: Record<ForwardingType, string> = {
  /* « Automatique » veut dire que le client ne nous a rien dit. On suppose le
     cas le plus exigeant, qui est aussi le défaut de la fiche d'installation :
     supposer l'inverse laisserait passer la boucle sans un mot. */
  '': "Tous les appels arrivent à l'IA, donc c'est elle qui décroche. Indiquez une ligne qui ne renvoie pas vers elle, sinon l'appel repart en boucle.",
  unconditional:
    "Tous les appels arrivent à l'IA, donc c'est elle qui décroche. Indiquez une ligne qui ne renvoie pas vers elle, sinon l'appel repart en boucle.",
  /* Renvoi CONDITIONNEL : le téléphone du client sonne AVANT l'IA, donc son
     propre mobile est une cible valide. C'est le montage à un seul numéro
     (15/09/2026). Si sa ligne est occupée, le transfert revient vers l'IA,
     qui le raccroche et prend un message. */
  busy: "L'IA prend le relais quand votre ligne est occupée. Votre propre numéro convient : si vous êtes encore en ligne au moment du transfert, l'IA prend un message.",
  no_answer:
    "L'IA prend le relais quand personne n'a décroché. Votre propre numéro convient : il sonne 20 secondes, et si vous ne répondez pas, l'IA prend un message.",
  scheduled: "L'IA prend tout ce que vous ne prenez pas. Votre propre numéro convient : il sonne d'abord, et si vous ne répondez pas, l'IA prend un message.",
};

/** Aide contextuelle du champ « Numéro de transfert ». */
export function transferAdvice(forwarding: ForwardingType, hasNumber: boolean): TransferAdvice {
  return {
    effect: hasNumber
      ? "L'IA transfère les appels urgents à ce numéro."
      : "Vide, l'IA ne transfère jamais : elle prend le message et vous prévient.",
    constraint: TRANSFER_CONSTRAINT[forwarding] ?? TRANSFER_CONSTRAINT[''],
  };
}
