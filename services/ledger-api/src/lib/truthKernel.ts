/**
 * Truth Kernel - Core cryptographic and validation logic for Proveniq Ledger
 * 
 * The Truth Kernel is the single source of truth. All writes go through it.
 * All proofs derive from it. It cannot be modified, only appended.
 * 
 * Phase 2: Core Infrastructure & "Visual Truth" Engine
 */

import { createHash, createSign, createVerify, randomUUID } from 'crypto';
import type {
  LedgerEvent,
  EventPayload,
  LedgerEventType,
  DataRegion,
  VerificationProof,
  MerklePathNode,
} from '../../../../types/ledger';

// =============================================================================
// CONSTANTS
// =============================================================================

const HASH_ALGORITHM = 'sha256';
const SIGNATURE_ALGORITHM = 'Ed25519';
const GENESIS_HASH = '0'.repeat(64); // Genesis block previous hash

// =============================================================================
// HASH FUNCTIONS
// =============================================================================

/**
 * Compute SHA-256 hash of a string
 */
export function computeHash(data: string): string {
  return createHash(HASH_ALGORITHM).update(data).digest('hex');
}

/**
 * Compute hash of event payload
 */
export function computePayloadHash(payload: EventPayload): string {
  const canonicalPayload = JSON.stringify(payload, Object.keys(payload).sort());
  return computeHash(canonicalPayload);
}

/**
 * Compute hash of a ledger event (for chain linkage)
 */
export function computeEventHash(event: {
  sequence: bigint;
  previousHash: string;
  eventType: LedgerEventType;
  payloadHash: string;
  timestamp: string;
  partnerId: string;
}): string {
  const hashInput = [
    event.sequence.toString(),
    event.previousHash,
    event.eventType,
    event.payloadHash,
    event.timestamp,
    event.partnerId,
  ].join('|');
  
  return computeHash(hashInput);
}

// =============================================================================
// SIGNATURE FUNCTIONS
// =============================================================================

/**
 * Sign data with private key
 */
export function signData(data: string, privateKey: string): string {
  const sign = createSign(SIGNATURE_ALGORITHM);
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'hex');
}

/**
 * Verify signature with public key
 */
export function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const verify = createVerify(SIGNATURE_ALGORITHM);
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
  } catch {
    return false;
  }
}

// =============================================================================
// EVENT CREATION
// =============================================================================

export interface CreateEventParams {
  eventType: LedgerEventType;
  payload: EventPayload;
  partnerId: string;
  actorId: string;
  dataResidency: DataRegion;
  retentionPolicy: string;
  previousEvent: { sequence: bigint; hash: string } | null;
  privateKey: string;
  publicKeyId: string;
}

/**
 * Create a new ledger event with proper hash chain linkage
 */
export function createLedgerEvent(params: CreateEventParams): LedgerEvent {
  const {
    eventType,
    payload,
    partnerId,
    actorId,
    dataResidency,
    retentionPolicy,
    previousEvent,
    privateKey,
    publicKeyId,
  } = params;

  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const sequence = previousEvent ? previousEvent.sequence + 1n : 1n;
  const previousHash = previousEvent ? previousEvent.hash : GENESIS_HASH;
  
  // Compute payload hash
  const payloadHash = computePayloadHash(payload);
  
  // Compute event hash
  const hash = computeEventHash({
    sequence,
    previousHash,
    eventType,
    payloadHash,
    timestamp,
    partnerId,
  });
  
  // Sign the hash
  const signature = signData(hash, privateKey);
  
  return {
    id,
    eventType,
    sequence,
    previousHash,
    hash,
    payload,
    payloadHash,
    timestamp,
    partnerId,
    actorId,
    signature,
    publicKeyId,
    dataResidency,
    retentionPolicy,
  };
}

// =============================================================================
// CHAIN VALIDATION
// =============================================================================

/**
 * Validate that an event's hash is correctly computed
 */
export function validateEventHash(event: LedgerEvent): boolean {
  const expectedHash = computeEventHash({
    sequence: event.sequence,
    previousHash: event.previousHash,
    eventType: event.eventType,
    payloadHash: event.payloadHash,
    timestamp: event.timestamp,
    partnerId: event.partnerId,
  });
  
  return event.hash === expectedHash;
}

/**
 * Validate that an event's payload hash is correct
 */
export function validatePayloadHash(event: LedgerEvent): boolean {
  const expectedHash = computePayloadHash(event.payload);
  return event.payloadHash === expectedHash;
}

/**
 * Validate event signature
 */
export function validateEventSignature(
  event: LedgerEvent,
  publicKey: string
): boolean {
  return verifySignature(event.hash, event.signature, publicKey);
}

/**
 * Validate chain linkage between two consecutive events
 */
export function validateChainLink(
  currentEvent: LedgerEvent,
  previousEvent: LedgerEvent
): boolean {
  return (
    currentEvent.previousHash === previousEvent.hash &&
    currentEvent.sequence === previousEvent.sequence + 1n
  );
}

/**
 * Full validation of an event
 */
export function validateEvent(
  event: LedgerEvent,
  previousEvent: LedgerEvent | null,
  publicKey: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!validateEventHash(event)) {
    errors.push('Event hash mismatch');
  }
  
  if (!validatePayloadHash(event)) {
    errors.push('Payload hash mismatch');
  }
  
  if (!validateEventSignature(event, publicKey)) {
    errors.push('Invalid signature');
  }
  
  if (previousEvent && !validateChainLink(event, previousEvent)) {
    errors.push('Chain linkage broken');
  }
  
  if (!previousEvent && event.previousHash !== GENESIS_HASH) {
    errors.push('First event must reference genesis hash');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// MERKLE TREE
// =============================================================================

/**
 * Build Merkle tree from event hashes
 */
export function buildMerkleTree(hashes: string[]): string[][] {
  if (hashes.length === 0) {
    return [];
  }
  
  const tree: string[][] = [hashes];
  
  while (tree[tree.length - 1].length > 1) {
    const currentLevel = tree[tree.length - 1];
    const nextLevel: string[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left; // Duplicate if odd
      nextLevel.push(computeHash(left + right));
    }
    
    tree.push(nextLevel);
  }
  
  return tree;
}

/**
 * Get Merkle root from tree
 */
export function getMerkleRoot(tree: string[][]): string | null {
  if (tree.length === 0) {
    return null;
  }
  return tree[tree.length - 1][0];
}

/**
 * Generate Merkle proof for an event at given index
 */
export function generateMerkleProof(
  tree: string[][],
  index: number
): MerklePathNode[] {
  const proof: MerklePathNode[] = [];
  let currentIndex = index;
  
  for (let level = 0; level < tree.length - 1; level++) {
    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
    
    if (siblingIndex < tree[level].length) {
      proof.push({
        hash: tree[level][siblingIndex],
        position: isRight ? 'LEFT' : 'RIGHT',
        level,
      });
    }
    
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return proof;
}

/**
 * Verify Merkle proof
 */
export function verifyMerkleProof(
  eventHash: string,
  proof: MerklePathNode[],
  merkleRoot: string
): boolean {
  let currentHash = eventHash;
  
  for (const node of proof) {
    if (node.position === 'LEFT') {
      currentHash = computeHash(node.hash + currentHash);
    } else {
      currentHash = computeHash(currentHash + node.hash);
    }
  }
  
  return currentHash === merkleRoot;
}

// =============================================================================
// PROOF GENERATION
// =============================================================================

/**
 * Generate a verification proof for an event
 */
export function generateVerificationProof(
  event: LedgerEvent,
  merkleTree: string[][],
  eventIndex: number,
  chainContext: {
    firstEventSequence: bigint;
    lastEventSequence: bigint;
    chainLength: number;
  },
  privateKey: string,
  publicKeyId: string
): VerificationProof {
  const merkleRoot = getMerkleRoot(merkleTree);
  const merklePath = generateMerkleProof(merkleTree, eventIndex);
  
  const proof: VerificationProof = {
    proofId: randomUUID(),
    proofType: 'EVENT_EXISTENCE',
    generatedAt: new Date().toISOString(),
    subject: {
      type: 'EVENT',
      id: event.id,
      hash: event.hash,
    },
    merkleProof: {
      root: merkleRoot || '',
      rootTimestamp: new Date().toISOString(),
      path: merklePath,
    },
    chainContext,
    signature: '',
    signerKeyId: publicKeyId,
    verificationEndpoint: '/api/v1/proofs/verify',
  };
  
  // Sign the proof
  const proofData = JSON.stringify({
    proofId: proof.proofId,
    subject: proof.subject,
    merkleRoot: proof.merkleProof.root,
  });
  proof.signature = signData(proofData, privateKey);
  
  return proof;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const TruthKernel = {
  // Hash functions
  computeHash,
  computePayloadHash,
  computeEventHash,
  
  // Signature functions
  signData,
  verifySignature,
  
  // Event functions
  createLedgerEvent,
  validateEvent,
  validateEventHash,
  validatePayloadHash,
  validateEventSignature,
  validateChainLink,
  
  // Merkle functions
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  
  // Proof functions
  generateVerificationProof,
  
  // Constants
  GENESIS_HASH,
};

export default TruthKernel;
