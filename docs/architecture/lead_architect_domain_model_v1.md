# Proveniq Ledger Domain Model & Event Schema v1.0

**Document ID:** `lead_architect_phase_2_domain_model_v1`  
**Phase:** 2 - Core Infrastructure & "Visual Truth" Engine  
**Status:** APPROVED  
**Classification:** L3_TRADE_SECRET  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This document defines the core domain model, event schema, and proof generation model for Proveniq Ledger. It establishes the "Truth Kernel" - the immutable, cryptographically-linked event store that serves as the verification backbone.

---

## 2. Domain Model Overview

### 2.1 Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAIN MODEL                                 │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Partner   │────►│    Claim    │────►│   Event     │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│        │                   │                   │                │
│        │                   │                   ▼                │
│        │                   │           ┌─────────────┐         │
│        │                   │           │   Proof     │         │
│        │                   │           └─────────────┘         │
│        │                   │                                    │
│        ▼                   ▼                                    │
│  ┌─────────────┐     ┌─────────────┐                           │
│  │   API Key   │     │  Document   │                           │
│  └─────────────┘     └─────────────┘                           │
│                                                                  │
│  BOUNDED CONTEXTS:                                              │
│  • Identity Context (Partner, API Key, User)                   │
│  • Claims Context (Claim, Document, Assessment)                │
│  • Ledger Context (Event, Proof, Hash Chain)                   │
│  • Analytics Context (Metrics, Reports)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Entity Definitions

| Entity | Description | Lifecycle |
|--------|-------------|-----------|
| **Partner** | Insurance carrier or integration partner | Long-lived |
| **Claim** | Insurance claim being verified | Created → Verified → Closed |
| **Event** | Immutable ledger entry | Created (never modified) |
| **Proof** | Cryptographic verification proof | Generated on demand |
| **Document** | Attached file (photo, PDF) | Hashed and stored |
| **API Key** | Partner authentication credential | Created → Active → Revoked |

---

## 3. Truth Kernel Design

### 3.1 Core Principle

> **The Truth Kernel is the single source of truth. All writes go through it. All proofs derive from it. It cannot be modified, only appended.**

### 3.2 Event Structure

```typescript
/**
 * Core Ledger Event - The atomic unit of truth
 */
interface LedgerEvent {
  // === IDENTITY ===
  id: string;                    // UUID v7 (time-ordered)
  eventType: LedgerEventType;    // Discriminator
  
  // === CHAIN LINKAGE ===
  sequence: bigint;              // Monotonic sequence number
  previousHash: string;          // SHA-256 of previous event
  hash: string;                  // SHA-256 of this event
  
  // === PAYLOAD ===
  payload: EventPayload;         // Type-specific data
  payloadHash: string;           // SHA-256 of payload only
  
  // === METADATA ===
  timestamp: string;             // ISO 8601, server-assigned
  partnerId: string;             // Owning partner
  actorId: string;               // User/service that created
  
  // === CRYPTOGRAPHIC ===
  signature: string;             // Ed25519 signature
  publicKeyId: string;           // Key used for signing
  
  // === COMPLIANCE ===
  dataResidency: DataRegion;     // Where data must stay
  retentionPolicy: string;       // Retention rule ID
}

type LedgerEventType = 
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

type DataRegion = 'us-east1' | 'eu-west1' | 'ap-southeast1';
```

### 3.3 Hash Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                     HASH CHAIN STRUCTURE                         │
│                                                                  │
│  Event N-2          Event N-1          Event N                  │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐            │
│  │ hash: A  │──────►│prevHash:A│──────►│prevHash:B│            │
│  │          │       │ hash: B  │       │ hash: C  │            │
│  │ payload  │       │ payload  │       │ payload  │            │
│  └──────────┘       └──────────┘       └──────────┘            │
│                                                                  │
│  HASH COMPUTATION:                                              │
│  hash = SHA256(                                                 │
│    sequence +                                                   │
│    previousHash +                                               │
│    eventType +                                                  │
│    payloadHash +                                                │
│    timestamp +                                                  │
│    partnerId                                                    │
│  )                                                              │
│                                                                  │
│  INTEGRITY: Any modification breaks the chain                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Event Payload Schemas

### 4.1 Claim Created Event

```typescript
interface ClaimCreatedPayload {
  eventType: 'CLAIM_CREATED';
  claimId: string;
  partnerClaimId: string;        // Partner's reference
  claimType: ClaimType;
  policyNumber: string;
  claimantIdHash: string;        // Hashed PII reference
  claimAmount: number;
  currency: Currency;
  incidentDate: string;
  submittedAt: string;
  metadata: Record<string, string>;
}

type ClaimType = 'AUTO' | 'PROPERTY' | 'HEALTH' | 'LIABILITY' | 'WORKERS_COMP';
type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD';
```

### 4.2 Document Attached Event

```typescript
interface DocumentAttachedPayload {
  eventType: 'DOCUMENT_ATTACHED';
  claimId: string;
  documentId: string;
  documentType: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;           // SHA-256 of file content
  storageRef: string;            // GCS path (encrypted)
  capturedAt?: string;           // When photo was taken
  captureLocation?: GeoPoint;    // Where (if available)
  metadata: Record<string, string>;
}

type DocumentType = 
  | 'PHOTO_DAMAGE'
  | 'PHOTO_RECEIPT'
  | 'PDF_ESTIMATE'
  | 'PDF_MEDICAL'
  | 'PDF_POLICE_REPORT'
  | 'FORM_CLAIM'
  | 'OTHER';

interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
}
```

### 4.3 Risk Assessment Event

```typescript
interface RiskAssessedPayload {
  eventType: 'RISK_ASSESSED';
  claimId: string;
  assessmentId: string;
  modelVersion: string;
  
  // Scores
  fraudScore: number;            // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceScore: number;       // 0-1
  
  // Factors (for explainability)
  factors: RiskFactor[];
  
  // Recommendation
  recommendation: 'APPROVE' | 'REVIEW' | 'INVESTIGATE' | 'DENY';
  humanReviewRequired: boolean;
  
  // Audit
  inputFeatureHashes: string[];  // Hashes of input data
}

interface RiskFactor {
  name: string;
  contribution: number;          // -1 to 1
  description: string;
  category: 'TIMING' | 'AMOUNT' | 'PATTERN' | 'DOCUMENT' | 'HISTORY';
}
```

### 4.4 Human Override Event

```typescript
interface HumanOverridePayload {
  eventType: 'HUMAN_OVERRIDE';
  claimId: string;
  originalAssessmentId: string;
  
  // Original AI decision
  originalDecision: {
    recommendation: string;
    fraudScore: number;
  };
  
  // Human decision
  humanDecision: {
    decision: string;
    justification: string;
    reviewerId: string;
    reviewerRole: string;
  };
  
  // For model improvement
  feedbackCategory: 'FALSE_POSITIVE' | 'FALSE_NEGATIVE' | 'CORRECT' | 'UNCERTAIN';
}
```

### 4.5 Data Erasure Event (GDPR)

```typescript
interface DataErasurePayload {
  eventType: 'DATA_ERASURE';
  requestId: string;
  dataSubjectIdHash: string;     // Hashed identifier
  
  // Scope
  erasureScope: {
    claimIds: string[];
    documentIds: string[];
    eventIds: string[];          // Events whose PII is now inaccessible
  };
  
  // Method
  erasureMethod: 'CRYPTOGRAPHIC_KEY_DESTRUCTION';
  destroyedKeyIds: string[];
  
  // Compliance
  regulatoryBasis: 'GDPR_ART17' | 'CCPA_DELETE' | 'RETENTION_EXPIRED';
  requestedAt: string;
  completedAt: string;
  
  // What remains
  preservedHashes: boolean;      // Hashes preserved for chain integrity
}
```

---

## 5. Proof Generation Model

### 5.1 Proof Types

| Proof Type | Use Case | Contents |
|------------|----------|----------|
| **Event Proof** | Prove single event exists | Event + Merkle path |
| **Range Proof** | Prove sequence of events | Events + Merkle root |
| **Claim Proof** | Prove claim history | All claim events + proofs |
| **Document Proof** | Prove document authenticity | Document hash + event proof |

### 5.2 Merkle Tree Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     MERKLE TREE (Daily)                          │
│                                                                  │
│                        ┌────────────┐                           │
│                        │ Merkle Root│                           │
│                        │  (Daily)   │                           │
│                        └─────┬──────┘                           │
│                   ┌──────────┴──────────┐                       │
│              ┌────┴────┐           ┌────┴────┐                  │
│              │  H(AB)  │           │  H(CD)  │                  │
│              └────┬────┘           └────┬────┘                  │
│           ┌──────┴──────┐       ┌──────┴──────┐                 │
│       ┌───┴───┐    ┌───┴───┐┌───┴───┐   ┌───┴───┐              │
│       │ H(A)  │    │ H(B)  ││ H(C)  │   │ H(D)  │              │
│       └───┬───┘    └───┬───┘└───┬───┘   └───┬───┘              │
│           │            │        │           │                   │
│       ┌───┴───┐    ┌───┴───┐┌───┴───┐   ┌───┴───┐              │
│       │Event A│    │Event B││Event C│   │Event D│              │
│       └───────┘    └───────┘└───────┘   └───────┘              │
│                                                                  │
│  PROOF FOR EVENT B:                                             │
│  • Event B hash                                                 │
│  • H(A) (sibling)                                               │
│  • H(CD) (sibling)                                              │
│  • Merkle Root                                                  │
│                                                                  │
│  VERIFICATION: Recompute root from proof path                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Proof Structure

```typescript
interface VerificationProof {
  proofId: string;
  proofType: ProofType;
  generatedAt: string;
  
  // What's being proven
  subject: {
    type: 'EVENT' | 'CLAIM' | 'DOCUMENT' | 'RANGE';
    id: string;
    hash: string;
  };
  
  // Merkle proof
  merkleProof: {
    root: string;
    rootTimestamp: string;
    path: MerklePathNode[];
  };
  
  // Chain context
  chainContext: {
    firstEventSequence: bigint;
    lastEventSequence: bigint;
    chainLength: number;
  };
  
  // Signature
  signature: string;
  signerKeyId: string;
  
  // Verification instructions
  verificationEndpoint: string;
}

interface MerklePathNode {
  hash: string;
  position: 'LEFT' | 'RIGHT';
  level: number;
}

type ProofType = 'EVENT_EXISTENCE' | 'CLAIM_HISTORY' | 'DOCUMENT_AUTHENTICITY' | 'RANGE_INTEGRITY';
```

---

## 6. Service Topology

### 6.1 Service Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE TOPOLOGY                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    API GATEWAY                           │   │
│  │         (Authentication, Rate Limiting, Routing)         │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│       ┌──────────────────────┼──────────────────────┐          │
│       │                      │                      │          │
│       ▼                      ▼                      ▼          │
│  ┌─────────┐           ┌─────────┐           ┌─────────┐      │
│  │ COMMAND │           │  QUERY  │           │  ADMIN  │      │
│  │ SERVICE │           │ SERVICE │           │ SERVICE │      │
│  │         │           │         │           │         │      │
│  │ • Write │           │ • Read  │           │ • Config│      │
│  │ • Verify│           │ • Search│           │ • Keys  │      │
│  │ • Assess│           │ • Export│           │ • Users │      │
│  └────┬────┘           └────┬────┘           └────┬────┘      │
│       │                     │                      │           │
│       │                     │                      │           │
│       ▼                     ▼                      ▼           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    TRUTH KERNEL                          │  │
│  │     (Shared domain logic - hash, sign, validate)         │  │
│  └───────────────────────────┬─────────────────────────────┘  │
│                              │                                  │
│       ┌──────────────────────┼──────────────────────┐          │
│       │                      │                      │          │
│       ▼                      ▼                      ▼          │
│  ┌─────────┐           ┌─────────┐           ┌─────────┐      │
│  │PostgreSQL│          │  Redis  │           │   GCS   │      │
│  │ (Events)│           │ (Cache) │           │ (Docs)  │      │
│  └─────────┘           └─────────┘           └─────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Service Contracts

| Service | Owns | Consumes | Publishes |
|---------|------|----------|-----------|
| **command-service** | Event writes | Truth Kernel | `event.created` |
| **query-service** | Read models | PostgreSQL (replica) | - |
| **proof-service** | Proof generation | Events, Merkle cache | `proof.generated` |
| **risk-service** | AI assessments | Events, Gemini API | `risk.assessed` |
| **admin-service** | Partners, Keys | PostgreSQL | `partner.updated` |

---

## 7. Data Flow Sequences

### 7.1 Claim Submission Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Partner │     │   API   │     │ Command │     │  Truth  │     │   DB    │
│  Client │     │ Gateway │     │ Service │     │ Kernel  │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ POST /claims  │               │               │               │
     │──────────────►│               │               │               │
     │               │ Authenticate  │               │               │
     │               │──────────────►│               │               │
     │               │               │ Validate      │               │
     │               │               │ Payload       │               │
     │               │               │──────────────►│               │
     │               │               │               │ Compute Hash  │
     │               │               │               │ Get PrevHash  │
     │               │               │               │──────────────►│
     │               │               │               │◄──────────────│
     │               │               │               │ Sign Event    │
     │               │               │               │               │
     │               │               │◄──────────────│               │
     │               │               │ Write Event   │               │
     │               │               │───────────────────────────────►│
     │               │               │◄───────────────────────────────│
     │               │               │ Publish to    │               │
     │               │               │ Pub/Sub       │               │
     │               │◄──────────────│               │               │
     │◄──────────────│ 201 Created   │               │               │
     │  {eventId,    │               │               │               │
     │   hash}       │               │               │               │
```

### 7.2 Proof Generation Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Partner │     │  Proof  │     │  Merkle │     │   DB    │
│  Client │     │ Service │     │  Cache  │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ GET /proofs/  │               │               │
     │ {eventId}     │               │               │
     │──────────────►│               │               │
     │               │ Check Cache   │               │
     │               │──────────────►│               │
     │               │◄──────────────│ Miss          │
     │               │               │               │
     │               │ Fetch Event   │               │
     │               │───────────────────────────────►│
     │               │◄───────────────────────────────│
     │               │               │               │
     │               │ Build Merkle  │               │
     │               │ Path          │               │
     │               │───────────────────────────────►│
     │               │◄───────────────────────────────│
     │               │               │               │
     │               │ Cache Proof   │               │
     │               │──────────────►│               │
     │               │               │               │
     │◄──────────────│ Return Proof  │               │
     │  {proof}      │               │               │
```

---

## 8. Database Schema

### 8.1 Core Tables

```sql
-- Events table (append-only)
CREATE TABLE ledger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence BIGSERIAL UNIQUE,
  event_type VARCHAR(50) NOT NULL,
  
  -- Chain linkage
  previous_hash VARCHAR(64) NOT NULL,
  hash VARCHAR(64) NOT NULL UNIQUE,
  
  -- Payload
  payload JSONB NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  
  -- Metadata
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  actor_id VARCHAR(255) NOT NULL,
  
  -- Crypto
  signature VARCHAR(128) NOT NULL,
  public_key_id VARCHAR(64) NOT NULL,
  
  -- Compliance
  data_residency VARCHAR(20) NOT NULL,
  retention_policy VARCHAR(50) NOT NULL,
  
  -- Indexes
  CONSTRAINT events_sequence_check CHECK (sequence > 0)
);

-- Append-only enforcement
CREATE RULE events_no_update AS ON UPDATE TO ledger_events DO INSTEAD NOTHING;
CREATE RULE events_no_delete AS ON DELETE TO ledger_events DO INSTEAD NOTHING;

-- Indexes
CREATE INDEX idx_events_partner_id ON ledger_events(partner_id);
CREATE INDEX idx_events_event_type ON ledger_events(event_type);
CREATE INDEX idx_events_timestamp ON ledger_events(timestamp);
CREATE INDEX idx_events_payload_claim_id ON ledger_events((payload->>'claimId'));

-- Merkle roots (daily)
CREATE TABLE merkle_roots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_date DATE NOT NULL UNIQUE,
  merkle_root VARCHAR(64) NOT NULL,
  first_sequence BIGINT NOT NULL,
  last_sequence BIGINT NOT NULL,
  event_count INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proofs cache
CREATE TABLE proofs_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ledger_events(id),
  proof_type VARCHAR(50) NOT NULL,
  proof_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(event_id, proof_type)
);
```

---

## 9. API Contract (v0.1)

### 9.1 Events API

```yaml
openapi: 3.0.3
info:
  title: Proveniq Ledger API
  version: 0.1.0

paths:
  /api/v1/events:
    post:
      summary: Create a new ledger event
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateEventRequest'
      responses:
        '201':
          description: Event created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EventResponse'
    get:
      summary: List events
      parameters:
        - name: partnerId
          in: query
          schema:
            type: string
        - name: claimId
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: Events list

  /api/v1/events/{eventId}:
    get:
      summary: Get event by ID
      responses:
        '200':
          description: Event details

  /api/v1/proofs/{eventId}:
    get:
      summary: Get verification proof for event
      responses:
        '200':
          description: Verification proof

  /api/v1/proofs/verify:
    post:
      summary: Verify a proof
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VerifyProofRequest'
      responses:
        '200':
          description: Verification result
```

---

## 10. Approval & Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Lead Architect | [AI Agent - Architect Role] | ✅ APPROVED | 2024-12-10 |
| CTO | [Pending] | ⏳ PENDING | - |

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | Lead Architect Agent | Initial domain model |
