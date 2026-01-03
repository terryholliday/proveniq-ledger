/**
 * PROVENIQ Memory (Ledger) - Canonical Event Ingestion
 * 
 * CONCURRENCY MODEL: Single-Writer Advisory Lock (Institutional-Grade)
 * 
 * This module implements the production-ready canonical event ingestion path
 * with cryptographic hash chain integrity guarantees.
 * 
 * KEY INVARIANTS:
 * 1. Hash chain is linear and non-forkable
 * 2. Concurrent writes are serialized via PostgreSQL advisory lock
 * 3. Idempotency is enforced at database level
 * 4. Empty ledger state (Genesis) is handled correctly
 * 
 * CORRECTNESS > THROUGHPUT
 */

import type { Pool, PoolClient } from 'pg';
import { createHash } from 'crypto';
import type { LedgerInput } from '../types.js';
import { stableStringify } from '../lib/canonical.js';
import { getDefaultSigner } from '../lib/signer.js';
import { computeAssetStateHash, computeEvidenceSetHash } from '../lib/canonical.js';

 function getOptionalStringField(
   payload: Record<string, unknown>,
   key: string
 ): string | null {
   const v = payload[key];
   return typeof v === 'string' && v.length > 0 ? v : null;
 }

/**
 * Advisory Lock Key for Canonical Chain
 * 
 * Uses two 32-bit integers to avoid bigint parsing issues.
 * Derived from: "PRVN" (0x5052564e) + "LEDG" (0x4c454447)
 * 
 * This lock serializes ALL canonical writes to ensure hash chain integrity.
 */
const LEDGER_LOCK_KEY_1 = 0x5052564e; // "PRVN"
const LEDGER_LOCK_KEY_2 = 0x4c454447; // "LEDG"

/**
 * Deterministic hash function for ledger entries.
 * 
 * CRITICAL: Order of fields MUST be stable across all implementations.
 * Uses JSON.stringify with explicit field ordering to ensure determinism.
 * 
 * @param payloadHash - SHA-256 hash of the event payload
 * @param previousHash - Hash of the previous entry (null for Genesis)
 * @param sequenceNumber - Monotonic sequence number
 * @param eventId - Unique event identifier (UUID)
 * @returns SHA-256 hash (hex string)
 */
function hashEntry(
  payloadHash: string,
  previousHash: string | null,
  sequenceNumber: number,
  eventId: string
): string {
  // Deterministic serialization - field order matters
  const material = JSON.stringify({
    previous_hash: previousHash,
    payload_hash: payloadHash,
    sequence_number: sequenceNumber,
    event_id: eventId,
  });
  
  return createHash('sha256').update(material).digest('hex');
}

/**
 * Hash event payload with deterministic key ordering.
 * 
 * @param payload - Event payload object
 * @returns SHA-256 hash (hex string)
 */
export function hashPayload(payload: unknown): string {
  // Sort keys for deterministic serialization
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Structured log entry for canonical ingestion.
 */
interface CanonicalIngestLog {
  level: 'info' | 'error';
  msg: string;
  client_id?: string;
  event_id: string;
  sequence_number?: number;
  previous_hash?: string | null;
  attempted_hash?: string;
  error?: string;
  at: string;
}

/**
 * Log structured JSON for production observability.
 */
function logStructured(entry: CanonicalIngestLog): void {
  console.log(JSON.stringify(entry));
}

/**
 * Result of canonical event ingestion.
 */
export interface IngestResult {
  ok: boolean;
  deduped: boolean;
  sequence_number: number;
  entry_hash: string;
  committed_at?: string;
}

/**
 * Ingest a canonical event with cryptographic integrity guarantees.
 * 
 * CONCURRENCY SAFETY:
 * - Uses pg_advisory_xact_lock to serialize writes
 * - Lock is automatically released on COMMIT or ROLLBACK
 * - Safe for empty ledger (Genesis block)
 * - Idempotent (duplicate event_id returns existing entry)
 * 
 * TRANSACTION FLOW:
 * 1. BEGIN transaction
 * 2. Acquire advisory lock (blocks concurrent writers)
 * 3. Check idempotency (fast-path for duplicates)
 * 4. Read latest entry (safe - lock held)
 * 5. Calculate hash (deterministic)
 * 6. Insert new entry
 * 7. COMMIT (releases lock)
 * 
 * @param pool - PostgreSQL connection pool
 * @param input - Canonical event input
 * @returns Ingestion result with sequence number and hash
 * @throws Error if ingestion fails (transaction rolled back)
 */
export async function ingestCanonicalEvent(
  pool: Pool,
  input: LedgerInput
): Promise<IngestResult> {
  const client: PoolClient = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========================================================================
    // CRITICAL: Acquire transaction-scoped advisory lock
    // ========================================================================
    // This ensures only ONE canonical write executes at a time.
    // Lock is automatically released when transaction ends (COMMIT/ROLLBACK).
    // Works even when ledger is empty (no row to lock).
    await client.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [LEDGER_LOCK_KEY_1, LEDGER_LOCK_KEY_2]
    );
    
    // ========================================================================
    // IDEMPOTENCY CHECK 1: Duplicate event_id (exact same event)
    // ========================================================================
    // If event_id already exists, return existing entry immediately.
    const existingByIdResult = await client.query(
      `SELECT id, sequence_number, entry_hash, created_at
       FROM ledger_entries
       WHERE id = $1
       LIMIT 1`,
      [input.event_id]
    );
    
    if (existingByIdResult.rowCount === 1) {
      const existing = existingByIdResult.rows[0];
      
      logStructured({
        level: 'info',
        msg: 'ledger_canonical_ingest_deduped_by_event_id',
        client_id: input.client_id,
        event_id: input.event_id,
        sequence_number: existing.sequence_number,
        at: new Date().toISOString(),
      });
      
      await client.query('COMMIT');
      
      return {
        ok: true,
        deduped: true,
        sequence_number: existing.sequence_number,
        entry_hash: existing.entry_hash,
        committed_at: existing.created_at,
      };
    }
    
    // ========================================================================
    // IDEMPOTENCY CHECK 2: Duplicate idempotency_key (retry of same logical attempt)
    // ========================================================================
    // Canon v1.1.1: Stable idempotency keys allow retry-safe event submission.
    // If idempotency_key already exists, return existing entry (deduplicated).
    // This is the PRIMARY mechanism for client-side retry safety.
    if (input.idempotency_key) {
      const existingByKeyResult = await client.query(
        `SELECT id, sequence_number, entry_hash, created_at
         FROM ledger_entries
         WHERE idempotency_key = $1
         LIMIT 1`,
        [input.idempotency_key]
      );
      
      if (existingByKeyResult.rowCount === 1) {
        const existing = existingByKeyResult.rows[0];
        
        logStructured({
          level: 'info',
          msg: 'ledger_canonical_ingest_deduped_by_idempotency_key',
          client_id: input.client_id,
          event_id: input.event_id,
          sequence_number: existing.sequence_number,
          at: new Date().toISOString(),
        });
        
        await client.query('COMMIT');
        
        return {
          ok: true,
          deduped: true,
          sequence_number: existing.sequence_number,
          entry_hash: existing.entry_hash,
          committed_at: existing.created_at,
        };
      }
    }
    
    // ========================================================================
    // READ LATEST ENTRY (safe - advisory lock held)
    // ========================================================================
    // No other writer can modify the chain while we hold the lock.
    const latestResult = await client.query(
      `SELECT sequence_number, entry_hash
       FROM ledger_entries
       ORDER BY sequence_number DESC
       LIMIT 1`
    );
    
    const latest = latestResult.rowCount === 1 ? latestResult.rows[0] : null;
    const previousHash: string | null = latest?.entry_hash ?? null;
    const nextSeq: number = (latest?.sequence_number ?? -1) + 1;
    
    // ========================================================================
    // CALCULATE HASH (deterministic)
    // ========================================================================
    const payloadHash = hashPayload(input.payload);
    const entryHash = hashEntry(payloadHash, previousHash, nextSeq, input.event_id);

    // ========================================================================
    // PHASE 0: Extract snapshot hashes / ruleset / signing key (when present)
    // ========================================================================
    // IMPORTANT: We do NOT change the canonical envelope schema here.
    // Producers may include these fields inside payload for verification events.
    // Ledger persists them into dedicated columns for queryability.
    const rulesetVersionFromPayload = getOptionalStringField(input.payload, 'ruleset_version');
    const rulesetVersion = rulesetVersionFromPayload ?? 'v1.0.0';

    const assetStateHashFromPayload = getOptionalStringField(input.payload, 'asset_state_hash');
    const evidenceSetHashFromPayload = getOptionalStringField(input.payload, 'evidence_set_hash');

    const evidenceHashes = (input.payload as { evidence_hashes?: unknown }).evidence_hashes;
    const claimJson = (input.payload as { claim_json?: unknown }).claim_json;

    const evidenceSetHash =
      evidenceSetHashFromPayload ??
      (Array.isArray(evidenceHashes) && evidenceHashes.every((h) => typeof h === 'string')
        ? computeEvidenceSetHash(evidenceHashes as string[])
        : null);

    const assetStateHash =
      assetStateHashFromPayload ??
      (claimJson !== undefined && evidenceSetHash !== null
        ? computeAssetStateHash({
            claim_json: claimJson,
            evidence_hashes: Array.isArray(evidenceHashes) ? (evidenceHashes as string[]) : [],
            ruleset_version: rulesetVersion,
          })
        : null);

    const verificationTier = getOptionalStringField(input.payload, 'verification_tier');
    const signatureKeyIdFromPayload = getOptionalStringField(input.payload, 'signature_key_id');

    // ========================================================================
    // PHASE 0: Sign canonical payload (KMS-compatible abstraction)
    // ========================================================================
    // We sign the canonical JSON bytes of the payload to prevent silent mutation.
    // This is launch-safe and uses an ephemeral DevSigner by default.
    const signer = getDefaultSigner();
    const payloadCanonical = stableStringify(input.payload);
    const providerSig = await signer.sign(Buffer.from(payloadCanonical, 'utf8'));
    const signatureKeyId = signatureKeyIdFromPayload ?? signer.keyId();

    const signatures = {
      ...(input.signatures ?? {}),
      provider_sig: (input.signatures as { provider_sig?: string } | undefined)?.provider_sig ?? providerSig,
    };
    
    // ========================================================================
    // INSERT NEW ENTRY (race-safe with ON CONFLICT)
    // ========================================================================
    // Uses ON CONFLICT DO NOTHING to handle race conditions where two requests
    // with the same idempotency_key pass the pre-check simultaneously.
    // If conflict occurs, we fetch the existing row.
    const insertResult = await client.query(
      `INSERT INTO ledger_entries
         (id, source, event_type, correlation_id, asset_id, anchor_id, actor_id,
          payload, payload_hash, previous_hash, entry_hash, created_at,
          schema_version, producer_version, occurred_at, signatures, subject,
          idempotency_key, canonical_hash_hex,
          ruleset_version, asset_state_hash, evidence_set_hash, signature_key_id,
          verification_tier)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       ON CONFLICT (source, idempotency_key) WHERE idempotency_key IS NOT NULL
       DO NOTHING
       RETURNING sequence_number, entry_hash, created_at`,
      [
        input.event_id,
        input.producer,
        input.event_type,
        input.correlation_id || null,
        input.subject.asset_id,
        input.subject.anchor_id || null,
        null, // actor_id not in canonical schema
        input.payload,
        payloadHash,
        previousHash,
        entryHash,
        input.schema_version,
        input.producer_version || null,
        input.occurred_at || null,
        signatures || null,
        input.subject,
        input.idempotency_key || null,
        input.canonical_hash_hex || null,
        rulesetVersion,
        assetStateHash,
        evidenceSetHash,
        signatureKeyId,
        verificationTier,
      ]
    );
    
    // If INSERT returned nothing, a concurrent request won the race
    // Fetch the existing row (race-safe dedupe)
    if (insertResult.rowCount === 0 && input.idempotency_key) {
      const existingResult = await client.query(
        `SELECT id, sequence_number, entry_hash, created_at
         FROM ledger_entries
         WHERE source = $1 AND idempotency_key = $2
         LIMIT 1`,
        [input.producer, input.idempotency_key]
      );
      
      if (existingResult.rowCount === 1) {
        const existing = existingResult.rows[0];
        
        logStructured({
          level: 'info',
          msg: 'ledger_canonical_ingest_deduped_by_conflict',
          client_id: input.client_id,
          event_id: input.event_id,
          sequence_number: existing.sequence_number,
          at: new Date().toISOString(),
        });
        
        await client.query('COMMIT');
        
        return {
          ok: true,
          deduped: true,
          sequence_number: existing.sequence_number,
          entry_hash: existing.entry_hash,
          committed_at: existing.created_at,
        };
      }
    }
    
    const inserted = insertResult.rows[0];
    
    // ========================================================================
    // STRUCTURED LOGGING (production observability)
    // ========================================================================
    logStructured({
      level: 'info',
      msg: 'ledger_canonical_ingest_success',
      client_id: input.client_id,
      event_id: input.event_id,
      sequence_number: inserted.sequence_number,
      previous_hash: previousHash,
      attempted_hash: entryHash,
      at: new Date().toISOString(),
    });
    
    await client.query('COMMIT');
    
    return {
      ok: true,
      deduped: false,
      sequence_number: inserted.sequence_number,
      entry_hash: inserted.entry_hash,
      committed_at: inserted.created_at,
    };
    
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    
    const error = err as Error;
    
    logStructured({
      level: 'error',
      msg: 'ledger_canonical_ingest_failed',
      client_id: input.client_id,
      event_id: input.event_id,
      error: error?.message ?? String(err),
      at: new Date().toISOString(),
    });
    
    throw err;
    
  } finally {
    client.release();
  }
}
