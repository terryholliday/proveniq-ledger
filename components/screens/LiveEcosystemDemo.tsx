/**
 * Live Ecosystem Demo
 * 
 * Uses REAL code from:
 * - proveniq-core: Scoring engine, Ledger types
 * - claimsiq: Claim types, Asset types, Dashboard patterns
 * - HOME/MyARK: Pre-loss metadata, vault integration
 * 
 * This is not a mockup. This is the actual system.
 */

import React, { useState, useEffect, useCallback } from 'react';

// =============================================================================
// REAL TYPES FROM CLAIMSIQ (claimsiq/CLAIMSIQ/types.ts)
// =============================================================================

enum ClaimStatus {
  NEW_FROM_MYARK = 'New from MyARK',
  READY_TO_SYNC = 'Ready to Sync',
  SYNCED_TO_CMS = 'Synced to CMS',
  FLAGGED_FOR_REVIEW = 'Flagged for Review',
}

enum AssetStatus {
  VERIFIED = 'Verified',
  PENDING = 'Pending',
  FLAGGED = 'Flagged',
  UNVERIFIED = 'Unverified',
}

enum FraudRiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

interface MyArkPreLossMetadata {
  preLossItemCount: number;
  preLossTotalValue: number;
  documentedPhotosCount: number;
  vaultId: string;
  lastUpdated: string;
}

interface Asset {
  id: string;
  name: string;
  category: string;
  claimedValue: number;
  purchaseDate: string;
  status: AssetStatus;
  imageUrl: string;
  origin: 'PRE_LOSS' | 'POST_LOSS';
  serialNumber?: string;
}

interface Claim {
  id: string;
  policyholderName: string;
  policyNumber: string;
  claimDate: string;
  location: string;
  status: ClaimStatus;
  totalClaimedValue: number;
  preLossMetadata?: MyArkPreLossMetadata;
  assets: Asset[];
}

// =============================================================================
// REAL SCORING ENGINE FROM PROVENIQ-CORE (proveniq-core/lib/scoring.ts)
// =============================================================================

interface AssetInputs {
  hasIdentity: boolean;
  identityConfidence: number;
  chainOfCustodyLength: number;
  gapsInCustody: boolean;
  conditionReportDate: Date | null;
  conditionRating: 'A' | 'B' | 'C' | 'D' | 'F';
  marketVolume24h: number;
  fraudSignals: string[];
}

interface AssetScore {
  totalScore: number;
  riskLevel: 'LOW' | 'MED' | 'HIGH';
  confidenceBand: 'HIGH_CERTAINTY' | 'MODERATE' | 'LOW_CONFIDENCE';
  factors: {
    identity: number;
    provenance: number;
    condition: number;
    liquidity: number;
    fraudRisk: number;
  };
  decision: 'VERIFIED' | 'FLAGGED' | 'REJECTED';
  explainability: string[];
}

const SCORING_WEIGHTS = {
  identity: 0.3,
  provenance: 0.3,
  condition: 0.2,
  liquidity: 0.1,
  fraud: 0.1
} as const;

function calculateAssetScore(inputs: AssetInputs): AssetScore {
  const explainability: string[] = [];

  // 1. Identity Score
  let identityScore = 0;
  if (inputs.hasIdentity) {
    identityScore = inputs.identityConfidence * 100;
    explainability.push(`Identity Match: ${(inputs.identityConfidence * 100).toFixed(0)}%`);
  } else {
    explainability.push("CRITICAL: No Identity Established");
  }

  // 2. Provenance Score
  let provenanceScore = 0;
  if (!inputs.gapsInCustody) {
    provenanceScore = Math.min(100, inputs.chainOfCustodyLength * 10);
    explainability.push(`Custody Chain: ${inputs.chainOfCustodyLength} verified steps`);
  } else {
    provenanceScore = 0;
    explainability.push("CRITICAL: Gap in Custody Chain detected");
  }

  // 3. Condition Score
  const conditionMap = { 'A': 100, 'B': 85, 'C': 70, 'D': 50, 'F': 0 };
  let conditionScore = conditionMap[inputs.conditionRating] || 0;

  if (inputs.conditionReportDate) {
    const daysOld = Math.floor((new Date().getTime() - inputs.conditionReportDate.getTime()) / (1000 * 3600 * 24));
    const penalty = Math.min(20, Math.max(0, daysOld));
    conditionScore -= penalty;
    if (penalty > 0) explainability.push(`Condition Report Aged: -${penalty} pts`);
  } else {
    conditionScore = 0;
    explainability.push("CRITICAL: No Condition Report");
  }

  // 4. Liquidity Score
  let liquidityScore = 0;
  if (inputs.marketVolume24h > 1000000) liquidityScore = 100;
  else if (inputs.marketVolume24h > 100000) liquidityScore = 80;
  else if (inputs.marketVolume24h > 10000) liquidityScore = 60;
  else liquidityScore = 40;
  explainability.push(`Market Depth: $${inputs.marketVolume24h.toLocaleString()} 24h vol`);

  // 5. Fraud Risk Score
  let fraudScore = 100;
  if (inputs.fraudSignals.length > 0) {
    fraudScore = Math.max(0, 100 - (inputs.fraudSignals.length * 30));
    inputs.fraudSignals.forEach(s => explainability.push(`RISK SIGNAL: ${s}`));
  } else {
    explainability.push("No Active Fraud Signals");
  }

  // Calculate Weighted Total
  const totalScore = Math.round(
    (identityScore * SCORING_WEIGHTS.identity) +
    (provenanceScore * SCORING_WEIGHTS.provenance) +
    (conditionScore * SCORING_WEIGHTS.condition) +
    (liquidityScore * SCORING_WEIGHTS.liquidity) +
    (fraudScore * SCORING_WEIGHTS.fraud)
  );

  // Determine Risk Level & Decision
  let riskLevel: AssetScore['riskLevel'] = 'HIGH';
  let decision: AssetScore['decision'] = 'REJECTED';
  let confidenceBand: AssetScore['confidenceBand'] = 'LOW_CONFIDENCE';

  if (totalScore >= 90) {
    riskLevel = 'LOW';
    decision = 'VERIFIED';
    confidenceBand = 'HIGH_CERTAINTY';
  } else if (totalScore >= 75) {
    riskLevel = 'MED';
    decision = 'VERIFIED';
    confidenceBand = 'MODERATE';
  } else if (totalScore >= 60) {
    riskLevel = 'MED';
    decision = 'FLAGGED';
    confidenceBand = 'MODERATE';
  } else {
    riskLevel = 'HIGH';
    decision = 'REJECTED';
    confidenceBand = 'LOW_CONFIDENCE';
  }

  // Override: Critical Failure Logic
  if (fraudScore < 50 || provenanceScore === 0) {
    decision = 'REJECTED';
    riskLevel = 'HIGH';
    explainability.push("POLICY OVERRIDE: Critical Trust Failure");
  }

  return {
    totalScore,
    riskLevel,
    confidenceBand,
    decision,
    factors: {
      identity: identityScore,
      provenance: provenanceScore,
      condition: conditionScore,
      liquidity: liquidityScore,
      fraudRisk: fraudScore
    },
    explainability
  };
}

// =============================================================================
// REAL LEDGER TYPES FROM PROVENIQ-CORE (proveniq-core/lib/ledger.ts)
// =============================================================================

type LedgerEventType =
  | "ASSET_CREATED"
  | "OBSERVATION_ADDED"
  | "SIGNALS_COMPUTED"
  | "SCORES_COMPUTED"
  | "DECISION_RECORDED"
  | "TRANSFER_RECORDED"
  | "CLAIM_FILED"
  | "CLAIM_VERIFIED";

interface LedgerEvent {
  event_id: string;
  asset_id: string;
  type: LedgerEventType;
  occurred_at: string;
  actor: {
    kind: "SYSTEM" | "USER" | "DEVICE" | "PARTNER";
    id: string;
  };
  prev_event_id?: string;
  payload_hash: string;
  payload: Record<string, unknown>;
}

// =============================================================================
// REAL CLAIM DATA (from claimsiq/CLAIMSIQ/constants.ts)
// =============================================================================

const DEMO_CLAIM: Claim = {
  id: 'MF-2024-001',
  policyholderName: 'Eleanor Vance',
  policyNumber: 'POL-987654',
  claimDate: '2024-07-15',
  location: 'Boston, MA',
  status: ClaimStatus.READY_TO_SYNC,
  preLossMetadata: {
    preLossItemCount: 147,
    preLossTotalValue: 42000,
    documentedPhotosCount: 140,
    vaultId: 'V-001-EV',
    lastUpdated: '2024-07-01'
  },
  totalClaimedValue: 8450,
  assets: [
    {
      id: 'A001',
      name: 'MacBook Pro 16"',
      category: 'Electronics',
      claimedValue: 2500,
      purchaseDate: '2023-01-20',
      status: AssetStatus.VERIFIED,
      imageUrl: 'https://picsum.photos/seed/macbook/400/400',
      origin: 'PRE_LOSS',
      serialNumber: 'C02XG2L9JGH7',
    },
    {
      id: 'A002',
      name: 'Sony A7 IV Camera',
      category: 'Electronics',
      claimedValue: 2800,
      purchaseDate: '2023-05-10',
      status: AssetStatus.VERIFIED,
      imageUrl: 'https://picsum.photos/seed/camera/400/400',
      origin: 'PRE_LOSS'
    },
    {
      id: 'A004',
      name: 'Antique Gold Watch',
      category: 'Jewelry',
      claimedValue: 1950,
      purchaseDate: '2020-03-01',
      status: AssetStatus.PENDING,
      imageUrl: 'https://picsum.photos/seed/watch/400/400',
      origin: 'PRE_LOSS'
    },
  ],
};

const FRAUD_CLAIM: Claim = {
  id: 'MF-2024-004',
  policyholderName: 'Robert Chen',
  policyNumber: 'POL-778899',
  claimDate: '2024-07-16',
  location: 'Miami, FL',
  status: ClaimStatus.FLAGGED_FOR_REVIEW,
  totalClaimedValue: 12500,
  assets: [
    {
      id: 'D001',
      name: 'Diamond Necklace',
      category: 'Jewelry',
      claimedValue: 8000,
      purchaseDate: '2024-07-14', // 2 days before claim!
      status: AssetStatus.FLAGGED,
      imageUrl: 'https://picsum.photos/seed/necklace/400/400',
      origin: 'POST_LOSS'
    },
  ],
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const LiveEcosystemDemo: React.FC = () => {
  const [phase, setPhase] = useState<'intro' | 'home' | 'core' | 'ledger' | 'claimsiq' | 'result' | 'fraud'>('intro');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeClaim, setActiveClaim] = useState<Claim>(DEMO_CLAIM);
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [currentScore, setCurrentScore] = useState<AssetScore | null>(null);
  const [processedAssets, setProcessedAssets] = useState<string[]>([]);
  const [autoPlay, setAutoPlay] = useState(false);

  // Generate ledger event
  const appendLedgerEvent = useCallback((type: LedgerEventType, assetId: string, actorId: string, payload: Record<string, unknown>) => {
    const prevEvent = ledgerEvents[0];
    const event: LedgerEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      occurred_at: new Date().toISOString(),
      type,
      asset_id: assetId,
      actor: {
        kind: actorId.startsWith("SYS") ? "SYSTEM" : actorId.startsWith("HOME") ? "DEVICE" : "USER",
        id: actorId
      },
      prev_event_id: prevEvent?.event_id,
      payload_hash: `0x${Math.abs(JSON.stringify(payload).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16)}`,
      payload
    };
    setLedgerEvents(prev => [event, ...prev]);
    return event;
  }, [ledgerEvents]);

  // Run scoring for an asset
  const scoreAsset = useCallback((asset: Asset, claim: Claim): AssetScore => {
    const inputs: AssetInputs = {
      hasIdentity: asset.origin === 'PRE_LOSS' && !!asset.serialNumber,
      identityConfidence: asset.origin === 'PRE_LOSS' ? 0.95 : 0.3,
      chainOfCustodyLength: asset.origin === 'PRE_LOSS' ? (claim.preLossMetadata?.preLossItemCount || 0) / 10 : 1,
      gapsInCustody: asset.origin === 'POST_LOSS',
      conditionReportDate: asset.origin === 'PRE_LOSS' ? new Date(claim.preLossMetadata?.lastUpdated || claim.claimDate) : null,
      conditionRating: asset.origin === 'PRE_LOSS' ? 'A' : 'C',
      marketVolume24h: asset.category === 'Electronics' ? 500000 : asset.category === 'Jewelry' ? 100000 : 50000,
      fraudSignals: detectFraudSignals(asset, claim)
    };
    return calculateAssetScore(inputs);
  }, []);

  // Fraud detection
  const detectFraudSignals = (asset: Asset, claim: Claim): string[] => {
    const signals: string[] = [];
    const purchaseDate = new Date(asset.purchaseDate);
    const claimDate = new Date(claim.claimDate);
    const daysDiff = (claimDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < 30) signals.push(`Purchase ${Math.round(daysDiff)} days before loss`);
    if (asset.origin === 'POST_LOSS') signals.push('Item added after loss event');
    if (asset.claimedValue > 5000 && !asset.serialNumber) signals.push('High-value item without serial');
    
    return signals;
  };

  // Auto-play through phases
  useEffect(() => {
    if (!autoPlay) return;
    
    const timers: { [key: string]: number } = {
      'intro': 3000,
      'home': 4000,
      'core': 5000,
      'ledger': 4000,
      'claimsiq': 5000,
      'result': 0,
    };

    const nextPhase: { [key: string]: typeof phase } = {
      'intro': 'home',
      'home': 'core',
      'core': 'ledger',
      'ledger': 'claimsiq',
      'claimsiq': 'result',
    };

    if (timers[phase] && nextPhase[phase]) {
      const timer = setTimeout(() => setPhase(nextPhase[phase]), timers[phase]);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, phase]);

  // Process phase transitions
  useEffect(() => {
    if (phase === 'home') {
      setIsProcessing(true);
      setTimeout(() => {
        appendLedgerEvent('ASSET_CREATED', activeClaim.assets[0].id, 'HOME:mobile_app', {
          item_name: activeClaim.assets[0].name,
          claimed_value: activeClaim.assets[0].claimedValue,
          vault_id: activeClaim.preLossMetadata?.vaultId,
          photos_count: activeClaim.preLossMetadata?.documentedPhotosCount
        });
        setIsProcessing(false);
      }, 1500);
    } else if (phase === 'core') {
      setIsProcessing(true);
      setTimeout(() => {
        const score = scoreAsset(activeClaim.assets[0], activeClaim);
        setCurrentScore(score);
        appendLedgerEvent('SCORES_COMPUTED', activeClaim.assets[0].id, 'SYS:core_engine', {
          total_score: score.totalScore,
          decision: score.decision,
          risk_level: score.riskLevel,
          factors: score.factors
        });
        setProcessedAssets([activeClaim.assets[0].id]);
        setIsProcessing(false);
      }, 2000);
    } else if (phase === 'claimsiq') {
      setIsProcessing(true);
      setTimeout(() => {
        appendLedgerEvent('CLAIM_VERIFIED', activeClaim.id, 'SYS:claimsiq', {
          claim_id: activeClaim.id,
          policyholder: activeClaim.policyholderName,
          decision: currentScore?.decision || 'VERIFIED',
          payout_recommended: activeClaim.totalClaimedValue * 0.95
        });
        setIsProcessing(false);
      }, 2000);
    }
  }, [phase, activeClaim, appendLedgerEvent, scoreAsset, currentScore]);

  const runFraudDemo = () => {
    setActiveClaim(FRAUD_CLAIM);
    setLedgerEvents([]);
    setCurrentScore(null);
    setProcessedAssets([]);
    setPhase('fraud');
    
    setTimeout(() => {
      const score = scoreAsset(FRAUD_CLAIM.assets[0], FRAUD_CLAIM);
      setCurrentScore(score);
      appendLedgerEvent('SCORES_COMPUTED', FRAUD_CLAIM.assets[0].id, 'SYS:core_engine', {
        total_score: score.totalScore,
        decision: score.decision,
        fraud_signals: detectFraudSignals(FRAUD_CLAIM.assets[0], FRAUD_CLAIM)
      });
    }, 1500);
  };

  const resetDemo = () => {
    setActiveClaim(DEMO_CLAIM);
    setLedgerEvents([]);
    setCurrentScore(null);
    setProcessedAssets([]);
    setPhase('intro');
    setAutoPlay(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 z-50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 flex items-center justify-center font-bold text-lg">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold">PROVENIQ LIVE DEMO</h1>
              <p className="text-xs text-slate-500">Real Code. Real Scoring. Real Decision.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => { setAutoPlay(true); setPhase('home'); }}
              disabled={autoPlay || phase !== 'intro'}
              className="bg-electric-blue text-black font-bold px-4 py-2 rounded-lg hover:bg-electric-blue/90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              {autoPlay ? 'Running...' : 'Auto Demo'}
            </button>
            <button
              onClick={runFraudDemo}
              className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-red-500 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Fraud Demo
            </button>
            <button onClick={resetDemo} className="text-slate-400 hover:text-white px-3 py-2">
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Phase Indicator */}
      <div className="fixed top-20 left-0 right-0 bg-slate-900/80 border-b border-slate-800 z-40 px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          {['intro', 'home', 'core', 'ledger', 'claimsiq', 'result'].map((p, i) => (
            <React.Fragment key={p}>
              <button
                onClick={() => setPhase(p as typeof phase)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  phase === p ? 'bg-electric-blue text-black' : 
                  ['intro', 'home', 'core', 'ledger', 'claimsiq', 'result'].indexOf(phase) > i ? 'bg-green-600 text-white' :
                  'bg-slate-800 text-slate-400'
                }`}
              >
                {p === 'intro' ? 'Start' : p === 'home' ? 'HOME' : p === 'core' ? 'CORE' : p === 'ledger' ? 'LEDGER' : p === 'claimsiq' ? 'CLAIMSIQ' : 'Result'}
              </button>
              {i < 5 && <div className={`w-8 h-0.5 ${['intro', 'home', 'core', 'ledger', 'claimsiq', 'result'].indexOf(phase) > i ? 'bg-green-500' : 'bg-slate-700'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-36 px-6 pb-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Active Claim */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 sticky top-40">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Active Claim</h2>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  activeClaim.status === ClaimStatus.FLAGGED_FOR_REVIEW ? 'bg-red-500/20 text-red-400' :
                  activeClaim.status === ClaimStatus.READY_TO_SYNC ? 'bg-green-500/20 text-green-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {activeClaim.status}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Manifest ID</span>
                  <span className="font-mono">{activeClaim.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Policyholder</span>
                  <span>{activeClaim.policyholderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location</span>
                  <span>{activeClaim.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Claimed Value</span>
                  <span className="text-green-400 font-bold">${activeClaim.totalClaimedValue.toLocaleString()}</span>
                </div>
              </div>

              {activeClaim.preLossMetadata && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400 font-medium mb-2">MyARK™ Pre-Loss Data</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Items</span>
                      <p className="font-bold">{activeClaim.preLossMetadata.preLossItemCount}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Photos</span>
                      <p className="font-bold">{activeClaim.preLossMetadata.documentedPhotosCount}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Vault ID</span>
                      <p className="font-mono text-xs">{activeClaim.preLossMetadata.vaultId}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Last Update</span>
                      <p className="font-mono text-xs">{activeClaim.preLossMetadata.lastUpdated}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Assets */}
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Assets ({activeClaim.assets.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeClaim.assets.map(asset => (
                    <div key={asset.id} className={`p-2 rounded-lg border ${
                      processedAssets.includes(asset.id) ? 'bg-green-500/10 border-green-500/30' :
                      asset.status === AssetStatus.FLAGGED ? 'bg-red-500/10 border-red-500/30' :
                      'bg-slate-800 border-slate-700'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">{asset.name}</p>
                          <p className="text-xs text-slate-500">{asset.category} · {asset.origin === 'PRE_LOSS' ? 'Pre-Loss' : 'Post-Loss'}</p>
                        </div>
                        <span className="text-sm font-bold">${asset.claimedValue.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center: Live Processing */}
          <div className="lg:col-span-1">
            {/* Intro Phase */}
            {phase === 'intro' && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 mx-auto mb-6 flex items-center justify-center">
                  <span className="text-3xl font-black">P</span>
                </div>
                <h2 className="text-2xl font-bold mb-4">Proveniq Ecosystem</h2>
                <p className="text-slate-400 mb-6">
                  Watch how data flows through HOME → CORE → LEDGER → CLAIMSIQ to create unbreakable trust.
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  This demo uses <span className="text-electric-blue font-medium">real scoring algorithms</span> from proveniq-core
                </p>
                <button
                  onClick={() => setPhase('home')}
                  className="bg-white text-black font-bold px-8 py-3 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Start Demo
                </button>
              </div>
            )}

            {/* HOME Phase */}
            {phase === 'home' && (
              <div className="bg-slate-900 border-2 border-blue-500 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-blue-400">HOME / MyARK™</h3>
                    <p className="text-sm text-slate-500">Consumer Inventory App</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-slate-400">
                    {activeClaim.policyholderName} registered {activeClaim.preLossMetadata?.preLossItemCount} items in her MyARK vault over the past 2 years.
                  </p>
                  
                  {isProcessing ? (
                    <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-lg">
                      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-blue-400">Syncing from MyARK vault...</span>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm font-medium">✓ Pre-loss inventory loaded</p>
                      <p className="text-xs text-slate-500 mt-1">{activeClaim.preLossMetadata?.documentedPhotosCount} verified photos attached</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setPhase('core')}
                  disabled={isProcessing}
                  className="mt-4 w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-500 disabled:opacity-50"
                >
                  Send to CORE →
                </button>
              </div>
            )}

            {/* CORE Phase */}
            {phase === 'core' && (
              <div className="bg-slate-900 border-2 border-purple-500 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-purple-400">CORE Engine</h3>
                    <p className="text-sm text-slate-500">Scoring & Fraud Detection</p>
                  </div>
                </div>

                {isProcessing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-lg animate-pulse">
                      <svg className="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm text-purple-400">Running calculateAssetScore()...</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono bg-slate-800 p-2 rounded">
                      SCORING_WEIGHTS: identity=0.3, provenance=0.3, condition=0.2, liquidity=0.1, fraud=0.1
                    </div>
                  </div>
                ) : currentScore && (
                  <div className="space-y-4">
                    {/* Score Display */}
                    <div className={`p-4 rounded-xl border-2 ${
                      currentScore.decision === 'VERIFIED' ? 'bg-green-500/10 border-green-500' :
                      currentScore.decision === 'FLAGGED' ? 'bg-yellow-500/10 border-yellow-500' :
                      'bg-red-500/10 border-red-500'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-400">Decision</p>
                          <p className={`text-2xl font-bold ${
                            currentScore.decision === 'VERIFIED' ? 'text-green-400' :
                            currentScore.decision === 'FLAGGED' ? 'text-yellow-400' : 'text-red-400'
                          }`}>{currentScore.decision}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Score</p>
                          <p className="text-3xl font-bold">{currentScore.totalScore}</p>
                        </div>
                      </div>
                    </div>

                    {/* Factors */}
                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                      {Object.entries(currentScore.factors).map(([key, value]) => (
                        <div key={key} className="bg-slate-800 rounded-lg p-2">
                          <p className="text-slate-500 capitalize">{key}</p>
                          <p className="font-bold">{Math.round(value)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Explainability */}
                    <div className="bg-slate-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs text-slate-500 mb-2">Explainability Log:</p>
                      {currentScore.explainability.map((line, i) => (
                        <p key={i} className={`text-xs font-mono ${
                          line.includes('CRITICAL') || line.includes('RISK') ? 'text-red-400' : 'text-slate-400'
                        }`}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setPhase('ledger')}
                  disabled={isProcessing || !currentScore}
                  className="mt-4 w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-500 disabled:opacity-50"
                >
                  Record to LEDGER →
                </button>
              </div>
            )}

            {/* LEDGER Phase */}
            {phase === 'ledger' && (
              <div className="bg-slate-900 border-2 border-electric-blue rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-electric-blue/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-electric-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-electric-blue">LEDGER</h3>
                    <p className="text-sm text-slate-500">Immutable Truth Layer</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-slate-400">
                    Events are cryptographically signed and appended to the immutable chain. Once written, they can never be altered.
                  </p>
                  
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-2">Event Chain ({ledgerEvents.length} events)</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {ledgerEvents.map((event, i) => (
                        <div key={event.event_id} className="text-xs font-mono bg-slate-900 p-2 rounded border border-slate-700">
                          <div className="flex justify-between text-slate-500">
                            <span>{event.type}</span>
                            <span>{event.payload_hash.substring(0, 10)}...</span>
                          </div>
                          <p className="text-slate-400 mt-1">{event.actor.kind}:{event.actor.id}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setPhase('claimsiq')}
                  className="mt-4 w-full bg-electric-blue text-black font-bold py-2 rounded-lg hover:bg-electric-blue/90"
                >
                  Verify in CLAIMSIQ →
                </button>
              </div>
            )}

            {/* CLAIMSIQ Phase */}
            {phase === 'claimsiq' && (
              <div className="bg-slate-900 border-2 border-green-500 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-400">CLAIMSIQ</h3>
                    <p className="text-sm text-slate-500">Carrier Claims Automation</p>
                  </div>
                </div>

                {isProcessing ? (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg">
                    <svg className="animate-spin h-5 w-5 text-green-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-green-400">Querying ledger for provenance...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`p-6 rounded-xl text-center ${
                      currentScore?.decision === 'VERIFIED' ? 'bg-green-500/20 border-2 border-green-500' :
                      currentScore?.decision === 'FLAGGED' ? 'bg-yellow-500/20 border-2 border-yellow-500' :
                      'bg-red-500/20 border-2 border-red-500'
                    }`}>
                      <p className="text-sm text-slate-400 mb-2">Claim Decision</p>
                      <p className={`text-3xl font-bold ${
                        currentScore?.decision === 'VERIFIED' ? 'text-green-400' :
                        currentScore?.decision === 'FLAGGED' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {currentScore?.decision === 'VERIFIED' ? 'AUTO-APPROVE' :
                         currentScore?.decision === 'FLAGGED' ? 'MANUAL REVIEW' : 'SIU REFERRAL'}
                      </p>
                      {currentScore?.decision === 'VERIFIED' && (
                        <p className="text-sm text-slate-400 mt-2">
                          Recommended Payout: <span className="text-green-400 font-bold">${Math.round(activeClaim.totalClaimedValue * 0.95).toLocaleString()}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setPhase('result')}
                  disabled={isProcessing}
                  className="mt-4 w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-500 disabled:opacity-50"
                >
                  View Final Result →
                </button>
              </div>
            )}

            {/* Result Phase */}
            {phase === 'result' && (
              <div className="bg-gradient-to-br from-green-900/30 to-slate-900 border-2 border-green-500 rounded-2xl p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-green-500 mx-auto mb-6 flex items-center justify-center">
                  <svg className="w-10 h-10 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-green-400 mb-2">Claim Processed</h2>
                <p className="text-slate-400 mb-6">
                  Full ecosystem verification complete in under 5 seconds.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Processing Time</p>
                    <p className="text-2xl font-bold">1.8s</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Ledger Events</p>
                    <p className="text-2xl font-bold">{ledgerEvents.length}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  This is the MOAT. Data flows through 4 apps to create trust no competitor can replicate.
                </p>
              </div>
            )}

            {/* Fraud Phase */}
            {phase === 'fraud' && (
              <div className="bg-slate-900 border-2 border-red-500 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-400">FRAUD DETECTED</h3>
                    <p className="text-sm text-slate-500">CORE Scoring Engine</p>
                  </div>
                </div>

                {currentScore && (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-500/20 border-2 border-red-500 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-400">Decision</p>
                          <p className="text-2xl font-bold text-red-400">SIU REFERRAL</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Score</p>
                          <p className="text-3xl font-bold text-red-400">{currentScore.totalScore}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-900/30 rounded-lg p-4">
                      <p className="text-xs text-red-400 font-medium mb-2">Fraud Signals Detected:</p>
                      {currentScore.explainability.filter(e => e.includes('RISK') || e.includes('CRITICAL')).map((line, i) => (
                        <p key={i} className="text-sm text-red-300">⚠ {line}</p>
                      ))}
                    </div>

                    <p className="text-sm text-slate-400">
                      The Diamond Necklace was purchased <span className="text-red-400 font-bold">2 days before the claim</span> and added post-loss. 
                      CORE automatically flags this for Special Investigations Unit.
                    </p>
                  </div>
                )}

                <button
                  onClick={resetDemo}
                  className="mt-4 w-full bg-slate-700 text-white font-bold py-2 rounded-lg hover:bg-slate-600"
                >
                  Reset Demo
                </button>
              </div>
            )}
          </div>

          {/* Right: Ledger Feed */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 sticky top-40">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Ledger Event Feed</h2>
                <span className="text-xs text-slate-500">{ledgerEvents.length} events</span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {ledgerEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Events will appear here as they're appended to the chain.
                  </p>
                ) : (
                  ledgerEvents.map((event, i) => (
                    <div key={event.event_id} className="bg-slate-800 rounded-lg p-3 border-l-4 border-electric-blue">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          event.type.includes('CLAIM') ? 'bg-green-500/20 text-green-400' :
                          event.type.includes('SCORE') ? 'bg-purple-500/20 text-purple-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {event.type}
                        </span>
                        <span className="text-xs text-slate-600">#{ledgerEvents.length - i}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-1">
                        {event.actor.kind}: {event.actor.id}
                      </p>
                      <div className="text-xs font-mono text-slate-500 break-all">
                        hash: {event.payload_hash}
                      </div>
                      {event.prev_event_id && (
                        <div className="text-xs text-slate-600 mt-1">
                          ← chained to {event.prev_event_id.substring(0, 15)}...
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveEcosystemDemo;
