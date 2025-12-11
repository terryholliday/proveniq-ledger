/**
 * Truth Kernel Unit Tests
 * 
 * Phase 2: Core Infrastructure & "Visual Truth" Engine
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import {
  TruthKernel,
  computeHash,
  computePayloadHash,
  computeEventHash,
  createLedgerEvent,
  validateEvent,
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
} from './truthKernel';
import type { ClaimCreatedPayload, LedgerEvent } from '../../../../types/ledger';

// =============================================================================
// TEST SETUP
// =============================================================================

let privateKey: string;
let publicKey: string;
const publicKeyId = 'test-key-001';

beforeAll(() => {
  const keyPair = generateKeyPairSync('ed25519');
  privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  publicKey = keyPair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
});

// =============================================================================
// HASH TESTS
// =============================================================================

describe('Hash Functions', () => {
  it('should compute consistent SHA-256 hash', () => {
    const data = 'test data';
    const hash1 = computeHash(data);
    const hash2 = computeHash(data);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
  });

  it('should compute different hashes for different data', () => {
    const hash1 = computeHash('data1');
    const hash2 = computeHash('data2');
    
    expect(hash1).not.toBe(hash2);
  });

  it('should compute payload hash deterministically', () => {
    const payload: ClaimCreatedPayload = {
      eventType: 'CLAIM_CREATED',
      claimId: 'CLM-001',
      partnerClaimId: 'P-CLM-001',
      claimType: 'AUTO',
      policyNumber: 'POL-12345',
      claimantIdHash: 'abc123',
      claimAmount: 5000,
      currency: 'USD',
      incidentDate: '2024-01-15',
      submittedAt: '2024-01-16T10:00:00Z',
      metadata: {},
    };

    const hash1 = computePayloadHash(payload);
    const hash2 = computePayloadHash(payload);
    
    expect(hash1).toBe(hash2);
  });

  it('should compute event hash from components', () => {
    const hash = computeEventHash({
      sequence: 1n,
      previousHash: TruthKernel.GENESIS_HASH,
      eventType: 'CLAIM_CREATED',
      payloadHash: 'abc123',
      timestamp: '2024-01-01T00:00:00Z',
      partnerId: 'partner-001',
    });

    expect(hash).toHaveLength(64);
  });
});

// =============================================================================
// EVENT CREATION TESTS
// =============================================================================

describe('Event Creation', () => {
  it('should create first event with genesis hash', () => {
    const payload: ClaimCreatedPayload = {
      eventType: 'CLAIM_CREATED',
      claimId: 'CLM-001',
      partnerClaimId: 'P-CLM-001',
      claimType: 'AUTO',
      policyNumber: 'POL-12345',
      claimantIdHash: 'abc123',
      claimAmount: 5000,
      currency: 'USD',
      incidentDate: '2024-01-15',
      submittedAt: '2024-01-16T10:00:00Z',
      metadata: {},
    };

    const event = createLedgerEvent({
      eventType: 'CLAIM_CREATED',
      payload,
      partnerId: 'partner-001',
      actorId: 'user-001',
      dataResidency: 'us-east1',
      retentionPolicy: 'standard-7-year',
      previousEvent: null,
      privateKey,
      publicKeyId,
    });

    expect(event.sequence).toBe(1n);
    expect(event.previousHash).toBe(TruthKernel.GENESIS_HASH);
    expect(event.hash).toHaveLength(64);
    expect(event.signature).toBeDefined();
  });

  it('should link events in chain', () => {
    const payload1: ClaimCreatedPayload = {
      eventType: 'CLAIM_CREATED',
      claimId: 'CLM-001',
      partnerClaimId: 'P-CLM-001',
      claimType: 'AUTO',
      policyNumber: 'POL-12345',
      claimantIdHash: 'abc123',
      claimAmount: 5000,
      currency: 'USD',
      incidentDate: '2024-01-15',
      submittedAt: '2024-01-16T10:00:00Z',
      metadata: {},
    };

    const event1 = createLedgerEvent({
      eventType: 'CLAIM_CREATED',
      payload: payload1,
      partnerId: 'partner-001',
      actorId: 'user-001',
      dataResidency: 'us-east1',
      retentionPolicy: 'standard-7-year',
      previousEvent: null,
      privateKey,
      publicKeyId,
    });

    const payload2: ClaimCreatedPayload = {
      eventType: 'CLAIM_CREATED',
      claimId: 'CLM-002',
      partnerClaimId: 'P-CLM-002',
      claimType: 'PROPERTY',
      policyNumber: 'POL-67890',
      claimantIdHash: 'def456',
      claimAmount: 10000,
      currency: 'USD',
      incidentDate: '2024-01-17',
      submittedAt: '2024-01-18T10:00:00Z',
      metadata: {},
    };

    const event2 = createLedgerEvent({
      eventType: 'CLAIM_CREATED',
      payload: payload2,
      partnerId: 'partner-001',
      actorId: 'user-001',
      dataResidency: 'us-east1',
      retentionPolicy: 'standard-7-year',
      previousEvent: { sequence: event1.sequence, hash: event1.hash },
      privateKey,
      publicKeyId,
    });

    expect(event2.sequence).toBe(2n);
    expect(event2.previousHash).toBe(event1.hash);
  });
});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('Event Validation', () => {
  let validEvent: LedgerEvent;

  beforeAll(() => {
    const payload: ClaimCreatedPayload = {
      eventType: 'CLAIM_CREATED',
      claimId: 'CLM-001',
      partnerClaimId: 'P-CLM-001',
      claimType: 'AUTO',
      policyNumber: 'POL-12345',
      claimantIdHash: 'abc123',
      claimAmount: 5000,
      currency: 'USD',
      incidentDate: '2024-01-15',
      submittedAt: '2024-01-16T10:00:00Z',
      metadata: {},
    };

    validEvent = createLedgerEvent({
      eventType: 'CLAIM_CREATED',
      payload,
      partnerId: 'partner-001',
      actorId: 'user-001',
      dataResidency: 'us-east1',
      retentionPolicy: 'standard-7-year',
      previousEvent: null,
      privateKey,
      publicKeyId,
    });
  });

  it('should validate a correct event', () => {
    const result = validateEvent(validEvent, null, publicKey);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect hash tampering', () => {
    const tamperedEvent = { ...validEvent, hash: 'tampered-hash' };
    const result = validateEvent(tamperedEvent, null, publicKey);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Event hash mismatch');
  });

  it('should detect payload tampering', () => {
    const tamperedPayload = {
      ...validEvent.payload,
      claimAmount: 999999,
    } as ClaimCreatedPayload;
    
    const tamperedEvent = { ...validEvent, payload: tamperedPayload };
    const result = validateEvent(tamperedEvent, null, publicKey);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Payload hash mismatch');
  });

  it('should detect signature tampering', () => {
    const tamperedEvent = { ...validEvent, signature: 'invalid-signature' };
    const result = validateEvent(tamperedEvent, null, publicKey);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid signature');
  });
});

// =============================================================================
// MERKLE TREE TESTS
// =============================================================================

describe('Merkle Tree', () => {
  const testHashes = [
    computeHash('event1'),
    computeHash('event2'),
    computeHash('event3'),
    computeHash('event4'),
  ];

  it('should build merkle tree', () => {
    const tree = buildMerkleTree(testHashes);
    
    expect(tree.length).toBe(3); // 4 leaves -> 2 nodes -> 1 root
    expect(tree[0]).toHaveLength(4);
    expect(tree[1]).toHaveLength(2);
    expect(tree[2]).toHaveLength(1);
  });

  it('should get merkle root', () => {
    const tree = buildMerkleTree(testHashes);
    const root = getMerkleRoot(tree);
    
    expect(root).toHaveLength(64);
  });

  it('should generate and verify merkle proof', () => {
    const tree = buildMerkleTree(testHashes);
    const root = getMerkleRoot(tree)!;
    
    // Generate proof for second event (index 1)
    const proof = generateMerkleProof(tree, 1);
    
    // Verify proof
    const isValid = verifyMerkleProof(testHashes[1], proof, root);
    expect(isValid).toBe(true);
  });

  it('should reject invalid merkle proof', () => {
    const tree = buildMerkleTree(testHashes);
    const root = getMerkleRoot(tree)!;
    
    const proof = generateMerkleProof(tree, 1);
    
    // Try to verify with wrong hash
    const isValid = verifyMerkleProof(computeHash('wrong'), proof, root);
    expect(isValid).toBe(false);
  });

  it('should handle odd number of hashes', () => {
    const oddHashes = testHashes.slice(0, 3);
    const tree = buildMerkleTree(oddHashes);
    const root = getMerkleRoot(tree);
    
    expect(root).toHaveLength(64);
    
    // Verify proof for last element
    const proof = generateMerkleProof(tree, 2);
    const isValid = verifyMerkleProof(oddHashes[2], proof, root!);
    expect(isValid).toBe(true);
  });
});

// =============================================================================
// CHAIN INTEGRITY TESTS
// =============================================================================

describe('Chain Integrity', () => {
  it('should maintain chain integrity across multiple events', () => {
    const events: LedgerEvent[] = [];
    
    for (let i = 0; i < 5; i++) {
      const payload: ClaimCreatedPayload = {
        eventType: 'CLAIM_CREATED',
        claimId: `CLM-00${i}`,
        partnerClaimId: `P-CLM-00${i}`,
        claimType: 'AUTO',
        policyNumber: `POL-${i}`,
        claimantIdHash: `hash-${i}`,
        claimAmount: 1000 * (i + 1),
        currency: 'USD',
        incidentDate: '2024-01-15',
        submittedAt: '2024-01-16T10:00:00Z',
        metadata: {},
      };

      const previousEvent = events.length > 0 
        ? { sequence: events[events.length - 1].sequence, hash: events[events.length - 1].hash }
        : null;

      const event = createLedgerEvent({
        eventType: 'CLAIM_CREATED',
        payload,
        partnerId: 'partner-001',
        actorId: 'user-001',
        dataResidency: 'us-east1',
        retentionPolicy: 'standard-7-year',
        previousEvent,
        privateKey,
        publicKeyId,
      });

      events.push(event);
    }

    // Validate entire chain
    for (let i = 0; i < events.length; i++) {
      const previousEvent = i > 0 ? events[i - 1] : null;
      const result = validateEvent(events[i], previousEvent, publicKey);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }

    // Verify chain linkage
    for (let i = 1; i < events.length; i++) {
      expect(events[i].previousHash).toBe(events[i - 1].hash);
      expect(events[i].sequence).toBe(events[i - 1].sequence + 1n);
    }
  });
});
