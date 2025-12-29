/**
 * Cross-App Event Bus - Webhook Subscription and Delivery
 * 
 * Provides pub/sub pattern for cross-app event distribution:
 * - Apps subscribe to event types via webhooks
 * - Events are delivered with retry logic
 * - Dead letter queue for failed deliveries
 */

import { pool } from './db.js';
import { randomUUID } from 'crypto';

export interface Subscription {
  id: string;
  subscriber_id: string;      // App identifier (e.g., 'claimsiq', 'bids')
  webhook_url: string;        // URL to deliver events to
  event_types: string[];      // Event types to subscribe to (empty = all)
  source_filter: string[];    // Filter by source (empty = all)
  secret: string;             // Webhook signing secret
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_id: string;
  status: 'pending' | 'delivered' | 'failed' | 'dead_letter';
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
}

// Initialize event bus tables
export async function initEventBusTables() {
  // Subscriptions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_subscriptions (
      id UUID PRIMARY KEY,
      subscriber_id TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      event_types TEXT[] DEFAULT '{}',
      source_filter TEXT[] DEFAULT '{}',
      secret TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(subscriber_id, webhook_url)
    );
    
    CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON event_subscriptions(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON event_subscriptions(active);
  `);

  // Webhook deliveries table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY,
      subscription_id UUID NOT NULL REFERENCES event_subscriptions(id),
      event_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      last_attempt_at TIMESTAMPTZ,
      next_retry_at TIMESTAMPTZ,
      last_error TEXT,
      response_status INT,
      response_body TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    CREATE INDEX IF NOT EXISTS idx_deliveries_subscription ON webhook_deliveries(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON webhook_deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE status = 'pending';
  `);

  // Dead letter queue
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dead_letter_queue (
      id UUID PRIMARY KEY,
      delivery_id UUID NOT NULL,
      subscription_id UUID NOT NULL,
      event_id UUID NOT NULL,
      event_data JSONB NOT NULL,
      failure_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    CREATE INDEX IF NOT EXISTS idx_dlq_subscription ON dead_letter_queue(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_dlq_created_at ON dead_letter_queue(created_at);
  `);
}

// Create a new subscription
export async function createSubscription(
  subscriberId: string,
  webhookUrl: string,
  eventTypes: string[] = [],
  sourceFilter: string[] = [],
  secret?: string
): Promise<Subscription> {
  const id = randomUUID();
  const webhookSecret = secret || randomUUID().replace(/-/g, '');
  
  const result = await pool.query(
    `INSERT INTO event_subscriptions (id, subscriber_id, webhook_url, event_types, source_filter, secret)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (subscriber_id, webhook_url) DO UPDATE SET
       event_types = $4,
       source_filter = $5,
       active = true,
       updated_at = now()
     RETURNING *`,
    [id, subscriberId, webhookUrl, eventTypes, sourceFilter, webhookSecret]
  );
  
  return result.rows[0];
}

// Get subscription by ID
export async function getSubscription(id: string): Promise<Subscription | null> {
  const result = await pool.query(
    `SELECT * FROM event_subscriptions WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// List subscriptions for a subscriber
export async function listSubscriptions(subscriberId?: string): Promise<Subscription[]> {
  if (subscriberId) {
    const result = await pool.query(
      `SELECT * FROM event_subscriptions WHERE subscriber_id = $1 ORDER BY created_at DESC`,
      [subscriberId]
    );
    return result.rows;
  }
  
  const result = await pool.query(
    `SELECT * FROM event_subscriptions ORDER BY created_at DESC`
  );
  return result.rows;
}

// Deactivate a subscription
export async function deactivateSubscription(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE event_subscriptions SET active = false, updated_at = now() WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// Delete a subscription
export async function deleteSubscription(id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM event_subscriptions WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// Get matching subscriptions for an event
export async function getMatchingSubscriptions(
  eventType: string,
  source: string
): Promise<Subscription[]> {
  const result = await pool.query(
    `SELECT * FROM event_subscriptions 
     WHERE active = true
       AND (cardinality(event_types) = 0 OR $1 = ANY(event_types))
       AND (cardinality(source_filter) = 0 OR $2 = ANY(source_filter))`,
    [eventType, source]
  );
  return result.rows;
}

// Queue webhook delivery
export async function queueDelivery(
  subscriptionId: string,
  eventId: string
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO webhook_deliveries (id, subscription_id, event_id, status, next_retry_at)
     VALUES ($1, $2, $3, 'pending', now())`,
    [id, subscriptionId, eventId]
  );
  return id;
}

// Get pending deliveries for processing
export async function getPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
  const result = await pool.query(
    `SELECT * FROM webhook_deliveries 
     WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= now())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// Calculate next retry time with exponential backoff
function calculateNextRetry(attempts: number): Date {
  const baseDelay = 60; // 1 minute
  const maxDelay = 3600 * 24; // 24 hours max
  const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
  return new Date(Date.now() + delay * 1000);
}

// Update delivery status
export async function updateDeliveryStatus(
  deliveryId: string,
  status: 'delivered' | 'failed' | 'pending',
  error?: string,
  responseStatus?: number,
  responseBody?: string
): Promise<void> {
  const delivery = await pool.query(
    `SELECT * FROM webhook_deliveries WHERE id = $1`,
    [deliveryId]
  );
  
  if (!delivery.rows[0]) return;
  
  const currentAttempts = delivery.rows[0].attempts + 1;
  const maxAttempts = 5;
  
  if (status === 'failed' && currentAttempts >= maxAttempts) {
    // Move to dead letter queue
    await pool.query(
      `UPDATE webhook_deliveries SET 
         status = 'dead_letter', 
         attempts = $2, 
         last_attempt_at = now(),
         last_error = $3,
         response_status = $4,
         response_body = $5
       WHERE id = $1`,
      [deliveryId, currentAttempts, error, responseStatus, responseBody]
    );
    
    // Add to DLQ
    const dlqId = randomUUID();
    const eventData = await pool.query(
      `SELECT le.* FROM ledger_entries le 
       JOIN webhook_deliveries wd ON wd.event_id = le.id 
       WHERE wd.id = $1`,
      [deliveryId]
    );
    
    await pool.query(
      `INSERT INTO dead_letter_queue (id, delivery_id, subscription_id, event_id, event_data, failure_reason)
       SELECT $1, $2, subscription_id, event_id, $3, $4 FROM webhook_deliveries WHERE id = $2`,
      [dlqId, deliveryId, eventData.rows[0] || {}, error]
    );
  } else if (status === 'failed') {
    // Schedule retry
    const nextRetry = calculateNextRetry(currentAttempts);
    await pool.query(
      `UPDATE webhook_deliveries SET 
         status = 'pending', 
         attempts = $2, 
         last_attempt_at = now(),
         next_retry_at = $3,
         last_error = $4,
         response_status = $5,
         response_body = $6
       WHERE id = $1`,
      [deliveryId, currentAttempts, nextRetry, error, responseStatus, responseBody]
    );
  } else {
    // Delivered successfully
    await pool.query(
      `UPDATE webhook_deliveries SET 
         status = $2, 
         attempts = $3, 
         last_attempt_at = now(),
         response_status = $4,
         response_body = $5
       WHERE id = $1`,
      [deliveryId, status, currentAttempts, responseStatus, responseBody]
    );
  }
}

// Sign webhook payload
export function signWebhookPayload(payload: string, secret: string): string {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Deliver webhook to subscriber
export async function deliverWebhook(
  delivery: WebhookDelivery,
  subscription: Subscription,
  eventData: Record<string, unknown>
): Promise<{ success: boolean; error?: string; status?: number }> {
  const payload = JSON.stringify({
    event_id: delivery.event_id,
    subscription_id: delivery.subscription_id,
    timestamp: new Date().toISOString(),
    data: eventData,
  });
  
  const signature = signWebhookPayload(payload, subscription.secret);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(subscription.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proveniq-Signature': signature,
        'X-Proveniq-Timestamp': new Date().toISOString(),
        'X-Proveniq-Subscription-Id': subscription.id,
      },
      body: payload,
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    const responseText = await response.text().catch(() => '');
    
    if (response.ok) {
      await updateDeliveryStatus(delivery.id, 'delivered', undefined, response.status, responseText);
      return { success: true, status: response.status };
    } else {
      await updateDeliveryStatus(
        delivery.id, 
        'failed', 
        `HTTP ${response.status}: ${responseText.slice(0, 500)}`,
        response.status,
        responseText.slice(0, 1000)
      );
      return { success: false, error: `HTTP ${response.status}`, status: response.status };
    }
  } catch (err: any) {
    await updateDeliveryStatus(delivery.id, 'failed', err.message);
    return { success: false, error: err.message };
  }
}

// Process pending webhook deliveries
export async function processDeliveries(limit: number = 50): Promise<{ processed: number; delivered: number; failed: number }> {
  const pending = await getPendingDeliveries(limit);
  let delivered = 0;
  let failed = 0;
  
  for (const delivery of pending) {
    const subscription = await getSubscription(delivery.subscription_id);
    if (!subscription || !subscription.active) {
      await updateDeliveryStatus(delivery.id, 'failed', 'Subscription not found or inactive');
      failed++;
      continue;
    }
    
    const eventResult = await pool.query(
      `SELECT * FROM ledger_entries WHERE id = $1`,
      [delivery.event_id]
    );
    
    if (!eventResult.rows[0]) {
      await updateDeliveryStatus(delivery.id, 'failed', 'Event not found');
      failed++;
      continue;
    }
    
    const result = await deliverWebhook(delivery, subscription, eventResult.rows[0]);
    if (result.success) {
      delivered++;
    } else {
      failed++;
    }
  }
  
  return { processed: pending.length, delivered, failed };
}

// Get dead letter queue entries
export async function getDeadLetterQueue(
  subscriberId?: string,
  limit: number = 100
): Promise<any[]> {
  if (subscriberId) {
    const result = await pool.query(
      `SELECT dlq.*, es.subscriber_id, es.webhook_url 
       FROM dead_letter_queue dlq
       JOIN event_subscriptions es ON es.id = dlq.subscription_id
       WHERE es.subscriber_id = $1
       ORDER BY dlq.created_at DESC
       LIMIT $2`,
      [subscriberId, limit]
    );
    return result.rows;
  }
  
  const result = await pool.query(
    `SELECT dlq.*, es.subscriber_id, es.webhook_url 
     FROM dead_letter_queue dlq
     JOIN event_subscriptions es ON es.id = dlq.subscription_id
     ORDER BY dlq.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// Retry dead letter queue entry
export async function retryDeadLetter(dlqId: string): Promise<boolean> {
  const dlqEntry = await pool.query(
    `SELECT * FROM dead_letter_queue WHERE id = $1`,
    [dlqId]
  );
  
  if (!dlqEntry.rows[0]) return false;
  
  const { subscription_id, event_id } = dlqEntry.rows[0];
  
  // Create new delivery
  await queueDelivery(subscription_id, event_id);
  
  // Remove from DLQ
  await pool.query(`DELETE FROM dead_letter_queue WHERE id = $1`, [dlqId]);
  
  return true;
}

// Get delivery stats
export async function getDeliveryStats(): Promise<{
  pending: number;
  delivered: number;
  failed: number;
  dead_letter: number;
  subscriptions_active: number;
}> {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'dead_letter') as dead_letter
    FROM webhook_deliveries
  `);
  
  const subs = await pool.query(`
    SELECT COUNT(*) as active FROM event_subscriptions WHERE active = true
  `);
  
  return {
    ...stats.rows[0],
    subscriptions_active: parseInt(subs.rows[0].active),
  };
}
