# Proveniq Ledger Infrastructure Hardening Guide v1.0

**Document ID:** `backend_infra_hardening_v1`  
**Phase:** 4 - Security Hardening & Beta Certification  
**Status:** APPROVED  
**Classification:** L3_TRADE_SECRET  
**Last Updated:** 2024-12-10  

---

## 1. Objective

This guide details the specific Terraform and configuration changes required to implement the security hardening plan.

---

## 2. Network Hardening

### 2.1 Private GKE Cluster
```hcl
# modules/gke-cluster/main.tf
private_cluster_config {
  enable_private_nodes    = true
  enable_private_endpoint = true  # CHANGED: No public endpoint
  master_ipv4_cidr_block  = "172.16.0.0/28"
}
```

### 2.2 Authorized Networks
```hcl
master_authorized_networks_config {
  cidr_blocks {
    cidr_block   = "10.0.0.0/8"   # VPN/Bastion only
    display_name = "Internal VPN"
  }
}
```

---

## 3. Workload Identity Hardening

### 3.1 GSA-KSA Binding
Ensure NO Kubernetes Service Accounts (KSA) have `roles/editor` or `roles/owner`.

```bash
# Verify bindings
gcloud iam service-accounts get-iam-policy ledger-api-sa@...
# MUST show: roles/iam.workloadIdentityUser
```

---

## 4. Container Security

### 4.1 Distroless Images
Switch all Dockerfiles to use `gcr.io/distroless/nodejs20-debian11`.
- **Why:** Removes shell, package managers, and root user.
- **Impact:** Attackers cannot run `sh` or `apt-get`.

### 4.2 Read-Only Root Filesystem
Update K8s Deployment:
```yaml
securityContext:
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000
```

---

## 5. Secret Rotation Automation

### 5.1 Cloud Function Rotator
Deploy `secret-rotator` Cloud Function:
- **Trigger:** Pub/Sub Schedule (Every 30 days).
- **Action:**
    1. Generate new DB password.
    2. Update Secret Manager version.
    3. Update Cloud SQL user.
    4. Restart API pods (rolling update).

---

## 6. Approval

| Role | Status | Date |
|------|--------|------|
| Backend/DevOps | ✅ APPROVED | 2024-12-10 |
| CTO | ⏳ PENDING | - |

