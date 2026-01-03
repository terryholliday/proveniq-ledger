-- ============================================================================
-- PROVENIQ Memory (Ledger) - Phase 0 (Launch-Safe) Schema Extensions
-- Migration: 002_phase0_launch_safe.sql
-- ============================================================================
-- PURPOSE:
-- - Keep ledger_entries as the authoritative append-only store (Option B)
-- - Provide a ledger_events VIEW with Phase 0 required column names
-- - Add rebuildable read models (performance only; drop/rebuild safe)
--
-- LEGAL / AUDIT RATIONALE:
-- - Ledger is append-only and authoritative
-- - Read models are rebuildable from Ledger replay
-- - Verification applies ONLY to snapshot hashes (asset_state_hash + evidence_set_hash)
-- ============================================================================

-- ============================================================================
-- 1) Ledger authoritative columns (extend ledger_entries)
-- ============================================================================

DO $$
BEGIN
  -- Ruleset version used to compute derived outputs (when applicable)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='ruleset_version') THEN
    ALTER TABLE ledger_entries ADD COLUMN ruleset_version TEXT;
  END IF;

  -- Snapshot hashing at verification time (when applicable)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='asset_state_hash') THEN
    ALTER TABLE ledger_entries ADD COLUMN asset_state_hash TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='evidence_set_hash') THEN
    ALTER TABLE ledger_entries ADD COLUMN evidence_set_hash TEXT;
  END IF;

  -- Signing hook (KMS-compatible abstraction)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='signature_key_id') THEN
    ALTER TABLE ledger_entries ADD COLUMN signature_key_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ledger_entries_asset_state_hash ON ledger_entries(asset_state_hash);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_evidence_set_hash ON ledger_entries(evidence_set_hash);

-- ============================================================================
-- 2) Phase 0 view: ledger_events (compatibility contract)
-- ============================================================================

DROP VIEW IF EXISTS ledger_events;
CREATE VIEW ledger_events AS
SELECT
  id                           AS event_id,
  event_type                   AS event_type,
  asset_id                     AS asset_id,
  payload                      AS payload_json,
  ruleset_version              AS ruleset_version,
  asset_state_hash             AS asset_state_hash,
  evidence_set_hash            AS evidence_set_hash,
  previous_hash                AS prev_hash,
  entry_hash                   AS event_hash,
  signature_key_id             AS signature_key_id,
  signatures                   AS signatures_json,
  schema_version               AS schema_version,
  source                       AS producer,
  producer_version             AS producer_version,
  occurred_at                  AS occurred_at,
  created_at                   AS committed_at,
  correlation_id               AS correlation_id,
  idempotency_key              AS idempotency_key,
  canonical_hash_hex           AS canonical_hash_hex,
  subject                      AS subject_json,
  sequence_number              AS sequence_number
FROM ledger_entries;

-- ============================================================================
-- 3) Read models (performance only; rebuildable from ledger replay)
-- ============================================================================

-- Asset read model - mutable, derived view store
CREATE TABLE IF NOT EXISTS assets_read (
  asset_id UUID PRIMARY KEY,
  last_event_sequence BIGINT NOT NULL DEFAULT 0,
  user_claims_json JSONB,
  derived_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evidence snapshot read model - immutable snapshots referenced by verification
-- (Table is mutable only in the sense that new rows append; old rows should not be mutated.)
CREATE TABLE IF NOT EXISTS evidence_snapshots (
  evidence_id UUID PRIMARY KEY,
  asset_id UUID NOT NULL,
  content_hash TEXT NOT NULL,
  observed_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_asset_id ON evidence_snapshots(asset_id);
CREATE INDEX IF NOT EXISTS idx_evidence_snapshots_content_hash ON evidence_snapshots(content_hash);

-- Derived verification cache (discardable)
CREATE TABLE IF NOT EXISTS verification_cache (
  asset_id UUID PRIMARY KEY,
  derived_state_json JSONB NOT NULL,
  computed_from_sequence BIGINT NOT NULL,
  ruleset_version TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_cache_expires_at ON verification_cache(expires_at);

-- TTL-bound proof views (anti-screenshot)
CREATE TABLE IF NOT EXISTS proof_views (
  id UUID PRIMARY KEY,
  asset_id UUID NOT NULL,
  snapshot_hash TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proof_views_asset_id ON proof_views(asset_id);
CREATE INDEX IF NOT EXISTS idx_proof_views_expires_at ON proof_views(expires_at);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
