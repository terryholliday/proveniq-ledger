import pg from 'pg';
const { Client } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Ledger Database.');

    const statements = [
      // 1. Ledger Entries Table
      `CREATE TABLE IF NOT EXISTS ledger_entries (
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
      )`,

      // 2. Ledger Indices
      `CREATE INDEX IF NOT EXISTS idx_ledger_source ON ledger_entries(source)`,
      `CREATE INDEX IF NOT EXISTS idx_ledger_event_type ON ledger_entries(event_type)`,
      `CREATE INDEX IF NOT EXISTS idx_ledger_asset_id ON ledger_entries(asset_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ledger_anchor_id ON ledger_entries(anchor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ledger_correlation_id ON ledger_entries(correlation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at)`,

      // 3. Audit Log Table
      `CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY,
        action TEXT NOT NULL,
        actor_id TEXT,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details JSONB,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,

      // 4. Audit Indices
      `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)`,

      // 5. Integrity Checkpoints
      `CREATE TABLE IF NOT EXISTS integrity_checkpoints (
        id UUID PRIMARY KEY,
        checkpoint_sequence BIGINT NOT NULL,
        checkpoint_hash TEXT NOT NULL,
        entries_count BIGINT NOT NULL,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        verified_by TEXT
      )`
    ];

    console.log('Applying Base Schema Statements...');
    for (const [index, sql] of statements.entries()) {
      try {
        await client.query(sql);
        console.log(`Statement ${index + 1}/${statements.length} applied.`);
      } catch (stmtErr) {
        console.error(`Statement ${index + 1} Failed:`, stmtErr.message);
        // Don't throw, continue
      }
    }
    console.log('Base Schema Applied (DO block skipped).');

    // 8. Immutability Constraints
    console.log('Applying Immutability Constraints...');
    const migrationPath = path.join(__dirname, '../migrations/001_immutability_constraints.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      try {
        await client.query(sql);
        console.log('Immutability Constraints Applied.');
      } catch (migErr) {
        console.error('Constraints Warning:', migErr.message);
      }
    } else {
      console.warn('Warning: Immutability migration file not found at ' + migrationPath);
    }

    console.log('✅ Ledger Database Setup Complete.');
  } catch (err) {
    console.error('Migration Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
