import { randomUUID } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { ingestCanonicalEvent } from '../ingest/canonical.js';
import { canonicalHash, stableStringify } from '../lib/canonical.js';
import type { LedgerInput } from '../types.js';
import { computeVerificationStatusInTx } from '../replay/verification.js';

export interface CreateProofViewInput {
  asset_id: string;
  verification_event_id: string;
  asset_state_hash: string;
  evidence_set_hash: string;
  ruleset_version: string;
  expires_at: string; // ISO
  scope: Record<string, unknown>;
  created_by?: string;
  producer: string;
  producer_version: string;
}

export interface ProofViewRow {
  proof_id: string;
  asset_id: string;
  verification_event_id: string;
  snapshot_hash: string;
  asset_state_hash: string;
  evidence_set_hash: string;
  ruleset_version: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
  scope_json: Record<string, unknown> | null;
}

export function validateProofViewPure(params: {
  proof: ProofViewRow;
  now: Date;
  derived: {
    status: string;
    last_verification_event_id: string | null;
    asset_state_hash_current: string | null;
    evidence_set_hash_current: string | null;
  };
}): { ok: boolean; reason: string } {
  const { proof, now, derived } = params;

  if (proof.revoked_at) {
    return { ok: false, reason: 'PROOF_REVOKED' };
  }

  const expiresAt = new Date(proof.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || now.getTime() > expiresAt.getTime()) {
    return { ok: false, reason: 'PROOF_EXPIRED' };
  }

  if (derived.status === 'FROZEN' || derived.status === 'REVOKED') {
    return { ok: false, reason: `ASSET_${derived.status}` };
  }

  if (derived.status === 'INVALIDATED') {
    return { ok: false, reason: 'INVALIDATED' };
  }

  // Proof must bind to the active verification grant
  if (!derived.last_verification_event_id || derived.last_verification_event_id !== proof.verification_event_id) {
    return { ok: false, reason: 'NOT_ACTIVE_GRANT' };
  }

  // Current snapshot must match proof snapshot inputs
  if (derived.asset_state_hash_current && derived.asset_state_hash_current !== proof.asset_state_hash) {
    return { ok: false, reason: 'INVALIDATED' };
  }
  if (derived.evidence_set_hash_current && derived.evidence_set_hash_current !== proof.evidence_set_hash) {
    return { ok: false, reason: 'INVALIDATED' };
  }

  {
    const expectedSnapshotHash = computeProofSnapshotHash({
      asset_state_hash: proof.asset_state_hash,
      evidence_set_hash: proof.evidence_set_hash,
    });
    if (expectedSnapshotHash !== proof.snapshot_hash) {
      return { ok: false, reason: 'SNAPSHOT_MISMATCH' };
    }
  }

  if (derived.status !== 'VERIFIED_ACTIVE') {
    return { ok: false, reason: `NOT_VERIFIED_ACTIVE:${derived.status}` };
  }

  return { ok: true, reason: 'OK' };
}

function makeLedgerInput(params: {
  event_type: string;
  asset_id: string;
  producer: string;
  producer_version: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
}): LedgerInput {
  const now = new Date().toISOString();
  return {
    event_id: randomUUID(),
    client_id: params.producer,
    schema_version: '1.0.0',
    event_type: params.event_type,
    occurred_at: now,
    correlation_id: randomUUID(),
    idempotency_key: params.idempotency_key,
    producer: params.producer,
    producer_version: params.producer_version,
    subject: { asset_id: params.asset_id },
    payload: params.payload,
    canonical_hash_hex: canonicalHash(params.payload),
    signatures: {},
  };
}

export async function createProofView(pool: Pool, input: CreateProofViewInput): Promise<string> {
  const proof_id = randomUUID();

  const snapshot_hash = computeProofSnapshotHash({
    asset_state_hash: input.asset_state_hash,
    evidence_set_hash: input.evidence_set_hash,
  });

  const payload = {
    proof_id,
    asset_id: input.asset_id,
    verification_event_id: input.verification_event_id,
    snapshot_hash,
    asset_state_hash: input.asset_state_hash,
    evidence_set_hash: input.evidence_set_hash,
    ruleset_version: input.ruleset_version,
    expires_at: input.expires_at,
    scope_json: input.scope,
    created_by: input.created_by ?? null,
  };

  const ledgerInput = makeLedgerInput({
    event_type: 'PROOF_VIEW_CREATED',
    asset_id: input.asset_id,
    producer: input.producer,
    producer_version: input.producer_version,
    idempotency_key: `proof_view_created:${input.asset_id}:${proof_id}`,
    payload,
  });

  await ingestCanonicalEvent(pool, ledgerInput);

  await pool.query(
    `INSERT INTO proof_views
       (proof_id, asset_id, verification_event_id, snapshot_hash, asset_state_hash, evidence_set_hash, ruleset_version,
        expires_at, revoked_at, created_at, created_by, scope_json)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NOW(), $9, $10)`,
    [
      proof_id,
      input.asset_id,
      input.verification_event_id,
      snapshot_hash,
      input.asset_state_hash,
      input.evidence_set_hash,
      input.ruleset_version,
      input.expires_at,
      input.created_by ?? null,
      input.scope,
    ]
  );

  return proof_id;
}

export async function revokeProofView(pool: Pool, params: {
  proof_id: string;
  asset_id: string;
  revoked_by?: string;
  reason?: string;
  producer: string;
  producer_version: string;
}): Promise<void> {
  const payload = {
    proof_id: params.proof_id,
    asset_id: params.asset_id,
    revoked_by: params.revoked_by ?? null,
    reason: params.reason ?? null,
  };

  const ledgerInput = makeLedgerInput({
    event_type: 'PROOF_VIEW_REVOKED',
    asset_id: params.asset_id,
    producer: params.producer,
    producer_version: params.producer_version,
    idempotency_key: `proof_view_revoked:${params.asset_id}:${params.proof_id}`,
    payload,
  });

  await ingestCanonicalEvent(pool, ledgerInput);

  await pool.query(`UPDATE proof_views SET revoked_at = NOW() WHERE proof_id = $1`, [params.proof_id]);
}

export async function validateProofView(pool: Pool, proof_id: string): Promise<{ ok: boolean; reason: string }> {
  const r = await pool.query(
    `SELECT proof_id, asset_id, verification_event_id, snapshot_hash, asset_state_hash, evidence_set_hash, ruleset_version,
            expires_at, revoked_at, created_at, created_by, scope_json
     FROM proof_views
     WHERE proof_id = $1
     LIMIT 1`,
    [proof_id]
  );

  if (r.rowCount !== 1) {
    return { ok: false, reason: 'PROOF_NOT_FOUND' };
  }

  const proof = r.rows[0] as ProofViewRow;
  const client = await pool.connect();
  try {
    const derived = await computeVerificationStatusInTx(client, { asset_id: proof.asset_id });
    return validateProofViewPure({
      proof,
      now: new Date(),
      derived: {
        status: derived.status,
        last_verification_event_id: derived.last_verification_event_id,
        asset_state_hash_current: derived.asset_state_hash_current,
        evidence_set_hash_current: derived.evidence_set_hash_current,
      },
    });
  } finally {
    client.release();
  }
}

export function computeProofSnapshotHash(params: { asset_state_hash: string; evidence_set_hash: string }): string {
  return canonicalHash({
    asset_state_hash: params.asset_state_hash,
    evidence_set_hash: params.evidence_set_hash,
  });
}

export function canonicalScopeHash(scope: Record<string, unknown>): string {
  return canonicalHash({ scope_json: scope, scope_canonical: stableStringify(scope) });
}
