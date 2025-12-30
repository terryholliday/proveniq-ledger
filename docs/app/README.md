# PROVENIQ Memory (Ledger) - Application Overview

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Service Identity

**Product Name:** PROVENIQ Memory  
**Internal Name:** Ledger  
**Service Key:** `memory`  
**Version:** 0.2.0

**Purpose:** Immutable cryptographic event ledger for physical asset truth

---

## Technology Stack

### Runtime Environment

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | 20+ | JavaScript execution |
| **Framework** | Express.js | 4.21.2 | HTTP server |
| **Language** | TypeScript | 5.7.2 | Type-safe development |
| **Database** | PostgreSQL | 15+ | Persistent storage |
| **Database Client** | pg | 8.13.0 | PostgreSQL driver |

**Status:** [SHIPPED]

---

### Core Dependencies

**Production:**
```json
{
  "express": "^4.21.2",
  "cors": "^2.8.5",
  "pg": "^8.13.0",
  "zod": "^3.24.1",
  "firebase-admin": "^13.0.1",
  "dotenv": "^16.5.0"
}
```

**Development:**
```json
{
  "typescript": "^5.7.2",
  "@types/node": "^22.10.2",
  "@types/express": "^5.0.0",
  "@types/pg": "^8.11.10",
  "tsx": "^4.19.2"
}
```

**Status:** [SHIPPED]

**Source:** `backend/package.json`

---

## Architecture Summary

### Service Boundaries

```mermaid
graph TB
    subgraph "External Producers"
        Anchors[Anchors Ingest]
        Service[Service]
        Transit[Transit]
        Protect[Protect]
        ClaimsIQ[ClaimsIQ]
        Capital[Capital]
        Bids[Bids]
        Ops[Ops]
        Properties[Properties]
        Home[Home]
        Origins[Origins]
        Core[Core]
    end
    
    subgraph "PROVENIQ Memory (Ledger)"
        API[Express API<br/>Port 8006]
        Auth[Dual Auth<br/>Firebase + API Key]
        Ingest[Canonical Ingest<br/>Advisory Lock]
        Query[Query Engine<br/>Parallel Reads]
        Verify[Integrity Verification<br/>Hash Chain]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL<br/>WORM + SSL)]
    end
    
    Anchors --> API
    Service --> API
    Transit --> API
    Protect --> API
    ClaimsIQ --> API
    Capital --> API
    Bids --> API
    Ops --> API
    Properties --> API
    Home --> API
    Origins --> API
    Core --> API
    
    API --> Auth
    Auth --> Ingest
    Auth --> Query
    Auth --> Verify
    
    Ingest --> DB
    Query --> DB
    Verify --> DB
    
    style API fill:#9cf,stroke:#333,stroke-width:2px
    style DB fill:#f9f,stroke:#333,stroke-width:3px
```

**Status:** [SHIPPED]

---

### Data Flow Patterns

**Write Path (Canonical Ingestion):**
1. Producer submits event via POST `/api/v1/events/canonical`
2. Authentication middleware validates credentials
3. Zod schema validates event envelope
4. Advisory lock acquired (serialized writes)
5. Latest entry retrieved from database
6. Hash calculated with previous entry hash
7. New entry inserted with incremented sequence
8. Advisory lock released on commit
9. Response returned with sequence number and entry hash

**Read Path (Query):**
1. Consumer requests events via GET `/api/v1/events`
2. Authentication middleware validates credentials
3. Query parameters parsed and validated
4. Database query executed (no locks - parallel reads)
5. Results returned with pagination metadata

**Status:** [SHIPPED]

---

## Service Endpoints

### Health Check

**Endpoint:** `GET /health`

**Authentication:** None (public)

**Response:**
```json
{
  "status": "UP",
  "service": "proveniq-ledger",
  "product_name": "PROVENIQ Memory",
  "product_key": "memory",
  "version": "0.2.0"
}
```

**Status:** [SHIPPED]

---

### Canonical Event Ingestion

**Endpoint:** `POST /api/v1/events/canonical`

**Authentication:** Required (Firebase ID Token OR Admin API Key)

**Request Body:**
```json
{
  "schema_version": "1.0.0",
  "event_type": "SERVICE_RECORD_CREATED",
  "occurred_at": "2024-12-29T12:00:00Z",
  "correlation_id": "uuid-v4",
  "idempotency_key": "unique-client-key",
  "producer": "service",
  "producer_version": "1.0.0",
  "subject": {
    "asset_id": "uuid-v4",
    "work_order_id": "uuid-v4"
  },
  "payload": {
    "parts_replaced": ["brake_pads"],
    "labor_hours": 2.5
  },
  "canonical_hash_hex": "sha256-hex",
  "signatures": {
    "provider_sig": "ed25519-hex"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-v4",
  "sequence_number": 12345,
  "entry_hash": "sha256-hex",
  "previous_hash": "sha256-hex",
  "idempotent": false
}
```

**Response (200 OK - Duplicate):**
```json
{
  "id": "uuid-v4",
  "sequence_number": 12345,
  "entry_hash": "sha256-hex",
  "previous_hash": "sha256-hex",
  "idempotent": true
}
```

**Status:** [SHIPPED]

---

### Legacy Event Ingestion

**Endpoint:** `POST /api/v1/events`

**Authentication:** Required

**Status:** [SHIPPED] (deprecated, use canonical endpoint)

---

### Query Events

**Endpoint:** `GET /api/v1/events`

**Authentication:** Required

**Query Parameters:**
- `source` - Filter by producer (optional)
- `event_type` - Filter by event type (optional)
- `asset_id` - Filter by asset UUID (optional)
- `anchor_id` - Filter by anchor ID (optional)
- `correlation_id` - Filter by correlation UUID (optional)
- `from_date` - Filter events after date (ISO 8601) (optional)
- `to_date` - Filter events before date (ISO 8601) (optional)
- `limit` - Max results (default: 100, max: 1000) (optional)
- `offset` - Pagination offset (default: 0) (optional)

**Response:**
```json
{
  "events": [
    {
      "id": "uuid-v4",
      "sequence_number": 12345,
      "source": "service",
      "event_type": "SERVICE_RECORD_CREATED",
      "correlation_id": "uuid-v4",
      "asset_id": "uuid-v4",
      "payload": { ... },
      "payload_hash": "sha256-hex",
      "previous_hash": "sha256-hex",
      "entry_hash": "sha256-hex",
      "created_at": "2024-12-29T12:00:00Z"
    }
  ],
  "total": 12345,
  "limit": 100,
  "offset": 0
}
```

**Status:** [SHIPPED]

---

### Query Single Event

**Endpoint:** `GET /api/v1/events/:id`

**Authentication:** Required

**Response:**
```json
{
  "id": "uuid-v4",
  "sequence_number": 12345,
  "source": "service",
  "event_type": "SERVICE_RECORD_CREATED",
  "correlation_id": "uuid-v4",
  "asset_id": "uuid-v4",
  "payload": { ... },
  "payload_hash": "sha256-hex",
  "previous_hash": "sha256-hex",
  "entry_hash": "sha256-hex",
  "created_at": "2024-12-29T12:00:00Z"
}
```

**Status:** [SHIPPED]

---

### Query Events by Asset

**Endpoint:** `GET /api/v1/assets/:assetId/events`

**Authentication:** Required

**Response:** Same as `GET /api/v1/events` (filtered by asset_id)

**Status:** [SHIPPED]

---

### Query Events by Anchor

**Endpoint:** `GET /api/v1/anchors/:anchorId/events`

**Authentication:** Required

**Response:** Same as `GET /api/v1/events` (filtered by anchor_id)

**Status:** [SHIPPED]

---

### Integrity Verification

**Endpoint:** `GET /api/v1/integrity/verify`

**Authentication:** Required

**Query Parameters:**
- `last` - Verify last N entries (optional)
- `sample` - Verify random sample of N entries (optional)

**Response:**
```json
{
  "valid": true,
  "entries_verified": 12345,
  "errors": [],
  "duration_ms": 5432
}
```

**Status:** [SHIPPED]

---

### Statistics

**Endpoint:** `GET /api/v1/stats`

**Authentication:** Required

**Response:**
```json
{
  "total_entries": 12345,
  "latest_sequence": 12344,
  "earliest_created_at": "2024-01-01T00:00:00Z",
  "latest_created_at": "2024-12-29T12:00:00Z",
  "unique_sources": 12,
  "unique_event_types": 74,
  "unique_assets": 5678
}
```

**Status:** [SHIPPED]

---

## Database Schema

### Tables

**1. ledger_entries** (Main event log)

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Event identifier |
| `sequence_number` | BIGSERIAL | UNIQUE, NOT NULL | Monotonic sequence |
| `source` | TEXT | NOT NULL | Producer service |
| `event_type` | TEXT | NOT NULL | Event type name |
| `correlation_id` | TEXT | NULL | Cross-service correlation |
| `asset_id` | UUID | NULL | PROVENIQ Asset ID |
| `anchor_id` | TEXT | NULL | Anchor device ID |
| `actor_id` | TEXT | NULL | User/service actor |
| `payload` | JSONB | NOT NULL | Event data |
| `payload_hash` | TEXT | NOT NULL | SHA-256 of payload |
| `previous_hash` | TEXT | NULL | Previous entry hash (null for Genesis) |
| `entry_hash` | TEXT | NOT NULL | SHA-256 of entry |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Server timestamp |
| `schema_version` | TEXT | DEFAULT '1.0.0' | Canonical schema version |
| `producer_version` | TEXT | NULL | Producer service version |
| `occurred_at` | TIMESTAMPTZ | NULL | Client-reported timestamp |
| `signatures` | JSONB | NULL | Cryptographic signatures |
| `subject` | JSONB | NULL | Full subject object |
| `idempotency_key` | TEXT | NULL, UNIQUE (partial) | Client dedup key |
| `canonical_hash_hex` | TEXT | NULL | Canonical payload hash |

**Indices:**
- `idx_ledger_source` (source)
- `idx_ledger_event_type` (event_type)
- `idx_ledger_asset_id` (asset_id)
- `idx_ledger_anchor_id` (anchor_id)
- `idx_ledger_correlation_id` (correlation_id)
- `idx_ledger_created_at` (created_at)
- `idx_ledger_idempotency_key` (idempotency_key) WHERE NOT NULL

**Constraints:**
- `ledger_entries_sequence_unique` (sequence_number UNIQUE)
- `ledger_entries_event_id_unique` (id PRIMARY KEY)

**Triggers:**
- `enforce_ledger_immutability` (BEFORE UPDATE/DELETE) - WORM enforcement

**Status:** [SHIPPED]

---

**2. audit_log** (Access audit trail)

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Audit entry identifier |
| `action` | TEXT | NOT NULL | Action type |
| `actor_id` | TEXT | NULL | Who performed action |
| `resource_type` | TEXT | NOT NULL | What was accessed |
| `resource_id` | TEXT | NULL | Specific resource |
| `details` | JSONB | NULL | Additional context |
| `ip_address` | TEXT | NULL | Client IP |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Timestamp |

**Indices:**
- `idx_audit_action` (action)
- `idx_audit_actor` (actor_id)
- `idx_audit_created_at` (created_at)

**Triggers:**
- `enforce_audit_immutability` (BEFORE UPDATE/DELETE) - WORM enforcement

**Status:** [SHIPPED]

---

**3. integrity_checkpoints** (Verification snapshots)

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Checkpoint identifier |
| `checkpoint_sequence` | BIGINT | NOT NULL | Sequence at checkpoint |
| `checkpoint_hash` | TEXT | NOT NULL | Hash at checkpoint |
| `entries_count` | BIGINT | NOT NULL | Total entries |
| `verified_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Verification timestamp |
| `verified_by` | TEXT | NULL | Who verified |

**Status:** [SHIPPED]

---

## Configuration

### Required Environment Variables

| Variable | Purpose | Example | Validation |
|----------|---------|---------|------------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db?sslmode=require` | Must use SSL in production |
| `ADMIN_API_KEY` | Service auth key | `<64-char-random-key>` | Min 64 chars in production |
| `FIREBASE_PROJECT_ID` | Firebase project | `proveniq-prod-12345` | Non-empty string |
| `LEDGER_NETWORK_ID` | Network identifier | `proveniq-prod` | No "dev"/"test" in production |

**Status:** [SHIPPED]

---

### Optional Environment Variables

| Variable | Purpose | Default | Options |
|----------|---------|---------|---------|
| `NODE_ENV` | Runtime environment | `development` | `development`, `production`, `test` |
| `PORT` | Server port | `8006` | Numeric |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase service account path | None | File path (required in production) |
| `ALLOWED_ORIGINS` | CORS origins | None | Comma-separated URLs |
| `LOG_FORMAT` | Log format | `text` | `json`, `text` |

**Status:** [SHIPPED]

---

## Deployment

### Local Development

**Prerequisites:**
- Node.js 20+
- PostgreSQL 15+
- Firebase project (optional)

**Setup:**
```bash
cd backend
npm ci
cp .env.example .env
# Edit .env with local values
npm run dev
```

**Status:** [SHIPPED]

---

### Production Deployment (Railway)

**Platform:** Railway

**Build:** Dockerfile (multi-stage)

**Configuration:** `backend/railway.toml`

**Release Gate:**
1. Database migrations
2. Integrity verification (adaptive strategy)
3. Deployment proceeds only if both pass

**Health Check:** `GET /health` (10s timeout)

**Restart Policy:** ON_FAILURE (max 3 retries)

**Status:** [SHIPPED]

---

## Monitoring

### Health Check

**Endpoint:** `GET /health`

**Expected Response:** 200 OK

**Failure Conditions:**
- Server not responding
- Database connection failed
- Application crashed

---

### Metrics (Recommended)

**Write Metrics:**
- Event ingestion rate (events/sec)
- Write latency (p50, p95, p99)
- Error rate by status code
- Advisory lock wait time

**Read Metrics:**
- Query rate (queries/sec)
- Query latency (p50, p95, p99)
- Cache hit rate (if caching implemented)

**Integrity Metrics:**
- Hash chain status (valid/invalid)
- Verification duration
- Last verification timestamp

**Status:** [UNKNOWN - not implemented in code]

---

## Security

### Authentication

**Methods:**
1. **Firebase ID Token** (user-initiated requests)
2. **Admin API Key** (service-to-service)

**Enforcement:** Machine-Enforced (Hard) via middleware

**Status:** [SHIPPED]

---

### Authorization

**Model:** All authenticated principals have equal access

**No RBAC:** All authenticated users can read/write all events

**Status:** [SHIPPED]

---

### Data Protection

**At Rest:** Database-level encryption (platform-dependent)

**In Transit:**
- HTTPS/TLS (client → API)
- PostgreSQL SSL/TLS (API → database)

**Status:** [SHIPPED]

---

### Immutability

**Mechanism:** WORM triggers on `ledger_entries` and `audit_log`

**Enforcement:** Machine-Enforced (Hard) via PostgreSQL

**Status:** [SHIPPED]

---

## Performance Characteristics

### Write Throughput

**Concurrency:** Serialized (advisory lock)

**Estimated Throughput:** ~10-20 events/sec [UNKNOWN]

**Latency:** ~50-100ms p50 [UNKNOWN]

**Bottleneck:** Advisory lock serialization

---

### Read Throughput

**Concurrency:** Parallel (no locks)

**Estimated Throughput:** ~100-500 queries/sec [UNKNOWN]

**Latency:** ~10-50ms p50 [UNKNOWN]

**Optimization:** Use specific filters (asset_id, event_type)

---

## Operational Procedures

### Integrity Verification

**Frequency:** Monthly (production)

**Command:**
```bash
npm run verify-integrity
```

**Adaptive Strategy:**
- Full chain if < 1000 entries
- Last 1000 + sample 100 if >= 1000 entries

**Status:** [SHIPPED]

---

### Database Migrations

**Command:**
```bash
psql $DATABASE_URL -f migrations/001_immutability_constraints.sql
```

**Idempotency:** Safe to run multiple times

**Status:** [SHIPPED]

---

### Backup and Recovery

**Backup:** [UNKNOWN - not specified in code]

**Recovery:** Restore from backup + verify integrity

**Status:** [POLICY-ENFORCED]

---

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **No rate limiting** | DoS vulnerability | Add rate limiting middleware |
| **No request size limits** | Memory exhaustion | Add payload size limits |
| **No query timeouts** | Slow query DoS | Add query timeout |
| **Serialized writes** | Limited write throughput | Accept tradeoff for consistency |
| **No RBAC** | All authenticated users equal | Add role-based access control |
| **No event deletion** | Cannot comply with GDPR erasure | Do not store PII in payloads |

**Status:** [SHIPPED] (limitations documented)

---

## Support Resources

**Documentation:**
- [Architecture Overview](../platform/architecture-overview.md)
- [Security Model](../platform/security-model.md)
- [Integration Guide](../platform/ledger-integration.md)
- [Environments and Configuration](../platform/environments-and-configuration.md)
- [Proof of Integrity](../ledger/proof-of-integrity.md)
- [Immutability Guarantees](../ledger/immutability-guarantees.md)
- [Genesis Procedure](../ledger/genesis-procedure.md)

**Code:**
- GitHub: `github.com/terryholliday/proveniq-ledger`
- Commit: `4146303`

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
