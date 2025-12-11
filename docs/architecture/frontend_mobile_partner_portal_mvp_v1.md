# Proveniq Partner Portal MVP - Phase 3

**Document ID:** `frontend_mobile_partner_portal_mvp_v1`  
**Phase:** 3 - Integration Sandbox & Alpha Pilots  
**Status:** APPROVED  
**Classification:** L2_SENSITIVE  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

The Partner Portal MVP provides the essential interface for Alpha partners to onboard, manage credentials, and visualize their integration with the Ledger Sandbox.

---

## 2. MVP Feature Scope

### 2.1 Core Capabilities

1.  **Authentication:** Sign in via magic link (passwordless) or OIDC.
2.  **Dashboard:** High-level metrics (Claims Registered, Proofs Generated).
3.  **API Keys:** Create, view, and revoke API keys.
4.  **Ledger Explorer:** Search and view raw ledger events for their tenant.
5.  **Docs & Support:** Embedded API reference and "Contact Us" for alpha support.

---

## 3. UI/UX Architecture

### 3.1 Tech Stack

- **Framework:** Next.js (React) - Static Export where possible.
- **Styling:** Tailwind CSS + shadcn/ui.
- **Data Fetching:** TanStack Query (React Query).
- **Hosting:** Firebase Hosting or Vercel (connected to Sandbox API).

### 3.2 Key Views (Wireframes)

#### A. Dashboard (`/dashboard`)
```
+------------------------------------------------------------------+
|  Proveniq Partner Portal                     [User Profile]      |
+------------------------------------------------------------------+
|                                                                  |
|  Welcome, Acme Insurance (Sandbox)                               |
|                                                                  |
|  [ Metric Card ]      [ Metric Card ]      [ Metric Card ]       |
|  Total Claims         Verifications        Avg. Latency          |
|  1,240                98.5%                245ms                 |
|                                                                  |
|  Recent Activity                                                 |
|  -------------------------------------------------------------   |
|  CLAIM_CREATED   CLM-9923   2 mins ago   [View Proof]            |
|  RISK_ASSESSED   CLM-9923   1 min ago    [High Risk]             |
|  ...                                                             |
|                                                                  |
+------------------------------------------------------------------+
```

#### B. API Keys (`/settings/keys`)
```
+------------------------------------------------------------------+
|  API Management                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  Active Keys                                                     |
|  -------------------------------------------------------------   |
|  Name           Prefix      Created      Status      Action      |
|  Sandbox Key 1  pk_test...  Oct 12       Active      [Revoke]    |
|                                                                  |
|  [ + Create New Key ]                                            |
|                                                                  |
|  Webhook Configuration                                           |
|  -------------------------------------------------------------   |
|  Endpoint URL:  https://api.acme.com/webhooks/proveniq           |
|  Secret:        whsec_... [Reveal]                               |
|                                                                  |
+------------------------------------------------------------------+
```

#### C. Ledger Explorer (`/explorer`)
```
+------------------------------------------------------------------+
|  Ledger Explorer                                                 |
+------------------------------------------------------------------+
|                                                                  |
|  Search: [ Claim ID or Hash... ]                                 |
|                                                                  |
|  Event Details: EVT-88219                                        |
|  -------------------------------------------------------------   |
|  Timestamp:   2024-12-10 14:22:01 UTC                            |
|  Hash:        8f92a...b21                                        |
|  Prev Hash:   7e11c...a90                                        |
|  Type:        CLAIM_CREATED                                      |
|                                                                  |
|  Payload:                                                        |
|  {                                                               |
|    "amount": 5000.00,                                            |
|    "currency": "USD",                                            |
|    ...                                                           |
|  }                                                               |
|                                                                  |
|  [ Download Merkle Proof ]                                       |
+------------------------------------------------------------------+
```

---

## 4. Security Considerations

- **Secrets:** Full API keys are displayed ONCE upon creation.
- **Session:** Short-lived JWTs (1 hour).
- **Audit:** All portal actions (key creation, searches) are logged to the internal audit trail.

---

## 5. Approval

| Role | Status | Date |
|------|--------|------|
| Frontend Specialist | ✅ APPROVED | 2024-12-10 |
| Product Owner | ⏳ PENDING | - |

