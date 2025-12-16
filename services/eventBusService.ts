/**
 * Event Bus Service
 * 
 * Implements INTER_APP_CONTRACT Section 3: Event Bus Topics
 * 
 * LEDGER responsibilities:
 * - MUST consume ALL events and append to hash chain
 * - MUST publish ledger.event.appended on every append
 * 
 * In production, this would connect to Kafka/Pub-Sub.
 * Current implementation uses in-memory queue for demonstration.
 */

import {
  EventBusTopic,
  EventBusMessage,
  SourceApp,
  LedgerEventAppendedPayload,
} from '../types/integration';

// =============================================================================
// TYPES
// =============================================================================

type EventHandler<T = unknown> = (event: EventBusMessage<T>) => Promise<void>;

interface Subscription {
  topic: EventBusTopic;
  handler: EventHandler;
  subscriberId: string;
}

// =============================================================================
// IN-MEMORY EVENT BUS (Replace with Kafka/Pub-Sub in production)
// =============================================================================

const subscriptions: Subscription[] = [];
const eventLog: EventBusMessage[] = []; // For debugging/audit
const MAX_LOG_SIZE = 1000;

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Subscribe to an event topic
 */
export function subscribe<T = unknown>(
  topic: EventBusTopic,
  handler: EventHandler<T>,
  subscriberId: string
): () => void {
  const subscription: Subscription = {
    topic,
    handler: handler as EventHandler,
    subscriberId,
  };
  
  subscriptions.push(subscription);
  
  console.log(`[EventBus] ${subscriberId} subscribed to ${topic}`);
  
  // Return unsubscribe function
  return () => {
    const index = subscriptions.indexOf(subscription);
    if (index > -1) {
      subscriptions.splice(index, 1);
      console.log(`[EventBus] ${subscriberId} unsubscribed from ${topic}`);
    }
  };
}

/**
 * Publish an event to a topic
 */
export async function publish<T = unknown>(
  topic: EventBusTopic,
  event: EventBusMessage<T>
): Promise<void> {
  // Log event
  eventLog.push(event as EventBusMessage);
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.shift();
  }
  
  console.log(`[EventBus] Publishing ${topic}:`, event.eventId);
  
  // Find all subscribers for this topic
  const topicSubscriptions = subscriptions.filter(s => s.topic === topic);
  
  // Execute handlers (in production, this would be async message delivery)
  const results = await Promise.allSettled(
    topicSubscriptions.map(sub => sub.handler(event as EventBusMessage))
  );
  
  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `[EventBus] Handler failed for ${topicSubscriptions[index].subscriberId}:`,
        result.reason
      );
    }
  });
}

/**
 * Publish ledger.event.appended (convenience method)
 */
export async function publishLedgerEventAppended(
  payload: LedgerEventAppendedPayload,
  walletId: string,
  correlationId: string,
  itemId?: string
): Promise<void> {
  const event: EventBusMessage<LedgerEventAppendedPayload> = {
    eventId: `bus_${payload.eventId}`,
    eventType: 'ledger.event.appended',
    timestamp: new Date().toISOString(),
    walletId,
    itemId,
    payload,
    correlationId,
    version: '1.0',
    sourceApp: 'LEDGER',
  };
  
  await publish('ledger.event.appended', event);
}

/**
 * Get all subscriptions (for monitoring)
 */
export function getSubscriptions(): { topic: EventBusTopic; subscriberId: string }[] {
  return subscriptions.map(s => ({
    topic: s.topic,
    subscriberId: s.subscriberId,
  }));
}

/**
 * Get recent events (for debugging)
 */
export function getRecentEvents(limit = 50): EventBusMessage[] {
  return eventLog.slice(-limit);
}

/**
 * Get events by topic
 */
export function getEventsByTopic(topic: EventBusTopic, limit = 50): EventBusMessage[] {
  return eventLog
    .filter(e => e.eventType === topic)
    .slice(-limit);
}

// =============================================================================
// LEDGER-SPECIFIC: Subscribe to ALL events
// Per contract, LEDGER must consume ALL events
// =============================================================================

const ALL_TOPICS: EventBusTopic[] = [
  'identity.created',
  'genome.generated',
  'genome.verified',
  'custody.changed',
  'loan.created',
  'loan.defaulted',
  'auction.listed',
  'auction.settled',
  'claim.created',
  'claim.settled',
  'score.updated',
  'fraud.flagged',
];

/**
 * Initialize LEDGER as consumer of all events
 * This should be called on application startup
 */
export function initializeLedgerSubscriptions(
  appendEventHandler: (event: EventBusMessage) => Promise<void>
): void {
  ALL_TOPICS.forEach(topic => {
    subscribe(topic, appendEventHandler, 'LEDGER');
  });
  
  console.log('[EventBus] LEDGER subscribed to all required topics');
}

// =============================================================================
// EXPORT
// =============================================================================

export const EventBusService = {
  subscribe,
  publish,
  publishLedgerEventAppended,
  getSubscriptions,
  getRecentEvents,
  getEventsByTopic,
  initializeLedgerSubscriptions,
  ALL_TOPICS,
};

export default EventBusService;
