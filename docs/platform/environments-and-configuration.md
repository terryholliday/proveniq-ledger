# PROVENIQ Memory (Ledger) - Environments and Configuration

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Executive Summary

This document provides a comprehensive reference for environment variables, configuration validation, and deployment procedures for PROVENIQ Memory (Ledger). All configuration is validated at application startup with hard-fail behavior on invalid or missing values.

**Configuration Philosophy:** Fail-fast validation prevents runtime errors from misconfiguration

---

## Environment Variables Reference

### Required Variables

**Source:** `backend/src/config/env-validation.ts`

| Variable | Type | Purpose | Validation | Default |
|----------|------|---------|------------|---------|
| `DATABASE_URL` | String (URL) | PostgreSQL connection string | Must start with `postgres://` or `postgresql://` | None |
| `ADMIN_API_KEY` | String | Service-to-service authentication key | Min 32 chars (64+ in production) | None |
| `FIREBASE_PROJECT_ID` | String | Firebase project identifier | Non-empty string | None |
| `LEDGER_NETWORK_ID` | String | Ledger network identifier (prevents cross-network mixing) | 1-64 chars, no "dev"/"test" in production | `proveniq-dev` |

**Status:** [SHIPPED]

---

### Optional Variables

| Variable | Type | Purpose | Validation | Default |
|----------|------|---------|------------|---------|
| `NODE_ENV` | Enum | Runtime environment | `development`, `production`, `test` | `development` |
| `PORT` | Number | Server port | Numeric string | `8006` |
| `GOOGLE_APPLICATION_CREDENTIALS` | String (Path) | Path to Firebase service account JSON | File path (required in production) | None |
| `ALLOWED_ORIGINS` | String | CORS origins (comma-separated) | String | None |
| `LOG_FORMAT` | Enum | Log format | `json`, `text` | `text` |

**Status:** [SHIPPED]

---

## Production-Specific Validation

**Source:** `backend/src/config/env-validation.ts`

When `NODE_ENV=production`, additional validation rules apply:

### 1. Database SSL/TLS Requirement

```typescript
if (!env.DATABASE_URL.includes('sslmode=require') && !env.DATABASE_URL.includes('ssl=true')) {
  console.error('❌ FATAL: DATABASE_URL must use SSL in production');
  process.exit(1);
}
```

**Enforcement:** Machine-Enforced (Hard) [SHIPPED]

**Valid Examples:**
```bash
# PostgreSQL sslmode
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Generic SSL flag
DATABASE_URL=postgresql://user:pass@host:5432/db?ssl=true
```

---

### 2. Strong API Key Requirement

```typescript
if (env.ADMIN_API_KEY.length < 64) {
  console.error('❌ FATAL: ADMIN_API_KEY must be at least 64 characters in production');
  process.exit(1);
}
```

**Enforcement:** Machine-Enforced (Hard) [SHIPPED]

**Generation:**
```bash
# Generate cryptographically random 64-character key
openssl rand -hex 32
```

---

### 3. Network ID Validation

```typescript
if (env.LEDGER_NETWORK_ID.includes('dev') || env.LEDGER_NETWORK_ID.includes('test')) {
  console.error('❌ FATAL: LEDGER_NETWORK_ID cannot contain "dev" or "test" in production');
  process.exit(1);
}
```

**Enforcement:** Machine-Enforced (Hard) [SHIPPED]

**Valid Examples:**
- `proveniq-prod`
- `proveniq-staging`
- `proveniq-us-east-1`

**Invalid Examples:**
- `proveniq-dev` ❌
- `proveniq-test` ❌
- `dev-ledger` ❌

---

### 4. Firebase Credentials Requirement

```typescript
if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ FATAL: GOOGLE_APPLICATION_CREDENTIALS is required in production');
  process.exit(1);
}
```

**Enforcement:** Machine-Enforced (Hard) [SHIPPED]

---

## Configuration Examples

### Development (.env)

```bash
# Database (local PostgreSQL)
DATABASE_URL=postgresql://proveniq:proveniq_dev@localhost:5434/proveniq_ledger

# Application
NODE_ENV=development
PORT=8006

# Authentication
ADMIN_API_KEY=dev_admin_key_at_least_32_characters_long_replace_in_production
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/firebase-service-account.json

# Ledger Network
LEDGER_NETWORK_ID=proveniq-dev

# Logging
LOG_FORMAT=text

# CORS (optional)
ALLOWED_ORIGINS=http://localhost:3000
```

---

### Production (Railway Secrets)

```bash
# Database (Railway PostgreSQL with SSL)
DATABASE_URL=postgresql://user:pass@host.railway.app:5432/railway?sslmode=require

# Application
NODE_ENV=production
PORT=8006

# Authentication (64+ character key)
ADMIN_API_KEY=<64-character-cryptographically-random-key>
FIREBASE_PROJECT_ID=proveniq-prod-12345
GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json

# Ledger Network (no "dev" or "test")
LEDGER_NETWORK_ID=proveniq-prod

# Logging (structured JSON)
LOG_FORMAT=json

# CORS (specific origins only)
ALLOWED_ORIGINS=https://app.proveniq.io,https://admin.proveniq.io
```

---

## Configuration Validation

### Startup Validation

**Source:** `backend/src/server.ts`

```typescript
import { validateEnvironment } from './config/env-validation.js';

dotenv.config();

// CRITICAL: Validate environment before proceeding
// This will hard-fail (exit 1) if required configuration is missing
validateEnvironment();
```

**Behavior:**
- Runs before server starts
- Exits with code 1 on validation failure
- Logs detailed error messages for missing/invalid variables
- Prevents application startup with invalid configuration

**Status:** [SHIPPED]

---

### Manual Validation

**Test configuration without starting server:**

```bash
cd backend
npm run build
node -r dotenv/config dist/config/env-validation.js
```

**Output (Success):**
```json
{
  "level": "info",
  "msg": "environment_validation_success",
  "node_env": "production",
  "port": 8006,
  "ledger_network_id": "proveniq-prod",
  "database_configured": true,
  "firebase_configured": true,
  "at": "2024-12-29T12:00:00Z"
}
```

**Output (Failure):**
```
❌ FATAL: Environment validation failed

Missing or invalid environment variables:
   • DATABASE_URL: Required
   • ADMIN_API_KEY: String must contain at least 32 character(s)

The application cannot start with invalid configuration.
Please check your .env file or environment variables.
See ENV_REFERENCE.md for required variables.
```

---

## Deployment Procedures

### Railway Deployment

**Platform Configuration:** `backend/railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "backend/Dockerfile"
watchPaths = ["backend/**"]

[deploy]
startCommand = "node dist/server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
healthcheckPath = "/health"
healthcheckTimeout = 10

[deploy.releaseCommand]
command = """
  echo "🔒 PROVENIQ Memory - Release Gate" && \
  echo "Phase 1: Database Migrations" && \
  psql $DATABASE_URL -f migrations/001_immutability_constraints.sql && \
  echo "✅ Migrations complete" && \
  echo "" && \
  echo "Phase 2: Ledger Integrity Verification" && \
  ENTRY_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM ledger_entries") && \
  echo "Ledger size: $ENTRY_COUNT entries" && \
  if [ "$ENTRY_COUNT" -lt 1000 ]; then \
    echo "Strategy: Full chain verification" && \
    npm run verify-integrity; \
  else \
    echo "Strategy: Last 1000 + random sample" && \
    npm run verify-integrity -- --last 1000 && \
    npm run verify-integrity -- --sample 100; \
  fi && \
  echo "" && \
  echo "✅ Release gate passed - deployment proceeding"
"""
timeout = 600

[env]
NODE_ENV = "production"
LOG_FORMAT = "json"
```

**Status:** [SHIPPED]

---

### Deployment Checklist

**Pre-Deployment:**

- [ ] All environment variables set in Railway dashboard
- [ ] `DATABASE_URL` includes `?sslmode=require`
- [ ] `ADMIN_API_KEY` is 64+ characters (cryptographically random)
- [ ] `LEDGER_NETWORK_ID` is set to `proveniq-prod` (NOT "dev" or "test")
- [ ] `NODE_ENV=production` in Railway
- [ ] `LOG_FORMAT=json` in Railway
- [ ] Firebase service account JSON uploaded to Railway
- [ ] Database migrations tested in staging
- [ ] `RAILWAY_TOKEN` added to GitHub secrets (for CI/CD)

**Post-Deployment:**

- [ ] Health check endpoint verified (`/health` returns 200)
- [ ] Integrity verification passed (release gate)
- [ ] WORM triggers verified (UPDATE attempt fails)
- [ ] Authentication tested (401 without credentials)
- [ ] Event ingestion tested (canonical endpoint)
- [ ] Monitoring alerts configured

---

### Release Gate

**Purpose:** Prevent deployment of corrupted ledger state

**Phases:**

1. **Database Migrations**
   - Applies WORM triggers and constraints
   - Idempotent (safe to run multiple times)
   - Fails deployment if migration errors

2. **Integrity Verification**
   - Adaptive strategy based on chain size
   - Full verification if < 1000 entries
   - Last 1000 + random sample if >= 1000 entries
   - Fails deployment if integrity violation detected

3. **Deployment Proceeds**
   - Only if both phases pass
   - Traffic switched to new deployment
   - Old deployment terminated

**Timeout:** 600 seconds (10 minutes)

**Status:** [SHIPPED]

---

## Environment-Specific Configuration

### Local Development

**Database:** Local PostgreSQL (no SSL required)

**Setup:**
```bash
# Start PostgreSQL
docker run -d \
  --name proveniq-ledger-db \
  -e POSTGRES_USER=proveniq \
  -e POSTGRES_PASSWORD=proveniq_dev \
  -e POSTGRES_DB=proveniq_ledger \
  -p 5434:5432 \
  postgres:15-alpine

# Copy environment template
cp backend/.env.example backend/.env

# Edit .env with local values
# DATABASE_URL=postgresql://proveniq:proveniq_dev@localhost:5434/proveniq_ledger
```

**Validation Relaxed:**
- SSL not required
- API key can be 32+ characters (not 64+)
- Network ID can contain "dev"
- Firebase credentials optional (503 if not configured)

---

### Staging

**Database:** Railway PostgreSQL with SSL

**Configuration:**
```bash
DATABASE_URL=postgresql://user:pass@staging.railway.app:5432/railway?sslmode=require
NODE_ENV=production
LEDGER_NETWORK_ID=proveniq-staging
ADMIN_API_KEY=<64-character-key>
LOG_FORMAT=json
```

**Purpose:**
- Test production configuration
- Verify migrations
- Load testing
- Integration testing

---

### Production

**Database:** Railway PostgreSQL with SSL + replication [UNKNOWN]

**Configuration:**
```bash
DATABASE_URL=postgresql://user:pass@prod.railway.app:5432/railway?sslmode=require
NODE_ENV=production
LEDGER_NETWORK_ID=proveniq-prod
ADMIN_API_KEY=<64-character-key>
LOG_FORMAT=json
ALLOWED_ORIGINS=https://app.proveniq.io,https://admin.proveniq.io
```

**Additional Requirements:**
- High-availability database
- Automated backups
- Monitoring and alerting
- Incident response plan

---

## Secrets Management

### Storage

**Development:**
- `.env` file (gitignored)
- Local environment variables

**Production:**
- Railway secrets (encrypted at rest)
- Never committed to git
- Never logged in application

---

### Rotation Procedures

**API Key Rotation:**

1. Generate new key: `openssl rand -hex 32`
2. Add new key to Railway secrets as `ADMIN_API_KEY_NEW`
3. Update producers to use new key
4. Monitor for errors (24-48 hours)
5. Remove old key from Railway secrets
6. Update `ADMIN_API_KEY` to new value

**Database Credentials Rotation:**

1. Create new database user with same permissions
2. Update `DATABASE_URL` in Railway secrets
3. Deploy with new credentials
4. Verify connectivity
5. Revoke old database user

**Firebase Credentials Rotation:**

1. Generate new service account in Firebase Console
2. Download new JSON file
3. Upload to Railway as new secret file
4. Update `GOOGLE_APPLICATION_CREDENTIALS` path
5. Deploy with new credentials
6. Delete old service account

---

## CORS Configuration

**Source:** `backend/src/server.ts`

```typescript
app.use(cors());
```

**Current Behavior:** Allows all origins [SHIPPED]

**Production Recommendation:** Restrict to specific origins

**Configuration:**
```bash
ALLOWED_ORIGINS=https://app.proveniq.io,https://admin.proveniq.io
```

**Implementation:** [UNKNOWN - not implemented in code]

---

## Logging Configuration

### Development Logging

**Format:** Text (human-readable)

**Configuration:**
```bash
LOG_FORMAT=text
```

**Output:**
```
[LEDGER] canonical ingest error Error: ...
```

---

### Production Logging

**Format:** JSON (structured)

**Configuration:**
```bash
LOG_FORMAT=json
```

**Output:**
```json
{
  "level": "info",
  "msg": "ledger_canonical_ingest_success",
  "client_id": "service",
  "event_id": "uuid",
  "sequence_number": 12345,
  "previous_hash": "sha256-hex",
  "attempted_hash": "sha256-hex",
  "at": "2024-12-29T12:00:00Z"
}
```

**Fields (Canonical Ingestion):**
- `level` - Log level (info, error)
- `msg` - Event type
- `client_id` - Producer service
- `event_id` - Event UUID
- `sequence_number` - Ledger sequence
- `previous_hash` - Previous entry hash
- `attempted_hash` - Calculated entry hash
- `at` - Timestamp (ISO 8601)

**Critical:** No secrets logged (payload, credentials, tokens) [SHIPPED]

---

## Troubleshooting Configuration

### Application Won't Start

**Symptom:** Process exits with code 1

**Diagnosis:**
```bash
npm run build
node -r dotenv/config dist/config/env-validation.js
```

**Common Causes:**
- Missing required environment variable
- Invalid `DATABASE_URL` format
- API key too short
- Network ID contains "dev" in production
- Missing Firebase credentials in production

---

### Database Connection Failures

**Symptom:** `Error: connect ECONNREFUSED`

**Diagnosis:**
```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT 1"
```

**Common Causes:**
- Incorrect `DATABASE_URL`
- Database not running
- Network access blocked
- SSL/TLS not configured

---

### Authentication Failures

**Symptom:** 401 Unauthorized on all requests

**Diagnosis:**
```bash
# Test with API key
curl -H "x-api-key: $ADMIN_API_KEY" http://localhost:8006/health

# Test with Firebase token
curl -H "Authorization: Bearer $FIREBASE_TOKEN" http://localhost:8006/health
```

**Common Causes:**
- Incorrect `ADMIN_API_KEY`
- Expired Firebase token
- Firebase not configured (`FIREBASE_PROJECT_ID` missing)

---

### WORM Trigger Failures

**Symptom:** `integrity_constraint_violation` on UPDATE/DELETE

**Diagnosis:**
```bash
# Verify triggers are active
psql $DATABASE_URL -c "
  SELECT trigger_name, event_manipulation
  FROM information_schema.triggers
  WHERE event_object_table = 'ledger_entries'
"
```

**Expected Output:**
```
trigger_name                 | event_manipulation
-----------------------------+-------------------
enforce_ledger_immutability | UPDATE
enforce_ledger_immutability | DELETE
```

**Resolution:** This is expected behavior (WORM enforcement working correctly)

---

## Performance Tuning

### Database Connection Pool

**Source:** `backend/src/db.ts`

```typescript
export const pool = new Pool({
  connectionString,
  max: 10,
});
```

**Configuration:** [SHIPPED]
- Max connections: 10
- Idle timeout: Default (10 seconds)
- Connection timeout: Default (0 = no timeout)

**Tuning:** [UNKNOWN - not configurable via environment]

---

### Advisory Lock Timeout

**Current:** No timeout (waits indefinitely)

**Risk:** Long-running transactions can block writes

**Mitigation:** [UNKNOWN - not implemented]

---

## Monitoring Configuration

### Health Check

**Endpoint:** `GET /health`

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

**Railway Configuration:**
```toml
healthcheckPath = "/health"
healthcheckTimeout = 10
```

**Status:** [SHIPPED]

---

### Metrics

**Available:** [UNKNOWN - not implemented in code]

**Recommended:**
- Write throughput (events/sec)
- Read throughput (queries/sec)
- Write latency (p50, p95, p99)
- Read latency (p50, p95, p99)
- Error rate by status code
- Database connection pool utilization
- Advisory lock contention

---

## Security Hardening

### Production Security Checklist

- [ ] `DATABASE_URL` uses SSL/TLS (`?sslmode=require`)
- [ ] `ADMIN_API_KEY` is 64+ characters (cryptographically random)
- [ ] `ADMIN_API_KEY` rotated regularly (quarterly)
- [ ] Firebase service account has minimal permissions
- [ ] `ALLOWED_ORIGINS` restricted to specific domains
- [ ] `LOG_FORMAT=json` for structured logging
- [ ] No secrets in logs (verified)
- [ ] WORM triggers active (verified)
- [ ] Integrity verification passing (verified)
- [ ] Database backups configured
- [ ] Monitoring and alerting active

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
