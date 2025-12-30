/**
 * PROVENIQ Memory (Ledger) - Integrity Verification Script
 * 
 * PURPOSE: Verify cryptographic hash chain integrity from Genesis to Head
 * 
 * USAGE:
 *   npm run verify                    # Verify entire chain
 *   npm run verify -- --last 1000     # Verify last 1000 entries
 *   npm run verify -- --sample 100    # Sample verification (random 100 entries)
 * 
 * EXIT CODES:
 *   0 - Chain is valid
 *   1 - Chain is invalid (integrity violation detected)
 *   2 - Error during verification
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

interface LedgerEntry {
  id: string;
  sequence_number: number;
  source: string;
  event_type: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  previous_hash: string | null;
  entry_hash: string;
  created_at: string;
}

interface VerificationError {
  sequence_number: number;
  error_type: 'payload_hash_mismatch' | 'entry_hash_mismatch' | 'chain_break' | 'sequence_gap';
  expected: string;
  actual: string;
  details: string;
}

/**
 * Hash payload with deterministic key ordering.
 */
function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Calculate entry hash.
 */
function hashEntry(
  payloadHash: string,
  previousHash: string | null,
  source: string,
  eventType: string,
  timestamp: string
): string {
  const data = `${payloadHash}|${previousHash || 'GENESIS'}|${source}|${eventType}|${timestamp}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Verify a single entry's integrity.
 */
function verifyEntry(entry: LedgerEntry, previousEntry: LedgerEntry | null): VerificationError[] {
  const errors: VerificationError[] = [];
  
  // 1. Verify payload hash
  const expectedPayloadHash = hashPayload(entry.payload);
  if (expectedPayloadHash !== entry.payload_hash) {
    errors.push({
      sequence_number: entry.sequence_number,
      error_type: 'payload_hash_mismatch',
      expected: expectedPayloadHash,
      actual: entry.payload_hash,
      details: `Payload hash mismatch at sequence ${entry.sequence_number}`,
    });
  }
  
  // 2. Verify entry hash
  const expectedEntryHash = hashEntry(
    entry.payload_hash,
    entry.previous_hash,
    entry.source,
    entry.event_type,
    entry.created_at
  );
  if (expectedEntryHash !== entry.entry_hash) {
    errors.push({
      sequence_number: entry.sequence_number,
      error_type: 'entry_hash_mismatch',
      expected: expectedEntryHash,
      actual: entry.entry_hash,
      details: `Entry hash mismatch at sequence ${entry.sequence_number}`,
    });
  }
  
  // 3. Verify chain link
  if (previousEntry === null) {
    // Genesis block - previous_hash should be null
    if (entry.previous_hash !== null) {
      errors.push({
        sequence_number: entry.sequence_number,
        error_type: 'chain_break',
        expected: 'null',
        actual: entry.previous_hash || 'null',
        details: `Genesis block (seq ${entry.sequence_number}) should have null previous_hash`,
      });
    }
  } else {
    // Non-genesis - previous_hash should match previous entry's entry_hash
    if (entry.previous_hash !== previousEntry.entry_hash) {
      errors.push({
        sequence_number: entry.sequence_number,
        error_type: 'chain_break',
        expected: previousEntry.entry_hash,
        actual: entry.previous_hash || 'null',
        details: `Chain break at sequence ${entry.sequence_number}: previous_hash does not match previous entry's entry_hash`,
      });
    }
    
    // Verify sequence continuity
    if (entry.sequence_number !== previousEntry.sequence_number + 1) {
      errors.push({
        sequence_number: entry.sequence_number,
        error_type: 'sequence_gap',
        expected: String(previousEntry.sequence_number + 1),
        actual: String(entry.sequence_number),
        details: `Sequence gap detected: expected ${previousEntry.sequence_number + 1}, got ${entry.sequence_number}`,
      });
    }
  }
  
  return errors;
}

/**
 * Verify entire chain or a subset.
 */
async function verifyChain(options: {
  last?: number;
  sample?: number;
}): Promise<void> {
  const startTime = Date.now();
  const errors: VerificationError[] = [];
  
  console.log('🔍 PROVENIQ Memory - Integrity Verification');
  console.log('═'.repeat(60));
  
  // Determine verification strategy
  let query: string;
  let params: unknown[] = [];
  
  if (options.last) {
    console.log(`📊 Strategy: Verify last ${options.last} entries`);
    query = `
      SELECT id, sequence_number, source, event_type, payload, payload_hash, previous_hash, entry_hash, created_at
      FROM ledger_entries
      ORDER BY sequence_number DESC
      LIMIT $1
    `;
    params = [options.last];
  } else if (options.sample) {
    console.log(`📊 Strategy: Random sample of ${options.sample} entries`);
    query = `
      SELECT id, sequence_number, source, event_type, payload, payload_hash, previous_hash, entry_hash, created_at
      FROM ledger_entries
      ORDER BY RANDOM()
      LIMIT $1
    `;
    params = [options.sample];
  } else {
    console.log('📊 Strategy: Full chain verification (Genesis → Head)');
    query = `
      SELECT id, sequence_number, source, event_type, payload, payload_hash, previous_hash, entry_hash, created_at
      FROM ledger_entries
      ORDER BY sequence_number ASC
    `;
  }
  
  // Fetch entries
  const result = await pool.query<LedgerEntry>(query, params);
  const entries = result.rows;
  
  if (entries.length === 0) {
    console.log('⚠️  Ledger is empty (no entries to verify)');
    console.log('═'.repeat(60));
    return;
  }
  
  // Sort by sequence if we did random sampling
  if (options.sample) {
    entries.sort((a, b) => a.sequence_number - b.sequence_number);
  }
  
  // If verifying last N, reverse to get ascending order
  if (options.last) {
    entries.reverse();
  }
  
  console.log(`📦 Entries to verify: ${entries.length}`);
  console.log(`📍 Range: seq ${entries[0].sequence_number} → ${entries[entries.length - 1].sequence_number}`);
  console.log('');
  
  // Verify each entry
  let previousEntry: LedgerEntry | null = null;
  let verifiedCount = 0;
  
  for (const entry of entries) {
    const entryErrors = verifyEntry(entry, previousEntry);
    
    if (entryErrors.length > 0) {
      errors.push(...entryErrors);
      console.log(`❌ seq ${entry.sequence_number}: ${entryErrors.length} error(s)`);
      for (const err of entryErrors) {
        console.log(`   └─ ${err.error_type}: ${err.details}`);
      }
    } else {
      verifiedCount++;
      if (verifiedCount % 100 === 0) {
        process.stdout.write(`✓ ${verifiedCount} verified...\r`);
      }
    }
    
    previousEntry = entry;
  }
  
  const duration = Date.now() - startTime;
  
  console.log('');
  console.log('═'.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Entries verified: ${verifiedCount}/${entries.length}`);
  console.log(`Errors found: ${errors.length}`);
  console.log(`Duration: ${duration}ms`);
  console.log('');
  
  if (errors.length === 0) {
    console.log('✅ CHAIN INTEGRITY VERIFIED');
    console.log('   All entries are cryptographically valid.');
    console.log('   Hash chain is continuous and unbroken.');
    process.exit(0);
  } else {
    console.log('❌ CHAIN INTEGRITY VIOLATION DETECTED');
    console.log('');
    console.log('Error breakdown:');
    const errorTypes = errors.reduce((acc, err) => {
      acc[err.error_type] = (acc[err.error_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(errorTypes)) {
      console.log(`   ${type}: ${count}`);
    }
    
    console.log('');
    console.log('⚠️  THE LEDGER CANNOT BE TRUSTED IN THIS STATE');
    console.log('   Do not deploy or accept new writes until integrity is restored.');
    process.exit(1);
  }
}

/**
 * Parse command-line arguments.
 */
function parseArgs(): { last?: number; sample?: number } {
  const args = process.argv.slice(2);
  const options: { last?: number; sample?: number } = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--last' && args[i + 1]) {
      options.last = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--sample' && args[i + 1]) {
      options.sample = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  return options;
}

/**
 * Main entry point.
 */
async function main() {
  try {
    const options = parseArgs();
    await verifyChain(options);
  } catch (err) {
    console.error('❌ Verification failed with error:');
    console.error(err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();
