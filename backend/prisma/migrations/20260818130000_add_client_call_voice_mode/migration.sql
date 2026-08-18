-- Le moteur vocal RÉELLEMENT utilisé par l'appel: 'realtime' (parole-à-parole)
-- ou 'classic' (transcription, modèle, synthèse).
--
-- Pourquoi une colonne et pas le réglage du client: le réglage dit ce qui a été
-- demandé, la colonne dit ce qui s'est produit. Une voix clonée force le mode
-- classique même quand le client a choisi « temps réel »; facturer le réglage
-- surfacturerait donc tous les clients qui ont enregistré leur voix.
--
-- Nullable: les appels antérieurs à cette colonne n'ont pas de mode connu, et
-- une valeur inventée serait facturée. Un NULL n'est jamais facturé.
ALTER TABLE "client_calls" ADD COLUMN IF NOT EXISTS "voice_mode" VARCHAR(20);

-- La facturation mensuelle somme les minutes d'un client, d'un mois, d'un mode.
CREATE INDEX IF NOT EXISTS "client_calls_client_id_voice_mode_created_at_idx"
  ON "client_calls" ("client_id", "voice_mode", "created_at");
