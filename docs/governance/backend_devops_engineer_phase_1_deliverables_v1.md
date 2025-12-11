# Backend/DevOps Engineer Phase 1 - IaC Conventions & Environment Topology

**Document ID:** `backend_devops_engineer_phase_1_deliverables_v1`  
**Phase:** 1 - Governance & Zero-Trust Architecture  
**Status:** APPROVED  
**Classification:** L2_SENSITIVE  
**Last Updated:** 2024-12-10  

---

## 1. Objective

Define the foundational Infrastructure as Code (IaC) conventions and environment topology that all Proveniq Ledger infrastructure must follow. No click-ops allowed.

---

## 2. Environment Topology

### 2.1 GCP Project Structure

```
proveniq-org/
├── proveniq-ledger-dev          # Development environment
│   ├── GKE cluster (dev)
│   ├── Cloud SQL (dev)
│   └── Cloud Storage (dev)
│
├── proveniq-ledger-staging      # Staging environment
│   ├── GKE cluster (staging)
│   ├── Cloud SQL (staging)
│   └── Cloud Storage (staging)
│
├── proveniq-ledger-prod         # Production environment
│   ├── GKE cluster (prod)
│   ├── Cloud SQL (prod, HA)
│   └── Cloud Storage (prod)
│
└── proveniq-shared-services     # Shared infrastructure
    ├── Artifact Registry
    ├── Secret Manager
    ├── Cloud KMS
    └── Cloud Logging (sink)
```

### 2.2 Environment Specifications

| Environment | Purpose | GKE Nodes | SQL Tier | Auto-scaling |
|-------------|---------|-----------|----------|--------------|
| **dev** | Local development parity | 1x e2-medium | db-f1-micro | Off |
| **staging** | Pre-production testing | 2x e2-standard-2 | db-custom-2-8192 | On |
| **prod** | Production workloads | 3x e2-standard-4 | db-custom-4-16384 (HA) | On |

---

## 3. IaC Conventions

### 3.1 Directory Structure

```
infrastructure/
├── terraform/
│   ├── modules/                 # Reusable modules
│   │   ├── gke-cluster/
│   │   ├── cloud-sql/
│   │   ├── cloud-storage/
│   │   ├── vpc-network/
│   │   ├── iam-bindings/
│   │   └── secret-manager/
│   │
│   ├── environments/            # Environment-specific configs
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── terraform.tfvars
│   │   ├── staging/
│   │   └── prod/
│   │
│   ├── global/                  # Shared resources
│   │   ├── artifact-registry/
│   │   ├── kms/
│   │   └── logging/
│   │
│   └── backend.tf               # Remote state config
│
├── kubernetes/
│   ├── base/                    # Kustomize base
│   │   ├── deployments/
│   │   ├── services/
│   │   ├── configmaps/
│   │   └── kustomization.yaml
│   │
│   └── overlays/                # Environment overlays
│       ├── dev/
│       ├── staging/
│       └── prod/
│
└── scripts/
    ├── setup-project.sh
    ├── deploy.sh
    └── rollback.sh
```

### 3.2 Naming Conventions

| Resource Type | Pattern | Example |
|---------------|---------|---------|
| GCP Project | `proveniq-ledger-{env}` | `proveniq-ledger-prod` |
| GKE Cluster | `ledger-cluster-{env}-{region}` | `ledger-cluster-prod-us-east1` |
| Cloud SQL | `ledger-db-{env}` | `ledger-db-prod` |
| GCS Bucket | `proveniq-ledger-{purpose}-{env}` | `proveniq-ledger-documents-prod` |
| Secret | `{service}-{secret-type}` | `ledger-api-db-password` |
| Service Account | `{service}-sa@{project}` | `ledger-api-sa@proveniq-ledger-prod` |

### 3.3 Tagging Standards

All resources MUST have these labels:

```hcl
labels = {
  project     = "proveniq-ledger"
  environment = var.environment      # dev, staging, prod
  team        = "platform"
  cost-center = "engineering"
  managed-by  = "terraform"
  created-at  = timestamp()
}
```

---

## 4. Terraform Conventions

### 4.1 Module Standards

```hcl
# modules/gke-cluster/variables.tf
variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-east1"
}

variable "node_count" {
  description = "Number of nodes in the default node pool"
  type        = number
  default     = 3
}
```

### 4.2 State Management

```hcl
# backend.tf
terraform {
  backend "gcs" {
    bucket = "proveniq-terraform-state"
    prefix = "ledger/${var.environment}"
  }
}
```

### 4.3 Required Providers

```hcl
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}
```

---

## 5. Access & Audit Requirements

### 5.1 IAM Principles

1. **Least Privilege** - Grant minimum permissions required
2. **Service Accounts** - No human accounts for automated processes
3. **Workload Identity** - GKE pods use Workload Identity, not SA keys
4. **No Owner Role** - Avoid `roles/owner`, use specific roles

### 5.2 Audit Logging

All administrative actions MUST be logged:

```hcl
# Enable Data Access Audit Logs
resource "google_project_iam_audit_config" "all_services" {
  project = var.project_id
  service = "allServices"
  
  audit_log_config {
    log_type = "ADMIN_READ"
  }
  audit_log_config {
    log_type = "DATA_READ"
  }
  audit_log_config {
    log_type = "DATA_WRITE"
  }
}
```

---

## 6. Cost Estimation (Minimal Infra)

### 6.1 Development Environment

| Resource | Configuration | Monthly Cost |
|----------|---------------|--------------|
| GKE | 1x e2-medium, preemptible | ~$15 |
| Cloud SQL | db-f1-micro | ~$10 |
| Cloud Storage | 10GB Standard | ~$0.26 |
| Networking | Minimal egress | ~$5 |
| **Total Dev** | | **~$30/month** |

### 6.2 All Environments (Phase 1)

| Environment | Monthly Cost |
|-------------|--------------|
| Development | ~$30 |
| Staging | ~$150 |
| Production | ~$740 |
| Shared Services | ~$50 |
| **Total** | **~$970/month** |

---

## 7. Phase 1 Deliverables Checklist

- [x] Environment topology defined
- [x] IaC directory structure specified
- [x] Naming conventions established
- [x] Tagging standards defined
- [x] Terraform conventions documented
- [x] Cost estimates provided
- [ ] Terraform modules created (Phase 2)
- [ ] CI/CD pipeline configured (Phase 2)

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | Backend/DevOps Agent | Initial IaC conventions |
