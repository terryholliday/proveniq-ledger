
import { createLedgerClient, LedgerClient } from '@proveniq/ledger-client';
import {
    UniversalAssetProfile,
    UniversalAssetProfileSchema,
    ViewFilterEnum,
    WidgetTypeEnum
} from '@proveniq/contracts';
import { config } from '../config';
import { initialAssetState, assetReducer } from './reducer';
import { widgetFactory } from './widgetFactory';

// Singleton Client
const ledger = createLedgerClient(config.ledger);

export const resolveAssetProfile = async (
    assetId: string,
    view?: ViewFilterEnum,
    cursor?: number
): Promise<UniversalAssetProfile> => {
    // 1. Fetch Events
    // Note: getAssetEvents returns { events: LedgerEvent[] } (Strict)
    const { events } = await ledger.getAssetEvents(assetId);

    if (!events || events.length === 0) {
        throw new Error(`Asset ${assetId} not found or has no history.`);
    }

    // 2. Reduce State (Replay)
    let state = initialAssetState(assetId);
    // Sort events by occurred_at/committed_at to ensure deterministic replay
    const sortedEvents = events.sort((a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

    for (const event of sortedEvents) {
        state = assetReducer(state, event);
    }

    // 3. Generate Widgets & Capabilities
    const { widgets, capabilities } = widgetFactory(state);

    // 4. Apply View Filter
    let filteredWidgets = widgets;
    if (view) {
        filteredWidgets = applyViewFilter(widgets, view);
    }

    // Sort by priority (descending)
    filteredWidgets.sort((a, b) => b.priority - a.priority);

    // 5. Construct Profile
    const profile: UniversalAssetProfile = {
        asset_id: assetId,
        generated_at: new Date().toISOString(),
        capabilities,
        widgets: filteredWidgets
    };

    // 6. Validate (Fail Loud)
    return UniversalAssetProfileSchema.parse(profile);
};

export const getRawEvents = async (assetId: string) => {
    return ledger.getAssetEvents(assetId);
};

function applyViewFilter(widgets: any[], view: ViewFilterEnum) {
    // Implement Filter Logic
    switch (view) {
        case ViewFilterEnum.HOME:
            // Show timelines + visual gauges
            return widgets.filter((w: any) =>
                [WidgetTypeEnum.PROVENANCE_TIMELINE, WidgetTypeEnum.TEMP_GAUGE, WidgetTypeEnum.RISK_BADGE].includes(w.widget_type)
            );
        case ViewFilterEnum.OPS:
            // Show Custody, Service, Temp
            return widgets.filter((w: any) =>
                [WidgetTypeEnum.CUSTODY_STATUS, WidgetTypeEnum.SERVICE_TIMELINE, WidgetTypeEnum.TEMP_GAUGE].includes(w.widget_type)
            );
        case ViewFilterEnum.PROPERTIES:
            return widgets; // All
        default:
            return widgets;
    }
}
