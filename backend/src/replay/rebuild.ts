import type { Pool, PoolClient } from 'pg';
import { reduceVerificationStatus, type LedgerRowForReplay } from './verification.js';
import { ingestCanonicalEvent } from '../ingest/canonical.js';
import type { LedgerInput } from '../types.js';
import { canonicalHash } from '../lib/canonical.js';
import { randomUUID } from 'crypto';

async function truncateReadModels(client: PoolClient): Promise<void> {
  await client.query('TRUNCATE TABLE assets_read');
  await client.query('TRUNCATE TABLE evidence_snapshots');
  await client.query('TRUNCATE TABLE verification_cache');
  await client.query('TRUNCATE TABLE proof_views');
}

async function loadAllLedgerRows(client: PoolClient): Promise<LedgerRowForReplay[]> {
  const result = await client.query(
    `SELECT id, sequence_number, event_type, asset_id, payload, ruleset_version, asset_state_hash, evidence_set_hash, created_at
     FROM ledger_entries
     ORDER BY sequence_number ASC`
  );
  return result.rows as LedgerRowForReplay[];
}

function upsertAssetClaim(acc: Map<string, unknown>, assetId: string, claimJson: unknown) {
  acc.set(assetId, claimJson);
}

export async function rebuildReadModels(pool: Pool): Promise<{ ok: boolean; rebuilt_assets: number }> {
  const client = await pool.connect();
  const mismatches: Array<{ asset_id: string; derived: ReturnType<typeof reduceVerificationStatus> }> = [];
  try {
    await client.query('BEGIN');

    await truncateReadModels(client);

    const rows = await loadAllLedgerRows(client);

    const claimsByAsset = new Map<string, unknown>();
    const assets = new Set<string>();

    for (const row of rows) {
      if (!row.asset_id) continue;
      assets.add(row.asset_id);

      const claimJson = (row.payload as { claim_json?: unknown }).claim_json;
      if (claimJson !== undefined) {
        upsertAssetClaim(claimsByAsset, row.asset_id, claimJson);
      }

      // Evidence snapshot projection
      const evidenceId = (row.payload as { evidence_id?: unknown }).evidence_id;
      const contentHash = (row.payload as { content_hash?: unknown }).content_hash;
      if (typeof evidenceId === 'string' && typeof contentHash === 'string') {
        await client.query(
          `INSERT INTO evidence_snapshots (id, asset_id, content_hash, storage_ref, metadata_json)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [evidenceId, row.asset_id, contentHash, (row.payload as { storage_ref?: unknown }).storage_ref ?? null, row.payload]
        );
      }

      // Proof views projection (rebuildable)
      if (row.event_type === 'PROOF_VIEW_CREATED') {
        const proofId = (row.payload as { proof_id?: unknown }).proof_id;
        const snapshotHash = (row.payload as { snapshot_hash?: unknown }).snapshot_hash;
        const expiresAt = (row.payload as { expires_at?: unknown }).expires_at;
        const verificationEventId = (row.payload as { verification_event_id?: unknown }).verification_event_id;
        const assetStateHash = (row.payload as { asset_state_hash?: unknown }).asset_state_hash;
        const evidenceSetHash = (row.payload as { evidence_set_hash?: unknown }).evidence_set_hash;
        const rulesetVersion = (row.payload as { ruleset_version?: unknown }).ruleset_version;
        if (
          typeof proofId === 'string' &&
          typeof snapshotHash === 'string' &&
          typeof expiresAt === 'string' &&
          typeof verificationEventId === 'string' &&
          typeof assetStateHash === 'string' &&
          typeof evidenceSetHash === 'string' &&
          typeof rulesetVersion === 'string'
        ) {
          await client.query(
            `INSERT INTO proof_views
               (proof_id, asset_id, verification_event_id, snapshot_hash, asset_state_hash, evidence_set_hash, ruleset_version,
                expires_at, revoked_at, created_by, scope_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10)
             ON CONFLICT (proof_id) DO NOTHING`,
            [
              proofId,
              row.asset_id,
              verificationEventId,
              snapshotHash,
              assetStateHash,
              evidenceSetHash,
              rulesetVersion,
              expiresAt,
              (row.payload as { created_by?: unknown }).created_by ?? null,
              (row.payload as { scope_json?: unknown }).scope_json ?? null,
            ]
          );
        }
      }

      if (row.event_type === 'PROOF_VIEW_REVOKED') {
        const proofId = (row.payload as { proof_id?: unknown }).proof_id;
        if (typeof proofId === 'string') {
          await client.query(`UPDATE proof_views SET revoked_at = NOW() WHERE proof_id = $1`, [proofId]);
        }
      }
    }

    // Build assets_read + verification_cache
    for (const assetId of assets) {
      const claimJson = claimsByAsset.get(assetId) ?? null;

      // Compute derived verification state (pure function)
      const derived = reduceVerificationStatus({ asset_id: assetId, rows });
      if (derived.status === 'INVALIDATED') {
        mismatches.push({ asset_id: assetId, derived });
      }

      await client.query(
        `INSERT INTO assets_read (asset_id, claim_json, current_asset_state_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (asset_id)
         DO UPDATE SET claim_json = EXCLUDED.claim_json, current_asset_state_hash = EXCLUDED.current_asset_state_hash, updated_at = NOW()`,
        [assetId, claimJson, derived.asset_state_hash]
      );

      await client.query(
        `INSERT INTO verification_cache
           (asset_id, status, physical_conf_bps, narrative_conf_bps, last_verification_event_id, expires_at,
            active_freeze, active_flags_json, ruleset_version)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (asset_id)
         DO UPDATE SET
           status = EXCLUDED.status,
           physical_conf_bps = EXCLUDED.physical_conf_bps,
           narrative_conf_bps = EXCLUDED.narrative_conf_bps,
           last_verification_event_id = EXCLUDED.last_verification_event_id,
           expires_at = EXCLUDED.expires_at,
           active_freeze = EXCLUDED.active_freeze,
           active_flags_json = EXCLUDED.active_flags_json,
           ruleset_version = EXCLUDED.ruleset_version,
           updated_at = NOW()`,
        [
          assetId,
          derived.status,
          derived.physical_conf_bps,
          derived.narrative_conf_bps,
          derived.last_verification_event_id,
          null,
          derived.active_freeze,
          null,
          derived.ruleset_version,
        ]
      );
    }

    await client.query('COMMIT');

    // Append-only integrity alerts (outside transaction to avoid lock contention)
    for (const m of mismatches) {
      const payload = {
        asset_id: m.asset_id,
        verification_event_id: m.derived.last_verification_event_id,
        asset_state_hash_granted: m.derived.asset_state_hash,
        evidence_set_hash_granted: m.derived.evidence_set_hash,
        asset_state_hash_current: m.derived.asset_state_hash_current,
        evidence_set_hash_current: m.derived.evidence_set_hash_current,
        ruleset_version: m.derived.ruleset_version,
        reason_code: m.derived.reason_code,
      };

      const idempotency_key = `state_hash_mismatch:${m.asset_id}:${m.derived.last_verification_event_id ?? 'none'}:${canonicalHash(payload)}`;

      const evt: LedgerInput = {
        event_id: randomUUID(),
        client_id: 'ledger',
        schema_version: '1.0.0',
        event_type: 'STATE_HASH_MISMATCH',
        occurred_at: new Date().toISOString(),
        correlation_id: randomUUID(),
        idempotency_key,
        producer: 'ops',
        producer_version: '1.0.0',
        subject: { asset_id: m.asset_id },
        payload,
        canonical_hash_hex: canonicalHash(payload),
        signatures: {},
      };

      await ingestCanonicalEvent(pool, evt);
    }

    return { ok: true, rebuilt_assets: assets.size };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
