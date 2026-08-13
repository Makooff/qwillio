/**
 * Les libellés de consentement, mot pour mot.
 *
 * Ils vivent ici, côté serveur, et **jamais** dans le corps de la requête.
 * Enregistrer le texte envoyé par le navigateur reviendrait à prouver un
 * consentement à un texte qu'on aurait pu fabriquer soi-même après coup: la
 * preuve ne vaudrait rien. Le formulaire envoie une clé de langue, le serveur
 * inscrit le texte que cette clé désigne.
 *
 * Conséquence à respecter: **le texte affiché sur la page doit être
 * exactement celui-ci.** S'il change ici, il change là-bas, et inversement.
 * C'est pourquoi le frontend lit ces mêmes chaînes plutôt que d'en avoir sa
 * propre copie (`frontend/src/config/consent-statements.ts`, tenu identique).
 *
 * La loi n° 2025-594 définit le consentement comme « libre, spécifique,
 * éclairé, univoque et révocable ». Chaque mot du libellé sert donc:
 *  - le NOM de l'appelant (Qwillio) rend le consentement spécifique;
 *  - l'OBJET (parler de nos services) le rend éclairé;
 *  - la mention du retrait le rend révocable, et le dit avant le clic.
 */

export const CONSENT_STATEMENTS = {
  fr: "J'accepte d'être contacté par téléphone par Qwillio au sujet de ses services de réceptionniste IA. Je peux retirer ce consentement à tout moment, en le disant pendant l'appel ou en écrivant à hello@qwillio.com.",
  nl: 'Ik ga ermee akkoord telefonisch gecontacteerd te worden door Qwillio over hun AI-receptionistdiensten. Ik kan deze toestemming op elk moment intrekken, tijdens het gesprek of via hello@qwillio.com.',
  en: 'I agree to be contacted by phone by Qwillio about its AI receptionist services. I can withdraw this consent at any time, during the call or by writing to hello@qwillio.com.',
} as const;

export type ConsentLocale = keyof typeof CONSENT_STATEMENTS;
