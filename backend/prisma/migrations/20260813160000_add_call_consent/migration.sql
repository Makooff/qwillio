-- Consentement préalable à l'appel sortant (loi n° 2025-594, France,
-- applicable depuis le 11/08/2026). Voir `utils/outbound-legal.ts` et
-- `services/call-consent.service.ts`.
--
-- Table nouvelle, purement additive: aucune donnée existante n'est touchée.
-- `id` sans défaut SQL, comme toutes les autres tables de ce schéma: c'est
-- Prisma Client qui produit l'UUID (`@default(uuid())`). Un
-- `DEFAULT gen_random_uuid()` aurait introduit une dépendance à pgcrypto /
-- PostgreSQL 13 qui n'existe nulle part ailleurs dans ces migrations, pour un
-- filet dont personne ne se sert.
CREATE TABLE IF NOT EXISTS "call_consents" (
  "id"             UUID         NOT NULL,
  "phone"          VARCHAR(50)  NOT NULL,
  "country_code"   VARCHAR(10)  NOT NULL,
  "source"         VARCHAR(50)  NOT NULL,
  "statement"      TEXT         NOT NULL,
  "collected_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address"     VARCHAR(64),
  "evidence_url"   VARCHAR(500),
  "expires_at"     TIMESTAMP(3),
  "revoked_at"     TIMESTAMP(3),
  "revoked_source" VARCHAR(50),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "call_consents_pkey" PRIMARY KEY ("id")
);

-- La recherche se fait toujours par numéro, jamais par identifiant: c'est le
-- numéro qui porte le consentement, le prospect pouvant être recréé par un
-- scraping ultérieur.
CREATE INDEX IF NOT EXISTS "call_consents_phone_idx" ON "call_consents" ("phone");
