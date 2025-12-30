# PROVENIQ Memory (Ledger) - Documentation Index

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Table of Contents

### Getting Started
- [Documentation Home](README.md)
- [Glossary](glossary.md)
- [CHANGELOG](CHANGELOG.md)

### Platform Documentation
- [Architecture Overview](platform/architecture-overview.md)
  - System context diagram
  - Component architecture
  - Data flow patterns
  - Integration points
- [Security Model](platform/security-model.md)
  - Authentication mechanisms
  - Authorization model
  - Threat model
  - Security boundaries
- [Ledger Integration](platform/ledger-integration.md)
  - Producer onboarding
  - Event schema compliance
  - API integration patterns
  - Error handling
- [Environments and Configuration](platform/environments-and-configuration.md)
  - Environment variables reference
  - Production deployment checklist
  - Configuration validation
  - SSL/TLS requirements

### Ledger-Specific Documentation
- [Proof of Integrity](ledger/proof-of-integrity.md)
  - External verification procedure
  - Hash chain validation
  - Expected outputs
  - Pass/fail interpretation
- [Immutability Guarantees](ledger/immutability-guarantees.md)
  - WORM trigger implementation
  - Database constraints
  - Replay protection
  - Impossibilities catalog
- [Genesis Procedure](ledger/genesis-procedure.md)
  - Root of trust establishment
  - Empty-state initialization
  - Determinism requirements
  - Irreversibility guarantees

### Application Documentation
- [Application README](app/README.md)
  - Service overview
  - Key entities
  - Dependencies
  - Configuration reference
- [Data Dictionary](app/data-dictionary.md)
  - Entity relationship diagram
  - Table schemas
  - Field definitions
  - Index catalog
- [Workflows](app/workflows.md)
  - Canonical event ingestion
  - Legacy event ingestion
  - Event query patterns
  - Integrity verification
- [User Guide](app/user-guide.md)
  - API endpoint reference
  - Authentication setup
  - Event submission
  - Query operations
- [Troubleshooting](app/troubleshooting.md)
  - Error code reference
  - Common issues
  - Resolution procedures
  - Diagnostic commands
- [FAQ](app/faq.md)
  - Common questions
  - Performance expectations
  - Security clarifications
  - Integration guidance

---

## Quick Navigation by Role

### For Auditors
1. [Proof of Integrity](ledger/proof-of-integrity.md) - Verify hash chain externally
2. [Immutability Guarantees](ledger/immutability-guarantees.md) - Understand enforcement mechanisms
3. [Data Dictionary](app/data-dictionary.md) - Review schema and constraints

### For Developers
1. [Ledger Integration](platform/ledger-integration.md) - Integration guide
2. [User Guide](app/user-guide.md) - API reference
3. [Troubleshooting](app/troubleshooting.md) - Error resolution

### For Operations
1. [Environments and Configuration](platform/environments-and-configuration.md) - Deployment setup
2. [User Guide](app/user-guide.md) - Operational procedures
3. [Troubleshooting](app/troubleshooting.md) - Issue diagnosis

### For Compliance
1. [Security Model](platform/security-model.md) - Security architecture
2. [Immutability Guarantees](ledger/immutability-guarantees.md) - Data integrity
3. [Proof of Integrity](ledger/proof-of-integrity.md) - Verification procedures

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
