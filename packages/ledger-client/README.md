# @proveniq/ledger-client

Canonical Ledger client for the PROVENIQ ecosystem.

## Installation

```bash
npm install @proveniq/ledger-client
# or
yarn add @proveniq/ledger-client
```

## Usage

```typescript
import { createLedgerClient, HOME_EVENTS } from '@proveniq/ledger-client';

const ledger = createLedgerClient({
  baseUrl: 'http://localhost:8006',
  producer: 'home',
  producerVersion: '1.0.0',
});

// Write a canonical event
await ledger.writeEvent({
  eventType: HOME_EVENTS.HOME_ASSET_REGISTERED,
  subject: { asset_id: 'uuid-here' },
  payload: {
    name: 'Rolex Submariner',
    category: 'watches',
    purchase_price_cents: 1500000,
  },
});

// Or use convenience methods
await ledger.writeHomeEvent(
  'HOME_ASSET_REGISTERED',
  'uuid-here',
  { name: 'Rolex Submariner' }
);
```

## Event Naming Convention

All events follow **DOMAIN_NOUN_VERB_PAST** format:

- ✅ `HOME_ASSET_REGISTERED`
- ✅ `SERVICE_WORK_COMPLETED`
- ✅ `CLAIM_PAYOUT_APPROVED`
- ❌ ~~`registerAsset`~~
- ❌ ~~`home.asset.registered`~~

## Available Event Types

| Domain | Events |
|--------|--------|
| `HOME_` | ASSET_REGISTERED, ASSET_UPDATED, PHOTO_ADDED, DOCUMENT_ATTACHED, VALUATION_UPDATED, CUSTODY_CHANGED, CLAIM_INITIATED |
| `SERVICE_` | WORKORDER_CREATED, PROVIDER_ASSIGNED, PROVIDER_ARRIVED, WORK_COMPLETED, RECORD_CREATED, WORKORDER_CANCELLED, RATING_SUBMITTED |
| `CLAIM_` | INTAKE_RECEIVED, EVIDENCE_ATTACHED, ANALYSIS_COMPLETED, FRAUD_SCORED, PAYOUT_APPROVED, DENIAL_ISSUED, PAYOUT_DISBURSED, SALVAGE_INITIATED |
| `CAPITAL_` | LOAN_APPLIED, LOAN_APPROVED, LOAN_DISBURSED, PAYMENT_RECEIVED, LOAN_DEFAULTED, COLLATERAL_SEIZED, LOAN_CLOSED |
| `OPS_` | SCAN_COMPLETED, SHRINKAGE_DETECTED, ORDER_PLACED, DELIVERY_RECEIVED, PAR_ADJUSTED |
| `PROPERTIES_` | INSPECTION_CREATED, INSPECTION_SIGNED, EVIDENCE_UPLOADED, MAINTENANCE_CREATED, MAINTENANCE_DISPATCHED, DEPOSIT_DISPUTED, LEASE_SIGNED |
| `BIDS_` | AUCTION_LISTED, BID_PLACED, RESERVE_MET, AUCTION_ENDED, AUCTION_SETTLED, AUCTION_CANCELLED |
| `TRANSIT_` | SHIPMENT_CREATED, PACKAGE_PICKEDUP, LOCATION_UPDATED, SHIPMENT_DELIVERED, EXCEPTION_REPORTED, RECEIPT_CONFIRMED |
| `ANCHOR_` | ASSET_BOUND, SEAL_BROKEN, READING_RECORDED, BATTERY_LOW, MOTION_DETECTED, LOCATION_CHANGED, OFFLINE_DETECTED, ONLINE_RESTORED |

## Schema Version

Current schema version: **1.0.0**

All events include `schema_version` in the envelope for forward compatibility.

## License

UNLICENSED - ProvenIQ Technologies
