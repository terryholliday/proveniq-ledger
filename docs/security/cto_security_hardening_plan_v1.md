# Proveniq Ledger Security Hardening & Remediation Plan v1.0

**Document ID:** `cto_security_hardening_plan_v1`  
**Phase:** 4 - Security Hardening & Beta Certification  
**Status:** APPROVED  
**Classification:** L3_TRADE_SECRET  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This plan outlines the critical security hardening measures required before Proveniq Ledger exits Beta. It synthesizes findings from architectural review, threat modeling, and preliminary vulnerability scans.

---

## 2. Threat Model Update (STRIDE)

| Threat | Component | Risk | Mitigation Strategy |
|--------|-----------|------|---------------------|
| **Spoofing** | API Gateway | High | mTLS + IAP everywhere. No public endpoints without auth. |
| **Tampering** | Ledger Events | Critical | Truth Kernel cryptographic chaining. Append-only DB rules. |
| **Repudiation** | Audit Logs | High | Immutable audit trails shipped to separate project (Log Bucket). |
| **Info Disclosure** | PII Fields | Critical | Field-level encryption (CMEK). DLP scanning on egress. |
| **DoS** | Public API | Medium | Cloud Armor WAF + Rate Limiting (100 req/s/IP). |
| **Elevation** | IAM Roles | High | Least Privilege. Workload Identity. No long-lived keys. |

---

## 3. Hardening Epics

### Epic 1: Identity & Access Lockdown
- [ ] **Disable Default SAs:** Remove default Compute Engine service accounts.
- [ ] **Workload Identity:** Enforce GKE Workload Identity for all pods.
- [ ] **IAP Enforcement:** All internal tools (Grafana, Admin) behind Identity-Aware Proxy.
- [ ] **Key Rotation:** Automate 90-day rotation for all CMEK and Service Account keys.

### Epic 2: Network Fortress
- [ ] **Private GKE:** Disable public IP access to GKE control plane (authorized networks only).
- [ ] **Egress Lockdown:** Restrict egress traffic to known domains (GCP APIs, Partner Webhooks).
- [ ] **VPC Service Controls:** Define security perimeter around Ledger data.

### Epic 3: Supply Chain Security
- [ ] **Binary Auth:** Enforce image signing (Cosign) for all production containers.
- [ ] **SBOM Generation:** Generate SBOMs for every build; scan for CVEs.
- [ ] **Dependency Pinning:** Pin all NPM dependencies to exact versions.

### Epic 4: Secret Management
- [ ] **Secret Manager:** Migrate any remaining ENV vars to Secret Manager.
- [ ] **No Shell Access:** Disable `kubectl exec` for production namespaces.
- [ ] **Just-in-Time Access:** Implement JIT access for production debugging.

---

## 4. Remediation SLAs

| Severity | Time to Fix | Verification Required |
|----------|-------------|-----------------------|
| **Critical** | 24 Hours | Red Team re-test |
| **High** | 72 Hours | Automated scan clean |
| **Medium** | 2 Weeks | Code review |
| **Low** | 90 Days | Backlog grooming |

---

## 5. Beta Certification Gates

The following must be **TRUE** to exit Beta:
- [ ] Zero Critical/High vulnerabilities in Pen Test.
- [ ] SOC 2 Type I Report signed.
- [ ] DR Drill executed with RTO < 15 mins.
- [ ] 100% of PII fields encrypted.

---

## 6. Approval

| Role | Status | Date |
|------|--------|------|
| CTO | ✅ APPROVED | 2024-12-10 |
| CEO | ⏳ PENDING | - |

