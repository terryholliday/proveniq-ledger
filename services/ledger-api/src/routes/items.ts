/**
 * Items Router
 * GET /v1/ledger/items/:itemId/events - Get item event history
 * GET /v1/ledger/items/:itemId/custody - Get item custody state
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ledgerStore } from '../store/ledgerStore.js';
import { createApiError } from '../middleware/errorHandler.js';

export const itemsRouter = Router();

/**
 * GET /v1/ledger/items/:itemId/events
 * Get all events for a specific item
 */
itemsRouter.get('/:itemId/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;
    const { limit = '100', offset = '0' } = req.query;

    const events = ledgerStore.getItemEvents(itemId);
    
    if (events.length === 0) {
      throw createApiError('ITEM_NOT_FOUND', `No events found for item ${itemId}`);
    }

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    const paginatedEvents = events.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: {
        itemId,
        events: paginatedEvents,
        total: events.length,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/ledger/items/:itemId/custody
 * Get current custody state for an item
 */
itemsRouter.get('/:itemId/custody', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;

    const custody = ledgerStore.getCustodyState(itemId);
    
    // Default to HOME if no custody record exists
    const custodyData = custody || {
      itemId,
      currentState: 'HOME',
      walletId: null,
      lastUpdated: null,
      transitionHistory: [],
    };

    res.json({
      success: true,
      data: { custody: custodyData },
    });
  } catch (error) {
    next(error);
  }
});
