# Proveniq Ledger API

**Truth Infrastructure for Physical Assets**

The Proveniq Ledger API provides an immutable, append-only ledger for recording and verifying the provenance of physical assets. All events are cryptographically linked in a hash chain, ensuring tamper-evident history.

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build
npm start
```

## Deployment

### Railway
```bash
railway login
railway init
railway up
```

### Docker
```bash
docker build -t proveniq-ledger-api .
docker run -p 3002:3002 proveniq-ledger-api
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3002` |
| `NODE_ENV` | Environment | `development` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `localhost:3000,3001` |

## Health Check

```bash
curl http://localhost:3002/health
```

---

## API Reference

Base URL: `https://ledger-api.proveniq.com/v1/ledger` (production)
Base URL: `http://localhost:3002/v1/ledger` (development)

---

### Authentication

All requests require an `X-API-Key` header (coming soon) or JWT Bearer token.

```http
X-API-Key: pk_your_api_key
# OR
Authorization: Bearer <jwt_token>
```

---

### POST /events

Append a new event to the ledger.

**Request:**
```http
POST /v1/ledger/events
Content-Type: application/json
X-Idempotency-Key: unique-request-id (optional but recommended)

{
  "itemId": "item_abc123",
  "walletId": "wallet_xyz789",
  "eventType": "home.item.registered",
  "payload": {
    "itemType": "jewelry",
    "description": "Diamond ring, 2ct",
    "initialValuation": 15000
  },
  "custodyState": "HOME"  // Optional: triggers custody state transition
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "event": {
      "eventId": "evt_uuid",
      "itemId": "item_abc123",
      "walletId": "wallet_xyz789",
      "eventType": "home.item.registered",
      "payload": { ... },
      "payloadHash": "sha256...",
      "previousHash": "sha256...",
      "hash": "sha256...",
      "timestamp": "2025-01-15T10:30:00Z",
      "sequence": 42
    },
    "chainPosition": 42,
    "previousHash": "sha256...",
    "hash": "sha256..."
  }
}
```

**Error Codes:**
| Code | Status | Description |
|------|--------|-------------|
| `INVALID_PAYLOAD` | 400 | Missing required fields |
| `INVALID_CUSTODY_TRANSITION` | 400 | Invalid state transition |
| `DUPLICATE_IDEMPOTENCY_KEY` | 409 | Request already processed |

---

### GET /events/:eventId

Retrieve a specific event by ID.

**Request:**
```http
GET /v1/ledger/events/evt_abc123
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "event": {
      "eventId": "evt_abc123",
      "itemId": "item_xyz",
      "walletId": "wallet_123",
      "eventType": "home.item.registered",
      "payload": { ... },
      "hash": "sha256...",
      "timestamp": "2025-01-15T10:30:00Z",
      "sequence": 42
    }
  }
}
```

---

### GET /items/:itemId/events

Get complete event history for an item (provenance chain).

**Request:**
```http
GET /v1/ledger/items/item_abc123/events?limit=50&offset=0
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "itemId": "item_abc123",
    "events": [
      { "eventId": "evt_1", "eventType": "home.item.registered", ... },
      { "eventId": "evt_2", "eventType": "home.custody.changed", ... },
      { "eventId": "evt_3", "eventType": "bids.item.listed", ... }
    ],
    "total": 3,
    "limit": 50,
    "offset": 0
  }
}
```

---

### GET /items/:itemId/custody

Get current custody state for an item.

**Request:**
```http
GET /v1/ledger/items/item_abc123/custody
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "custody": {
      "itemId": "item_abc123",
      "currentState": "VAULT",
      "walletId": "wallet_xyz",
      "lastUpdated": "2025-01-15T10:30:00Z",
      "transitionHistory": [
        { "from": "HOME", "to": "IN_TRANSIT", "timestamp": "2025-01-10T...", "eventId": "evt_1" },
        { "from": "IN_TRANSIT", "to": "VAULT", "timestamp": "2025-01-15T...", "eventId": "evt_2" }
      ]
    }
  }
}
```

---

### GET /wallets/:walletId/history

Get all events for a wallet (user activity).

**Request:**
```http
GET /v1/ledger/wallets/wallet_xyz/history?limit=100&eventType=home.item.registered
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "walletId": "wallet_xyz",
    "events": [ ... ],
    "total": 25,
    "limit": 100,
    "offset": 0
  }
}
```

---

### GET /health

Health check and chain statistics.

**Request:**
```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "proveniq-ledger-api",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00Z",
  "chain": {
    "totalEvents": 1523,
    "totalItems": 489,
    "totalWallets": 127,
    "lastHash": "sha256...",
    "sequence": 1523,
    "integrityValid": true
  }
}
```

---

### GET /health/integrity

Full chain integrity verification.

**Request:**
```http
GET /health/integrity
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "checkedAt": "2025-01-15T10:30:00Z"
  }
}
```

---

## Custody State Machine

Valid custody states and transitions:

```
┌────────┐     ┌────────────┐     ┌───────┐
│  HOME  │────▶│ IN_TRANSIT │────▶│ VAULT │
└────────┘     └────────────┘     └───────┘
    │               │                 │
    │               ▼                 │
    │          ┌──────────┐           │
    │          │ RETURNED │           │
    │          └──────────┘           │
    │               │                 │
    ▼               ▼                 ▼
┌────────────────────────────────────────┐
│                 SOLD                    │
│            (Terminal State)             │
└────────────────────────────────────────┘
```

| From State | Valid Transitions |
|------------|-------------------|
| `HOME` | `IN_TRANSIT`, `VAULT`, `SOLD` |
| `IN_TRANSIT` | `HOME`, `VAULT`, `RETURNED` |
| `VAULT` | `IN_TRANSIT`, `HOME`, `SOLD` |
| `RETURNED` | `HOME` |
| `SOLD` | (none - terminal) |

---

## Event Types by App

### HOME App
- `home.item.registered`
- `home.item.updated`
- `home.item.photo_added`
- `home.custody.changed`
- `home.claim.initiated`

### BIDS App
- `bids.item.listed`
- `bids.bid.placed`
- `bids.item.sold`
- `bids.verification.completed`

### CAPITAL App
- `capital.loan.created`
- `capital.loan.defaulted`
- `capital.collateral.seized`
- `capital.settlement.completed`
- `capital.claim.payout_completed`

---

## Idempotency

All write operations support idempotency via the `X-Idempotency-Key` header.

```http
X-Idempotency-Key: unique-request-id-123
```

If the same key is sent twice:
- First request: Creates the event, returns 201
- Second request: Returns the cached result, returns 200

Keys expire after 24 hours.

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CUSTODY_TRANSITION",
    "message": "Invalid transition from HOME to RETURNED",
    "details": {
      "currentState": "HOME",
      "requestedState": "RETURNED",
      "validTransitions": ["IN_TRANSIT", "VAULT", "SOLD"]
    },
    "timestamp": "2025-01-15T10:30:00Z",
    "path": "/v1/ledger/events"
  }
}
```

---

## Rate Limits

| Tier | Requests/min | Burst |
|------|--------------|-------|
| Free | 60 | 10 |
| Partner | 600 | 100 |
| Enterprise | Unlimited | Unlimited |

---

## SDKs

- **JavaScript/TypeScript**: `@proveniq/ledger-sdk` (coming soon)
- **Python**: `proveniq-ledger` (coming soon)

---

## Support

- Documentation: https://docs.proveniq.com/ledger
- API Status: https://status.proveniq.com
- Email: api-support@proveniq.com

---

© 2025-2026 Proveniq. All rights reserved.
