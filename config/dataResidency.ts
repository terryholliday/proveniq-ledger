/**
 * Data Residency Configuration for Proveniq Ledger
 * 
 * Based on: lead_architect_data_residency_plan_v1
 * Phase: 1 - Governance & Zero-Trust Architecture
 */

// =============================================================================
// REGION DEFINITIONS
// =============================================================================

export type CloudRegion = 
  | 'us-east1'   // South Carolina - Primary US
  | 'us-west1'   // Oregon - DR/Failover
  | 'eu-west1'   // Belgium - Primary EU (GDPR)
  | 'asia-southeast1';  // Singapore - Future APAC

export type CustomerRegion = 'US' | 'EU' | 'APAC';

export interface RegionConfig {
  id: CloudRegion;
  displayName: string;
  customerRegion: CustomerRegion;
  isPrimary: boolean;
  gdprCompliant: boolean;
  hipaaCompliant: boolean;
  latencyTier: 'low' | 'medium' | 'high';
}

export const REGIONS: Record<CloudRegion, RegionConfig> = {
  'us-east1': {
    id: 'us-east1',
    displayName: 'US East (South Carolina)',
    customerRegion: 'US',
    isPrimary: true,
    gdprCompliant: false,  // Not for EU PII
    hipaaCompliant: true,
    latencyTier: 'low',
  },
  'us-west1': {
    id: 'us-west1',
    displayName: 'US West (Oregon)',
    customerRegion: 'US',
    isPrimary: false,
    gdprCompliant: false,
    hipaaCompliant: true,
    latencyTier: 'medium',
  },
  'eu-west1': {
    id: 'eu-west1',
    displayName: 'EU West (Belgium)',
    customerRegion: 'EU',
    isPrimary: true,
    gdprCompliant: true,
    hipaaCompliant: false,  // Different compliance regime
    latencyTier: 'low',
  },
  'asia-southeast1': {
    id: 'asia-southeast1',
    displayName: 'Asia Southeast (Singapore)',
    customerRegion: 'APAC',
    isPrimary: false,
    gdprCompliant: false,
    hipaaCompliant: false,
    latencyTier: 'high',  // For US/EU customers
  },
};

// =============================================================================
// DATA CLASSIFICATION
// =============================================================================

export type DataSensitivity = 'HIGH' | 'MEDIUM' | 'LOW';

export type DataCategory = 
  | 'customer_pii'
  | 'claim_data'
  | 'ledger_events'
  | 'analytics'
  | 'system_logs'
  | 'audit_logs';

export interface DataClassification {
  category: DataCategory;
  sensitivity: DataSensitivity;
  description: string;
  residencyRule: 'customer_region_only' | 'primary_plus_dr' | 'any_region';
  retentionDays: number;
  encryptionRequired: boolean;
}

export const DATA_CLASSIFICATIONS: Record<DataCategory, DataClassification> = {
  customer_pii: {
    category: 'customer_pii',
    sensitivity: 'HIGH',
    description: 'Names, emails, addresses, SSNs',
    residencyRule: 'customer_region_only',
    retentionDays: 2555,  // 7 years
    encryptionRequired: true,
  },
  claim_data: {
    category: 'claim_data',
    sensitivity: 'HIGH',
    description: 'Policy info, claim amounts, medical data',
    residencyRule: 'customer_region_only',
    retentionDays: 2555,
    encryptionRequired: true,
  },
  ledger_events: {
    category: 'ledger_events',
    sensitivity: 'MEDIUM',
    description: 'Hashes, timestamps, cryptographic proofs',
    residencyRule: 'primary_plus_dr',
    retentionDays: 3650,  // 10 years (immutable)
    encryptionRequired: true,
  },
  analytics: {
    category: 'analytics',
    sensitivity: 'LOW',
    description: 'Anonymized metrics, aggregated statistics',
    residencyRule: 'any_region',
    retentionDays: 365,
    encryptionRequired: false,
  },
  system_logs: {
    category: 'system_logs',
    sensitivity: 'LOW',
    description: 'Application logs, traces, performance metrics',
    residencyRule: 'primary_plus_dr',
    retentionDays: 90,
    encryptionRequired: false,
  },
  audit_logs: {
    category: 'audit_logs',
    sensitivity: 'MEDIUM',
    description: 'Security events, access logs, compliance evidence',
    residencyRule: 'primary_plus_dr',
    retentionDays: 2555,  // 7 years (immutable)
    encryptionRequired: true,
  },
};

// =============================================================================
// CUSTOMER DATA RESIDENCY CONFIG
// =============================================================================

export interface CustomerDataResidencyConfig {
  customerRegion: CustomerRegion;
  piiStorageRegion: CloudRegion;
  proofStorageRegions: CloudRegion[];
  crossBorderTransferAllowed: boolean;
  sccSigned: boolean;  // Standard Contractual Clauses
}

/**
 * Get the appropriate data residency config for a customer region
 */
export function getDataResidencyConfig(customerRegion: CustomerRegion): CustomerDataResidencyConfig {
  switch (customerRegion) {
    case 'EU':
      return {
        customerRegion: 'EU',
        piiStorageRegion: 'eu-west1',
        proofStorageRegions: ['eu-west1'],  // No US replication for GDPR
        crossBorderTransferAllowed: false,
        sccSigned: false,
      };
    case 'US':
      return {
        customerRegion: 'US',
        piiStorageRegion: 'us-east1',
        proofStorageRegions: ['us-east1', 'us-west1'],
        crossBorderTransferAllowed: false,
        sccSigned: false,
      };
    case 'APAC':
      return {
        customerRegion: 'APAC',
        piiStorageRegion: 'asia-southeast1',
        proofStorageRegions: ['asia-southeast1'],
        crossBorderTransferAllowed: true,  // May vary by country
        sccSigned: true,
      };
  }
}

// =============================================================================
// DISASTER RECOVERY
// =============================================================================

export type ServiceTier = 'tier1' | 'tier2' | 'tier3';

export interface DisasterRecoveryConfig {
  tier: ServiceTier;
  rpoMinutes: number;  // Recovery Point Objective (data loss tolerance)
  rtoMinutes: number;  // Recovery Time Objective (downtime tolerance)
  description: string;
  services: string[];
}

export const DR_TIERS: Record<ServiceTier, DisasterRecoveryConfig> = {
  tier1: {
    tier: 'tier1',
    rpoMinutes: 0,  // Synchronous replication
    rtoMinutes: 1,
    description: 'Critical - Ledger core services',
    services: ['ledger-api', 'verification-service', 'proof-storage'],
  },
  tier2: {
    tier: 'tier2',
    rpoMinutes: 5,
    rtoMinutes: 15,
    description: 'Important - User-facing services',
    services: ['auth-service', 'user-service', 'session-store'],
  },
  tier3: {
    tier: 'tier3',
    rpoMinutes: 60,
    rtoMinutes: 240,
    description: 'Standard - Analytics and reporting',
    services: ['analytics-service', 'report-generator', 'batch-jobs'],
  },
};

// =============================================================================
// ENVIRONMENT CONFIG
// =============================================================================

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  environment: Environment;
  primaryRegion: CloudRegion;
  drRegion: CloudRegion | null;
  multiRegionEnabled: boolean;
}

export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  development: {
    environment: 'development',
    primaryRegion: 'us-east1',
    drRegion: null,
    multiRegionEnabled: false,
  },
  staging: {
    environment: 'staging',
    primaryRegion: 'us-east1',
    drRegion: 'us-west1',
    multiRegionEnabled: false,
  },
  production: {
    environment: 'production',
    primaryRegion: 'us-east1',
    drRegion: 'us-west1',
    multiRegionEnabled: true,  // Enable in Phase 3
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if data can be stored in a given region based on classification
 */
export function canStoreInRegion(
  dataCategory: DataCategory,
  customerRegion: CustomerRegion,
  targetRegion: CloudRegion
): boolean {
  const classification = DATA_CLASSIFICATIONS[dataCategory];
  const residencyConfig = getDataResidencyConfig(customerRegion);

  switch (classification.residencyRule) {
    case 'customer_region_only':
      return targetRegion === residencyConfig.piiStorageRegion;
    case 'primary_plus_dr':
      return residencyConfig.proofStorageRegions.includes(targetRegion);
    case 'any_region':
      return true;
  }
}

/**
 * Get the primary storage region for a customer
 */
export function getPrimaryRegion(customerRegion: CustomerRegion): CloudRegion {
  const config = getDataResidencyConfig(customerRegion);
  return config.piiStorageRegion;
}

/**
 * Check if a region is GDPR compliant
 */
export function isGDPRCompliant(region: CloudRegion): boolean {
  return REGIONS[region].gdprCompliant;
}

/**
 * Get all regions where data can be replicated for a customer
 */
export function getAllowedReplicationRegions(customerRegion: CustomerRegion): CloudRegion[] {
  const config = getDataResidencyConfig(customerRegion);
  return config.proofStorageRegions;
}
