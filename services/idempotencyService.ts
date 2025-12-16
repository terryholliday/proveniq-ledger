/**
 * Idempotency Service
 * 
 * Implements INTER_APP_CONTRACT Section 2: Non-Negotiable Principles
 * "All cross-app API calls and event handlers MUST be idempotent"
 * 
 * Ensures that repeated requests with the same idempotency key
 * return the same response without re-executing the operation.
 */

import { IdempotencyRecord } from '../types/integration';

// =============================================================================
// CONFIGURATION
// =============================================================================

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// IN-MEMORY STORE (Replace with Redis/Firestore in production)
// =============================================================================

const idempotencyStore: Map<string, IdempotencyRecord> = new Map();

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Check if an idempotency key has been used
 * Returns the cached response if found, null otherwise
 */
export function checkIdempotencyKey(key: string): IdempotencyRecord | null {
  const record = idempotencyStore.get(key);
  
  if (!record) {
    return null;
  }
  
  // Check if expired
  if (new Date(record.expiresAt) < new Date()) {
    idempotencyStore.delete(key);
    return null;
  }
  
  return record;
}

/**
 * Store an idempotency record after successful operation
 */
export function storeIdempotencyRecord<T>(
  key: string,
  response: T
): IdempotencyRecord {
  const now = new Date();
  const record: IdempotencyRecord = {
    key,
    responseHash: computeResponseHash(response),
    response,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS).toISOString(),
  };
  
  idempotencyStore.set(key, record);
  return record;
}

/**
 * Generate a composite idempotency key from request components
 */
export function generateIdempotencyKey(
  sourceApp: string,
  correlationId: string,
  eventType: string,
  itemId?: string
): string {
  const components = [sourceApp, correlationId, eventType];
  if (itemId) components.push(itemId);
  return components.join(':');
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  // Must be non-empty, max 256 chars, alphanumeric + hyphens/underscores/colons
  return /^[a-zA-Z0-9_\-:]{1,256}$/.test(key);
}

/**
 * Clean up expired idempotency records
 * Should be called periodically (e.g., every hour)
 */
export function cleanupExpiredRecords(): number {
  const now = new Date();
  let cleaned = 0;
  
  for (const [key, record] of idempotencyStore.entries()) {
    if (new Date(record.expiresAt) < now) {
      idempotencyStore.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * Get current store size (for monitoring)
 */
export function getStoreSize(): number {
  return idempotencyStore.size;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Compute a hash of the response for verification
 */
function computeResponseHash(response: unknown): string {
  const str = JSON.stringify(response);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// =============================================================================
// MIDDLEWARE HELPER
// =============================================================================

/**
 * Idempotent operation wrapper
 * Use this to wrap any operation that should be idempotent
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  operation: () => Promise<T>
): Promise<{ result: T; cached: boolean }> {
  // Check for existing record
  const existing = checkIdempotencyKey(idempotencyKey);
  if (existing) {
    return {
      result: existing.response as T,
      cached: true,
    };
  }
  
  // Execute operation
  const result = await operation();
  
  // Store for future requests
  storeIdempotencyRecord(idempotencyKey, result);
  
  return {
    result,
    cached: false,
  };
}

// =============================================================================
// EXPORT
// =============================================================================

export const IdempotencyService = {
  checkIdempotencyKey,
  storeIdempotencyRecord,
  generateIdempotencyKey,
  isValidIdempotencyKey,
  cleanupExpiredRecords,
  getStoreSize,
  withIdempotency,
};

export default IdempotencyService;
