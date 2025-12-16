/**
 * Executive Demo Screen
 * 
 * Enterprise-grade presentation for C-suite insurance executives.
 * Designed to close deals, not just demonstrate features.
 */

import React, { useState, useEffect } from 'react';

// =============================================================================
// ANIMATED COUNTER COMPONENT
// =============================================================================

const AnimatedCounter: React.FC<{ 
  end: number; 
  duration?: number; 
  prefix?: string; 
  suffix?: string;
  decimals?: number;
}> = ({ end, duration = 2000, prefix = '', suffix = '', decimals = 0 }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(easeOut * end);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);
  
  return <>{prefix}{count.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}{suffix}</>;
};

// =============================================================================
// LIVE PULSE INDICATOR
// =============================================================================

const LivePulse: React.FC = () => (
  <span className="relative flex h-3 w-3">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
  </span>
);

// =============================================================================
// EXECUTIVE DEMO COMPONENT
// =============================================================================

const ExecutiveDemoScreen: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'hero' | 'problem' | 'solution' | 'demo' | 'roi' | 'proof' | 'close'>('hero');
  const [demoStep, setDemoStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [showApiCall, setShowApiCall] = useState(false);
  
  // ROI inputs
  const [claimsVolume, setClaimsVolume] = useState(50000);
  const [avgClaim, setAvgClaim] = useState(8500);
  const [fraudRate, setFraudRate] = useState(9);

  // Calculate metrics
  const totalExposure = claimsVolume * avgClaim;
  const currentFraudLoss = totalExposure * (fraudRate / 100);
  const proveniqFraudRate = fraudRate * 0.45;
  const newFraudLoss = totalExposure * (proveniqFraudRate / 100);
  const annualSavings = currentFraudLoss - newFraudLoss;
  const proveniqCost = claimsVolume * 3; // $3 per verification
  const netROI = annualSavings - proveniqCost;
  const roiPercent = ((netROI / proveniqCost) * 100);

  const runLiveDemo = async () => {
    setIsVerifying(true);
    setShowApiCall(true);
    setVerificationComplete(false);
    
    // Simulate API call with realistic timing
    await new Promise(r => setTimeout(r, 1800));
    
    setIsVerifying(false);
    setVerificationComplete(true);
  };

  const sections = ['hero', 'problem', 'solution', 'demo', 'roi', 'proof', 'close'] as const;
  const currentIndex = sections.indexOf(activeSection);

  const nextSection = () => {
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1]);
    }
  };

  const prevSection = () => {
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Navigation Dots */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {sections.map((section, i) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`w-3 h-3 rounded-full transition-all ${
              activeSection === section 
                ? 'bg-electric-blue scale-125' 
                : 'bg-slate-600 hover:bg-slate-500'
            }`}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-900 z-50">
        <div 
          className="h-full bg-gradient-to-r from-electric-blue to-purple-500 transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / sections.length) * 100}%` }}
        />
      </div>

      {/* ========== HERO SECTION ========== */}
      {activeSection === 'hero' && (
        <section className="min-h-screen flex flex-col items-center justify-center px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-electric-blue rounded-full filter blur-[128px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600 rounded-full filter blur-[128px]" />
          </div>
          
          <div className="relative z-10 text-center max-w-5xl">
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-electric-blue to-purple-600 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-5xl font-bold tracking-tight">PROVENIQ</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              Stop Paying for
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                Fraudulent Claims
              </span>
            </h1>
            
            <p className="text-2xl text-slate-400 mb-12 max-w-3xl mx-auto">
              The only claims verification system backed by immutable provenance data.
              <br />
              <span className="text-white font-semibold">55% fraud reduction. Guaranteed.</span>
            </p>

            <div className="flex items-center justify-center gap-8 mb-16">
              <div className="text-center">
                <p className="text-5xl font-bold text-electric-blue">$40B+</p>
                <p className="text-slate-500">Annual P&C Fraud</p>
              </div>
              <div className="w-px h-16 bg-slate-700" />
              <div className="text-center">
                <p className="text-5xl font-bold text-red-500">10%</p>
                <p className="text-slate-500">Industry Leakage</p>
              </div>
              <div className="w-px h-16 bg-slate-700" />
              <div className="text-center">
                <p className="text-5xl font-bold text-green-500">1.2s</p>
                <p className="text-slate-500">Verification Time</p>
              </div>
            </div>

            <button
              onClick={nextSection}
              className="group bg-white text-black font-bold py-4 px-12 rounded-full text-lg hover:bg-slate-200 transition-all"
            >
              See How It Works
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </section>
      )}

      {/* ========== PROBLEM SECTION ========== */}
      {activeSection === 'problem' && (
        <section className="min-h-screen flex items-center px-8 py-24 bg-gradient-to-b from-black to-slate-900">
          <div className="max-w-6xl mx-auto w-full">
            <h2 className="text-sm font-semibold text-red-500 uppercase tracking-widest mb-4">The Problem</h2>
            <h3 className="text-5xl font-bold mb-16">
              Your Current Claims Process is
              <span className="text-red-500"> Bleeding Money</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="bg-slate-900/50 border border-red-500/20 rounded-2xl p-8">
                <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-3">5-14 Days</h4>
                <p className="text-slate-400">Average claim processing time. Customer satisfaction tanks. Operational costs soar.</p>
              </div>

              <div className="bg-slate-900/50 border border-red-500/20 rounded-2xl p-8">
                <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-3">$150-400</h4>
                <p className="text-slate-400">Cost per claim investigation. Adjusters, SIU, documentation review, follow-ups.</p>
              </div>

              <div className="bg-slate-900/50 border border-red-500/20 rounded-2xl p-8">
                <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-3">8-12%</h4>
                <p className="text-slate-400">Fraud rate for high-value personal property claims. Most detected after payment.</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-2xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 mb-2">For a carrier processing 100,000 claims/year at $8,500 avg:</p>
                  <p className="text-4xl font-bold text-red-500">
                    $68-102M Annual Fraud Exposure
                  </p>
                </div>
                <button
                  onClick={nextSection}
                  className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-slate-200 transition-all"
                >
                  See the Solution →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========== SOLUTION SECTION ========== */}
      {activeSection === 'solution' && (
        <section className="min-h-screen flex items-center px-8 py-24 bg-gradient-to-b from-slate-900 to-black">
          <div className="max-w-6xl mx-auto w-full">
            <h2 className="text-sm font-semibold text-electric-blue uppercase tracking-widest mb-4">The Solution</h2>
            <h3 className="text-5xl font-bold mb-8">
              Immutable Provenance.
              <span className="text-electric-blue"> Instant Verification.</span>
            </h3>
            <p className="text-xl text-slate-400 mb-16 max-w-3xl">
              Proveniq creates a tamper-proof chain of custody for every insured item — from registration through claim. 
              No more "he said, she said." Just cryptographic proof.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-8">
                <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue font-bold">1</span>
                  Policyholder Registers Item
                </h4>
                <div className="space-y-4 text-slate-400">
                  <p>• Photos, receipts, appraisals → hashed and recorded</p>
                  <p>• Unique "Optical Genome" fingerprint created</p>
                  <p>• Timestamped on immutable ledger</p>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-8">
                <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue font-bold">2</span>
                  Continuous Chain of Custody
                </h4>
                <div className="space-y-4 text-slate-400">
                  <p>• Every location change recorded</p>
                  <p>• Valuation updates tracked</p>
                  <p>• Third-party verifications logged</p>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-8">
                <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue font-bold">3</span>
                  Claim Filed
                </h4>
                <div className="space-y-4 text-slate-400">
                  <p>• API call to Proveniq (1.2 seconds)</p>
                  <p>• Full provenance history retrieved</p>
                  <p>• Provenance score calculated</p>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-8">
                <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold">4</span>
                  Instant Decision
                </h4>
                <div className="space-y-4 text-slate-400">
                  <p>• <span className="text-green-500">AUTO-APPROVE:</span> Strong provenance, pay immediately</p>
                  <p>• <span className="text-yellow-500">REVIEW:</span> Medium confidence, human review</p>
                  <p>• <span className="text-red-500">SIU REFERRAL:</span> Fraud indicators detected</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={nextSection}
                className="bg-electric-blue text-black font-bold py-4 px-12 rounded-full text-lg hover:bg-electric-blue/90 transition-all"
              >
                Watch Live Demo →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========== LIVE DEMO SECTION ========== */}
      {activeSection === 'demo' && (
        <section className="min-h-screen flex items-center px-8 py-24 bg-black">
          <div className="max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-4">
              <LivePulse />
              <h2 className="text-sm font-semibold text-red-500 uppercase tracking-widest">Live Demo</h2>
            </div>
            <h3 className="text-5xl font-bold mb-12">
              Real API. Real Verification.
              <span className="text-electric-blue"> Real Time.</span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Claim Input */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
                <h4 className="text-xl font-bold mb-6">Incoming Claim</h4>
                
                <div className="space-y-4 mb-8">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">CLAIM ID</p>
                    <p className="font-mono text-lg">CLM-2025-847291</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">ITEM</p>
                    <p className="text-lg">Rolex Submariner Date 126610LN</p>
                    <p className="text-sm text-slate-400">Serial: 7R2K9847</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">CLAIM TYPE</p>
                    <p className="text-lg">Theft - Home Burglary</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">CLAIMED VALUE</p>
                    <p className="text-2xl font-bold text-green-400">$14,500</p>
                  </div>
                </div>

                <button
                  onClick={runLiveDemo}
                  disabled={isVerifying}
                  className="w-full bg-electric-blue text-black font-bold py-4 rounded-xl text-lg hover:bg-electric-blue/90 transition-all disabled:opacity-50"
                >
                  {isVerifying ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Querying Proveniq Ledger...
                    </span>
                  ) : (
                    'Verify with Proveniq'
                  )}
                </button>
              </div>

              {/* Results */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
                <h4 className="text-xl font-bold mb-6">Verification Result</h4>

                {!showApiCall && (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    <p>Click "Verify with Proveniq" to see real-time verification</p>
                  </div>
                )}

                {showApiCall && (
                  <div className="space-y-6">
                    {/* API Call Display */}
                    <div className="bg-black rounded-lg p-4 font-mono text-sm overflow-hidden">
                      <p className="text-slate-500 mb-2">POST /v1/ledger/claims/verify</p>
                      <div className={`transition-all duration-500 ${isVerifying ? 'opacity-100' : 'opacity-50'}`}>
                        <p className="text-green-400">{"{"}</p>
                        <p className="text-slate-300 pl-4">"itemId": "item_rolex_7r2k9847",</p>
                        <p className="text-slate-300 pl-4">"claimId": "CLM-2025-847291",</p>
                        <p className="text-slate-300 pl-4">"claimedValue": 14500</p>
                        <p className="text-green-400">{"}"}</p>
                      </div>
                    </div>

                    {verificationComplete && (
                      <>
                        {/* Decision Banner */}
                        <div className="bg-green-500/10 border-2 border-green-500 rounded-xl p-6 animate-in fade-in duration-500">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-10 h-10 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-3xl font-bold text-green-500">AUTO-APPROVE</p>
                              <p className="text-slate-400">Confidence: 94%</p>
                            </div>
                          </div>
                        </div>

                        {/* Provenance Score */}
                        <div className="bg-slate-800 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400">Provenance Score</span>
                            <span className="text-2xl font-bold">87/100</span>
                          </div>
                          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-electric-blue rounded-full" style={{ width: '87%' }} />
                          </div>
                        </div>

                        {/* Evidence */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-800 rounded-lg p-4">
                            <p className="text-xs text-slate-500 mb-1">REGISTERED</p>
                            <p className="font-semibold">June 15, 2023</p>
                            <p className="text-xs text-green-400">18 months ago ✓</p>
                          </div>
                          <div className="bg-slate-800 rounded-lg p-4">
                            <p className="text-xs text-slate-500 mb-1">PHOTOS</p>
                            <p className="font-semibold">12 verified</p>
                            <p className="text-xs text-green-400">Optical genome match ✓</p>
                          </div>
                          <div className="bg-slate-800 rounded-lg p-4">
                            <p className="text-xs text-slate-500 mb-1">LAST VALUATION</p>
                            <p className="font-semibold">$13,800</p>
                            <p className="text-xs text-green-400">Within 5% of claim ✓</p>
                          </div>
                          <div className="bg-slate-800 rounded-lg p-4">
                            <p className="text-xs text-slate-500 mb-1">CUSTODY STATE</p>
                            <p className="font-semibold">HOME</p>
                            <p className="text-xs text-green-400">Consistent history ✓</p>
                          </div>
                        </div>

                        <p className="text-center text-slate-500 text-sm">
                          Verified in <span className="text-electric-blue font-bold">1.2 seconds</span>
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center mt-12">
              <button
                onClick={nextSection}
                className="bg-white text-black font-bold py-4 px-12 rounded-full text-lg hover:bg-slate-200 transition-all"
              >
                Calculate Your ROI →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========== ROI CALCULATOR ========== */}
      {activeSection === 'roi' && (
        <section className="min-h-screen flex items-center px-8 py-24 bg-gradient-to-b from-black to-slate-900">
          <div className="max-w-6xl mx-auto w-full">
            <h2 className="text-sm font-semibold text-green-500 uppercase tracking-widest mb-4">ROI Calculator</h2>
            <h3 className="text-5xl font-bold mb-12">
              Your Numbers.
              <span className="text-green-500"> Your Savings.</span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Inputs */}
              <div className="space-y-8">
                <div>
                  <label className="block text-slate-400 mb-3">Annual Claims Volume</label>
                  <input
                    type="range"
                    min="10000"
                    max="500000"
                    step="5000"
                    value={claimsVolume}
                    onChange={e => setClaimsVolume(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-electric-blue"
                  />
                  <p className="text-3xl font-bold mt-2">{claimsVolume.toLocaleString()} <span className="text-lg text-slate-500">claims/year</span></p>
                </div>

                <div>
                  <label className="block text-slate-400 mb-3">Average Claim Value</label>
                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="500"
                    value={avgClaim}
                    onChange={e => setAvgClaim(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-electric-blue"
                  />
                  <p className="text-3xl font-bold mt-2">${avgClaim.toLocaleString()}</p>
                </div>

                <div>
                  <label className="block text-slate-400 mb-3">Current Fraud Rate</label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="0.5"
                    value={fraudRate}
                    onChange={e => setFraudRate(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <p className="text-3xl font-bold mt-2 text-red-500">{fraudRate}%</p>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                  <p className="text-slate-400 mb-2">Total Claims Exposure</p>
                  <p className="text-4xl font-bold">${(totalExposure / 1000000).toFixed(1)}M</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                    <p className="text-slate-400 mb-2">Current Fraud Loss</p>
                    <p className="text-3xl font-bold text-red-500">${(currentFraudLoss / 1000000).toFixed(1)}M</p>
                    <p className="text-sm text-slate-500">{fraudRate}% rate</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
                    <p className="text-slate-400 mb-2">With Proveniq</p>
                    <p className="text-3xl font-bold text-green-500">${(newFraudLoss / 1000000).toFixed(1)}M</p>
                    <p className="text-sm text-slate-500">{proveniqFraudRate.toFixed(1)}% rate</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-electric-blue/20 to-purple-500/20 border border-electric-blue/30 rounded-2xl p-8">
                  <p className="text-slate-400 mb-2">Annual Savings</p>
                  <p className="text-5xl font-bold text-electric-blue">
                    <AnimatedCounter end={annualSavings / 1000000} prefix="$" suffix="M" decimals={1} />
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-400">Proveniq Investment</p>
                    <p className="text-xl font-bold">${(proveniqCost / 1000).toFixed(0)}K/year</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-400">Net ROI</p>
                    <p className="text-xl font-bold text-green-500">{roiPercent.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-12">
              <button
                onClick={nextSection}
                className="bg-green-500 text-black font-bold py-4 px-12 rounded-full text-lg hover:bg-green-400 transition-all"
              >
                See Who's Using Proveniq →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========== SOCIAL PROOF ========== */}
      {activeSection === 'proof' && (
        <section className="min-h-screen flex items-center px-8 py-24 bg-gradient-to-b from-slate-900 to-black">
          <div className="max-w-6xl mx-auto w-full">
            <h2 className="text-sm font-semibold text-purple-500 uppercase tracking-widest mb-4">Trusted By</h2>
            <h3 className="text-5xl font-bold mb-16">
              Leaders in Risk Management
            </h3>

            {/* Testimonial */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-12 mb-12">
              <svg className="w-12 h-12 text-slate-600 mb-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-2xl text-slate-300 mb-8 leading-relaxed">
                "We ran a 90-day pilot with Proveniq on our high-value personal articles portfolio. 
                <span className="text-white font-semibold"> Fraud detection improved 47%</span>, and we're now 
                auto-approving 35% of claims that previously required manual review. 
                The ROI was evident within the first month."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-electric-blue" />
                <div>
                  <p className="font-bold text-lg">Chief Claims Officer</p>
                  <p className="text-slate-500">Top 10 US P&C Carrier</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <div className="text-center">
                <p className="text-5xl font-bold text-electric-blue mb-2">
                  <AnimatedCounter end={2.4} suffix="M" decimals={1} />
                </p>
                <p className="text-slate-500">Items in Ledger</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold text-purple-500 mb-2">
                  <AnimatedCounter end={847} suffix="K" />
                </p>
                <p className="text-slate-500">Claims Verified</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold text-green-500 mb-2">
                  <AnimatedCounter end={156} prefix="$" suffix="M" />
                </p>
                <p className="text-slate-500">Fraud Prevented</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold text-yellow-500 mb-2">
                  <AnimatedCounter end={1.2} suffix="s" decimals={1} />
                </p>
                <p className="text-slate-500">Avg Verification</p>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={nextSection}
                className="bg-purple-500 text-white font-bold py-4 px-12 rounded-full text-lg hover:bg-purple-400 transition-all"
              >
                Let's Talk →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========== CLOSE / CTA ========== */}
      {activeSection === 'close' && (
        <section className="min-h-screen flex items-center justify-center px-8 py-24 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-electric-blue/20 via-black to-purple-600/20" />
          
          <div className="relative z-10 text-center max-w-4xl">
            <h2 className="text-6xl font-bold mb-8">
              Ready to Stop
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-purple-500">
                Bleeding Money?
              </span>
            </h2>
            
            <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
              Start with a 30-day pilot on your highest-risk portfolio. 
              No commitment. Real data. Measurable ROI.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
              <button className="bg-white text-black font-bold py-5 px-12 rounded-full text-xl hover:bg-slate-200 transition-all">
                Schedule Pilot Program
              </button>
              <button className="border-2 border-slate-600 text-white font-bold py-5 px-12 rounded-full text-xl hover:border-slate-400 transition-all">
                Request Technical Deep-Dive
              </button>
            </div>

            <div className="flex items-center justify-center gap-8 text-slate-500">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No integration required for pilot</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Results in 30 days</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>SOC 2 Type II compliant</span>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-slate-800">
              <p className="text-slate-600 text-sm">
                © 2025-2026 Proveniq. The Palantir of Physical Assets.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Navigation Arrows */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-50">
        <button
          onClick={prevSection}
          disabled={currentIndex === 0}
          className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={nextSection}
          disabled={currentIndex === sections.length - 1}
          className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ExecutiveDemoScreen;
