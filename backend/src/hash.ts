import { createHash } from 'crypto';

/**
 * Hash utilities for immutable ledger entries
 * 
 * The Ledger uses SHA-256 hash chaining to ensure immutability:
 * - Each entry's payload is hashed
 * - Each entry includes the previous entry's hash
 * - The entry_hash combines payload_hash + previous_hash + metadata
 */

export function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export function hashEntry(
  payloadHash: string,
  previousHash: string | null,
  source: string,
  eventType: string,
  timestamp: string
): string {
  const data = `${payloadHash}|${previousHash || 'GENESIS'}|${source}|${eventType}|${timestamp}`;
  return createHash('sha256').update(data).digest('hex');
}

export function verifyPayloadHash(payload: unknown, expectedHash: string): boolean {
  const actualHash = hashPayload(payload);
  return actualHash === expectedHash;
}

export function verifyEntryHash(
  entry: {
    payload_hash: string;
    previous_hash: string | null;
    source: string;
    event_type: string;
    created_at: string;
    entry_hash: string;
  }
): boolean {
  const expectedHash = hashEntry(
    entry.payload_hash,
    entry.previous_hash,
    entry.source,
    entry.event_type,
    entry.created_at
  );
  return expectedHash === entry.entry_hash;
}

/**
 * Verify chain integrity between two entries
 */
export function verifyChainLink(
  currentEntry: { previous_hash: string | null },
  previousEntry: { entry_hash: string } | null
): boolean {
  if (previousEntry === null) {
    // First entry should have null previous_hash
    return currentEntry.previous_hash === null;
  }
  return currentEntry.previous_hash === previousEntry.entry_hash;
}
