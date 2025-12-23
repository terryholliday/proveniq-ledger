import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({
  connectionString,
  max: 10,
});

export async function initDb() {
  // Main ledger entries table with hash chaining for immutability
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id UUID PRIMARY KEY,
      sequence_number BIGSERIAL UNIQUE,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      correlation_id TEXT,
      asset_id UUID,
      anchor_id TEXT,
      actor_id TEXT,
      payload JSONB NOT NULL,
      payload_hash TEXT NOT NULL,
      previous_hash TEXT,
      entry_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    CREATE INDEX IF NOT EXISTS idx_ledger_source ON ledger_entries(source);
    CREATE INDEX IF NOT EXISTS idx_ledger_event_type ON ledger_entries(event_type);
    CREATE INDEX IF NOT EXISTS idx_ledger_asset_id ON ledger_entries(asset_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_anchor_id ON ledger_entries(anchor_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_correlation_id ON ledger_entries(correlation_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at);
  `);

  // Audit log for all access and verification attempts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY,
      action TEXT NOT NULL,
      actor_id TEXT,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details JSONB,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
  `);

  // Hash verification checkpoints for integrity audits
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integrity_checkpoints (
      id UUID PRIMARY KEY,
      checkpoint_sequence BIGINT NOT NULL,
      checkpoint_hash TEXT NOT NULL,
      entries_count BIGINT NOT NULL,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      verified_by TEXT
    );
  `);

  // MIGRATION: V4.0 SCHEMA LOCK
  // Adding fields for Canonical Envelope compliance
  await pool.query(`
    DO $$ 
    BEGIN 
      -- Add schema_version
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='schema_version') THEN
        ALTER TABLE ledger_entries ADD COLUMN schema_version TEXT DEFAULT '1.0.0';
      END IF;

      -- Add producer_version
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='producer_version') THEN
        ALTER TABLE ledger_entries ADD COLUMN producer_version TEXT;
      END IF;

      -- Add occurred_at (Client Time)
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='occurred_at') THEN
        ALTER TABLE ledger_entries ADD COLUMN occurred_at TIMESTAMPTZ;
      END IF;

      -- Add signatures (JSONB)
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='signatures') THEN
        ALTER TABLE ledger_entries ADD COLUMN signatures JSONB;
      END IF;

      -- Add subject (JSONB) - Full subject object for completeness
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='subject') THEN
        ALTER TABLE ledger_entries ADD COLUMN subject JSONB;
      END IF;

      -- Add idempotency_key for duplicate prevention
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='idempotency_key') THEN
        ALTER TABLE ledger_entries ADD COLUMN idempotency_key TEXT;
      END IF;

      -- Add canonical_hash_hex for payload integrity
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='canonical_hash_hex') THEN
        ALTER TABLE ledger_entries ADD COLUMN canonical_hash_hex TEXT;
      END IF;
    END $$;
  `);

  // Create unique index on idempotency_key for duplicate prevention
  // This enforces idempotency at the database level
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency_key 
    ON ledger_entries(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
  `);
}
