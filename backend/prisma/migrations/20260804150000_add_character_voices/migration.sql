-- Per-character ElevenLabs voice ids, assigned from the shared library and
-- checked against each character's gender. Nullable: an empty column means
-- "not assigned yet", which the service treats as its cue to pick voices.
ALTER TABLE "admin_config" ADD COLUMN IF NOT EXISTS "character_voices" JSONB;
