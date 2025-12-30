/**
 * Claims Automation Routes
 * 
 * Endpoints for insurance carrier integration
 * POST /v1/ledger/claims/verify - Verify a single claim
 * POST /v1/ledger/claims/verify/batch - Verify multiple claims
 * GET /v1/ledger/claims/stats - Get automation statistics
 */

import { Router, Response, NextFunction } from 'express';
import { claimsAutomation, ClaimVerificationRequest } from '../modules/claims-automation/index.js';
import { createApiError } from '../middleware/errorHandler.js';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth.js';

export const claimsRouter = Router();

/**
 * POST /v1/ledger/claims/verify
 * Verify a single claim against the ledger
 */
claimsRouter.post(
  '/verify',
  authenticate,
  requirePermission('claims:verify'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const request = req.body as ClaimVerificationRequest;

    // Validate required fields
    if (!request.claimId || !request.itemId || !request.claimantWalletId) {
      throw createApiError('INVALID_PAYLOAD', 'Missing required fields: claimId, itemId, claimantWalletId');
    }

    if (!request.claimType || !['THEFT', 'DAMAGE', 'LOSS', 'TOTAL_LOSS'].includes(request.claimType)) {
      throw createApiError('INVALID_PAYLOAD', 'Invalid claimType. Must be THEFT, DAMAGE, LOSS, or TOTAL_LOSS');
    }

    const result = await claimsAutomation.verifyClaim(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/ledger/claims/verify/batch
 * Verify multiple claims in batch
 */
claimsRouter.post(
  '/verify/batch',
  authenticate,
  requirePermission('claims:verify'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { claims } = req.body as { claims: ClaimVerificationRequest[] };

    if (!claims || !Array.isArray(claims)) {
      throw createApiError('INVALID_PAYLOAD', 'Request body must contain claims array');
    }

    if (claims.length > 100) {
      throw createApiError('INVALID_PAYLOAD', 'Maximum 100 claims per batch');
    }

    const results = await claimsAutomation.verifyClaimsBatch(claims);

    res.json({
      success: true,
      data: {
        results,
        totalProcessed: results.length,
        summary: {
          autoApproved: results.filter(r => r.automationDecision.action === 'AUTO_APPROVE').length,
          manualReview: results.filter(r => r.automationDecision.action === 'MANUAL_REVIEW').length,
          siuReferral: results.filter(r => r.automationDecision.action === 'SIU_REFERRAL').length,
          autoDenied: results.filter(r => r.automationDecision.action === 'AUTO_DENY').length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/ledger/claims/stats
 * Get claims automation statistics
 */
claimsRouter.get(
  '/stats',
  authenticate,
  requirePermission('claims:read'),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = claimsAutomation.getAutomationStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/ledger/claims/item/:itemId/risk
 * Get risk assessment for a specific item
 */
claimsRouter.get(
  '/item/:itemId/risk',
  authenticate,
  requirePermission('claims:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;

    // Create a mock claim request to get risk assessment
    const mockRequest: ClaimVerificationRequest = {
      claimId: 'risk-check',
      itemId,
      claimantWalletId: 'unknown',
      claimType: 'DAMAGE',
      claimedValue: 0,
      incidentDate: new Date().toISOString(),
      description: 'Risk assessment check',
    };

    const result = await claimsAutomation.verifyClaim(mockRequest);

    res.json({
      success: true,
      data: {
        itemId,
        exists: result.itemExists,
        provenanceScore: result.provenanceScore,
        riskLevel: result.provenanceScore.overall >= 70 ? 'LOW' 
          : result.provenanceScore.overall >= 40 ? 'MEDIUM' : 'HIGH',
        eventCount: result.eventCount,
        photoCount: result.photoEvents,
        custodyState: result.currentCustodyState,
        registrationDate: result.registrationDate,
      },
    });
  } catch (error) {
    next(error);
  }
});
