-- La SIGNATURE VOCALE d'un accueil pre-enregistre.
--
-- Une ligne de `greeting_audio` ne portait que son TEXTE. C'est suffisant pour
-- detecter un renommage, et insuffisant pour tout le reste: le meme texte, dit
-- par ElevenLabs ou par Cartesia, ce sont deux voix differentes. La bascule du
-- 27/08 vers Cartesia a donc laisse des accueils enregistres avec l'ancienne
-- voix, servis tels quels a l'appel -- une voix accueille, une autre repond,
-- au milieu du premier tour de parole.
--
-- Les trois colonnes disent QUI a synthetise la ligne. La lecture les compare
-- a la voix que l'appel va reellement servir, et refuse ce qui ne correspond
-- pas: mieux vaut une synthese en direct un peu plus lente qu'un changement de
-- voix a la deuxieme phrase.
--
-- Elles sont NULL sur les lignes existantes, et c'est voulu: leur provenance
-- est inconnue, donc elles ne peuvent pas etre declarees conformes. NULL ne
-- correspond a rien, elles cessent d'etre servies, et la prochaine
-- synchronisation de l'assistant les regenere avec leur signature.
ALTER TABLE "greeting_audio" ADD COLUMN "provider" VARCHAR(20);
ALTER TABLE "greeting_audio" ADD COLUMN "voice_id" VARCHAR(100);
ALTER TABLE "greeting_audio" ADD COLUMN "tts_model" VARCHAR(100);
