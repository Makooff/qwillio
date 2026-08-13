-- Par quel canal le rappel de rendez-vous est parti.
--
-- Le rappel J-1 passe désormais par WhatsApp d'abord, SMS en repli. Les deux
-- ne partent jamais ensemble: un même rappel reçu deux fois ne donne pas
-- l'impression qu'on est prévenant, et le SMS est facturé au segment.
--
-- `sms_reminder_sent` garde son nom (le renommer casserait l'existant pour
-- rien) mais signifie maintenant « rappel téléphone envoyé, quel qu'en soit le
-- canal ». Cette colonne dit lequel — c'est la première question du support
-- quand un client affirme n'avoir rien reçu.
--
-- Additive et nullable: les rappels déjà partis restent à NULL, ce qui se lit
-- correctement comme « canal inconnu, antérieur à la bascule ».
ALTER TABLE "client_bookings"
  ADD COLUMN IF NOT EXISTS "reminder_channel" VARCHAR(20);
