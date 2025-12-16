/**
 * Ledger API Client
 * 
 * Client for connecting to the Proveniq Ledger API server
 * Implements all endpoints from INTER_APP_CONTRACT.md Section 5.5
 */

const API_BASE = 'http://localhost:3002/v1/ledger';

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
}

export interface CustodyRecord {
  itemId: string;
  currentState: 'HOME' | 'IN_TRANSIT' | 'VAULT' | 'RETURNED' | 'SOLD';
  walletId: string | null;
  lastUpdated: string | null;
  transitionHistory: Array<{
    from: string;
    to: string;
    timestamp: string;
    eventId: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ChainHealth {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  chain: {
    totalEvents: number;
    totalItems: number;
    totalWallets: number;
    lastHash: string;
    sequence: number;
    integrityValid: boolean;
  };
}

/**
 * Append a new event to the ledger
 */
export async function appendEvent(params: {
  itemId: string;
  walletId: string;
  eventType: string;
  payload: Record<string, unknown>;
  custodyState?: string;
  idempotencyKey?: string;
}): Promise<ApiResponse<{ event: LedgerEvent; chainPosition: number; hash: string }>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (params.idempotencyKey) {
      headers['X-Idempotency-Key'] = params.idempotencyKey;
    }

    const response = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemId: params.itemId,
        walletId: params.walletId,
        eventType: params.eventType,
        payload: params.payload,
        custodyState: params.custodyState,
      }),
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * Get a specific event by ID
 */
export async function getEvent(eventId: string): Promise<ApiResponse<{ event: LedgerEvent }>> {
  try {
    const response = await fetch(`${API_BASE}/events/${eventId}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * Get all events for an item
 */
export async function getItemEvents(
  itemId: string,
  options?: { limit?: number; offset?: number }
): Promise<ApiResponse<{ itemId: string; events: LedgerEvent[]; total: number }>> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const url = `${API_BASE}/items/${itemId}/events${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * Get custody state for an item
 */
export async function getItemCustody(itemId: string): Promise<ApiResponse<{ custody: CustodyRecord }>> {
  try {
    const response = await fetch(`${API_BASE}/items/${itemId}/custody`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * Get wallet history
 */
export async function getWalletHistory(
  walletId: string,
  options?: { limit?: number; offset?: number; eventType?: string }
): Promise<ApiResponse<{ walletId: string; events: LedgerEvent[]; total: number }>> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.eventType) params.set('eventType', options.eventType);

    const url = `${API_BASE}/wallets/${walletId}/history${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * Get chain health and stats
 */
export async function getHealth(): Promise<ChainHealth | null> {
  try {
    const response = await fetch('http://localhost:3002/health');
    return await response.json();
  } catch (error) {
    console.error('Failed to get health:', error);
    return null;
  }
}

/**
 * Verify chain integrity
 */
export async function verifyIntegrity(): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> {
  try {
    const response = await fetch('http://localhost:3002/health/integrity');
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

export const LedgerApiClient = {
  appendEvent,
  getEvent,
  getItemEvents,
  getItemCustody,
  getWalletHistory,
  getHealth,
  verifyIntegrity,
};

export default LedgerApiClient;
