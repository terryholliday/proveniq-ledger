/**
 * Integration Layer Types for Proveniq Ledger
 * 
 * Implements INTER_APP_CONTRACT compliance
 * Version: 1.0
 */

// =============================================================================
// CUSTODY STATE MACHINE (Section 4 of Contract)
// =============================================================================

export type CustodyState = 
  | 'HOME'
  | 'IN_TRANSIT'
  | 'VAULT'
  | 'RETURNED'
  | 'SOLD';

/**
 * Valid custody transitions per INTER_APP_CONTRACT Section 4
 * Invalid transitions MUST be rejected by Ledger
 */
export const VALID_CUSTODY_TRANSITIONS: Record<CustodyState, CustodyState[]> = {
  HOME: ['IN_TRANSIT'],
  IN_TRANSIT: ['VAULT'],
  VAULT: ['SOLD', 'RETURNED'],
  RETURNED: ['HOME'],
  SOLD: ['HOME'], // Buyer receives item
};

export function isValidCustodyTransition(from: CustodyState, to: CustodyState): boolean {
  return VALID_CUSTODY_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// EVENT BUS TYPES (Section 3 of Contract)
// =============================================================================

export type EventBusTopic =
  | 'identity.created'
  | 'genome.generated'
  | 'genome.verified'
  | 'ledger.event.appended'
  | 'custody.changed'
  | 'loan.created'
  | 'loan.defaulted'
  | 'auction.listed'
  | 'auction.settled'
  | 'claim.created'
  | 'claim.settled'
  | 'score.updated'
  | 'fraud.flagged';

export type SourceApp = 'HOME' | 'BIDS' | 'CAPITAL' | 'CLAIMSIQ' | 'LEDGER' | 'CORE';

/**
 * Base event structure for all event bus messages
 */
export interface EventBusMessage<T = unknown> {
  eventId: string;
  eventType: EventBusTopic;
  timestamp: string;
  walletId: string;       // Pseudonymous - NO PII
  itemId?: string;
  payload: T;
  correlationId: string;
  version: '1.0';
  sourceApp: SourceApp;
}

/**
 * Custody changed event payload
 */
export interface CustodyChangedPayload {
  fromState: CustodyState;
  toState: CustodyState;
  carrier?: string;
  trackingNumber?: string;
}

/**
 * Ledger event appended - Published by LEDGER on every append
 */
export interface LedgerEventAppendedPayload {
  eventId: string;
  hashChainPosition: number;
  previousHash: string;
  eventHash: string;
  eventType: string;
}

// =============================================================================
// INTEGRATION LAYER API TYPES (Section 5.5 of Contract)
// =============================================================================

/**
 * POST /v1/ledger/events - Append event to hash chain
 */
export interface AppendEventRequest {
  eventType: string;
  walletId: string;
  itemId: string;
  payload: Record<string, unknown>;
  sourceApp: SourceApp;
  correlationId: string;
  idempotencyKey: string;  // Required for idempotency
}

export interface AppendEventResponse {
  eventId: string;
  hashChainPosition: number;
  previousHash: string;
  eventHash: string;
  timestamp: string;
}

/**
 * GET /v1/ledger/items/{itemId}/events - Get item event history
 */
export interface ItemEventsRequest {
  itemId: string;
  limit?: number;
  offset?: number;
}

export interface ItemEventsResponse {
  itemId: string;
  events: LedgerEventSummary[];
  pagination: PaginationInfo;
}

/**
 * GET /v1/ledger/events/{eventId} - Get specific event
 */
export interface GetEventRequest {
  eventId: string;
}

/**
 * GET /v1/ledger/wallets/{walletId}/history - Get wallet history
 */
export interface WalletHistoryRequest {
  walletId: string;
  limit?: number;
  offset?: number;
}

export interface WalletHistoryResponse {
  walletId: string;
  events: LedgerEventSummary[];
  pagination: PaginationInfo;
}

export interface LedgerEventSummary {
  eventId: string;
  eventType: string;
  timestamp: string;
  hashChainPosition: number;
  eventHash: string;
  itemId?: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// =============================================================================
// ERROR CODES (Section 8.2 of Contract)
// =============================================================================

export type LedgerErrorCode =
  | 'INVALID_CUSTODY_TRANSITION'
  | 'ITEM_NOT_FOUND'
  | 'INSUFFICIENT_PROVENANCE'
  | 'FRAUD_BLOCKED'
  | 'LEDGER_HASH_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_WALLET_ID'
  | 'UNAUTHORIZED';

export interface LedgerError {
  error: {
    code: LedgerErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  correlationId: string;
  timestamp: string;
}

/**
 * Create a standardized error response
 */
export function createLedgerError(
  code: LedgerErrorCode,
  message: string,
  correlationId: string,
  details?: Record<string, unknown>
): LedgerError {
  return {
    error: {
      code,
      message,
      details,
    },
    correlationId,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// AUTHENTICATION (Section 7 of Contract)
// =============================================================================

export interface ServiceAuthHeaders {
  authorization: string;        // Bearer <service_jwt>
  'x-service-name': SourceApp;
  'x-correlation-id': string;
}

export type LedgerScope = 
  | 'ledger:write'
  | 'ledger:read';

// =============================================================================
// IDEMPOTENCY (Section 2 - Non-Negotiable Principle)
// =============================================================================

export interface IdempotencyRecord {
  key: string;
  responseHash: string;
  response: unknown;
  createdAt: string;
  expiresAt: string;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate custody transition and return error if invalid
 */
export function validateCustodyTransition(
  from: CustodyState,
  to: CustodyState,
  correlationId: string
): LedgerError | null {
  if (!isValidCustodyTransition(from, to)) {
    return createLedgerError(
      'INVALID_CUSTODY_TRANSITION',
      `Cannot transition from ${from} to ${to} directly`,
      correlationId,
      {
        currentState: from,
        requestedState: to,
        validTransitions: VALID_CUSTODY_TRANSITIONS[from],
      }
    );
  }
  return null;
}

/**
 * Validate walletId format (pseudonymous identifier)
 */
export function isValidWalletId(walletId: string): boolean {
  // Format: wallet_[a-z0-9]{8,32}
  return /^wallet_[a-z0-9]{8,32}$/.test(walletId);
}

/**
 * Validate itemId format
 */
export function isValidItemId(itemId: string): boolean {
  // Format: item_[a-z0-9]{8,32}
  return /^item_[a-z0-9]{8,32}$/.test(itemId);
}
