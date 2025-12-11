# Proveniq Ledger Reference Architecture v1.0

**Document ID:** `cto_phase_2_reference_architecture_v1`  
**Phase:** 2 - Core Infrastructure & "Visual Truth" Engine  
**Status:** APPROVED  
**Classification:** L3_TRADE_SECRET  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This document defines the end-to-end reference architecture for Proveniq Ledger, establishing the technology stack, service topology, and architectural patterns that will power a carrier-grade verification backbone.

---

## 2. Architecture Principles

### 2.1 Non-Negotiable Principles

| Principle | Description |
|-----------|-------------|
| **Immutability First** | The Ledger's truth kernel is append-only and cryptographically linked |
| **Zero-Trust** | All access authenticated, authorized, and audited (per Phase 1 policy) |
| **Cloud-Native** | Designed for GCP; portable patterns where practical |
| **Observable** | Every service emits metrics, logs, and traces from day one |
| **Carrier-Grade** | Designed for 99.9% uptime, audit trails, and compliance |

### 2.2 Design Tradeoffs

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Event Sourcing vs. Append-Only Log | **Append-Only Log** | Simpler, sufficient for proof model, lower ops burden |
| SQL vs. NoSQL for Events | **PostgreSQL** | ACID guarantees, rich querying, Cloud SQL managed |
| Sync vs. Async API | **Sync for writes, Async for analytics** | Latency SLAs require sync; analytics can be eventual |
| Monolith vs. Microservices | **Modular Monolith → Services** | Start monolith, extract services as scale demands |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVENIQ LEDGER ARCHITECTURE                         │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                         EXTERNAL LAYER                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │    │
│  │  │   Partner    │  │   Partner    │  │   Internal   │             │    │
│  │  │   Portal     │  │   API        │  │   Dashboard  │             │    │
│  │  │   (React)    │  │   Clients    │  │   (React)    │             │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │    │
│  └─────────┼─────────────────┼─────────────────┼─────────────────────┘    │
│            │                 │                 │                           │
│  ┌─────────▼─────────────────▼─────────────────▼─────────────────────┐    │
│  │                         EDGE LAYER                                 │    │
│  │  ┌─────────────────────────────────────────────────────────────┐  │    │
│  │  │                    Cloud Load Balancer                       │  │    │
│  │  │                    + Cloud Armor (WAF)                       │  │    │
│  │  └────────────────────────────┬────────────────────────────────┘  │    │
│  │                               │                                    │    │
│  │  ┌────────────────────────────▼────────────────────────────────┐  │    │
│  │  │              Identity-Aware Proxy (IAP)                      │  │    │
│  │  │              + API Gateway (Kong/Apigee)                     │  │    │
│  │  └────────────────────────────┬────────────────────────────────┘  │    │
│  └───────────────────────────────┼────────────────────────────────────┘    │
│                                  │                                          │
│  ┌───────────────────────────────▼────────────────────────────────────┐    │
│  │                         SERVICE LAYER (GKE)                         │    │
│  │                                                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │    │
│  │  │   Ledger    │  │   Proof     │  │   Query     │  │   Admin   │ │    │
│  │  │   Writer    │  │   Generator │  │   Service   │  │   API     │ │    │
│  │  │   Service   │  │   Service   │  │             │  │           │ │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │    │
│  │         │                │                │                │       │    │
│  │         └────────────────┼────────────────┼────────────────┘       │    │
│  │                          │                │                         │    │
│  │  ┌───────────────────────▼────────────────▼─────────────────────┐  │    │
│  │  │                    TRUTH KERNEL                               │  │    │
│  │  │         (Shared domain logic, crypto, validation)             │  │    │
│  │  └───────────────────────┬──────────────────────────────────────┘  │    │
│  └──────────────────────────┼──────────────────────────────────────────┘    │
│                             │                                               │
│  ┌──────────────────────────▼──────────────────────────────────────────┐   │
│  │                         DATA LAYER                                   │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │   │
│  │  │   Cloud SQL     │  │   Cloud Storage │  │   Pub/Sub           │ │   │
│  │  │   (PostgreSQL)  │  │   (Documents)   │  │   (Events)          │ │   │
│  │  │   - Events      │  │   - Blobs       │  │   - Async triggers  │ │   │
│  │  │   - Proofs      │  │   - Exports     │  │   - Analytics feed  │ │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │   │
│  │  │   Secret        │  │   Cloud KMS     │  │   Redis             │ │   │
│  │  │   Manager       │  │   (Encryption)  │  │   (Cache)           │ │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      OBSERVABILITY LAYER                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐ │   │
│  │  │ Cloud      │  │ Cloud      │  │ Cloud      │  │ Error          │ │   │
│  │  │ Logging    │  │ Monitoring │  │ Trace      │  │ Reporting      │ │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Stack

### 4.1 Runtime & Compute

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Container Orchestration** | GKE (Autopilot) | Managed K8s, auto-scaling, reduced ops |
| **Runtime** | Node.js 20 LTS | Team expertise, TypeScript native, performant for I/O |
| **Framework** | Fastify | Fast, schema validation, TypeScript support |
| **Build** | Vite + esbuild | Fast builds, ESM-first |

### 4.2 Data & Storage

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Primary Database** | Cloud SQL (PostgreSQL 15) | ACID, rich querying, managed HA |
| **Event Store** | PostgreSQL (append-only table) | Simpler than Kafka for current scale |
| **Document Storage** | Cloud Storage | Scalable blob storage |
| **Cache** | Memorystore (Redis) | Session cache, rate limiting |
| **Search** | PostgreSQL full-text (→ Elasticsearch later) | Start simple, upgrade as needed |

### 4.3 Messaging & Integration

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Async Messaging** | Pub/Sub | Managed, scalable, dead-letter support |
| **Webhooks** | Cloud Tasks | Reliable delivery with retries |
| **API Gateway** | Apigee or Kong | Rate limiting, analytics, developer portal |

### 4.4 Security & Identity

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Authentication** | Firebase Auth + Custom JWT | Flexible, supports OIDC |
| **Authorization** | Custom RBAC + OPA (future) | Fine-grained policies |
| **Secrets** | Secret Manager | Native GCP, versioned |
| **Encryption** | Cloud KMS | Customer-managed keys (CMEK) |
| **Service Identity** | Workload Identity | No SA key files |

### 4.5 Observability

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Logging** | Cloud Logging | Native GCP, structured logs |
| **Metrics** | Cloud Monitoring + Prometheus | Custom metrics, dashboards |
| **Tracing** | Cloud Trace | Distributed tracing |
| **Error Tracking** | Error Reporting | Aggregated error analysis |
| **Alerting** | Cloud Monitoring + PagerDuty | Incident response |

---

## 5. Service Decomposition

### 5.1 Core Services

```
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE DECOMPOSITION                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LEDGER-WRITER-SERVICE                                   │   │
│  │  • Accepts new events (claims, documents, proofs)        │   │
│  │  • Validates payload against schema                      │   │
│  │  • Computes hash and links to previous event             │   │
│  │  • Writes to append-only event store                     │   │
│  │  • Emits to Pub/Sub for async consumers                  │   │
│  │                                                          │   │
│  │  Endpoints:                                              │   │
│  │  POST /api/v1/events                                     │   │
│  │  POST /api/v1/claims/{id}/verify                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PROOF-GENERATOR-SERVICE                                 │   │
│  │  • Generates Merkle proofs for event ranges              │   │
│  │  • Creates verifiable claims proofs                      │   │
│  │  • Signs proofs with service key                         │   │
│  │  • Caches frequently requested proofs                    │   │
│  │                                                          │   │
│  │  Endpoints:                                              │   │
│  │  GET /api/v1/proofs/{eventId}                           │   │
│  │  POST /api/v1/proofs/batch                              │   │
│  │  POST /api/v1/proofs/verify                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  QUERY-SERVICE                                           │   │
│  │  • Reads events and proofs (read-replica)                │   │
│  │  • Supports filtering, pagination, search                │   │
│  │  • Serves dashboards and partner portals                 │   │
│  │  • Optimized for read-heavy workloads                    │   │
│  │                                                          │   │
│  │  Endpoints:                                              │   │
│  │  GET /api/v1/events                                      │   │
│  │  GET /api/v1/events/{id}                                 │   │
│  │  GET /api/v1/claims/{id}/history                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ADMIN-SERVICE                                           │   │
│  │  • Partner management (CRUD)                             │   │
│  │  • API key lifecycle                                     │   │
│  │  • Configuration management                              │   │
│  │  • System health endpoints                               │   │
│  │                                                          │   │
│  │  Endpoints:                                              │   │
│  │  /api/v1/admin/partners                                  │   │
│  │  /api/v1/admin/api-keys                                  │   │
│  │  /api/v1/admin/config                                    │   │
│  │  /health, /ready                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AI-RISK-SERVICE                                         │   │
│  │  • Fraud scoring via Gemini API                          │   │
│  │  • Anomaly detection                                     │   │
│  │  • Explainability generation                             │   │
│  │  • Human-in-the-loop triggers                            │   │
│  │                                                          │   │
│  │  Endpoints:                                              │   │
│  │  POST /api/v1/risk/analyze                               │   │
│  │  GET /api/v1/risk/{claimId}/score                        │   │
│  │  GET /api/v1/risk/{claimId}/explanation                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Phase 2 Service Boundaries

| Service | Phase 2 Scope | Future Scope |
|---------|---------------|--------------|
| **ledger-writer** | Core event writing | Sharding, multi-region |
| **proof-generator** | Basic Merkle proofs | Blockchain anchoring |
| **query-service** | Basic queries | Advanced search, analytics |
| **admin-service** | Partner/key management | Full admin console |
| **ai-risk-service** | Gemini integration | Custom models |

---

## 6. Architecture Decision Records (ADRs)

### ADR-001: Runtime Choice

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Need to choose primary runtime for services |
| **Decision** | Node.js 20 LTS with TypeScript |
| **Rationale** | Team expertise, excellent for I/O-bound work, strong typing |
| **Consequences** | CPU-heavy tasks may need Go/Rust microservices later |

### ADR-002: Database Choice

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Need reliable storage for immutable events |
| **Decision** | Cloud SQL PostgreSQL 15 |
| **Rationale** | ACID guarantees, managed HA, rich SQL for queries |
| **Consequences** | May need read replicas for scale; sharding complex |

### ADR-003: Event Sourcing vs Append-Only Log

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | How to store immutable event history |
| **Decision** | Simple append-only log (not full event sourcing) |
| **Rationale** | Simpler ops, sufficient for proof generation, less rebuild complexity |
| **Consequences** | No projections/snapshots; state derived from latest reads |

### ADR-004: API Gateway

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Need API management, rate limiting, analytics |
| **Decision** | Start with Cloud Endpoints; migrate to Apigee for scale |
| **Rationale** | Cost-effective start, clear upgrade path |
| **Consequences** | Developer portal features limited until Apigee |

### ADR-005: Monolith vs Microservices

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Service architecture for Phase 2 |
| **Decision** | Modular monolith, extract services as needed |
| **Rationale** | Faster iteration, simpler ops, clear module boundaries |
| **Consequences** | Must maintain clean module boundaries; extract by Phase 3-4 |

---

## 7. Data Flow

### 7.1 Write Path (Event Creation)

```
Client → API Gateway → Auth → Ledger Writer → Validate → Hash → Write DB → Pub/Sub → OK
```

**Sequence:**
1. Client sends `POST /api/v1/events` with payload
2. API Gateway rate-limits, routes to service
3. Auth middleware validates JWT + API key
4. Ledger Writer validates payload against schema
5. Computes SHA-256 hash of payload
6. Retrieves previous event hash for linkage
7. Writes event to PostgreSQL (append-only)
8. Publishes event to Pub/Sub (async consumers)
9. Returns event ID and hash to client

### 7.2 Read Path (Proof Retrieval)

```
Client → API Gateway → Auth → Query Service → Read DB (replica) → Return
```

### 7.3 Async Path (Analytics)

```
Pub/Sub → Dataflow/Functions → BigQuery → Dashboards
```

---

## 8. Observability Design

### 8.1 Logging Standards

```typescript
// Structured log format
interface LogEntry {
  timestamp: string;
  severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  service: string;
  traceId: string;
  spanId: string;
  message: string;
  context: {
    requestId: string;
    userId?: string;
    partnerId?: string;
    eventId?: string;
  };
  latencyMs?: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}
```

### 8.2 Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `ledger_events_written_total` | Counter | `event_type`, `partner_id` |
| `ledger_write_latency_seconds` | Histogram | `event_type` |
| `ledger_proofs_generated_total` | Counter | `proof_type` |
| `api_requests_total` | Counter | `method`, `path`, `status` |
| `api_latency_seconds` | Histogram | `method`, `path` |

### 8.3 SLOs

| SLO | Target | Measurement |
|-----|--------|-------------|
| Availability | 99.9% | Uptime checks |
| Write Latency (P99) | <500ms | Cloud Monitoring |
| Proof Generation (P99) | <200ms | Cloud Monitoring |
| Error Rate | <0.1% | Error count / request count |

---

## 9. Cost Estimate (Phase 2)

### 9.1 Monthly Baseline

| Component | Specification | Monthly Cost |
|-----------|---------------|--------------|
| GKE Autopilot | 2-4 nodes | ~$150-300 |
| Cloud SQL | db-custom-2-8192, HA | ~$200-400 |
| Cloud Storage | 100GB | ~$2 |
| Memorystore Redis | 1GB | ~$35 |
| Pub/Sub | 10M messages | ~$10 |
| Cloud Monitoring | Standard | ~$50 |
| **Total Baseline** | | **~$450-800/month** |

### 9.2 Production Ready (Phase 4)

| Component | Specification | Monthly Cost |
|-----------|---------------|--------------|
| GKE | 6-10 nodes, multi-zone | ~$500-1000 |
| Cloud SQL | db-custom-4-16384, HA, replica | ~$600-800 |
| Everything else | Scaled | ~$200-400 |
| **Total Production** | | **~$1,300-2,200/month** |

---

## 10. Security Architecture

### 10.1 Defense in Depth

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                              │
│                                                                  │
│  Layer 1: Edge                                                  │
│  • Cloud Armor (WAF, DDoS protection)                          │
│  • SSL/TLS termination                                          │
│                                                                  │
│  Layer 2: Identity                                              │
│  • Identity-Aware Proxy                                         │
│  • JWT validation                                               │
│  • API key verification                                         │
│                                                                  │
│  Layer 3: Network                                               │
│  • VPC with private subnets                                     │
│  • Firewall rules (deny by default)                            │
│  • Private Google Access                                        │
│                                                                  │
│  Layer 4: Service                                               │
│  • mTLS between services                                        │
│  • RBAC authorization                                           │
│  • Input validation                                             │
│                                                                  │
│  Layer 5: Data                                                  │
│  • Encryption at rest (CMEK)                                   │
│  • Encryption in transit (TLS 1.3)                             │
│  • Field-level encryption for PII                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Approval & Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| CTO | [AI Agent - CTO Role] | ✅ APPROVED | 2024-12-10 |
| Lead Architect | [Pending] | ⏳ PENDING | - |
| CEO | [Pending] | ⏳ PENDING | - |

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | CTO Agent | Initial reference architecture |
