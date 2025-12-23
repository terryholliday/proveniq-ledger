# PROVENIQ CANONICAL FLOWS (v1.0.0)

> **STATUS:** LOCKED  
> **AUTHORITY:** Terry (Sovereign) / Proveniq Prime  
> **LAST UPDATED:** December 23, 2024

This document defines the **3 Hard Flows** - the canonical event sequences that form the backbone of PROVENIQ's immutable truth layer.

---

## Principles

1. **Every state change → Ledger event**
2. **Events are facts** (past tense, immutable)
3. **Cross-app flows follow strict sequence**
4. **Hash chain integrity is non-negotiable**

---

## FLOW 1: SALE FLOW (Bids)

**Path:** Home → Transit → Bids → Capital → Ledger

### Sequence Diagram

```
┌──────┐     ┌─────────┐     ┌──────┐     ┌─────────┐     ┌────────┐
│ HOME │     │ TRANSIT │     │ BIDS │     │ CAPITAL │     │ LEDGER │
└──┬───┘     └────┬────┘     └──┬───┘     └────┬────┘     └───┬────┘
   │              │             │              │              │
   │ 1. List item for auction   │              │              │
   │──────────────────────────>│              │              │
   │              │             │              │              │
   │              │             │ BIDS_AUCTION_LISTED         │
   │              │             │─────────────────────────────>│
   │              │             │              │              │
   │ 2. Ship to vault           │              │              │
   │─────────────>│             │              │              │
   │              │             │              │              │
   │              │ TRANSIT_SHIPMENT_CREATED   │              │
   │              │────────────────────────────────────────────>│
   │              │             │              │              │
   │              │ TRANSIT_SHIPMENT_DELIVERED │              │
   │              │────────────────────────────────────────────>│
   │              │             │              │              │
   │              │             │ 3. Vault confirms custody   │
   │              │             │<─────────────│              │
   │              │             │              │              │
   │              │             │ 4. Bidding occurs           │
   │              │             │ BIDS_BID_PLACED (×N)        │
   │              │             │─────────────────────────────>│
   │              │             │              │              │
   │              │             │ BIDS_RESERVE_MET            │
   │              │             │─────────────────────────────>│
   │              │             │              │              │
   │              │             │ 5. Auction ends             │
   │              │             │ BIDS_AUCTION_ENDED          │
   │              │             │─────────────────────────────>│
   │              │             │              │              │
   │              │             │ 6. Payment settled          │
   │              │             │──────────────>│              │
   │              │             │              │              │
   │              │             │              │ CAPITAL_PAYMENT_RECEIVED
   │              │             │              │──────────────>│
   │              │             │              │              │
   │              │ 7. Ship to buyer           │              │
   │              │<────────────│              │              │
   │              │             │              │              │
   │              │ TRANSIT_SHIPMENT_CREATED   │              │
   │              │────────────────────────────────────────────>│
   │              │             │              │              │
   │              │ TRANSIT_RECEIPT_CONFIRMED  │              │
   │              │────────────────────────────────────────────>│
   │              │             │              │              │
   │              │             │ BIDS_AUCTION_SETTLED        │
   │              │             │─────────────────────────────>│
   │              │             │              │              │
   │ HOME_CUSTODY_CHANGED (→ new owner)        │              │
   │───────────────────────────────────────────────────────────>│
   │              │             │              │              │
```

### Event Sequence (Strict Order)

| # | Event Type | Producer | Subject IDs | Key Payload |
|---|------------|----------|-------------|-------------|
| 1 | `BIDS_AUCTION_LISTED` | bids | asset_id, auction_id | reserve_price, end_time |
| 2 | `TRANSIT_SHIPMENT_CREATED` | transit | asset_id, shipment_id | carrier, tracking |
| 3 | `TRANSIT_SHIPMENT_DELIVERED` | transit | asset_id, shipment_id | delivered_at, recipient |
| 4 | `BIDS_BID_PLACED` | bids | asset_id, auction_id | bid_amount, bidder_id |
| 5 | `BIDS_RESERVE_MET` | bids | asset_id, auction_id | final_price |
| 6 | `BIDS_AUCTION_ENDED` | bids | asset_id, auction_id | winner_id, final_price |
| 7 | `CAPITAL_PAYMENT_RECEIVED` | capital | asset_id, auction_id | amount, payer_id |
| 8 | `TRANSIT_SHIPMENT_CREATED` | transit | asset_id, shipment_id | to_buyer |
| 9 | `TRANSIT_RECEIPT_CONFIRMED` | transit | asset_id, shipment_id | confirmed_by |
| 10 | `BIDS_AUCTION_SETTLED` | bids | asset_id, auction_id | settlement_hash |
| 11 | `HOME_CUSTODY_CHANGED` | home | asset_id | new_owner_id, from: VAULT, to: HOME |

---

## FLOW 2: SERVICE FLOW (Maintenance)

**Path:** Home/Properties → Service → Provider → Ledger

### Sequence Diagram

```
┌──────────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐
│HOME/PROPERTIES│     │ SERVICE  │     │ PROVIDER │     │ LEDGER │
└──────┬───────┘     └────┬─────┘     └────┬─────┘     └───┬────┘
       │                  │                │               │
       │ 1. Report issue  │                │               │
       │─────────────────>│                │               │
       │                  │                │               │
       │                  │ SERVICE_WORKORDER_CREATED      │
       │                  │────────────────────────────────>│
       │                  │                │               │
       │                  │ 2. Assign provider             │
       │                  │───────────────>│               │
       │                  │                │               │
       │                  │ SERVICE_PROVIDER_ASSIGNED      │
       │                  │────────────────────────────────>│
       │                  │                │               │
       │                  │ 3. Provider schedules          │
       │                  │<───────────────│               │
       │                  │                │               │
       │ 4. Tenant confirms slot          │               │
       │<─────────────────│                │               │
       │                  │                │               │
       │                  │ 5. Provider arrives            │
       │                  │<───────────────│               │
       │                  │                │               │
       │                  │ SERVICE_PROVIDER_ARRIVED       │
       │                  │────────────────────────────────>│
       │                  │                │               │
       │                  │ 6. Work completed              │
       │                  │<───────────────│               │
       │                  │                │               │
       │                  │ SERVICE_WORK_COMPLETED         │
       │                  │────────────────────────────────>│
       │                  │                │               │
       │                  │ 7. Evidence submitted          │
       │                  │<───────────────│               │
       │                  │                │               │
       │                  │ SERVICE_RECORD_CREATED         │
       │                  │────────────────────────────────>│
       │                  │                │               │
       │ 8. Rate provider │                │               │
       │─────────────────>│                │               │
       │                  │                │               │
       │                  │ SERVICE_RATING_SUBMITTED       │
       │                  │────────────────────────────────>│
       │                  │                │               │
```

### Event Sequence (Strict Order)

| # | Event Type | Producer | Subject IDs | Key Payload |
|---|------------|----------|-------------|-------------|
| 1 | `SERVICE_WORKORDER_CREATED` | service | asset_id, work_order_id | issue_type, urgency |
| 2 | `SERVICE_PROVIDER_ASSIGNED` | service | asset_id, work_order_id | provider_id, eta |
| 3 | `SERVICE_PROVIDER_ARRIVED` | service | asset_id, work_order_id | arrived_at, location |
| 4 | `SERVICE_WORK_COMPLETED` | service | asset_id, work_order_id | completed_at, notes |
| 5 | `SERVICE_RECORD_CREATED` | service | asset_id, work_order_id | evidence_hashes, cost_cents, parts_used |
| 6 | `SERVICE_RATING_SUBMITTED` | service | asset_id, work_order_id | rating, review_text |

### Evidence Package (SERVICE_RECORD_CREATED payload)

```typescript
{
  work_order_id: string;
  provider_id: string;
  evidence: {
    before_photos_hashes: string[];  // SHA-256
    after_photos_hashes: string[];   // SHA-256
    parts_replaced: Array<{ name: string; cost_cents: number }>;
    labor_minutes: number;
    labor_cost_cents: number;
    total_cost_cents: number;
  };
  warranty: {
    duration_days: number;
    coverage: string;
  } | null;
  signatures: {
    provider_sig: string;  // Ed25519 of evidence hash
  };
}
```

---

## FLOW 3: CLAIMS FLOW (ClaimsIQ)

**Path:** Home/Properties/Ops → ClaimsIQ → Capital → Ledger

### Sequence Diagram

```
┌─────────────────┐    ┌──────────┐    ┌─────────┐    ┌────────┐
│HOME/PROPS/OPS   │    │ CLAIMSIQ │    │ CAPITAL │    │ LEDGER │
└───────┬─────────┘    └────┬─────┘    └────┬────┘    └───┬────┘
        │                   │               │             │
        │ 1. Submit claim   │               │             │
        │──────────────────>│               │             │
        │                   │               │             │
        │                   │ CLAIM_INTAKE_RECEIVED       │
        │                   │────────────────────────────>│
        │                   │               │             │
        │ 2. Attach evidence│               │             │
        │──────────────────>│               │             │
        │                   │               │             │
        │                   │ CLAIM_EVIDENCE_ATTACHED     │
        │                   │────────────────────────────>│
        │                   │               │             │
        │                   │ 3. AI Analysis              │
        │                   │ CLAIM_ANALYSIS_COMPLETED    │
        │                   │────────────────────────────>│
        │                   │               │             │
        │                   │ 4. Fraud scoring            │
        │                   │ CLAIM_FRAUD_SCORED          │
        │                   │────────────────────────────>│
        │                   │               │             │
        │                   │ 5. Decision                 │
        │                   │ (APPROVED or DENIED)        │
        │                   │               │             │
        ├───────────────────┼───────────────┼─────────────┤
        │ IF APPROVED:      │               │             │
        │                   │ CLAIM_PAYOUT_APPROVED       │
        │                   │────────────────────────────>│
        │                   │               │             │
        │                   │ 6. Initiate payout          │
        │                   │──────────────>│             │
        │                   │               │             │
        │                   │               │ CLAIM_PAYOUT_DISBURSED
        │                   │               │────────────>│
        │                   │               │             │
        ├───────────────────┼───────────────┼─────────────┤
        │ IF DENIED:        │               │             │
        │                   │ CLAIM_DENIAL_ISSUED         │
        │                   │────────────────────────────>│
        │                   │               │             │
        ├───────────────────┼───────────────┼─────────────┤
        │ IF SALVAGE:       │               │             │
        │                   │ CLAIM_SALVAGE_INITIATED     │
        │                   │────────────────────────────>│
        │                   │               │             │
        │                   │ (→ BIDS SALE FLOW)          │
        │                   │               │             │
```

### Event Sequence (Strict Order)

| # | Event Type | Producer | Subject IDs | Key Payload |
|---|------------|----------|-------------|-------------|
| 1 | `CLAIM_INTAKE_RECEIVED` | claimsiq | asset_id, claim_id | claim_type, claimant_id, incident_date |
| 2 | `CLAIM_EVIDENCE_ATTACHED` | claimsiq | asset_id, claim_id | evidence_hash, evidence_type |
| 3 | `CLAIM_ANALYSIS_COMPLETED` | claimsiq | asset_id, claim_id | damage_assessment, valuation_cents |
| 4 | `CLAIM_FRAUD_SCORED` | claimsiq | asset_id, claim_id | score, risk_level, signals |
| 5a | `CLAIM_PAYOUT_APPROVED` | claimsiq | asset_id, claim_id | approved_amount_cents, adjuster_id |
| 5b | `CLAIM_DENIAL_ISSUED` | claimsiq | asset_id, claim_id | denial_reason, appeal_deadline |
| 6 | `CLAIM_PAYOUT_DISBURSED` | capital | asset_id, claim_id | amount_cents, recipient_id, tx_ref |
| 7 | `CLAIM_SALVAGE_INITIATED` | claimsiq | asset_id, claim_id | salvage_value_cents, auction_id |

### Claim Types by Source

| Source App | Claim Type | Event Entry Point |
|------------|------------|-------------------|
| **Home** | Personal property loss/theft | `HOME_CLAIM_INITIATED` → `CLAIM_INTAKE_RECEIVED` |
| **Properties** | Deposit dispute | `PROPERTIES_DEPOSIT_DISPUTED` → `CLAIM_INTAKE_RECEIVED` |
| **Ops** | Shrinkage/spoilage | `OPS_SHRINKAGE_DETECTED` → `CLAIM_INTAKE_RECEIVED` |

---

## Cross-Flow Integrity Rules

### Rule 1: No Event Skipping
Every flow **MUST** emit events in the defined sequence. Skipping events = invalid state.

### Rule 2: Correlation ID Propagation
All events in a flow share the same `correlation_id`. This enables end-to-end tracing.

### Rule 3: Asset ID Consistency
The `subject.asset_id` must be the same PROVENIQ Asset ID (PAID) across all events in a flow.

### Rule 4: Hash Chain Continuity
Every event references the previous event's hash via the Ledger's hash chain. Breaking the chain = system failure.

### Rule 5: Idempotency
Every event has a unique `idempotency_key`. Duplicate submissions are rejected silently.

---

## Validation Checklist

Before going live, verify:

- [ ] All events follow `DOMAIN_NOUN_VERB_PAST` naming
- [ ] All events include required envelope fields
- [ ] All events include `canonical_hash_hex` of payload
- [ ] Correlation IDs propagate through entire flow
- [ ] No events are skipped in sequence
- [ ] Hash chain integrity verified

---

*© 2024 ProvenIQ Technologies. Confidential.*
