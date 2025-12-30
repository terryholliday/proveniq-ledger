# PROVENIQ Memory (Ledger) - Technical Documentation

**Product Name:** PROVENIQ Memory  
**Internal Service Name:** proveniq-ledger  
**Version:** 0.2.0  
**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Executive Summary

PROVENIQ Memory is an **immutable cryptographic event ledger** that serves as the system of record for all physical asset events across the PROVENIQ ecosystem. It provides cryptographically verifiable proof of asset provenance, custody, condition, and lifecycle events.

**What It Does:**
- Records immutable events from 12 PROVENIQ services (Anchors, Service, Transit, Protect, ClaimsIQ, Capital, Bids, Ops, Properties, Home, Origins, Core)
- Maintains a SHA-256 hash chain linking each event to the previous event
- Enforces Write Once, Read Many (WORM) semantics at the database level
- Provides cryptographic proof of event integrity and ordering
- Enables external verification without platform access

**What It Does NOT Do:**
- Does NOT allow modification or deletion of events (machine-enforced)
- Does NOT provide real-time streaming (query-based access only)
- Does NOT make business decisions (records facts, not commands)
- Does NOT guarantee event authenticity (relies on producer signatures)

---

## Critical Characteristics

| Characteristic | Implementation | Enforcement |
|----------------|----------------|-------------|
| **Immutability** | PostgreSQL BEFORE UPDATE/DELETE triggers | Machine-Enforced (Hard) |
| **Ordering** | BIGSERIAL sequence_number with UNIQUE constraint | Machine-Enforced (Hard) |
| **Replay Protection** | Unique constraints on event_id and idempotency_key | Machine-Enforced (Hard) |
| **Hash Chain Integrity** | SHA-256 linking with previous_hash | Machine-Enforced (Hard) |
| **Concurrency Safety** | PostgreSQL advisory locks (pg_advisory_xact_lock) | Machine-Enforced (Hard) |
| **Audit Trail** | Append-only audit_log table with WORM triggers | Machine-Enforced (Hard) |

---

## Documentation Structure

### Platform Documentation
- [Architecture Overview](platform/architecture-overview.md) - System context, components, and data flow
- [Security Model](platform/security-model.md) - Authentication, authorization, and threat model
- [Ledger Integration](platform/ledger-integration.md) - How to integrate with the Ledger service
- [Environments and Configuration](platform/environments-and-configuration.md) - Environment variables and deployment

### Ledger-Specific Documentation
- [Proof of Integrity](ledger/proof-of-integrity.md) - External verification procedures
- [Immutability Guarantees](ledger/immutability-guarantees.md) - WORM enforcement and constraints
- [Genesis Procedure](ledger/genesis-procedure.md) - Root of trust and initialization

### Application Documentation
- [Application README](app/README.md) - Service overview and dependencies
- [Data Dictionary](app/data-dictionary.md) - Database schema and field definitions
- [Workflows](app/workflows.md) - Event ingestion and query workflows
- [User Guide](app/user-guide.md) - API usage and integration guide
- [Troubleshooting](app/troubleshooting.md) - Common errors and resolutions
- [FAQ](app/faq.md) - Frequently asked questions

### Reference
- [Glossary](glossary.md) - Canonical vocabulary
- [CHANGELOG](CHANGELOG.md) - Documentation and schema changes

---

## Quick Start

### Prerequisites
- PostgreSQL 15+ with SSL/TLS
- Node.js 20+
- Firebase project with service account credentials

### Local Development
```bash
# Install dependencies
cd backend
npm ci

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Verify Installation
```bash
# Health check
curl http://localhost:8006/health

# Verify integrity (empty ledger is valid)
npm run verify-integrity
```

---

## Production Deployment

**CRITICAL:** Do NOT deploy without:
1. Running integrity verification (`npm run verify-integrity`)
2. Verifying WORM triggers are active
3. Confirming environment validation passes
4. Testing with non-production data first

See [Environments and Configuration](platform/environments-and-configuration.md) for deployment checklist.

---

## Support and Maintenance

**For Auditors and Compliance:**
- See [Proof of Integrity](ledger/proof-of-integrity.md) for external verification
- See [Immutability Guarantees](ledger/immutability-guarantees.md) for enforcement mechanisms

**For Developers:**
- See [Ledger Integration](platform/ledger-integration.md) for API integration
- See [Troubleshooting](app/troubleshooting.md) for common issues

**For Operations:**
- See [User Guide](app/user-guide.md) for operational procedures
- See [Environments and Configuration](platform/environments-and-configuration.md) for deployment

---

## Impossibilities (By Design)

The following operations are **impossible** by design:

1. **Cannot modify events** - UPDATE operations raise `integrity_constraint_violation`
2. **Cannot delete events** - DELETE operations raise `integrity_constraint_violation`
3. **Cannot reorder events** - Sequence numbers are immutable and monotonic
4. **Cannot break hash chain** - Advisory locks prevent concurrent writes
5. **Cannot replay events** - Unique constraints on event_id and idempotency_key
6. **Cannot modify audit log** - Append-only with WORM triggers

These impossibilities are **machine-enforced** at the database level, not policy-enforced.

---

## Navigation

- [Table of Contents](SUMMARY.md)
- [Glossary](glossary.md)
- [CHANGELOG](CHANGELOG.md)

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
