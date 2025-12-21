# Proveniq Ledger Backend

Minimal ingest/fetch API for ledger entries. Secured by Firebase ID tokens or `x-api-key`.

## Setup
1) Copy `.env.example` to `.env` and fill:
   - `DATABASE_URL` (Postgres)
   - `ADMIN_API_KEY` (strong key)
   - `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` if using Firebase auth
2) Install deps: `cd backend && npm install`
3) Run dev: `npm run dev` (uses tsx)

## API
- `GET /health` → `{ status: 'UP', service: 'proveniq-ledger' }`
- `POST /v1/ledger/entries` (auth required)
  ```json
  {
    "app": "proveniq-ops",
    "event_type": "ops.shrinkage.detected",
    "correlation_id": "uuid",
    "payload": { "any": "json" }
  }
  ```
  Returns: `{ id, status: "accepted" }`
- `GET /v1/ledger/entries/:id` (auth required)

Auth: Provide `x-api-key: <ADMIN_API_KEY>` or `Authorization: Bearer <Firebase ID token>`.
