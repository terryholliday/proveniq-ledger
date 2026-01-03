import { ingestCanonicalEvent } from '../ingest/canonical.js';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { LedgerInput } from '../types.js';
import { canonicalHash } from '../lib/canonical.js';

export interface ValuationInput {
  source: string;
  value_cents: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export async function rejectOracleOutliers(params: {
  pool: Pool;
  asset_id: string;
  valuations: ValuationInput[];
  producer: string;
  producer_version: string;
}): Promise<{ ok: boolean; rejected_sources: string[] }>{
  const vals = params.valuations.filter((v) => Number.isFinite(v.value_cents));
  if (vals.length < 2) {
    return { ok: true, rejected_sources: [] };
  }

  const med = median(vals.map((v) => v.value_cents));
  const rejected: string[] = [];

  for (const v of vals) {
    const deviation = Math.abs(v.value_cents - med) / med;
    if (deviation > 0.1) {
      rejected.push(v.source);
    }
  }

  if (rejected.length === 0) {
    return { ok: true, rejected_sources: [] };
  }

  const payload = {
    asset_id: params.asset_id,
    median_value_cents: Math.round(med),
    rejected_sources: rejected,
    valuations: vals,
    threshold_fraction: 0.1,
  };

  const event: LedgerInput = {
    event_id: randomUUID(),
    client_id: params.producer,
    schema_version: '1.0.0',
    event_type: 'ORACLE_DATA_REJECTED',
    occurred_at: new Date().toISOString(),
    correlation_id: randomUUID(),
    idempotency_key: `oracle_data_rejected:${params.asset_id}:${canonicalHash(payload)}`,
    producer: params.producer,
    producer_version: params.producer_version,
    subject: { asset_id: params.asset_id },
    payload,
    canonical_hash_hex: canonicalHash(payload),
    signatures: {},
  };

  await ingestCanonicalEvent(params.pool, event);

  return { ok: true, rejected_sources: rejected };
}
