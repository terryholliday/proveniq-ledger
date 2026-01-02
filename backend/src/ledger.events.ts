/**
 * PROVENIQ LEDGER - CANONICAL EVENT SCHEMA (v1.0.0)
 * 
 * STATUS: LOCKED
 * AUTHORITY: Terry (Sovereign) / Proveniq Prime
 * LAST UPDATED: December 23, 2024
 * 
 * ============================================================================
 * CORE PRINCIPLES
 * ============================================================================
 * 
 * 1. Events are FACTS - Immutable records of what HAPPENED, not commands
 * 2. PAST TENSE ONLY - "SERVICE_RECORD_CREATED", never "CREATE_SERVICE_RECORD"
 * 3. NO AMBIGUITY - One name = One schema. Same event name always means same structure
 * 4. VERSIONED - Every event carries schema version, producer, and producer version
 * 
 * ============================================================================
 * NAMING CONVENTION: DOMAIN_NOUN_VERB_PAST
 * ============================================================================
 * 
 * Examples:
 *   - ANCHOR_SEAL_BROKEN
 *   - SERVICE_RECORD_CREATED
 *   - TRANSIT_SHIPMENT_DELIVERED
 *   - CLAIM_PAYOUT_APPROVED
 *   - BIDS_AUCTION_SETTLED
 */

import { z } from 'zod';

// ============================================================================
// SCHEMA VERSION (LOCKED)
// ============================================================================

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

// ============================================================================
// CANONICAL EVENT ENVELOPE SCHEMA
// ============================================================================

export const CustodyState = z.enum([
  'CREATED',
  'OFFERED',
  'IN_TRANSIT',
  'DELIVERED',
  'DISPUTED',
  'CLOSED'
]);

export type CustodyState = z.infer<typeof CustodyState>;

export const SubjectSchema = z.object({
  asset_id: z.string().uuid(),                    // Required - PROVENIQ Asset ID (PAID)
  anchor_id: z.string().max(64).optional(),       // Hardware anchor ID
  shipment_id: z.string().uuid().optional(),      // Transit shipment
  policy_id: z.string().uuid().optional(),        // Protect policy
  claim_id: z.string().uuid().optional(),         // ClaimsIQ claim
  auction_id: z.string().uuid().optional(),       // Bids auction
  work_order_id: z.string().uuid().optional(),    // Service work order
  inspection_id: z.string().uuid().optional(),    // Properties inspection
  lease_id: z.string().uuid().optional(),         // Properties lease
  loan_id: z.string().uuid().optional(),          // Capital loan
  seal_id: z.string().max(64).optional(),         // Anchor Seal ID
  envelope_id: z.string().uuid().optional(),      // FCE envelope ID (Canon v1.1)
  account_id: z.string().uuid().optional(),       // User account ID (for account-level events)
});

export type Subject = z.infer<typeof SubjectSchema>;

export const SignaturesSchema = z.object({
  device_sig: z.string().optional(),              // Ed25519 Hex from Anchor device
  provider_sig: z.string().optional(),            // Ed25519 Hex from service provider
}).optional();

export type Signatures = z.infer<typeof SignaturesSchema>;

/**
 * CANONICAL LEDGER EVENT ENVELOPE
 * 
 * Every event written to the Ledger MUST validate against this shape.
 */
export const LedgerEventSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  event_type: z.string().regex(/^[A-Z]+(_[A-Z]+)+$/, {
    message: 'Event type must be DOMAIN_NOUN_VERB_PAST format (e.g., ANCHOR_SEAL_BROKEN)',
  }),
  occurred_at: z.string().datetime(),             // ISO 8601 - When it happened in the real world
  committed_at: z.string().datetime(),            // ISO 8601 - When Ledger accepted it (set by Ledger)
  correlation_id: z.string().uuid(),
  idempotency_key: z.string().min(1).max(256),
  producer: Producer,
  producer_version: z.string().regex(/^\d+\.\d+\.\d+$/, {
    message: 'Producer version must be semver (e.g., 1.0.0)',
  }),
  subject: SubjectSchema,
  payload: z.record(z.unknown()),                 // The specific event data
  canonical_hash_hex: z.string().length(64),      // SHA-256 of payload (lowercase hex)
  signatures: SignaturesSchema,
});

export type LedgerEvent = z.infer<typeof LedgerEventSchema>;

/**
 * LEDGER WRITE INPUT SCHEMA
 * 
 * What producers send to the API. 
 * - Omitted: committed_at (Server authoritative)
 */
export const LedgerInputSchema = LedgerEventSchema.omit({
  committed_at: true
});

export type LedgerInput = z.infer<typeof LedgerInputSchema>;

// ============================================================================
// EVENT TYPE REGISTRY - ANCHORS DOMAIN
// ============================================================================

export const ANCHOR_EVENTS = {
  /** Anchor device bound to asset for the first time */
  ANCHOR_REGISTERED: 'ANCHOR_REGISTERED',

  /** Anchor tamper seal was armed */
  ANCHOR_SEAL_ARMED: 'ANCHOR_SEAL_ARMED',

  /** Anchor tamper seal was broken (physical security compromised) */
  ANCHOR_SEAL_BROKEN: 'ANCHOR_SEAL_BROKEN',

  /** Anchor reported environmental reading (temp, humidity, shock) */
  ANCHOR_ENVIRONMENTAL_ALERT: 'ANCHOR_ENVIRONMENTAL_ALERT',

  /** Anchor participated in a custody handoff */
  ANCHOR_CUSTODY_SIGNAL: 'ANCHOR_CUSTODY_SIGNAL',

  // DEPRECATED / REMOVED by v4.2 Remediation Protocol
  // ANCHOR_ASSET_BOUND: 'ANCHOR_ASSET_BOUND',
  // ANCHOR_BATTERY_LOW: 'ANCHOR_BATTERY_LOW',
  // ANCHOR_MOTION_DETECTED: 'ANCHOR_MOTION_DETECTED',
  // ANCHOR_LOCATION_CHANGED: 'ANCHOR_LOCATION_CHANGED',
  // ANCHOR_OFFLINE_DETECTED: 'ANCHOR_OFFLINE_DETECTED',
  // ANCHOR_ONLINE_RESTORED: 'ANCHOR_ONLINE_RESTORED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - SERVICE DOMAIN
// ============================================================================

export const SERVICE_EVENTS = {
  /** Work order created for maintenance/repair */
  SERVICE_WORKORDER_CREATED: 'SERVICE_WORKORDER_CREATED',
  /** Provider assigned to work order */
  SERVICE_PROVIDER_ASSIGNED: 'SERVICE_PROVIDER_ASSIGNED',
  /** Provider arrived on site */
  SERVICE_PROVIDER_ARRIVED: 'SERVICE_PROVIDER_ARRIVED',
  /** Work completed by provider */
  SERVICE_WORK_COMPLETED: 'SERVICE_WORK_COMPLETED',
  /** Service record created with evidence */
  SERVICE_RECORD_CREATED: 'SERVICE_RECORD_CREATED',
  /** Work order cancelled */
  SERVICE_WORKORDER_CANCELLED: 'SERVICE_WORKORDER_CANCELLED',
  /** Provider rating submitted */
  SERVICE_RATING_SUBMITTED: 'SERVICE_RATING_SUBMITTED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - TRANSIT DOMAIN
// ============================================================================

export const TRANSIT_EVENTS = {
  /** Shipment created */
  TRANSIT_SHIPMENT_CREATED: 'TRANSIT_SHIPMENT_CREATED',

  /** Handoff challenge created (Seller/Driver initiates) */
  TRANSIT_HANDOFF_CHALLENGE_CREATED: 'TRANSIT_HANDOFF_CHALLENGE_CREATED',

  /** Handoff accepted (Buyer/driver signs) */
  TRANSIT_HANDOFF_ACCEPTED: 'TRANSIT_HANDOFF_ACCEPTED',

  /** State changed (e.g. IN_TRANSIT, DELIVERED) */
  TRANSIT_STATE_CHANGED: 'TRANSIT_STATE_CHANGED',

  /** Dispute opened (e.g. seal broken during transit) */
  TRANSIT_DISPUTE_OPENED: 'TRANSIT_DISPUTE_OPENED',

  /** Dispute resolved */
  TRANSIT_DISPUTE_RESOLVED: 'TRANSIT_DISPUTE_RESOLVED',

  // REMOVED by v4.2
  // TRANSIT_PACKAGE_PICKEDUP: 'TRANSIT_PACKAGE_PICKEDUP',
  // TRANSIT_LOCATION_UPDATED: 'TRANSIT_LOCATION_UPDATED',
  // TRANSIT_SHIPMENT_DELIVERED: 'TRANSIT_SHIPMENT_DELIVERED',
  // TRANSIT_EXCEPTION_REPORTED: 'TRANSIT_EXCEPTION_REPORTED',
  // TRANSIT_RECEIPT_CONFIRMED: 'TRANSIT_RECEIPT_CONFIRMED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - PROTECT DOMAIN
// ============================================================================

export const PROTECT_EVENTS = {
  /** Insurance policy quoted */
  PROTECT_POLICY_QUOTED: 'PROTECT_POLICY_QUOTED',
  /** Insurance policy bound (active) */
  PROTECT_POLICY_BOUND: 'PROTECT_POLICY_BOUND',
  /** Policy premium paid */
  PROTECT_PREMIUM_PAID: 'PROTECT_PREMIUM_PAID',
  /** Policy cancelled */
  PROTECT_POLICY_CANCELLED: 'PROTECT_POLICY_CANCELLED',
  /** Policy renewed */
  PROTECT_POLICY_RENEWED: 'PROTECT_POLICY_RENEWED',
  /** Coverage updated */
  PROTECT_COVERAGE_UPDATED: 'PROTECT_COVERAGE_UPDATED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - CLAIMSIQ DOMAIN
// ============================================================================

export const CLAIMSIQ_EVENTS = {
  /** Claim submitted */
  CLAIM_INTAKE_RECEIVED: 'CLAIM_INTAKE_RECEIVED',
  /** Evidence attached to claim */
  CLAIM_EVIDENCE_ATTACHED: 'CLAIM_EVIDENCE_ATTACHED',
  /** AI analysis completed */
  CLAIM_ANALYSIS_COMPLETED: 'CLAIM_ANALYSIS_COMPLETED',
  /** Fraud score calculated */
  CLAIM_FRAUD_SCORED: 'CLAIM_FRAUD_SCORED',

  /** Claim Decision Recorded (PAY | DENY | REVIEW) */
  CLAIM_DECISION_RECORDED: 'CLAIM_DECISION_RECORDED',

  /** Claim approved for payout (Explicit authorization) */
  CLAIM_PAYOUT_AUTHORIZED: 'CLAIM_PAYOUT_AUTHORIZED',

  /** Claim denied */
  CLAIM_DENIAL_ISSUED: 'CLAIM_DENIAL_ISSUED',

  /** Claim payout disbursed (Recorded by ClaimsIQ if it tracks it, usually Capital) */
  CLAIM_PAYOUT_DISBURSED: 'CLAIM_PAYOUT_DISBURSED',

  /** Salvage initiated */
  CLAIM_SALVAGE_INITIATED: 'CLAIM_SALVAGE_INITIATED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - CAPITAL DOMAIN
// ============================================================================

export const CAPITAL_EVENTS = {
  /** Loan application submitted */
  CAPITAL_LOAN_APPLIED: 'CAPITAL_LOAN_APPLIED',
  /** Loan approved */
  CAPITAL_LOAN_APPROVED: 'CAPITAL_LOAN_APPROVED',
  /** Loan funds disbursed */
  CAPITAL_LOAN_DISBURSED: 'CAPITAL_LOAN_DISBURSED',
  /** Loan payment received */
  CAPITAL_PAYMENT_RECEIVED: 'CAPITAL_PAYMENT_RECEIVED',
  /** Loan entered default */
  CAPITAL_LOAN_DEFAULTED: 'CAPITAL_LOAN_DEFAULTED',
  /** Collateral seized for default */
  CAPITAL_COLLATERAL_SEIZED: 'CAPITAL_COLLATERAL_SEIZED',
  /** Loan paid in full */
  CAPITAL_LOAN_CLOSED: 'CAPITAL_LOAN_CLOSED',

  /** Payout Executed via Stripe/Bank */
  CAPITAL_PAYOUT_EXECUTED: 'CAPITAL_PAYOUT_EXECUTED',

  /** Payout Failed */
  CAPITAL_PAYOUT_FAILED: 'CAPITAL_PAYOUT_FAILED',

  /** Remittance Received (e.g. from Bids) */
  CAPITAL_REMITTANCE_RECEIVED: 'CAPITAL_REMITTANCE_RECEIVED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - BIDS DOMAIN
// ============================================================================

export const BIDS_EVENTS = {
  /** Auction listing created */
  BIDS_AUCTION_LISTED: 'BIDS_AUCTION_LISTED',
  /** Bid placed on auction */
  BIDS_BID_PLACED: 'BIDS_BID_PLACED',
  /** Reserve price met */
  BIDS_RESERVE_MET: 'BIDS_RESERVE_MET',
  /** Auction ended (sold or unsold) */
  BIDS_AUCTION_ENDED: 'BIDS_AUCTION_ENDED',
  /** Auction settled (payment + delivery confirmed) */
  BIDS_AUCTION_SETTLED: 'BIDS_AUCTION_SETTLED',
  /** Auction cancelled */
  BIDS_AUCTION_CANCELLED: 'BIDS_AUCTION_CANCELLED',

  /** Sale Settled (Funds received) */
  BIDS_SALE_SETTLED: 'BIDS_SALE_SETTLED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - OPS DOMAIN
// ============================================================================

export const OPS_EVENTS = {
  /** Inventory scan completed */
  OPS_SCAN_COMPLETED: 'OPS_SCAN_COMPLETED',
  /** Shrinkage detected */
  OPS_SHRINKAGE_DETECTED: 'OPS_SHRINKAGE_DETECTED',
  /** Vendor order placed */
  OPS_ORDER_PLACED: 'OPS_ORDER_PLACED',
  /** Delivery received */
  OPS_DELIVERY_RECEIVED: 'OPS_DELIVERY_RECEIVED',
  /** Par level adjusted */
  OPS_PAR_ADJUSTED: 'OPS_PAR_ADJUSTED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - PROPERTIES DOMAIN
// ============================================================================

export const PROPERTIES_EVENTS = {
  /** Inspection created */
  PROPERTIES_INSPECTION_CREATED: 'PROPERTIES_INSPECTION_CREATED',
  /** Inspection signed (immutable after) */
  PROPERTIES_INSPECTION_SIGNED: 'PROPERTIES_INSPECTION_SIGNED',
  /** Evidence uploaded to inspection */
  PROPERTIES_EVIDENCE_UPLOADED: 'PROPERTIES_EVIDENCE_UPLOADED',
  /** Maintenance ticket created */
  PROPERTIES_MAINTENANCE_CREATED: 'PROPERTIES_MAINTENANCE_CREATED',
  /** Maintenance dispatched to Service */
  PROPERTIES_MAINTENANCE_DISPATCHED: 'PROPERTIES_MAINTENANCE_DISPATCHED',
  /** Deposit dispute filed */
  PROPERTIES_DEPOSIT_DISPUTED: 'PROPERTIES_DEPOSIT_DISPUTED',
  /** Lease signed */
  PROPERTIES_LEASE_SIGNED: 'PROPERTIES_LEASE_SIGNED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - HOME DOMAIN
// ============================================================================

export const HOME_EVENTS = {
  /** Asset registered in inventory */
  HOME_ASSET_REGISTERED: 'HOME_ASSET_REGISTERED',
  /** Asset details updated */
  HOME_ASSET_UPDATED: 'HOME_ASSET_UPDATED',
  /** Photo added to asset */
  HOME_PHOTO_ADDED: 'HOME_PHOTO_ADDED',
  /** Document attached to asset */
  HOME_DOCUMENT_ATTACHED: 'HOME_DOCUMENT_ATTACHED',
  /** Valuation updated */
  HOME_VALUATION_UPDATED: 'HOME_VALUATION_UPDATED',
  /** Custody state changed */
  HOME_CUSTODY_CHANGED: 'HOME_CUSTODY_CHANGED',
  /** Claim initiated from Home */
  HOME_CLAIM_INITIATED: 'HOME_CLAIM_INITIATED',
} as const;

// ============================================================================
// EVENT TYPE REGISTRY - VERIFY DOMAIN (Canon v1.1 / v1.1.1)
// ============================================================================
// 
// These events implement the Forensic Capture Envelope (FCE) verification
// state machine defined in Golden Master v1.1 Section 4.
//
// Canon Reference: GOLDEN_MASTER_v1.1.1_ADDENDUM.md
// ============================================================================

export const VERIFY_EVENTS = {
  // ---------------------------------------------------------------------------
  // Verification State Machine Events (Canon v1.1 Section 4)
  // Canon Reference: Golden Master v1.1 - event_type MUST equal Canon string
  // ---------------------------------------------------------------------------
  
  /** FCE ingestion started - envelope received and queued for analysis */
  EVT_VERIFY_INGEST_STARTED: 'EVT_VERIFY_INGEST_STARTED',
  
  /** Analysis phase started - AI/ML processing of FCE payload */
  EVT_VERIFY_ANALYSIS_STARTED: 'EVT_VERIFY_ANALYSIS_STARTED',
  
  /** Adjudication phase started - human or automated review */
  EVT_VERIFY_ADJUDICATION_STARTED: 'EVT_VERIFY_ADJUDICATION_STARTED',
  
  /** Tier 3 evidentiary confirmation achieved */
  EVT_VERIFY_TIER_3_PASS: 'EVT_VERIFY_TIER_3_PASS',
  
  /** FCE flagged for review (risk signals triggered) */
  EVT_VERIFY_FLAGGED: 'EVT_VERIFY_FLAGGED',
  
  /** Assertion conflict detected (user claims vs system observations) */
  EVT_VERIFY_ASSERTION_CONFLICT: 'EVT_VERIFY_ASSERTION_CONFLICT',
  
  /** Lifecycle extended (re-verification passed) */
  EVT_VERIFY_LIFECYCLE_EXTEND: 'EVT_VERIFY_LIFECYCLE_EXTEND',
  
  /** Lifecycle broken (verification chain invalidated) */
  EVT_VERIFY_LIFECYCLE_BREAK: 'EVT_VERIFY_LIFECYCLE_BREAK',

  // ---------------------------------------------------------------------------
  // Threat Interdiction Events (Canon v1.1 Section 2)
  // ---------------------------------------------------------------------------
  
  /** Timestamp mismatch detected (device vs server vs EXIF) */
  EVT_VERIFY_TS_MISMATCH: 'EVT_VERIFY_TS_MISMATCH',
  
  /** Metadata anomaly detected (EXIF stripped, inconsistent, etc.) */
  EVT_VERIFY_METADATA_ANOMALY: 'EVT_VERIFY_METADATA_ANOMALY',
  
  /** Duplicate media detected (same image hash seen before) */
  EVT_VERIFY_DUPLICATE_MEDIA: 'EVT_VERIFY_DUPLICATE_MEDIA',
  
  /** Document validation failed (receipt/invoice invalid) */
  EVT_VERIFY_DOC_INVALID: 'EVT_VERIFY_DOC_INVALID',
  
  /** Physical challenge required (in-person verification needed) */
  EVT_VERIFY_PHYSICAL_CHALLENGE_REQUIRED: 'EVT_VERIFY_PHYSICAL_CHALLENGE_REQUIRED',
  
  /** Geo confidence low (location spoofing suspected) */
  EVT_VERIFY_GEO_CONFIDENCE_LOW: 'EVT_VERIFY_GEO_CONFIDENCE_LOW',

  // ---------------------------------------------------------------------------
  // Account-Level Events (Canon v1.1 Section 5)
  // These are NOT prefixed with VERIFY_ per Canon - they are account-level
  // ---------------------------------------------------------------------------
  
  /** Account frozen due to fraud signals */
  EVT_ACCOUNT_FROZEN: 'EVT_ACCOUNT_FROZEN',
  
  /** Account reinstated after review */
  EVT_ACCOUNT_REINSTATED: 'EVT_ACCOUNT_REINSTATED',
  
  /** Asset locked pending investigation */
  EVT_ASSET_LOCKED: 'EVT_ASSET_LOCKED',
  
  /** Asset unlocked after investigation */
  EVT_ASSET_UNLOCKED: 'EVT_ASSET_UNLOCKED',
} as const;

// ============================================================================
// LEGACY EVENT ALIASES (Backward Compatibility)
// ============================================================================
// 
// Accept legacy VERIFY_* event types from older producers.
// Store only canonical EVT_* in ledger_entries.event_type.
// This prevents outages while migrating all producers to Canon.
// ============================================================================

export const EVENT_ALIASES: Record<string, string> = {
  // Verification State Machine Events
  VERIFY_INGEST_STARTED: 'EVT_VERIFY_INGEST_STARTED',
  VERIFY_ANALYSIS_STARTED: 'EVT_VERIFY_ANALYSIS_STARTED',
  VERIFY_ADJUDICATION_STARTED: 'EVT_VERIFY_ADJUDICATION_STARTED',
  VERIFY_TIER_THREE_PASSED: 'EVT_VERIFY_TIER_3_PASS',
  VERIFY_FLAGGED: 'EVT_VERIFY_FLAGGED',
  VERIFY_ASSERTION_CONFLICT: 'EVT_VERIFY_ASSERTION_CONFLICT',
  VERIFY_LIFECYCLE_EXTENDED: 'EVT_VERIFY_LIFECYCLE_EXTEND',
  VERIFY_LIFECYCLE_BROKEN: 'EVT_VERIFY_LIFECYCLE_BREAK',

  // Threat Interdiction Events
  VERIFY_TIMESTAMP_MISMATCH: 'EVT_VERIFY_TS_MISMATCH',
  VERIFY_METADATA_ANOMALY: 'EVT_VERIFY_METADATA_ANOMALY',
  VERIFY_DUPLICATE_MEDIA: 'EVT_VERIFY_DUPLICATE_MEDIA',
  VERIFY_DOCUMENT_INVALID: 'EVT_VERIFY_DOC_INVALID',
  VERIFY_PHYSICAL_CHALLENGE_REQUIRED: 'EVT_VERIFY_PHYSICAL_CHALLENGE_REQUIRED',
  VERIFY_GEO_CONFIDENCE_LOW: 'EVT_VERIFY_GEO_CONFIDENCE_LOW',

  // Account-Level Events
  VERIFY_ACCOUNT_FROZEN: 'EVT_ACCOUNT_FROZEN',
  VERIFY_ACCOUNT_REINSTATED: 'EVT_ACCOUNT_REINSTATED',
  VERIFY_ASSET_LOCKED: 'EVT_ASSET_LOCKED',
  VERIFY_ASSET_UNLOCKED: 'EVT_ASSET_UNLOCKED',
};

// ============================================================================
// EVENT TYPE REGISTRY - CORE DOMAIN
// ============================================================================

export const CORE_EVENTS = {
  /** Asset registered in Core registry (PAID issued) */
  CORE_ASSET_REGISTERED: 'CORE_ASSET_REGISTERED',
  /** Ownership transferred */
  CORE_OWNERSHIP_TRANSFERRED: 'CORE_OWNERSHIP_TRANSFERRED',
  /** Fraud flag raised */
  CORE_FRAUD_FLAGGED: 'CORE_FRAUD_FLAGGED',
  /** Fraud flag cleared */
  CORE_FRAUD_CLEARED: 'CORE_FRAUD_CLEARED',
  /** Provenance score updated */
  CORE_SCORE_UPDATED: 'CORE_SCORE_UPDATED',
} as const;

// ============================================================================
// ALL EVENTS (COMBINED REGISTRY)
// ============================================================================

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
  ...VERIFY_EVENTS,
  ...CORE_EVENTS,
} as const;

export type EventType = typeof ALL_EVENT_TYPES[keyof typeof ALL_EVENT_TYPES];

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates an event against the canonical envelope schema.
 * Throws ZodError if validation fails.
 */
export function validateLedgerEvent(event: unknown): LedgerEvent {
  return LedgerEventSchema.parse(event);
}

/**
 * Safe validation that returns success/error result.
 */
export function safeParseLedgerEvent(event: unknown): z.SafeParseReturnType<unknown, LedgerEvent> {
  return LedgerEventSchema.safeParse(event);
}

/**
 * Check if an event type is a known canonical type.
 */
export function isKnownEventType(eventType: string): eventType is EventType {
  return Object.values(ALL_EVENT_TYPES).includes(eventType as EventType);
}

/**
 * Get the domain from an event type.
 * e.g., "ANCHOR_SEAL_BROKEN" -> "ANCHOR"
 */
export function getEventDomain(eventType: string): string {
  return eventType.split('_')[0];
}

// ============================================================================
// NORMALIZATION HELPERS (Backward Compatibility)
// ============================================================================

/**
 * Normalize an event type to its canonical form.
 * 
 * - If the event type is a legacy alias (VERIFY_*), returns the canonical EVT_* form.
 * - If the event type is already canonical, returns it unchanged.
 * - Records the original type for audit purposes.
 * 
 * @param eventType - The incoming event type (may be legacy or canonical)
 * @returns Object with canonical type and original type (if aliased)
 */
export function normalizeEventType(eventType: string): {
  canonical: string;
  original: string | null;
  wasAliased: boolean;
} {
  const aliasedTo = EVENT_ALIASES[eventType];
  
  if (aliasedTo) {
    return {
      canonical: aliasedTo,
      original: eventType,
      wasAliased: true,
    };
  }
  
  return {
    canonical: eventType,
    original: null,
    wasAliased: false,
  };
}

/**
 * Check if an event type is a known canonical type OR a known alias.
 * Use this for validation before normalization.
 */
export function isAcceptedEventType(eventType: string): boolean {
  // Check if it's a canonical type
  if (Object.values(ALL_EVENT_TYPES).includes(eventType as EventType)) {
    return true;
  }
  // Check if it's a known alias
  if (eventType in EVENT_ALIASES) {
    return true;
  }
  return false;
}
