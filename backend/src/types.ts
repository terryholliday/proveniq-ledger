import { z } from 'zod';

// Valid event sources (PROVENIQ ecosystem)
export const EventSource = z.enum([
  'anchors',
  'home',
  'bids',
  'claimsiq',
  'capital',
  'ops',
  'properties',
  'service',
  'transit',
  'protect',
  'origins',
  'core',
  'system',
]);

export type EventSource = z.infer<typeof EventSource>;

// Ledger entry creation schema
export const CreateEntrySchema = z.object({
  source: EventSource,
  event_type: z.string().min(1).max(128),
  correlation_id: z.string().optional(),
  asset_id: z.string().uuid().optional(),
  anchor_id: z.string().max(64).optional(),
  actor_id: z.string().optional(),
  payload: z.record(z.unknown()),
});

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;

// Ledger entry response
export interface LedgerEntry {
  id: string;
  sequence_number: number;
  source: string;
  event_type: string;
  correlation_id: string | null;
  asset_id: string | null;
  anchor_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  payload_hash: string;
  previous_hash: string | null;
  entry_hash: string;
  created_at: string;
}

// Query parameters
export const QueryEntriesSchema = z.object({
  source: EventSource.optional(),
  event_type: z.string().optional(),
  asset_id: z.string().uuid().optional(),
  anchor_id: z.string().optional(),
  correlation_id: z.string().optional(),
  from_sequence: z.coerce.number().int().positive().optional(),
  to_sequence: z.coerce.number().int().positive().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueryEntriesInput = z.infer<typeof QueryEntriesSchema>;

// Integrity verification result
export interface IntegrityResult {
  valid: boolean;
  entries_checked: number;
  first_sequence: number;
  last_sequence: number;
  errors: Array<{
    sequence_number: number;
    error_type: 'payload_hash_mismatch' | 'entry_hash_mismatch' | 'chain_break';
    details: string;
  }>;
  verified_at: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  action: string;
  actor_id: string | null;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
