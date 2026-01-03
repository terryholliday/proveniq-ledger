import { describe, it, expect, vi } from 'vitest';

vi.mock('../ingest/canonical.js', () => ({
  ingestCanonicalEvent: vi.fn(),
}));

import { reduceVerificationStatus, type LedgerRowForReplay } from '../replay/verification.js';
import { validateProofViewPure, computeProofSnapshotHash, type ProofViewRow } from '../proofs/service.js';
import { rebuildReadModels } from '../replay/rebuild.js';
import { issueVerificationGranted } from '../services/verification-issuance.js';
import { computeAssetStateHash, computeEvidenceSetHash } from '../lib/canonical.js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function mkRow(partial: Partial<LedgerRowForReplay>): LedgerRowForReplay {
  return {
    id: partial.id ?? 'evt-1',
    sequence_number: partial.sequence_number ?? 1,
    event_type: partial.event_type ?? 'HOME_ASSET_REGISTERED',
    asset_id: partial.asset_id ?? '00000000-0000-0000-0000-000000000001',
    payload: partial.payload ?? {},
    ruleset_version: partial.ruleset_version ?? 'v1.0.0',
    asset_state_hash: partial.asset_state_hash ?? null,
    evidence_set_hash: partial.evidence_set_hash ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// 1) Mutation invalidates verification (snapshot mismatch)
// -----------------------------------------------------------------------------

describe('PH0 - Derived Replay', () => {
  it('mutation invalidates verification (snapshot mismatch -> INVALIDATED)', () => {
    const assetId = '00000000-0000-0000-0000-000000000001';

    const claimA = { name: 'A' };
    const evidenceA = ['e1'];
    const grantEvidenceHash = computeEvidenceSetHash(evidenceA);
    const grantAssetHash = computeAssetStateHash({ claim_json: claimA, evidence_hashes: evidenceA, ruleset_version: 'v1.0.0' });

    const rows: LedgerRowForReplay[] = [
      mkRow({
        id: 'grant-1',
        sequence_number: 1,
        event_type: 'VERIFICATION_GRANTED',
        asset_id: assetId,
        asset_state_hash: grantAssetHash,
        evidence_set_hash: grantEvidenceHash,
        payload: {
          physical_conf_bps: 9000,
          narrative_conf_bps: 8500,
        },
      }),
      mkRow({
        id: 'claim-2',
        sequence_number: 2,
        event_type: 'CLAIM_UPDATED',
        asset_id: assetId,
        payload: { claim_json: { name: 'B' } },
      }),
      mkRow({
        id: 'ev-3',
        sequence_number: 3,
        event_type: 'EVIDENCE_ADDED',
        asset_id: assetId,
        payload: { content_hash: 'e2' },
      }),
    ];

    const derived = reduceVerificationStatus({ asset_id: assetId, rows });
    expect(derived.status).toBe('INVALIDATED');
    expect(derived.reason_code).toBe('STATE_HASH_MISMATCH');
    expect(derived.last_verification_event_id).toBe('grant-1');
  });

  it('freeze blocks verification issuance (throws ASSET_FROZEN and does not ingest)', async () => {
    const { ingestCanonicalEvent } = await import('../ingest/canonical.js');

    const assetId = '00000000-0000-0000-0000-000000000001';
    const fakeClient = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM ledger_entries') && sql.includes('WHERE asset_id = $1')) {
          return {
            rows: [
              mkRow({
                id: 'freeze-1',
                sequence_number: 1,
                event_type: 'EVIDENCE_FROZEN',
                asset_id: assetId,
                payload: {},
              }),
            ],
          };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };

    const pool = {
      connect: async () => fakeClient,
    } as any;

    await expect(
      issueVerificationGranted({
        pool,
        asset_id: '00000000-0000-0000-0000-000000000001',
        claim_json: { name: 'A' },
        evidence_hashes: ['e1'],
        ruleset_version: 'v1.0.0',
        asset_state_hash: 'ah',
        evidence_set_hash: 'eh',
        physical_conf_bps: 9000,
        narrative_conf_bps: 9000,
        producer: 'home',
        producer_version: '1.0.0',
        idempotency_key: 'k1',
      })
    ).rejects.toThrow('ASSET_FROZEN');

    expect((ingestCanonicalEvent as any).mock.calls.length).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// 3) Proof TTL + revoke
// -----------------------------------------------------------------------------

describe('PH0 - Proof Views', () => {
  it('expired proof rejected', () => {
    const now = new Date('2026-01-03T00:00:10.000Z');
    const proof: ProofViewRow = {
      proof_id: 'p1',
      asset_id: 'a1',
      verification_event_id: 'grant-1',
      snapshot_hash: 's1',
      asset_state_hash: 'ash',
      evidence_set_hash: 'esh',
      ruleset_version: 'v1.0.0',
      expires_at: '2026-01-03T00:00:00.000Z',
      revoked_at: null,
      created_at: '2026-01-03T00:00:00.000Z',
      created_by: null,
      scope_json: null,
    };

    const res = validateProofViewPure({
      proof,
      now,
      derived: {
        status: 'VERIFIED_ACTIVE',
        last_verification_event_id: 'grant-1',
        asset_state_hash_current: 'ash',
        evidence_set_hash_current: 'esh',
      },
    });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('PROOF_EXPIRED');
  });

  it('revoked proof rejected', () => {
    const now = new Date('2026-01-03T00:00:00.000Z');
    const proof: ProofViewRow = {
      proof_id: 'p1',
      asset_id: 'a1',
      verification_event_id: 'grant-1',
      snapshot_hash: 's1',
      asset_state_hash: 'ash',
      evidence_set_hash: 'esh',
      ruleset_version: 'v1.0.0',
      expires_at: '2026-01-03T00:01:00.000Z',
      revoked_at: '2026-01-03T00:00:30.000Z',
      created_at: '2026-01-03T00:00:00.000Z',
      created_by: null,
      scope_json: null,
    };

    const res = validateProofViewPure({
      proof,
      now,
      derived: {
        status: 'VERIFIED_ACTIVE',
        last_verification_event_id: 'grant-1',
        asset_state_hash_current: 'ash',
        evidence_set_hash_current: 'esh',
      },
    });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('PROOF_REVOKED');
  });

  it('valid proof requires live replay state and snapshot match', () => {
    const now = new Date('2026-01-03T00:00:00.000Z');
    const asset_state_hash = 'ash';
    const evidence_set_hash = 'esh';
    const snapshot_hash = computeProofSnapshotHash({ asset_state_hash, evidence_set_hash });

    const proof: ProofViewRow = {
      proof_id: 'p1',
      asset_id: 'a1',
      verification_event_id: 'grant-1',
      snapshot_hash,
      asset_state_hash,
      evidence_set_hash,
      ruleset_version: 'v1.0.0',
      expires_at: '2026-01-03T00:01:00.000Z',
      revoked_at: null,
      created_at: '2026-01-03T00:00:00.000Z',
      created_by: null,
      scope_json: null,
    };

    const res = validateProofViewPure({
      proof,
      now,
      derived: {
        status: 'VERIFIED_ACTIVE',
        last_verification_event_id: 'grant-1',
        asset_state_hash_current: asset_state_hash,
        evidence_set_hash_current: evidence_set_hash,
      },
    });

    expect(res.ok).toBe(true);
  });

  it('proof becomes invalid when snapshot changes even before TTL expiry', () => {
    const now = new Date('2026-01-03T00:00:00.000Z');
    const proof: ProofViewRow = {
      proof_id: 'p1',
      asset_id: 'a1',
      verification_event_id: 'grant-1',
      snapshot_hash: computeProofSnapshotHash({ asset_state_hash: 'ash', evidence_set_hash: 'esh' }),
      asset_state_hash: 'ash',
      evidence_set_hash: 'esh',
      ruleset_version: 'v1.0.0',
      expires_at: '2026-01-03T00:01:00.000Z',
      revoked_at: null,
      created_at: '2026-01-03T00:00:00.000Z',
      created_by: null,
      scope_json: null,
    };

    const res = validateProofViewPure({
      proof,
      now,
      derived: {
        status: 'VERIFIED_ACTIVE',
        last_verification_event_id: 'grant-1',
        asset_state_hash_current: 'ash_changed',
        evidence_set_hash_current: 'esh',
      },
    });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('INVALIDATED');
  });

  it('proof validation is tied to a specific verification_event_id', () => {
    const now = new Date('2026-01-03T00:00:00.000Z');
    const proof: ProofViewRow = {
      proof_id: 'p1',
      asset_id: 'a1',
      verification_event_id: 'grant-1',
      snapshot_hash: computeProofSnapshotHash({ asset_state_hash: 'ash', evidence_set_hash: 'esh' }),
      asset_state_hash: 'ash',
      evidence_set_hash: 'esh',
      ruleset_version: 'v1.0.0',
      expires_at: '2026-01-03T00:01:00.000Z',
      revoked_at: null,
      created_at: '2026-01-03T00:00:00.000Z',
      created_by: null,
      scope_json: null,
    };

    const res = validateProofViewPure({
      proof,
      now,
      derived: {
        status: 'VERIFIED_ACTIVE',
        last_verification_event_id: 'grant-2',
        asset_state_hash_current: 'ash',
        evidence_set_hash_current: 'esh',
      },
    });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('NOT_ACTIVE_GRANT');
  });
});

// -----------------------------------------------------------------------------
// 4) Replay reconstruction (read model rebuild uses ledger rows)
// -----------------------------------------------------------------------------

describe('PH0 - Read model rebuild', () => {
  it('rebuildReadModels truncates and repopulates derived cache deterministically', async () => {
    const calls: string[] = [];

    const fakeClient = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));

        if (sql.includes('FROM ledger_entries') && sql.includes('ORDER BY sequence_number ASC')) {
          const assetId = '00000000-0000-0000-0000-000000000001';
          return {
            rows: [
              mkRow({
                id: 'grant-1',
                sequence_number: 1,
                event_type: 'VERIFICATION_GRANTED',
                asset_id: assetId,
                asset_state_hash: 'ash',
                evidence_set_hash: 'esh',
                payload: { physical_conf_bps: 9000, narrative_conf_bps: 8000 },
              }),
            ],
          };
        }

        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    } as any;

    const pool = {
      connect: async () => fakeClient,
    } as any;

    const res = await rebuildReadModels(pool);
    expect(res.ok).toBe(true);
    expect(res.rebuilt_assets).toBe(1);

    // Sanity: we truncated and inserted into verification_cache.
    expect(calls.some((c) => c.includes('TRUNCATE TABLE verification_cache'))).toBe(true);
    expect(calls.some((c) => c.includes('INSERT INTO verification_cache'))).toBe(true);
  });
});
