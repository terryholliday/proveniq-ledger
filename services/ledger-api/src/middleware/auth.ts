/**
 * Authentication Middleware
 * 
 * Supports:
 * - API Key authentication (X-API-Key header)
 * - JWT Bearer token authentication
 * - Partner-specific permissions
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { createApiError } from './errorHandler.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedRequest extends Request {
  auth?: {
    type: 'api_key' | 'jwt';
    partnerId: string;
    partnerName: string;
    permissions: Permission[];
    tier: 'free' | 'partner' | 'enterprise';
  };
}

export type Permission = 
  | 'events:read'
  | 'events:write'
  | 'items:read'
  | 'claims:read'
  | 'claims:verify'
  | 'wallets:read'
  | 'admin:all';

export interface PartnerConfig {
  id: string;
  name: string;
  apiKey: string;
  permissions: Permission[];
  tier: 'free' | 'partner' | 'enterprise';
  rateLimit: number;
  active: boolean;
}

// =============================================================================
// PARTNER REGISTRY (In production, this would be in a database)
// =============================================================================

const PARTNER_REGISTRY: Map<string, PartnerConfig> = new Map([
  ['pk_home_proveniq', {
    id: 'home',
    name: 'Proveniq HOME',
    apiKey: 'pk_home_proveniq',
    permissions: ['events:read', 'events:write', 'items:read', 'wallets:read'],
    tier: 'enterprise',
    rateLimit: 10000,
    active: true,
  }],
  ['pk_bids_proveniq', {
    id: 'bids',
    name: 'Proveniq BIDS',
    apiKey: 'pk_bids_proveniq',
    permissions: ['events:read', 'events:write', 'items:read', 'wallets:read'],
    tier: 'enterprise',
    rateLimit: 10000,
    active: true,
  }],
  ['pk_capital_proveniq', {
    id: 'capital',
    name: 'Proveniq CAPITAL',
    apiKey: 'pk_capital_proveniq',
    permissions: ['events:read', 'events:write', 'items:read', 'wallets:read', 'claims:verify'],
    tier: 'enterprise',
    rateLimit: 10000,
    active: true,
  }],
  ['pk_demo_insurance', {
    id: 'demo_carrier',
    name: 'Demo Insurance Carrier',
    apiKey: 'pk_demo_insurance',
    permissions: ['events:read', 'items:read', 'claims:read', 'claims:verify'],
    tier: 'partner',
    rateLimit: 1000,
    active: true,
  }],
  ['pk_public_readonly', {
    id: 'public',
    name: 'Public Read-Only',
    apiKey: 'pk_public_readonly',
    permissions: ['events:read', 'items:read'],
    tier: 'free',
    rateLimit: 60,
    active: true,
  }],
]);

// JWT Secret (required - must be provided via environment variable)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required for ledger API authentication');
}

// =============================================================================
// JWT UTILITIES
// =============================================================================

interface JWTHeader {
  alg: string;
  typ: string;
}

interface JWTPayload {
  sub: string;        // Partner ID
  name: string;       // Partner name
  permissions: Permission[];
  tier: 'free' | 'partner' | 'enterprise';
  iat: number;        // Issued at
  exp: number;        // Expiration
}

/**
 * Base64url encode helper
 */
function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Base64url decode helper
 */
function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/**
 * Verify and decode JWT (HS256)
 */
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64)) as JWTHeader;
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;

    const expectedSignature = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const actualSignature = Buffer.from(signatureB64, 'base64url');

    if (actualSignature.length !== expectedSignature.length) {
      return null;
    }

    if (!timingSafeEqual(actualSignature, expectedSignature)) {
      return null;
    }

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate a JWT (HS256)
 */
export function generateJWT(partner: PartnerConfig, expiresInSeconds: number = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JWTPayload = {
    sub: partner.id,
    name: partner.name,
    permissions: partner.permissions,
    tier: partner.tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));

  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Main authentication middleware
 * Checks for API key or JWT token
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check for API key
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    const partner = PARTNER_REGISTRY.get(apiKey);
    if (partner && partner.active) {
      req.auth = {
        type: 'api_key',
        partnerId: partner.id,
        partnerName: partner.name,
        permissions: partner.permissions,
        tier: partner.tier,
      };
      return next();
    }
  }
  
  // Check for Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = decodeJWT(token);
    if (payload) {
      req.auth = {
        type: 'jwt',
        partnerId: payload.sub,
        partnerName: payload.name,
        permissions: payload.permissions,
        tier: payload.tier,
      };
      return next();
    }
  }
  
  // No valid auth found
  next(createApiError('UNAUTHORIZED', 'Missing or invalid authentication. Provide X-API-Key header or Bearer token.'));
}

/**
 * Optional authentication - sets auth if present but doesn't require it
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    const partner = PARTNER_REGISTRY.get(apiKey);
    if (partner && partner.active) {
      req.auth = {
        type: 'api_key',
        partnerId: partner.id,
        partnerName: partner.name,
        permissions: partner.permissions,
        tier: partner.tier,
      };
    }
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = decodeJWT(token);
    if (payload) {
      req.auth = {
        type: 'jwt',
        partnerId: payload.sub,
        partnerName: payload.name,
        permissions: payload.permissions,
        tier: payload.tier,
      };
    }
  }
  
  next();
}

/**
 * Require specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(createApiError('UNAUTHORIZED', 'Authentication required'));
    }
    
    if (!req.auth.permissions.includes(permission) && !req.auth.permissions.includes('admin:all')) {
      return next(createApiError('FORBIDDEN', `Missing required permission: ${permission}`));
    }
    
    next();
  };
}

/**
 * Rate limiting by partner tier
 */
const rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();

export function rateLimit(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const partnerId = req.auth?.partnerId || 'anonymous';
  const tier = req.auth?.tier || 'free';
  
  const limits: Record<string, number> = {
    free: 60,
    partner: 600,
    enterprise: 10000,
  };
  
  const limit = limits[tier];
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  
  let counter = rateLimitCounters.get(partnerId);
  if (!counter || counter.resetTime < now) {
    counter = { count: 0, resetTime: now + windowMs };
    rateLimitCounters.set(partnerId, counter);
  }
  
  counter.count++;
  
  if (counter.count > limit) {
    return next(createApiError('FORBIDDEN', `Rate limit exceeded. Limit: ${limit} requests per minute.`));
  }
  
  next();
}

// =============================================================================
// TOKEN ENDPOINT
// =============================================================================

/**
 * Generate token for a partner (admin use)
 */
export function generatePartnerToken(partnerId: string): string | null {
  for (const [_, partner] of PARTNER_REGISTRY) {
    if (partner.id === partnerId) {
      return generateJWT(partner);
    }
  }
  return null;
}

/**
 * Get partner by API key
 */
export function getPartnerByApiKey(apiKey: string): PartnerConfig | undefined {
  return PARTNER_REGISTRY.get(apiKey);
}

/**
 * Register a new partner (admin use)
 */
export function registerPartner(config: PartnerConfig): void {
  PARTNER_REGISTRY.set(config.apiKey, config);
}
