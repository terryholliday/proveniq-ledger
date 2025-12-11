# Proveniq Ledger - Partner Onboarding Flow v1.0

**Document ID:** `solutions_engineer_partner_onboarding_v1`  
**Phase:** 3 - Integration Sandbox & Alpha Pilots  
**Status:** APPROVED  
**Classification:** L1_GENERAL  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This document defines the frictionless onboarding process for Alpha partners. The goal is to get a partner from "Signed NDA" to "First Verified Claim" in the Sandbox within 48 hours.

---

## 2. Onboarding Phases

### Phase 0: Discovery & Contract (Sales Led)
- NDA Signed.
- Sandbox Agreement Signed (includes DPA).
- Technical Point of Contact (POC) assigned by Partner.

### Phase 1: Sandbox Provisioning (Automated)
1.  **Welcome Email:** Sent to Partner POC.
    - Contains: Magic Link to Partner Portal (Sandbox).
    - Contains: Link to Developer Docs (Alpha).
2.  **Portal Setup:**
    - Partner logs in via Magic Link.
    - Partner creates their first `API Key` (e.g., `pk_sandbox_...`).
    - Partner configures `Webhook URL` (optional).
3.  **Hello World:**
    - Partner runs `curl` command provided in Portal to test connectivity.
    - **Goal:** Receive `200 OK` from `GET /api/v1/health`.

### Phase 2: Integration (Self-Service + Support)
1.  **SDK Integration:** Partner installs Client SDK (or uses REST API).
2.  **Test Transaction:**
    - Submit a dummy claim.
    - Receive `201 Created` with `eventId`.
3.  **Verify:**
    - Call `GET /api/v1/proofs/{eventId}`.
    - **Goal:** Validate the cryptographic proof.

### Phase 3: Alpha Certification (Human Gate)
- Solutions Engineer reviews Partner's Sandbox usage logs.
- **Checklist:**
    - [ ] No API errors > 5%.
    - [ ] Webhook signature verification confirmed.
    - [ ] Rate limits respected.
- **Outcome:** "Ready for Production" flag enabled (unlocks Prod keys in future).

---

## 3. "Golden Path" Quickstart

To ensure speed, we provide a **Postman Collection** and a **Node.js Script**:

### 3.1 `quickstart.js`

```javascript
const Proveniq = require('@proveniq/sdk');
const client = new Proveniq({ apiKey: 'pk_sandbox_...' });

async function run() {
  console.log('1. Submitting Claim...');
  const claim = await client.claims.create({
    amount: 500.00,
    policyNumber: 'POL-123'
  });
  console.log(`   > Created! ID: ${claim.id}`);

  console.log('2. Verifying Proof...');
  const proof = await client.proofs.verify(claim.id);
  console.log(`   > Valid: ${proof.isValid}`);
}

run();
```

---

## 4. Troubleshooting Playbook

| Symptom | Common Cause | Solution |
|---------|--------------|----------|
| `401 Unauthorized` | Invalid API Key | Rotate key in Portal. |
| `403 Forbidden` | Wrong Partner ID scope | Check JWT claims. |
| `400 Bad Request` | Schema Validation | Check API Reference / Validation errors. |
| `Webhook Timeout` | Partner Firewall | Whitelist Proveniq IPs. |

---

## 5. Approval

| Role | Status | Date |
|------|--------|------|
| Solutions Engineer | ✅ APPROVED | 2024-12-10 |
| Strategic Partnerships | ⏳ PENDING | - |

