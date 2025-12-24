
import { describe, it, expect, vi } from 'vitest';
import { resolveAssetProfile } from '../src/aggregator/resolver';
import { ViewFilterEnum, WidgetTypeEnum } from '@proveniq/contracts';

// Mock Ledger Client
const mockEvents = [
    {
        event_type: 'ANCHOR_REGISTERED',
        occurred_at: '2025-01-01T10:00:00Z',
        producer: 'anchor-gateway',
        subject: { anchor_id: 'ANCHOR-1', asset_id: 'ASSET-123' },
        payload: { summary: 'Anchor Registered' }
    },
    {
        event_type: 'ANCHOR_SEAL_ARMED',
        occurred_at: '2025-01-01T10:05:00Z',
        producer: 'anchor-gateway',
        subject: { anchor_id: 'ANCHOR-1' },
        payload: { seal_id: 'SEAL-001' }
    },
    {
        event_type: 'TRANSIT_STATE_CHANGED',
        occurred_at: '2025-01-02T08:00:00Z',
        producer: 'proveniq-transit',
        subject: { asset_id: 'ASSET-123' },
        payload: { new_state: 'IN_TRANSIT', custodian: 'Driver Bob', geo: { lat: 37, lon: -122 } }
    }
];

vi.mock('@proveniq/ledger-client', () => {
    return {
        createLedgerClient: () => ({
            getAssetEvents: async () => ({
                asset_id: 'ASSET-123',
                events: mockEvents,
                total: 3
            })
        })
    };
});

describe('Universal Asset Aggregator', () => {
    it('should resolve a valid profile from events', async () => {
        const profile = await resolveAssetProfile('ASSET-123');

        expect(profile.asset_id).toBe('ASSET-123');
        expect(profile.widgets.length).toBeGreaterThan(0);

        // Check Anchor Data
        expect(profile.capabilities).toContain('ANCHOR_SEAL');

        // Check Transit Data
        const custody = profile.widgets.find(w => w.widget_type === WidgetTypeEnum.CUSTODY_STATUS);
        expect(custody).toBeDefined();
        expect(custody?.data.status).toBe('IN_TRANSIT');
        expect(custody?.data.current_custodian).toBe('Driver Bob');
    });

    it('should filter widgets based on View', async () => {
        const profile = await resolveAssetProfile('ASSET-123', ViewFilterEnum.HOME);

        // Home view allows PROVENANCE, TEMP, RISK
        // Should NOT have SERVICE (unless filtering logic changed) or CUSTODY (Wait behavior check)
        // My resolver logic said Home = PROVENANCE, TEMP, RISK

        const custody = profile.widgets.find(w => w.widget_type === WidgetTypeEnum.CUSTODY_STATUS);
        expect(custody).toBeUndefined(); // Filtered out

        const timeline = profile.widgets.find(w => w.widget_type === WidgetTypeEnum.PROVENANCE_TIMELINE);
        expect(timeline).toBeDefined();
    });

    it('should be deterministic', async () => {
        const p1 = await resolveAssetProfile('ASSET-123');
        const p2 = await resolveAssetProfile('ASSET-123');

        // Ignore generated_at timestamp
        const { generated_at: t1, ...rest1 } = p1;
        const { generated_at: t2, ...rest2 } = p2;

        expect(rest1).toEqual(rest2);
    });
});
