/**
 * Wallets Router
 * GET /v1/ledger/wallets/:walletId/history - Get wallet event history
 */

import { Router, Response, NextFunction } from 'express';
import { ledgerStore } from '../store/ledgerStore.js';
import { createApiError } from '../middleware/errorHandler.js';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth.js';

export const walletsRouter = Router();

/**
 * GET /v1/ledger/wallets/:walletId/history
 * Get all events associated with a wallet
 */
walletsRouter.get(
  '/:walletId/history',
  authenticate,
  requirePermission('wallets:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { walletId } = req.params;
    const { limit = '100', offset = '0', eventType } = req.query;

    let events = ledgerStore.getWalletHistory(walletId);
    
    if (events.length === 0) {
      throw createApiError('WALLET_NOT_FOUND', `No events found for wallet ${walletId}`);
    }

    // Filter by event type if specified
    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    const paginatedEvents = events.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: {
        walletId,
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
