-- Changement d'adresse de connexion, en deux temps.
--
-- L'adresse ne bascule QU'À la confirmation du lien envoyé à la nouvelle: sans
-- ces colonnes, la seule façon d'écrire la nouvelle adresse serait de la poser
-- tout de suite dans `email`, et une faute de frappe fermerait le compte à son
-- propriétaire, sans retour possible.
--
-- Colonnes NULLABLES et sans valeur par défaut: ajout sans réécriture de table
-- ni verrou sur les comptes existants.
ALTER TABLE "users" ADD COLUMN "pending_email" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "pending_email_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "pending_email_expiry" TIMESTAMP(3);

-- Index UNIQUE sur le jeton: c'est par lui qu'on retrouve la demande, et deux
-- comptes ne peuvent pas partager le même. `CREATE UNIQUE INDEX` sur une
-- colonne toute neuve, donc entièrement NULL, est immédiat.
CREATE UNIQUE INDEX "users_pending_email_token_key" ON "users"("pending_email_token");
