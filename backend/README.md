# PROVENIQ Ledger Backend

**The Immutable Event Store**

The Ledger is the single source of truth for all events in the PROVENIQ ecosystem. Every action—custody transfers, seal events, valuations, claims—is recorded immutably with cryptographic hash chaining.

## Architecture

```
ALL PROVENIQ SERVICES → [Ledger API] → PostgreSQL (Hash-Chained)
                              ↓
                    Integrity Verification
                    Audit Log
```

## Key Features

- **Hash Chaining:** Each entry includes SHA-256 hash of payload + previous entry hash
- **Immutability:** No updates or deletes—append-only log
- **Integrity Verification:** Verify chain integrity at any time
- **Audit Log:** All access and verification attempts logged

## Setup

1. Copy `.env.example` to `.env` and configure:
   - `DATABASE_URL` (PostgreSQL)
   - `ADMIN_API_KEY` (strong key)
   - `PORT` (default: 8006)
2. Install deps: `npm install`
3. Run dev: `npm run dev`

## API Endpoints

### Event Ingestion (New API)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/events` | Ingest new event |

### Event Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/events` | Query events with filters |
| `GET` | `/api/v1/events/:id` | Get single event |
| `GET` | `/api/v1/assets/:assetId/events` | Events for asset |
| `GET` | `/api/v1/anchors/:anchorId/events` | Events for anchor |

### Integrity & Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/integrity/verify` | Verify chain integrity |
| `GET` | `/api/v1/stats` | Ledger statistics |
| `GET` | `/health` | Health check |

### Legacy Endpoints (backward compatible)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/ledger/entries` | Legacy ingest |
| `GET` | `/v1/ledger/entries/:id` | Legacy fetch |

## Event Schema (New API)

```json
{
  "source": "anchors",
  "event_type": "ANCHOR_SEAL_BROKEN",
  "asset_id": "uuid (optional)",
  "anchor_id": "string (optional)",
  "correlation_id": "string (optional)",
  "actor_id": "string (optional)",
  "payload": { ... }
}
```

## Valid Sources

`anchors`, `home`, `bids`, `claimsiq`, `capital`, `ops`, `properties`, `service`, `transit`, `protect`, `origins`, `core`, `system`

## Hash Chain Structure

Each entry contains:
- `payload_hash`: SHA-256 of the payload JSON
- `previous_hash`: Entry hash of the previous entry (or null for genesis)
- `entry_hash`: SHA-256 of `payload_hash|previous_hash|source|event_type|timestamp`

This creates an immutable chain where tampering with any entry breaks the chain.

## Auth

Provide `x-api-key: <ADMIN_API_KEY>` or `Authorization: Bearer <Firebase ID token>`.
