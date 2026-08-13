/**
 * Miroir de `backend/src/config/consent-statements.ts`.
 *
 * Le texte affiché à côté de la case DOIT être exactement celui que le serveur
 * enregistre. Sinon on prouverait un consentement à une phrase que la personne
 * n'a jamais lue — c'est-à-dire rien du tout.
 *
 * Le formulaire n'envoie donc PAS ce texte au serveur: il envoie une clé de
 * langue, et le serveur inscrit sa propre copie. Ce fichier ne sert qu'à
 * l'affichage. Les deux se tiennent à jour ensemble, et un test le vérifie.
 */

export const CONSENT_STATEMENTS = {
  fr: "J'accepte d'être contacté par téléphone par Qwillio au sujet de ses services de réceptionniste IA. Je peux retirer ce consentement à tout moment, en le disant pendant l'appel ou en écrivant à hello@qwillio.com.",
  nl: 'Ik ga ermee akkoord telefonisch gecontacteerd te worden door Qwillio over hun AI-receptionistdiensten. Ik kan deze toestemming op elk moment intrekken, tijdens het gesprek of via hello@qwillio.com.',
  en: 'I agree to be contacted by phone by Qwillio about its AI receptionist services. I can withdraw this consent at any time, during the call or by writing to hello@qwillio.com.',
} as const;

export type ConsentLocale = keyof typeof CONSENT_STATEMENTS;
