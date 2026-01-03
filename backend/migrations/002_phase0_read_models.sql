-- ============================================================================
-- PROVENIQ Memory (Ledger) - Phase 0 Ledger + Rebuildable Read Models
-- Migration: 002_phase0_read_models.sql
-- ============================================================================
-- DECISION: Option B (LOCKED) - Keep ledger_entries authoritative.
-- Provide VIEW ledger_events for spec alignment (no rename).
-- ============================================================================

-- 1) Extend ledger_entries columns needed for replay/audit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='ruleset_version') THEN
    ALTER TABLE ledger_entries ADD COLUMN ruleset_version TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='asset_state_hash') THEN
    ALTER TABLE ledger_entries ADD COLUMN asset_state_hash TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='evidence_set_hash') THEN
    ALTER TABLE ledger_entries ADD COLUMN evidence_set_hash TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='signature_key_id') THEN
    ALTER TABLE ledger_entries ADD COLUMN signature_key_id TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='verification_tier') THEN
    ALTER TABLE ledger_entries ADD COLUMN verification_tier TEXT NULL;
  END IF;
END $$;

-- Backfill + enforce ruleset_version invariant
UPDATE ledger_entries SET ruleset_version = 'v1.0.0' WHERE ruleset_version IS NULL;
ALTER TABLE ledger_entries ALTER COLUMN ruleset_version SET DEFAULT 'v1.0.0';
ALTER TABLE ledger_entries ALTER COLUMN ruleset_version SET NOT NULL;

-- 2) VIEW ledger_events (spec alignment)
DROP VIEW IF EXISTS ledger_events;
CREATE VIEW ledger_events AS
SELECT
  -- Spec-required fields
  id                  AS event_id,
  event_type          AS event_type,
  asset_id            AS asset_id,
  payload             AS payload_json,
  ruleset_version     AS ruleset_version,
  asset_state_hash    AS asset_state_hash,
  evidence_set_hash   AS evidence_set_hash,
  previous_hash       AS prev_hash,
  entry_hash          AS event_hash,
  signature_key_id    AS signature_key_id,

  -- Useful envelope fields (already present)
  schema_version      AS schema_version,
  source              AS producer,
  producer_version    AS producer_version,
  occurred_at         AS occurred_at,
  created_at          AS committed_at,
  correlation_id      AS correlation_id,
  idempotency_key     AS idempotency_key,
  canonical_hash_hex  AS canonical_hash_hex,
  signatures          AS signatures_json,
  subject             AS subject_json,
  sequence_number     AS sequence_number
FROM ledger_entries;

-- 3) Read models (rebuildable; performance only)
CREATE TABLE IF NOT EXISTS assets_read (
  asset_id UUID PRIMARY KEY,
  claim_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_asset_state_hash TEXT
);

CREATE TABLE IF NOT EXISTS evidence_snapshots (
  id UUID PRIMARY KEY,
  asset_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  storage_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata_json JSONB
);

CREATE TABLE IF NOT EXISTS verification_cache (
  asset_id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  physical_conf_bps INT NOT NULL,
  narrative_conf_bps INT NOT NULL,
  last_verification_event_id TEXT,
  expires_at TIMESTAMPTZ NULL,
  active_freeze BOOLEAN NOT NULL,
  active_flags_json JSONB,
  ruleset_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proof_views (
  proof_id UUID PRIMARY KEY,
  asset_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  scope_json JSONB
);

-- Phase 0 patch: bind proof views to a specific verification grant + snapshot inputs
DO $$
DECLARE
  row_count BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proof_views' AND column_name='verification_event_id') THEN
    ALTER TABLE proof_views ADD COLUMN verification_event_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proof_views' AND column_name='asset_state_hash') THEN
    ALTER TABLE proof_views ADD COLUMN asset_state_hash TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proof_views' AND column_name='evidence_set_hash') THEN
    ALTER TABLE proof_views ADD COLUMN evidence_set_hash TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proof_views' AND column_name='ruleset_version') THEN
    ALTER TABLE proof_views ADD COLUMN ruleset_version TEXT;
  END IF;

  -- Enforce NOT NULL only for new deployments (read model tables are rebuildable).
  SELECT COUNT(*) INTO row_count FROM proof_views;
  IF row_count = 0 THEN
    ALTER TABLE proof_views ALTER COLUMN verification_event_id SET NOT NULL;
    ALTER TABLE proof_views ALTER COLUMN asset_state_hash SET NOT NULL;
    ALTER TABLE proof_views ALTER COLUMN evidence_set_hash SET NOT NULL;
    ALTER TABLE proof_views ALTER COLUMN ruleset_version SET NOT NULL;
  END IF;
END $$;

-- 4) Indexes for replay speed
CREATE INDEX IF NOT EXISTS idx_ledger_entries_asset_seq ON ledger_entries(asset_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_event_type ON ledger_entries(event_type);
-- producer/idempotency already exists

CREATE INDEX IF NOT EXISTS idx_proof_views_asset_id ON proof_views(asset_id);
CREATE INDEX IF NOT EXISTS idx_verification_cache_status ON verification_cache(status);
