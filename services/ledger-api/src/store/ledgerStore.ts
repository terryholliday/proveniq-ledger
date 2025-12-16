/**
 * Ledger Store - In-memory storage for ledger events
 * 
 * In production, this would be backed by a persistent database.
 * For now, provides the data layer for the API server.
 */

import { v4 as uuidv4 } from 'uuid';

export interface LedgerEvent {
  eventId: string;
  itemId: string;
  walletId: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  previousHash: string;
  hash: string;
  timestamp: string;
  sequence: number;
  signature?: string;
}

export interface CustodyRecord {
  itemId: string;
  currentState: 'HOME' | 'IN_TRANSIT' | 'VAULT' | 'RETURNED' | 'SOLD';
  walletId: string;
  lastUpdated: string;
  transitionHistory: Array<{
    from: string;
    to: string;
    timestamp: string;
    eventId: string;
  }>;
}

// Valid custody state transitions per INTER_APP_CONTRACT
const VALID_TRANSITIONS: Record<string, string[]> = {
  HOME: ['IN_TRANSIT', 'VAULT', 'SOLD'],
  IN_TRANSIT: ['HOME', 'VAULT', 'RETURNED'],
  VAULT: ['IN_TRANSIT', 'HOME', 'SOLD'],
  RETURNED: ['HOME'],
  SOLD: [], // Terminal state
};

class LedgerStore {
  private events: Map<string, LedgerEvent> = new Map();
  private eventsByItem: Map<string, string[]> = new Map();
  private eventsByWallet: Map<string, string[]> = new Map();
  private custodyRecords: Map<string, CustodyRecord> = new Map();
  private idempotencyCache: Map<string, { eventId: string; timestamp: string }> = new Map();
  private lastHash: string = '0'.repeat(64);
  private sequence: number = 0;

  /**
   * Compute SHA-256 hash (simplified for demo - use crypto in production)
   */
  private computeHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Check if idempotency key exists
   */
  checkIdempotencyKey(key: string): { exists: boolean; eventId?: string } {
    const cached = this.idempotencyCache.get(key);
    if (cached) {
      return { exists: true, eventId: cached.eventId };
    }
    return { exists: false };
  }

  /**
   * Validate custody state transition
   */
  validateCustodyTransition(itemId: string, newState: string): { valid: boolean; currentState?: string; error?: string } {
    const record = this.custodyRecords.get(itemId);
    const currentState = record?.currentState || 'HOME';
    
    const validNextStates = VALID_TRANSITIONS[currentState] || [];
    if (!validNextStates.includes(newState)) {
      return {
        valid: false,
        currentState,
        error: `Invalid transition from ${currentState} to ${newState}. Valid transitions: ${validNextStates.join(', ') || 'none (terminal state)'}`,
      };
    }
    
    return { valid: true, currentState };
  }

  /**
   * Append event to ledger
   */
  appendEvent(params: {
    itemId: string;
    walletId: string;
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    custodyState?: string;
  }): { success: boolean; event?: LedgerEvent; error?: string; errorCode?: string } {
    // Check idempotency
    if (params.idempotencyKey) {
      const cached = this.checkIdempotencyKey(params.idempotencyKey);
      if (cached.exists) {
        const existingEvent = this.events.get(cached.eventId!);
        return { success: true, event: existingEvent };
      }
    }

    // Validate custody transition if custody state is being changed
    if (params.custodyState) {
      const validation = this.validateCustodyTransition(params.itemId, params.custodyState);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          errorCode: 'INVALID_CUSTODY_TRANSITION',
        };
      }
    }

    // Create event
    this.sequence++;
    const payloadHash = this.computeHash(JSON.stringify(params.payload));
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();

    const hashInput = [
      this.sequence.toString(),
      this.lastHash,
      params.eventType,
      payloadHash,
      timestamp,
      params.walletId,
    ].join('|');

    const hash = this.computeHash(hashInput);

    const event: LedgerEvent = {
      eventId,
      itemId: params.itemId,
      walletId: params.walletId,
      eventType: params.eventType,
      payload: params.payload,
      payloadHash,
      previousHash: this.lastHash,
      hash,
      timestamp,
      sequence: this.sequence,
    };

    // Store event
    this.events.set(eventId, event);
    this.lastHash = hash;

    // Index by item
    const itemEvents = this.eventsByItem.get(params.itemId) || [];
    itemEvents.push(eventId);
    this.eventsByItem.set(params.itemId, itemEvents);

    // Index by wallet
    const walletEvents = this.eventsByWallet.get(params.walletId) || [];
    walletEvents.push(eventId);
    this.eventsByWallet.set(params.walletId, walletEvents);

    // Store idempotency key
    if (params.idempotencyKey) {
      this.idempotencyCache.set(params.idempotencyKey, { eventId, timestamp });
    }

    // Update custody state if changed
    if (params.custodyState) {
      const record = this.custodyRecords.get(params.itemId);
      const previousState = record?.currentState || 'HOME';
      
      const newRecord: CustodyRecord = {
        itemId: params.itemId,
        currentState: params.custodyState as CustodyRecord['currentState'],
        walletId: params.walletId,
        lastUpdated: timestamp,
        transitionHistory: [
          ...(record?.transitionHistory || []),
          { from: previousState, to: params.custodyState, timestamp, eventId },
        ],
      };
      this.custodyRecords.set(params.itemId, newRecord);
    }

    return { success: true, event };
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): LedgerEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get events for item
   */
  getItemEvents(itemId: string): LedgerEvent[] {
    const eventIds = this.eventsByItem.get(itemId) || [];
    return eventIds.map(id => this.events.get(id)!).filter(Boolean);
  }

  /**
   * Get events for wallet
   */
  getWalletHistory(walletId: string): LedgerEvent[] {
    const eventIds = this.eventsByWallet.get(walletId) || [];
    return eventIds.map(id => this.events.get(id)!).filter(Boolean);
  }

  /**
   * Get custody state for item
   */
  getCustodyState(itemId: string): CustodyRecord | undefined {
    return this.custodyRecords.get(itemId);
  }

  /**
   * Get chain stats
   */
  getStats(): {
    totalEvents: number;
    totalItems: number;
    totalWallets: number;
    lastHash: string;
    sequence: number;
  } {
    return {
      totalEvents: this.events.size,
      totalItems: this.eventsByItem.size,
      totalWallets: this.eventsByWallet.size,
      lastHash: this.lastHash,
      sequence: this.sequence,
    };
  }

  /**
   * Verify chain integrity
   */
  verifyIntegrity(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allEvents = Array.from(this.events.values()).sort((a, b) => a.sequence - b.sequence);
    
    let expectedPrevHash = '0'.repeat(64);
    
    for (const event of allEvents) {
      if (event.previousHash !== expectedPrevHash) {
        errors.push(`Event ${event.eventId} has invalid previousHash. Expected ${expectedPrevHash}, got ${event.previousHash}`);
      }
      expectedPrevHash = event.hash;
    }

    return { valid: errors.length === 0, errors };
  }
}

// Singleton instance
export const ledgerStore = new LedgerStore();
