-- ── LE SECOND AGENDA : OUTLOOK / MICROSOFT 365 ───────────────────────────────
--
-- Google Agenda était la seule option, et ce n'était pas un choix : un client
-- sous Outlook confirmait un rendez-vous qui n'apparaissait dans aucun agenda à
-- lui. Ces trois colonnes portent le jeton Microsoft, l'identifiant de son
-- calendrier, et le choix explicite quand les deux agendas sont branchés.
--
-- Les anciennes colonnes Google restent en place et inchangées : les deux jeux
-- coexistent, et `calendar_provider` dit lequel fait foi. Un client qui n'a
-- jamais touché à ce champ garde Google, ce qui est l'état de tous les comptes
-- créés avant ce jour — la colonne est donc nullable et SANS défaut, pour que
-- l'absence veuille dire « déduis-le des jetons présents » et non « Google ».

ALTER TABLE "clients"
  ADD COLUMN "outlook_calendar_id"   VARCHAR(255),
  ADD COLUMN "outlook_refresh_token" TEXT,
  ADD COLUMN "calendar_provider"     VARCHAR(20);
