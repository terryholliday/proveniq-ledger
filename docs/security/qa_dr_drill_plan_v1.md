# Proveniq Ledger Disaster Recovery (DR) Drill Plan v1.0

**Document ID:** `qa_dr_drill_plan_v1`  
**Phase:** 4 - Security Hardening & Beta Certification  
**Status:** APPROVED  
**Classification:** L3_TRADE_SECRET  
**Last Updated:** 2024-12-10  

---

## 1. Drill Objective

Simulate a **total region failure** of `us-east1` to validate:
1.  **RTO (Recovery Time Objective):** < 15 minutes.
2.  **RPO (Recovery Point Objective):** < 5 minutes (data loss).
3.  **Ledger Integrity:** Chain remains verifiable after failover.

---

## 2. Scenario: "The Great East Coast Outage"

- **Primary Region:** `us-east1` (DOWN)
- **DR Region:** `us-west1` (Standby)
- **Trigger:** Manual shutdown of GKE and Cloud SQL primary in East.

---

## 3. Drill Steps

### Step 1: Baseline (T-0)
- Verify `us-east1` is processing traffic.
- Verify Cloud SQL replication to `us-west1` is healthy (lag < 1s).
- Run `verify-ledger-integrity.sh` script (Result: PASS).

### Step 2: The Event (T+1 min)
- **Action:** Stop GKE cluster in `us-east1`.
- **Action:** Simulate network partition to Cloud SQL primary.
- **Observation:** API returns `503 Service Unavailable`. Alerts fire.

### Step 3: Failover (T+5 min)
- **Action:** Promote Cloud SQL replica in `us-west1` to Primary.
- **Action:** Update DNS / Load Balancer to point to `us-west1` GKE.
- **Action:** Scale up `us-west1` GKE node pool.

### Step 4: Verification (T+15 min)
- **Action:** API traffic flows to `us-west1`.
- **Action:** Submit new claim (Event N+1).
- **Action:** Run `verify-ledger-integrity.sh`.
    - **CRITICAL CHECK:** Does Event N+1 correctly link to Event N (from East)?
    - **CRITICAL CHECK:** Are proofs generated in East still valid?

### Step 5: Failback (T+60 min)
- Rebuild `us-east1` as replica.
- Scheduled maintenance window to switch back (optional).

---

## 4. Success Criteria

1.  **Zero Chain Corruption:** Hash links preserved across region boundary.
2.  **API Availability:** Restored within 15 minutes.
3.  **Data Loss:** No more than last 5 minutes of transactions lost (async replication window).

---

## 5. Approval

| Role | Status | Date |
|------|--------|------|
| QA Specialist | ✅ APPROVED | 2024-12-10 |
| Lead Architect | ⏳ PENDING | - |

