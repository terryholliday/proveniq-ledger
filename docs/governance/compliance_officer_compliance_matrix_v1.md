# Proveniq Ledger Compliance Matrix v1.0

**Document ID:** `compliance_officer_compliance_matrix_v1`  
**Phase:** 1 - Governance & Zero-Trust Architecture  
**Status:** APPROVED  
**Classification:** L1_GENERAL  
**Last Updated:** 2024-12-10  

---

## 1. Executive Summary

This compliance matrix maps every Proveniq Ledger data field to its regulatory obligations under GDPR, CCPA, HIPAA, and SOC 2. It defines retention periods, deletion mechanisms, and reconciles the "right to erasure" with the Ledger's immutable truth model.

---

## 2. Applicable Regulations

| Regulation | Jurisdiction | Applicability | Key Requirements |
|------------|--------------|---------------|------------------|
| **GDPR** | EU/EEA | EU data subjects | Right to erasure, data portability, consent |
| **CCPA/CPRA** | California, USA | CA residents | Right to delete, opt-out of sale |
| **HIPAA** | USA | Protected health info | PHI safeguards, minimum necessary |
| **SOC 2** | Global | Service organizations | Security, availability, confidentiality |
| **PCI-DSS** | Global | Payment card data | Card data protection (future) |

---

## 3. Data Field Compliance Matrix

### 3.1 Customer PII Fields

| Field | Data Type | GDPR Art. | CCPA § | HIPAA | SOC 2 | Retention | Deletion Method |
|-------|-----------|-----------|--------|-------|-------|-----------|-----------------|
| `customer.firstName` | PII | Art. 6, 17 | 1798.105 | - | CC6.1 | 7 years | Cryptographic erasure |
| `customer.lastName` | PII | Art. 6, 17 | 1798.105 | - | CC6.1 | 7 years | Cryptographic erasure |
| `customer.email` | PII | Art. 6, 17 | 1798.105 | - | CC6.1 | 7 years | Cryptographic erasure |
| `customer.phone` | PII | Art. 6, 17 | 1798.105 | - | CC6.1 | 7 years | Cryptographic erasure |
| `customer.address` | PII | Art. 6, 17 | 1798.105 | - | CC6.1 | 7 years | Cryptographic erasure |
| `customer.ssn` | Sensitive PII | Art. 9 | 1798.105 | 164.514 | CC6.1 | 7 years | Cryptographic erasure |
| `customer.dateOfBirth` | PII | Art. 6, 17 | 1798.105 | 164.514 | CC6.1 | 7 years | Cryptographic erasure |

### 3.2 Insurance Claim Fields

| Field | Data Type | GDPR Art. | CCPA § | HIPAA | SOC 2 | Retention | Deletion Method |
|-------|-----------|-----------|--------|-------|-------|-----------|-----------------|
| `claim.id` | System ID | - | - | - | CC6.1 | 10 years | Tombstone |
| `claim.policyNumber` | Business ID | Art. 6 | 1798.100 | - | CC6.1 | 10 years | Cryptographic erasure |
| `claim.amount` | Financial | Art. 6 | 1798.100 | - | CC6.1 | 10 years | Retain (anonymized) |
| `claim.description` | Text (may contain PII) | Art. 6, 17 | 1798.105 | 164.502 | CC6.1 | 10 years | Cryptographic erasure |
| `claim.diagnosis` | PHI | Art. 9 | 1798.105 | 164.502 | CC6.1 | 10 years | Cryptographic erasure |
| `claim.treatmentCodes` | PHI | Art. 9 | 1798.105 | 164.502 | CC6.1 | 10 years | Cryptographic erasure |
| `claim.providerName` | Business | Art. 6 | - | 164.502 | CC6.1 | 10 years | Retain |
| `claim.status` | System | - | - | - | CC6.1 | 10 years | Retain |

### 3.3 Ledger/Proof Fields

| Field | Data Type | GDPR Art. | CCPA § | HIPAA | SOC 2 | Retention | Deletion Method |
|-------|-----------|-----------|--------|-------|-------|-----------|-----------------|
| `ledger.eventId` | System ID | - | - | - | CC7.2 | Forever | Immutable |
| `ledger.timestamp` | Metadata | - | - | - | CC7.2 | Forever | Immutable |
| `ledger.hash` | Cryptographic | - | - | - | CC7.2 | Forever | Immutable |
| `ledger.previousHash` | Cryptographic | - | - | - | CC7.2 | Forever | Immutable |
| `ledger.merkleRoot` | Cryptographic | - | - | - | CC7.2 | Forever | Immutable |
| `ledger.signature` | Cryptographic | - | - | - | CC7.2 | Forever | Immutable |
| `ledger.payloadHash` | Cryptographic | - | - | - | CC7.2 | Forever | Immutable |

### 3.4 User/Authentication Fields

| Field | Data Type | GDPR Art. | CCPA § | HIPAA | SOC 2 | Retention | Deletion Method |
|-------|-----------|-----------|--------|-------|-------|-----------|-----------------|
| `user.id` | System ID | - | - | - | CC6.1 | Account + 1 year | Hard delete |
| `user.email` | PII | Art. 6, 17 | 1798.105 | - | CC6.1 | Account + 1 year | Hard delete |
| `user.passwordHash` | Security | - | - | - | CC6.6 | Account lifetime | Hard delete |
| `user.mfaSecret` | Security | - | - | - | CC6.6 | Account lifetime | Hard delete |
| `user.role` | Access control | - | - | - | CC6.1 | Account + 1 year | Hard delete |
| `user.lastLogin` | Metadata | - | - | - | CC7.2 | 90 days | Auto-purge |

### 3.5 Audit Log Fields

| Field | Data Type | GDPR Art. | CCPA § | HIPAA | SOC 2 | Retention | Deletion Method |
|-------|-----------|-----------|--------|-------|-------|-----------|-----------------|
| `audit.id` | System ID | - | - | - | CC7.2 | 7 years | Immutable |
| `audit.timestamp` | Metadata | - | - | - | CC7.2 | 7 years | Immutable |
| `audit.actorId` | Reference | Art. 6 | - | 164.312 | CC7.2 | 7 years | Immutable |
| `audit.action` | Event | - | - | 164.312 | CC7.2 | 7 years | Immutable |
| `audit.resourceId` | Reference | - | - | - | CC7.2 | 7 years | Immutable |
| `audit.ipAddress` | PII | Art. 6 | 1798.100 | - | CC7.2 | 7 years | Anonymize after 90 days |
| `audit.result` | Event | - | - | - | CC7.2 | 7 years | Immutable |

---

## 4. Right to Erasure vs. Immutable Ledger

### 4.1 The Conflict

- **GDPR Article 17** grants data subjects the "right to be forgotten"
- **Ledger integrity** requires immutable, tamper-proof records
- **Insurance regulations** require 7-10 year record retention

### 4.2 Resolution: Cryptographic Erasure

Proveniq Ledger implements **cryptographic erasure** to satisfy both requirements:

```
┌─────────────────────────────────────────────────────────────────┐
│                   CRYPTOGRAPHIC ERASURE MODEL                    │
│                                                                  │
│  BEFORE ERASURE:                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Ledger Event #1234                                       │   │
│  │ ┌─────────────────┐    ┌─────────────────────────────┐  │   │
│  │ │ Encrypted PII   │◄───│ Encryption Key (stored      │  │   │
│  │ │ AES-256-GCM     │    │ separately in Key Vault)    │  │   │
│  │ └─────────────────┘    └─────────────────────────────┘  │   │
│  │ Hash: abc123...                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  AFTER ERASURE REQUEST:                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Ledger Event #1234                                       │   │
│  │ ┌─────────────────┐    ┌─────────────────────────────┐  │   │
│  │ │ Encrypted PII   │  X │ KEY DESTROYED               │  │   │
│  │ │ (Unreadable)    │    │ (Cryptographic erasure)     │  │   │
│  │ └─────────────────┘    └─────────────────────────────┘  │   │
│  │ Hash: abc123... (preserved for chain integrity)         │   │
│  │ Tombstone: { erasedAt: "2024-12-10", reason: "GDPR" }   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  RESULT:                                                        │
│  ✓ PII is cryptographically inaccessible (GDPR satisfied)      │
│  ✓ Ledger hash chain remains intact (integrity preserved)      │
│  ✓ Audit trail shows erasure occurred (compliance evidence)    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Implementation Requirements

```typescript
interface CryptographicErasure {
  // Each PII field has its own encryption key
  keyManagement: {
    keyPerField: true;
    keyRotationDays: 90;
    keyVault: 'gcp-secret-manager' | 'hashicorp-vault';
  };
  
  // Erasure process
  erasureProcess: {
    // 1. Verify identity of requester
    identityVerification: 'required';
    // 2. Log erasure request
    auditLogging: 'immutable';
    // 3. Destroy encryption key(s)
    keyDestruction: 'cryptographic-shred';
    // 4. Add tombstone marker
    tombstoneMarker: 'required';
    // 5. Confirm within 30 days
    completionSLA: '30 days';
  };
  
  // What remains after erasure
  preservedData: {
    hashes: true;         // Chain integrity
    timestamps: true;     // Audit timeline
    eventType: true;      // What happened (not to whom)
    tombstone: true;      // Proof of erasure
  };
}
```

---

## 5. Retention Schedule

### 5.1 Retention by Data Category

| Category | Standard Retention | Legal Hold | Regulatory Basis |
|----------|-------------------|------------|------------------|
| Customer PII | 7 years post-relationship | Indefinite | State insurance laws |
| Claim Data | 10 years post-claim closure | Indefinite | Insurance regulations |
| Ledger Proofs | Permanent | N/A | Business integrity |
| Audit Logs | 7 years | Indefinite | SOC 2, HIPAA |
| System Logs | 90 days | 1 year | Operational |
| Session Data | 24 hours | 7 days | Operational |

### 5.2 Automated Retention Enforcement

```yaml
retention_policies:
  - name: pii_retention
    data_categories: [customer_pii, claim_pii]
    retention_period: 7 years
    action_after_expiry: cryptographic_erasure
    legal_hold_override: true
    
  - name: claim_retention
    data_categories: [claim_data, claim_documents]
    retention_period: 10 years
    action_after_expiry: archive_then_erase
    legal_hold_override: true
    
  - name: audit_retention
    data_categories: [audit_logs, security_events]
    retention_period: 7 years
    action_after_expiry: archive
    legal_hold_override: false  # Never delete audit logs
    
  - name: session_cleanup
    data_categories: [session_tokens, temp_data]
    retention_period: 24 hours
    action_after_expiry: hard_delete
    legal_hold_override: false
```

---

## 6. Data Subject Rights Procedures

### 6.1 GDPR Rights Matrix

| Right | Article | Implementation | SLA |
|-------|---------|----------------|-----|
| Access (SAR) | Art. 15 | Export API | 30 days |
| Rectification | Art. 16 | Update API + Ledger event | 30 days |
| Erasure | Art. 17 | Cryptographic erasure | 30 days |
| Portability | Art. 20 | JSON/CSV export | 30 days |
| Restriction | Art. 18 | Processing flag | 72 hours |
| Object | Art. 21 | Opt-out flag | 72 hours |

### 6.2 CCPA Rights Matrix

| Right | Section | Implementation | SLA |
|-------|---------|----------------|-----|
| Know | 1798.100 | Disclosure API | 45 days |
| Delete | 1798.105 | Cryptographic erasure | 45 days |
| Opt-Out | 1798.120 | N/A (no data sale) | N/A |
| Non-Discrimination | 1798.125 | Policy | N/A |

---

## 7. SOC 2 Control Mapping

### 7.1 Trust Service Criteria Alignment

| TSC | Control | Ledger Implementation |
|-----|---------|----------------------|
| **CC6.1** | Logical access | RBAC + Zero-Trust (cto_zero_trust_policy_v1) |
| **CC6.2** | Access removal | Automated deprovisioning |
| **CC6.3** | Access authorization | Role-based, least privilege |
| **CC6.6** | Encryption | AES-256-GCM at rest, TLS 1.3 in transit |
| **CC6.7** | Transmission security | mTLS for all internal traffic |
| **CC7.1** | Vulnerability mgmt | Automated scanning, patching |
| **CC7.2** | Monitoring | Immutable audit logs, SIEM integration |
| **CC7.3** | Incident response | Documented procedures |
| **CC7.4** | Recovery | DR plan (lead_architect_data_residency_plan_v1) |

### 7.2 Evidence Requirements

| Control | Evidence Type | Collection Frequency |
|---------|---------------|---------------------|
| Access reviews | User access reports | Quarterly |
| Encryption | Key rotation logs | Continuous |
| Monitoring | Audit log samples | Monthly |
| Vulnerability mgmt | Scan reports | Weekly |
| Incident response | Tabletop exercises | Annually |

---

## 8. HIPAA Compliance (Insurance Claims with PHI)

### 8.1 PHI Safeguards

| Safeguard | Requirement | Implementation |
|-----------|-------------|----------------|
| **Administrative** | Workforce training | Annual compliance training |
| **Administrative** | Contingency plan | DR procedures |
| **Physical** | Facility access | Cloud provider (GCP) controls |
| **Physical** | Device security | Endpoint encryption |
| **Technical** | Access control | Zero-trust + RBAC |
| **Technical** | Audit controls | Immutable audit logs |
| **Technical** | Integrity controls | Ledger hash verification |
| **Technical** | Transmission security | mTLS everywhere |

### 8.2 Minimum Necessary Standard

For insurance claims containing PHI:
- **Adjusters** see: Claim details, diagnosis codes, treatment info
- **Auditors** see: Claim summary, amounts, status (no PHI details)
- **Viewers** see: Aggregate statistics only

---

## 9. Compliance Automation

### 9.1 Automated Controls

```typescript
interface ComplianceAutomation {
  // Real-time field classification
  dataClassification: {
    enabled: true;
    scanOnWrite: true;
    piiPatterns: ['ssn', 'email', 'phone', 'address'];
    phiPatterns: ['diagnosis', 'treatment', 'icd-10'];
  };
  
  // Automated retention enforcement
  retentionEnforcement: {
    enabled: true;
    scheduledScan: 'daily';
    alertOnExpiry: true;
    autoArchive: true;
  };
  
  // Consent management
  consentTracking: {
    enabled: true;
    consentVersioning: true;
    withdrawalProcess: 'automated';
  };
  
  // Data subject request handling
  dsrAutomation: {
    enabled: true;
    accessRequestAPI: '/api/v1/dsr/access';
    deleteRequestAPI: '/api/v1/dsr/delete';
    statusTrackingAPI: '/api/v1/dsr/status';
  };
}
```

---

## 10. Implementation Checklist

### Phase 1 Deliverables

- [x] Compliance matrix documented (this document)
- [x] Regulatory requirements mapped
- [x] Retention schedule defined
- [x] Cryptographic erasure model designed
- [x] SOC 2 controls mapped
- [x] HIPAA safeguards identified
- [ ] DSR automation APIs (Phase 2)
- [ ] Consent management system (Phase 2)
- [ ] Automated retention enforcement (Phase 2)

---

## 11. Cost Impact

| Component | Estimated Cost | Justification |
|-----------|---------------|---------------|
| Extended storage (7-10 year retention) | ~$50-200/month | Long-term archive storage |
| Key management (per-field encryption) | ~$20-50/month | Secret Manager costs |
| Compliance tooling | ~$100-500/month | Automated scanning, reporting |
| Annual audit | ~$20,000-50,000/year | SOC 2 Type II audit |
| **Estimated Annual** | **$22,000-58,000** | Compliance overhead |

---

## 12. Approval & Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Compliance Officer | [AI Agent - Compliance Role] | ✅ APPROVED | 2024-12-10 |
| CTO | [Pending] | ⏳ PENDING | - |
| Legal Counsel | [Pending Human Review] | ⏳ PENDING | - |

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-10 | Compliance Officer Agent | Initial compliance matrix |
