# Proveniq Ledger Multi-Region Active/Active Architecture v1.0

**Document ID:** `lead_architect_multi_region_design_v1`  
**Phase:** 5 - Global Scale & Ecosystem Optimization  
**Status:** APPROVED  
**Classification:** L2_INTERNAL  
**Last Updated:** 2024-12-11  

---

## 1. Executive Summary

This document defines the multi-region active/active architecture for Proveniq Ledger to achieve global scale, sub-100ms latency for 95% of users, and 99.99% availability SLA. The design leverages GCP's global infrastructure with intelligent traffic routing.

---

## 2. Regional Topology

### Primary Regions

| Region | Role | Services | Data Tier |
|--------|------|----------|-----------|
| **us-east1** (South Carolina) | Primary Americas | Full Stack | Primary Write |
| **europe-west1** (Belgium) | Primary EMEA | Full Stack | Primary Write |
| **asia-southeast1** (Singapore) | Primary APAC | Full Stack | Primary Write |

### Edge Locations (CDN PoPs)

- 200+ Cloud CDN edge locations globally
- Static assets cached at edge (< 10ms TTFB)
- API responses cached where safe (GET /blocks, /proofs)

---

## 3. Data Replication Strategy

### 3.1 Cloud Spanner (Global Ledger)

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Spanner Instance                    │
│                   (Multi-Region: nam-eur-asia1)              │
├─────────────────┬─────────────────┬─────────────────────────┤
│   us-east1      │  europe-west1   │    asia-southeast1      │
│   (Read/Write)  │  (Read/Write)   │    (Read/Write)         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

**Why Spanner:**
- Strong consistency across regions (TrueTime)
- Automatic sharding and rebalancing
- 99.999% availability SLA
- Critical for ledger integrity (no split-brain)

### 3.2 Cloud SQL (Regional Metadata)

- Per-region Cloud SQL for non-critical metadata
- Cross-region read replicas for DR
- Async replication (< 1s lag)

### 3.3 Redis (Session & Cache)

- Memorystore for Redis per region
- No cross-region replication (stateless sessions)
- JWT tokens eliminate session stickiness

---

## 4. Traffic Routing

### 4.1 Global Load Balancer

```
                    ┌──────────────────┐
                    │  Cloud DNS       │
                    │  (Anycast)       │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Global HTTPS LB │
                    │  (Premium Tier)  │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│   us-east1    │   │ europe-west1  │   │asia-southeast1│
│   NEG/GKE     │   │   NEG/GKE     │   │   NEG/GKE     │
└───────────────┘   └───────────────┘   └───────────────┘
```

### 4.2 Routing Rules

| Traffic Type | Routing Strategy | Failover |
|--------------|------------------|----------|
| **API Writes** | Geo-proximity | Next-nearest region |
| **API Reads** | Geo-proximity + Cache | Any healthy region |
| **Static Assets** | Cloud CDN Edge | Origin fallback |
| **Webhooks** | Regional affinity | Retry with backoff |

---

## 5. Consistency Model

### 5.1 Ledger Operations (Strong Consistency)

All ledger mutations use Spanner's external consistency:
- `POST /events` → Spanner commit (synchronous)
- `GET /proof/{id}` → Spanner read (bounded staleness: 0s)

### 5.2 Analytics Operations (Eventual Consistency)

Dashboard and reporting tolerate staleness:
- `GET /analytics/*` → Read replica (staleness: 15s max)
- `GET /reports/*` → BigQuery (staleness: 1 hour)

---

## 6. Failure Scenarios & Recovery

### Scenario 1: Single Region Failure

| Event | Detection | Recovery | RTO |
|-------|-----------|----------|-----|
| us-east1 down | Health check (10s) | GLB routes to europe-west1 | < 30s |
| Data intact | Spanner quorum | No data loss | 0 |

### Scenario 2: Network Partition

| Event | Detection | Recovery | RTO |
|-------|-----------|----------|-----|
| Cross-region partition | Spanner TrueTime | Automatic leader election | < 10s |
| Writes continue | Majority quorum | No intervention needed | 0 |

### Scenario 3: Global Spanner Outage

| Event | Detection | Recovery | RTO |
|-------|-----------|----------|-----|
| Spanner unavailable | API errors spike | Read-only mode (cached) | Immediate |
| Full recovery | GCP SRE | Automatic | Per GCP SLA |

---

## 7. Cost Model

### Monthly Estimate (Production Scale)

| Component | Specification | Monthly Cost |
|-----------|---------------|--------------|
| **Cloud Spanner** | 3-region, 2 nodes/region | $5,400 |
| **GKE Autopilot** | 3 regions, ~20 pods each | $3,600 |
| **Global LB** | Premium tier, 1TB egress | $500 |
| **Cloud CDN** | 10TB egress | $850 |
| **Memorystore** | 3x 5GB Redis | $450 |
| **Cloud SQL** | 3x db-custom-4-16384 | $1,200 |
| **Monitoring** | Cloud Ops Suite | $300 |
| **Total** | | **~$12,300/mo** |

### Cost Optimization Levers

1. **Committed Use Discounts:** 1-year commit = 25% savings
2. **Spanner Autoscaler:** Scale nodes based on CPU (save 30% off-peak)
3. **CDN Cache Hit Ratio:** Target 95%+ (reduce origin costs)

---

## 8. Migration Path

### Phase 5.1: Spanner Migration (Week 1-2)

1. Deploy Spanner instance (multi-region)
2. Dual-write from Cloud SQL → Spanner
3. Validate data integrity
4. Cutover reads to Spanner
5. Deprecate Cloud SQL for ledger

### Phase 5.2: Multi-Region GKE (Week 3-4)

1. Deploy GKE clusters in europe-west1, asia-southeast1
2. Configure Global LB with all backends
3. Gradual traffic shift (10% → 50% → 100%)
4. Validate latency and error rates

### Phase 5.3: CDN & Edge (Week 5)

1. Enable Cloud CDN on static assets
2. Configure cache policies for API responses
3. Deploy edge functions for geo-routing

---

## 9. Observability

### Global Dashboard Metrics

- **Latency P50/P95/P99** by region
- **Error Rate** by region and endpoint
- **Spanner Commit Latency** (target: < 50ms)
- **Cache Hit Ratio** (target: > 95%)
- **Cross-Region Replication Lag**

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API Latency P99 | > 500ms | > 1000ms |
| Error Rate | > 0.1% | > 1% |
| Spanner CPU | > 65% | > 85% |
| Region Health | 1 unhealthy | 2 unhealthy |

---

## 10. Approval

| Role | Status | Date |
|------|--------|------|
| Lead Architect | ✅ APPROVED | 2024-12-11 |
| CTO | ⏳ PENDING | - |
| CEO | ⏳ PENDING | - |

---

*Generated by Proveniq Ledger DAG Runner - Phase 5*
