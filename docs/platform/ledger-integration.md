# PROVENIQ Memory (Ledger) - Integration Guide

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Executive Summary

This guide provides technical instructions for integrating PROVENIQ services as event producers to the Ledger. It covers authentication setup, event schema compliance, API integration patterns, and error handling.

**Target Audience:** Backend engineers integrating PROVENIQ services with the Ledger

---

## Producer Onboarding

### Prerequisites

Before integrating with the Ledger, ensure:

1. **Service Identity Registered:** Your service is listed in the `Producer` enum
2. **Authentication Configured:** Firebase credentials OR Admin API Key
3. **Network Access:** HTTPS connectivity to Ledger service
4. **Schema Compliance:** Events conform to canonical envelope v1.0.0

---

### Valid Producers

**Source:** `backend/src/ledger.events.ts`

```typescript
export const Producer = z.enum([
  'anchors-ingest',
  'service',
  'transit',
  'protect',
  'claimsiq',
  'capital',
  'bids',
  'ops',
  'properties',
  'home',
  'origins',
  'core',
]);
```

**Status:** [SHIPPED]

**Adding New Producers:** Requires code change to `backend/src/ledger.events.ts` and redeployment

---

## Authentication Setup

### Option 1: Firebase ID Token (Recommended)

**Use Case:** User-initiated requests, frontend integrations

**Setup:**
```typescript
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

// Get ID token for current user
const user = admin.auth().currentUser;
const idToken = await user.getIdToken();

// Make request
const response = await fetch('https://ledger.proveniq.io/api/v1/events/canonical', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(event),
});
```

**Token Characteristics:**
- **Expiry:** 1 hour (Firebase default)
- **Refresh:** Automatic via Firebase SDK
- **Validation:** Server-side via `admin.auth().verifyIdToken()`

---

### Option 2: Admin API Key (Service-to-Service)

**Use Case:** Backend service integrations, scheduled jobs

**Setup:**
```typescript
// Store in environment variable
const LEDGER_API_KEY = process.env.LEDGER_API_KEY;

// Make request
const response = await fetch('https://ledger.proveniq.io/api/v1/events/canonical', {
  method: 'POST',
  headers: {
    'x-api-key': LEDGER_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(event),
});
```

**Key Management:**
- **Storage:** Environment variables (never commit to git)
- **Rotation:** Manual (coordinate with Ledger team)
- **Length:** 64+ characters in production
- **Scope:** Full read/write access to Ledger

---

## Event Schema Compliance

### Canonical Event Envelope

**Schema Version:** 1.0.0 [LOCKED]

**Source:** `backend/src/ledger.events.ts`

```typescript
{
  schema_version: "1.0.0",                    // REQUIRED - Must be "1.0.0"
  event_type: "DOMAIN_NOUN_VERB_PAST",        // REQUIRED - Registered event type
  occurred_at: "2024-12-29T12:00:00Z",        // REQUIRED - ISO 8601 timestamp
  correlation_id: "uuid-v4",                  // REQUIRED - UUID for event correlation
  idempotency_key: "unique-string",           // REQUIRED - Client-provided dedup key
  producer: "service-name",                   // REQUIRED - From Producer enum
  producer_version: "1.0.0",                  // REQUIRED - Semantic version
  subject: {                                  // REQUIRED - Event subject
    asset_id: "uuid-v4",                      // REQUIRED - PROVENIQ Asset ID
    anchor_id?: "string",                     // OPTIONAL - Anchor device ID
    shipment_id?: "uuid-v4",                  // OPTIONAL - Transit shipment
    policy_id?: "uuid-v4",                    // OPTIONAL - Insurance policy
    claim_id?: "uuid-v4",                     // OPTIONAL - ClaimsIQ claim
    auction_id?: "uuid-v4",                   // OPTIONAL - Bids auction
    work_order_id?: "uuid-v4",                // OPTIONAL - Service work order
    inspection_id?: "uuid-v4",                // OPTIONAL - Properties inspection
    lease_id?: "uuid-v4",                     // OPTIONAL - Properties lease
    loan_id?: "uuid-v4",                      // OPTIONAL - Capital loan
    seal_id?: "string"                        // OPTIONAL - Anchor seal ID
  },
  payload: {                                  // REQUIRED - Event-specific data
    // Domain-specific fields
  },
  canonical_hash_hex: "sha256-hex",           // REQUIRED - SHA-256 of payload
  signatures?: {                              // OPTIONAL - Cryptographic signatures
    device_sig?: "ed25519-hex",               // OPTIONAL - Device signature
    provider_sig?: "ed25519-hex"              // OPTIONAL - Provider signature
  }
}
```

**Field Validation:**
- `schema_version` must be literal `"1.0.0"`
- `event_type` must match regex `^[A-Z]+(_[A-Z]+)+$`
- `occurred_at` must be ISO 8601 datetime
- `correlation_id` must be valid UUID
- `idempotency_key` must be 1-256 characters
- `producer` must be in Producer enum
- `producer_version` must match semver regex `^\d+\.\d+\.\d+$`
- `subject.asset_id` must be valid UUID
- `canonical_hash_hex` must be 64-character hex string (SHA-256)

---

### Event Naming Convention

**Format:** `DOMAIN_NOUN_VERB_PAST`

**Rules:**
1. All uppercase
2. Underscore-separated
3. Past tense verb (events are facts, not commands)
4. Domain prefix identifies producing service

**Valid Examples:**
```
ANCHOR_SEAL_BROKEN
SERVICE_RECORD_CREATED
TRANSIT_SHIPMENT_DELIVERED
CLAIM_PAYOUT_AUTHORIZED
CAPITAL_LOAN_DISBURSED
BIDS_AUCTION_SETTLED
OPS_SCAN_COMPLETED
PROPERTIES_INSPECTION_SIGNED
HOME_ASSET_REGISTERED
CORE_OWNERSHIP_TRANSFERRED
```

**Invalid Examples:**
```
❌ BREAK_ANCHOR_SEAL          (command, not fact)
❌ service_record_created      (lowercase)
❌ SERVICE-RECORD-CREATED      (hyphens)
❌ SERVICE_RECORD_CREATE       (present tense)
❌ RECORD_CREATED              (missing domain)
```

---

### Payload Hash Calculation

**Algorithm:** SHA-256 with deterministic key ordering

**Implementation:**
```typescript
import { createHash } from 'crypto';

function hashPayload(payload: Record<string, unknown>): string {
  // Sort keys for deterministic serialization
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}
```

**Critical:** Key ordering MUST be deterministic for hash reproducibility

**Example:**
```typescript
const payload = {
  work_order_id: "123e4567-e89b-12d3-a456-426614174000",
  parts_replaced: ["brake_pads", "rotors"],
  labor_hours: 2.5,
  cost_cents: 35000
};

const hash = hashPayload(payload);
// "a1b2c3d4e5f6..." (64-character hex string)
```

---

## API Integration Patterns

### Pattern 1: Synchronous Write

**Use Case:** Critical events requiring immediate confirmation

```typescript
async function writeEventSync(event: LedgerEvent): Promise<void> {
  const response = await fetch(`${LEDGER_BASE_URL}/api/v1/events/canonical`, {
    method: 'POST',
    headers: {
      'x-api-key': LEDGER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Ledger write failed: ${error.message}`);
  }

  const result = await response.json();
  console.log(`Event committed: seq=${result.sequence_number}, hash=${result.entry_hash}`);
}
```

**Characteristics:**
- Blocks until Ledger confirms write
- Throws error on failure
- Returns sequence number and entry hash

---

### Pattern 2: Async Write with Retry

**Use Case:** Non-critical events, high-volume writes

```typescript
import { Queue } from 'bull';

const ledgerQueue = new Queue('ledger-events', {
  redis: { host: 'localhost', port: 6379 }
});

// Enqueue event
async function writeEventAsync(event: LedgerEvent): Promise<void> {
  await ledgerQueue.add('write', event, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });
}

// Process queue
ledgerQueue.process('write', async (job) => {
  const event = job.data;
  const response = await fetch(`${LEDGER_BASE_URL}/api/v1/events/canonical`, {
    method: 'POST',
    headers: {
      'x-api-key': LEDGER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Ledger write failed: ${response.status}`);
  }

  return await response.json();
});
```

**Characteristics:**
- Non-blocking (returns immediately)
- Automatic retry on failure (3 attempts)
- Exponential backoff (2s, 4s, 8s)

---

### Pattern 3: Batch Write

**Use Case:** High-volume event ingestion

**Note:** Ledger does NOT support batch endpoints. Use concurrent requests with rate limiting.

```typescript
import pLimit from 'p-limit';

const limit = pLimit(10); // Max 10 concurrent requests

async function writeBatch(events: LedgerEvent[]): Promise<void> {
  const promises = events.map(event =>
    limit(() => writeEventSync(event))
  );

  await Promise.all(promises);
}
```

**Characteristics:**
- Concurrent writes (limited to 10)
- Fails fast on first error
- No transaction semantics (partial success possible)

---

## Idempotency Strategy

### Client-Provided Idempotency Key

**Purpose:** Prevent duplicate event ingestion on retry

**Implementation:**
```typescript
import { v4 as uuidv4 } from 'uuid';

function generateIdempotencyKey(
  producer: string,
  eventType: string,
  resourceId: string,
  timestamp: string
): string {
  // Deterministic key based on business logic
  return `${producer}:${eventType}:${resourceId}:${timestamp}`;
}

const event = {
  // ... other fields
  idempotency_key: generateIdempotencyKey(
    'service',
    'SERVICE_RECORD_CREATED',
    workOrderId,
    occurredAt
  ),
};
```

**Behavior:**
- First submission: 201 Created, `idempotent: false`
- Duplicate submission: 200 OK, `idempotent: true`
- Same `sequence_number` and `entry_hash` returned

**Best Practices:**
- Use deterministic keys (not random UUIDs)
- Include resource ID and timestamp
- Max 256 characters
- Avoid PII in idempotency keys

---

## Error Handling

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| **200 OK** | Event already exists (idempotent) | No action needed |
| **201 Created** | Event successfully created | Success |
| **400 Bad Request** | Schema validation failed | Fix event schema |
| **401 Unauthorized** | Authentication failed | Check credentials |
| **500 Internal Server Error** | Ledger error | Retry with backoff |
| **503 Service Unavailable** | Ledger unavailable | Retry with backoff |

---

### Error Response Format

```json
{
  "error": "CANONICAL_SCHEMA_VIOLATION",
  "message": "Event does not match canonical envelope schema (Input)",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "number",
      "path": ["occurred_at"],
      "message": "Expected string, received number"
    }
  ],
  "schema_version": "1.0.0"
}
```

---

### Common Errors

#### 1. Invalid Event Type

**Error:**
```json
{
  "error": "INVALID_EVENT_TYPE",
  "message": "Event type 'SERVICE_RECORD_CREATE' is not a valid canonical event type.",
  "schema_version": "1.0.0"
}
```

**Cause:** Event type not registered in `ALL_EVENT_TYPES`

**Resolution:** Use correct event type or register new type

---

#### 2. Schema Version Mismatch

**Error:**
```json
{
  "error": "UNSUPPORTED_SCHEMA_VERSION",
  "message": "Schema version '2.0.0' is not supported. Expected: '1.0.0'."
}
```

**Cause:** Using unsupported schema version

**Resolution:** Use schema version `1.0.0`

---

#### 3. Missing Required Field

**Error:**
```json
{
  "error": "CANONICAL_SCHEMA_VIOLATION",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["subject", "asset_id"],
      "message": "Required"
    }
  ]
}
```

**Cause:** Missing `subject.asset_id`

**Resolution:** Include all required fields

---

## Query Integration

### Basic Query

```typescript
async function queryEvents(filters: {
  asset_id?: string;
  event_type?: string;
  from_date?: string;
  limit?: number;
}): Promise<LedgerEntry[]> {
  const params = new URLSearchParams();
  
  if (filters.asset_id) params.append('asset_id', filters.asset_id);
  if (filters.event_type) params.append('event_type', filters.event_type);
  if (filters.from_date) params.append('from_date', filters.from_date);
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(
    `${LEDGER_BASE_URL}/api/v1/events?${params}`,
    {
      headers: { 'x-api-key': LEDGER_API_KEY }
    }
  );

  if (!response.ok) {
    throw new Error(`Query failed: ${response.status}`);
  }

  const data = await response.json();
  return data.events;
}
```

---

### Pagination

```typescript
async function queryAllEvents(asset_id: string): Promise<LedgerEntry[]> {
  const allEvents: LedgerEntry[] = [];
  let offset = 0;
  const limit = 1000; // Max allowed

  while (true) {
    const params = new URLSearchParams({
      asset_id,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await fetch(
      `${LEDGER_BASE_URL}/api/v1/events?${params}`,
      { headers: { 'x-api-key': LEDGER_API_KEY } }
    );

    const data = await response.json();
    allEvents.push(...data.events);

    if (data.events.length < limit) break; // Last page
    offset += limit;
  }

  return allEvents;
}
```

---

## Testing Integration

### Local Development

**Ledger URL:** `http://localhost:8006`

**Setup:**
```bash
cd backend
npm ci
npm run dev
```

**Test Event Submission:**
```bash
curl -X POST http://localhost:8006/api/v1/events/canonical \
  -H "x-api-key: dev_admin_key_at_least_32_characters_long" \
  -H "Content-Type: application/json" \
  -d @test-event.json
```

---

### Integration Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('Ledger Integration', () => {
  it('should write event successfully', async () => {
    const event = {
      schema_version: '1.0.0',
      event_type: 'SERVICE_RECORD_CREATED',
      occurred_at: new Date().toISOString(),
      correlation_id: uuidv4(),
      idempotency_key: `test-${Date.now()}`,
      producer: 'service',
      producer_version: '1.0.0',
      subject: { asset_id: uuidv4() },
      payload: { test: true },
      canonical_hash_hex: hashPayload({ test: true }),
    };

    const result = await writeEventSync(event);
    
    expect(result.sequence_number).toBeGreaterThan(0);
    expect(result.entry_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle duplicate events idempotently', async () => {
    const event = { /* ... */ };
    
    const result1 = await writeEventSync(event);
    const result2 = await writeEventSync(event);
    
    expect(result1.sequence_number).toBe(result2.sequence_number);
    expect(result2.idempotent).toBe(true);
  });
});
```

---

## Performance Considerations

### Write Throughput

**Characteristics:**
- Serialized writes (advisory lock)
- ~10-20 events/sec [UNKNOWN]
- Latency: ~50-100ms p50 [UNKNOWN]

**Optimization:**
- Use async writes for non-critical events
- Batch concurrent requests (max 10)
- Implement client-side queuing

---

### Query Performance

**Characteristics:**
- Parallel reads (no locks)
- ~100-500 queries/sec [UNKNOWN]
- Latency: ~10-50ms p50 [UNKNOWN]

**Optimization:**
- Use specific filters (asset_id, event_type)
- Limit result sets (max 1000)
- Cache frequently accessed events

---

## Monitoring and Observability

### Metrics to Track

**Producer-Side:**
- Event submission rate (events/sec)
- Event submission latency (p50, p95, p99)
- Error rate by status code
- Retry count
- Queue depth (if using async pattern)

**Ledger-Side:**
- Sequence number progression
- Hash chain integrity status
- Audit log growth rate

---

### Alerting Thresholds

**Critical:**
- Error rate > 5% for 5 minutes
- Ledger unavailable (503) for 1 minute
- Hash chain integrity failure

**Warning:**
- Latency p95 > 500ms for 10 minutes
- Queue depth > 1000 events

---

## Migration Guide

### From Legacy to Canonical

**Legacy Endpoint:** `POST /api/v1/events`

**Canonical Endpoint:** `POST /api/v1/events/canonical`

**Migration Steps:**

1. **Add Required Fields:**
   - `schema_version: "1.0.0"`
   - `producer_version: "1.0.0"`
   - `subject: { asset_id, ... }`
   - `canonical_hash_hex`
   - `signatures` (optional)

2. **Update Event Types:**
   - Convert to `DOMAIN_NOUN_VERB_PAST` format
   - Register new event types if needed

3. **Calculate Payload Hash:**
   ```typescript
   const canonical_hash_hex = hashPayload(event.payload);
   ```

4. **Test in Staging:**
   - Verify schema validation passes
   - Confirm idempotency works
   - Check hash chain integrity

5. **Deploy to Production:**
   - Monitor error rates
   - Verify events appear in Ledger
   - Run integrity verification

---

## Support and Resources

### Documentation
- [Architecture Overview](architecture-overview.md)
- [Security Model](security-model.md)
- [Data Dictionary](../app/data-dictionary.md)
- [Troubleshooting](../app/troubleshooting.md)

### Code Examples
- `backend/src/ledger.events.ts` - Event schema definitions
- `backend/src/ingest/canonical.ts` - Canonical ingestion logic
- `backend/src/hash.ts` - Hash calculation utilities

### Contact
- **Technical Issues:** Check [Troubleshooting](../app/troubleshooting.md)
- **Schema Questions:** Review `backend/src/ledger.events.ts`
- **Integration Support:** Consult this guide

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
