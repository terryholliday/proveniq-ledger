# Firestore as System-of-Record — Exemption Request (Founder Review)

**Apps:** PROVENIQ Home, PROVENIQ Bids, PROVENIQ Ledger (frontend)  
**Standard Reference:** PROVENIQ Platform Standard v1.0 — "Firestore as authoritative storage is not allowed."

## Executive Summary
Firestore currently appears to be used as the primary data store for consumer-facing experiences. This request asks for a **time-bounded exemption** OR approval of a **migration plan** to Supabase Postgres.

## Option 1 — Time-Bounded Exemption (Recommended Only If Needed)
Approve Firestore as an authoritative store **only for**:
- Offline-first UX or real-time sync needs
- Early-stage iteration where schema churn is extreme

**Constraints (must):**
- Firestore data must be treated as *cache-like*; a Postgres projection becomes authoritative by a fixed date.
- Every write path must be mirrored to Postgres within a bounded window (e.g., 60 seconds) once the projection exists.
- A migration cutoff date is mandatory.

## Option 2 — No Exemption (Migrate to Postgres)
Proceed with a phased migration:
- Postgres becomes authoritative
- Firestore becomes read cache / optional offline layer

## Founder Decision (select one)
- [ ] Approve exemption for 90 days with cutoff date: __________
- [ ] No exemption; start migration immediately
- [ ] Hybrid: Firestore allowed for offline cache, but Postgres authoritative starting: __________

## Risks (if exemption is granted)
- Auditability gaps for institutional use cases
- Fragmented enforcement/audit trails
- Long-term migration complexity increases over time
