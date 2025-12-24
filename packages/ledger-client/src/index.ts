/**
 * @proveniq/ledger-client
 * 
 * Canonical Ledger client for PROVENIQ ecosystem.
 * All apps should use this client to write events to the Ledger.
 */

import { createHash, randomUUID } from 'crypto';
import {
  SCHEMA_VERSION,
  type Producer,
  type Subject,
  type LedgerEvent,
  type EventType,
  LedgerEventSchema,
} from './events.js';

export * from './events.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface LedgerClientConfig {
  baseUrl: string;
  producer: Producer;
  producerVersion: string;
  apiKey?: string;
  timeout?: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface LedgerWriteResult {
  event_id: string;
  sequence_number: number;
  entry_hash: string;
  committed_at: string;
  schema_version: string;
}

export interface LedgerWriteError {
  error: string;
  message: string;
  details?: unknown;
  schema_version?: string;
}

// ============================================================================
// CLIENT IMPLEMENTATION
// ============================================================================

export class LedgerClient {
  private config: Required<LedgerClientConfig>;

  constructor(config: LedgerClientConfig) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:8006',
      producer: config.producer,
      producerVersion: config.producerVersion,
      apiKey: config.apiKey || '',
      timeout: config.timeout || 10000,
    };
  }

  /**
   * Write a canonical event to the Ledger.
   */
  async writeEvent(params: {
    eventType: EventType | string;
    subject: Subject;
    payload: Record<string, unknown>;
    correlationId?: string;
    idempotencyKey?: string;
    occurredAt?: string;
    signatures?: {
      device_sig?: string;
      provider_sig?: string;
    };
  }): Promise<LedgerWriteResult> {
    const correlationId = params.correlationId || randomUUID();
    const idempotencyKey = params.idempotencyKey || `${this.config.producer}_${randomUUID()}`;
    const occurredAt = params.occurredAt || new Date().toISOString();
    const canonicalHashHex = this.hashPayload(params.payload);

    const event: LedgerEvent = {
      schema_version: SCHEMA_VERSION,
      event_type: params.eventType,
      occurred_at: occurredAt,
      committed_at: occurredAt, // Will be overwritten by Ledger
      correlation_id: correlationId,
      idempotency_key: idempotencyKey,
      producer: this.config.producer,
      producer_version: this.config.producerVersion,
      subject: params.subject,
      payload: params.payload,
      canonical_hash_hex: canonicalHashHex,
      signatures: params.signatures,
    };

    // Validate locally before sending
    const parseResult = LedgerEventSchema.safeParse(event);
    if (!parseResult.success) {
      throw new Error(`Invalid event: ${JSON.stringify(parseResult.error.errors)}`);
    }

    const response = await fetch(`${this.config.baseUrl}/api/v1/events/canonical`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new LedgerError(
        errorBody.error || 'LEDGER_WRITE_FAILED',
        errorBody.message || `HTTP ${response.status}`,
        errorBody.details
      );
    }

    return response.json();
  }

  /**
   * Convenience method for Home events.
   */
  async writeHomeEvent(
    eventType: 'HOME_ASSET_REGISTERED' | 'HOME_ASSET_UPDATED' | 'HOME_PHOTO_ADDED' |
      'HOME_DOCUMENT_ATTACHED' | 'HOME_VALUATION_UPDATED' | 'HOME_CUSTODY_CHANGED' |
      'HOME_CLAIM_INITIATED',
    assetId: string,
    payload: Record<string, unknown>,
    options?: { correlationId?: string; idempotencyKey?: string }
  ): Promise<LedgerWriteResult> {
    return this.writeEvent({
      eventType,
      subject: { asset_id: assetId },
      payload,
      ...options,
    });
  }

  /**
   * Convenience method for Service events.
   */
  async writeServiceEvent(
    eventType: 'SERVICE_WORKORDER_CREATED' | 'SERVICE_PROVIDER_ASSIGNED' | 'SERVICE_PROVIDER_ARRIVED' |
      'SERVICE_WORK_COMPLETED' | 'SERVICE_RECORD_CREATED' | 'SERVICE_WORKORDER_CANCELLED' |
      'SERVICE_RATING_SUBMITTED',
    assetId: string,
    workOrderId: string,
    payload: Record<string, unknown>,
    options?: { correlationId?: string; idempotencyKey?: string }
  ): Promise<LedgerWriteResult> {
    return this.writeEvent({
      eventType,
      subject: { asset_id: assetId, work_order_id: workOrderId },
      payload,
      ...options,
    });
  }

  /**
   * Convenience method for Claims events.
   */
  async writeClaimEvent(
    eventType: 'CLAIM_INTAKE_RECEIVED' | 'CLAIM_EVIDENCE_ATTACHED' | 'CLAIM_ANALYSIS_COMPLETED' |
      'CLAIM_FRAUD_SCORED' | 'CLAIM_PAYOUT_APPROVED' | 'CLAIM_DENIAL_ISSUED' |
      'CLAIM_PAYOUT_DISBURSED' | 'CLAIM_SALVAGE_INITIATED',
    assetId: string,
    claimId: string,
    payload: Record<string, unknown>,
    options?: { correlationId?: string; idempotencyKey?: string }
  ): Promise<LedgerWriteResult> {
    return this.writeEvent({
      eventType,
      subject: { asset_id: assetId, claim_id: claimId },
      payload,
      ...options,
    });
  }

  /**
   * Convenience method for Capital events.
   */
  async writeCapitalEvent(
    eventType: 'CAPITAL_LOAN_APPLIED' | 'CAPITAL_LOAN_APPROVED' | 'CAPITAL_LOAN_DISBURSED' |
      'CAPITAL_PAYMENT_RECEIVED' | 'CAPITAL_LOAN_DEFAULTED' | 'CAPITAL_COLLATERAL_SEIZED' |
      'CAPITAL_LOAN_CLOSED',
    assetId: string,
    loanId: string,
    payload: Record<string, unknown>,
    options?: { correlationId?: string; idempotencyKey?: string }
  ): Promise<LedgerWriteResult> {
    return this.writeEvent({
      eventType,
      subject: { asset_id: assetId, loan_id: loanId },
      payload,
      ...options,
    });
  }

  /**
   * Convenience method for Ops events.
   */
  async writeOpsEvent(
    eventType: 'OPS_SCAN_COMPLETED' | 'OPS_SHRINKAGE_DETECTED' | 'OPS_ORDER_PLACED' |
      'OPS_DELIVERY_RECEIVED' | 'OPS_PAR_ADJUSTED',
    assetId: string,
    payload: Record<string, unknown>,
    options?: { correlationId?: string; idempotencyKey?: string }
  ): Promise<LedgerWriteResult> {
    return this.writeEvent({
      eventType,
      subject: { asset_id: assetId },
      payload,
      ...options,
    });
  }

  /**
   * Convenience method for Properties events.
   */
  async writePropertiesEvent(
    eventType: 'PROPERTIES_INSPECTION_CREATED' | 'PROPERTIES_INSPECTION_SIGNED' |
      'PROPERTIES_EVIDENCE_UPLOADED' | 'PROPERTIES_MAINTENANCE_CREATED' |
      'PROPERTIES_MAINTENANCE_DISPATCHED' | 'PROPERTIES_DEPOSIT_DISPUTED' |
      'PROPERTIES_LEASE_SIGNED',
    assetId: string,
    payload: Record<string, unknown>,
    subjectExtras?: { inspection_id?: string; lease_id?: string },
    options?: { correlationId?: string; idempotencyKey?: string }
  ): Promise<LedgerWriteResult> {
    return this.writeEvent({
      eventType,
      subject: { asset_id: assetId, ...subjectExtras },
      payload,
      ...options,
    });
  }

  /**
   * Query events for an asset.
   */
  async getAssetEvents(assetId: string, options?: { limit?: number; offset?: number }): Promise<{
    asset_id: string;
    events: LedgerEvent[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const response = await fetch(
      `${this.config.baseUrl}/api/v1/assets/${assetId}/events?${params}`,
      {
        headers: {
          ...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
        },
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!response.ok) {
      throw new LedgerError('QUERY_FAILED', `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Verify ledger integrity.
   */
  async verifyIntegrity(options?: { from?: number; to?: number }): Promise<{
    valid: boolean;
    entries_checked: number;
    errors: unknown[];
  }> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from.toString());
    if (options?.to) params.set('to', options.to.toString());

    const response = await fetch(
      `${this.config.baseUrl}/api/v1/integrity/verify?${params}`,
      {
        headers: {
          ...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
        },
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!response.ok) {
      throw new LedgerError('INTEGRITY_CHECK_FAILED', `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check Ledger health.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      return data.status === 'UP' || data.status === 'healthy';
    } catch {
      return false;
    }
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(json).digest('hex');
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class LedgerError extends Error {
  public code: string;
  public details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createLedgerClient(config: LedgerClientConfig): LedgerClient {
  return new LedgerClient(config);
}
