/**
 * Compliance Types for Proveniq Ledger
 * 
 * Based on: compliance_officer_compliance_matrix_v1
 * Phase: 1 - Governance & Zero-Trust Architecture
 */

// =============================================================================
// REGULATORY FRAMEWORKS
// =============================================================================

export type RegulatoryFramework = 'GDPR' | 'CCPA' | 'HIPAA' | 'SOC2' | 'PCI_DSS';

export interface RegulationInfo {
  framework: RegulatoryFramework;
  jurisdiction: string;
  applicability: string;
  keyRequirements: string[];
}

export const REGULATIONS: Record<RegulatoryFramework, RegulationInfo> = {
  GDPR: {
    framework: 'GDPR',
    jurisdiction: 'EU/EEA',
    applicability: 'EU data subjects',
    keyRequirements: ['Right to erasure', 'Data portability', 'Consent management'],
  },
  CCPA: {
    framework: 'CCPA',
    jurisdiction: 'California, USA',
    applicability: 'CA residents',
    keyRequirements: ['Right to delete', 'Right to know', 'Opt-out of sale'],
  },
  HIPAA: {
    framework: 'HIPAA',
    jurisdiction: 'USA',
    applicability: 'Protected Health Information',
    keyRequirements: ['PHI safeguards', 'Minimum necessary', 'Breach notification'],
  },
  SOC2: {
    framework: 'SOC2',
    jurisdiction: 'Global',
    applicability: 'Service organizations',
    keyRequirements: ['Security', 'Availability', 'Confidentiality'],
  },
  PCI_DSS: {
    framework: 'PCI_DSS',
    jurisdiction: 'Global',
    applicability: 'Payment card data',
    keyRequirements: ['Card data protection', 'Network security', 'Access control'],
  },
};

// =============================================================================
// DATA CLASSIFICATION
// =============================================================================

export type DataSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type PIICategory = 
  | 'DIRECT_IDENTIFIER'     // Name, SSN, email
  | 'INDIRECT_IDENTIFIER'   // DOB, address
  | 'SENSITIVE_PII'         // SSN, financial data
  | 'PHI'                   // Health information
  | 'NON_PII';              // Anonymized/system data

export interface FieldClassification {
  fieldName: string;
  piiCategory: PIICategory;
  sensitivity: DataSensitivity;
  gdprArticles: string[];
  ccpaSections: string[];
  hipaaReferences: string[];
  soc2Controls: string[];
  retentionPeriodYears: number;
  deletionMethod: DeletionMethod;
}

// =============================================================================
// RETENTION & DELETION
// =============================================================================

export type DeletionMethod = 
  | 'CRYPTOGRAPHIC_ERASURE'  // Destroy encryption key
  | 'HARD_DELETE'            // Physical deletion
  | 'SOFT_DELETE'            // Logical deletion with tombstone
  | 'ANONYMIZE'              // Replace PII with anonymized data
  | 'ARCHIVE'                // Move to cold storage
  | 'IMMUTABLE';             // Cannot be deleted (ledger proofs)

export interface RetentionPolicy {
  id: string;
  name: string;
  dataCategories: string[];
  retentionPeriodYears: number;
  actionAfterExpiry: DeletionMethod;
  legalHoldOverride: boolean;
}

export const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    id: 'pii_retention',
    name: 'PII Retention',
    dataCategories: ['customer_pii', 'claim_pii'],
    retentionPeriodYears: 7,
    actionAfterExpiry: 'CRYPTOGRAPHIC_ERASURE',
    legalHoldOverride: true,
  },
  {
    id: 'claim_retention',
    name: 'Claim Data Retention',
    dataCategories: ['claim_data', 'claim_documents'],
    retentionPeriodYears: 10,
    actionAfterExpiry: 'ARCHIVE',
    legalHoldOverride: true,
  },
  {
    id: 'audit_retention',
    name: 'Audit Log Retention',
    dataCategories: ['audit_logs', 'security_events'],
    retentionPeriodYears: 7,
    actionAfterExpiry: 'ARCHIVE',
    legalHoldOverride: false,
  },
  {
    id: 'ledger_retention',
    name: 'Ledger Proof Retention',
    dataCategories: ['ledger_events', 'cryptographic_proofs'],
    retentionPeriodYears: -1, // Permanent
    actionAfterExpiry: 'IMMUTABLE',
    legalHoldOverride: false,
  },
  {
    id: 'session_cleanup',
    name: 'Session Cleanup',
    dataCategories: ['session_tokens', 'temp_data'],
    retentionPeriodYears: 0, // 24 hours
    actionAfterExpiry: 'HARD_DELETE',
    legalHoldOverride: false,
  },
];

// =============================================================================
// CRYPTOGRAPHIC ERASURE
// =============================================================================

export interface CryptographicErasureConfig {
  keyManagement: {
    keyPerField: boolean;
    keyRotationDays: number;
    keyVault: 'gcp-secret-manager' | 'hashicorp-vault' | 'aws-kms';
  };
  erasureProcess: {
    identityVerification: 'required' | 'optional';
    auditLogging: 'immutable';
    keyDestruction: 'cryptographic-shred';
    tombstoneMarker: boolean;
    completionSLADays: number;
  };
}

export const CRYPTOGRAPHIC_ERASURE_CONFIG: CryptographicErasureConfig = {
  keyManagement: {
    keyPerField: true,
    keyRotationDays: 90,
    keyVault: 'gcp-secret-manager',
  },
  erasureProcess: {
    identityVerification: 'required',
    auditLogging: 'immutable',
    keyDestruction: 'cryptographic-shred',
    tombstoneMarker: true,
    completionSLADays: 30,
  },
};

export interface ErasureRequest {
  requestId: string;
  dataSubjectId: string;
  requestType: 'GDPR_ART17' | 'CCPA_DELETE';
  requestedAt: string;
  verifiedAt?: string;
  completedAt?: string;
  status: 'PENDING' | 'VERIFIED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  fieldsToErase: string[];
  tombstoneId?: string;
}

export interface ErasureTombstone {
  tombstoneId: string;
  originalRecordId: string;
  erasedAt: string;
  reason: 'GDPR_ART17' | 'CCPA_DELETE' | 'RETENTION_EXPIRED' | 'MANUAL';
  erasureRequestId: string;
  preservedHashes: string[];
}

// =============================================================================
// DATA SUBJECT RIGHTS
// =============================================================================

export type DSRType = 
  | 'ACCESS'          // GDPR Art. 15 / CCPA 1798.100
  | 'RECTIFICATION'   // GDPR Art. 16
  | 'ERASURE'         // GDPR Art. 17 / CCPA 1798.105
  | 'PORTABILITY'     // GDPR Art. 20
  | 'RESTRICTION'     // GDPR Art. 18
  | 'OBJECTION';      // GDPR Art. 21

export interface DataSubjectRequest {
  id: string;
  dataSubjectId: string;
  dataSubjectEmail: string;
  requestType: DSRType;
  regulation: 'GDPR' | 'CCPA';
  submittedAt: string;
  acknowledgedAt?: string;
  completedAt?: string;
  status: DSRStatus;
  slaDays: number;
  response?: DSRResponse;
}

export type DSRStatus = 
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'VERIFYING_IDENTITY'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXTENDED';

export interface DSRResponse {
  responseType: 'FULFILLED' | 'PARTIALLY_FULFILLED' | 'REJECTED';
  data?: Record<string, unknown>;  // For access/portability
  reason?: string;                  // For rejection
  completedAt: string;
}

export const DSR_SLA_DAYS: Record<DSRType, { gdpr: number; ccpa: number }> = {
  ACCESS: { gdpr: 30, ccpa: 45 },
  RECTIFICATION: { gdpr: 30, ccpa: 45 },
  ERASURE: { gdpr: 30, ccpa: 45 },
  PORTABILITY: { gdpr: 30, ccpa: 45 },
  RESTRICTION: { gdpr: 3, ccpa: 45 },
  OBJECTION: { gdpr: 3, ccpa: 45 },
};

// =============================================================================
// SOC 2 CONTROLS
// =============================================================================

export type SOC2TrustServiceCriteria = 
  | 'CC6.1'   // Logical access controls
  | 'CC6.2'   // Access removal
  | 'CC6.3'   // Access authorization
  | 'CC6.6'   // Encryption
  | 'CC6.7'   // Transmission security
  | 'CC7.1'   // Vulnerability management
  | 'CC7.2'   // Monitoring
  | 'CC7.3'   // Incident response
  | 'CC7.4';  // Recovery

export interface SOC2Control {
  tsc: SOC2TrustServiceCriteria;
  name: string;
  description: string;
  ledgerImplementation: string;
  evidenceType: string;
  collectionFrequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
}

export const SOC2_CONTROLS: SOC2Control[] = [
  {
    tsc: 'CC6.1',
    name: 'Logical Access Controls',
    description: 'Access to system resources is restricted to authorized users',
    ledgerImplementation: 'RBAC + Zero-Trust authentication',
    evidenceType: 'Access control configuration, user access reviews',
    collectionFrequency: 'quarterly',
  },
  {
    tsc: 'CC6.6',
    name: 'Encryption',
    description: 'Data is encrypted at rest and in transit',
    ledgerImplementation: 'AES-256-GCM at rest, TLS 1.3 in transit',
    evidenceType: 'Encryption configuration, key rotation logs',
    collectionFrequency: 'continuous',
  },
  {
    tsc: 'CC6.7',
    name: 'Transmission Security',
    description: 'Data transmissions are secured',
    ledgerImplementation: 'mTLS for all internal traffic',
    evidenceType: 'Certificate inventory, mTLS configuration',
    collectionFrequency: 'monthly',
  },
  {
    tsc: 'CC7.2',
    name: 'Monitoring',
    description: 'System activity is monitored and logged',
    ledgerImplementation: 'Immutable audit logs, SIEM integration',
    evidenceType: 'Audit log samples, alert configurations',
    collectionFrequency: 'monthly',
  },
];

// =============================================================================
// CONSENT MANAGEMENT
// =============================================================================

export type ConsentPurpose = 
  | 'ESSENTIAL'           // Required for service
  | 'ANALYTICS'           // Usage analytics
  | 'MARKETING'           // Marketing communications
  | 'THIRD_PARTY_SHARING' // Partner data sharing
  | 'AI_PROCESSING';      // AI/ML model training

export interface ConsentRecord {
  id: string;
  dataSubjectId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  grantedAt?: string;
  withdrawnAt?: string;
  consentVersion: string;
  collectionMethod: 'explicit' | 'implicit' | 'opt_out';
  ipAddress: string;
  userAgent: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the retention policy for a data category
 */
export function getRetentionPolicy(dataCategory: string): RetentionPolicy | undefined {
  return RETENTION_POLICIES.find(p => p.dataCategories.includes(dataCategory));
}

/**
 * Calculate the DSR deadline based on regulation and type
 */
export function getDSRDeadline(requestType: DSRType, regulation: 'GDPR' | 'CCPA', submittedAt: Date): Date {
  const slaDays = DSR_SLA_DAYS[requestType][regulation.toLowerCase() as 'gdpr' | 'ccpa'];
  const deadline = new Date(submittedAt);
  deadline.setDate(deadline.getDate() + slaDays);
  return deadline;
}

/**
 * Check if a field requires cryptographic erasure on deletion
 */
export function requiresCryptographicErasure(piiCategory: PIICategory): boolean {
  return ['DIRECT_IDENTIFIER', 'SENSITIVE_PII', 'PHI'].includes(piiCategory);
}

/**
 * Check if data is subject to GDPR
 */
export function isGDPRApplicable(dataSubjectRegion: string): boolean {
  const euCountries = ['EU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PL', 'SE', 'FI', 'DK', 'IE', 'PT', 'GR', 'CZ', 'HU', 'RO', 'BG', 'SK', 'HR', 'SI', 'LT', 'LV', 'EE', 'CY', 'LU', 'MT'];
  return euCountries.includes(dataSubjectRegion.toUpperCase());
}

/**
 * Check if data is subject to CCPA
 */
export function isCCPAApplicable(dataSubjectRegion: string): boolean {
  return dataSubjectRegion.toUpperCase() === 'CA' || dataSubjectRegion.toUpperCase() === 'CALIFORNIA';
}
