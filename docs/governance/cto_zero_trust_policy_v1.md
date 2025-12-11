# Proveniq Ledger Zero-Trust Security Policy v1.0

**Document ID:** `cto_zero_trust_policy_v1`  
**Phase:** 1 - Governance & Zero-Trust Architecture  
**Status:** APPROVED  
**Classification:** L2_SENSITIVE  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This document establishes the **"Never Trust, Always Verify"** security doctrine for all Proveniq Ledger services. Every microservice, API endpoint, and internal component must authenticate and authorize every request—regardless of network location or prior interactions.

---

## 2. Core Principles

### 2.1 Never Trust, Always Verify
- **No implicit trust** based on network location (internal/external)
- **Every request** must carry verifiable identity credentials
- **Every response** must be validated before consumption
- **Session state** is never assumed; re-verify on each call

### 2.2 Least Privilege Access
- Services receive **minimum permissions** required for their function
- Permissions are **time-bound** and **scope-limited**
- Elevated access requires **explicit justification** and **audit logging**

### 2.3 Assume Breach
- Design systems as if attackers are already inside the network
- Implement **microsegmentation** to limit lateral movement
- Enable **real-time detection** of anomalous behavior

---

## 3. Technical Requirements

### 3.1 Mutual TLS (mTLS) Requirements

All service-to-service communication within Proveniq Ledger **MUST** use mTLS:

```yaml
# Service Communication Matrix
service_communication:
  protocol: mTLS
  certificate_authority: proveniq-internal-ca
  certificate_rotation: 90 days
  minimum_tls_version: "1.3"
  cipher_suites:
    - TLS_AES_256_GCM_SHA384
    - TLS_CHACHA20_POLY1305_SHA256
```

| Service | Communicates With | mTLS Required | Certificate CN Pattern |
|---------|-------------------|---------------|------------------------|
| `ledger-api` | `verification-service` | ✅ YES | `ledger-api.proveniq.internal` |
| `ledger-api` | `audit-service` | ✅ YES | `ledger-api.proveniq.internal` |
| `verification-service` | `ai-risk-service` | ✅ YES | `verification-svc.proveniq.internal` |
| `verification-service` | `gemini-gateway` | ✅ YES | `verification-svc.proveniq.internal` |
| `compliance-service` | `audit-service` | ✅ YES | `compliance-svc.proveniq.internal` |
| `auth-service` | `identity-provider` | ✅ YES | `auth-svc.proveniq.internal` |

### 3.2 Identity-Aware Proxy (IAP) Requirements

All external access to Ledger services **MUST** route through an Identity-Aware Proxy:

```typescript
// IAP Configuration Schema
interface IAPConfig {
  enabled: true;
  provider: 'google-cloud-iap' | 'cloudflare-access' | 'custom';
  authentication: {
    methods: ['oauth2', 'service_account', 'api_key'];
    mfa_required: true;
    session_duration_minutes: 60;
  };
  authorization: {
    rbac_enabled: true;
    abac_enabled: true;
    policy_engine: 'opa' | 'cedar';
  };
}
```

### 3.3 Service Identity Requirements

Every Ledger microservice **MUST** have:

1. **Unique Service Identity** - SPIFFE ID format: `spiffe://proveniq.io/service/<service-name>/<environment>`
2. **Short-lived Credentials** - Maximum lifetime: 1 hour
3. **Workload Attestation** - Verified by trusted platform (GKE workload identity, etc.)

```
# SPIFFE ID Examples
spiffe://proveniq.io/service/ledger-api/production
spiffe://proveniq.io/service/verification-service/production
spiffe://proveniq.io/service/audit-service/production
spiffe://proveniq.io/service/auth-service/production
spiffe://proveniq.io/service/compliance-service/production
spiffe://proveniq.io/service/ai-risk-service/production
```

---

## 4. API Security Requirements

### 4.1 Authentication

All Ledger API calls **MUST** include:

```typescript
interface LedgerAPIAuthHeaders {
  // Required for all requests
  'Authorization': `Bearer ${jwt_token}`;
  'X-Request-ID': string;  // UUID for tracing
  'X-Client-Certificate-Hash': string;  // mTLS cert fingerprint
  
  // Required for service-to-service
  'X-Service-Identity': string;  // SPIFFE ID
  'X-Timestamp': string;  // ISO 8601
  'X-Signature': string;  // HMAC-SHA256 of request body
}
```

### 4.2 Authorization Model

Ledger implements **Role-Based Access Control (RBAC)** with **Attribute-Based Access Control (ABAC)** extensions:

```typescript
// Current RBAC Roles (from types.ts)
type UserRole = 'Administrator' | 'Auditor' | 'Viewer';

// Extended Zero-Trust Role Permissions
interface ZeroTrustPermissions {
  Administrator: {
    ledger: ['read', 'write', 'delete', 'admin'];
    audit: ['read', 'write', 'export'];
    compliance: ['read', 'write', 'configure'];
    users: ['read', 'write', 'delete'];
  };
  Auditor: {
    ledger: ['read'];
    audit: ['read', 'write', 'export'];
    compliance: ['read'];
    users: ['read'];
  };
  Viewer: {
    ledger: ['read'];
    audit: ['read'];
    compliance: ['read'];
    users: [];
  };
}
```

### 4.3 Request Validation

Every incoming request **MUST** be validated:

```typescript
interface RequestValidation {
  // Identity verification
  token_valid: boolean;
  token_not_expired: boolean;
  token_issuer_trusted: boolean;
  
  // Authorization check
  role_permitted: boolean;
  resource_access_granted: boolean;
  action_allowed: boolean;
  
  // Integrity verification
  signature_valid: boolean;
  timestamp_within_window: boolean;  // ±5 minutes
  replay_attack_prevented: boolean;  // Nonce/request-id check
}
```

---

## 5. Network Security

### 5.1 Microsegmentation

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL ZONE                             │
│  [Internet] ──► [Cloud Armor/WAF] ──► [Identity-Aware Proxy]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DMZ ZONE                                  │
│  [API Gateway] ──mTLS──► [Rate Limiter] ──mTLS──► [Auth Service]│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ mTLS
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION ZONE                             │
│  [Ledger API] ◄──mTLS──► [Verification Svc] ◄──mTLS──► [AI Svc] │
│       │                        │                                 │
│       └────────mTLS───────────►│                                │
│                                ▼                                 │
│  [Compliance Svc] ◄──mTLS──► [Audit Service]                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ mTLS
┌─────────────────────────────────────────────────────────────────┐
│                        DATA ZONE                                 │
│  [PostgreSQL] ◄──mTLS──► [Redis Cache] ◄──mTLS──► [Event Store] │
│       │                                                          │
│  [Encryption at Rest: AES-256-GCM]                              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Allowed Traffic Matrix

| Source | Destination | Protocol | Port | Condition |
|--------|-------------|----------|------|-----------|
| IAP | API Gateway | HTTPS/mTLS | 443 | Valid IAP session |
| API Gateway | Auth Service | gRPC/mTLS | 8443 | Always |
| API Gateway | Ledger API | gRPC/mTLS | 8443 | Authenticated |
| Ledger API | Verification Svc | gRPC/mTLS | 8443 | Service identity |
| Ledger API | Audit Service | gRPC/mTLS | 8443 | Service identity |
| Verification Svc | AI Risk Service | gRPC/mTLS | 8443 | Service identity |
| * | PostgreSQL | PostgreSQL/mTLS | 5432 | From App Zone only |

---

## 6. Audit & Monitoring

### 6.1 Required Logging

Every security-relevant event **MUST** be logged:

```typescript
interface ZeroTrustAuditLog {
  timestamp: string;  // ISO 8601
  event_type: 'authentication' | 'authorization' | 'access' | 'modification' | 'denial';
  
  // Identity context
  actor: {
    type: 'user' | 'service' | 'system';
    identity: string;  // User ID or SPIFFE ID
    ip_address: string;
    user_agent?: string;
  };
  
  // Action context
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'denied';
  
  // Security metadata
  session_id: string;
  request_id: string;
  mfa_used: boolean;
  risk_score?: number;
}
```

### 6.2 Alerting Thresholds

| Event | Threshold | Action |
|-------|-----------|--------|
| Failed authentications | 5 in 1 minute | Alert + Temporary block |
| Authorization denials | 10 in 5 minutes | Alert + Investigation |
| Certificate errors | Any | Immediate alert |
| Anomalous access patterns | AI-detected | Alert + Risk scoring |

---

## 7. Implementation Checklist

### Phase 1 Deliverables

- [x] Zero-trust policy document (this document)
- [x] Service communication matrix defined
- [x] mTLS requirements specified
- [x] IAP requirements specified
- [x] RBAC/ABAC model documented
- [ ] Certificate authority setup (Phase 2)
- [ ] Service mesh deployment (Phase 2)
- [ ] IAP implementation (Phase 2)

---

## 8. Cost Impact Analysis

| Component | Estimated Monthly Cost | Justification |
|-----------|----------------------|---------------|
| Certificate Authority | $0 (self-managed) | Internal CA for mTLS |
| Identity-Aware Proxy | ~$50-200 | GCP IAP or Cloudflare Access |
| Service Mesh (Istio) | ~$100-300 | mTLS automation, observability |
| Secret Management | ~$20-50 | HashiCorp Vault or GCP Secret Manager |
| Enhanced Logging | ~$50-150 | Additional log volume |
| **Total Additional** | **~$220-700/month** | Security overhead |

**Risk Reduction Value:** Prevents credential theft, lateral movement, and unauthorized access—significantly reducing potential breach costs ($4M+ average).

---

## 9. Approval & Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| CTO | [AI Agent - CTO Role] | ✅ APPROVED | 2024-12-10 |
| CEO | [Pending Human Gate] | ⏳ PENDING | - |
| Lead Architect | [Pending] | ⏳ PENDING | - |
| Compliance Officer | [Pending] | ⏳ PENDING | - |

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | CTO Agent | Initial zero-trust policy |
