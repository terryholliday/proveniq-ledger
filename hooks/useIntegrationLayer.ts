/**
 * useIntegrationLayer Hook
 * 
 * Connects Integration Layer services to React UI state.
 * Provides real-time updates via event bus subscription.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  EventBusService,
  IntegrationLayerService,
  CustodyService,
  IdempotencyService,
} from '../services/integration';
import type {
  EventBusMessage,
  LedgerEventAppendedPayload,
  CustodyState,
  LedgerEventSummary,
  AppendEventRequest,
  AppendEventResponse,
  LedgerError,
} from '../types/integration';

// =============================================================================
// TYPES
// =============================================================================

export interface IntegrationLayerState {
  // Connection status
  isConnected: boolean;
  
  // Event bus stats
  eventBusStats: {
    totalEventsProcessed: number;
    lastEventTimestamp: string | null;
    subscriptionCount: number;
  };
  
  // Chain stats
  chainStats: {
    chainLength: number;
    lastHash: string;
    integrityValid: boolean;
  };
  
  // Recent events
  recentEvents: LedgerEventSummary[];
  
  // Custody states (itemId -> state)
  custodyStates: Map<string, CustodyState>;
  
  // Idempotency stats
  idempotencyStats: {
    cacheSize: number;
  };
}

export interface IntegrationLayerActions {
  // Append a new event to the ledger
  appendEvent: (request: Omit<AppendEventRequest, 'idempotencyKey'>) => Promise<AppendEventResponse | LedgerError>;
  
  // Get custody state for an item
  getCustodyState: (itemId: string) => CustodyState | null;
  
  // Verify chain integrity
  verifyIntegrity: () => { valid: boolean; errors: string[] };
  
  // Refresh stats
  refreshStats: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useIntegrationLayer(): [IntegrationLayerState, IntegrationLayerActions] {
  const [state, setState] = useState<IntegrationLayerState>({
    isConnected: false,
    eventBusStats: {
      totalEventsProcessed: 0,
      lastEventTimestamp: null,
      subscriptionCount: 0,
    },
    chainStats: {
      chainLength: 0,
      lastHash: '0'.repeat(64),
      integrityValid: true,
    },
    recentEvents: [],
    custodyStates: new Map(),
    idempotencyStats: {
      cacheSize: 0,
    },
  });

  const eventCountRef = useRef(0);

  // Handle incoming ledger events
  const handleLedgerEvent = useCallback(async (event: EventBusMessage<LedgerEventAppendedPayload>) => {
    eventCountRef.current++;
    
    const newEvent: LedgerEventSummary = {
      eventId: event.payload.eventId,
      eventType: event.payload.eventType,
      timestamp: event.timestamp,
      hashChainPosition: event.payload.hashChainPosition,
      eventHash: event.payload.eventHash,
      itemId: event.itemId,
    };

    setState(prev => ({
      ...prev,
      eventBusStats: {
        ...prev.eventBusStats,
        totalEventsProcessed: eventCountRef.current,
        lastEventTimestamp: event.timestamp,
      },
      chainStats: {
        ...prev.chainStats,
        chainLength: event.payload.hashChainPosition,
        lastHash: event.payload.eventHash,
      },
      recentEvents: [newEvent, ...prev.recentEvents.slice(0, 49)], // Keep last 50
    }));
  }, []);

  // Initialize subscriptions
  useEffect(() => {
    // Subscribe to ledger.event.appended
    const unsubscribe = EventBusService.subscribe<LedgerEventAppendedPayload>(
      'ledger.event.appended',
      handleLedgerEvent,
      'UI_HOOK'
    );

    setState(prev => ({
      ...prev,
      isConnected: true,
      eventBusStats: {
        ...prev.eventBusStats,
        subscriptionCount: EventBusService.getSubscriptions().length,
      },
    }));

    return () => {
      unsubscribe();
      setState(prev => ({ ...prev, isConnected: false }));
    };
  }, [handleLedgerEvent]);

  // Actions
  const appendEvent = useCallback(async (
    request: Omit<AppendEventRequest, 'idempotencyKey'>
  ): Promise<AppendEventResponse | LedgerError> => {
    const idempotencyKey = IdempotencyService.generateIdempotencyKey(
      request.sourceApp,
      request.correlationId,
      request.eventType,
      request.itemId
    );

    const result = await IntegrationLayerService.appendEvent({
      ...request,
      idempotencyKey,
    });

    // Update idempotency stats
    setState(prev => ({
      ...prev,
      idempotencyStats: {
        cacheSize: IdempotencyService.getStoreSize(),
      },
    }));

    return result;
  }, []);

  const getCustodyState = useCallback((itemId: string): CustodyState | null => {
    const record = CustodyService.getCustodyState(itemId);
    return record?.currentState ?? null;
  }, []);

  const verifyIntegrity = useCallback(() => {
    const result = IntegrationLayerService.verifyChainIntegrity();
    setState(prev => ({
      ...prev,
      chainStats: {
        ...prev.chainStats,
        integrityValid: result.valid,
      },
    }));
    return result;
  }, []);

  const refreshStats = useCallback(() => {
    setState(prev => ({
      ...prev,
      eventBusStats: {
        ...prev.eventBusStats,
        subscriptionCount: EventBusService.getSubscriptions().length,
      },
      idempotencyStats: {
        cacheSize: IdempotencyService.getStoreSize(),
      },
    }));
  }, []);

  const actions: IntegrationLayerActions = {
    appendEvent,
    getCustodyState,
    verifyIntegrity,
    refreshStats,
  };

  return [state, actions];
}

export default useIntegrationLayer;
