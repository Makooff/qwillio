-- La langue de l'agent suit la langue du SITE a l'inscription.
--
-- Chaque chemin de creation posait `agent_language = 'en'` (en dur, ou par le
-- defaut du schema), et seule la presomption par pays sauvait un client belge
-- ou francais: le profil d'appel lisait « 'en' MAIS pays francophone » comme
-- du francais. Consequence : un client belge ne pouvait JAMAIS passer son agent
-- en anglais depuis ses parametres, le pays annulant le reglage en silence.
--
-- Desormais le choix prime (`clientLocale`), et la langue du site est ecrite a
-- la naissance du client. Elle attend sur l'utilisateur, qui existe avant le
-- client (celui-ci nait au webhook Stripe, apres la caisse).
ALTER TABLE "users" ADD COLUMN "language" VARCHAR(10);

-- Les lignes existantes gardent EXACTEMENT ce qu'elles entendaient hier :
-- un 'en' jamais choisi dans un pays francophone etait servi en francais par
-- la presomption, il devient un 'fr' ecrit. Sans ce geste, faire primer le
-- choix repasserait ces clients en anglais au prochain appel.
UPDATE "clients"
SET "agent_language" = 'fr'
WHERE "agent_language" = 'en'
  AND UPPER(COALESCE("country", '')) IN ('FR', 'BE', 'LU', 'MC', 'CH');
