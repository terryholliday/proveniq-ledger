/**
 * Integration Layer - Barrel Export
 * 
 * Central export for all INTER_APP_CONTRACT compliant services.
 * Import from here to access integration functionality.
 */

export * from '../custodyService';
export * from '../idempotencyService';
export * from '../eventBusService';
export * from '../integrationLayerService';
export * from '../../types/integration';

// Re-export services as named objects for convenience
export { CustodyService } from '../custodyService';
export { IdempotencyService } from '../idempotencyService';
export { EventBusService } from '../eventBusService';
export { IntegrationLayerService } from '../integrationLayerService';
