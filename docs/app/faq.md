# PROVENIQ Memory (Ledger) - Frequently Asked Questions

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## General Questions

### What is PROVENIQ Memory (Ledger)?

PROVENIQ Memory is an immutable cryptographic event ledger for physical asset truth. It provides a tamper-proof record of all events related to physical assets across the PROVENIQ ecosystem.

**Key Characteristics:**
- Immutable (cannot modify or delete events)
- Cryptographically verified (SHA-256 hash chain)
- Append-only (write once, read many)
- Multi-service (12 producer services)

**Status:** [SHIPPED]

---

### Why is it called "Memory" in UI but "Ledger" in code?

**Branding Decision:** "Memory" is more intuitive for non-technical users than "Ledger"

**Usage:**
- **User-facing:** PROVENIQ Memory
- **Internal/code:** Ledger, `LEDGER_BASE_URL`, `proveniq-ledger`

**Status:** [POLICY-ENFORCED]

---

### What's the difference between Memory and Core?

| Aspect | Memory (Ledger) | Core |
|--------|-----------------|------|
| **Purpose** | Immutable event log | Asset intelligence engine |
| **Data** | Events (what happened) | Asset state (current value, fraud score) |
| **Mutability** | Immutable | Mutable (state updates) |
| **Technology** | Node.js + PostgreSQL | [UNKNOWN] |
| **Together** | **PROVENIQ Asset OS** | |

**Status:** [SHIPPED - Memory, UNKNOWN - Core]

---

## Architecture Questions

### How does the hash chain work?

**Mechanism:** Each entry contains a hash of the previous entry, creating an unbreakable chain

**Formula:**
```
entry_hash[n] = SHA256(
  payload_hash[n] |
  previous_hash[n] |  // = entry_hash[n-1]
  source |
  event_type |
  timestamp
)
```

**Properties:**
- Modifying any entry breaks all subsequent entries
- Genesis block has `previous_hash = null`
- Verification detects tampering

**Status:** [SHIPPED]

---

### Why use advisory locks instead of transactions?

**Problem:** Race condition in hash chain calculation

**Without Lock:**
```
Thread A reads latest (seq=100)
Thread B reads latest (seq=100)
Thread A inserts seq=101
Thread B inserts seq=102  ❌ FORK (both reference seq=100)
```

**With Advisory Lock:**
```
Thread A acquires lock
Thread A reads latest (seq=100)
Thread A inserts seq=101
Thread A releases lock
Thread B acquires lock
Thread B reads latest (seq=101)
Thread B inserts seq=102  ✅ VALID
```

**Status:** [SHIPPED]

---

### What happens if two services write simultaneously?

**Answer:** Advisory lock serializes writes - second service waits for first to complete

**Behavior:**
1. Service A acquires lock
2. Service B waits for lock
3. Service A completes write and releases lock
4. Service B acquires lock and writes

**Performance Impact:** ~10-20 events/sec throughput [UNKNOWN]

**Status:** [SHIPPED]

---

## Integration Questions

### How do I authenticate with the Ledger?

**Two Methods:**

**1. Firebase ID Token (User Requests):**
```javascript
const token = await user.getIdToken();
fetch('/api/v1/events/canonical', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**2. Admin API Key (Service-to-Service):**
```javascript
fetch('/api/v1/events/canonical', {
  headers: { 'x-api-key': process.env.LEDGER_API_KEY }
});
```

**Status:** [SHIPPED]

---

### What event types are supported?

**74 canonical event types** across 11 domains

**Format:** `DOMAIN_NOUN_VERB_PAST` (uppercase, underscores)

**Examples:**
- `ANCHOR_SEAL_BROKEN`
- `SERVICE_RECORD_CREATED`
- `TRANSIT_SHIPMENT_DELIVERED`
- `CLAIM_PAYOUT_APPROVED`

**Full List:** See `backend/src/ledger.events.ts`

**Status:** [SHIPPED]

---

### How do I add a new event type?

**Process:**
1. Add event type to `backend/src/ledger.events.ts`
2. Define Zod schema for payload
3. Add to `ALL_EVENT_TYPES` array
4. Deploy Ledger service
5. Producers can now use new event type

**Naming Rules:**
- All uppercase
- Underscore-separated
- Past tense verb
- Domain prefix

**Status:** [SHIPPED]

---

### Can I query events by payload fields?

**No** - Payload fields are not indexed

**Workaround:** Use indexed filters instead

**Indexed Filters:**
- `asset_id`
- `event_type`
- `source`
- `anchor_id`
- `correlation_id`
- `created_at`

**Status:** [SHIPPED]

---

### How do I handle duplicate submissions?

**Use Idempotency Keys:**

```javascript
const event = {
  // ... other fields
  idempotency_key: `${producer}:${event_type}:${resource_id}:${timestamp}`
};

// First submission: 201 Created
// Duplicate submission: 200 OK (same sequence_number)
```

**Behavior:**
- First submission creates entry
- Duplicate submissions return existing entry
- Safe to retry on network failures

**Status:** [SHIPPED]

---

### Can I batch write events?

**No** - Ledger does not support batch endpoints

**Workaround:** Use concurrent requests with rate limiting

```javascript
import pLimit from 'p-limit';

const limit = pLimit(10); // Max 10 concurrent
const promises = events.map(event =>
  limit(() => writeEvent(event))
);
await Promise.all(promises);
```

**Status:** [SHIPPED]

---

## Data Management Questions

### Can I delete events?

**No** - Events are immutable (WORM enforcement)

**Why:** Immutability is core to cryptographic integrity

**Alternative:** Create compensating events

```javascript
// Instead of deleting, create correction event
{
  event_type: "SERVICE_RECORD_CORRECTED",
  payload: {
    original_event_id: "uuid-of-wrong-event",
    reason: "Data entry error"
  }
}
```

**Status:** [SHIPPED]

---

### Can I modify events?

**No** - Events are immutable (WORM enforcement)

**Why:** Modification breaks hash chain

**Alternative:** Create superseding events

```javascript
{
  event_type: "SERVICE_RECORD_SUPERSEDED",
  payload: {
    superseded_event_id: "uuid-of-old-event",
    corrected_data: { ... }
  }
}
```

**Status:** [SHIPPED]

---

### What if I submit an event with wrong data?

**Options:**

**1. Compensating Event (Recommended):**
```javascript
{
  event_type: "DOMAIN_NOUN_CORRECTED",
  payload: {
    original_event_id: "uuid",
    corrected_field: "work_order_id",
    corrected_value: "correct-uuid"
  }
}
```

**2. Application-Level Filtering:**
- Mark event as "superseded" in application state
- Query logic filters superseded events
- Ledger entry remains unchanged

**3. Accept Error:**
- Document in audit log
- Use as learning opportunity

**Status:** [POLICY-ENFORCED]

---

### How long are events retained?

**Retention Policy:** Infinite (immutable by design)

**Implications:**
- Events cannot be deleted
- Database grows indefinitely
- No automatic archival

**Recommendation:** Do NOT store PII in event payloads

**Status:** [SHIPPED]

---

### Does the Ledger comply with GDPR "right to be forgotten"?

**No** - Events cannot be deleted

**Mitigation:**
- **Do NOT store PII in event payloads**
- Store PII in separate tables with foreign keys
- Delete PII from separate tables while preserving ledger events
- Ledger events reference deleted data via UUID (no PII exposure)

**Status:** [POLICY-ENFORCED]

---

## Performance Questions

### What is the write throughput?

**Estimated:** ~10-20 events/sec [UNKNOWN]

**Bottleneck:** Advisory lock serialization

**Optimization:** Use async writes with queue for non-critical events

**Status:** [UNKNOWN - not measured in production]

---

### What is the read throughput?

**Estimated:** ~100-500 queries/sec [UNKNOWN]

**Characteristics:**
- Parallel reads (no locks)
- Indexed queries are fast (~10-50ms)
- Large result sets are slower

**Optimization:**
- Use specific filters (asset_id, event_type)
- Limit result sets (max 1000)
- Cache frequently accessed events

**Status:** [UNKNOWN - not measured in production]

---

### Why are writes slow?

**Cause:** Advisory lock serializes all writes

**Tradeoff:** Consistency over throughput

**Rationale:**
- Hash chain integrity requires serialized writes
- Prevents chain forks
- Acceptable for event logging use case

**Status:** [SHIPPED]

---

### Can I improve query performance?

**Yes** - Use indexed filters

**Indexed Columns:**
- `asset_id`
- `event_type`
- `source`
- `anchor_id`
- `correlation_id`
- `created_at`

**Example:**
```javascript
// FAST: Uses idx_ledger_asset_id
fetch('/api/v1/events?asset_id=uuid');

// SLOW: Full table scan
fetch('/api/v1/events'); // No filters
```

**Status:** [SHIPPED]

---

## Security Questions

### How are credentials stored?

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `ADMIN_API_KEY` - Service authentication key
- `GOOGLE_APPLICATION_CREDENTIALS` - Firebase service account path

**Storage:**
- Development: `.env` file (gitignored)
- Production: Railway secrets (encrypted at rest)

**Never:** Committed to git, logged in application

**Status:** [SHIPPED]

---

### Can anyone read all events?

**No** - Authentication required

**Authorization Model:**
- All authenticated principals have equal access
- No row-level security
- No RBAC (role-based access control)

**Rationale:** Ledger is system of record, not access control system

**Status:** [SHIPPED]

---

### How do I rotate API keys?

**Procedure:**

1. Generate new key: `openssl rand -hex 32`
2. Add new key to Railway secrets as `ADMIN_API_KEY_NEW`
3. Update producers to use new key
4. Monitor for errors (24-48 hours)
5. Remove old key from Railway secrets
6. Update `ADMIN_API_KEY` to new value

**Status:** [POLICY-ENFORCED]

---

### What happens if someone bypasses WORM triggers?

**Scenario:** Database superuser disables trigger and modifies events

**Detection:** Integrity verification detects hash chain break

**Response:**
1. HALT ALL WRITES
2. ISOLATE DATABASE
3. INVESTIGATE (audit superuser actions)
4. RESTORE FROM BACKUP
5. RE-VERIFY INTEGRITY

**Prevention:**
- Restrict superuser access
- Audit superuser actions
- Run integrity verification regularly

**Status:** [POLICY-ENFORCED]

---

## Operational Questions

### How do I verify ledger integrity?

**Command:**
```bash
npm run verify-integrity
```

**Strategies:**
- Full chain (default)
- Last N entries (`--last 1000`)
- Random sample (`--sample 100`)

**Frequency:** Monthly (production)

**Status:** [SHIPPED]

---

### What if integrity verification fails?

**Immediate Actions:**
1. **HALT ALL WRITES** - Stop accepting new events
2. **ISOLATE DATABASE** - Prevent further modifications
3. **INVESTIGATE** - Identify corrupted entries
4. **RESTORE FROM BACKUP** - Use last known good backup
5. **RE-VERIFY** - Confirm restored chain is valid
6. **INCIDENT REPORT** - Document findings

**Status:** [POLICY-ENFORCED]

---

### How do I backup the Ledger?

**PostgreSQL Backup:**
```bash
# Full backup
pg_dump $DATABASE_URL > ledger-backup-$(date +%Y%m%d).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > ledger-backup-$(date +%Y%m%d).sql.gz
```

**Frequency:** Daily (minimum)

**Retention:** 30 days (minimum)

**Status:** [POLICY-ENFORCED]

---

### How do I restore from backup?

**Procedure:**
```bash
# Stop application
railway down

# Restore database
psql $DATABASE_URL < ledger-backup-2024-12-29.sql

# Verify integrity
npm run verify-integrity

# Start application (if verification passes)
railway up
```

**Status:** [POLICY-ENFORCED]

---

### Can I run multiple Ledger instances?

**No** - Single instance per network

**Reason:** Advisory lock requires single PostgreSQL instance

**Workaround:** Use separate databases for separate networks
- `proveniq-prod` (production)
- `proveniq-staging` (staging)
- `proveniq-dev` (development)

**Status:** [SHIPPED]

---

## Troubleshooting Questions

### Why is my event submission failing?

**Common Causes:**

1. **Authentication Failed (401)** - Check API key or Firebase token
2. **Schema Validation Failed (400)** - Review error details
3. **Invalid Event Type (400)** - Use registered event type
4. **Database Connection Failed (500)** - Check DATABASE_URL

**Diagnosis:** Review error response `details` array

**Status:** [SHIPPED]

---

### Why can't I query by payload fields?

**Reason:** Payload fields are not indexed

**Workaround:** Use indexed filters

**Indexed:**
- `asset_id`
- `event_type`
- `source`
- `anchor_id`
- `correlation_id`
- `created_at`

**Status:** [SHIPPED]

---

### Why is the application not starting?

**Common Causes:**

1. **Missing Environment Variables** - Check `.env` file
2. **Invalid DATABASE_URL** - Verify connection string
3. **API Key Too Short (Production)** - Must be 64+ characters
4. **Database SSL Not Configured (Production)** - Add `?sslmode=require`

**Diagnosis:**
```bash
npm run build
node -r dotenv/config dist/config/env-validation.js
```

**Status:** [SHIPPED]

---

## Advanced Questions

### Can I use the Ledger for non-PROVENIQ events?

**No** - Ledger is PROVENIQ-specific

**Reason:**
- Producer enum is locked to PROVENIQ services
- Event types are domain-specific
- Schema is optimized for physical asset events

**Status:** [SHIPPED]

---

### Can I export events to another system?

**Yes** - Query events via API and export

**Example:**
```javascript
// Fetch all events for asset
const response = await fetch(`/api/v1/events?asset_id=uuid&limit=1000`);
const { events } = await response.json();

// Export to JSON
fs.writeFileSync('events.json', JSON.stringify(events, null, 2));
```

**Status:** [SHIPPED]

---

### Can I replay events from backup?

**No** - Events have unique sequence numbers

**Reason:**
- Sequence numbers are auto-incremented
- Cannot insert with specific sequence number
- Would break hash chain

**Alternative:** Restore entire database from backup

**Status:** [SHIPPED]

---

### What is the maximum event payload size?

**Limit:** [UNKNOWN - not enforced in code]

**Recommendation:** Keep payloads small (< 1 MB)

**Reason:**
- Large payloads slow down queries
- Increase database storage
- Slow hash calculation

**Status:** [UNKNOWN - no size limit configured]

---

### Can I add custom metadata to events?

**Yes** - Use `payload` field

**Example:**
```javascript
{
  event_type: "SERVICE_RECORD_CREATED",
  payload: {
    // Standard fields
    work_order_id: "uuid",
    parts_replaced: ["brake_pads"],
    
    // Custom metadata
    technician_notes: "Customer reported squeaking",
    warranty_months: 12,
    custom_field: "custom_value"
  }
}
```

**Validation:** Payload schema depends on event type

**Status:** [SHIPPED]

---

## Migration Questions

### How do I migrate from legacy to canonical events?

**Steps:**

1. Add required fields to legacy events
2. Calculate `canonical_hash_hex`
3. Submit to canonical endpoint
4. Monitor for errors
5. Deprecate legacy endpoint

**See:** [Integration Guide](../platform/ledger-integration.md#migration-guide)

**Status:** [SHIPPED]

---

### Can I migrate events between networks?

**No** - Events are network-specific

**Reason:**
- Different `LEDGER_NETWORK_ID` values
- Different Genesis blocks
- Different hash chains

**Alternative:** Export/import via API (loses sequence continuity)

**Status:** [POLICY-ENFORCED]

---

## Support Questions

### Where can I find more documentation?

**Documentation:**
- [README](README.md) - Application overview
- [Architecture Overview](../platform/architecture-overview.md)
- [Security Model](../platform/security-model.md)
- [Integration Guide](../platform/ledger-integration.md)
- [Environments and Configuration](../platform/environments-and-configuration.md)
- [Proof of Integrity](../ledger/proof-of-integrity.md)
- [Immutability Guarantees](../ledger/immutability-guarantees.md)
- [Genesis Procedure](../ledger/genesis-procedure.md)
- [Data Dictionary](data-dictionary.md)
- [Workflows](workflows.md)
- [Troubleshooting](troubleshooting.md)

**Status:** [SHIPPED]

---

### Where is the source code?

**GitHub:** `github.com/terryholliday/proveniq-ledger`

**Commit:** `4146303`

**Key Files:**
- `backend/src/server.ts` - API routes
- `backend/src/ingest/canonical.ts` - Canonical ingestion
- `backend/src/ledger.events.ts` - Event schema
- `backend/src/verify-integrity.ts` - Integrity verification
- `backend/src/config/env-validation.ts` - Environment validation

**Status:** [SHIPPED]

---

### How do I report a bug?

**Process:**

1. Check [Troubleshooting Guide](troubleshooting.md)
2. Review [GitHub Issues](https://github.com/terryholliday/proveniq-ledger/issues)
3. Create new issue with:
   - Description of problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (dev/staging/production)
   - Logs (if applicable)

**Status:** [POLICY-ENFORCED]

---

### Who maintains the Ledger?

**Owner:** PROVENIQ Technologies

**Contact:** intuitive.terry@gmail.com

**Repository:** github.com/terryholliday/proveniq-ledger

**Status:** [SHIPPED]

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
