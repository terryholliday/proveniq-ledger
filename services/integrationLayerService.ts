/**
 * Integration Layer Service
 * 
 * Implements INTER_APP_CONTRACT Section 5.5: LEDGER Integration Layer
 * 
 * Endpoints:
 * - POST /v1/ledger/events - Append event to hash chain
 * - GET /v1/ledger/items/{itemId}/events - Get item event history
 * - GET /v1/ledger/events/{eventId} - Get specific event
 * - GET /v1/ledger/wallets/{walletId}/history - Get wallet history
 */

import {
  AppendEventRequest,
  AppendEventResponse,
  ItemEventsResponse,
  WalletHistoryResponse,
  LedgerEventSummary,
  LedgerError,
  createLedgerError,
  isValidWalletId,
  isValidItemId,
  CustodyChangedPayload,
  LedgerEventAppendedPayload,
  EventBusMessage,
} from '../types/integration';
import { CustodyService, validateCustodyEvent } from './custodyService';
import { IdempotencyService } from './idempotencyService';
import { EventBusService } from './eventBusService';

// =============================================================================
// INTERNAL STORAGE (Replace with Firestore in production)
// =============================================================================

interface StoredEvent {
  eventId: string;
  eventType: string;
  walletId: string;
  itemId?: string;
  payload: Record<string, unknown>;
  sourceApp: string;
  correlationId: string;
  hashChainPosition: number;
  previousHash: string;
  eventHash: string;
  timestamp: string;
}

const eventStore: Map<string, StoredEvent> = new Map();
const itemIndex: Map<string, string[]> = new Map(); // itemId -> eventIds
const walletIndex: Map<string, string[]> = new Map(); // walletId -> eventIds

let chainPosition = 0;
let lastHash = '0'.repeat(64); // Genesis hash

// =============================================================================
// HASH FUNCTION
// =============================================================================

function computeHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += ('00000000' + ((hash * (i + 1) * 31) >>> 0).toString(16)).slice(-8);
  }
  return result.slice(0, 64);
}

// =============================================================================
// API IMPLEMENTATIONS
// =============================================================================

/**
 * POST /v1/ledger/events - Append event to hash chain
 */
export async function appendEvent(
  request: AppendEventRequest
): Promise<AppendEventResponse | LedgerError> {
  const { eventType, walletId, itemId, payload, sourceApp, correlationId, idempotencyKey } = request;

  // Validate idempotency key
  if (!IdempotencyService.isValidIdempotencyKey(idempotencyKey)) {
    return createLedgerError(
      'IDEMPOTENCY_CONFLICT',
      'Invalid idempotency key format',
      correlationId
    );
  }

  // Check idempotency
  const existingRecord = IdempotencyService.checkIdempotencyKey(idempotencyKey);
  if (existingRecord) {
    return existingRecord.response as AppendEventResponse;
  }

  // Validate walletId format
  if (!isValidWalletId(walletId)) {
    return createLedgerError(
      'INVALID_WALLET_ID',
      'Invalid walletId format. Expected: wallet_[a-z0-9]{8,32}',
      correlationId,
      { walletId }
    );
  }

  // Validate itemId if provided
  if (itemId && !isValidItemId(itemId)) {
    return createLedgerError(
      'ITEM_NOT_FOUND',
      'Invalid itemId format. Expected: item_[a-z0-9]{8,32}',
      correlationId,
      { itemId }
    );
  }

  // Special validation for custody events
  if (eventType === 'custody.changed' && itemId) {
    const custodyPayload = payload as unknown as CustodyChangedPayload;
    const custodyEvent: EventBusMessage<CustodyChangedPayload> = {
      eventId: '',
      eventType: 'custody.changed',
      timestamp: new Date().toISOString(),
      walletId,
      itemId,
      payload: custodyPayload,
      correlationId,
      version: '1.0',
      sourceApp: sourceApp as any,
    };
    
    const validationError = validateCustodyEvent(custodyEvent);
    if (validationError) {
      return validationError;
    }
  }

  // Generate event
  const eventId = `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const previousHash = lastHash;
  chainPosition++;
  
  const hashInput = [
    chainPosition.toString(),
    previousHash,
    eventType,
    JSON.stringify(payload),
    walletId,
    itemId || '',
  ].join('|');
  
  const eventHash = computeHash(hashInput);
  lastHash = eventHash;

  const timestamp = new Date().toISOString();

  // Store event
  const storedEvent: StoredEvent = {
    eventId,
    eventType,
    walletId,
    itemId,
    payload,
    sourceApp,
    correlationId,
    hashChainPosition: chainPosition,
    previousHash,
    eventHash,
    timestamp,
  };

  eventStore.set(eventId, storedEvent);

  // Update indexes
  if (itemId) {
    const itemEvents = itemIndex.get(itemId) || [];
    itemEvents.push(eventId);
    itemIndex.set(itemId, itemEvents);
  }

  const walletEvents = walletIndex.get(walletId) || [];
  walletEvents.push(eventId);
  walletIndex.set(walletId, walletEvents);

  // Update custody state if custody event
  if (eventType === 'custody.changed' && itemId) {
    const custodyPayload = payload as unknown as CustodyChangedPayload;
    CustodyService.transitionCustody(
      itemId,
      custodyPayload.toState,
      correlationId,
      { carrier: custodyPayload.carrier, trackingNumber: custodyPayload.trackingNumber }
    );
  }

  // Build response
  const response: AppendEventResponse = {
    eventId,
    hashChainPosition: chainPosition,
    previousHash,
    eventHash,
    timestamp,
  };

  // Store for idempotency
  IdempotencyService.storeIdempotencyRecord(idempotencyKey, response);

  // Publish ledger.event.appended to event bus
  const appendedPayload: LedgerEventAppendedPayload = {
    eventId,
    hashChainPosition: chainPosition,
    previousHash,
    eventHash,
    eventType,
  };
  
  await EventBusService.publish('ledger.event.appended', {
    eventId: `bus_${eventId}`,
    eventType: 'ledger.event.appended',
    timestamp,
    walletId,
    itemId,
    payload: appendedPayload,
    correlationId,
    version: '1.0',
    sourceApp: 'LEDGER',
  });

  return response;
}

/**
 * GET /v1/ledger/items/{itemId}/events - Get item event history
 */
export function getItemEvents(
  itemId: string,
  limit = 50,
  offset = 0
): ItemEventsResponse | LedgerError {
  if (!isValidItemId(itemId)) {
    return createLedgerError(
      'ITEM_NOT_FOUND',
      'Invalid itemId format',
      'system',
      { itemId }
    );
  }

  const eventIds = itemIndex.get(itemId) || [];
  const total = eventIds.length;
  const paginatedIds = eventIds.slice(offset, offset + limit);

  const events: LedgerEventSummary[] = paginatedIds
    .map(id => eventStore.get(id))
    .filter((e): e is StoredEvent => e !== undefined)
    .map(e => ({
      eventId: e.eventId,
      eventType: e.eventType,
      timestamp: e.timestamp,
      hashChainPosition: e.hashChainPosition,
      eventHash: e.eventHash,
      itemId: e.itemId,
    }));

  return {
    itemId,
    events,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}

/**
 * GET /v1/ledger/events/{eventId} - Get specific event
 */
export function getEvent(eventId: string): StoredEvent | LedgerError {
  const event = eventStore.get(eventId);
  
  if (!event) {
    return createLedgerError(
      'ITEM_NOT_FOUND',
      `Event ${eventId} not found`,
      'system',
      { eventId }
    );
  }

  return event;
}

/**
 * GET /v1/ledger/wallets/{walletId}/history - Get wallet history
 */
export function getWalletHistory(
  walletId: string,
  limit = 50,
  offset = 0
): WalletHistoryResponse | LedgerError {
  if (!isValidWalletId(walletId)) {
    return createLedgerError(
      'INVALID_WALLET_ID',
      'Invalid walletId format',
      'system',
      { walletId }
    );
  }

  const eventIds = walletIndex.get(walletId) || [];
  const total = eventIds.length;
  const paginatedIds = eventIds.slice(offset, offset + limit);

  const events: LedgerEventSummary[] = paginatedIds
    .map(id => eventStore.get(id))
    .filter((e): e is StoredEvent => e !== undefined)
    .map(e => ({
      eventId: e.eventId,
      eventType: e.eventType,
      timestamp: e.timestamp,
      hashChainPosition: e.hashChainPosition,
      eventHash: e.eventHash,
      itemId: e.itemId,
    }));

  return {
    walletId,
    events,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}

/**
 * Verify hash chain integrity
 */
export function verifyChainIntegrity(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allEvents = Array.from(eventStore.values())
    .sort((a, b) => a.hashChainPosition - b.hashChainPosition);

  let expectedPrevHash = '0'.repeat(64);

  for (const event of allEvents) {
    if (event.previousHash !== expectedPrevHash) {
      errors.push(`Chain break at position ${event.hashChainPosition}: expected prev hash ${expectedPrevHash}, got ${event.previousHash}`);
    }
    expectedPrevHash = event.eventHash;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// EXPORT
// =============================================================================

export const IntegrationLayerService = {
  appendEvent,
  getItemEvents,
  getEvent,
  getWalletHistory,
  verifyChainIntegrity,
};

export default IntegrationLayerService;
