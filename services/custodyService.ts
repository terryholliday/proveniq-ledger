/**
 * Custody State Machine Service
 * 
 * Implements INTER_APP_CONTRACT Section 4: Custody State Machine
 * All apps MUST respect this state machine. No skipping states.
 * 
 * Valid transitions:
 * HOME -> IN_TRANSIT -> VAULT -> SOLD -> HOME (buyer receives)
 *                            -> RETURNED -> HOME
 */

import {
  CustodyState,
  VALID_CUSTODY_TRANSITIONS,
  isValidCustodyTransition,
  validateCustodyTransition,
  CustodyChangedPayload,
  EventBusMessage,
  LedgerError,
  createLedgerError,
} from '../types/integration';

// =============================================================================
// CUSTODY RECORD
// =============================================================================

export interface CustodyRecord {
  itemId: string;
  walletId: string;
  currentState: CustodyState;
  previousState: CustodyState | null;
  transitionHistory: CustodyTransition[];
  lastUpdated: string;
}

export interface CustodyTransition {
  from: CustodyState;
  to: CustodyState;
  timestamp: string;
  correlationId: string;
  carrier?: string;
  trackingNumber?: string;
}

// =============================================================================
// IN-MEMORY STORE (Replace with Firestore in production)
// =============================================================================

const custodyStore: Map<string, CustodyRecord> = new Map();

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get current custody state for an item
 */
export function getCustodyState(itemId: string): CustodyRecord | null {
  return custodyStore.get(itemId) ?? null;
}

/**
 * Initialize custody for a new item (starts at HOME)
 */
export function initializeCustody(
  itemId: string,
  walletId: string,
  correlationId: string
): CustodyRecord {
  const record: CustodyRecord = {
    itemId,
    walletId,
    currentState: 'HOME',
    previousState: null,
    transitionHistory: [],
    lastUpdated: new Date().toISOString(),
  };
  
  custodyStore.set(itemId, record);
  return record;
}

/**
 * Attempt to transition custody state
 * Returns error if transition is invalid per contract
 */
export function transitionCustody(
  itemId: string,
  toState: CustodyState,
  correlationId: string,
  metadata?: { carrier?: string; trackingNumber?: string }
): { success: true; record: CustodyRecord } | { success: false; error: LedgerError } {
  
  const existing = custodyStore.get(itemId);
  
  if (!existing) {
    return {
      success: false,
      error: createLedgerError(
        'ITEM_NOT_FOUND',
        `Item ${itemId} not found in custody registry`,
        correlationId,
        { itemId }
      ),
    };
  }
  
  const fromState = existing.currentState;
  
  // Validate transition against state machine
  const validationError = validateCustodyTransition(fromState, toState, correlationId);
  if (validationError) {
    return { success: false, error: validationError };
  }
  
  // Execute transition
  const transition: CustodyTransition = {
    from: fromState,
    to: toState,
    timestamp: new Date().toISOString(),
    correlationId,
    ...metadata,
  };
  
  const updatedRecord: CustodyRecord = {
    ...existing,
    currentState: toState,
    previousState: fromState,
    transitionHistory: [...existing.transitionHistory, transition],
    lastUpdated: transition.timestamp,
  };
  
  custodyStore.set(itemId, updatedRecord);
  
  return { success: true, record: updatedRecord };
}

/**
 * Validate a proposed custody event before appending to ledger
 * Called by Ledger when receiving custody.changed events
 */
export function validateCustodyEvent(
  event: EventBusMessage<CustodyChangedPayload>,
): LedgerError | null {
  const { itemId, payload, correlationId } = event;
  
  if (!itemId) {
    return createLedgerError(
      'ITEM_NOT_FOUND',
      'itemId is required for custody events',
      correlationId
    );
  }
  
  const existing = custodyStore.get(itemId);
  
  // For new items, only HOME is valid initial state
  if (!existing) {
    if (payload.fromState !== 'HOME' && payload.toState !== 'HOME') {
      return createLedgerError(
        'INVALID_CUSTODY_TRANSITION',
        'New items must start in HOME state',
        correlationId,
        { requestedState: payload.toState }
      );
    }
    return null;
  }
  
  // Validate current state matches
  if (existing.currentState !== payload.fromState) {
    return createLedgerError(
      'INVALID_CUSTODY_TRANSITION',
      `Current state mismatch. Expected ${existing.currentState}, got ${payload.fromState}`,
      correlationId,
      {
        currentState: existing.currentState,
        claimedState: payload.fromState,
      }
    );
  }
  
  // Validate transition
  return validateCustodyTransition(payload.fromState, payload.toState, correlationId);
}

/**
 * Get valid next states from current state
 */
export function getValidTransitions(currentState: CustodyState): CustodyState[] {
  return VALID_CUSTODY_TRANSITIONS[currentState] ?? [];
}

/**
 * Get full custody history for an item
 */
export function getCustodyHistory(itemId: string): CustodyTransition[] {
  return custodyStore.get(itemId)?.transitionHistory ?? [];
}

// =============================================================================
// EXPORT
// =============================================================================

export const CustodyService = {
  getCustodyState,
  initializeCustody,
  transitionCustody,
  validateCustodyEvent,
  getValidTransitions,
  getCustodyHistory,
  isValidCustodyTransition,
};

export default CustodyService;
