
import { LedgerEvent } from '@proveniq/ledger-client';

// Internal State Representation (Not the Output Profile)
export interface AssetState {
    assetId: string;

    // Anchor State
    anchor?: {
        id: string;
        isSealed: boolean;
        sealId?: string;
        tempC?: number; // Latest
        envAlerts: number;
    };

    // Service State
    service?: {
        lastServiceAt?: string;
        history: Array<{ date: string; provider: string; notes: string }>;
    };

    // Transit State
    transit?: {
        status: 'CREATED' | 'OFFERED' | 'IN_TRANSIT' | 'DELIVERED' | 'DISPUTED' | 'CLOSED';
        custodian: string;
        location?: { lat: number; lon: number };
        lastUpdate: string;
    };

    // Protect State
    protect?: {
        riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
    };

    // Capital State
    capital?: {
        valuationMicros?: string;
        currency?: string;
        valuationDate?: string;
    };

    // Provenance
    timeline: Array<{
        occurredAt: string;
        title: string;
        description: string;
        actor: string;
        icon?: string;
    }>;
}

export const initialAssetState = (assetId: string): AssetState => ({
    assetId,
    timeline: []
});

export const assetReducer = (state: AssetState, event: LedgerEvent): AssetState => {
    // 1. Always append to timeline (filtered or summarized)
    const timelineEntry = deriveTimelineEntry(event);
    if (timelineEntry) {
        state.timeline.push(timelineEntry);
        // Keep sorted strictly? Ledger returns sorted usually.
    }

    // 2. Reduce Domain State
    switch (event.event_type) {
        // --- ANCHOR EVENTS ---
        case 'ANCHOR_REGISTERED':
            state.anchor = {
                id: event.subject.anchor_id!,
                isSealed: false,
                envAlerts: 0
            };
            break;
        case 'ANCHOR_SEAL_ARMED':
            if (state.anchor) {
                state.anchor.isSealed = true;
                state.anchor.sealId = (event.payload as any).seal_id;
            }
            break;
        case 'ANCHOR_SEAL_BROKEN':
            if (state.anchor) {
                state.anchor.isSealed = false;
            }
            break;
        case 'ANCHOR_ENVIRONMENTAL_ALERT':
            if (state.anchor) {
                state.anchor.envAlerts++;
                state.anchor.tempC = (event.payload as any).temp_c;
            }
            break;

        // --- SERVICE EVENTS ---
        case 'SERVICE_WORK_COMPLETED':
            if (!state.service) state.service = { history: [] };
            state.service.lastServiceAt = event.occurred_at;
            state.service.history.push({
                date: event.occurred_at,
                provider: event.producer, // or from payload
                notes: (event.payload as any).summary || 'Service performed'
            });
            break;

        // --- TRANSIT EVENTS ---
        case 'TRANSIT_STATE_CHANGED':
        case 'TRANSIT_HANDOFF_ACCEPTED':
            const payload = event.payload as any;
            if (!state.transit) {
                state.transit = {
                    status: payload.new_state || 'CREATED',
                    custodian: (event as any).producer, // or payload.custodian
                    lastUpdate: event.occurred_at
                };
            }
            state.transit.status = payload.new_state;
            state.transit.custodian = payload.custodian || state.transit.custodian;
            state.transit.lastUpdate = event.occurred_at;
            if (payload.geo) state.transit.location = payload.geo;
            break;

        // --- CAPITAL EVENTS ---
        case 'CAPITAL_VALUATION_RECORDED': // Hypothetical event
            state.capital = {
                valuationMicros: (event.payload as any).amount_micros,
                currency: (event.payload as any).currency,
                valuationDate: event.occurred_at
            };
            break;

        // --- PROTECT EVENTS ---
        case 'PROTECT_RISK_ASSESSED':
            // ...
            break;
    }

    return state;
};

function deriveTimelineEntry(event: LedgerEvent) {
    // Simple mapper
    return {
        occurredAt: event.occurred_at,
        title: formatTitle(event.event_type),
        description: (event.payload as any).summary || 'Event recorded on ledger',
        actor: event.producer
    };
}

function formatTitle(type: string): string {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
