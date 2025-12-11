/**
 * Zero-Trust Security Types for Proveniq Ledger
 * 
 * Based on: cto_zero_trust_policy_v1
 * Phase: 1 - Governance & Zero-Trust Architecture
 */

// =============================================================================
// SERVICE IDENTITY
// =============================================================================

/**
 * SPIFFE ID format for service identities
 * Pattern: spiffe://proveniq.io/service/<service-name>/<environment>
 */
export type SPIFFEId = `spiffe://proveniq.io/service/${string}/${Environment}`;

export type Environment = 'development' | 'staging' | 'production';

export interface ServiceIdentity {
  spiffeId: SPIFFEId;
  serviceName: string;
  environment: Environment;
  certificateFingerprint: string;
  issuedAt: string;
  expiresAt: string;
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Required headers for all Ledger API requests (Zero-Trust compliant)
 */
export interface ZeroTrustAuthHeaders {
  /** Bearer JWT token */
  authorization: string;
  /** UUID for distributed tracing */
  'x-request-id': string;
  /** mTLS certificate fingerprint */
  'x-client-certificate-hash': string;
  /** SPIFFE ID for service-to-service calls */
  'x-service-identity'?: string;
  /** ISO 8601 timestamp */
  'x-timestamp': string;
  /** HMAC-SHA256 signature of request body */
  'x-signature': string;
}

export interface AuthenticationResult {
  tokenValid: boolean;
  tokenNotExpired: boolean;
  tokenIssuerTrusted: boolean;
  identity: UserIdentity | ServiceIdentity;
}

export interface UserIdentity {
  type: 'user';
  userId: string;
  email: string;
  role: UserRole;
  mfaVerified: boolean;
  sessionId: string;
}

// =============================================================================
// AUTHORIZATION (RBAC + ABAC)
// =============================================================================

export type UserRole = 'Administrator' | 'Auditor' | 'Viewer';

export type ResourceType = 'ledger' | 'audit' | 'compliance' | 'users';

export type Permission = 'read' | 'write' | 'delete' | 'admin' | 'export' | 'configure';

/**
 * Zero-Trust Role Permission Matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, Record<ResourceType, Permission[]>> = {
  Administrator: {
    ledger: ['read', 'write', 'delete', 'admin'],
    audit: ['read', 'write', 'export'],
    compliance: ['read', 'write', 'configure'],
    users: ['read', 'write', 'delete'],
  },
  Auditor: {
    ledger: ['read'],
    audit: ['read', 'write', 'export'],
    compliance: ['read'],
    users: ['read'],
  },
  Viewer: {
    ledger: ['read'],
    audit: ['read'],
    compliance: ['read'],
    users: [],
  },
};

export interface AuthorizationRequest {
  identity: UserIdentity | ServiceIdentity;
  resource: ResourceType;
  action: Permission;
  resourceId?: string;
  context?: Record<string, unknown>;
}

export interface AuthorizationResult {
  rolePermitted: boolean;
  resourceAccessGranted: boolean;
  actionAllowed: boolean;
  reason?: string;
}

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

export interface RequestValidation {
  // Identity verification
  tokenValid: boolean;
  tokenNotExpired: boolean;
  tokenIssuerTrusted: boolean;

  // Authorization check
  rolePermitted: boolean;
  resourceAccessGranted: boolean;
  actionAllowed: boolean;

  // Integrity verification
  signatureValid: boolean;
  timestampWithinWindow: boolean; // ±5 minutes
  replayAttackPrevented: boolean; // Nonce/request-id check
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

export type AuditEventType = 
  | 'authentication'
  | 'authorization'
  | 'access'
  | 'modification'
  | 'denial';

export type AuditActorType = 'user' | 'service' | 'system';

export type AuditResult = 'success' | 'failure' | 'denied';

export interface ZeroTrustAuditLog {
  timestamp: string; // ISO 8601
  eventType: AuditEventType;

  // Identity context
  actor: {
    type: AuditActorType;
    identity: string; // User ID or SPIFFE ID
    ipAddress: string;
    userAgent?: string;
  };

  // Action context
  action: string;
  resource: string;
  result: AuditResult;

  // Security metadata
  sessionId: string;
  requestId: string;
  mfaUsed: boolean;
  riskScore?: number;
}

// =============================================================================
// mTLS CONFIGURATION
// =============================================================================

export interface MTLSConfig {
  enabled: true;
  certificateAuthority: string;
  certificateRotationDays: number;
  minimumTlsVersion: '1.3';
  cipherSuites: string[];
}

export const DEFAULT_MTLS_CONFIG: MTLSConfig = {
  enabled: true,
  certificateAuthority: 'proveniq-internal-ca',
  certificateRotationDays: 90,
  minimumTlsVersion: '1.3',
  cipherSuites: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
  ],
};

// =============================================================================
// IDENTITY-AWARE PROXY (IAP)
// =============================================================================

export type IAPProvider = 'google-cloud-iap' | 'cloudflare-access' | 'custom';

export type AuthMethod = 'oauth2' | 'service_account' | 'api_key';

export type PolicyEngine = 'opa' | 'cedar';

export interface IAPConfig {
  enabled: true;
  provider: IAPProvider;
  authentication: {
    methods: AuthMethod[];
    mfaRequired: boolean;
    sessionDurationMinutes: number;
  };
  authorization: {
    rbacEnabled: boolean;
    abacEnabled: boolean;
    policyEngine: PolicyEngine;
  };
}

export const DEFAULT_IAP_CONFIG: IAPConfig = {
  enabled: true,
  provider: 'google-cloud-iap',
  authentication: {
    methods: ['oauth2', 'service_account', 'api_key'],
    mfaRequired: true,
    sessionDurationMinutes: 60,
  },
  authorization: {
    rbacEnabled: true,
    abacEnabled: true,
    policyEngine: 'opa',
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(
  role: UserRole,
  resource: ResourceType,
  action: Permission
): boolean {
  const permissions = ROLE_PERMISSIONS[role]?.[resource] ?? [];
  return permissions.includes(action);
}

/**
 * Generate a SPIFFE ID for a service
 */
export function generateSPIFFEId(
  serviceName: string,
  environment: Environment
): SPIFFEId {
  return `spiffe://proveniq.io/service/${serviceName}/${environment}`;
}

/**
 * Validate timestamp is within acceptable window (±5 minutes)
 */
export function isTimestampValid(timestamp: string, windowMinutes: number = 5): boolean {
  const requestTime = new Date(timestamp).getTime();
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  return Math.abs(now - requestTime) <= windowMs;
}
