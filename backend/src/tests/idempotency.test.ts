/**
 * Idempotency Key Deduplication Tests
 * 
 * Canon v1.1.1: Stable idempotency keys allow retry-safe event submission.
 * These tests verify that:
 * 1. Same idempotency_key returns existing entry (deduplicated)
 * 2. Different idempotency_key creates new entry
 * 3. Response includes deduped: true flag when deduplicated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestCanonicalEvent, type IngestResult } from '../ingest/canonical';
import type { LedgerInput } from '../types';

// Mock pool with controllable behavior
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
});

const mockPool = {
  connect: mockConnect,
  query: mockQuery,
} as any;

// Helper to create valid LedgerInput
function createTestInput(overrides: Partial<LedgerInput> = {}): LedgerInput {
  return {
    event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    client_id: 'test-client',
    producer: 'home',
    producer_version: '1.0.0',
    schema_version: '1.0.0',
    event_type: 'EVT_VERIFY_INGEST_STARTED',
    correlation_id: 'corr-123',
    idempotency_key: `idem-${Date.now()}`,
    occurred_at: new Date().toISOString(),
    subject: {
      asset_id: '123e4567-e89b-12d3-a456-426614174000',
      envelope_id: '550e8400-e29b-41d4-a716-446655440000',
    },
    payload: { test: 'data' },
    canonical_hash_hex: 'a'.repeat(64),
    ...overrides,
  };
}

describe('Idempotency Key Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing entry when idempotency_key already exists', async () => {
    const existingEntry = {
      id: 'existing-id',
      sequence_number: 42,
      entry_hash: 'existing-hash-abc123',
      created_at: '2026-01-03T00:00:00.000Z',
    };

    // Mock query responses in order
    mockQuery
      // BEGIN
      .mockResolvedValueOnce({ rows: [] })
      // Advisory lock
      .mockResolvedValueOnce({ rows: [] })
      // Check event_id - not found
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // Check idempotency_key - FOUND (duplicate)
      .mockResolvedValueOnce({ rows: [existingEntry], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [] });

    const input = createTestInput({ idempotency_key: 'duplicate-key' });
    const result = await ingestCanonicalEvent(mockPool, input);

    expect(result.ok).toBe(true);
    expect(result.deduped).toBe(true);
    expect(result.sequence_number).toBe(42);
    expect(result.entry_hash).toBe('existing-hash-abc123');
  });

  it('creates new entry when idempotency_key is unique', async () => {
    const newEntry = {
      sequence_number: 43,
      entry_hash: 'new-hash-xyz789',
      created_at: '2026-01-03T01:00:00.000Z',
    };

    // Mock query responses in order
    mockQuery
      // BEGIN
      .mockResolvedValueOnce({ rows: [] })
      // Advisory lock
      .mockResolvedValueOnce({ rows: [] })
      // Check event_id - not found
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // Check idempotency_key - not found
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // Get latest entry for hash chain
      .mockResolvedValueOnce({ rows: [{ sequence_number: 42, entry_hash: 'prev-hash' }], rowCount: 1 })
      // INSERT
      .mockResolvedValueOnce({ rows: [newEntry], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [] });

    const input = createTestInput({ idempotency_key: 'unique-key' });
    const result = await ingestCanonicalEvent(mockPool, input);

    expect(result.ok).toBe(true);
    expect(result.deduped).toBe(false);
    expect(result.sequence_number).toBe(43);
  });

  it('same event submitted twice returns same entry_id', async () => {
    const stableKey = 'ingest:hw-abc:42';
    const existingEntry = {
      id: 'first-submission-id',
      sequence_number: 100,
      entry_hash: 'first-hash',
      created_at: '2026-01-03T00:00:00.000Z',
    };

    // First submission - creates entry
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // Lock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // event_id check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency_key check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // latest entry (empty ledger)
      .mockResolvedValueOnce({ rows: [existingEntry], rowCount: 1 }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const input1 = createTestInput({ 
      event_id: 'first-event-id',
      idempotency_key: stableKey 
    });
    const result1 = await ingestCanonicalEvent(mockPool, input1);

    expect(result1.ok).toBe(true);
    expect(result1.deduped).toBe(false);

    // Reset mocks for second submission
    mockQuery.mockReset();

    // Second submission (retry) - returns existing entry
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // Lock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // event_id check (different event_id)
      .mockResolvedValueOnce({ rows: [existingEntry], rowCount: 1 }) // idempotency_key check - FOUND
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const input2 = createTestInput({ 
      event_id: 'second-event-id', // Different event_id (new UUIDv4)
      idempotency_key: stableKey   // SAME idempotency_key (retry)
    });
    const result2 = await ingestCanonicalEvent(mockPool, input2);

    expect(result2.ok).toBe(true);
    expect(result2.deduped).toBe(true);
    expect(result2.sequence_number).toBe(result1.sequence_number);
    expect(result2.entry_hash).toBe(result1.entry_hash);
  });

  it('different idempotency_key creates separate entries', async () => {
    // Two different logical attempts should create two entries
    const key1 = 'ingest:hw-abc:42';
    const key2 = 'ingest:hw-abc:43'; // Different counter = different attempt

    // First submission
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // Lock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // event_id check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency_key check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // latest entry
      .mockResolvedValueOnce({ rows: [{ sequence_number: 1, entry_hash: 'hash1', created_at: new Date().toISOString() }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result1 = await ingestCanonicalEvent(mockPool, createTestInput({ idempotency_key: key1 }));
    expect(result1.deduped).toBe(false);

    mockQuery.mockReset();

    // Second submission with different key
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // Lock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // event_id check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency_key check - NOT FOUND (different key)
      .mockResolvedValueOnce({ rows: [{ sequence_number: 1, entry_hash: 'hash1' }], rowCount: 1 }) // latest entry
      .mockResolvedValueOnce({ rows: [{ sequence_number: 2, entry_hash: 'hash2', created_at: new Date().toISOString() }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result2 = await ingestCanonicalEvent(mockPool, createTestInput({ idempotency_key: key2 }));
    expect(result2.deduped).toBe(false);
    expect(result2.sequence_number).not.toBe(result1.sequence_number);
  });

  it('concurrent inserts with same idempotency_key: only one row created, both return OK', async () => {
    // This test simulates the race condition where two requests pass the pre-check
    // simultaneously and both attempt INSERT. The ON CONFLICT clause ensures
    // only one succeeds, and the loser fetches the existing row.
    
    const stableKey = 'race-test:concurrent:1';
    const winnerEntry = {
      id: 'winner-id',
      sequence_number: 200,
      entry_hash: 'winner-hash',
      created_at: '2026-01-03T00:00:00.000Z',
    };

    // Simulate: Both requests pass pre-checks (no existing row found)
    // First request wins the INSERT
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // Lock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // event_id check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency_key check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // latest entry
      .mockResolvedValueOnce({ rows: [winnerEntry], rowCount: 1 }) // INSERT succeeds
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const input1 = createTestInput({ 
      event_id: 'request-1-id',
      idempotency_key: stableKey,
      producer: 'home',
    });
    const result1 = await ingestCanonicalEvent(mockPool, input1);

    expect(result1.ok).toBe(true);
    expect(result1.deduped).toBe(false);
    expect(result1.sequence_number).toBe(200);

    mockQuery.mockReset();

    // Second request: pre-checks pass but INSERT hits ON CONFLICT DO NOTHING
    // (rowCount === 0), so it fetches existing row
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // Lock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // event_id check - different event_id
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency_key check - RACE: not found yet
      .mockResolvedValueOnce({ rows: [{ sequence_number: 199, entry_hash: 'prev' }], rowCount: 1 }) // latest entry
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT hits conflict, returns nothing
      .mockResolvedValueOnce({ rows: [winnerEntry], rowCount: 1 }) // Fallback fetch existing
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const input2 = createTestInput({ 
      event_id: 'request-2-id', // Different event_id
      idempotency_key: stableKey, // SAME idempotency_key
      producer: 'home',
    });
    const result2 = await ingestCanonicalEvent(mockPool, input2);

    // Second request should return OK with deduped: true
    expect(result2.ok).toBe(true);
    expect(result2.deduped).toBe(true);
    expect(result2.sequence_number).toBe(200); // Same as winner
    expect(result2.entry_hash).toBe('winner-hash'); // Same as winner
  });
});
