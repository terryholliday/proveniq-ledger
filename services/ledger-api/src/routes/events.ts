/**
 * Events Router
 * POST /v1/ledger/events - Append new event
 * GET /v1/ledger/events/:eventId - Get specific event
 */

import { Router, Response, NextFunction } from 'express';
import { ledgerStore } from '../store/ledgerStore.js';
import { createApiError } from '../middleware/errorHandler.js';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth.js';

export const eventsRouter = Router();

/**
 * POST /v1/ledger/events
 * Append a new event to the ledger
 */
eventsRouter.post(
  '/',
  authenticate,
  requirePermission('events:write'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
    const { itemId, walletId, eventType, payload, custodyState } = req.body;

    // Validate required fields
    if (!itemId || !walletId || !eventType || !payload) {
      throw createApiError('INVALID_PAYLOAD', 'Missing required fields: itemId, walletId, eventType, payload');
    }

    // Append event
    const result = ledgerStore.appendEvent({
      itemId,
      walletId,
      eventType,
      payload,
      idempotencyKey,
      custodyState,
    });

    if (!result.success) {
      throw createApiError(
        result.errorCode as 'INVALID_CUSTODY_TRANSITION',
        result.error || 'Failed to append event'
      );
    }

    // Publish event to event bus (simulated)
    console.log('[EVENT_BUS] Publishing ledger.event.appended:', {
      eventId: result.event!.eventId,
      itemId: result.event!.itemId,
      eventType: result.event!.eventType,
    });

    res.status(201).json({
      success: true,
      data: {
        event: result.event,
        chainPosition: result.event!.sequence,
        previousHash: result.event!.previousHash,
        hash: result.event!.hash,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/ledger/events/:eventId
 * Get a specific event by ID
 */
eventsRouter.get(
  '/:eventId',
  authenticate,
  requirePermission('events:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;

    const event = ledgerStore.getEvent(eventId);
    if (!event) {
      throw createApiError('EVENT_NOT_FOUND', `Event ${eventId} not found`);
    }

    res.json({
      success: true,
      data: { event },
    });
  } catch (error) {
    next(error);
  }
});
