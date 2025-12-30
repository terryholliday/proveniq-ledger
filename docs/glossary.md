# PROVENIQ Memory (Ledger) - Glossary

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0

---

## Canonical Vocabulary

This glossary defines terms as they are used in PROVENIQ Memory (Ledger) documentation and code. Definitions are based on actual implementation, not aspirational features.

---

### A

**Advisory Lock**  
A PostgreSQL locking mechanism (`pg_advisory_xact_lock`) that serializes concurrent transactions without locking table rows. Used in canonical event ingestion to prevent hash chain forks. [SHIPPED]

**Anchor**  
A physical hardware device (SmartTag, SmartBag, SmartLocker) that binds digital records to physical assets. Anchors produce events consumed by the Ledger. [SHIPPED]

**Anchor ID**  
A unique identifier for an Anchor device, stored in the `anchor_id` field of ledger entries. Maximum 64 characters. [SHIPPED]

**Asset ID**  
A UUID identifying a physical asset in the PROVENIQ ecosystem. Also called PAID (PROVENIQ Asset ID). Required field in canonical event schema. [SHIPPED]

**Audit Log**  
An append-only table (`audit_log`) recording all access and verification attempts against the Ledger. Protected by WORM triggers. [SHIPPED]

---

### C

**Canonical Event**  
An event conforming to the v1.0.0 canonical envelope schema with strict validation. Uses `DOMAIN_NOUN_VERB_PAST` naming convention. [SHIPPED]

**Canonical Hash**  
SHA-256 hash of the event payload, stored in `canonical_hash_hex` field. Used for payload integrity verification. [SHIPPED]

**Chain Break**  
An integrity violation where an entry's `previous_hash` does not match the previous entry's `entry_hash`. Indicates hash chain corruption. [SHIPPED]

**Committed At**  
Server-authoritative timestamp (ISO 8601) when the Ledger accepted an event. Set by the Ledger service, not the producer. [SHIPPED]

**Concurrency Safety**  
The guarantee that concurrent writes to the Ledger cannot produce hash chain forks. Enforced via PostgreSQL advisory locks. [SHIPPED]

**Correlation ID**  
A UUID linking related events across multiple services. Optional field in event schema. [SHIPPED]

---

### E

**Entry Hash**  
SHA-256 hash computed as: `SHA256(payload_hash | previous_hash | source | event_type | timestamp)`. Links each entry to the previous entry in the chain. [SHIPPED]

**Event Bus**  
A pub/sub system for distributing Ledger events to subscribers. Separate from the core Ledger write path. [SHIPPED]

**Event ID**  
A UUID uniquely identifying a ledger entry. Primary key of `ledger_entries` table. Also called `id`. [SHIPPED]

**Event Type**  
A string identifying the type of event using `DOMAIN_NOUN_VERB_PAST` format (e.g., `ANCHOR_SEAL_BROKEN`). Must match a registered canonical event type. [SHIPPED]

---

### G

**Genesis Block**  
The first entry in the Ledger chain, with `previous_hash = null` and `sequence_number = 0`. Establishes the root of trust. [SHIPPED]

---

### H

**Hash Chain**  
A cryptographic data structure where each entry contains the hash of the previous entry, creating an immutable sequence. Breaking any link invalidates all subsequent entries. [SHIPPED]

**Hard Enforcement**  
Security or integrity guarantees enforced by code, database constraints, or cryptography. Cannot be bypassed by policy changes. Opposite of Soft Enforcement. [SHIPPED]

---

### I

**Idempotency Key**  
A client-provided string (max 256 chars) ensuring duplicate event submissions are rejected. Enforced via partial UNIQUE index. [SHIPPED]

**Immutability**  
The property that ledger entries cannot be modified or deleted after creation. Enforced via PostgreSQL BEFORE UPDATE/DELETE triggers. [SHIPPED]

**Integrity Checkpoint**  
A snapshot of the Ledger state at a specific sequence number, stored in `integrity_checkpoints` table. Used for verification audits. [SHIPPED]

**Integrity Violation**  
A failure in hash chain verification, including payload hash mismatch, entry hash mismatch, or chain break. [SHIPPED]

---

### L

**Ledger Entry**  
A single immutable record in the `ledger_entries` table, representing one event in the hash chain. [SHIPPED]

**Legacy Event**  
An event submitted via the backward-compatible `/api/v1/events` endpoint, not conforming to canonical schema. [SHIPPED]

---

### M

**Machine-Enforced**  
See Hard Enforcement. [SHIPPED]

---

### O

**Occurred At**  
Client-provided timestamp (ISO 8601) indicating when the event happened in the real world. Optional field, distinct from `committed_at`. [SHIPPED]

---

### P

**Payload**  
The JSONB field containing event-specific data. Hashed to produce `payload_hash`. [SHIPPED]

**Payload Hash**  
SHA-256 hash of the payload JSON with deterministic key ordering. Stored in `payload_hash` field. [SHIPPED]

**Policy-Enforced**  
See Soft Enforcement. [SHIPPED]

**Previous Hash**  
The `entry_hash` of the previous ledger entry. `null` for Genesis block. Links entries in the hash chain. [SHIPPED]

**Producer**  
A PROVENIQ service that writes events to the Ledger. Valid producers: `anchors-ingest`, `service`, `transit`, `protect`, `claimsiq`, `capital`, `bids`, `ops`, `properties`, `home`, `origins`, `core`. [SHIPPED]

**Producer Version**  
Semantic version (e.g., `1.0.0`) of the producer service that created the event. Optional field. [SHIPPED]

---

### R

**Replay Protection**  
Mechanisms preventing duplicate event ingestion, including unique constraints on `event_id` and `idempotency_key`. [SHIPPED]

---

### S

**Schema Version**  
The version of the canonical event envelope schema. Current version: `1.0.0`. [SHIPPED]

**Sequence Number**  
A monotonically increasing BIGSERIAL integer uniquely identifying each entry's position in the chain. Enforced via UNIQUE constraint. [SHIPPED]

**Sequence Gap**  
An integrity violation where sequence numbers are not contiguous (e.g., 100, 101, 103 - missing 102). [SHIPPED]

**Signatures**  
Optional JSONB field containing cryptographic signatures from devices or service providers. Structure: `{device_sig, provider_sig}`. [SHIPPED]

**Soft Enforcement**  
Security or integrity guarantees enforced by organizational policy or convention, not by code. Can be bypassed by policy changes. Opposite of Hard Enforcement. [SHIPPED]

**Subject**  
A JSONB field containing identifiers for entities related to the event (asset_id, anchor_id, shipment_id, etc.). Required field in canonical schema. [SHIPPED]

---

### W

**WORM (Write Once, Read Many)**  
A data storage model where records can be created but never modified or deleted. Enforced via PostgreSQL triggers in the Ledger. [SHIPPED]

**WORM Trigger**  
A PostgreSQL BEFORE UPDATE/DELETE trigger that raises `integrity_constraint_violation` to prevent mutations. Applied to `ledger_entries` and `audit_log` tables. [SHIPPED]

---

## Abbreviations

| Abbreviation | Full Term | Definition |
|--------------|-----------|------------|
| **PAID** | PROVENIQ Asset ID | UUID identifying a physical asset |
| **WORM** | Write Once, Read Many | Immutable storage model |
| **ERD** | Entity Relationship Diagram | Visual representation of database schema |
| **UUID** | Universally Unique Identifier | 128-bit identifier (RFC 4122) |
| **JSONB** | JSON Binary | PostgreSQL binary JSON data type |
| **SHA-256** | Secure Hash Algorithm 256-bit | Cryptographic hash function |
| **ISO 8601** | International date/time standard | Format: `YYYY-MM-DDTHH:MM:SSZ` |

---

## Event Naming Convention

**Format:** `DOMAIN_NOUN_VERB_PAST`

**Examples:**
- `ANCHOR_SEAL_BROKEN` (not `BREAK_ANCHOR_SEAL`)
- `SERVICE_RECORD_CREATED` (not `CREATE_SERVICE_RECORD`)
- `TRANSIT_SHIPMENT_DELIVERED` (not `DELIVER_SHIPMENT`)

**Rules:**
1. All uppercase
2. Underscore-separated
3. Past tense verb (events are facts, not commands)
4. Domain prefix identifies the producing service

---

**Last Verified Against Commit:** `4146303`  
**Schema Version:** 1.0.0
