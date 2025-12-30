# PROVENIQ Memory (Ledger) - Documentation Changelog

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Purpose

This changelog tracks changes to the documentation and database schema, not application code changes. It provides a historical record of documentation updates, schema migrations, and breaking changes.

---

## [1.0.0] - 2024-12-29

### Documentation Created
- Initial audit-grade documentation generated
- Root documentation: README, SUMMARY, glossary, CHANGELOG
- Platform documentation structure defined
- Ledger-specific documentation structure defined
- Application documentation structure defined

### Schema Verified
- **Schema Version:** 1.0.0 (LOCKED)
- **Canonical Event Envelope:** Defined in `backend/src/ledger.events.ts`
- **Database Schema:** Defined in `backend/src/db.ts`
- **WORM Triggers:** Defined in `backend/migrations/001_immutability_constraints.sql`

### Tables Documented
- `ledger_entries` - Core event store with hash chain
- `audit_log` - Append-only access audit trail
- `integrity_checkpoints` - Verification snapshots

### Constraints Documented
- UNIQUE constraint on `sequence_number` (replay protection)
- UNIQUE constraint on `id` (event_id, primary key)
- Partial UNIQUE index on `idempotency_key` (duplicate prevention)
- BEFORE UPDATE trigger on `ledger_entries` (WORM enforcement)
- BEFORE DELETE trigger on `ledger_entries` (WORM enforcement)
- BEFORE UPDATE trigger on `audit_log` (append-only enforcement)
- BEFORE DELETE trigger on `audit_log` (append-only enforcement)

### Event Types Cataloged
- **Total Event Types:** 74
- **Domains:** 11 (ANCHOR, SERVICE, TRANSIT, PROTECT, CLAIMSIQ, CAPITAL, BIDS, OPS, PROPERTIES, HOME, CORE)
- **Naming Convention:** `DOMAIN_NOUN_VERB_PAST` (enforced via regex)

### Authentication Documented
- Firebase ID Token (preferred)
- Admin API Key (fallback)
- Dual authentication strategy verified in `backend/src/auth.ts`

### Environment Variables Documented
- 10 environment variables cataloged
- Production validation rules documented
- Required vs optional fields specified
- Validation enforcement verified in `backend/src/config/env-validation.ts`

### Concurrency Model Documented
- Advisory lock pattern (`pg_advisory_xact_lock`) verified
- Lock keys documented: `0x5052564e` ("PRVN"), `0x4c454447` ("LEDG")
- Genesis block handling verified (works with empty table)

### Verification Procedures Documented
- Full chain verification script verified in `backend/src/verify-integrity.ts`
- Exit codes documented (0=valid, 1=violation, 2=error)
- Verification strategies documented (full, last N, random sample)

---

## Schema Migration History

### Migration 001 - Immutability Constraints
**File:** `backend/migrations/001_immutability_constraints.sql`  
**Applied:** Production deployment  
**Purpose:** Enforce WORM semantics at database level

**Changes:**
- Added UNIQUE constraint on `sequence_number`
- Added UNIQUE constraint on `id` (event_id)
- Created `prevent_ledger_mutation()` trigger function
- Attached WORM trigger to `ledger_entries` table
- Created `prevent_audit_mutation()` trigger function
- Attached WORM trigger to `audit_log` table
- Created performance index on `sequence_number DESC`

**Breaking Changes:** None (additive only)

**Rollback:** Not supported (WORM enforcement is irreversible by design)

---

## Documentation Standards

### Version Anchoring
All documentation files MUST include:
```markdown
**Last Verified Against Commit:** `<git-short-sha>`  
**Schema Version:** <version>
```

### Tagging Convention
All claims MUST be tagged:
- **[SHIPPED]** - Verified in code
- **[PLANNED]** - Explicitly referenced in TODO/roadmap
- **[UNKNOWN]** - Cannot be verified

### Diagram Requirements
- Mermaid.js syntax MUST be valid
- Sequence diagrams for workflows
- ERDs for data structures
- Flowcharts for hash chain visualization

### Enforcement Labeling
All security/integrity claims MUST specify:
- **Machine-Enforced (Hard)** - Code/DB constraints/triggers/cryptography
- **Policy-Enforced (Soft)** - Organizational process or convention

---

## Future Documentation Updates

### Planned Sections
- Platform architecture overview with C4 context diagram
- Security model with threat analysis
- Ledger integration guide for producers
- Environment configuration reference
- Proof of integrity verification procedure
- Immutability guarantees catalog
- Genesis procedure documentation
- Application README with dependencies
- Data dictionary with ERD
- Workflow sequence diagrams
- User guide with API reference
- Troubleshooting error catalog
- FAQ with performance expectations

### Schema Evolution Policy
- Schema version changes require new migration file
- Breaking changes MUST be documented in this CHANGELOG
- Forward-only migrations (no rollbacks)
- Idempotent migration scripts required
- No DROP COLUMN, ALTER COLUMN TYPE, or data mutation on ledger tables

---

## Maintenance Notes

### Documentation Review Cycle
- Verify against code on each schema change
- Update commit hash on each verification
- Remove deprecated sections (mark as [DEPRECATED] first)
- No silent overwrites (diff first, update only changed sections)

### Schema Change Process
1. Create migration file in `backend/migrations/`
2. Update `backend/src/db.ts` if schema changes
3. Update `backend/src/types.ts` if TypeScript types change
4. Update data dictionary in documentation
5. Update this CHANGELOG with migration details
6. Run integrity verification after migration
7. Update commit hash in all documentation files

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
