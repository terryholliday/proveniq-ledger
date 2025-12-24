
import { AssetState } from './reducer';
import {
    Widget,
    WidgetTypeEnum,
    CapabilityEnum
} from '@proveniq/contracts';

export const widgetFactory = (state: AssetState): { widgets: Widget[], capabilities: CapabilityEnum[] } => {
    const widgets: Widget[] = [];
    const capabilities: CapabilityEnum[] = [];

    // 1. Provenance Timeline (Universal)
    widgets.push({
        widget_type: WidgetTypeEnum.PROVENANCE_TIMELINE,
        priority: 100,
        data: {
            events: state.timeline.map(e => ({
                occurred_at: e.occurredAt,
                title: e.title,
                description: e.description,
                actor: e.actor
            }))
        }
    });

    // 2. Anchor Capabilities
    if (state.anchor) {
        capabilities.push(CapabilityEnum.ANCHOR_SEAL);
        if (state.anchor.tempC !== undefined) capabilities.push(CapabilityEnum.ANCHOR_TEMP);

        // Temp Gauge Widget
        if (state.anchor.tempC !== undefined) {
            widgets.push({
                widget_type: WidgetTypeEnum.TEMP_GAUGE,
                priority: 10,
                data: {
                    current_temp_c: state.anchor.tempC,
                    min_temp_c: 0, // Mock
                    max_temp_c: 30, // Mock
                    is_breached: state.anchor.tempC > 30 || state.anchor.tempC < 0
                }
            });
        }
    }

    // 3. Service Capabilities
    if (state.service) {
        capabilities.push(CapabilityEnum.SERVICE_LOGS);
        widgets.push({
            widget_type: WidgetTypeEnum.SERVICE_TIMELINE,
            priority: 50,
            data: {
                last_service_at: state.service.lastServiceAt || null,
                logs: state.service.history
            }
        });
    }

    // 4. Transit Capabilities
    if (state.transit) {
        capabilities.push(CapabilityEnum.TRANSIT_CUSTODY);
        widgets.push({
            widget_type: WidgetTypeEnum.CUSTODY_STATUS,
            priority: 20, // High priority if moving
            hints: {
                label: 'Live Shipment',
                color_scheme: state.transit.status === 'DISPUTED' ? 'DANGER' : 'INFO'
            },
            data: {
                status: state.transit.status,
                current_custodian: state.transit.custodian,
                lat: state.transit.location?.lat,
                lon: state.transit.location?.lon,
                last_update: state.transit.lastUpdate
            }
        });
    }

    // 5. Capital Capabilities
    if (state.capital) {
        capabilities.push(CapabilityEnum.CAPITAL_VALUE);
        widgets.push({
            widget_type: WidgetTypeEnum.VALUATION_SUMMARY,
            priority: 10,
            data: {
                currency: state.capital.currency || 'USD',
                amount_micros: state.capital.valuationMicros!,
                valuation_date: state.capital.valuationDate!,
                confidence_score: 0.95
            }
        });
    }

    // 6. Risk (Mocked defaults for now or inferred)
    widgets.push({
        widget_type: WidgetTypeEnum.RISK_BADGE,
        priority: 5,
        data: {
            risk_tier: 'LOW',
            compliance_status: 'COMPLIANT',
            active_alerts: state.anchor?.envAlerts || 0
        }
    });
    capabilities.push(CapabilityEnum.PROTECT_RISK);

    return { widgets, capabilities };
};
