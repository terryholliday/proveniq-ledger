# PROVENIQ Memory (Ledger) - Architecture Overview

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Executive Summary

PROVENIQ Memory is a **cryptographic event ledger** that serves as the immutable system of record for all physical asset events across the PROVENIQ ecosystem. It provides verifiable proof of asset provenance, custody, condition, and lifecycle events through SHA-256 hash chaining and database-enforced immutability.

**Architecture Pattern:** Event-sourced append-only log with cryptographic integrity guarantees

**Deployment Model:** Single-instance Node.js service with PostgreSQL backend

---

## System Context Diagram

```mermaid
C4Context
    title PROVENIQ Memory (Ledger) - System Context

    Person(auditor, "Auditor", "External verifier")
    Person(developer, "Developer", "Integration engineer")
    
    System(ledger, "PROVENIQ Memory", "Immutable event ledger with hash chain integrity")
    
    System_Ext(anchors, "Anchors Ingest", "Hardware event producer")
    System_Ext(service, "Service", "Maintenance event producer")
    System_Ext(transit, "Transit", "Custody event producer")
    System_Ext(protect, "Protect", "Insurance event producer")
    System_Ext(claimsiq, "ClaimsIQ", "Claims event producer")
    System_Ext(capital, "Capital", "Lending event producer")
    System_Ext(bids, "Bids", "Auction event producer")
    System_Ext(ops, "Ops", "Inventory event producer")
    System_Ext(properties, "Properties", "Inspection event producer")
    System_Ext(home, "Home", "Consumer event producer")
    System_Ext(origins, "Origins", "Legacy event producer")
    System_Ext(core, "Core", "Asset registry event producer")
    
    SystemDb(postgres, "PostgreSQL", "Immutable event store")
    
    Rel(anchors, ledger, "Writes events", "HTTPS/JSON")
    Rel(service, ledger, "Writes events", "HTTPS/JSON")
    Rel(transit, ledger, "Writes events", "HTTPS/JSON")
    Rel(protect, ledger, "Writes events", "HTTPS/JSON")
    Rel(claimsiq, ledger, "Writes events", "HTTPS/JSON")
    Rel(capital, ledger, "Writes events", "HTTPS/JSON")
    Rel(bids, ledger, "Writes events", "HTTPS/JSON")
    Rel(ops, ledger, "Writes events", "HTTPS/JSON")
    Rel(properties, ledger, "Writes events", "HTTPS/JSON")
    Rel(home, ledger, "Writes events", "HTTPS/JSON")
    Rel(origins, ledger, "Writes events", "HTTPS/JSON")
    Rel(core, ledger, "Writes events", "HTTPS/JSON")
    
    Rel(ledger, postgres, "Stores events", "PostgreSQL wire protocol")
    
    Rel(developer, ledger, "Queries events", "HTTPS/JSON")
    Rel(auditor, ledger, "Verifies integrity", "Verification script")
```

---

## Component Architecture

### Core Components

```mermaid
graph TB
    subgraph "PROVENIQ Memory Service"
        API[Express API Server]
        Auth[Authentication Middleware]
        Validation[Schema Validation]
        Ingest[Canonical Ingestion]
        Query[Query Engine]
        Verify[Integrity Verification]
        EventBus[Event Bus]
    end
    
    subgraph "PostgreSQL Database"
        Ledger[(ledger_entries)]
        Audit[(audit_log)]
        Checkpoints[(integrity_checkpoints)]
        Triggers[WORM Triggers]
        Locks[Advisory Locks]
    end
    
    Producer[Event Producer] -->|POST /api/v1/events/canonical| API
    API --> Auth
    Auth --> Validation
    Validation --> Ingest
    Ingest --> Locks
    Locks --> Ledger
    Ledger --> Triggers
    Ingest --> Audit
    
    Consumer[Event Consumer] -->|GET /api/v1/events| API
    API --> Query
    Query --> Ledger
    Query --> Audit
    
    Auditor[External Auditor] -->|npm run verify-integrity| Verify
    Verify --> Ledger
    Verify --> Checkpoints
    
    Ingest -.->|Async| EventBus
```

**Component Descriptions:**

| Component | Purpose | Implementation | Status |
|-----------|---------|----------------|--------|
| **Express API Server** | HTTP request handling | Express.js 4.19+ | [SHIPPED] |
| **Authentication Middleware** | Dual auth (Firebase + API Key) | `backend/src/auth.ts` | [SHIPPED] |
| **Schema Validation** | Zod-based event validation | `backend/src/ledger.events.ts` | [SHIPPED] |
| **Canonical Ingestion** | Advisory lock-based write path | `backend/src/ingest/canonical.ts` | [SHIPPED] |
| **Query Engine** | Filtered event retrieval | `backend/src/server.ts` | [SHIPPED] |
| **Integrity Verification** | Hash chain validation | `backend/src/verify-integrity.ts` | [SHIPPED] |
| **Event Bus** | Pub/sub event distribution | `backend/src/event-bus.ts` | [SHIPPED] |
| **WORM Triggers** | Immutability enforcement | `backend/migrations/001_immutability_constraints.sql` | [SHIPPED] |
| **Advisory Locks** | Concurrency safety | PostgreSQL `pg_advisory_xact_lock` | [SHIPPED] |

---

## Data Flow Patterns

### Canonical Event Ingestion Flow

```mermaid
sequenceDiagram
    participant P as Producer
    participant API as Ledger API
    participant Auth as Auth Middleware
    participant Val as Schema Validator
    participant Ing as Canonical Ingest
    participant DB as PostgreSQL
    participant Audit as Audit Log
    
    P->>API: POST /api/v1/events/canonical
    API->>Auth: Verify credentials
    Auth-->>API: Authenticated
    API->>Val: Validate schema
    Val->>Val: Check event_type registry
    Val->>Val: Validate DOMAIN_NOUN_VERB_PAST
    Val-->>API: Schema valid
    
    API->>Ing: Ingest event
    Ing->>DB: BEGIN transaction
    Ing->>DB: SELECT pg_advisory_xact_lock(0x5052564e, 0x4c454447)
    Note over DB: Lock acquired - serializes writes
    
    Ing->>DB: SELECT * FROM ledger_entries WHERE id = $event_id
    alt Event exists (idempotent)
        DB-->>Ing: Existing entry
        Ing->>DB: COMMIT (release lock)
        Ing-->>API: 200 OK (deduped)
    else Event is new
        Ing->>DB: SELECT sequence_number, entry_hash ORDER BY sequence_number DESC LIMIT 1
        DB-->>Ing: Latest entry (or null for Genesis)
        Ing->>Ing: Calculate payload_hash = SHA256(payload)
        Ing->>Ing: Calculate entry_hash = SHA256(payload_hash | previous_hash | ...)
        Ing->>DB: INSERT INTO ledger_entries (...)
        DB->>DB: WORM trigger check (allow INSERT)
        DB-->>Ing: Entry created
        Ing->>Audit: Log ingestion event
        Ing->>DB: COMMIT (release lock)
        Ing-->>API: 201 Created
    end
    
    API-->>P: Response with sequence_number, entry_hash
```

**Critical Path Characteristics:**
- **Latency:** ~50-100ms (single database round-trip) [UNKNOWN - not measured in code]
- **Throughput:** Serialized writes (one at a time) [SHIPPED]
- **Failure Mode:** Transaction rollback on any error [SHIPPED]

---

### Event Query Flow

```mermaid
sequenceDiagram
    participant C as Consumer
    participant API as Ledger API
    participant Auth as Auth Middleware
    participant Query as Query Engine
    participant DB as PostgreSQL
    participant Audit as Audit Log
    
    C->>API: GET /api/v1/events?asset_id=...&limit=100
    API->>Auth: Verify credentials
    Auth-->>API: Authenticated
    
    API->>Query: Parse query parameters
    Query->>Query: Validate filters (Zod)
    Query->>DB: SELECT * FROM ledger_entries WHERE ... LIMIT 100
    DB-->>Query: Result set
    
    Query->>Audit: Log query event
    Query-->>API: Events array
    API-->>C: 200 OK with events
```

**Query Capabilities:** [SHIPPED]
- Filter by: `source`, `event_type`, `asset_id`, `anchor_id`, `correlation_id`
- Date range: `from_date`, `to_date`
- Sequence range: `from_sequence`, `to_sequence`
- Pagination: `limit` (max 1000), `offset`

---

### Integrity Verification Flow

```mermaid
sequenceDiagram
    participant A as Auditor
    participant Script as verify-integrity.ts
    participant DB as PostgreSQL
    
    A->>Script: npm run verify-integrity
    Script->>DB: SELECT COUNT(*) FROM ledger_entries
    DB-->>Script: Entry count
    
    alt Full chain verification
        Script->>DB: SELECT * ORDER BY sequence_number ASC
    else Last N verification
        Script->>DB: SELECT * ORDER BY sequence_number DESC LIMIT N
    else Random sample
        Script->>DB: SELECT * ORDER BY RANDOM() LIMIT N
    end
    
    DB-->>Script: Entries
    
    loop For each entry
        Script->>Script: Recompute payload_hash
        Script->>Script: Verify payload_hash matches stored
        Script->>Script: Recompute entry_hash
        Script->>Script: Verify entry_hash matches stored
        Script->>Script: Verify previous_hash links to previous entry
        Script->>Script: Verify sequence numbers are contiguous
    end
    
    alt All checks pass
        Script-->>A: Exit 0 (valid)
    else Any check fails
        Script-->>A: Exit 1 (integrity violation)
    end
```

**Verification Guarantees:**
- Detects payload tampering [SHIPPED]
- Detects hash chain breaks [SHIPPED]
- Detects sequence gaps [SHIPPED]
- Detects entry hash mismatches [SHIPPED]

---

## Integration Points

### Producer Integration

**Endpoint:** `POST /api/v1/events/canonical`

**Authentication:** Firebase ID Token OR Admin API Key

**Request Schema:**
```typescript
{
  schema_version: "1.0.0",
  event_type: "DOMAIN_NOUN_VERB_PAST",
  occurred_at: "2024-12-29T12:00:00Z",
  correlation_id: "uuid",
  idempotency_key: "unique-string",
  producer: "service-name",
  producer_version: "1.0.0",
  subject: {
    asset_id: "uuid",
    anchor_id?: "string",
    // ... other IDs
  },
  payload: { /* event-specific data */ },
  canonical_hash_hex: "sha256-hex",
  signatures?: {
    device_sig?: "ed25519-hex",
    provider_sig?: "ed25519-hex"
  }
}
```

**Response (Success):**
```json
{
  "event_id": "uuid",
  "sequence_number": 12345,
  "entry_hash": "sha256-hex",
  "committed_at": "2024-12-29T12:00:01Z",
  "schema_version": "1.0.0",
  "idempotent": false
}
```

**Response (Duplicate):**
```json
{
  "event_id": "uuid",
  "sequence_number": 12345,
  "entry_hash": "sha256-hex",
  "committed_at": "2024-12-29T12:00:01Z",
  "schema_version": "1.0.0",
  "idempotent": true
}
```

---

### Consumer Integration

**Endpoint:** `GET /api/v1/events`

**Query Parameters:**
- `source` - Filter by producer (enum)
- `event_type` - Filter by event type (string)
- `asset_id` - Filter by asset UUID
- `anchor_id` - Filter by anchor ID
- `correlation_id` - Filter by correlation UUID
- `from_sequence` - Minimum sequence number
- `to_sequence` - Maximum sequence number
- `from_date` - Minimum timestamp (ISO 8601)
- `to_date` - Maximum timestamp (ISO 8601)
- `limit` - Max results (1-1000, default 100)
- `offset` - Pagination offset (default 0)

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "sequence_number": 12345,
      "source": "service",
      "event_type": "SERVICE_RECORD_CREATED",
      "payload": { /* event data */ },
      "payload_hash": "sha256-hex",
      "previous_hash": "sha256-hex",
      "entry_hash": "sha256-hex",
      "created_at": "2024-12-29T12:00:01Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

---

## Deployment Architecture

### Production Topology

```mermaid
graph TB
    subgraph "Railway Platform"
        LB[Load Balancer]
        App[Ledger Service<br/>Node.js 20]
        DB[(PostgreSQL 15<br/>with SSL)]
    end
    
    subgraph "External Services"
        Firebase[Firebase Auth]
        Producers[12 Producer Services]
        Consumers[Query Consumers]
    end
    
    Producers -->|HTTPS| LB
    Consumers -->|HTTPS| LB
    LB --> App
    App -->|PostgreSQL wire protocol<br/>SSL/TLS| DB
    App -->|Verify tokens| Firebase
    
    style DB fill:#f9f,stroke:#333,stroke-width:4px
    style App fill:#bbf,stroke:#333,stroke-width:2px
```

**Infrastructure Characteristics:**
- **Platform:** Railway (Docker-based) [SHIPPED]
- **Runtime:** Node.js 20 Alpine Linux [SHIPPED]
- **Database:** PostgreSQL 15+ with SSL/TLS [SHIPPED]
- **Scaling:** Single instance (serialized writes) [SHIPPED]
- **High Availability:** Database replication (platform-managed) [UNKNOWN]

---

## Security Boundaries

### Trust Boundaries

```mermaid
graph LR
    subgraph "Untrusted Zone"
        Prod[Producers]
        Cons[Consumers]
    end
    
    subgraph "Trust Boundary"
        Auth[Authentication]
        Val[Schema Validation]
    end
    
    subgraph "Trusted Zone"
        Ingest[Canonical Ingest]
        DB[(PostgreSQL)]
    end
    
    Prod -->|Unverified| Auth
    Cons -->|Unverified| Auth
    Auth -->|Authenticated| Val
    Val -->|Validated| Ingest
    Ingest -->|Trusted| DB
```

**Security Layers:**
1. **Network:** HTTPS/TLS (transport encryption) [SHIPPED]
2. **Authentication:** Firebase ID Token OR Admin API Key [SHIPPED]
3. **Schema Validation:** Zod-based strict validation [SHIPPED]
4. **Database:** PostgreSQL SSL/TLS connection [SHIPPED]
5. **Immutability:** WORM triggers (machine-enforced) [SHIPPED]

---

## Performance Characteristics

### Write Path

| Metric | Value | Source |
|--------|-------|--------|
| **Concurrency Model** | Serialized (advisory lock) | [SHIPPED] |
| **Throughput** | ~10-20 writes/sec | [UNKNOWN] |
| **Latency (p50)** | ~50-100ms | [UNKNOWN] |
| **Latency (p99)** | ~200-500ms | [UNKNOWN] |
| **Max Payload Size** | Unlimited (JSONB) | [UNKNOWN] |

### Read Path

| Metric | Value | Source |
|--------|-------|--------|
| **Concurrency Model** | Parallel (no locks) | [SHIPPED] |
| **Throughput** | ~100-500 reads/sec | [UNKNOWN] |
| **Latency (p50)** | ~10-50ms | [UNKNOWN] |
| **Query Complexity** | O(n) with indices | [SHIPPED] |
| **Max Result Set** | 1000 entries | [SHIPPED] |

**Note:** Performance metrics marked [UNKNOWN] are not measured in code and should be validated in production.

---

## Failure Modes

### Write Failures

| Failure | Cause | Behavior | Recovery |
|---------|-------|----------|----------|
| **Schema Validation** | Invalid event structure | 400 Bad Request | Fix event schema |
| **Unknown Event Type** | Event type not registered | 400 Bad Request | Register event type |
| **Database Unavailable** | PostgreSQL down | 500 Internal Server Error | Retry after DB recovery |
| **Lock Timeout** | Advisory lock held too long | Transaction timeout | Automatic rollback |
| **Duplicate Event** | Same event_id or idempotency_key | 200 OK (idempotent) | No action needed |

### Read Failures

| Failure | Cause | Behavior | Recovery |
|---------|-------|----------|----------|
| **Invalid Query** | Malformed parameters | 400 Bad Request | Fix query parameters |
| **Database Unavailable** | PostgreSQL down | 500 Internal Server Error | Retry after DB recovery |
| **Timeout** | Query too slow | 504 Gateway Timeout | Reduce query scope |

---

## Operational Characteristics

### Monitoring Points

**Health Check:** `GET /health`
```json
{
  "status": "UP",
  "service": "proveniq-ledger",
  "product_name": "PROVENIQ Memory",
  "product_key": "memory",
  "version": "0.2.0"
}
```

**Metrics to Monitor:** [UNKNOWN - not implemented in code]
- Write throughput (events/sec)
- Read throughput (queries/sec)
- Write latency (p50, p95, p99)
- Read latency (p50, p95, p99)
- Database connection pool utilization
- Advisory lock contention
- Integrity verification failures

### Backup and Recovery

**Backup Strategy:** [UNKNOWN - not specified in code]
- Database-level backups (platform-managed)
- Point-in-time recovery capability required
- Immutable data (no need for application-level backups)

**Disaster Recovery:** [UNKNOWN - not specified in code]
- RTO (Recovery Time Objective): TBD
- RPO (Recovery Point Objective): TBD
- Integrity verification required after restore

---

## Limitations and Constraints

### By Design

1. **No Event Modification** - Events cannot be updated or deleted (machine-enforced)
2. **No Event Reordering** - Sequence numbers are immutable and monotonic
3. **Serialized Writes** - Concurrent writes are serialized via advisory locks
4. **No Real-Time Streaming** - Query-based access only (no WebSocket/SSE)
5. **No Cross-Chain Queries** - Each ledger network is isolated

### Technical Limits

| Limit | Value | Source |
|-------|-------|--------|
| **Max Query Results** | 1000 entries | [SHIPPED] |
| **Max Idempotency Key Length** | 256 characters | [SHIPPED] |
| **Max Anchor ID Length** | 64 characters | [SHIPPED] |
| **Max Event Type Length** | 128 characters | [SHIPPED] |
| **Max Payload Size** | Unlimited (JSONB) | [UNKNOWN] |
| **Max Sequence Number** | 2^63-1 (BIGINT) | [SHIPPED] |

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
