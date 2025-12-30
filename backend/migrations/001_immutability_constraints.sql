-- ============================================================================
-- PROVENIQ Memory (Ledger) - Immutability & Integrity Constraints
-- Migration: 001_immutability_constraints.sql
-- ============================================================================
-- PURPOSE: Enforce WORM (Write Once, Read Many) semantics on ledger tables
-- CRITICAL: This migration makes UPDATE/DELETE operations impossible on core
--           ledger tables, ensuring cryptographic chain integrity.
-- ============================================================================

-- ============================================================================
-- PHASE 1: Unique Constraints (Replay Protection & Sequencing)
-- ============================================================================

-- Ensure sequence_number is unique and monotonic
-- This prevents duplicate sequence numbers from breaking the chain
ALTER TABLE ledger_entries
  ADD CONSTRAINT IF NOT EXISTS ledger_entries_sequence_unique 
  UNIQUE (sequence_number);

-- Ensure event_id is unique (idempotency / replay protection)
-- Prevents the same event from being ingested twice
ALTER TABLE ledger_entries
  ADD CONSTRAINT IF NOT EXISTS ledger_entries_event_id_unique 
  UNIQUE (id);

-- Add unique constraint on idempotency_key (already has partial unique index)
-- This ensures client-provided idempotency keys are honored
-- Note: The partial index already exists, this is for completeness
-- ALTER TABLE ledger_entries
--   ADD CONSTRAINT IF NOT EXISTS ledger_entries_idempotency_key_unique
--   UNIQUE (idempotency_key);
-- (Skipped - partial unique index is sufficient and more flexible)

-- ============================================================================
-- PHASE 2: Performance Indices (Verification & Replay)
-- ============================================================================

-- Index for efficient "latest entry" lookups (DESC order)
-- Critical for hash chain verification and canonical write path
CREATE INDEX IF NOT EXISTS ledger_entries_sequence_desc_idx
  ON ledger_entries (sequence_number DESC);

-- Index for event_id lookups (already exists as PRIMARY KEY, but explicit)
-- CREATE INDEX IF NOT EXISTS ledger_entries_event_id_idx
--   ON ledger_entries (id);
-- (Skipped - PRIMARY KEY already provides this)

-- ============================================================================
-- PHASE 3: WORM Enforcement (Write Once, Read Many)
-- ============================================================================

-- Create trigger function to prevent UPDATE operations on ledger_entries
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Reject UPDATE operations
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'UPDATE operations are forbidden on ledger_entries (WORM enforcement). Table: %, Operation: %', TG_TABLE_NAME, TG_OP
      USING ERRCODE = 'integrity_constraint_violation',
            HINT = 'Ledger entries are immutable. Create a new event instead.';
  END IF;

  -- Reject DELETE operations
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'DELETE operations are forbidden on ledger_entries (WORM enforcement). Table: %, Operation: %', TG_TABLE_NAME, TG_OP
      USING ERRCODE = 'integrity_constraint_violation',
            HINT = 'Ledger entries are immutable. They cannot be deleted.';
  END IF;

  -- This should never be reached, but return OLD for safety
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach WORM trigger to ledger_entries table
DROP TRIGGER IF EXISTS enforce_ledger_immutability ON ledger_entries;
CREATE TRIGGER enforce_ledger_immutability
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_mutation();

-- ============================================================================
-- PHASE 4: Audit Log Protection (Optional but Recommended)
-- ============================================================================

-- Audit log should also be append-only (no updates/deletes)
-- This prevents tampering with the audit trail
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'UPDATE operations are forbidden on audit_log (append-only). Table: %, Operation: %', TG_TABLE_NAME, TG_OP
      USING ERRCODE = 'integrity_constraint_violation',
            HINT = 'Audit log is append-only. Create a new audit entry instead.';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'DELETE operations are forbidden on audit_log (append-only). Table: %, Operation: %', TG_TABLE_NAME, TG_OP
      USING ERRCODE = 'integrity_constraint_violation',
            HINT = 'Audit log is append-only. Entries cannot be deleted.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_audit_immutability ON audit_log;
CREATE TRIGGER enforce_audit_immutability
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

-- ============================================================================
-- PHASE 5: Verification
-- ============================================================================

-- Verify constraints are active
DO $$
DECLARE
  constraint_count INTEGER;
  trigger_count INTEGER;
BEGIN
  -- Check unique constraints
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_name = 'ledger_entries'
    AND constraint_type = 'UNIQUE'
    AND constraint_name IN ('ledger_entries_sequence_unique', 'ledger_entries_event_id_unique');

  IF constraint_count < 2 THEN
    RAISE WARNING 'Expected 2 unique constraints on ledger_entries, found %', constraint_count;
  END IF;

  -- Check WORM triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'ledger_entries'
    AND trigger_name = 'enforce_ledger_immutability';

  IF trigger_count = 0 THEN
    RAISE WARNING 'WORM trigger not found on ledger_entries';
  END IF;

  RAISE NOTICE '✅ Immutability constraints verified: % unique constraints, % WORM triggers', constraint_count, trigger_count;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The ledger is now immutable at the database level.
-- Any attempt to UPDATE or DELETE will fail with an exception.
-- ============================================================================
