/**
 * Auth Routes
 * 
 * Endpoints for authentication management
 * POST /auth/token - Generate JWT token from API key
 * GET /auth/verify - Verify current authentication
 */

import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authenticate, getPartnerByApiKey, generatePartnerToken } from '../middleware/auth.js';

export const authRouter = Router();

/**
 * POST /auth/token
 * Exchange API key for JWT token
 */
authRouter.post('/token', (req: AuthenticatedRequest, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'X-API-Key header required',
      },
    });
  }
  
  const partner = getPartnerByApiKey(apiKey);
  if (!partner) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    });
  }
  
  const token = generatePartnerToken(partner.id);
  
  res.json({
    success: true,
    data: {
      token,
      expiresIn: 3600,
      tokenType: 'Bearer',
      partnerId: partner.id,
      partnerName: partner.name,
      permissions: partner.permissions,
      tier: partner.tier,
    },
  });
});

/**
 * GET /auth/verify
 * Verify current authentication and return details
 */
authRouter.get('/verify', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      authenticated: true,
      authType: req.auth?.type,
      partnerId: req.auth?.partnerId,
      partnerName: req.auth?.partnerName,
      permissions: req.auth?.permissions,
      tier: req.auth?.tier,
    },
  });
});

/**
 * GET /auth/permissions
 * List available permissions
 */
authRouter.get('/permissions', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      permissions: [
        { key: 'events:read', description: 'Read ledger events' },
        { key: 'events:write', description: 'Write ledger events' },
        { key: 'items:read', description: 'Read item data' },
        { key: 'claims:read', description: 'Read claims data' },
        { key: 'claims:verify', description: 'Verify claims against ledger' },
        { key: 'wallets:read', description: 'Read wallet history' },
        { key: 'admin:all', description: 'Full administrative access' },
      ],
      tiers: [
        { key: 'free', rateLimit: '60/min', description: 'Free tier - read only' },
        { key: 'partner', rateLimit: '600/min', description: 'Partner tier - full API access' },
        { key: 'enterprise', rateLimit: 'unlimited', description: 'Enterprise tier - unlimited' },
      ],
    },
  });
});
