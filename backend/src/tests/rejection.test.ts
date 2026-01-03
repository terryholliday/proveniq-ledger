import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { SCHEMA_VERSION } from '../ledger.events.js';

// Mock DB and Auth
vi.mock('../db', () => ({
    initDb: vi.fn(),
    pool: {
        query: vi.fn().mockImplementation((query, values) => {
            // Mock getLatestEntry
            if (query.includes('ORDER BY sequence_number DESC LIMIT 1')) {
                return { rows: [{ sequence_number: 1, entry_hash: 'genesis' }] };
            }
            // Mock idempotency check
            if (query.includes('WHERE idempotency_key = $1')) {
                return { rows: [] };
            }
            // Mock Insert
            if (query.includes('INSERT INTO ledger_entries')) {
                return { rows: [{ id: 'mock-id', sequence_number: 2, created_at: new Date().toISOString() }] };
            }
            return { rows: [] };
        }),
    }
}));

vi.mock('../auth', () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next()
}));

describe('Ledger Strictness Tests', () => {
    it('should reject unknown event types with 400', async () => {
        const res = await request(app)
            .post('/api/v1/events/canonical')
            .send({
                schema_version: SCHEMA_VERSION,
                event_type: 'INVALID_EVENT_TYPE',
                correlation_id: '123e4567-e89b-12d3-a456-426614174000',
                idempotency_key: 'test-key-1',
                producer: 'core',
                producer_version: '1.0.0',
                subject: { asset_id: '123e4567-e89b-12d3-a456-426614174000' },
                payload: {},
                occurred_at: new Date().toISOString(),
                signatures: {},
                canonical_hash_hex: 'a'.repeat(64)
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_EVENT_TYPE');
    });

    it('should reject unsupported schema versions with 400', async () => {
        const res = await request(app)
            .post('/api/v1/events/canonical')
            .send({
                schema_version: '9.9.9',
                event_type: 'CORE_ASSET_REGISTERED',
                correlation_id: '123e4567-e89b-12d3-a456-426614174000',
                idempotency_key: 'test-key-2',
                producer: 'core',
                producer_version: '1.0.0',
                subject: { asset_id: '123e4567-e89b-12d3-a456-426614174000' },
                payload: {},
                occurred_at: new Date().toISOString(),
                signatures: {},
                canonical_hash_hex: 'a'.repeat(64)
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('UNSUPPORTED_SCHEMA_VERSION');
    });
});
