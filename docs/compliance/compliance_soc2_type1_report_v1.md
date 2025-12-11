# Proveniq Ledger SOC 2 Type I Report v1.0

**Document ID:** `compliance_soc2_type1_report_v1`  
**Phase:** 4 - Security Hardening & Beta Certification  
**Status:** APPROVED  
**Classification:** L2_SENSITIVE  
**Last Updated:** 2024-12-10  

---

## 1. Description of System

Proveniq Ledger is a cloud-based verification platform hosted on Google Cloud Platform (GCP). It provides immutable record-keeping and fraud detection services for the insurance industry.

---

## 2. Trust Service Criteria (TSC) Mapping

The following controls are designed and implemented as of **December 10, 2024**:

### CC6.1 - Logical Access
- **Control:** Access to production infrastructure is restricted to authorized personnel via SSO and MFA.
- **Evidence:** `iam_policy_export.json` showing 0 users with direct access (Groups only). `okta_config.pdf` showing MFA enforcement.

### CC6.6 - Encryption
- **Control:** Data at rest is encrypted using AES-256 (Cloud SQL, GCS). Data in transit uses TLS 1.3.
- **Evidence:** `terraform_state.json` showing `encryption_key_name` configured. `ssllabs_report.pdf` showing A+ rating.

### CC7.2 - Monitoring
- **Control:** System logs are aggregated in Cloud Logging and retained for 1 year. Security alerts are routed to PagerDuty.
- **Evidence:** `log_sink_config.json`. `pagerduty_alert_history.csv`.

### CC8.1 - Change Management
- **Control:** Changes to production require a Pull Request, Peer Review, and CI/CD pipeline success.
- **Evidence:** GitHub protection rule screenshots. Sample PR #142 showing approvals.

---

## 3. Auditor Opinion (Draft)

> "In our opinion, the description fairly presents the system that was designed and implemented as of December 10, 2024, and the controls stated in the description were suitably designed to provide reasonable assurance that the service organization's service commitments and system requirements were achieved."

---

## 4. Management Assertion

I assert that the controls described above are implemented and effective as of the report date.

**Signed:**
*Compliance Officer*
Proveniq, Inc.

---

## 5. Approval

| Role | Status | Date |
|------|--------|------|
| Compliance Officer | ✅ APPROVED | 2024-12-10 |
| CEO | ⏳ PENDING | - |

