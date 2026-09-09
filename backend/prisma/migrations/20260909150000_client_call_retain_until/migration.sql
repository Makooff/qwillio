-- La DATE LIMITE de chaque appel, posee a l'ecriture (LEG-4).
--
-- La purge quotidienne la calculait a chaque passage depuis le reglage COURANT
-- du client. Consequence: aucun enregistrement ne portait d'echeance, et la
-- question « jusqu'a quand gardez-vous cet appel » n'avait pas de reponse
-- verifiable -- ce que la CNIL demande precisement de pouvoir montrer.
--
-- La purge efface desormais au PREMIER des deux termes echus: cette colonne, ou
-- le calcul courant. Un client qui RALLONGE sa conservation ne prolonge donc pas
-- les appels deja enregistres; un client qui la RACCOURCIT les efface plus tot.
--
-- NULL sur les lignes existantes, et c'est voulu: leur echeance n'a jamais ete
-- posee, elles restent regies par le calcul jusqu'a leur purge.
ALTER TABLE "client_calls" ADD COLUMN "retain_until" TIMESTAMP(3);

-- La purge balaie sur cette colonne seule.
CREATE INDEX "client_calls_retain_until_idx" ON "client_calls"("retain_until");
