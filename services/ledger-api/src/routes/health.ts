/**
 * Health Router
 * GET /health - Health check and chain stats
 */

import { Router, Request, Response } from 'express';
import { ledgerStore } from '../store/ledgerStore.js';

export const healthRouter = Router();

/**
 * GET /health
 * Health check endpoint
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  const stats = ledgerStore.getStats();
  const integrity = ledgerStore.verifyIntegrity();

  res.json({
    status: 'healthy',
    service: 'proveniq-ledger-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    chain: {
      totalEvents: stats.totalEvents,
      totalItems: stats.totalItems,
      totalWallets: stats.totalWallets,
      lastHash: stats.lastHash,
      sequence: stats.sequence,
      integrityValid: integrity.valid,
    },
  });
});

/**
 * GET /health/integrity
 * Full chain integrity verification
 */
healthRouter.get('/integrity', (_req: Request, res: Response) => {
  const integrity = ledgerStore.verifyIntegrity();

  res.json({
    success: true,
    data: {
      valid: integrity.valid,
      errors: integrity.errors,
      checkedAt: new Date().toISOString(),
    },
  });
});
