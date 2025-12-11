# Data Scientist Phase 1 - Analytics Blueprint

**Document ID:** `data_scientist_analytics_phase_1_deliverables_v1`  
**Phase:** 1 - Governance & Zero-Trust Architecture  
**Status:** APPROVED  
**Classification:** L1_GENERAL  
**Last Updated:** 2024-12-10  

---

## 1. Objective

Define the analytics architecture and data pipeline requirements for Proveniq Ledger. Ensure analytics designs support compliance requirements and respect data residency rules.

---

## 2. Analytics Use Cases

### 2.1 Internal Analytics

| Use Case | Purpose | Data Needed |
|----------|---------|-------------|
| **Fraud Pattern Analysis** | Identify new fraud signatures | Claims, proofs, outcomes |
| **Model Performance** | Track AI model accuracy | Predictions, actuals, overrides |
| **System Health** | Monitor platform reliability | Logs, metrics, traces |
| **Usage Analytics** | Track API/feature adoption | API calls, user sessions |

### 2.2 Partner Analytics

| Use Case | Purpose | Data Needed |
|----------|---------|-------------|
| **Claim Insights** | Help partners understand their claims | Aggregated claim stats |
| **Fraud Reports** | Periodic fraud summary reports | Anonymized fraud patterns |
| **Verification Metrics** | API usage and success rates | Partner-specific metrics |
| **Benchmark Data** | Industry comparisons | Anonymized industry stats |

---

## 3. Data Architecture

### 3.1 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ANALYTICS DATA FLOW                          │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Ledger   │───►│ Event    │───►│ Transform │───►│ Analytics│ │
│  │ Events   │    │ Stream   │    │ Pipeline  │    │ Store    │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                        │        │
│                                                        ▼        │
│                                              ┌──────────────┐   │
│                                              │  Dashboards  │   │
│                                              │  & Reports   │   │
│                                              └──────────────┘   │
│                                                                  │
│  PRIVACY BOUNDARY:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PII stripped or anonymized before analytics store       │   │
│  │  Only aggregated data crosses to partner dashboards      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Layers

| Layer | Purpose | Technology | Retention |
|-------|---------|------------|-----------|
| **Bronze** | Raw events | Cloud Storage / BigQuery | 90 days |
| **Silver** | Cleaned, validated | BigQuery | 1 year |
| **Gold** | Aggregated, anonymized | BigQuery | 7 years |
| **Reports** | Pre-computed insights | Looker / Metabase | Real-time |

---

## 4. Schema Design Requirements

### 4.1 Analytics-Ready Event Schema

```typescript
interface AnalyticsEvent {
  // Event metadata
  eventId: string;
  eventType: AnalyticsEventType;
  timestamp: string;
  
  // Entity references (anonymized in Gold layer)
  claimIdHash: string;      // Hashed, not raw ID
  partnerIdHash: string;    // Hashed
  
  // Dimensions (safe for analytics)
  claimType: string;
  claimAmountBucket: string;  // "$0-1000", "$1000-5000", etc.
  region: string;             // State/country only
  
  // Metrics
  processingTimeMs: number;
  fraudScore: number;
  verificationResult: string;
  
  // Lineage
  sourceSystem: string;
  pipelineVersion: string;
}

type AnalyticsEventType = 
  | 'claim_submitted'
  | 'claim_verified'
  | 'fraud_detected'
  | 'proof_generated'
  | 'api_call';
```

### 4.2 Aggregation Schemas

```sql
-- Daily claim aggregates (Gold layer)
CREATE TABLE gold.daily_claim_stats (
  date DATE,
  partner_id_hash STRING,
  claim_type STRING,
  region STRING,
  
  -- Aggregates
  total_claims INT64,
  total_verified INT64,
  total_flagged INT64,
  avg_fraud_score FLOAT64,
  p50_processing_time_ms INT64,
  p99_processing_time_ms INT64,
  
  -- Metadata
  updated_at TIMESTAMP
);
```

---

## 5. Privacy & Compliance Requirements

### 5.1 Data Minimization

| Field Type | Bronze | Silver | Gold |
|------------|--------|--------|------|
| Claim ID | ✅ Raw | ✅ Raw | ❌ Hashed |
| Customer Name | ❌ Never | ❌ Never | ❌ Never |
| Claim Amount | ✅ Raw | ✅ Raw | ✅ Bucketed |
| Location | ✅ Full address | ✅ City/State | ✅ State only |
| Timestamps | ✅ Exact | ✅ Exact | ✅ Day-level |

### 5.2 Cross-Border Data Rules

Per Lead Architect Data Residency Plan:

```yaml
analytics_residency:
  eu_data:
    source_region: eu-west1
    analytics_region: eu-west1  # Cannot leave EU
    aggregation_allowed: true
    
  us_data:
    source_region: us-east1
    analytics_region: us-east1  # Primary
    replication: us-west1       # DR only
```

### 5.3 Anonymization Techniques

| Technique | Use Case | Implementation |
|-----------|----------|----------------|
| **Hashing** | IDs in Gold layer | SHA-256 with salt |
| **Bucketing** | Amounts, ages | Predefined ranges |
| **Generalization** | Location | City → State → Region |
| **Suppression** | Rare categories | k-anonymity (k=10) |
| **Differential Privacy** | Public reports | Noise injection |

---

## 6. ML Pipeline Integration

### 6.1 Feature Store Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     FEATURE STORE                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ONLINE FEATURES (Real-time serving)                     │   │
│  │  • claim_fraud_score                                     │   │
│  │  • partner_fraud_rate_7d                                 │   │
│  │  • claim_type_avg_amount                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  OFFLINE FEATURES (Batch training)                       │   │
│  │  • historical_fraud_patterns                             │   │
│  │  • seasonal_claim_trends                                 │   │
│  │  • partner_behavior_profiles                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  TOOLS: Feast, Vertex AI Feature Store, or custom             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Model Training Data

```yaml
training_data_requirements:
  fraud_detection_model:
    source: gold.claim_events
    features:
      - claim_amount_bucket
      - claim_type
      - region
      - time_of_day
      - day_of_week
      - partner_fraud_rate
    label: is_fraud
    
  # PII handling
  pii_fields_excluded:
    - customer_name
    - customer_email
    - claim_description  # May contain PII
    
  bias_monitoring_dimensions:
    - region
    - claim_type
    - claim_amount_bucket
```

---

## 7. Dashboards & Reporting

### 7.1 Internal Dashboards

| Dashboard | Audience | Key Metrics |
|-----------|----------|-------------|
| **Executive** | CEO, CTO | Revenue, claims volume, fraud detection |
| **Operations** | Eng, Support | System health, error rates, latency |
| **ML Performance** | Data team | Model accuracy, drift, bias |
| **Compliance** | Legal, Compliance | Audit metrics, DSR stats |

### 7.2 Partner Dashboards

| Dashboard | Metrics | Data Access |
|-----------|---------|-------------|
| **Usage** | API calls, success rate | Partner's own data only |
| **Claims** | Verification counts, status | Partner's claims only |
| **Fraud** | Fraud rate, top patterns | Partner's + anonymized industry |

---

## 8. Technology Recommendations

### 8.1 Analytics Stack

| Component | Recommendation | Rationale |
|-----------|----------------|-----------|
| **Data Warehouse** | BigQuery | GCP-native, scales well |
| **ETL/Transform** | dbt | SQL-based, version controlled |
| **Streaming** | Pub/Sub + Dataflow | Real-time event processing |
| **Visualization** | Looker or Metabase | Self-service dashboards |
| **Feature Store** | Vertex AI | GCP-native, ML-integrated |

### 8.2 Phase 1 Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Warehouse | BigQuery | Already in GCP ecosystem |
| Streaming | Defer to Phase 2 | Start with batch |
| Visualization | Metabase (OSS) | Cost-effective for MVP |

---

## 9. Phase 1 Deliverables Checklist

- [x] Analytics use cases defined
- [x] Data architecture designed
- [x] Schema requirements documented
- [x] Privacy requirements specified
- [x] ML pipeline integration planned
- [x] Dashboard requirements listed
- [ ] BigQuery setup (Phase 2)
- [ ] dbt project initialization (Phase 2)
- [ ] Metabase deployment (Phase 2)

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | Data Scientist Agent | Initial analytics blueprint |
