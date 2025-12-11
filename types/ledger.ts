/**
 * Ledger Domain Types for Proveniq Ledger
 * 
 * Based on: lead_architect_phase_2_domain_model_v1
 * Phase: 2 - Core Infrastructure & "Visual Truth" Engine
 */

// =============================================================================
// CORE EVENT TYPES
// =============================================================================

export type LedgerEventType = 
  | 'CLAIM_CREATED'
  | 'CLAIM_UPDATED'
  | 'CLAIM_VERIFIED'
  | 'CLAIM_FLAGGED'
  | 'CLAIM_CLOSED'
  | 'DOCUMENT_ATTACHED'
  | 'DOCUMENT_VERIFIED'
  | 'PROOF_GENERATED'
  | 'RISK_ASSESSED'
  | 'HUMAN_OVERRIDE'
  | 'DATA_ERASURE';

export type DataRegion = 'us-east1' | 'eu-west1' | 'ap-southeast1';

export type ClaimType = 'AUTO' | 'PROPERTY' | 'HEALTH' | 'LIABILITY' | 'WORKERS_COMP';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD';

export type DocumentType = 
  | 'PHOTO_DAMAGE'
  | 'PHOTO_RECEIPT'
  | 'PDF_ESTIMATE'
  | 'PDF_MEDICAL'
  | 'PDF_POLICE_REPORT'
  | 'FORM_CLAIM'
  | 'OTHER';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type RiskRecommendation = 'APPROVE' | 'REVIEW' | 'INVESTIGATE' | 'DENY';

// =============================================================================
// LEDGER EVENT
// =============================================================================

/**
 * Core Ledger Event - The atomic unit of truth
 * This structure is immutable once written
 */
export interface LedgerEvent<T extends EventPayload = EventPayload> {
  // Identity
  id: string;
  eventType: LedgerEventType;
  
  // Chain linkage
  sequence: bigint;
  previousHash: string;
  hash: string;
  
  // Payload
  payload: T;
  payloadHash: string;
  
  // Metadata
  timestamp: string;
  partnerId: string;
  actorId: string;
  
  // Cryptographic
  signature: string;
  publicKeyId: string;
  
  // Compliance
  dataResidency: DataRegion;
  retentionPolicy: string;
}

// =============================================================================
// EVENT PAYLOADS
// =============================================================================

export type EventPayload = 
  | ClaimCreatedPayload
  | ClaimUpdatedPayload
  | ClaimVerifiedPayload
  | ClaimFlaggedPayload
  | ClaimClosedPayload
  | DocumentAttachedPayload
  | DocumentVerifiedPayload
  | RiskAssessedPayload
  | HumanOverridePayload
  | DataErasurePayload;

export interface ClaimCreatedPayload {
  eventType: 'CLAIM_CREATED';
  claimId: string;
  partnerClaimId: string;
  claimType: ClaimType;
  policyNumber: string;
  claimantIdHash: string;
  claimAmount: number;
  currency: Currency;
  incidentDate: string;
  submittedAt: string;
  metadata: Record<string, string>;
}

export interface ClaimUpdatedPayload {
  eventType: 'CLAIM_UPDATED';
  claimId: string;
  updates: Record<string, unknown>;
  reason: string;
}

export interface ClaimVerifiedPayload {
  eventType: 'CLAIM_VERIFIED';
  claimId: string;
  verificationId: string;
  verificationMethod: string;
  result: 'VERIFIED' | 'FAILED' | 'INCONCLUSIVE';
  details: Record<string, unknown>;
}

export interface ClaimFlaggedPayload {
  eventType: 'CLAIM_FLAGGED';
  claimId: string;
  flagType: 'FRAUD_SUSPECTED' | 'REVIEW_REQUIRED' | 'ANOMALY_DETECTED';
  flagReason: string;
  severity: RiskLevel;
  assessmentId?: string;
}

export interface ClaimClosedPayload {
  eventType: 'CLAIM_CLOSED';
  claimId: string;
  closureType: 'PAID' | 'DENIED' | 'WITHDRAWN' | 'EXPIRED';
  closureReason: string;
  finalAmount?: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface DocumentAttachedPayload {
  eventType: 'DOCUMENT_ATTACHED';
  claimId: string;
  documentId: string;
  documentType: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  storageRef: string;
  capturedAt?: string;
  captureLocation?: GeoPoint;
  metadata: Record<string, string>;
}

export interface DocumentVerifiedPayload {
  eventType: 'DOCUMENT_VERIFIED';
  claimId: string;
  documentId: string;
  verificationMethod: 'HASH_MATCH' | 'AI_ANALYSIS' | 'MANUAL_REVIEW';
  isAuthentic: boolean;
  confidenceScore: number;
  findings: string[];
}

export interface RiskFactor {
  name: string;
  contribution: number;
  description: string;
  category: 'TIMING' | 'AMOUNT' | 'PATTERN' | 'DOCUMENT' | 'HISTORY';
}

export interface RiskAssessedPayload {
  eventType: 'RISK_ASSESSED';
  claimId: string;
  assessmentId: string;
  modelVersion: string;
  fraudScore: number;
  riskLevel: RiskLevel;
  confidenceScore: number;
  factors: RiskFactor[];
  recommendation: RiskRecommendation;
  humanReviewRequired: boolean;
  inputFeatureHashes: string[];
}

export interface HumanOverridePayload {
  eventType: 'HUMAN_OVERRIDE';
  claimId: string;
  originalAssessmentId: string;
  originalDecision: {
    recommendation: string;
    fraudScore: number;
  };
  humanDecision: {
    decision: string;
    justification: string;
    reviewerId: string;
    reviewerRole: string;
  };
  feedbackCategory: 'FALSE_POSITIVE' | 'FALSE_NEGATIVE' | 'CORRECT' | 'UNCERTAIN';
}

export interface DataErasurePayload {
  eventType: 'DATA_ERASURE';
  requestId: string;
  dataSubjectIdHash: string;
  erasureScope: {
    claimIds: string[];
    documentIds: string[];
    eventIds: string[];
  };
  erasureMethod: 'CRYPTOGRAPHIC_KEY_DESTRUCTION';
  destroyedKeyIds: string[];
  regulatoryBasis: 'GDPR_ART17' | 'CCPA_DELETE' | 'RETENTION_EXPIRED';
  requestedAt: string;
  completedAt: string;
  preservedHashes: boolean;
}

// =============================================================================
// PROOF TYPES
// =============================================================================

export type ProofType = 
  | 'EVENT_EXISTENCE'
  | 'CLAIM_HISTORY'
  | 'DOCUMENT_AUTHENTICITY'
  | 'RANGE_INTEGRITY';

export interface MerklePathNode {
  hash: string;
  position: 'LEFT' | 'RIGHT';
  level: number;
}

export interface VerificationProof {
  proofId: string;
  proofType: ProofType;
  generatedAt: string;
  
  subject: {
    type: 'EVENT' | 'CLAIM' | 'DOCUMENT' | 'RANGE';
    id: string;
    hash: string;
  };
  
  merkleProof: {
    root: string;
    rootTimestamp: string;
    path: MerklePathNode[];
  };
  
  chainContext: {
    firstEventSequence: bigint;
    lastEventSequence: bigint;
    chainLength: number;
  };
  
  signature: string;
  signerKeyId: string;
  verificationEndpoint: string;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface CreateEventRequest {
  eventType: LedgerEventType;
  payload: Omit<EventPayload, 'eventType'>;
  dataResidency?: DataRegion;
}

export interface EventResponse {
  id: string;
  eventType: LedgerEventType;
  sequence: string; // BigInt serialized as string
  hash: string;
  timestamp: string;
  partnerId: string;
}

export interface EventListResponse {
  events: EventResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface VerifyProofRequest {
  proof: VerificationProof;
  expectedHash?: string;
}

export interface VerifyProofResponse {
  valid: boolean;
  verifiedAt: string;
  details: {
    hashMatch: boolean;
    merklePathValid: boolean;
    signatureValid: boolean;
    chainIntegrityValid: boolean;
  };
  errors?: string[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface Partner {
  id: string;
  name: string;
  type: 'CARRIER' | 'TPA' | 'SOFTWARE_VENDOR' | 'OTHER';
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  dataResidency: DataRegion;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  partnerId: string;
  keyPrefix: string; // Only first 8 chars stored
  keyHash: string;
  name: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

// =============================================================================
// HASH COMPUTATION
// =============================================================================

/**
 * Fields used to compute event hash (in order)
 */
export interface HashInput {
  sequence: bigint;
  previousHash: string;
  eventType: LedgerEventType;
  payloadHash: string;
  timestamp: string;
  partnerId: string;
}

/**
 * Compute the hash of an event
 * hash = SHA256(sequence + previousHash + eventType + payloadHash + timestamp + partnerId)
 */
export function computeEventHashInput(event: Omit<LedgerEvent, 'hash' | 'signature'>): string {
  return [
    event.sequence.toString(),
    event.previousHash,
    event.eventType,
    event.payloadHash,
    event.timestamp,
    event.partnerId,
  ].join('|');
}
