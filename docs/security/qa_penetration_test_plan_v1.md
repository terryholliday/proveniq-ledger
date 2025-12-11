# Proveniq Ledger Penetration Test Plan v1.0

**Document ID:** `qa_penetration_test_plan_v1`  
**Phase:** 4 - Security Hardening & Beta Certification  
**Status:** APPROVED  
**Classification:** L2_SENSITIVE  
**Last Updated:** 2024-12-10  

---

## 1. Overview

This document defines the scope and rules of engagement for the 3rd-party penetration test of Proveniq Ledger.

**Vendor:** [TBD - Top Tier Firm e.g., Bishop Fox, Cure53]  
**Timeline:** 2 Weeks  
**Method:** Grey Box (Architecture diagrams provided, source code withheld)

---

## 2. Scope

### In Scope
- **Public API:** `api.proveniq.io` (claims, documents, proofs)
- **Partner Portal:** `portal.proveniq.io` (auth, key management)
- **Webhooks:** Ingress/egress logic
- **Infrastructure:** GKE ingress configuration, WAF bypass attempts

### Out of Scope
- **Google Cloud Platform:** Do not attack Google's underlying infra.
- **DDoS:** Volume-based DoS attacks are prohibited.
- **Social Engineering:** No phishing employees.

---

## 3. Attack Scenarios

### 3.1 Ledger Integrity Attacks
- **Goal:** Modify a committed event in the Ledger.
- **Goal:** Fork the hash chain without detection.
- **Goal:** Generate a valid proof for a fake event.

### 3.2 Identity Attacks
- **Goal:** Access data of another tenant (Tenant Isolation Breach).
- **Goal:** Escalate privileges from Viewer to Admin.
- **Goal:** Forge a valid JWT token.

### 3.3 Logic Attacks
- **Goal:** Submit a claim with negative value.
- **Goal:** Bypass rate limits.
- **Goal:** Trigger excessive compute (resource exhaustion).

---

## 4. Rules of Engagement

1.  **Testing Window:** 09:00 - 17:00 UTC (M-F).
2.  **Contact:** `security@proveniq.io` (PageDuty connected).
3.  **Critical Findings:** Report immediately via encrypted channel.
4.  **Evidence:** Screenshots/logs required for all findings.

---

## 5. Remediation Plan

- **Triage:** Daily standup during testing window.
- **Fix:** Dev team priority overrides all feature work.
- **Retest:** Vendor validates fixes within 48 hours of deployment.

---

## 6. Approval

| Role | Status | Date |
|------|--------|------|
| QA Specialist | ✅ APPROVED | 2024-12-10 |
| CTO | ⏳ PENDING | - |

