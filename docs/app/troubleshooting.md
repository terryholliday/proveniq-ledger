# PROVENIQ Memory (Ledger) - Troubleshooting Guide

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Executive Summary

This document provides diagnostic procedures and solutions for common issues encountered when operating or integrating with PROVENIQ Memory (Ledger). All solutions are verified against the production codebase.

**Target Audience:** Operations engineers, backend developers, integration engineers

---

## Issue Category Index

1. [Application Startup Issues](#application-startup-issues)
2. [Authentication Failures](#authentication-failures)
3. [Event Ingestion Errors](#event-ingestion-errors)
4. [Query Performance Issues](#query-performance-issues)
5. [Integrity Verification Failures](#integrity-verification-failures)
6. [Database Connection Issues](#database-connection-issues)
7. [WORM Trigger Violations](#worm-trigger-violations)
8. [Deployment Issues](#deployment-issues)

---

## Application Startup Issues

### Issue: Application Exits with Code 1 on Startup

**Symptom:**
```
❌ FATAL: Environment validation failed
The application cannot start with invalid configuration.
```

**Cause:** Missing or invalid environment variables

**Diagnosis:**
```bash
cd backend
npm run build
node -r dotenv/config dist/config/env-validation.js
```

**Common Failures:**

#### 1. Missing DATABASE_URL

**Error:**
```
• DATABASE_URL: Required
```

**Solution:**
```bash
# Add to .env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

**Status:** [SHIPPED]

---

#### 2. API Key Too Short (Production)

**Error:**
```
• ADMIN_API_KEY: String must contain at least 64 character(s)
```

**Solution:**
```bash
# Generate 64-character key
openssl rand -hex 32

# Add to .env
ADMIN_API_KEY=<64-character-key>
```

**Status:** [SHIPPED]

---

#### 3. Database SSL Not Configured (Production)

**Error:**
```
❌ FATAL: DATABASE_URL must use SSL in production
```

**Solution:**
```bash
# Add SSL parameter to DATABASE_URL
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
# OR
DATABASE_URL=postgresql://user:pass@host:5432/db?ssl=true
```

**Status:** [SHIPPED]

---

#### 4. Invalid Network ID (Production)

**Error:**
```
❌ FATAL: LEDGER_NETWORK_ID cannot contain "dev" or "test" in production
```

**Solution:**
```bash
# Change network ID in .env
LEDGER_NETWORK_ID=proveniq-prod  # NOT proveniq-dev
```

**Status:** [SHIPPED]

---

#### 5. Missing Firebase Credentials (Production)

**Error:**
```
❌ FATAL: GOOGLE_APPLICATION_CREDENTIALS is required in production
```

**Solution:**
```bash
# Upload Firebase service account JSON to server
# Set path in .env
GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json
```

**Status:** [SHIPPED]

---

## Authentication Failures

### Issue: 401 Unauthorized on All Requests

**Symptom:**
```json
{
  "error": "Unauthorized"
}
```

**Diagnosis:**
```bash
# Test with API key
curl -H "x-api-key: $ADMIN_API_KEY" http://localhost:8006/health

# Test with Firebase token
curl -H "Authorization: Bearer $FIREBASE_TOKEN" http://localhost:8006/health
```

---

#### Scenario 1: Incorrect API Key

**Cause:** `x-api-key` header does not match `ADMIN_API_KEY` env var

**Solution:**
```bash
# Verify API key in .env matches request header
echo $ADMIN_API_KEY

# Test with correct key
curl -H "x-api-key: correct-key-here" http://localhost:8006/api/v1/events
```

**Status:** [SHIPPED]

---

#### Scenario 2: Expired Firebase Token

**Cause:** Firebase ID token has expired (1 hour default)

**Solution:**
```javascript
// Refresh token before making request
const user = firebase.auth().currentUser;
const freshToken = await user.getIdToken(true); // Force refresh

// Use fresh token
fetch('/api/v1/events', {
  headers: { 'Authorization': `Bearer ${freshToken}` }
});
```

**Status:** [SHIPPED]

---

#### Scenario 3: Firebase Not Configured

**Symptom:**
```json
{
  "error": "Service Unavailable",
  "message": "Firebase authentication is not configured"
}
```

**Cause:** `FIREBASE_PROJECT_ID` missing or Firebase Admin SDK initialization failed

**Solution:**
```bash
# Add Firebase configuration to .env
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Restart application
npm run dev
```

**Status:** [SHIPPED]

---

## Event Ingestion Errors

### Issue: 400 Bad Request - Schema Validation Failed

**Symptom:**
```json
{
  "error": "CANONICAL_SCHEMA_VIOLATION",
  "message": "Event does not match canonical envelope schema",
  "details": [...]
}
```

**Diagnosis:** Review `details` array for specific validation errors

---

#### Common Schema Violations

**1. Missing Required Field**

**Error:**
```json
{
  "code": "invalid_type",
  "expected": "string",
  "received": "undefined",
  "path": ["subject", "asset_id"],
  "message": "Required"
}
```

**Solution:**
```javascript
// Add missing field
const event = {
  // ... other fields
  subject: {
    asset_id: "uuid-v4", // REQUIRED
    // ... optional fields
  }
};
```

**Status:** [SHIPPED]

---

**2. Invalid Event Type**

**Error:**
```json
{
  "error": "INVALID_EVENT_TYPE",
  "message": "Event type 'SERVICE_RECORD_CREATE' is not a valid canonical event type."
}
```

**Solution:**
```javascript
// Use past tense (VERB_PAST, not VERB)
event_type: "SERVICE_RECORD_CREATED" // NOT "SERVICE_RECORD_CREATE"
```

**Valid Format:** `DOMAIN_NOUN_VERB_PAST` (all uppercase, underscores)

**Status:** [SHIPPED]

---

**3. Invalid Schema Version**

**Error:**
```json
{
  "error": "UNSUPPORTED_SCHEMA_VERSION",
  "message": "Schema version '2.0.0' is not supported. Expected: '1.0.0'."
}
```

**Solution:**
```javascript
// Use correct schema version
schema_version: "1.0.0" // LOCKED
```

**Status:** [SHIPPED]

---

**4. Invalid UUID Format**

**Error:**
```json
{
  "code": "invalid_string",
  "validation": "uuid",
  "path": ["subject", "asset_id"],
  "message": "Invalid uuid"
}
```

**Solution:**
```javascript
// Use valid UUID v4
import { v4 as uuidv4 } from 'uuid';

subject: {
  asset_id: uuidv4() // Generates valid UUID
}
```

**Status:** [SHIPPED]

---

**5. Invalid Timestamp Format**

**Error:**
```json
{
  "code": "invalid_string",
  "validation": "datetime",
  "path": ["occurred_at"],
  "message": "Invalid datetime"
}
```

**Solution:**
```javascript
// Use ISO 8601 format
occurred_at: new Date().toISOString() // "2024-12-29T12:00:00.000Z"
```

**Status:** [SHIPPED]

---

### Issue: 500 Internal Server Error on Ingestion

**Symptom:**
```json
{
  "error": "Internal Server Error"
}
```

**Diagnosis:**
```bash
# Check application logs
docker logs proveniq-ledger-backend

# Look for error messages
grep "ERROR" logs/app.log
```

---

#### Scenario 1: Database Connection Lost

**Cause:** PostgreSQL connection dropped

**Solution:**
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Restart application (connection pool will reconnect)
npm run dev
```

**Status:** [SHIPPED]

---

#### Scenario 2: Advisory Lock Timeout

**Symptom:** Request hangs indefinitely

**Cause:** Another transaction holding advisory lock

**Solution:**
```sql
-- Check for long-running transactions
SELECT pid, state, query_start, query
FROM pg_stat_activity
WHERE state = 'active'
  AND query LIKE '%pg_advisory%';

-- Kill blocking transaction (if stuck)
SELECT pg_terminate_backend(pid);
```

**Status:** [UNKNOWN - no timeout configured]

---

## Query Performance Issues

### Issue: Slow Query Response (> 1 second)

**Diagnosis:**
```sql
-- Enable query logging
SET log_statement = 'all';
SET log_duration = on;

-- Run query and check logs
SELECT * FROM ledger_entries WHERE asset_id = 'uuid';
```

---

#### Scenario 1: Missing Index Usage

**Cause:** Query not using available indices

**Solution:**
```sql
-- Check query plan
EXPLAIN ANALYZE
SELECT * FROM ledger_entries WHERE asset_id = 'uuid';

-- Should show "Index Scan using idx_ledger_asset_id"
-- If showing "Seq Scan", index is not being used
```

**Fix:**
```sql
-- Rebuild index if corrupted
REINDEX INDEX idx_ledger_asset_id;

-- Update statistics
ANALYZE ledger_entries;
```

**Status:** [SHIPPED]

---

#### Scenario 2: Large Result Set

**Cause:** Query returning too many results (> 1000)

**Solution:**
```javascript
// Use pagination
const limit = 100;
const offset = 0;

fetch(`/api/v1/events?asset_id=uuid&limit=${limit}&offset=${offset}`);
```

**Status:** [SHIPPED]

---

#### Scenario 3: Unindexed Filter

**Cause:** Filtering on payload fields (not indexed)

**Solution:**
```javascript
// BAD: Payload filtering (slow)
// No API support for payload field filtering

// GOOD: Use indexed filters
fetch('/api/v1/events?asset_id=uuid&event_type=SERVICE_RECORD_CREATED');
```

**Status:** [SHIPPED]

---

## Integrity Verification Failures

### Issue: Chain Integrity Violation Detected

**Symptom:**
```
❌ CHAIN INTEGRITY VIOLATION DETECTED

Error breakdown:
   payload_hash_mismatch: 1
   chain_break: 2
```

**Severity:** CRITICAL

**Immediate Actions:**
1. **HALT ALL WRITES** - Stop accepting new events
2. **ISOLATE DATABASE** - Prevent further modifications
3. **INVESTIGATE** - Identify corrupted entries
4. **RESTORE FROM BACKUP** - Use last known good backup
5. **RE-VERIFY** - Confirm restored chain is valid

---

#### Diagnosis: Identify Corrupted Entries

```bash
# Run verification with verbose output
npm run verify-integrity > verification-report.txt

# Review error details
grep "❌" verification-report.txt
```

**Example Output:**
```
❌ Payload hash mismatch at seq 12345
   Expected: a1b2c3...
   Actual:   d4e5f6...

❌ Chain break at seq 12346
   previous_hash does not match previous entry_hash
```

---

#### Scenario 1: Payload Tampering

**Cause:** Payload modified (WORM trigger bypassed by superuser)

**Detection:**
```sql
-- Find entries with mismatched payload hashes
-- (Requires manual hash recalculation)
```

**Recovery:**
```bash
# Restore from last known good backup
pg_restore -d proveniq_ledger backup-2024-12-29.dump

# Verify integrity
npm run verify-integrity
```

**Status:** [POLICY-ENFORCED]

---

#### Scenario 2: Chain Break

**Cause:** Entry deleted or modified (WORM trigger bypassed)

**Detection:**
```sql
-- Check for sequence gaps
SELECT sequence_number
FROM ledger_entries
ORDER BY sequence_number;

-- Look for missing sequences
```

**Recovery:** Restore from backup (cannot repair broken chain)

**Status:** [POLICY-ENFORCED]

---

### Issue: Verification Script Out of Memory

**Symptom:**
```
FATAL ERROR: JavaScript heap out of memory
```

**Cause:** Large ledger (> 100K entries) with full chain verification

**Solution:**
```bash
# Use last N strategy instead
npm run verify-integrity -- --last 1000

# OR increase Node.js memory
NODE_OPTIONS=--max-old-space-size=4096 npm run verify-integrity
```

**Status:** [SHIPPED]

---

## Database Connection Issues

### Issue: Connection Refused

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Diagnosis:**
```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT 1"
```

---

#### Scenario 1: PostgreSQL Not Running

**Solution:**
```bash
# Start PostgreSQL (Docker)
docker start proveniq-ledger-db

# OR start PostgreSQL (system service)
sudo systemctl start postgresql
```

**Status:** [SHIPPED]

---

#### Scenario 2: Incorrect Connection String

**Solution:**
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@host:port/db

# Test with corrected URL
psql "postgresql://user:pass@host:5432/db" -c "SELECT 1"
```

**Status:** [SHIPPED]

---

#### Scenario 3: Network Access Blocked

**Solution:**
```bash
# Check firewall rules
sudo ufw status

# Allow PostgreSQL port
sudo ufw allow 5432/tcp

# Test connectivity
telnet host 5432
```

**Status:** [POLICY-ENFORCED]

---

### Issue: SSL Connection Failed

**Symptom:**
```
Error: SSL connection required
```

**Cause:** Database requires SSL but connection string missing SSL parameter

**Solution:**
```bash
# Add SSL parameter to DATABASE_URL
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Restart application
npm run dev
```

**Status:** [SHIPPED]

---

## WORM Trigger Violations

### Issue: Cannot Update Event

**Symptom:**
```
ERROR: UPDATE operations are forbidden on ledger_entries (WORM enforcement)
```

**Cause:** Attempting to modify immutable event

**Solution:** Create compensating event instead

**Example:**
```javascript
// BAD: Cannot update existing event
// UPDATE ledger_entries SET payload = '{}' WHERE id = 'uuid';

// GOOD: Create correction event
const correctionEvent = {
  event_type: "SERVICE_RECORD_CORRECTED",
  payload: {
    original_event_id: "uuid-of-wrong-event",
    corrected_field: "work_order_id",
    corrected_value: "correct-uuid",
    reason: "Data entry error"
  }
};
```

**Status:** [SHIPPED]

---

### Issue: Cannot Delete Event

**Symptom:**
```
ERROR: DELETE operations are forbidden on ledger_entries (WORM enforcement)
```

**Cause:** Attempting to delete immutable event

**Solution:** Mark as superseded in application logic

**Example:**
```javascript
// BAD: Cannot delete event
// DELETE FROM ledger_entries WHERE id = 'uuid';

// GOOD: Create superseding event
const supersedingEvent = {
  event_type: "SERVICE_RECORD_SUPERSEDED",
  payload: {
    superseded_event_id: "uuid-of-old-event",
    reason: "Duplicate entry"
  }
};

// Application logic filters superseded events
```

**Status:** [POLICY-ENFORCED]

---

### Issue: Trigger Disabled

**Symptom:** UPDATE/DELETE succeeds (should fail)

**Diagnosis:**
```sql
-- Check trigger status
SELECT trigger_name, status
FROM information_schema.triggers
WHERE event_object_table = 'ledger_entries'
  AND trigger_name = 'enforce_ledger_immutability';
```

**Expected:** Status = 'ENABLED'

**Solution:**
```sql
-- Re-enable trigger
ALTER TABLE ledger_entries ENABLE TRIGGER enforce_ledger_immutability;

-- Verify
SELECT trigger_name, status FROM information_schema.triggers
WHERE event_object_table = 'ledger_entries';
```

**Status:** [SHIPPED]

---

## Deployment Issues

### Issue: Railway Deployment Failed

**Symptom:** Deployment stuck in "Building" or "Failed" state

**Diagnosis:**
```bash
# Check Railway logs
railway logs

# Look for build errors
```

---

#### Scenario 1: Migration Failed

**Error:**
```
Phase 1: Database Migrations
ERROR: relation "ledger_entries" already exists
```

**Cause:** Migration not idempotent

**Solution:**
```sql
-- Migrations should use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS ledger_entries (...);

-- Re-run migration
psql $DATABASE_URL -f migrations/001_immutability_constraints.sql
```

**Status:** [SHIPPED]

---

#### Scenario 2: Integrity Verification Failed

**Error:**
```
Phase 2: Ledger Integrity Verification
❌ CHAIN INTEGRITY VIOLATION DETECTED
```

**Cause:** Corrupted ledger state

**Solution:**
```bash
# Restore from last known good backup
# Do NOT deploy until integrity is verified

# Investigate corruption
npm run verify-integrity

# Fix root cause before redeploying
```

**Status:** [SHIPPED]

---

#### Scenario 3: Health Check Timeout

**Error:**
```
Health check failed: timeout after 10s
```

**Cause:** Application not responding to `/health` endpoint

**Solution:**
```bash
# Check application logs
railway logs

# Look for startup errors
grep "ERROR" logs

# Verify environment variables
railway variables
```

**Status:** [SHIPPED]

---

## Monitoring and Alerting

### Critical Alerts

**1. Application Down**
- Health check returns non-200 status
- Action: Restart application, check logs

**2. Integrity Violation**
- Verification script exits with code 1
- Action: HALT WRITES, investigate, restore from backup

**3. High Error Rate**
- > 5% of requests return 500 errors
- Action: Check database connectivity, review logs

**4. Trigger Disabled**
- WORM trigger status = 'DISABLED'
- Action: Re-enable trigger immediately, audit database access

**Status:** [POLICY-ENFORCED]

---

## Support Escalation

### Level 1: Self-Service

**Resources:**
- This troubleshooting guide
- [Architecture Overview](../platform/architecture-overview.md)
- [Integration Guide](../platform/ledger-integration.md)
- [Environments and Configuration](../platform/environments-and-configuration.md)

---

### Level 2: Code Review

**Resources:**
- GitHub repository: `github.com/terryholliday/proveniq-ledger`
- Commit: `4146303`
- Source files:
  - `backend/src/server.ts` - API routes
  - `backend/src/ingest/canonical.ts` - Ingestion logic
  - `backend/src/config/env-validation.ts` - Environment validation
  - `backend/src/verify-integrity.ts` - Verification script

---

### Level 3: Database Inspection

**Diagnostic Queries:**

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check for long-running queries
SELECT 
  pid,
  now() - query_start AS duration,
  state,
  query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Check connection pool usage
SELECT 
  count(*) AS total_connections,
  sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END) AS active,
  sum(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) AS idle
FROM pg_stat_activity;
```

---

## Common Pitfalls

### 1. Hardcoding Credentials

**Problem:** API keys or database URLs in code

**Solution:** Always use environment variables

**Status:** [POLICY-ENFORCED]

---

### 2. Ignoring Idempotency

**Problem:** Retrying failed requests without idempotency key

**Solution:** Always include `idempotency_key` in event submissions

**Status:** [SHIPPED]

---

### 3. Storing PII in Payloads

**Problem:** Cannot delete events (GDPR conflict)

**Solution:** Store PII in separate tables with foreign keys

**Status:** [POLICY-ENFORCED]

---

### 4. Bypassing WORM Triggers

**Problem:** Using superuser to modify events

**Solution:** Never bypass triggers; use compensating events

**Status:** [POLICY-ENFORCED]

---

### 5. Not Verifying Integrity

**Problem:** Corrupted chain goes undetected

**Solution:** Run integrity verification monthly (minimum)

**Status:** [POLICY-ENFORCED]

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
