/**
 * PROVENIQ LEDGER - CANONICAL EVENT SCHEMA (v1.0.0)
 * 
 * STATUS: LOCKED
 * AUTHORITY: Terry (Sovereign) / Proveniq Prime
 * 
 * Naming Convention: DOMAIN_NOUN_VERB_PAST
 */

import { z } from 'zod';

export const SCHEMA_VERSION = '1.0.0' as const;

// ============================================================================
// CANONICAL PRODUCERS
// ============================================================================

export const Producer = z.enum([
  'anchors-ingest',
  'service',
  'transit',
  'protect',
  'claimsiq',
  'capital',
  'bids',
  'ops',
  'properties',
  'home',
  'origins',
  'core',
]);

export type Producer = z.infer<typeof Producer>;

// ============================================================================
// CANONICAL EVENT ENVELOPE SCHEMA
// ============================================================================

export const SubjectSchema = z.object({
  asset_id: z.string().uuid(),
  anchor_id: z.string().max(64).optional(),
  shipment_id: z.string().uuid().optional(),
  policy_id: z.string().uuid().optional(),
  claim_id: z.string().uuid().optional(),
  auction_id: z.string().uuid().optional(),
  work_order_id: z.string().uuid().optional(),
  inspection_id: z.string().uuid().optional(),
  lease_id: z.string().uuid().optional(),
  loan_id: z.string().uuid().optional(),
});

export type Subject = z.infer<typeof SubjectSchema>;

export const SignaturesSchema = z.object({
  device_sig: z.string().optional(),
  provider_sig: z.string().optional(),
}).optional();

export type Signatures = z.infer<typeof SignaturesSchema>;

export const LedgerEventSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  event_type: z.string().regex(/^[A-Z]+(_[A-Z]+)+$/, {
    message: 'Event type must be DOMAIN_NOUN_VERB_PAST format',
  }),
  occurred_at: z.string().datetime(),
  committed_at: z.string().datetime(),
  correlation_id: z.string().uuid(),
  idempotency_key: z.string().min(1).max(256),
  producer: Producer,
  producer_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  subject: SubjectSchema,
  payload: z.record(z.unknown()),
  canonical_hash_hex: z.string().length(64),
  signatures: SignaturesSchema,
});

export type LedgerEvent = z.infer<typeof LedgerEventSchema>;

// ============================================================================
// EVENT TYPE REGISTRIES
// ============================================================================

export const ANCHOR_EVENTS = {
  ANCHOR_ASSET_BOUND: 'ANCHOR_ASSET_BOUND',
  ANCHOR_SEAL_BROKEN: 'ANCHOR_SEAL_BROKEN',
  ANCHOR_READING_RECORDED: 'ANCHOR_READING_RECORDED',
  ANCHOR_BATTERY_LOW: 'ANCHOR_BATTERY_LOW',
  ANCHOR_MOTION_DETECTED: 'ANCHOR_MOTION_DETECTED',
  ANCHOR_LOCATION_CHANGED: 'ANCHOR_LOCATION_CHANGED',
  ANCHOR_OFFLINE_DETECTED: 'ANCHOR_OFFLINE_DETECTED',
  ANCHOR_ONLINE_RESTORED: 'ANCHOR_ONLINE_RESTORED',
} as const;

export const SERVICE_EVENTS = {
  SERVICE_WORKORDER_CREATED: 'SERVICE_WORKORDER_CREATED',
  SERVICE_PROVIDER_ASSIGNED: 'SERVICE_PROVIDER_ASSIGNED',
  SERVICE_PROVIDER_ARRIVED: 'SERVICE_PROVIDER_ARRIVED',
  SERVICE_WORK_COMPLETED: 'SERVICE_WORK_COMPLETED',
  SERVICE_RECORD_CREATED: 'SERVICE_RECORD_CREATED',
  SERVICE_WORKORDER_CANCELLED: 'SERVICE_WORKORDER_CANCELLED',
  SERVICE_RATING_SUBMITTED: 'SERVICE_RATING_SUBMITTED',
} as const;

export const TRANSIT_EVENTS = {
  TRANSIT_SHIPMENT_CREATED: 'TRANSIT_SHIPMENT_CREATED',
  TRANSIT_PACKAGE_PICKEDUP: 'TRANSIT_PACKAGE_PICKEDUP',
  TRANSIT_LOCATION_UPDATED: 'TRANSIT_LOCATION_UPDATED',
  TRANSIT_SHIPMENT_DELIVERED: 'TRANSIT_SHIPMENT_DELIVERED',
  TRANSIT_EXCEPTION_REPORTED: 'TRANSIT_EXCEPTION_REPORTED',
  TRANSIT_RECEIPT_CONFIRMED: 'TRANSIT_RECEIPT_CONFIRMED',
} as const;

export const PROTECT_EVENTS = {
  PROTECT_POLICY_QUOTED: 'PROTECT_POLICY_QUOTED',
  PROTECT_POLICY_BOUND: 'PROTECT_POLICY_BOUND',
  PROTECT_PREMIUM_PAID: 'PROTECT_PREMIUM_PAID',
  PROTECT_POLICY_CANCELLED: 'PROTECT_POLICY_CANCELLED',
  PROTECT_POLICY_RENEWED: 'PROTECT_POLICY_RENEWED',
  PROTECT_COVERAGE_UPDATED: 'PROTECT_COVERAGE_UPDATED',
} as const;

export const CLAIMSIQ_EVENTS = {
  CLAIM_INTAKE_RECEIVED: 'CLAIM_INTAKE_RECEIVED',
  CLAIM_EVIDENCE_ATTACHED: 'CLAIM_EVIDENCE_ATTACHED',
  CLAIM_ANALYSIS_COMPLETED: 'CLAIM_ANALYSIS_COMPLETED',
  CLAIM_FRAUD_SCORED: 'CLAIM_FRAUD_SCORED',
  CLAIM_PAYOUT_APPROVED: 'CLAIM_PAYOUT_APPROVED',
  CLAIM_DENIAL_ISSUED: 'CLAIM_DENIAL_ISSUED',
  CLAIM_PAYOUT_DISBURSED: 'CLAIM_PAYOUT_DISBURSED',
  CLAIM_SALVAGE_INITIATED: 'CLAIM_SALVAGE_INITIATED',
} as const;

export const CAPITAL_EVENTS = {
  CAPITAL_LOAN_APPLIED: 'CAPITAL_LOAN_APPLIED',
  CAPITAL_LOAN_APPROVED: 'CAPITAL_LOAN_APPROVED',
  CAPITAL_LOAN_DISBURSED: 'CAPITAL_LOAN_DISBURSED',
  CAPITAL_PAYMENT_RECEIVED: 'CAPITAL_PAYMENT_RECEIVED',
  CAPITAL_LOAN_DEFAULTED: 'CAPITAL_LOAN_DEFAULTED',
  CAPITAL_COLLATERAL_SEIZED: 'CAPITAL_COLLATERAL_SEIZED',
  CAPITAL_LOAN_CLOSED: 'CAPITAL_LOAN_CLOSED',
} as const;

export const BIDS_EVENTS = {
  BIDS_AUCTION_LISTED: 'BIDS_AUCTION_LISTED',
  BIDS_BID_PLACED: 'BIDS_BID_PLACED',
  BIDS_RESERVE_MET: 'BIDS_RESERVE_MET',
  BIDS_AUCTION_ENDED: 'BIDS_AUCTION_ENDED',
  BIDS_AUCTION_SETTLED: 'BIDS_AUCTION_SETTLED',
  BIDS_AUCTION_CANCELLED: 'BIDS_AUCTION_CANCELLED',
} as const;

export const OPS_EVENTS = {
  OPS_SCAN_COMPLETED: 'OPS_SCAN_COMPLETED',
  OPS_SHRINKAGE_DETECTED: 'OPS_SHRINKAGE_DETECTED',
  OPS_ORDER_PLACED: 'OPS_ORDER_PLACED',
  OPS_DELIVERY_RECEIVED: 'OPS_DELIVERY_RECEIVED',
  OPS_PAR_ADJUSTED: 'OPS_PAR_ADJUSTED',
} as const;

export const PROPERTIES_EVENTS = {
  PROPERTIES_INSPECTION_CREATED: 'PROPERTIES_INSPECTION_CREATED',
  PROPERTIES_INSPECTION_SIGNED: 'PROPERTIES_INSPECTION_SIGNED',
  PROPERTIES_EVIDENCE_UPLOADED: 'PROPERTIES_EVIDENCE_UPLOADED',
  PROPERTIES_MAINTENANCE_CREATED: 'PROPERTIES_MAINTENANCE_CREATED',
  PROPERTIES_MAINTENANCE_DISPATCHED: 'PROPERTIES_MAINTENANCE_DISPATCHED',
  PROPERTIES_DEPOSIT_DISPUTED: 'PROPERTIES_DEPOSIT_DISPUTED',
  PROPERTIES_LEASE_SIGNED: 'PROPERTIES_LEASE_SIGNED',
} as const;

export const HOME_EVENTS = {
  HOME_ASSET_REGISTERED: 'HOME_ASSET_REGISTERED',
  HOME_ASSET_UPDATED: 'HOME_ASSET_UPDATED',
  HOME_PHOTO_ADDED: 'HOME_PHOTO_ADDED',
  HOME_DOCUMENT_ATTACHED: 'HOME_DOCUMENT_ATTACHED',
  HOME_VALUATION_UPDATED: 'HOME_VALUATION_UPDATED',
  HOME_CUSTODY_CHANGED: 'HOME_CUSTODY_CHANGED',
  HOME_CLAIM_INITIATED: 'HOME_CLAIM_INITIATED',
} as const;

export const CORE_EVENTS = {
  CORE_ASSET_REGISTERED: 'CORE_ASSET_REGISTERED',
  CORE_OWNERSHIP_TRANSFERRED: 'CORE_OWNERSHIP_TRANSFERRED',
  CORE_FRAUD_FLAGGED: 'CORE_FRAUD_FLAGGED',
  CORE_FRAUD_CLEARED: 'CORE_FRAUD_CLEARED',
  CORE_SCORE_UPDATED: 'CORE_SCORE_UPDATED',
} as const;

export const ALL_EVENT_TYPES = {
  ...ANCHOR_EVENTS,
  ...SERVICE_EVENTS,
  ...TRANSIT_EVENTS,
  ...PROTECT_EVENTS,
  ...CLAIMSIQ_EVENTS,
  ...CAPITAL_EVENTS,
  ...BIDS_EVENTS,
  ...OPS_EVENTS,
  ...PROPERTIES_EVENTS,
  ...HOME_EVENTS,
  ...CORE_EVENTS,
} as const;

export type EventType = typeof ALL_EVENT_TYPES[keyof typeof ALL_EVENT_TYPES];

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateLedgerEvent(event: unknown): LedgerEvent {
  return LedgerEventSchema.parse(event);
}

export function safeParseLedgerEvent(event: unknown) {
  return LedgerEventSchema.safeParse(event);
}

export function isKnownEventType(eventType: string): eventType is EventType {
  return Object.values(ALL_EVENT_TYPES).includes(eventType as EventType);
}

export function getEventDomain(eventType: string): string {
  return eventType.split('_')[0];
}
