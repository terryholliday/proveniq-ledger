# PROVENIQ Memory (Ledger) - Environment Variables Reference

This document lists all environment variables used by the PROVENIQ Memory (Ledger) backend.

**CRITICAL:** Never commit actual secrets to git. Use this as a reference only.

---

## Required Variables

### Database

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://user:password@host:5432/proveniq_ledger` |

**Production Requirements:**
- MUST use SSL/TLS (`?sslmode=require` or `?ssl=true`)
- MUST use strong password (32+ characters)
- MUST restrict network access to database

### Authentication

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `ADMIN_API_KEY` | ✅ Yes | API key for service-to-service authentication | `admin_key_at_least_32_chars_long` |

**Production Requirements:**
- MUST be at least 64 characters in production
- MUST be cryptographically random
- MUST be rotated regularly

### Firebase Authentication

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `FIREBASE_PROJECT_ID` | ✅ Yes | Firebase project identifier | `proveniq-prod-12345` |
| `GOOGLE_APPLICATION_CREDENTIALS` | ⚠️ Conditional | Path to Firebase service account JSON file (required in production) | `/app/firebase-service-account.json` |

### Ledger Configuration

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `LEDGER_NETWORK_ID` | ✅ Yes | Ledger network identifier (prevents cross-network event mixing) | `proveniq-prod` |

**Production Requirements:**
- MUST NOT contain "dev" or "test" in production
- MUST be unique per environment (prod, staging, etc.)
- Events from different networks MUST NOT be mixed

---

## Optional Variables

### Application Configuration

| Variable | Required | Purpose | Default | Example |
|----------|----------|---------|---------|---------|
| `NODE_ENV` | ❌ No | Node.js environment mode | `development` | `production` |
| `PORT` | ❌ No | Port the application listens on | `8006` | `8006` |
| `ALLOWED_ORIGINS` | ❌ No | Comma-separated CORS origins | `*` (dev only) | `https://app.proveniq.io` |

### Logging

| Variable | Required | Purpose | Default | Example |
|----------|----------|---------|---------|---------|
| `LOG_FORMAT` | ❌ No | Log format (`json` or `text`) | `text` | `json` |

**Production Requirements:**
- MUST use `LOG_FORMAT=json` in production for structured logging
- Logs MUST include: `client_id`, `event_id`, `sequence_number`, `previous_hash`, `attempted_hash`

---

## Production Deployment (Railway)

### Railway-Specific Variables

Railway automatically provides:

| Variable | Purpose |
|----------|---------|
| `PORT` | Port the application should listen on (Railway assigns dynamically) |
| `RAILWAY_ENVIRONMENT` | Environment name (`production`, `staging`, etc.) |
| `RAILWAY_SERVICE_NAME` | Service name in Railway |

### Setting Variables in Railway

1. Go to Railway dashboard → Your project → Variables
2. Add each required variable from the table above
3. For `GOOGLE_APPLICATION_CREDENTIALS`:
   - Upload the JSON file as a Railway secret
   - Set the variable to the path where Railway mounts it (e.g., `/app/firebase-service-account.json`)

### Production Checklist

- [ ] `DATABASE_URL` points to production PostgreSQL instance with SSL
- [ ] `DATABASE_URL` includes `?sslmode=require` or `?ssl=true`
- [ ] `ADMIN_API_KEY` is at least 64 characters (cryptographically random)
- [ ] `FIREBASE_PROJECT_ID` is the production Firebase project
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` points to uploaded service account JSON
- [ ] `LEDGER_NETWORK_ID` is set to `proveniq-prod` (or similar, NOT "dev" or "test")
- [ ] `NODE_ENV` is set to `production`
- [ ] `LOG_FORMAT` is set to `json`
- [ ] All secrets are stored in Railway dashboard (not in `.env` files)

---

## Local Development

Copy `.env.example` to `.env` and fill in your local values:

```bash
cp .env.example .env
```

Then edit `.env` with your local configuration.

**NEVER commit `.env` to git.**

---

## Validation

The application validates all required environment variables at startup.

To test validation without starting the server:

```bash
npm run build
node -r dotenv/config dist/config/env-validation.js
```

If validation fails, the application will exit with code 1 and display missing/invalid variables.

---

## Security Notes

1. **Never commit secrets to git**
   - `.env` files are in `.gitignore`
   - Use Railway dashboard for production secrets
   - Use environment variables for CI/CD

2. **Database security**
   - Use SSL/TLS connections in production
   - Restrict network access to database
   - Use strong passwords (32+ characters)
   - Rotate credentials regularly

3. **API key security**
   - Use cryptographically random keys
   - Minimum 64 characters in production
   - Rotate regularly
   - Never log or expose in error messages

4. **Firebase credentials**
   - Store service account JSON outside the repository
   - Use Railway secrets for production
   - Rotate credentials if exposed

5. **Ledger Network ID**
   - Use unique IDs per environment
   - Never mix events from different networks
   - This prevents cross-environment data contamination

---

## Troubleshooting

### Application won't start

Run validation manually:
```bash
npm run build
node -r dotenv/config dist/config/env-validation.js
```

This will show exactly which variables are missing or invalid.

### Database connection failures

1. Verify `DATABASE_URL` is correct
2. Check network access to database
3. Verify SSL/TLS is configured (`?sslmode=require`)
4. Test connection manually:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

### WORM trigger failures

If you see "integrity_constraint_violation" errors:
1. This is expected - WORM triggers are working correctly
2. Ledger entries are immutable by design
3. Create a new event instead of updating existing ones

### Integrity verification failures

If `npm run verify-integrity` fails:
1. **DO NOT DEPLOY** - the ledger chain is broken
2. Investigate which sequence number failed
3. Check for concurrent write race conditions
4. Restore from backup if necessary
5. Contact engineering team immediately

---

## Environment Variable Summary

**Minimum required for local development:**
```bash
DATABASE_URL=postgresql://proveniq:proveniq_dev@localhost:5432/proveniq_ledger
ADMIN_API_KEY=dev_admin_key_at_least_32_characters_long
FIREBASE_PROJECT_ID=your-firebase-project-id
LEDGER_NETWORK_ID=proveniq-dev
```

**Additional required for production:**
```bash
NODE_ENV=production
LOG_FORMAT=json
GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json
# DATABASE_URL must include ?sslmode=require
# ADMIN_API_KEY must be 64+ characters
# LEDGER_NETWORK_ID must NOT contain "dev" or "test"
```
