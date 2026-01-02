import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { initDb, pool } from './db.js';
import {
  initEventBusTables,
  createSubscription,
  getSubscription,
  listSubscriptions,
  deleteSubscription,
  getMatchingSubscriptions,
  queueDelivery,
  processDeliveries,
  getDeadLetterQueue,
  retryDeadLetter,
  getDeliveryStats,
} from './event-bus.js';
import { requireAuth } from './auth.js';
import { hashPayload, hashEntry, verifyPayloadHash, verifyEntryHash, verifyChainLink } from './hash.js';
import { CreateEntrySchema, QueryEntriesSchema, type LedgerEntry, type IntegrityResult, type LedgerInput } from './types.js';
import {
  LedgerEventSchema,
  LedgerInputSchema,
  safeParseLedgerEvent,
  isKnownEventType,
  isAcceptedEventType,
  getEventDomain,
  normalizeEventType,
  SCHEMA_VERSION,
  type LedgerEvent,
} from './ledger.events.js';
import { ingestCanonicalEvent } from './ingest/canonical.js';
import { validateEnvironment } from './config/env-validation.js';

dotenv.config();

// CRITICAL: Validate environment before proceeding
// This will hard-fail (exit 1) if required configuration is missing
validateEnvironment();

const app = express();
const PORT = parseInt(process.env.PORT || '8006', 10);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'proveniq-ledger',
    product_name: 'PROVENIQ Memory',
    product_key: 'memory',
    version: '0.2.0',
  });
});

// Get latest sequence number and hash (for chain linking)
async function getLatestEntry(): Promise<{ sequence_number: number; entry_hash: string } | null> {
  const result = await pool.query(
    `SELECT sequence_number, entry_hash FROM ledger_entries ORDER BY sequence_number DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

// Log audit event
async function logAudit(
  action: string,
  resourceType: string,
  resourceId: string | null,
  actorId: string | null,
  details: Record<string, unknown> | null,
  ipAddress: string | null
) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO audit_log (id, action, actor_id, resource_type, resource_id, details, ip_address) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, action, actorId, resourceType, resourceId, details, ipAddress]
  );
}

// ============================================
// CANONICAL EVENT INGESTION (v1.0.0 Schema)
// ============================================

/**
 * Ingest canonical event with strict schema validation.
 * Use this endpoint for new integrations following DOMAIN_NOUN_VERB_PAST naming.
 * 
 * CONCURRENCY: Uses advisory lock-based ingestion for hash chain integrity.
 */
app.post('/api/v1/events/canonical', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = LedgerInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'CANONICAL_SCHEMA_VIOLATION',
        message: 'Event does not match canonical envelope schema (Input)',
        details: parseResult.error.errors,
        schema_version: SCHEMA_VERSION,
      });
    }

    const event = parseResult.data;

    // ========================================================================
    // BACKWARD COMPATIBILITY: Accept legacy VERIFY_* aliases
    // Normalize to canonical EVT_* before validation and storage
    // ========================================================================
    const normalized = normalizeEventType(event.event_type);
    
    // Reject unknown event types (not canonical AND not a known alias)
    if (!isAcceptedEventType(event.event_type)) {
      console.warn(`[LEDGER] Rejected unknown event type: ${event.event_type} (domain: ${getEventDomain(event.event_type)})`);
      return res.status(400).json({
        error: 'INVALID_EVENT_TYPE',
        message: `Event type '${event.event_type}' is not a valid canonical event type.`,
        schema_version: SCHEMA_VERSION,
      });
    }
    
    // Log alias usage for migration tracking
    if (normalized.wasAliased) {
      console.info(`[LEDGER] Alias used: ${normalized.original} -> ${normalized.canonical}`);
    }

    // STRICT ENFORCEMENT: Reject unsupported schema versions
    if (event.schema_version !== SCHEMA_VERSION) {
      return res.status(400).json({
        error: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `Schema version '${event.schema_version}' is not supported. Expected: '${SCHEMA_VERSION}'.`,
      });
    }

    // Prepare input for concurrency-safe ingestion
    // CRITICAL: Store CANONICAL event type, not the alias
    const input: LedgerInput = {
      ...event,
      event_type: normalized.canonical, // Always store canonical form
      event_id: randomUUID(),
      client_id: event.producer, // Use producer as client_id for now
    };

    // CRITICAL: Use advisory lock-based ingestion
    const result = await ingestCanonicalEvent(pool, input);

    // Audit log - include original type if aliased for audit trail
    await logAudit(
      'canonical_event_ingested',
      'ledger_entry',
      input.event_id,
      null,
      {
        producer: event.producer,
        event_type: normalized.canonical,
        event_type_original: normalized.original, // null if not aliased
        schema_version: event.schema_version,
        correlation_id: event.correlation_id,
        deduped: result.deduped,
        was_aliased: normalized.wasAliased,
      },
      req.ip || null
    );

    res.status(result.deduped ? 200 : 201).json({
      event_id: input.event_id,
      sequence_number: result.sequence_number,
      entry_hash: result.entry_hash,
      committed_at: result.committed_at,
      schema_version: SCHEMA_VERSION,
      idempotent: result.deduped,
    });
  } catch (err) {
    console.error('[LEDGER] canonical ingest error', err);
    res.status(500).json({ error: 'Failed to ingest canonical event' });
  }
});

// ============================================
// LEGACY EVENT INGESTION (backward compatible)
// ============================================

app.post('/api/v1/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = CreateEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const input = parseResult.data;
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    // Calculate hashes
    const payloadHash = hashPayload(input.payload);
    const latest = await getLatestEntry();
    const previousHash = latest?.entry_hash || null;
    const entryHash = hashEntry(payloadHash, previousHash, input.source, input.event_type, timestamp);

    // Insert entry
    const result = await pool.query(
      `INSERT INTO ledger_entries 
       (id, source, event_type, correlation_id, asset_id, anchor_id, actor_id, payload, payload_hash, previous_hash, entry_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, sequence_number, created_at`,
      [
        id,
        input.source,
        input.event_type,
        input.correlation_id || null,
        input.asset_id || null,
        input.anchor_id || null,
        input.actor_id || null,
        input.payload,
        payloadHash,
        previousHash,
        entryHash,
        timestamp,
      ]
    );

    const entry = result.rows[0];

    // Audit log
    await logAudit(
      'event_ingested',
      'ledger_entry',
      id,
      input.actor_id || null,
      { source: input.source, event_type: input.event_type },
      req.ip || null
    );

    res.status(201).json({
      event_id: entry.id,
      sequence_number: entry.sequence_number,
      entry_hash: entryHash,
      created_at: entry.created_at,
    });
  } catch (err) {
    console.error('[LEDGER] ingest error', err);
    res.status(500).json({ error: 'Failed to ingest event' });
  }
});

// ============================================
// EVENT QUERIES
// ============================================

// Get single entry by ID
app.get('/api/v1/events/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `SELECT * FROM ledger_entries WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await logAudit('event_read', 'ledger_entry', id, null, null, req.ip || null);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[LEDGER] fetch error', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Query entries with filters
app.get('/api/v1/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = QueryEntriesSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parseResult.error.errors
      });
    }

    const params = parseResult.data;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.source) {
      conditions.push(`source = $${paramIndex++}`);
      values.push(params.source);
    }
    if (params.event_type) {
      conditions.push(`event_type = $${paramIndex++}`);
      values.push(params.event_type);
    }
    if (params.asset_id) {
      conditions.push(`asset_id = $${paramIndex++}`);
      values.push(params.asset_id);
    }
    if (params.anchor_id) {
      conditions.push(`anchor_id = $${paramIndex++}`);
      values.push(params.anchor_id);
    }
    if (params.correlation_id) {
      conditions.push(`correlation_id = $${paramIndex++}`);
      values.push(params.correlation_id);
    }
    if (params.from_sequence) {
      conditions.push(`sequence_number >= $${paramIndex++}`);
      values.push(params.from_sequence);
    }
    if (params.to_sequence) {
      conditions.push(`sequence_number <= $${paramIndex++}`);
      values.push(params.to_sequence);
    }
    if (params.from_date) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(params.from_date);
    }
    if (params.to_date) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(params.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM ledger_entries ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get entries
    values.push(params.limit);
    values.push(params.offset);
    const result = await pool.query(
      `SELECT * FROM ledger_entries ${whereClause} 
       ORDER BY sequence_number DESC 
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    await logAudit('events_queried', 'ledger_entry', null, null, { filters: params }, req.ip || null);

    res.json({
      events: result.rows,
      total,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (err) {
    console.error('[LEDGER] query error', err);
    res.status(500).json({ error: 'Failed to query events' });
  }
});

// Get events for specific asset
app.get('/api/v1/assets/:assetId/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT * FROM ledger_entries WHERE asset_id = $1 ORDER BY sequence_number DESC LIMIT $2 OFFSET $3`,
      [assetId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM ledger_entries WHERE asset_id = $1`,
      [assetId]
    );

    res.json({
      asset_id: assetId,
      events: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    });
  } catch (err) {
    console.error('[LEDGER] asset events error', err);
    res.status(500).json({ error: 'Failed to fetch asset events' });
  }
});

// Get events for specific anchor
app.get('/api/v1/anchors/:anchorId/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const { anchorId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT * FROM ledger_entries WHERE anchor_id = $1 ORDER BY sequence_number DESC LIMIT $2 OFFSET $3`,
      [anchorId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM ledger_entries WHERE anchor_id = $1`,
      [anchorId]
    );

    res.json({
      anchor_id: anchorId,
      events: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    });
  } catch (err) {
    console.error('[LEDGER] anchor events error', err);
    res.status(500).json({ error: 'Failed to fetch anchor events' });
  }
});

// ============================================
// INTEGRITY VERIFICATION
// ============================================

// Verify integrity of ledger chain
app.get('/api/v1/integrity/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const fromSeq = parseInt(req.query.from as string) || 1;
    const toSeq = parseInt(req.query.to as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 10000, 100000);

    let query = `SELECT * FROM ledger_entries WHERE sequence_number >= $1`;
    const values: unknown[] = [fromSeq];

    if (toSeq > 0) {
      query += ` AND sequence_number <= $2`;
      values.push(toSeq);
    }
    query += ` ORDER BY sequence_number ASC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await pool.query(query, values);
    const entries = result.rows as LedgerEntry[];

    const errors: IntegrityResult['errors'] = [];
    let previousEntry: LedgerEntry | null = null;

    // Get entry before first if not starting from 1
    if (fromSeq > 1) {
      const prevResult = await pool.query(
        `SELECT * FROM ledger_entries WHERE sequence_number = $1`,
        [fromSeq - 1]
      );
      previousEntry = prevResult.rows[0] || null;
    }

    for (const entry of entries) {
      // Verify payload hash
      if (!verifyPayloadHash(entry.payload, entry.payload_hash)) {
        errors.push({
          sequence_number: entry.sequence_number,
          error_type: 'payload_hash_mismatch',
          details: `Payload hash mismatch for entry ${entry.id}`,
        });
      }

      // Verify entry hash
      if (!verifyEntryHash(entry)) {
        errors.push({
          sequence_number: entry.sequence_number,
          error_type: 'entry_hash_mismatch',
          details: `Entry hash mismatch for entry ${entry.id}`,
        });
      }

      // Verify chain link
      if (!verifyChainLink(entry, previousEntry)) {
        errors.push({
          sequence_number: entry.sequence_number,
          error_type: 'chain_break',
          details: `Chain break at entry ${entry.id}. Expected previous_hash: ${previousEntry?.entry_hash || 'null'}, got: ${entry.previous_hash}`,
        });
      }

      previousEntry = entry;
    }

    const integrityResult: IntegrityResult = {
      valid: errors.length === 0,
      entries_checked: entries.length,
      first_sequence: entries[0]?.sequence_number || 0,
      last_sequence: entries[entries.length - 1]?.sequence_number || 0,
      errors,
      verified_at: new Date().toISOString(),
    };

    await logAudit(
      'integrity_verified',
      'ledger',
      null,
      null,
      { from: fromSeq, to: toSeq, valid: integrityResult.valid, errors_count: errors.length },
      req.ip || null
    );

    res.json(integrityResult);
  } catch (err) {
    console.error('[LEDGER] integrity verification error', err);
    res.status(500).json({ error: 'Failed to verify integrity' });
  }
});

// Get ledger stats
app.get('/api/v1/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_entries,
        MIN(sequence_number) as first_sequence,
        MAX(sequence_number) as last_sequence,
        MIN(created_at) as first_entry_at,
        MAX(created_at) as last_entry_at,
        COUNT(DISTINCT source) as unique_sources,
        COUNT(DISTINCT event_type) as unique_event_types,
        COUNT(DISTINCT asset_id) as unique_assets,
        COUNT(DISTINCT anchor_id) as unique_anchors
      FROM ledger_entries
    `);

    const sourceBreakdown = await pool.query(`
      SELECT source, COUNT(*) as count 
      FROM ledger_entries 
      GROUP BY source 
      ORDER BY count DESC
    `);

    res.json({
      ...stats.rows[0],
      by_source: sourceBreakdown.rows,
    });
  } catch (err) {
    console.error('[LEDGER] stats error', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// CROSS-APP EVENT BUS - SUBSCRIPTIONS
// ============================================

/**
 * POST /api/v1/subscriptions - Register webhook subscription
 */
app.post('/api/v1/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { subscriber_id, webhook_url, event_types, source_filter, secret } = req.body;

    if (!subscriber_id || !webhook_url) {
      return res.status(400).json({ error: 'subscriber_id and webhook_url are required' });
    }

    const subscription = await createSubscription(
      subscriber_id,
      webhook_url,
      event_types || [],
      source_filter || [],
      secret
    );

    await logAudit(
      'subscription_created',
      'event_subscription',
      subscription.id,
      subscriber_id,
      { webhook_url, event_types, source_filter },
      req.ip || null
    );

    res.status(201).json({
      id: subscription.id,
      subscriber_id: subscription.subscriber_id,
      webhook_url: subscription.webhook_url,
      event_types: subscription.event_types,
      source_filter: subscription.source_filter,
      secret: subscription.secret, // Return secret only on creation
      active: subscription.active,
      created_at: subscription.created_at,
    });
  } catch (err: any) {
    console.error('[EVENT BUS] subscription create error', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * GET /api/v1/subscriptions - List subscriptions
 */
app.get('/api/v1/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscriberId = req.query.subscriber_id as string | undefined;
    const subscriptions = await listSubscriptions(subscriberId);

    res.json({
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        subscriber_id: s.subscriber_id,
        webhook_url: s.webhook_url,
        event_types: s.event_types,
        source_filter: s.source_filter,
        active: s.active,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('[EVENT BUS] subscription list error', err);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
});

/**
 * GET /api/v1/subscriptions/:id - Get subscription details
 */
app.get('/api/v1/subscriptions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscription = await getSubscription(req.params.id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      id: subscription.id,
      subscriber_id: subscription.subscriber_id,
      webhook_url: subscription.webhook_url,
      event_types: subscription.event_types,
      source_filter: subscription.source_filter,
      active: subscription.active,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
    });
  } catch (err) {
    console.error('[EVENT BUS] subscription get error', err);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * DELETE /api/v1/subscriptions/:id - Delete subscription
 */
app.delete('/api/v1/subscriptions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteSubscription(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await logAudit(
      'subscription_deleted',
      'event_subscription',
      req.params.id,
      null,
      null,
      req.ip || null
    );

    res.status(204).send();
  } catch (err) {
    console.error('[EVENT BUS] subscription delete error', err);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

/**
 * GET /api/v1/webhooks/stats - Get delivery statistics
 */
app.get('/api/v1/webhooks/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await getDeliveryStats();
    res.json(stats);
  } catch (err) {
    console.error('[EVENT BUS] stats error', err);
    res.status(500).json({ error: 'Failed to get webhook stats' });
  }
});

/**
 * POST /api/v1/webhooks/process - Manually trigger webhook processing
 */
app.post('/api/v1/webhooks/process', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await processDeliveries(limit);
    res.json(result);
  } catch (err) {
    console.error('[EVENT BUS] process error', err);
    res.status(500).json({ error: 'Failed to process webhooks' });
  }
});

/**
 * GET /api/v1/webhooks/dead-letter - Get dead letter queue
 */
app.get('/api/v1/webhooks/dead-letter', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscriberId = req.query.subscriber_id as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const entries = await getDeadLetterQueue(subscriberId, limit);
    res.json({ entries, total: entries.length });
  } catch (err) {
    console.error('[EVENT BUS] DLQ error', err);
    res.status(500).json({ error: 'Failed to get dead letter queue' });
  }
});

/**
 * POST /api/v1/webhooks/dead-letter/:id/retry - Retry dead letter entry
 */
app.post('/api/v1/webhooks/dead-letter/:id/retry', requireAuth, async (req: Request, res: Response) => {
  try {
    const success = await retryDeadLetter(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Dead letter entry not found' });
    }
    res.json({ success: true, message: 'Queued for retry' });
  } catch (err) {
    console.error('[EVENT BUS] DLQ retry error', err);
    res.status(500).json({ error: 'Failed to retry dead letter entry' });
  }
});

// Helper function to queue events for subscriptions
async function queueEventForSubscribers(eventId: string, eventType: string, source: string) {
  try {
    const subscriptions = await getMatchingSubscriptions(eventType, source);
    for (const sub of subscriptions) {
      await queueDelivery(sub.id, eventId);
    }
    console.log(`[EVENT BUS] Queued ${subscriptions.length} deliveries for event ${eventId}`);
  } catch (err) {
    console.error('[EVENT BUS] Failed to queue event for subscribers:', err);
  }
}

// ============================================
// LEGACY ENDPOINTS (backward compatibility)
// ============================================

app.post('/v1/ledger/entries', requireAuth, async (req: Request, res: Response) => {
  // Redirect to new endpoint format
  const { app: sourceApp, event_type, payload, correlation_id } = req.body || {};
  req.body = {
    source: sourceApp,
    event_type,
    payload,
    correlation_id,
  };

  // Forward to new handler (simplified - just call the logic)
  try {
    const input = { source: sourceApp, event_type, payload, correlation_id };
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const payloadHash = hashPayload(payload);
    const latest = await getLatestEntry();
    const previousHash = latest?.entry_hash || null;
    const entryHash = hashEntry(payloadHash, previousHash, sourceApp, event_type, timestamp);

    await pool.query(
      `INSERT INTO ledger_entries 
       (id, source, event_type, correlation_id, payload, payload_hash, previous_hash, entry_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, sourceApp, event_type, correlation_id, payload, payloadHash, previousHash, entryHash, timestamp]
    );

    res.status(202).json({ id, status: 'accepted' });
  } catch (err) {
    console.error('[LEDGER] legacy ingest error', err);
    res.status(500).json({ error: 'Failed to ingest entry' });
  }
});

app.get('/v1/ledger/entries/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `SELECT id, source as app, event_type, correlation_id, payload, created_at FROM ledger_entries WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[LEDGER] legacy fetch error', err);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// ============================================
// STARTUP
// ============================================

const startServer = async () => {
  try {
    await initDb();
    await initEventBusTables();
    console.log('[LEDGER] Event Bus tables initialized');
    
    // Start background webhook processor (every 30 seconds)
    setInterval(async () => {
      try {
        const result = await processDeliveries(50);
        if (result.processed > 0) {
          console.log(`[EVENT BUS] Processed ${result.processed} deliveries: ${result.delivered} delivered, ${result.failed} failed`);
        }
      } catch (err) {
        console.error('[EVENT BUS] Background processor error:', err);
      }
    }, 30000);
    
    app.listen(PORT, () => {
      console.log(`[LEDGER] listening on port ${PORT}`);
      console.log(`[LEDGER] API: http://localhost:${PORT}/api/v1`);
      console.log(`[LEDGER] Event Bus: Webhook subscriptions enabled`);
    });
  } catch (err) {
    console.error('[LEDGER] failed to init DB', err);
    process.exit(1);
  }
};

// ESM-compatible main check
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  startServer();
}

export default app;
