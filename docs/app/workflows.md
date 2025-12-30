# PROVENIQ Memory (Ledger) - Workflows

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Executive Summary

This document provides detailed sequence diagrams and workflow descriptions for all major operations in PROVENIQ Memory (Ledger). Each workflow is verified against the production codebase with explicit status tags.

**Target Audience:** Backend engineers, integration developers, technical architects

---

## Workflow 1: Canonical Event Ingestion

### Overview

**Purpose:** Write a new event to the ledger with cryptographic integrity

**Concurrency:** Serialized (advisory lock)

**Idempotency:** Supported via `idempotency_key`

**Status:** [SHIPPED]

---

### Sequence Diagram

```mermaid
sequenceDiagram
    participant P as Producer Service
    participant API as Ledger API
    participant Auth as Auth Middleware
    participant Val as Schema Validator
    participant Ing as Canonical Ingest
    participant DB as PostgreSQL
    participant Audit as Audit Logger
    
    P->>API: POST /api/v1/events/canonical
    Note over P,API: Event envelope with<br/>schema_version, producer,<br/>payload, signatures
    
    API->>Auth: Verify credentials
    Auth->>Auth: Check x-api-key OR<br/>Firebase Bearer token
    
    alt Authentication Failed
        Auth-->>API: 401 Unauthorized
        API-->>P: 401 Unauthorized
    end
    
    Auth-->>API: Authenticated
    
    API->>Val: Validate event schema
    Val->>Val: Zod validation against<br/>CanonicalEventEnvelope
    
    alt Schema Invalid
        Val-->>API: Validation error
        API-->>P: 400 Bad Request<br/>(schema details)
    end
    
    Val-->>API: Schema valid
    
    API->>Ing: Ingest event
    
    Ing->>DB: BEGIN transaction
    
    Ing->>DB: SELECT pg_advisory_xact_lock(0x5052564e, 0x4c454447)
    Note over DB: Advisory lock acquired<br/>Serializes all writes
    
    Ing->>DB: SELECT idempotency_key FROM ledger_entries<br/>WHERE idempotency_key = ?
    
    alt Idempotency Key Exists
        DB-->>Ing: Existing entry found
        Ing->>DB: ROLLBACK
        Ing-->>API: 200 OK (idempotent=true)
        API-->>P: 200 OK<br/>{sequence_number, entry_hash, idempotent: true}
    end
    
    DB-->>Ing: No duplicate found
    
    Ing->>DB: SELECT sequence_number, entry_hash<br/>FROM ledger_entries<br/>ORDER BY sequence_number DESC LIMIT 1
    
    alt Table Empty (Genesis)
        DB-->>Ing: Empty result
        Ing->>Ing: previousHash = null<br/>nextSeq = 0
    else Table Has Entries
        DB-->>Ing: Latest entry
        Ing->>Ing: previousHash = latest.entry_hash<br/>nextSeq = latest.sequence_number + 1
    end
    
    Ing->>Ing: Calculate payload_hash<br/>SHA256(JSON.stringify(payload, sorted keys))
    
    Ing->>Ing: Calculate entry_hash<br/>SHA256(payload_hash | previousHash | seq | event_id)
    
    Ing->>DB: INSERT INTO ledger_entries<br/>(id, sequence_number, payload_hash,<br/>previous_hash, entry_hash, ...)
    
    DB-->>Ing: Insert successful
    
    Ing->>DB: COMMIT
    Note over DB: Advisory lock released<br/>automatically on commit
    
    Ing->>Audit: Log ingestion
    Audit->>DB: INSERT INTO audit_log<br/>(action='canonical_event_ingested', ...)
    
    Ing-->>API: 201 Created<br/>{id, sequence_number, entry_hash, idempotent: false}
    
    API-->>P: 201 Created<br/>Event committed to ledger
```

**Status:** [SHIPPED]

---

### Critical Path Steps

1. **Authentication** - Verify Firebase token OR Admin API Key
2. **Schema Validation** - Zod validates against `CanonicalEventEnvelope`
3. **Advisory Lock** - Acquire `pg_advisory_xact_lock` (serializes writes)
4. **Idempotency Check** - Query for existing `idempotency_key`
5. **Latest Entry Retrieval** - Get previous hash and sequence
6. **Hash Calculation** - Compute `payload_hash` and `entry_hash`
7. **Database Insert** - Write new entry with incremented sequence
8. **Transaction Commit** - Release advisory lock
9. **Audit Logging** - Record ingestion event

**Status:** [SHIPPED]

---

### Error Scenarios

| Error | HTTP Status | Cause | Resolution |
|-------|-------------|-------|------------|
| Authentication Failed | 401 | Invalid credentials | Check API key or Firebase token |
| Schema Validation Failed | 400 | Invalid event envelope | Fix event structure |
| Invalid Event Type | 400 | Unregistered event type | Use valid event type |
| Database Connection Failed | 500 | Database unavailable | Retry with backoff |
| Constraint Violation | 500 | Sequence conflict (rare) | Retry (advisory lock prevents this) |

**Status:** [SHIPPED]

---

## Workflow 2: Event Query

### Overview

**Purpose:** Retrieve events with filtering and pagination

**Concurrency:** Parallel (no locks)

**Performance:** ~10-50ms p50 [UNKNOWN]

**Status:** [SHIPPED]

---

### Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Consumer Service
    participant API as Ledger API
    participant Auth as Auth Middleware
    participant Query as Query Handler
    participant DB as PostgreSQL
    participant Audit as Audit Logger
    
    C->>API: GET /api/v1/events?asset_id=uuid&limit=100
    
    API->>Auth: Verify credentials
    Auth->>Auth: Check x-api-key OR<br/>Firebase Bearer token
    
    alt Authentication Failed
        Auth-->>API: 401 Unauthorized
        API-->>C: 401 Unauthorized
    end
    
    Auth-->>API: Authenticated
    
    API->>Query: Parse query parameters
    Query->>Query: Validate filters<br/>(asset_id, event_type, dates, etc.)
    
    alt Invalid Parameters
        Query-->>API: Validation error
        API-->>C: 400 Bad Request
    end
    
    Query->>DB: SELECT * FROM ledger_entries<br/>WHERE asset_id = ?<br/>ORDER BY sequence_number DESC<br/>LIMIT ? OFFSET ?
    Note over DB: No locks acquired<br/>Parallel reads allowed
    
    DB-->>Query: Result set
    
    Query->>DB: SELECT COUNT(*) FROM ledger_entries<br/>WHERE asset_id = ?
    
    DB-->>Query: Total count
    
    Query->>Query: Build response<br/>{events, total, limit, offset}
    
    Query->>Audit: Log query
    Audit->>DB: INSERT INTO audit_log<br/>(action='event_read', resource_id=?, ...)
    
    Query-->>API: Query results
    
    API-->>C: 200 OK<br/>{events: [...], total, limit, offset}
```

**Status:** [SHIPPED]

---

### Query Parameters

| Parameter | Type | Purpose | Example |
|-----------|------|---------|---------|
| `source` | String | Filter by producer | `service` |
| `event_type` | String | Filter by event type | `SERVICE_RECORD_CREATED` |
| `asset_id` | UUID | Filter by asset | `uuid-v4` |
| `anchor_id` | String | Filter by anchor | `ANCHOR-12345` |
| `correlation_id` | String | Filter by correlation | `uuid-v4` |
| `from_date` | ISO 8601 | Events after date | `2024-01-01T00:00:00Z` |
| `to_date` | ISO 8601 | Events before date | `2024-12-31T23:59:59Z` |
| `limit` | Integer | Max results (default 100, max 1000) | `100` |
| `offset` | Integer | Pagination offset (default 0) | `0` |

**Status:** [SHIPPED]

---

### Performance Optimization

**Indexed Queries:**
- `asset_id` - Uses `idx_ledger_asset_id`
- `event_type` - Uses `idx_ledger_event_type`
- `source` - Uses `idx_ledger_source`
- `created_at` - Uses `idx_ledger_created_at`

**Unindexed Queries:**
- Payload field filtering (requires full table scan)

**Recommendation:** Always use indexed filters when possible

**Status:** [SHIPPED]

---

## Workflow 3: Integrity Verification

### Overview

**Purpose:** Verify hash chain integrity from Genesis to Head

**Execution:** Manual (via npm script) or API endpoint

**Strategies:** Full chain, last N, random sample

**Status:** [SHIPPED]

---

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Op as Operator
    participant Script as Verify Script
    participant DB as PostgreSQL
    participant Log as Console Output
    
    Op->>Script: npm run verify-integrity [--last N | --sample N]
    
    Script->>Script: Parse CLI arguments<br/>Determine strategy
    
    alt Full Chain Verification
        Script->>DB: SELECT * FROM ledger_entries<br/>ORDER BY sequence_number ASC
    else Last N Verification
        Script->>DB: SELECT * FROM ledger_entries<br/>ORDER BY sequence_number DESC<br/>LIMIT N
    else Random Sample Verification
        Script->>DB: SELECT * FROM ledger_entries<br/>WHERE sequence_number IN (random sample)
    end
    
    DB-->>Script: Entry set
    
    Script->>Log: Strategy: [Full | Last N | Sample N]
    Script->>Log: Entries to verify: N
    
    loop For Each Entry
        Script->>Script: Verify payload_hash<br/>Recompute SHA256(payload)
        
        alt Payload Hash Mismatch
            Script->>Log: ❌ Payload hash mismatch at seq N
            Script->>Script: errors.push({type: 'payload_hash_mismatch', seq: N})
        end
        
        Script->>Script: Verify entry_hash<br/>Recompute SHA256(payload_hash | previous_hash | ...)
        
        alt Entry Hash Mismatch
            Script->>Log: ❌ Entry hash mismatch at seq N
            Script->>Script: errors.push({type: 'entry_hash_mismatch', seq: N})
        end
        
        Script->>Script: Verify chain link<br/>previous_hash == previous_entry.entry_hash
        
        alt Chain Break
            Script->>Log: ❌ Chain break at seq N
            Script->>Script: errors.push({type: 'chain_break', seq: N})
        end
        
        Script->>Script: Verify sequence continuity<br/>seq == previous_seq + 1
        
        alt Sequence Gap
            Script->>Log: ❌ Sequence gap at seq N
            Script->>Script: errors.push({type: 'sequence_gap', seq: N})
        end
        
        Script->>Log: ✓ Entry N verified
    end
    
    Script->>Log: ════════════════════════════════════
    Script->>Log: VERIFICATION SUMMARY
    Script->>Log: Entries verified: N/N
    Script->>Log: Errors found: M
    
    alt Errors Found
        Script->>Log: ❌ CHAIN INTEGRITY VIOLATION DETECTED
        Script->>Log: Error breakdown: [...]
        Script->>Op: Exit code 1 (failure)
    else No Errors
        Script->>Log: ✅ CHAIN INTEGRITY VERIFIED
        Script->>Op: Exit code 0 (success)
    end
```

**Status:** [SHIPPED]

---

### Verification Checks

| Check | Purpose | Detection |
|-------|---------|-----------|
| **Payload Hash** | Verify payload integrity | Detects payload tampering |
| **Entry Hash** | Verify metadata integrity | Detects metadata tampering |
| **Chain Link** | Verify hash linkage | Detects chain breaks |
| **Sequence Continuity** | Verify no gaps | Detects missing entries |

**Status:** [SHIPPED]

---

### Verification Strategies

**1. Full Chain (Default):**
```bash
npm run verify-integrity
```
- Verifies all entries from Genesis to Head
- Use for small ledgers (< 1000 entries)
- Duration: ~5-10 seconds per 1000 entries [UNKNOWN]

**2. Last N Entries:**
```bash
npm run verify-integrity -- --last 1000
```
- Verifies most recent N entries
- Use for large ledgers (>= 1000 entries)
- Duration: ~1-2 seconds [UNKNOWN]

**3. Random Sample:**
```bash
npm run verify-integrity -- --sample 100
```
- Verifies random sample of N entries
- Use for statistical verification
- Duration: ~0.5-1 second [UNKNOWN]

**Status:** [SHIPPED]

---

## Workflow 4: Genesis Block Creation

### Overview

**Purpose:** Initialize empty ledger with first entry

**Occurrence:** Once per ledger (first write)

**Special Handling:** `previous_hash = null`, `sequence_number = 0`

**Status:** [SHIPPED]

---

### Sequence Diagram

```mermaid
sequenceDiagram
    participant P as Producer Service
    participant API as Ledger API
    participant Ing as Canonical Ingest
    participant DB as PostgreSQL
    
    Note over DB: Table is empty<br/>(no entries exist)
    
    P->>API: POST /api/v1/events/canonical<br/>(First event ever)
    
    API->>Ing: Ingest event
    
    Ing->>DB: BEGIN transaction
    
    Ing->>DB: SELECT pg_advisory_xact_lock(...)
    Note over DB: Lock acquired<br/>(works even with empty table)
    
    Ing->>DB: SELECT sequence_number, entry_hash<br/>FROM ledger_entries<br/>ORDER BY sequence_number DESC LIMIT 1
    
    DB-->>Ing: Empty result (rowCount = 0)
    
    Ing->>Ing: Detect Genesis condition:<br/>latest = null
    
    Ing->>Ing: Set Genesis values:<br/>previousHash = null<br/>nextSeq = 0
    
    Ing->>Ing: Calculate payload_hash<br/>SHA256(payload)
    
    Ing->>Ing: Calculate entry_hash<br/>SHA256(payload_hash | null | 0 | event_id)
    
    Ing->>DB: INSERT INTO ledger_entries<br/>(sequence_number=0,<br/>previous_hash=null, ...)
    
    DB-->>Ing: Genesis block created
    
    Ing->>DB: COMMIT
    Note over DB: Lock released<br/>Genesis established
    
    Ing-->>API: 201 Created<br/>{sequence_number: 0, previous_hash: null}
    
    API-->>P: Genesis block confirmed
```

**Status:** [SHIPPED]

---

### Genesis Characteristics

| Property | Value | Rationale |
|----------|-------|-----------|
| `sequence_number` | `0` | First entry in chain |
| `previous_hash` | `null` | No predecessor exists |
| `entry_hash` | SHA-256 hash | Establishes first link |
| Uniqueness | Cannot be recreated | UNIQUE constraint on sequence |
| Immutability | Cannot be modified | WORM trigger enforcement |

**Status:** [SHIPPED]

---

## Workflow 5: Idempotent Retry

### Overview

**Purpose:** Handle duplicate event submissions safely

**Mechanism:** Client-provided `idempotency_key`

**Behavior:** First submission creates entry, subsequent submissions return existing entry

**Status:** [SHIPPED]

---

### Sequence Diagram

```mermaid
sequenceDiagram
    participant P as Producer Service
    participant API as Ledger API
    participant Ing as Canonical Ingest
    participant DB as PostgreSQL
    
    Note over P: Network timeout on first attempt<br/>Retry with same idempotency_key
    
    P->>API: POST /api/v1/events/canonical<br/>(idempotency_key: "abc123")
    
    API->>Ing: Ingest event
    
    Ing->>DB: BEGIN transaction
    
    Ing->>DB: SELECT pg_advisory_xact_lock(...)
    
    Ing->>DB: SELECT id, sequence_number, entry_hash<br/>FROM ledger_entries<br/>WHERE idempotency_key = 'abc123'
    
    alt Idempotency Key Exists
        DB-->>Ing: Existing entry found<br/>{id, sequence_number, entry_hash}
        
        Ing->>DB: ROLLBACK
        Note over DB: No write performed<br/>Lock released
        
        Ing-->>API: 200 OK<br/>{id, sequence_number, entry_hash, idempotent: true}
        
        API-->>P: 200 OK<br/>Event already exists (safe retry)
        
    else Idempotency Key Not Found
        DB-->>Ing: No existing entry
        
        Note over Ing: Proceed with normal ingestion<br/>(see Workflow 1)
        
        Ing->>DB: INSERT INTO ledger_entries<br/>(idempotency_key='abc123', ...)
        
        Ing->>DB: COMMIT
        
        Ing-->>API: 201 Created<br/>{id, sequence_number, entry_hash, idempotent: false}
        
        API-->>P: 201 Created<br/>Event created
    end
```

**Status:** [SHIPPED]

---

### Idempotency Key Best Practices

**Recommended Format:**
```
{producer}:{event_type}:{resource_id}:{timestamp}
```

**Example:**
```
service:SERVICE_RECORD_CREATED:uuid-work-order:2024-12-29T12:00:00Z
```

**Characteristics:**
- Deterministic (same inputs = same key)
- Unique per event (different inputs = different key)
- Max 256 characters
- No PII (keys are stored permanently)

**Status:** [SHIPPED]

---

## Workflow 6: Multi-Service Event Correlation

### Overview

**Purpose:** Link related events across multiple services

**Mechanism:** Shared `correlation_id` across events

**Use Case:** Track multi-step workflows (e.g., shipment → delivery → claim)

**Status:** [SHIPPED]

---

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Transit as Transit Service
    participant Protect as Protect Service
    participant ClaimsIQ as ClaimsIQ Service
    participant Ledger as Ledger API
    
    Note over Transit: Generate correlation_id<br/>correlation_id = uuid-v4
    
    Transit->>Ledger: POST /api/v1/events/canonical<br/>{event_type: "TRANSIT_SHIPMENT_CREATED",<br/>correlation_id: "uuid-abc"}
    
    Ledger-->>Transit: 201 Created (seq=100)
    
    Note over Transit: Shipment delivered
    
    Transit->>Ledger: POST /api/v1/events/canonical<br/>{event_type: "TRANSIT_SHIPMENT_DELIVERED",<br/>correlation_id: "uuid-abc"}
    
    Ledger-->>Transit: 201 Created (seq=101)
    
    Note over Protect: Damage detected during delivery
    
    Protect->>Ledger: POST /api/v1/events/canonical<br/>{event_type: "PROTECT_CLAIM_INITIATED",<br/>correlation_id: "uuid-abc"}
    
    Ledger-->>Protect: 201 Created (seq=102)
    
    Note over ClaimsIQ: Process insurance claim
    
    ClaimsIQ->>Ledger: POST /api/v1/events/canonical<br/>{event_type: "CLAIM_PAYOUT_APPROVED",<br/>correlation_id: "uuid-abc"}
    
    Ledger-->>ClaimsIQ: 201 Created (seq=103)
    
    Note over ClaimsIQ: Query all related events
    
    ClaimsIQ->>Ledger: GET /api/v1/events?correlation_id=uuid-abc
    
    Ledger-->>ClaimsIQ: 200 OK<br/>{events: [seq=100, 101, 102, 103]}
    
    Note over ClaimsIQ: Full workflow timeline reconstructed
```

**Status:** [SHIPPED]

---

### Correlation Benefits

**Timeline Reconstruction:**
- Query all events with same `correlation_id`
- Chronological ordering via `sequence_number`
- Complete audit trail across services

**Forensic Analysis:**
- Trace root cause across service boundaries
- Identify bottlenecks in multi-step workflows
- Prove sequence of events for disputes

**Status:** [SHIPPED]

---

## Workflow 7: Audit Log Query

### Overview

**Purpose:** Retrieve access audit trail for compliance

**Use Case:** Security investigations, compliance audits

**Status:** [SHIPPED]

---

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Auditor as Auditor
    participant API as Ledger API
    participant DB as PostgreSQL
    
    Auditor->>API: GET /api/v1/audit?actor_id=user-123&from_date=2024-01-01
    
    API->>DB: SELECT * FROM audit_log<br/>WHERE actor_id = 'user-123'<br/>AND created_at >= '2024-01-01'<br/>ORDER BY created_at DESC
    
    DB-->>API: Audit entries
    
    API-->>Auditor: 200 OK<br/>{audit_entries: [...]}
    
    Note over Auditor: Review access patterns<br/>Identify anomalies
```

**Status:** [UNKNOWN - audit query endpoint not implemented]

---

## Performance Characteristics

### Write Performance

**Throughput:** ~10-20 events/sec [UNKNOWN]

**Latency:**
- p50: ~50-100ms [UNKNOWN]
- p95: ~200-300ms [UNKNOWN]
- p99: ~500-1000ms [UNKNOWN]

**Bottleneck:** Advisory lock serialization

**Optimization:** Use async writes with queue for non-critical events

---

### Read Performance

**Throughput:** ~100-500 queries/sec [UNKNOWN]

**Latency:**
- p50: ~10-50ms [UNKNOWN]
- p95: ~50-100ms [UNKNOWN]
- p99: ~100-200ms [UNKNOWN]

**Optimization:** Use indexed filters, limit result sets

---

## Error Handling Patterns

### Retry Strategy

**Transient Errors (Retry):**
- 500 Internal Server Error
- 503 Service Unavailable
- Database connection timeout

**Retry Configuration:**
- Max attempts: 3
- Backoff: Exponential (2s, 4s, 8s)
- Idempotency: Use `idempotency_key`

**Permanent Errors (Do Not Retry):**
- 400 Bad Request (schema invalid)
- 401 Unauthorized (credentials invalid)
- 404 Not Found (resource missing)

**Status:** [POLICY-ENFORCED]

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
