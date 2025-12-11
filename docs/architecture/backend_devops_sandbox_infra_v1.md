# Proveniq Ledger Sandbox Infrastructure & CI/CD v1.0

**Document ID:** `backend_devops_sandbox_infra_v1`  
**Phase:** 3 - Integration Sandbox & Alpha Pilots  
**Status:** APPROVED  
**Classification:** L2_SENSITIVE  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This document details the infrastructure and CI/CD pipelines required to deploy and manage the **Integration Sandbox**. This environment mirrors production but uses synthetic data and is isolated for partner testing.

---

## 2. Sandbox Environment Topology

### 2.1 GCP Project Structure

```
proveniq-org/
├── proveniq-ledger-sandbox      # NEW: Isolated Sandbox
│   ├── GKE cluster (sandbox)
│   ├── Cloud SQL (sandbox)
│   ├── Cloud Storage (sandbox)
│   └── Secret Manager (sandbox)
```

**Isolation:** The Sandbox environment is a completely separate GCP project to preventing accidental access to Production data or secrets.

### 2.2 Resource Sizing (Cost Optimized)

| Resource | Spec | Rationale |
|----------|------|-----------|
| **GKE** | Autopilot (Min replicas: 1) | Scale to zero capabilities |
| **DB** | db-custom-1-3840 (Smallest viable) | Low volume, functional testing |
| **Redis** | 1GB Basic Tier | No HA required for sandbox |

---

## 3. CI/CD Pipeline Design

### 3.1 Pipeline Stages (GitHub Actions)

```yaml
name: Deploy to Sandbox

on:
  push:
    branches: [ "main" ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Install & Test
        run: |
          npm ci
          npm test
      - name: Build Container
        run: docker build . -t gcr.io/proveniq-ledger-sandbox/api:${GITHUB_SHA}

  deploy-infra:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Terraform Apply
        run: |
          cd infrastructure/terraform/environments/sandbox
          terraform init
          terraform apply -auto-approve

  deploy-app:
    needs: deploy-infra
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GKE
        run: |
          gcloud container clusters get-credentials ledger-cluster-sandbox
          kubectl set image deployment/ledger-api api=gcr.io/proveniq-ledger-sandbox/api:${GITHUB_SHA}
```

### 3.2 Feature Flags

The Sandbox environment will enable specific "Alpha" features via environment variables:
- `ENABLE_WEBHOOKS=true`
- `ENABLE_DEMO_DATA_GENERATOR=true`
- `MOCK_GEMINI_AI=true` (Save costs on AI calls in sandbox)

---

## 4. Tenant Management

### 4.1 Automated Provisioning

A script `scripts/provision-sandbox-tenant.sh` will:
1. Generate a new `partnerId`.
2. Generate an API Key.
3. Seed the database with 10 sample claims.
4. Output the credentials for the partner.

### 4.2 Data Reset Policy

- **Weekly Reset:** The Sandbox DB is wiped and re-seeded every Sunday at 03:00 UTC.
- **Manual Reset:** Partners can request a reset via the Portal (triggers a job to clear their specific `partnerId` data).

---

## 5. Observability & Limits

### 5.1 Monitoring

- **Dashboard:** "Sandbox Health" dashboard in Cloud Monitoring.
- **Alerts:** Alert on >5% error rate (indicates broken build or partner misuse).

### 5.2 Hard Limits

To protect the budget:
- **Max Pods:** 5
- **Max DB Connections:** 50
- **Daily Budget Cap:** $20/day (Alerts sent to DevOps channel).

---

## 6. Approval

| Role | Status | Date |
|------|--------|------|
| Backend/DevOps | ✅ APPROVED | 2024-12-10 |
| CTO | ⏳ PENDING | - |

