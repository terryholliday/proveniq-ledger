import type { Pool, PoolClient } from 'pg';
import { computeAssetStateHash, computeEvidenceSetHash } from '../lib/canonical.js';

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'VERIFIED_ACTIVE'
  | 'VERIFIED_DECAYED'
  | 'INVALIDATED'
  | 'FROZEN'
  | 'REVOKED'
  | 'SUPERSEDED';

export interface VerificationReplayResult {
  asset_id: string;
  status: VerificationStatus;
  reason_code: string;
  ruleset_version: string;
  physical_conf_bps: number;
  narrative_conf_bps: number;
  last_verification_event_id: string | null;
  last_event_sequence: number | null;
  evidence_set_hash: string | null;
  asset_state_hash: string | null;
  evidence_set_hash_current: string | null;
  asset_state_hash_current: string | null;
  active_freeze: boolean;
  active_freeze_event_id: string | null;
  revoked_by_event_id: string | null;
  superseded_by_event_id: string | null;
}

export interface LedgerRowForReplay {
  id: string;
  sequence_number: number;
  event_type: string;
  asset_id: string | null;
  payload: Record<string, unknown>;
  ruleset_version: string | null;
  asset_state_hash: string | null;
  evidence_set_hash: string | null;
  created_at: string;
}

function getString(payload: Record<string, unknown>, k: string): string | null {
  const v = payload[k];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function getBps(payload: Record<string, unknown>, k: string, fallback: number): number {
  const v = payload[k];
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(10000, Math.round(v)));
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.min(10000, Math.round(n)));
  }
  return fallback;
}

/**
 * Pure replay reducer for Phase 0 derived verification status.
 */
export function reduceVerificationStatus(params: {
  asset_id: string;
  rows: LedgerRowForReplay[];
  as_of_time?: Date;
}): VerificationReplayResult {
  const { asset_id, rows } = params;
  const asOf = params.as_of_time ?? new Date();

  // Only consider rows for this asset, ordered by sequence.
  const ordered = [...rows]
    .filter((r) => r.asset_id === asset_id)
    .sort((a, b) => a.sequence_number - b.sequence_number);

  let activeFreeze = false;
  let activeFreezeEventId: string | null = null;

  let revokedByEventId: string | null = null;

  let lastGrant: LedgerRowForReplay | null = null;
  let supersededByEventId: string | null = null;

  // Replay sources for current snapshot
  let latestClaimJson: unknown = undefined;
  const currentEvidenceContentHashes: string[] = [];

  for (const row of ordered) {
    if (row.event_type === 'CLAIM_ADDED' || row.event_type === 'CLAIM_UPDATED') {
      const claim = (row.payload as { claim_json?: unknown }).claim_json;
      if (claim !== undefined) latestClaimJson = claim;
      continue;
    }

    if (row.event_type === 'EVIDENCE_ADDED') {
      const contentHash = getString(row.payload, 'content_hash');
      if (contentHash) currentEvidenceContentHashes.push(contentHash);
      continue;
    }

    if (row.event_type === 'EVIDENCE_FROZEN' || row.event_type === 'DISPUTE_FILED') {
      activeFreeze = true;
      activeFreezeEventId = row.id;
      continue;
    }

    if (row.event_type === 'FREEZE_LIFTED' || row.event_type === 'DISPUTE_RESOLVED') {
      activeFreeze = false;
      activeFreezeEventId = null;
      continue;
    }

    if (row.event_type === 'VERIFICATION_REVOKED') {
      revokedByEventId = row.id;
      continue;
    }

    if (row.event_type === 'VERIFICATION_GRANTED') {
      if (lastGrant) {
        supersededByEventId = row.id;
      }
      lastGrant = row;
      revokedByEventId = null;
      continue;
    }
  }

  const lastEventSequence = ordered.length > 0 ? ordered[ordered.length - 1].sequence_number : null;

  // Compute current snapshot hashes from replay sources (non-negotiable)
  const evidenceSetHashCurrent =
    currentEvidenceContentHashes.length > 0 ? computeEvidenceSetHash(currentEvidenceContentHashes) : null;
  const rulesetVersionCurrent = (lastGrant?.ruleset_version ?? 'v1.0.0') || 'v1.0.0';
  const assetStateHashCurrent =
    latestClaimJson !== undefined && evidenceSetHashCurrent !== null
      ? computeAssetStateHash({
          claim_json: latestClaimJson,
          evidence_hashes: currentEvidenceContentHashes,
          ruleset_version: rulesetVersionCurrent,
        })
      : null;

  if (revokedByEventId) {
    return {
      asset_id,
      status: 'REVOKED',
      reason_code: 'VERIFICATION_REVOKED',
      ruleset_version: (lastGrant?.ruleset_version ?? 'v1.0.0') || 'v1.0.0',
      physical_conf_bps: 0,
      narrative_conf_bps: 0,
      last_verification_event_id: lastGrant?.id ?? null,
      last_event_sequence: lastEventSequence,
      evidence_set_hash: lastGrant?.evidence_set_hash ?? null,
      asset_state_hash: lastGrant?.asset_state_hash ?? null,
      evidence_set_hash_current: evidenceSetHashCurrent,
      asset_state_hash_current: assetStateHashCurrent,
      active_freeze: activeFreeze,
      active_freeze_event_id: activeFreezeEventId,
      revoked_by_event_id: revokedByEventId,
      superseded_by_event_id: null,
    };
  }

  if (activeFreeze) {
    return {
      asset_id,
      status: 'FROZEN',
      reason_code: 'ACTIVE_FREEZE',
      ruleset_version: (lastGrant?.ruleset_version ?? 'v1.0.0') || 'v1.0.0',
      physical_conf_bps: getBps(lastGrant?.payload ?? {}, 'physical_conf_bps', 0),
      narrative_conf_bps: getBps(lastGrant?.payload ?? {}, 'narrative_conf_bps', 0),
      last_verification_event_id: lastGrant?.id ?? null,
      last_event_sequence: lastEventSequence,
      evidence_set_hash: lastGrant?.evidence_set_hash ?? null,
      asset_state_hash: lastGrant?.asset_state_hash ?? null,
      evidence_set_hash_current: evidenceSetHashCurrent,
      asset_state_hash_current: assetStateHashCurrent,
      active_freeze: true,
      active_freeze_event_id: activeFreezeEventId,
      revoked_by_event_id: null,
      superseded_by_event_id: null,
    };
  }

  if (!lastGrant) {
    return {
      asset_id,
      status: 'UNVERIFIED',
      reason_code: 'NO_VERIFICATION_GRANTED',
      ruleset_version: 'v1.0.0',
      physical_conf_bps: 0,
      narrative_conf_bps: 0,
      last_verification_event_id: null,
      last_event_sequence: lastEventSequence,
      evidence_set_hash: null,
      asset_state_hash: null,
      evidence_set_hash_current: evidenceSetHashCurrent,
      asset_state_hash_current: assetStateHashCurrent,
      active_freeze: false,
      active_freeze_event_id: null,
      revoked_by_event_id: null,
      superseded_by_event_id: null,
    };
  }

  // Snapshot validity check (non-negotiable): compare computed CURRENT hashes vs hashes recorded on grant.
  // No trust in producer-supplied current_* hashes.
  const grantAssetStateHash = lastGrant.asset_state_hash ?? getString(lastGrant.payload, 'asset_state_hash');
  const grantEvidenceSetHash = lastGrant.evidence_set_hash ?? getString(lastGrant.payload, 'evidence_set_hash');

  const snapshotMismatch =
    (assetStateHashCurrent !== null && grantAssetStateHash !== null && assetStateHashCurrent !== grantAssetStateHash) ||
    (evidenceSetHashCurrent !== null && grantEvidenceSetHash !== null && evidenceSetHashCurrent !== grantEvidenceSetHash);

  if (supersededByEventId) {
    return {
      asset_id,
      status: 'SUPERSEDED',
      reason_code: 'NEWER_VERIFICATION_GRANTED',
      ruleset_version: lastGrant.ruleset_version ?? 'v1.0.0',
      physical_conf_bps: getBps(lastGrant.payload, 'physical_conf_bps', 0),
      narrative_conf_bps: getBps(lastGrant.payload, 'narrative_conf_bps', 0),
      last_verification_event_id: lastGrant.id,
      last_event_sequence: lastEventSequence,
      evidence_set_hash: grantEvidenceSetHash ?? null,
      asset_state_hash: grantAssetStateHash ?? null,
      evidence_set_hash_current: evidenceSetHashCurrent,
      asset_state_hash_current: assetStateHashCurrent,
      active_freeze: false,
      active_freeze_event_id: null,
      revoked_by_event_id: null,
      superseded_by_event_id: supersededByEventId,
    };
  }

  if (snapshotMismatch) {
    return {
      asset_id,
      status: 'INVALIDATED',
      reason_code: 'STATE_HASH_MISMATCH',
      ruleset_version: lastGrant.ruleset_version ?? 'v1.0.0',
      physical_conf_bps: getBps(lastGrant.payload, 'physical_conf_bps', 0),
      narrative_conf_bps: getBps(lastGrant.payload, 'narrative_conf_bps', 0),
      last_verification_event_id: lastGrant.id,
      last_event_sequence: lastEventSequence,
      evidence_set_hash: grantEvidenceSetHash ?? null,
      asset_state_hash: grantAssetStateHash ?? null,
      evidence_set_hash_current: evidenceSetHashCurrent,
      asset_state_hash_current: assetStateHashCurrent,
      active_freeze: false,
      active_freeze_event_id: null,
      revoked_by_event_id: null,
      superseded_by_event_id: null,
    };
  }

  // Optional expiration/decay by time.
  const expiresAtStr = getString(lastGrant.payload, 'expires_at');
  if (expiresAtStr) {
    const expiresAt = new Date(expiresAtStr);
    if (!Number.isNaN(expiresAt.getTime()) && asOf.getTime() > expiresAt.getTime()) {
      return {
        asset_id,
        status: 'VERIFIED_DECAYED',
        reason_code: 'VERIFICATION_EXPIRED',
        ruleset_version: lastGrant.ruleset_version ?? 'v1.0.0',
        physical_conf_bps: getBps(lastGrant.payload, 'physical_conf_bps', 0),
        narrative_conf_bps: getBps(lastGrant.payload, 'narrative_conf_bps', 0),
        last_verification_event_id: lastGrant.id,
        last_event_sequence: lastEventSequence,
        evidence_set_hash: grantEvidenceSetHash ?? null,
        asset_state_hash: grantAssetStateHash ?? null,
        evidence_set_hash_current: evidenceSetHashCurrent,
        asset_state_hash_current: assetStateHashCurrent,
        active_freeze: false,
        active_freeze_event_id: null,
        revoked_by_event_id: null,
        superseded_by_event_id: null,
      };
    }
  }

  return {
    asset_id,
    status: 'VERIFIED_ACTIVE',
    reason_code: 'VERIFICATION_GRANTED_ACTIVE',
    ruleset_version: lastGrant.ruleset_version ?? 'v1.0.0',
    physical_conf_bps: getBps(lastGrant.payload, 'physical_conf_bps', 0),
    narrative_conf_bps: getBps(lastGrant.payload, 'narrative_conf_bps', 0),
    last_verification_event_id: lastGrant.id,
    last_event_sequence: lastEventSequence,
    evidence_set_hash: grantEvidenceSetHash ?? null,
    asset_state_hash: grantAssetStateHash ?? null,
    evidence_set_hash_current: evidenceSetHashCurrent,
    asset_state_hash_current: assetStateHashCurrent,
    active_freeze: false,
    active_freeze_event_id: null,
    revoked_by_event_id: null,
    superseded_by_event_id: null,
  };
}

async function loadRowsForAsset(client: PoolClient, assetId: string): Promise<LedgerRowForReplay[]> {
  const result = await client.query(
    `SELECT id, sequence_number, event_type, asset_id, payload, ruleset_version, asset_state_hash, evidence_set_hash, created_at
     FROM ledger_entries
     WHERE asset_id = $1
     ORDER BY sequence_number ASC`,
    [assetId]
  );
  return result.rows as LedgerRowForReplay[];
}

export async function computeVerificationStatus(pool: Pool, params: { asset_id: string; as_of_time?: Date }) {
  const client = await pool.connect();
  try {
    const rows = await loadRowsForAsset(client, params.asset_id);
    return reduceVerificationStatus({ asset_id: params.asset_id, rows, as_of_time: params.as_of_time });
  } finally {
    client.release();
  }
}

export async function computeVerificationStatusInTx(
  client: PoolClient,
  params: { asset_id: string; as_of_time?: Date }
) {
  const rows = await loadRowsForAsset(client, params.asset_id);
  return reduceVerificationStatus({ asset_id: params.asset_id, rows, as_of_time: params.as_of_time });
}
