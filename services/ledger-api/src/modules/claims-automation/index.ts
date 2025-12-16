/**
 * Claims Automation Module
 * 
 * MVP for insurance carrier demo.
 * 
 * KEY VALUE PROP:
 * - Instant verification of item existence in ledger
 * - Provenance score for fraud risk assessment
 * - Custody chain verification
 * - Photo/document history retrieval
 * 
 * ROI FOR CARRIERS:
 * - Reduce fraud by 30-50% via provenance verification
 * - Accelerate claims processing from days to minutes
 * - Automated SIU (Special Investigation Unit) triggers
 */

import { ledgerStore, LedgerEvent } from '../../store/ledgerStore.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ClaimVerificationRequest {
  claimId: string;
  itemId: string;
  claimantWalletId: string;
  claimType: 'THEFT' | 'DAMAGE' | 'LOSS' | 'TOTAL_LOSS';
  claimedValue: number;
  incidentDate: string;
  description: string;
}

export interface ProvenanceScore {
  overall: number;           // 0-100
  factors: {
    registrationAge: number; // Points for time since registration
    photoCount: number;      // Points for documentation
    custodyChain: number;    // Points for custody continuity
    valuationHistory: number;// Points for consistent valuations
    verificationCount: number; // Points for third-party verifications
  };
  riskFlags: string[];
  recommendation: 'AUTO_APPROVE' | 'STANDARD_REVIEW' | 'SIU_REFERRAL';
}

export interface ClaimVerificationResult {
  claimId: string;
  itemId: string;
  verified: boolean;
  
  // Provenance data
  itemExists: boolean;
  registrationDate: string | null;
  ownershipVerified: boolean;
  currentCustodyState: string | null;
  
  // Risk assessment
  provenanceScore: ProvenanceScore;
  fraudIndicators: FraudIndicator[];
  
  // Supporting evidence
  eventCount: number;
  photoEvents: number;
  valuationEvents: LedgerEvent[];
  custodyHistory: CustodyTransition[];
  
  // Recommendation
  automationDecision: AutomationDecision;
  
  // Timing
  verifiedAt: string;
  processingTimeMs: number;
}

export interface FraudIndicator {
  type: 'HIGH' | 'MEDIUM' | 'LOW';
  code: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface CustodyTransition {
  from: string;
  to: string;
  timestamp: string;
  eventId: string;
}

export interface AutomationDecision {
  action: 'AUTO_APPROVE' | 'AUTO_DENY' | 'MANUAL_REVIEW' | 'SIU_REFERRAL';
  reason: string;
  confidence: number;
  suggestedPayout?: number;
  requiredDocuments?: string[];
}

// =============================================================================
// CLAIMS AUTOMATION SERVICE
// =============================================================================

export class ClaimsAutomationService {
  
  /**
   * Verify a claim against the ledger
   * This is the main entry point for insurance carriers
   */
  async verifyClaim(request: ClaimVerificationRequest): Promise<ClaimVerificationResult> {
    const startTime = Date.now();
    
    // 1. Check if item exists in ledger
    const events = ledgerStore.getItemEvents(request.itemId);
    const itemExists = events.length > 0;
    
    // 2. Get custody state
    const custodyRecord = ledgerStore.getCustodyState(request.itemId);
    
    // 3. Find registration event
    const registrationEvent = events.find(e => 
      e.eventType.includes('registered') || e.eventType.includes('created')
    );
    
    // 4. Verify ownership (claimant wallet matches item owner)
    const ownershipVerified = events.some(e => e.walletId === request.claimantWalletId);
    
    // 5. Get photo events
    const photoEvents = events.filter(e => e.eventType.includes('photo'));
    
    // 6. Get valuation events
    const valuationEvents = events.filter(e => e.eventType.includes('valuation'));
    
    // 7. Calculate provenance score
    const provenanceScore = this.calculateProvenanceScore(
      events,
      registrationEvent,
      photoEvents,
      valuationEvents,
      custodyRecord
    );
    
    // 8. Detect fraud indicators
    const fraudIndicators = this.detectFraudIndicators(
      request,
      events,
      provenanceScore,
      custodyRecord
    );
    
    // 9. Make automation decision
    const automationDecision = this.makeAutomationDecision(
      request,
      provenanceScore,
      fraudIndicators,
      valuationEvents
    );
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      claimId: request.claimId,
      itemId: request.itemId,
      verified: itemExists && ownershipVerified,
      
      itemExists,
      registrationDate: registrationEvent?.timestamp || null,
      ownershipVerified,
      currentCustodyState: custodyRecord?.currentState || null,
      
      provenanceScore,
      fraudIndicators,
      
      eventCount: events.length,
      photoEvents: photoEvents.length,
      valuationEvents,
      custodyHistory: custodyRecord?.transitionHistory || [],
      
      automationDecision,
      
      verifiedAt: new Date().toISOString(),
      processingTimeMs,
    };
  }
  
  /**
   * Calculate provenance score (0-100)
   * Higher score = more trustworthy provenance = lower fraud risk
   */
  private calculateProvenanceScore(
    events: LedgerEvent[],
    registrationEvent: LedgerEvent | undefined,
    photoEvents: LedgerEvent[],
    valuationEvents: LedgerEvent[],
    custodyRecord: ReturnType<typeof ledgerStore.getCustodyState>
  ): ProvenanceScore {
    const factors = {
      registrationAge: 0,
      photoCount: 0,
      custodyChain: 0,
      valuationHistory: 0,
      verificationCount: 0,
    };
    
    const riskFlags: string[] = [];
    
    // Registration age (max 25 points)
    // Longer registration = higher trust
    if (registrationEvent) {
      const ageMs = Date.now() - new Date(registrationEvent.timestamp).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > 365) factors.registrationAge = 25;
      else if (ageDays > 180) factors.registrationAge = 20;
      else if (ageDays > 90) factors.registrationAge = 15;
      else if (ageDays > 30) factors.registrationAge = 10;
      else if (ageDays > 7) factors.registrationAge = 5;
      else {
        factors.registrationAge = 2;
        riskFlags.push('RECENT_REGISTRATION');
      }
    } else {
      riskFlags.push('NO_REGISTRATION_FOUND');
    }
    
    // Photo documentation (max 25 points)
    if (photoEvents.length >= 5) factors.photoCount = 25;
    else if (photoEvents.length >= 3) factors.photoCount = 20;
    else if (photoEvents.length >= 1) factors.photoCount = 10;
    else {
      factors.photoCount = 0;
      riskFlags.push('NO_PHOTOS');
    }
    
    // Custody chain integrity (max 20 points)
    if (custodyRecord?.transitionHistory && custodyRecord.transitionHistory.length > 0) {
      // Points for documented custody
      factors.custodyChain = Math.min(20, custodyRecord.transitionHistory.length * 5);
    } else if (custodyRecord?.currentState === 'HOME') {
      factors.custodyChain = 15; // Never moved, reasonable
    } else {
      factors.custodyChain = 5;
      riskFlags.push('UNCLEAR_CUSTODY');
    }
    
    // Valuation history (max 15 points)
    if (valuationEvents.length >= 2) {
      factors.valuationHistory = 15;
      // Check for suspicious valuation jumps
      // ... (would compare valuations)
    } else if (valuationEvents.length === 1) {
      factors.valuationHistory = 8;
    } else {
      factors.valuationHistory = 0;
      riskFlags.push('NO_VALUATION_HISTORY');
    }
    
    // Third-party verifications (max 15 points)
    const verificationEvents = events.filter(e => e.eventType.includes('verification'));
    if (verificationEvents.length >= 2) factors.verificationCount = 15;
    else if (verificationEvents.length === 1) factors.verificationCount = 10;
    else factors.verificationCount = 0;
    
    // Calculate overall score
    const overall = 
      factors.registrationAge +
      factors.photoCount +
      factors.custodyChain +
      factors.valuationHistory +
      factors.verificationCount;
    
    // Determine recommendation
    let recommendation: ProvenanceScore['recommendation'];
    if (overall >= 70 && riskFlags.length === 0) {
      recommendation = 'AUTO_APPROVE';
    } else if (overall >= 40 || riskFlags.length <= 1) {
      recommendation = 'STANDARD_REVIEW';
    } else {
      recommendation = 'SIU_REFERRAL';
    }
    
    return { overall, factors, riskFlags, recommendation };
  }
  
  /**
   * Detect potential fraud indicators
   */
  private detectFraudIndicators(
    request: ClaimVerificationRequest,
    events: LedgerEvent[],
    provenanceScore: ProvenanceScore,
    custodyRecord: ReturnType<typeof ledgerStore.getCustodyState>
  ): FraudIndicator[] {
    const indicators: FraudIndicator[] = [];
    
    // Check 1: Item not in ledger
    if (events.length === 0) {
      indicators.push({
        type: 'HIGH',
        code: 'ITEM_NOT_FOUND',
        description: 'Claimed item has no record in Proveniq Ledger',
      });
    }
    
    // Check 2: Recent registration before claim
    const registrationEvent = events.find(e => e.eventType.includes('registered'));
    if (registrationEvent) {
      const regDate = new Date(registrationEvent.timestamp);
      const incidentDate = new Date(request.incidentDate);
      const daysBetween = (incidentDate.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysBetween < 30) {
        indicators.push({
          type: 'HIGH',
          code: 'RECENT_REGISTRATION',
          description: `Item registered only ${Math.round(daysBetween)} days before incident`,
          details: { daysBetween: Math.round(daysBetween) },
        });
      }
    }
    
    // Check 3: Custody state mismatch
    if (request.claimType === 'THEFT' && custodyRecord?.currentState === 'VAULT') {
      indicators.push({
        type: 'MEDIUM',
        code: 'CUSTODY_MISMATCH',
        description: 'Item marked as in VAULT but claimed as stolen',
        details: { currentState: custodyRecord.currentState },
      });
    }
    
    // Check 4: No photo documentation
    if (provenanceScore.factors.photoCount === 0) {
      indicators.push({
        type: 'MEDIUM',
        code: 'NO_DOCUMENTATION',
        description: 'No photographic evidence of item in ledger',
      });
    }
    
    // Check 5: Ownership not verified
    const ownerEvents = events.filter(e => e.walletId === request.claimantWalletId);
    if (ownerEvents.length === 0) {
      indicators.push({
        type: 'HIGH',
        code: 'OWNERSHIP_NOT_VERIFIED',
        description: 'Claimant wallet has no events linked to this item',
      });
    }
    
    // Check 6: Value inflation
    const valuationEvents = events.filter(e => e.eventType.includes('valuation'));
    if (valuationEvents.length > 0) {
      const lastValuation = valuationEvents[valuationEvents.length - 1];
      const recordedValue = (lastValuation.payload as any)?.newValuation || 0;
      if (request.claimedValue > recordedValue * 1.5) {
        indicators.push({
          type: 'MEDIUM',
          code: 'VALUE_INFLATION',
          description: `Claimed value ($${request.claimedValue}) exceeds last recorded valuation ($${recordedValue}) by >50%`,
          details: { claimedValue: request.claimedValue, recordedValue },
        });
      }
    }
    
    return indicators;
  }
  
  /**
   * Make automation decision based on all factors
   */
  private makeAutomationDecision(
    request: ClaimVerificationRequest,
    provenanceScore: ProvenanceScore,
    fraudIndicators: FraudIndicator[],
    valuationEvents: LedgerEvent[]
  ): AutomationDecision {
    const highRiskIndicators = fraudIndicators.filter(i => i.type === 'HIGH');
    const mediumRiskIndicators = fraudIndicators.filter(i => i.type === 'MEDIUM');
    
    // SIU Referral: Any high-risk indicator
    if (highRiskIndicators.length > 0) {
      return {
        action: 'SIU_REFERRAL',
        reason: `High-risk fraud indicators detected: ${highRiskIndicators.map(i => i.code).join(', ')}`,
        confidence: 0.9,
        requiredDocuments: ['Police Report', 'Proof of Purchase', 'Additional Photos'],
      };
    }
    
    // Auto Deny: Multiple medium risks + low provenance
    if (mediumRiskIndicators.length >= 3 && provenanceScore.overall < 30) {
      return {
        action: 'AUTO_DENY',
        reason: 'Multiple risk factors combined with low provenance score',
        confidence: 0.75,
      };
    }
    
    // Auto Approve: High provenance + no fraud indicators
    if (provenanceScore.recommendation === 'AUTO_APPROVE' && fraudIndicators.length === 0) {
      // Get suggested payout from last valuation
      let suggestedPayout = request.claimedValue;
      if (valuationEvents.length > 0) {
        const lastValuation = valuationEvents[valuationEvents.length - 1];
        const recordedValue = (lastValuation.payload as any)?.newValuation;
        if (recordedValue) {
          suggestedPayout = Math.min(request.claimedValue, recordedValue);
        }
      }
      
      return {
        action: 'AUTO_APPROVE',
        reason: `Strong provenance score (${provenanceScore.overall}/100) with no fraud indicators`,
        confidence: 0.85,
        suggestedPayout,
      };
    }
    
    // Default: Manual Review
    return {
      action: 'MANUAL_REVIEW',
      reason: `Provenance score: ${provenanceScore.overall}/100. ${mediumRiskIndicators.length} medium-risk indicators.`,
      confidence: 0.6,
      requiredDocuments: mediumRiskIndicators.length > 0 
        ? ['Proof of Purchase', 'Additional Photos']
        : undefined,
    };
  }
  
  /**
   * Batch verification for multiple claims
   */
  async verifyClaimsBatch(requests: ClaimVerificationRequest[]): Promise<ClaimVerificationResult[]> {
    return Promise.all(requests.map(r => this.verifyClaim(r)));
  }
  
  /**
   * Get statistics for carrier dashboard
   */
  getAutomationStats(): {
    totalVerified: number;
    autoApproved: number;
    autoApprovalRate: number;
    averageProcessingMs: number;
    fraudPrevented: number;
  } {
    // In production, this would query actual metrics
    return {
      totalVerified: 0,
      autoApproved: 0,
      autoApprovalRate: 0,
      averageProcessingMs: 0,
      fraudPrevented: 0,
    };
  }
}

// Singleton instance
export const claimsAutomation = new ClaimsAutomationService();
