/**
 * LA langue du client. Une seule règle, pour toutes les surfaces.
 *
 * ## Le défaut que ça corrige
 *
 * « Il y a souvent des mélanges français, anglais, j'en ai marre. » Relevé le
 * 11/09/2026 sur le portail et sur les e-mails, et ce n'était pas un hasard
 * d'affichage: SEPT règles différentes, écrites à la main, répondaient à la
 * même question dans le dépôt, et elles se contredisaient.
 *
 *   `agentLanguage === 'fr' ? 'fr' : 'en'`          un client flamand → ANGLAIS
 *   `agentLanguage === 'nl' ? 'nl' : … : 'fr'`      un client non réglé → FRANÇAIS
 *   `agentLanguage === 'fr' || country ∈ [FR,BE…]`  le pays peut renverser le réglage
 *   `lang === 'en' ? 'en' : 'fr'`                   côté e-mails, français par défaut
 *
 * Le même client passait donc en anglais sur un écran et en français sur le
 * suivant, selon la règle que ce bout de code avait recopiée. C'est 6vicies à
 * grande échelle: deux règles écrites à la main pour la même question finissent
 * toujours par diverger, et ici il y en avait sept.
 *
 * ## L'ordre, et pourquoi le réglage l'emporte sur le pays
 *
 * `agentLanguage` est un CHOIX du client, posé dans ses paramètres. Le pays
 * n'est qu'une présomption. Laisser le pays renverser le choix, c'est répondre
 * en français à un commerce bruxellois qui a explicitement demandé le
 * néerlandais, ce qui est précisément le cas que la Belgique rend courant.
 * Le pays ne sert donc que de REPLI, quand rien n'a été choisi.
 */
export type ClientLocale = 'fr' | 'en' | 'nl';

/** Les pays où le français est la présomption raisonnable, à défaut de choix. */
const FRENCH_SPEAKING = new Set(['FR', 'BE', 'LU', 'MC', 'CH']);

export function clientLocale(client: {
  agentLanguage?: string | null;
  country?: string | null;
}): ClientLocale {
  const chosen = String(client.agentLanguage ?? '').trim().toLowerCase();
  if (chosen === 'fr' || chosen === 'en' || chosen === 'nl') return chosen;
  return FRENCH_SPEAKING.has(String(client.country ?? '').toUpperCase()) ? 'fr' : 'en';
}

/**
 * La langue des E-MAILS, qui n'a que deux gabarits.
 *
 * Le rétrécissement est EXPLICITE et porte son nom, plutôt que d'être un
 * `=== 'fr' ? 'fr' : 'en'` recopié au fil des fichiers. Un client néerlandophone
 * reçoit donc l'anglais, et c'est visible ici au lieu d'être une surprise: le
 * jour où les gabarits néerlandais existeront, une seule ligne change.
 */
export type EmailLang = 'fr' | 'en';

export function emailLocale(client: { agentLanguage?: string | null; country?: string | null }): EmailLang {
  const locale = clientLocale(client);
  return locale === 'fr' ? 'fr' : 'en';
}

/**
 * La langue de l'agent à la NAISSANCE du client.
 *
 * « La langue doit être auto en fonction de quelle langue [est] choisie sur le
 * site à la création du compte » (12/09/2026). Jusque-là, chaque chemin de
 * création posait `'en'` en dur ou laissait le défaut du schéma (`'en'`), et
 * seule la présomption par pays sauvait un client belge, en le servant en
 * français MALGRÉ un réglage qui disait anglais: le réglage ne pouvait donc
 * jamais être changé vers l'anglais depuis les paramètres, puisque le pays
 * l'annulait.
 *
 * La langue du site est un choix que le visiteur vient de faire (sélecteur de
 * la barre, ou fuseau horaire): elle vaut mieux que le pays, qui ne l'emporte
 * que faute de mieux. Ce que le client change ensuite dans ses paramètres est
 * lu par `clientLocale`, où le choix prime toujours.
 */
export function signupAgentLanguage(input: {
  siteLanguage?: string | null;
  country?: string | null;
}): ClientLocale {
  const site = String(input.siteLanguage ?? '').trim().toLowerCase();
  if (site === 'fr' || site === 'en' || site === 'nl') return site;
  return clientLocale({ country: input.country });
}
