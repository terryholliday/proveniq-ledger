import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ingestCanonicalEvent } from '../ingest/canonical.js';
import type { LedgerInput } from '../types.js';
import { canonicalHash } from '../lib/canonical.js';
import { computeVerificationStatusInTx } from '../replay/verification.js';

export async function issueVerificationGranted(params: {
  pool: Pool;
  asset_id: string;
  claim_json: unknown;
  evidence_hashes: string[];
  ruleset_version: string;
  asset_state_hash: string;
  evidence_set_hash: string;
  physical_conf_bps: number;
  narrative_conf_bps: number;
  producer: string;
  producer_version: string;
  idempotency_key: string;
}): Promise<{ ok: boolean; event_id: string }> {
  // Freeze enforcement: must not issue while frozen.
  const client = await params.pool.connect();
  try {
    const status = await computeVerificationStatusInTx(client, { asset_id: params.asset_id });
    if (status.status === 'FROZEN') {
      throw new Error('ASSET_FROZEN');
    }
    if (status.status === 'REVOKED') {
      throw new Error('ASSET_REVOKED');
    }
  } finally {
    client.release();
  }

  const payload = {
    asset_id: params.asset_id,
    claim_json: params.claim_json,
    evidence_hashes: params.evidence_hashes,
    ruleset_version: params.ruleset_version,
    asset_state_hash: params.asset_state_hash,
    evidence_set_hash: params.evidence_set_hash,
    physical_conf_bps: params.physical_conf_bps,
    narrative_conf_bps: params.narrative_conf_bps,
  };

  const event: LedgerInput = {
    event_id: randomUUID(),
    client_id: params.producer,
    schema_version: '1.0.0',
    event_type: 'VERIFICATION_GRANTED',
    occurred_at: new Date().toISOString(),
    correlation_id: randomUUID(),
    idempotency_key: params.idempotency_key,
    producer: params.producer,
    producer_version: params.producer_version,
    subject: { asset_id: params.asset_id },
    payload,
    canonical_hash_hex: canonicalHash(payload),
    signatures: {},
  };

  await ingestCanonicalEvent(params.pool, event);
  return { ok: true, event_id: event.event_id };
}
