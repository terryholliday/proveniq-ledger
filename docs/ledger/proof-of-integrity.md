# PROVENIQ Memory (Ledger) - Proof of Integrity

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Executive Summary

This document provides procedures for **external verification** of PROVENIQ Memory (Ledger) integrity. These procedures can be executed by auditors, compliance officers, or technical customers **without platform access** using only the verification script and database read access.

**Verification Goal:** Cryptographically prove that the ledger chain is intact, unmodified, and correctly linked from Genesis to Head.

---

## Verification Overview

### What Is Verified

| Check | Purpose | Detection |
|-------|---------|-----------|
| **Payload Hash** | Verify payload has not been tampered with | Detects payload modification |
| **Entry Hash** | Verify entry metadata has not been tampered with | Detects metadata modification |
| **Chain Linkage** | Verify each entry links to previous entry | Detects chain breaks, forks |
| **Sequence Continuity** | Verify no gaps in sequence numbers | Detects missing entries |

**Status:** [SHIPPED]

---

### What Is NOT Verified

| Limitation | Reason |
|------------|--------|
| **Event Authenticity** | Verification script does not validate producer signatures |
| **Business Logic** | Verification script does not validate event semantics |
| **Timestamp Accuracy** | Verification script does not validate `occurred_at` or `committed_at` |
| **Database Constraints** | Verification script does not check WORM triggers (requires database admin) |

---

## Verification Procedure

### Prerequisites

**Required:**
- Node.js 20+
- PostgreSQL client (`psql`)
- Read access to `ledger_entries` table
- `DATABASE_URL` environment variable

**Optional:**
- Write access to `integrity_checkpoints` table (for checkpoint creation)

---

### Step 1: Clone Repository

```bash
git clone https://github.com/terryholliday/proveniq-ledger.git
cd proveniq-ledger/backend
```

**Verification:**
```bash
git rev-parse --short HEAD
# Should output: 4146303 (or later)
```

---

### Step 2: Install Dependencies

```bash
npm ci
```

**Verification:**
```bash
npm list --depth=0
# Should show: pg@8.13.0, zod@3.24.1, dotenv@16.5.0, etc.
```

---

### Step 3: Configure Database Access

```bash
# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://readonly_user:password@host:5432/proveniq_ledger?sslmode=require
EOF
```

**Security Notes:**
- Use read-only database credentials
- Ensure SSL/TLS is enabled (`?sslmode=require`)
- Never commit `.env` to git

---

### Step 4: Build Verification Script

```bash
npm run build
```

**Verification:**
```bash
ls dist/verify-integrity.js
# Should exist
```

---

### Step 5: Run Verification

#### Full Chain Verification

**Use Case:** Small ledgers (< 1000 entries) or initial verification

```bash
npm run verify-integrity
```

**Expected Output (Valid Chain):**
```
🔍 PROVENIQ Memory - Integrity Verification
════════════════════════════════════════════════════════════
📊 Strategy: Full chain verification (Genesis → Head)
📦 Entries to verify: 12345
📍 Range: seq 0 → 12345

✓ 12345 verified...

════════════════════════════════════════════════════════════
📊 VERIFICATION SUMMARY
════════════════════════════════════════════════════════════
Entries verified: 12345/12345
Errors found: 0
Duration: 5432ms

✅ CHAIN INTEGRITY VERIFIED
   All entries are cryptographically valid.
   Hash chain is continuous and unbroken.
```

**Exit Code:** `0` (success)

---

#### Last N Entries Verification

**Use Case:** Large ledgers (>= 1000 entries), recent activity verification

```bash
npm run verify-integrity -- --last 1000
```

**Expected Output:**
```
📊 Strategy: Verify last 1000 entries
📦 Entries to verify: 1000
📍 Range: seq 11346 → 12345

✓ 1000 verified...

════════════════════════════════════════════════════════════
Entries verified: 1000/1000
Errors found: 0
Duration: 1234ms

✅ CHAIN INTEGRITY VERIFIED
```

**Exit Code:** `0` (success)

---

#### Random Sample Verification

**Use Case:** Statistical verification, performance testing

```bash
npm run verify-integrity -- --sample 100
```

**Expected Output:**
```
📊 Strategy: Random sample of 100 entries
📦 Entries to verify: 100
📍 Range: seq 42 → 12298 (random)

✓ 100 verified...

════════════════════════════════════════════════════════════
Entries verified: 100/100
Errors found: 0
Duration: 234ms

✅ CHAIN INTEGRITY VERIFIED
```

**Exit Code:** `0` (success)

---

### Step 6: Interpret Results

#### Success Scenario

**Output:**
```
✅ CHAIN INTEGRITY VERIFIED
   All entries are cryptographically valid.
   Hash chain is continuous and unbroken.
```

**Exit Code:** `0`

**Interpretation:** The ledger chain is intact and has not been tampered with.

**Next Steps:**
- Document verification timestamp
- Store verification output for audit trail
- Schedule next verification (recommended: monthly)

---

#### Failure Scenario

**Output:**
```
❌ CHAIN INTEGRITY VIOLATION DETECTED

Error breakdown:
   payload_hash_mismatch: 1
   chain_break: 2

⚠️  THE LEDGER CANNOT BE TRUSTED IN THIS STATE
   Do not deploy or accept new writes until integrity is restored.
```

**Exit Code:** `1`

**Interpretation:** The ledger chain has been compromised.

**Immediate Actions:**
1. **HALT ALL WRITES** - Stop accepting new events
2. **ISOLATE DATABASE** - Prevent further modifications
3. **INVESTIGATE** - Identify which entries are corrupted
4. **RESTORE FROM BACKUP** - Use last known good backup
5. **RE-VERIFY** - Confirm restored chain is valid
6. **INCIDENT REPORT** - Document findings and remediation

---

## Verification Algorithms

### Payload Hash Verification

**Source:** `backend/src/verify-integrity.ts`

```typescript
function verifyPayloadHash(entry: LedgerEntry): boolean {
  // Recompute hash with deterministic key ordering
  const canonical = JSON.stringify(
    entry.payload,
    Object.keys(entry.payload).sort()
  );
  const expectedHash = createHash('sha256')
    .update(canonical)
    .digest('hex');
  
  return expectedHash === entry.payload_hash;
}
```

**Algorithm:** SHA-256 with sorted JSON keys

**Detects:**
- Payload field modification
- Payload field addition/removal
- Payload value changes

---

### Entry Hash Verification

**Source:** `backend/src/verify-integrity.ts`

```typescript
function verifyEntryHash(entry: LedgerEntry): boolean {
  const data = `${entry.payload_hash}|${entry.previous_hash || 'GENESIS'}|${entry.source}|${entry.event_type}|${entry.created_at}`;
  
  const expectedHash = createHash('sha256')
    .update(data)
    .digest('hex');
  
  return expectedHash === entry.entry_hash;
}
```

**Algorithm:** SHA-256 of concatenated fields

**Detects:**
- Metadata modification (source, event_type, created_at)
- Hash linkage tampering
- Entry hash recomputation

---

### Chain Linkage Verification

**Source:** `backend/src/verify-integrity.ts`

```typescript
function verifyChainLink(
  currentEntry: LedgerEntry,
  previousEntry: LedgerEntry | null
): boolean {
  if (previousEntry === null) {
    // Genesis block - previous_hash should be null
    return currentEntry.previous_hash === null;
  }
  
  // Non-genesis - previous_hash should match previous entry's entry_hash
  return currentEntry.previous_hash === previousEntry.entry_hash;
}
```

**Detects:**
- Chain breaks (missing link)
- Chain forks (multiple valid chains)
- Genesis block violations

---

### Sequence Continuity Verification

**Source:** `backend/src/verify-integrity.ts`

```typescript
function verifySequenceContinuity(
  currentEntry: LedgerEntry,
  previousEntry: LedgerEntry | null
): boolean {
  if (previousEntry === null) {
    // Genesis block - sequence should be 0
    return currentEntry.sequence_number === 0;
  }
  
  // Non-genesis - sequence should be previous + 1
  return currentEntry.sequence_number === previousEntry.sequence_number + 1;
}
```

**Detects:**
- Sequence gaps (missing entries)
- Sequence duplicates (replay attacks)
- Sequence reordering

---

## Hash Chain Visualization

```mermaid
flowchart LR
    G[Genesis Block<br/>seq=0<br/>prev_hash=null<br/>entry_hash=hash_0]
    B1[Block 1<br/>seq=1<br/>prev_hash=hash_0<br/>entry_hash=hash_1]
    B2[Block 2<br/>seq=2<br/>prev_hash=hash_1<br/>entry_hash=hash_2]
    B3[Block 3<br/>seq=3<br/>prev_hash=hash_2<br/>entry_hash=hash_3]
    
    G -->|Verify: prev_hash=null| G
    G -->|Link| B1
    B1 -->|Verify: prev_hash=hash_0| B1
    B1 -->|Link| B2
    B2 -->|Verify: prev_hash=hash_1| B2
    B2 -->|Link| B3
    B3 -->|Verify: prev_hash=hash_2| B3
    
    style G fill:#ff9,stroke:#333,stroke-width:3px
    style B1 fill:#9f9,stroke:#333
    style B2 fill:#9f9,stroke:#333
    style B3 fill:#9f9,stroke:#333
```

**Verification Flow:**
1. Start at Genesis (seq=0, prev_hash=null)
2. Verify Genesis payload_hash and entry_hash
3. Move to next entry (seq=1)
4. Verify prev_hash matches previous entry_hash
5. Verify payload_hash and entry_hash
6. Repeat until Head

---

## Verification Frequency

### Recommended Schedule

| Environment | Frequency | Strategy |
|-------------|-----------|----------|
| **Production** | Monthly | Full chain (if < 10K entries) OR Last 1000 + Sample 100 |
| **Staging** | Weekly | Last 500 |
| **Development** | On-demand | Full chain |

---

### Trigger Events

**Immediate Verification Required:**
- After database restore from backup
- After database migration
- After suspected security incident
- Before production deployment (release gate)
- After platform upgrade

---

## Verification Artifacts

### Verification Report

**Generate verification report:**

```bash
npm run verify-integrity > verification-report-$(date +%Y%m%d).txt
```

**Report Contents:**
- Verification timestamp
- Strategy used (full, last N, sample)
- Entry count and range
- Error count and details
- Duration
- Exit code

**Storage:** Retain for audit trail (minimum 7 years for compliance)

---

### Integrity Checkpoints

**Purpose:** Periodic snapshots of ledger state for faster verification

**Table:** `integrity_checkpoints`

**Schema:**
```sql
CREATE TABLE integrity_checkpoints (
  id UUID PRIMARY KEY,
  checkpoint_sequence BIGINT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  entries_count BIGINT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by TEXT
);
```

**Status:** [SHIPPED]

**Usage:** [UNKNOWN - not implemented in verification script]

---

## Troubleshooting Verification

### Error: Database Connection Failed

**Symptom:**
```
❌ Verification failed with error:
Error: connect ECONNREFUSED
```

**Causes:**
- Incorrect `DATABASE_URL`
- Database not accessible
- SSL/TLS not configured

**Resolution:**
```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT 1"
```

---

### Error: Permission Denied

**Symptom:**
```
❌ Verification failed with error:
Error: permission denied for table ledger_entries
```

**Causes:**
- Database user lacks SELECT permission

**Resolution:**
```sql
-- Grant read access
GRANT SELECT ON ledger_entries TO readonly_user;
```

---

### Error: Out of Memory

**Symptom:**
```
❌ Verification failed with error:
JavaScript heap out of memory
```

**Causes:**
- Large ledger (> 100K entries)
- Full chain verification

**Resolution:**
```bash
# Use last N strategy instead
npm run verify-integrity -- --last 1000

# Or increase Node.js memory
NODE_OPTIONS=--max-old-space-size=4096 npm run verify-integrity
```

---

## External Verification (No Platform Access)

### Standalone Verification

**Use Case:** Auditor with database access but no platform access

**Requirements:**
- PostgreSQL client
- Node.js 20+
- Read-only database credentials

**Procedure:**

1. **Clone repository:**
   ```bash
   git clone https://github.com/terryholliday/proveniq-ledger.git
   cd proveniq-ledger/backend
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Configure database:**
   ```bash
   export DATABASE_URL="postgresql://readonly:pass@host:5432/db?sslmode=require"
   ```

4. **Run verification:**
   ```bash
   npm run verify-integrity
   ```

5. **Document results:**
   ```bash
   npm run verify-integrity > audit-$(date +%Y%m%d).txt
   ```

**No platform credentials required** - only database read access

---

## Verification Guarantees

### What Verification Proves

✅ **Cryptographic Integrity:** All hashes are valid and correctly linked

✅ **Chain Continuity:** No gaps or breaks in the chain

✅ **Sequence Monotonicity:** Sequence numbers are contiguous and increasing

✅ **Genesis Validity:** First entry has null previous_hash

---

### What Verification Does NOT Prove

❌ **Event Authenticity:** Does not validate producer signatures

❌ **Business Logic:** Does not validate event semantics or payload structure

❌ **Timestamp Accuracy:** Does not validate occurred_at or committed_at

❌ **WORM Enforcement:** Does not check database triggers (requires admin access)

❌ **Authorization:** Does not validate who wrote events

---

## Compliance Alignment

### SOC 2 Type II

**Control:** System Monitoring (CC7.2)

**Evidence:** Verification reports demonstrate continuous monitoring of data integrity

**Frequency:** Monthly verification with documented results

---

### HIPAA

**Control:** Integrity Controls (§164.312(c)(1))

**Evidence:** Hash chain verification proves data has not been altered

**Frequency:** Quarterly verification for covered entities

---

### ISO 27001

**Control:** Information Security Event Management (A.16.1.2)

**Evidence:** Verification failures trigger incident response

**Frequency:** Risk-based (monthly recommended)

---

## Verification Script Source Code

**Location:** `backend/src/verify-integrity.ts`

**Lines of Code:** ~250

**Dependencies:** `pg`, `crypto` (Node.js built-in)

**License:** [UNKNOWN - not specified in repository]

**Audit Status:** Available for independent code review

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
