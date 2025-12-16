/**
 * Insurance Demo Screen
 * 
 * Interactive demo for insurance carrier sales pitches.
 * Shows live claim verification, fraud detection, and ROI.
 */

import React, { useState } from 'react';

// Icons
const ShieldCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const ExclamationTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CurrencyDollarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Demo scenarios
const DEMO_SCENARIOS = {
  legitimate: {
    id: 'CLAIM-2025-001',
    itemId: 'item_rolex_submariner_2023',
    claimant: 'wallet_jsmith_7x9k2',
    type: 'THEFT' as const,
    claimedValue: 12500,
    description: 'Rolex Submariner stolen from home during break-in',
    // Ledger data (simulated)
    ledgerData: {
      registered: '2023-06-15',
      photoCount: 8,
      lastValuation: 12000,
      custodyState: 'HOME',
      eventCount: 12,
      verifications: 2,
    },
  },
  suspicious: {
    id: 'CLAIM-2025-002',
    itemId: 'item_diamond_ring_unknown',
    claimant: 'wallet_unknown_abc',
    type: 'THEFT' as const,
    claimedValue: 45000,
    description: 'Diamond engagement ring, 3ct, stolen from vehicle',
    ledgerData: {
      registered: '2025-01-10', // Just registered
      photoCount: 0,
      lastValuation: null,
      custodyState: null,
      eventCount: 1,
      verifications: 0,
    },
  },
  inflated: {
    id: 'CLAIM-2025-003',
    itemId: 'item_vintage_watch_1985',
    claimant: 'wallet_collector_m3n',
    type: 'DAMAGE' as const,
    claimedValue: 85000,
    description: 'Vintage Patek Philippe damaged in flood',
    ledgerData: {
      registered: '2022-03-20',
      photoCount: 15,
      lastValuation: 42000, // Half of claimed
      custodyState: 'VAULT',
      eventCount: 28,
      verifications: 3,
    },
  },
};

type ScenarioKey = keyof typeof DEMO_SCENARIOS;

interface VerificationResult {
  provenanceScore: number;
  decision: 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'SIU_REFERRAL';
  confidence: number;
  fraudIndicators: Array<{ type: 'HIGH' | 'MEDIUM' | 'LOW'; code: string; description: string }>;
  processingTime: number;
  suggestedPayout?: number;
}

const InsuranceDemoScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'demo' | 'roi' | 'compare'>('demo');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('legitimate');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  
  // ROI Calculator state
  const [annualClaims, setAnnualClaims] = useState(10000);
  const [avgClaimValue, setAvgClaimValue] = useState(5000);
  const [currentFraudRate, setCurrentFraudRate] = useState(8);

  const scenario = DEMO_SCENARIOS[selectedScenario];

  const runVerification = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const ledger = scenario.ledgerData;
    let score = 0;
    const indicators: VerificationResult['fraudIndicators'] = [];

    // Calculate score based on ledger data
    // Registration age
    const regDate = new Date(ledger.registered);
    const ageDays = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 365) score += 25;
    else if (ageDays > 90) score += 15;
    else if (ageDays > 30) score += 10;
    else {
      score += 2;
      indicators.push({ type: 'HIGH', code: 'RECENT_REGISTRATION', description: `Item registered only ${Math.round(ageDays)} days ago` });
    }

    // Photos
    if (ledger.photoCount >= 5) score += 25;
    else if (ledger.photoCount >= 2) score += 15;
    else if (ledger.photoCount >= 1) score += 8;
    else {
      indicators.push({ type: 'MEDIUM', code: 'NO_PHOTOS', description: 'No photographic documentation in ledger' });
    }

    // Valuations
    if (ledger.lastValuation) {
      score += 15;
      if (scenario.claimedValue > ledger.lastValuation * 1.5) {
        indicators.push({ 
          type: 'MEDIUM', 
          code: 'VALUE_INFLATION', 
          description: `Claimed $${scenario.claimedValue.toLocaleString()} vs recorded $${ledger.lastValuation.toLocaleString()}` 
        });
      }
    } else {
      indicators.push({ type: 'MEDIUM', code: 'NO_VALUATION', description: 'No valuation history in ledger' });
    }

    // Verifications
    if (ledger.verifications >= 2) score += 20;
    else if (ledger.verifications >= 1) score += 10;

    // Event count
    if (ledger.eventCount >= 10) score += 15;
    else if (ledger.eventCount >= 5) score += 10;
    else score += 5;

    // Determine decision
    let decision: VerificationResult['decision'];
    let confidence: number;
    let suggestedPayout: number | undefined;

    const highRisk = indicators.filter(i => i.type === 'HIGH').length;
    const mediumRisk = indicators.filter(i => i.type === 'MEDIUM').length;

    if (highRisk > 0) {
      decision = 'SIU_REFERRAL';
      confidence = 0.92;
    } else if (score >= 70 && mediumRisk === 0) {
      decision = 'AUTO_APPROVE';
      confidence = 0.88;
      suggestedPayout = ledger.lastValuation || scenario.claimedValue;
    } else {
      decision = 'MANUAL_REVIEW';
      confidence = 0.75;
    }

    setVerificationResult({
      provenanceScore: Math.min(score, 100),
      decision,
      confidence,
      fraudIndicators: indicators,
      processingTime: 1.2 + Math.random() * 0.5,
      suggestedPayout,
    });

    setIsVerifying(false);
  };

  // ROI Calculations
  const calculateROI = () => {
    const totalClaimVolume = annualClaims * avgClaimValue;
    const currentFraudLoss = totalClaimVolume * (currentFraudRate / 100);
    const proveniqFraudRate = currentFraudRate * 0.45; // 55% reduction
    const newFraudLoss = totalClaimVolume * (proveniqFraudRate / 100);
    const savedAmount = currentFraudLoss - newFraudLoss;
    const proveniqCost = annualClaims * 2.50; // $2.50 per verification
    const netSavings = savedAmount - proveniqCost;
    const roi = ((netSavings / proveniqCost) * 100);

    return {
      totalVolume: totalClaimVolume,
      currentFraudLoss,
      newFraudRate: proveniqFraudRate,
      newFraudLoss,
      savedAmount,
      proveniqCost,
      netSavings,
      roi,
    };
  };

  const roi = calculateROI();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShieldCheckIcon />
            <h1 className="text-3xl font-bold">
              <span className="text-electric-blue">PROVENIQ</span> Claims Intelligence
            </h1>
          </div>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Instant claim verification powered by immutable provenance data. 
            Reduce fraud by 55%, accelerate processing from days to seconds.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {[
            { key: 'demo', label: 'Live Demo' },
            { key: 'roi', label: 'ROI Calculator' },
            { key: 'compare', label: 'Before/After' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-electric-blue text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Demo Tab */}
        {activeTab === 'demo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Claim Input */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Incoming Claim</h2>
              
              {/* Scenario Selector */}
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-2">Select Demo Scenario:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setSelectedScenario('legitimate'); setVerificationResult(null); }}
                    className={`p-3 rounded-lg border text-sm ${
                      selectedScenario === 'legitimate'
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    ✓ Legitimate
                  </button>
                  <button
                    onClick={() => { setSelectedScenario('suspicious'); setVerificationResult(null); }}
                    className={`p-3 rounded-lg border text-sm ${
                      selectedScenario === 'suspicious'
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    ⚠ Suspicious
                  </button>
                  <button
                    onClick={() => { setSelectedScenario('inflated'); setVerificationResult(null); }}
                    className={`p-3 rounded-lg border text-sm ${
                      selectedScenario === 'inflated'
                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    $ Inflated
                  </button>
                </div>
              </div>

              {/* Claim Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Claim ID</label>
                    <div className="bg-slate-800 px-3 py-2 rounded text-sm font-mono">{scenario.id}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Claim Type</label>
                    <div className="bg-slate-800 px-3 py-2 rounded text-sm">{scenario.type}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Item ID</label>
                  <div className="bg-slate-800 px-3 py-2 rounded text-sm font-mono">{scenario.itemId}</div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Claimant Wallet</label>
                  <div className="bg-slate-800 px-3 py-2 rounded text-sm font-mono">{scenario.claimant}</div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Claimed Value</label>
                  <div className="bg-slate-800 px-3 py-2 rounded text-sm font-bold text-green-400">
                    ${scenario.claimedValue.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Description</label>
                  <div className="bg-slate-800 px-3 py-2 rounded text-sm">{scenario.description}</div>
                </div>
              </div>

              {/* Verify Button */}
              <button
                onClick={runVerification}
                disabled={isVerifying}
                className="w-full mt-6 bg-electric-blue text-slate-950 font-bold py-3 px-6 rounded-lg hover:bg-electric-blue/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying Against Ledger...
                  </span>
                ) : (
                  'Verify Claim with Proveniq'
                )}
              </button>
            </div>

            {/* Right: Verification Result */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Verification Result</h2>

              {!verificationResult && !isVerifying && (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <ShieldCheckIcon />
                    <p className="mt-2">Click "Verify Claim" to see results</p>
                  </div>
                </div>
              )}

              {isVerifying && (
                <div className="space-y-4 animate-pulse">
                  <div className="h-20 bg-slate-800 rounded-lg" />
                  <div className="h-32 bg-slate-800 rounded-lg" />
                  <div className="h-24 bg-slate-800 rounded-lg" />
                </div>
              )}

              {verificationResult && (
                <div className="space-y-4">
                  {/* Decision Banner */}
                  <div className={`p-4 rounded-lg border ${
                    verificationResult.decision === 'AUTO_APPROVE'
                      ? 'bg-green-500/10 border-green-500 text-green-400'
                      : verificationResult.decision === 'SIU_REFERRAL'
                      ? 'bg-red-500/10 border-red-500 text-red-400'
                      : 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
                  }`}>
                    <div className="flex items-center gap-3">
                      {verificationResult.decision === 'AUTO_APPROVE' && <CheckCircleIcon />}
                      {verificationResult.decision === 'SIU_REFERRAL' && <XCircleIcon />}
                      {verificationResult.decision === 'MANUAL_REVIEW' && <ClockIcon />}
                      <div>
                        <p className="font-bold text-lg">
                          {verificationResult.decision === 'AUTO_APPROVE' && 'AUTO-APPROVE'}
                          {verificationResult.decision === 'SIU_REFERRAL' && 'SIU REFERRAL'}
                          {verificationResult.decision === 'MANUAL_REVIEW' && 'MANUAL REVIEW'}
                        </p>
                        <p className="text-sm opacity-80">
                          Confidence: {(verificationResult.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    {verificationResult.suggestedPayout && (
                      <p className="mt-2 text-sm">
                        Suggested Payout: <span className="font-bold">${verificationResult.suggestedPayout.toLocaleString()}</span>
                      </p>
                    )}
                  </div>

                  {/* Provenance Score */}
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-400">Provenance Score</span>
                      <span className="font-bold text-lg">{verificationResult.provenanceScore}/100</span>
                    </div>
                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          verificationResult.provenanceScore >= 70 ? 'bg-green-500' :
                          verificationResult.provenanceScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${verificationResult.provenanceScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Ledger Data */}
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-sm text-slate-400 mb-3">Ledger Evidence</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Registered:</span>
                        <span>{scenario.ledgerData.registered}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Photos:</span>
                        <span>{scenario.ledgerData.photoCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Events:</span>
                        <span>{scenario.ledgerData.eventCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Verifications:</span>
                        <span>{scenario.ledgerData.verifications}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Valuation:</span>
                        <span>{scenario.ledgerData.lastValuation ? `$${scenario.ledgerData.lastValuation.toLocaleString()}` : 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Custody:</span>
                        <span>{scenario.ledgerData.custodyState || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fraud Indicators */}
                  {verificationResult.fraudIndicators.length > 0 && (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <p className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                        <ExclamationTriangleIcon />
                        Risk Indicators
                      </p>
                      <div className="space-y-2">
                        {verificationResult.fraudIndicators.map((indicator, i) => (
                          <div 
                            key={i}
                            className={`text-sm p-2 rounded ${
                              indicator.type === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                              indicator.type === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-slate-700 text-slate-300'
                            }`}
                          >
                            <span className="font-mono text-xs mr-2">[{indicator.code}]</span>
                            {indicator.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing Time */}
                  <p className="text-xs text-slate-500 text-center">
                    Processed in {verificationResult.processingTime.toFixed(2)}s
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROI Tab */}
        {activeTab === 'roi' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6">Your Numbers</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Annual Claims Volume
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="1000"
                    value={annualClaims}
                    onChange={e => setAnnualClaims(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-right text-lg font-bold text-electric-blue">
                    {annualClaims.toLocaleString()} claims/year
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Average Claim Value
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="500"
                    value={avgClaimValue}
                    onChange={e => setAvgClaimValue(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-right text-lg font-bold text-electric-blue">
                    ${avgClaimValue.toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Current Fraud Rate
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="15"
                    step="0.5"
                    value={currentFraudRate}
                    onChange={e => setCurrentFraudRate(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-right text-lg font-bold text-red-400">
                    {currentFraudRate}%
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6">Your ROI with Proveniq</h2>

              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="text-sm text-slate-400">Total Claim Volume</p>
                  <p className="text-2xl font-bold">${roi.totalVolume.toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-sm text-red-400">Current Fraud Loss</p>
                    <p className="text-xl font-bold text-red-400">${roi.currentFraudLoss.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{currentFraudRate}% fraud rate</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <p className="text-sm text-green-400">With Proveniq</p>
                    <p className="text-xl font-bold text-green-400">${roi.newFraudLoss.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{roi.newFraudRate.toFixed(1)}% fraud rate</p>
                  </div>
                </div>

                <div className="bg-electric-blue/10 border border-electric-blue/30 rounded-lg p-4">
                  <p className="text-sm text-electric-blue">Annual Fraud Savings</p>
                  <p className="text-3xl font-bold text-electric-blue">${roi.savedAmount.toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-sm text-slate-400">Proveniq Cost</p>
                    <p className="text-lg font-bold">${roi.proveniqCost.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">$2.50/verification</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-sm text-slate-400">Net Savings</p>
                    <p className="text-lg font-bold text-green-400">${roi.netSavings.toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-electric-blue to-purple-500 rounded-lg p-6 text-center">
                  <p className="text-sm opacity-80">Return on Investment</p>
                  <p className="text-5xl font-bold">{roi.roi.toFixed(0)}%</p>
                  <p className="text-sm opacity-80 mt-1">ROI in Year 1</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compare Tab */}
        {activeTab === 'compare' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Without Proveniq */}
            <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 text-red-400">Without Proveniq</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <ClockIcon />
                  <div>
                    <p className="font-medium">5-14 Day Processing</p>
                    <p className="text-sm text-slate-400">Manual review of documentation, phone calls, adjuster visits</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon />
                  <div>
                    <p className="font-medium">8-12% Fraud Rate</p>
                    <p className="text-sm text-slate-400">Limited ability to verify ownership and provenance</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CurrencyDollarIcon />
                  <div>
                    <p className="font-medium">$150-300 Per Claim</p>
                    <p className="text-sm text-slate-400">Adjuster time, documentation review, SIU investigations</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <XCircleIcon />
                  <div>
                    <p className="font-medium">Reactive Fraud Detection</p>
                    <p className="text-sm text-slate-400">Fraud discovered after payment, recovery difficult</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-red-500/10 rounded-lg">
                <p className="text-sm text-red-400">Typical Annual Loss</p>
                <p className="text-2xl font-bold text-red-400">$4-8M per 100K claims</p>
              </div>
            </div>

            {/* With Proveniq */}
            <div className="bg-slate-900 border border-green-500/30 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 text-green-400">With Proveniq</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon />
                  <div>
                    <p className="font-medium">1-2 Second Verification</p>
                    <p className="text-sm text-slate-400">Instant ledger lookup, automated provenance scoring</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon />
                  <div>
                    <p className="font-medium">3-5% Fraud Rate</p>
                    <p className="text-sm text-slate-400">55% reduction via provenance verification</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CurrencyDollarIcon />
                  <div>
                    <p className="font-medium">$2.50 Per Verification</p>
                    <p className="text-sm text-slate-400">API-based, no manual intervention for clean claims</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircleIcon />
                  <div>
                    <p className="font-medium">Proactive Fraud Prevention</p>
                    <p className="text-sm text-slate-400">Flag suspicious claims before payment</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-500/10 rounded-lg">
                <p className="text-sm text-green-400">Annual Savings</p>
                <p className="text-2xl font-bold text-green-400">$2-4M per 100K claims</p>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-4">Ready to reduce fraud by 55%?</h3>
            <p className="text-slate-400 mb-6 max-w-xl mx-auto">
              Schedule a pilot program with your actual claims data. See real ROI in 30 days.
            </p>
            <div className="flex justify-center gap-4">
              <button className="bg-electric-blue text-slate-950 font-bold py-3 px-8 rounded-lg hover:bg-electric-blue/90 transition-all">
                Schedule Pilot
              </button>
              <button className="border border-slate-600 text-white font-medium py-3 px-8 rounded-lg hover:border-slate-500 transition-all">
                Download Whitepaper
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsuranceDemoScreen;
