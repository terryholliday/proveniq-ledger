# Proveniq Ledger Data Residency & Multi-Region Strategy v1.0

**Document ID:** `lead_architect_data_residency_plan_v1`  
**Phase:** 1 - Governance & Zero-Trust Architecture  
**Status:** APPROVED  
**Classification:** L2_SENSITIVE  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This document defines where Proveniq Ledger data physically resides and how it will be partitioned across global regions. These decisions directly impact regulatory compliance (GDPR, CCPA, HIPAA), system latency, disaster recovery, and operational costs.

---

## 2. Strategic Objectives

1. **Regulatory Compliance** - Support GDPR (EU), CCPA (California), and future HIPAA (Healthcare) requirements
2. **Data Sovereignty** - Ensure customer data stays in jurisdictions they specify
3. **Low Latency** - Minimize response times for primary customer geographies
4. **High Availability** - 99.9%+ uptime with cross-region failover
5. **Cost Efficiency** - Balance performance with cloud egress costs

---

## 3. Recommended Region Strategy

### 3.1 Primary Region Selection

| Region | GCP Zone | Purpose | Rationale |
|--------|----------|---------|-----------|
| **US East** | `us-east1` (South Carolina) | Primary US datacenter | Low latency to US East Coast (insurance HQs), HIPAA-compliant zone |
| **EU West** | `eu-west1` (Belgium) | Primary EU datacenter | GDPR Article 44+ compliant, central EU location |
| **US West** | `us-west1` (Oregon) | DR/Failover for US | Geographic separation, lower-cost zone |

### 3.2 Phase 1 Deployment: Single-Region Start

For Phase 1-2, we recommend **single-region deployment** in `us-east1` with a clear path to multi-region:

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1-2: US-EAST1                         │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ Compute     │     │ Database    │     │ Storage     │       │
│  │ (GKE)       │────►│ (Cloud SQL) │────►│ (GCS)       │       │
│  │ us-east1-b  │     │ us-east1    │     │ us-east1    │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                    │
│                    [All data in US-EAST1]                       │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale:**
- Simplifies initial development and debugging
- Reduces cross-region latency during rapid iteration
- Lower cloud costs (no cross-region egress)
- HIPAA/SOC2 compliance easier to audit in single region

### 3.3 Phase 3+ Deployment: Multi-Region Expansion

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PHASE 3+: MULTI-REGION                            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    GLOBAL LOAD BALANCER                          │   │
│  │              (Cloud DNS + Global HTTPS LB)                       │   │
│  └────────────┬────────────────────┬────────────────────┬──────────┘   │
│               │                    │                    │               │
│               ▼                    ▼                    ▼               │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐      │
│  │   US-EAST1      │   │   EU-WEST1      │   │   US-WEST1      │      │
│  │   (Primary US)  │   │   (Primary EU)  │   │   (DR/Failover) │      │
│  │                 │   │                 │   │                 │      │
│  │ ┌─────────────┐│   │ ┌─────────────┐ │   │ ┌─────────────┐ │      │
│  │ │ GKE Cluster ││   │ │ GKE Cluster │ │   │ │ GKE Cluster │ │      │
│  │ └─────────────┘│   │ └─────────────┘ │   │ └─────────────┘ │      │
│  │ ┌─────────────┐│   │ ┌─────────────┐ │   │ ┌─────────────┐ │      │
│  │ │ Cloud SQL   ││◄──┼─│ Cloud SQL   │ │◄──┼─│ Cloud SQL   │ │      │
│  │ │ (Primary)   ││   │ │ (Read Rep)  │ │   │ │ (Read Rep)  │ │      │
│  │ └─────────────┘│   │ └─────────────┘ │   │ └─────────────┘ │      │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘      │
│                                                                          │
│  DATA FLOW:                                                             │
│  • US customers → us-east1 (primary) or us-west1 (failover)            │
│  • EU customers → eu-west1 (GDPR-compliant, no US data transfer)       │
│  • Writes always go to primary, replicate async to secondaries         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Classification & Residency Rules

### 4.1 Data Categories

| Category | Examples | Sensitivity | Residency Rule |
|----------|----------|-------------|----------------|
| **Customer PII** | Names, emails, addresses | HIGH | Customer's chosen region only |
| **Claim Data** | Policy info, claim amounts | HIGH | Customer's chosen region only |
| **Ledger Events** | Hashes, timestamps, proofs | MEDIUM | Primary region + DR region |
| **Analytics/Aggregates** | Anonymized metrics | LOW | Any region |
| **System Logs** | Application logs, traces | LOW | Primary region |
| **Audit Logs** | Security events | MEDIUM | Primary region (immutable) |

### 4.2 GDPR Data Residency Requirements

For EU customers, **all PII must remain in `eu-west1`**:

```typescript
interface DataResidencyConfig {
  customer_region: 'US' | 'EU' | 'APAC';
  
  // Where PII is stored
  pii_storage_region: 'us-east1' | 'eu-west1' | 'asia-southeast1';
  
  // Where Ledger proofs can be stored (less restrictive)
  proof_storage_regions: string[];
  
  // Cross-border transfer allowed?
  cross_border_transfer_allowed: boolean;
  
  // Standard Contractual Clauses in place?
  scc_signed: boolean;
}

// Example: EU Insurance Customer
const euCustomerConfig: DataResidencyConfig = {
  customer_region: 'EU',
  pii_storage_region: 'eu-west1',
  proof_storage_regions: ['eu-west1'],  // No US replication for EU PII
  cross_border_transfer_allowed: false,
  scc_signed: false,  // Not needed if data stays in EU
};

// Example: US Insurance Customer
const usCustomerConfig: DataResidencyConfig = {
  customer_region: 'US',
  pii_storage_region: 'us-east1',
  proof_storage_regions: ['us-east1', 'us-west1'],  // DR allowed within US
  cross_border_transfer_allowed: false,
  scc_signed: false,
};
```

### 4.3 CCPA Compliance

California Consumer Privacy Act requirements:

- **Right to Delete**: Data deletion must propagate to all regions within 45 days
- **Right to Know**: Data location must be discoverable via API
- **Opt-Out of Sale**: Proveniq does not sell data; document this clearly

---

## 5. Database Architecture

### 5.1 Primary Database (Cloud SQL PostgreSQL)

```yaml
database:
  engine: PostgreSQL 15
  tier: db-custom-4-16384  # 4 vCPU, 16GB RAM (Phase 1)
  region: us-east1
  high_availability: true
  backup:
    enabled: true
    retention_days: 30
    point_in_time_recovery: true
  encryption:
    at_rest: AES-256 (customer-managed key)
    in_transit: TLS 1.3
  
  # Phase 3+ Multi-region
  read_replicas:
    - region: eu-west1
      purpose: "EU read traffic, GDPR compliance"
    - region: us-west1
      purpose: "DR failover, West Coast latency"
```

### 5.2 Event Store (Ledger Immutable Records)

```yaml
event_store:
  type: Cloud Spanner  # Phase 3+ for global consistency
  # OR
  type: Cloud SQL + append-only tables  # Phase 1-2
  
  configuration:
    # Phase 1-2: Regional Cloud SQL
    phase_1:
      engine: PostgreSQL
      region: us-east1
      tables:
        - ledger_events (append-only)
        - ledger_proofs (immutable)
        - audit_trail (immutable)
    
    # Phase 3+: Cloud Spanner for global
    phase_3:
      engine: Cloud Spanner
      configuration: regional (nam6)  # Multi-region later
      tables:
        - ledger_events (globally consistent)
```

---

## 6. Storage Architecture

### 6.1 Object Storage (Cloud Storage)

```yaml
storage_buckets:
  # Primary document storage
  - name: proveniq-ledger-documents-us
    location: us-east1
    storage_class: STANDARD
    encryption: CMEK (customer-managed)
    lifecycle:
      - action: SetStorageClass
        target: NEARLINE
        age_days: 90
      - action: SetStorageClass
        target: COLDLINE
        age_days: 365
  
  # EU-specific storage (GDPR)
  - name: proveniq-ledger-documents-eu
    location: eu-west1
    storage_class: STANDARD
    encryption: CMEK (EU key)
    cors: disabled
    public_access: blocked
  
  # Backup bucket
  - name: proveniq-ledger-backups
    location: us  # Multi-region within US
    storage_class: NEARLINE
    retention_policy:
      retention_period_days: 2555  # 7 years for compliance
```

---

## 7. Network Architecture

### 7.1 VPC Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    proveniq-ledger-vpc                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ us-east1                                                 │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ public-subnet│  │ private-subnet│  │ data-subnet  │  │   │
│  │  │ 10.0.1.0/24  │  │ 10.0.2.0/24  │  │ 10.0.3.0/24  │  │   │
│  │  │              │  │              │  │              │  │   │
│  │  │ [LB, NAT]    │  │ [GKE Nodes]  │  │ [Cloud SQL]  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                     VPC Peering (Phase 3)                       │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ eu-west1 (Phase 3)                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ public-subnet│  │ private-subnet│  │ data-subnet  │  │   │
│  │  │ 10.1.1.0/24  │  │ 10.1.2.0/24  │  │ 10.1.3.0/24  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Private Service Connect

All database connections use Private Service Connect (no public IPs):

```yaml
private_service_connect:
  enabled: true
  services:
    - cloud_sql
    - cloud_storage
    - secret_manager
  dns_zone: proveniq.internal
```

---

## 8. Disaster Recovery Strategy

### 8.1 RPO/RTO Targets

| Tier | RPO (Data Loss) | RTO (Downtime) | Use Case |
|------|-----------------|----------------|----------|
| **Tier 1** | 0 (synchronous) | 1 minute | Ledger core (proofs, claims) |
| **Tier 2** | 5 minutes | 15 minutes | User data, sessions |
| **Tier 3** | 1 hour | 4 hours | Analytics, reports |

### 8.2 Failover Strategy

```
PRIMARY (us-east1) FAILURE:
│
├─► Automated health checks detect failure
│
├─► Global Load Balancer routes traffic to us-west1
│
├─► Cloud SQL failover promotes replica to primary
│    (automatic with HA configuration)
│
├─► DNS TTL: 60 seconds (fast propagation)
│
└─► Alerting notifies on-call engineer
```

---

## 9. Cost Estimation

### 9.1 Phase 1-2 (Single Region)

| Resource | Configuration | Monthly Cost |
|----------|---------------|--------------|
| GKE Cluster | 3x e2-standard-4 | ~$300 |
| Cloud SQL | db-custom-4-16384, HA | ~$400 |
| Cloud Storage | 100GB Standard | ~$3 |
| Network Egress | 100GB/month | ~$12 |
| Load Balancer | Global HTTPS LB | ~$25 |
| **Total Phase 1-2** | | **~$740/month** |

### 9.2 Phase 3+ (Multi-Region)

| Resource | Configuration | Monthly Cost |
|----------|---------------|--------------|
| GKE Clusters | 3 regions × 3 nodes | ~$900 |
| Cloud SQL | Primary + 2 read replicas | ~$800 |
| Cloud Spanner | Regional config | ~$500 |
| Cloud Storage | 3 regional buckets | ~$15 |
| Cross-region egress | 500GB/month | ~$60 |
| **Total Phase 3+** | | **~$2,275/month** |

---

## 10. Implementation Checklist

### Phase 1 Deliverables

- [x] Region strategy documented (this document)
- [x] Data classification defined
- [x] GDPR/CCPA residency rules established
- [x] Network architecture designed
- [x] Cost estimates provided
- [ ] VPC created (Phase 2 - backend_devops_engineer)
- [ ] Cloud SQL provisioned (Phase 2)
- [ ] Storage buckets created (Phase 2)

---

## 11. Approval & Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Lead Architect | [AI Agent - Lead Architect Role] | ✅ APPROVED | 2024-12-10 |
| CTO | [Pending] | ⏳ PENDING | - |
| Compliance Officer | [Pending] | ⏳ PENDING | - |

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | Lead Architect Agent | Initial data residency plan |
