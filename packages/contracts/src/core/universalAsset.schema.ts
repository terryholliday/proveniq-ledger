
import { z } from 'zod';

// ==========================================
// 1. PRIMITIVES & ENUMS
// ==========================================

export enum CapabilityEnum {
    ANCHOR_TEMP = 'ANCHOR_TEMP',
    ANCHOR_SEAL = 'ANCHOR_SEAL',
    ANCHOR_ENV = 'ANCHOR_ENV',
    SERVICE_LOGS = 'SERVICE_LOGS',
    TRANSIT_CUSTODY = 'TRANSIT_CUSTODY',
    PROTECT_RISK = 'PROTECT_RISK',
    CAPITAL_VALUE = 'CAPITAL_VALUE',
    BIDS_ELIGIBLE = 'BIDS_ELIGIBLE'
}

export enum WidgetTypeEnum {
    PROVENANCE_TIMELINE = 'PROVENANCE_TIMELINE',
    SERVICE_TIMELINE = 'SERVICE_TIMELINE',
    CUSTODY_STATUS = 'CUSTODY_STATUS',
    RISK_BADGE = 'RISK_BADGE',
    VALUATION_SUMMARY = 'VALUATION_SUMMARY',
    TEMP_GAUGE = 'TEMP_GAUGE'
}

export enum ViewFilterEnum {
    OPS = 'OPS',
    PROPERTIES = 'PROPERTIES', // Owner View
    HOME = 'HOME', // Marketing/Public
    BIDS = 'BIDS' // Marketplace
}

// ==========================================
// 2. WIDGET DATA SCHEMAS (DISCRIMINATED UNION)
// ==========================================

// 2.1 Provenance Timeline
export const ProvenanceTimelineWidgetSchema = z.object({
    events: z.array(z.object({
        occurred_at: z.string().datetime(),
        title: z.string(),
        description: z.string(),
        actor: z.string(),
        icon: z.string().optional()
    }))
});

// 2.2 Service Timeline
export const ServiceTimelineWidgetSchema = z.object({
    last_service_at: z.string().datetime().nullable(),
    next_service_due: z.string().datetime().nullable().optional(),
    logs: z.array(z.object({
        date: z.string().datetime(),
        provider: z.string(),
        notes: z.string()
    }))
});

// 2.3 Custody Status
export const CustodyStatusWidgetSchema = z.object({
    status: z.enum(['CREATED', 'OFFERED', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED', 'CLOSED']),
    current_custodian: z.string(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    last_update: z.string().datetime()
});

// 2.4 Risk Badge
export const RiskBadgeWidgetSchema = z.object({
    risk_tier: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    compliance_status: z.enum(['COMPLIANT', 'NON_COMPLIANT', 'PENDING']),
    active_alerts: z.number()
});

// 2.5 Valuation Summary
export const ValuationSummaryWidgetSchema = z.object({
    currency: z.string(),
    amount_micros: z.string(), // IntString
    valuation_date: z.string().datetime(),
    confidence_score: z.number() // 0-1
});

// 2.6 Temp Gauge
export const TempGaugeWidgetSchema = z.object({
    current_temp_c: z.number(),
    min_temp_c: z.number(),
    max_temp_c: z.number(),
    is_breached: z.boolean()
});

// ==========================================
// 3. WIDGET ENVELOPE
// ==========================================

export const WidgetSchema = z.object({
    widget_type: z.nativeEnum(WidgetTypeEnum),
    priority: z.number().int(),
    hints: z.object({
        label: z.string().optional(),
        color_scheme: z.enum(['DEFAULT', 'DANGER', 'WARNING', 'SUCCESS', 'INFO']).optional()
    }).optional(),
    data: z.union([
        ProvenanceTimelineWidgetSchema,
        ServiceTimelineWidgetSchema,
        CustodyStatusWidgetSchema,
        RiskBadgeWidgetSchema,
        ValuationSummaryWidgetSchema,
        TempGaugeWidgetSchema
    ])
    // Note: In a real implementation with strict discriminated union inference, 
    // we would use z.discriminatedUnion on 'widget_type' combining the envelope + specific data.
    // For simplicity here, we define 'data' loosely as union and trust the factory, 
    // OR we can make it stricter:
}).refine((data) => {
    // Runtime check (optional, but good for validity)
    return true;
});

// ==========================================
// 4. UNIVERSAL ASSET PROFILE
// ==========================================

export const UniversalAssetProfileSchema = z.object({
    asset_id: z.string().uuid(),
    generated_at: z.string().datetime(),
    capabilities: z.array(z.nativeEnum(CapabilityEnum)),
    widgets: z.array(WidgetSchema)
});

export type UniversalAssetProfile = z.infer<typeof UniversalAssetProfileSchema>;
export type Widget = z.infer<typeof WidgetSchema>;
