/**
 * Proveniq Ecosystem Demo
 * 
 * Shows the full power of the integrated platform:
 * - HOME: Consumer inventory & registration
 * - CORE: Optical Genome, Identity, Fraud Detection
 * - LEDGER: Immutable truth layer
 * - CLAIMSIQ: Carrier claims automation
 * 
 * This is the MOAT demo - the interconnected system competitors can't replicate.
 */

import React, { useState, useEffect } from 'react';

// =============================================================================
// ANIMATED COMPONENTS
// =============================================================================

const AnimatedCounter: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }> = 
  ({ end, duration = 2000, prefix = '', suffix = '', decimals = 0 }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(easeOut * end);
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);
  
  return <>{prefix}{count.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}{suffix}</>;
};

const DataFlowLine: React.FC<{ active: boolean; direction?: 'right' | 'down' }> = ({ active, direction = 'right' }) => (
  <div className={`relative ${direction === 'right' ? 'w-24 h-1' : 'w-1 h-16'}`}>
    <div className={`absolute inset-0 ${direction === 'right' ? 'bg-gradient-to-r' : 'bg-gradient-to-b'} from-slate-700 to-slate-700`} />
    {active && (
      <div 
        className={`absolute ${direction === 'right' ? 'h-full w-8' : 'w-full h-8'} bg-gradient-to-${direction === 'right' ? 'r' : 'b'} from-electric-blue via-purple-500 to-transparent animate-pulse`}
        style={{ animation: `flow-${direction} 1.5s ease-in-out infinite` }}
      />
    )}
  </div>
);

// =============================================================================
// APP CARDS
// =============================================================================

interface AppCardProps {
  name: string;
  icon: React.ReactNode;
  color: string;
  status: 'idle' | 'active' | 'complete';
  description: string;
  metrics?: { label: string; value: string }[];
}

const AppCard: React.FC<AppCardProps> = ({ name, icon, color, status, description, metrics }) => (
  <div className={`relative bg-slate-900 border-2 rounded-2xl p-6 transition-all duration-500 ${
    status === 'active' ? `border-${color} shadow-lg shadow-${color}/20` : 
    status === 'complete' ? 'border-green-500' : 'border-slate-700'
  }`}>
    {status === 'active' && (
      <div className="absolute -top-2 -right-2">
        <span className="relative flex h-4 w-4">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${color} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-4 w-4 bg-${color}`}></span>
        </span>
      </div>
    )}
    {status === 'complete' && (
      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
        <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )}
    
    <div className={`w-12 h-12 rounded-xl bg-${color}/20 flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-2">{name}</h3>
    <p className="text-slate-400 text-sm mb-4">{description}</p>
    
    {metrics && (
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="text-sm font-bold">{m.value}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const EcosystemDemoScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(true);

  // Demo steps showing data flow through the ecosystem
  const steps = [
    {
      id: 0,
      title: 'The Proveniq Ecosystem',
      subtitle: 'Four apps. One truth. Zero fraud.',
      activeApps: [],
      description: 'Watch how data flows through our integrated platform to create an unbreakable chain of trust.',
    },
    {
      id: 1,
      title: 'Step 1: Item Registration',
      subtitle: 'HOME App — Consumer Inventory',
      activeApps: ['home'],
      description: 'Sarah registers her $15,000 Rolex Submariner in the HOME app. She takes photos, uploads the receipt, and adds the serial number.',
      event: {
        type: 'home.item.registered',
        data: { itemType: 'Watch', brand: 'Rolex', model: 'Submariner', value: 15000 }
      }
    },
    {
      id: 2,
      title: 'Step 2: Optical Genome Creation',
      subtitle: 'CORE — Visual Fingerprinting',
      activeApps: ['home', 'core'],
      description: 'CORE analyzes Sarah\'s photos and creates a unique "Optical Genome" — a mathematical fingerprint that can identify this exact watch forever.',
      event: {
        type: 'core.genome.generated',
        data: { genomeId: 'OG-7X9K2M', vectors: 2048, confidence: 0.997 }
      }
    },
    {
      id: 3,
      title: 'Step 3: Immutable Record',
      subtitle: 'LEDGER — Append-Only Truth',
      activeApps: ['home', 'core', 'ledger'],
      description: 'The registration event is cryptographically signed and appended to the immutable Ledger. This record can never be altered or deleted.',
      event: {
        type: 'ledger.event.appended',
        data: { eventId: 'EVT-847291', hash: '7f3a9b...c2e1', sequence: 2847291 }
      }
    },
    {
      id: 4,
      title: 'Step 4: Provenance Score',
      subtitle: 'CORE — Trust Calculation',
      activeApps: ['home', 'core', 'ledger'],
      description: 'CORE calculates an initial Provenance Score based on documentation quality, photo analysis, and registration completeness.',
      event: {
        type: 'core.score.calculated',
        data: { score: 72, factors: { photos: 85, docs: 65, history: 70 } }
      }
    },
    {
      id: 5,
      title: '6 Months Later: Claim Filed',
      subtitle: 'CLAIMSIQ — Instant Verification',
      activeApps: ['claimsiq'],
      description: 'Sarah\'s home is burglarized. She files a theft claim through her insurance carrier, who uses ClaimsIQ.',
      event: {
        type: 'claimsiq.claim.created',
        data: { claimId: 'CLM-2025-001', type: 'THEFT', claimedValue: 15000 }
      }
    },
    {
      id: 6,
      title: 'Step 5: Ledger Verification',
      subtitle: 'ClaimsIQ queries the truth',
      activeApps: ['claimsiq', 'ledger'],
      description: 'ClaimsIQ instantly queries the Ledger for the complete provenance history of this item. 18 months of immutable records.',
      event: {
        type: 'ledger.query.executed',
        data: { itemId: 'item_rolex_7x9k2', events: 24, chainValid: true }
      }
    },
    {
      id: 7,
      title: 'Step 6: Fraud Analysis',
      subtitle: 'CORE — AI Risk Assessment',
      activeApps: ['claimsiq', 'ledger', 'core'],
      description: 'CORE runs fraud analysis: ownership verification, valuation consistency, custody chain integrity, and anomaly detection.',
      event: {
        type: 'core.fraud.analyzed',
        data: { riskScore: 12, indicators: 0, recommendation: 'LOW_RISK' }
      }
    },
    {
      id: 8,
      title: 'Step 7: Auto-Approval',
      subtitle: 'ClaimsIQ — Decision in 1.2 seconds',
      activeApps: ['claimsiq', 'ledger', 'core'],
      description: 'Strong provenance + verified ownership + consistent valuations = AUTO-APPROVE. Claim processed in seconds, not days.',
      event: {
        type: 'claimsiq.claim.decided',
        data: { decision: 'AUTO_APPROVE', confidence: 0.94, payout: 14800 }
      }
    },
    {
      id: 9,
      title: 'The MOAT',
      subtitle: 'Why competitors can\'t replicate this',
      activeApps: ['home', 'core', 'ledger', 'claimsiq'],
      description: 'This isn\'t a feature. It\'s an ecosystem. The data Sarah entered 6 months ago in HOME flows through CORE and LEDGER to enable instant claims processing in ClaimsIQ. No competitor has this.',
    },
  ];

  const currentStepData = steps[currentStep];

  // Auto-play through steps
  useEffect(() => {
    if (isPlaying && currentStep < steps.length - 1) {
      const timer = setTimeout(() => setCurrentStep(s => s + 1), 4000);
      return () => clearTimeout(timer);
    } else if (currentStep === steps.length - 1) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentStep, steps.length]);

  const appConfigs = {
    home: {
      name: 'HOME',
      color: 'blue-500',
      icon: <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
      description: 'Consumer inventory app. Policyholders register items here.',
      metrics: [{ label: 'Items Registered', value: '2.4M' }, { label: 'Avg Photos/Item', value: '8.3' }]
    },
    core: {
      name: 'CORE',
      color: 'purple-500',
      icon: <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      description: 'AI engine. Optical Genome, identity, fraud detection.',
      metrics: [{ label: 'Genomes Created', value: '1.8M' }, { label: 'Fraud Detected', value: '$156M' }]
    },
    ledger: {
      name: 'LEDGER',
      color: 'electric-blue',
      icon: <svg className="w-6 h-6 text-electric-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
      description: 'Immutable truth layer. Append-only, cryptographic chain.',
      metrics: [{ label: 'Events Recorded', value: '47M' }, { label: 'Chain Integrity', value: '100%' }]
    },
    claimsiq: {
      name: 'CLAIMSIQ',
      color: 'green-500',
      icon: <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      description: 'Carrier claims automation. Instant verification & decision.',
      metrics: [{ label: 'Claims Verified', value: '847K' }, { label: 'Auto-Approve Rate', value: '34%' }]
    },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-b border-slate-800 z-50 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-electric-blue to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">PROVENIQ ECOSYSTEM</h1>
              <p className="text-xs text-slate-500">The Palantir of Physical Assets</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowArchitecture(!showArchitecture)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showArchitecture ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Architecture View
            </button>
            <button
              onClick={() => { setIsPlaying(!isPlaying); if (!isPlaying && currentStep === steps.length - 1) setCurrentStep(0); }}
              className="bg-electric-blue text-black font-bold px-6 py-2 rounded-lg hover:bg-electric-blue/90 transition-all flex items-center gap-2"
            >
              {isPlaying ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  Pause
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  {currentStep === 0 ? 'Start Demo' : 'Continue'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="fixed top-[73px] left-0 right-0 h-1 bg-slate-900 z-40">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <div className="pt-24 px-8 pb-32">
        <div className="max-w-7xl mx-auto">
          
          {/* Step Info */}
          <div className="text-center mb-12 pt-8">
            <p className="text-sm text-slate-500 uppercase tracking-widest mb-2">
              {currentStep === 0 ? 'Introduction' : currentStep === steps.length - 1 ? 'Conclusion' : `Step ${currentStep} of ${steps.length - 2}`}
            </p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{currentStepData.title}</h2>
            <p className="text-xl text-electric-blue mb-4">{currentStepData.subtitle}</p>
            <p className="text-slate-400 max-w-3xl mx-auto">{currentStepData.description}</p>
          </div>

          {/* Architecture Diagram */}
          {showArchitecture && (
            <div className="mb-12">
              {/* Connection Lines (SVG Background) */}
              <div className="relative">
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: '400px' }}>
                  {/* HOME to CORE */}
                  <line x1="25%" y1="30%" x2="50%" y2="30%" stroke={currentStepData.activeApps.includes('home') && currentStepData.activeApps.includes('core') ? '#3B82F6' : '#334155'} strokeWidth="2" strokeDasharray={currentStepData.activeApps.includes('home') && currentStepData.activeApps.includes('core') ? '0' : '8'}>
                    {currentStepData.activeApps.includes('home') && currentStepData.activeApps.includes('core') && (
                      <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite" />
                    )}
                  </line>
                  {/* CORE to LEDGER */}
                  <line x1="50%" y1="45%" x2="50%" y2="70%" stroke={currentStepData.activeApps.includes('core') && currentStepData.activeApps.includes('ledger') ? '#A855F7' : '#334155'} strokeWidth="2" strokeDasharray={currentStepData.activeApps.includes('core') && currentStepData.activeApps.includes('ledger') ? '0' : '8'} />
                  {/* LEDGER to CLAIMSIQ */}
                  <line x1="50%" y1="85%" x2="75%" y2="85%" stroke={currentStepData.activeApps.includes('ledger') && currentStepData.activeApps.includes('claimsiq') ? '#22C55E' : '#334155'} strokeWidth="2" strokeDasharray={currentStepData.activeApps.includes('ledger') && currentStepData.activeApps.includes('claimsiq') ? '0' : '8'} />
                </svg>

                {/* App Cards Grid */}
                <div className="grid grid-cols-4 gap-6 relative z-10">
                  {/* Row 1: HOME and CORE */}
                  <div className="col-span-1">
                    <AppCard 
                      {...appConfigs.home}
                      status={currentStepData.activeApps.includes('home') ? 'active' : currentStep > 4 ? 'complete' : 'idle'}
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-center">
                    <div className={`px-6 py-3 rounded-full border-2 transition-all ${
                      currentStepData.activeApps.includes('home') && currentStepData.activeApps.includes('core')
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-slate-700 text-slate-600'
                    }`}>
                      Optical Genome Generation →
                    </div>
                  </div>
                  <div className="col-span-1">
                    <AppCard 
                      {...appConfigs.core}
                      status={currentStepData.activeApps.includes('core') ? 'active' : currentStep > 4 ? 'complete' : 'idle'}
                    />
                  </div>

                  {/* Row 2: Spacer and LEDGER */}
                  <div className="col-span-1"></div>
                  <div className="col-span-2 flex items-center justify-center">
                    <AppCard 
                      {...appConfigs.ledger}
                      status={currentStepData.activeApps.includes('ledger') ? 'active' : 'idle'}
                    />
                  </div>
                  <div className="col-span-1"></div>

                  {/* Row 3: CLAIMSIQ */}
                  <div className="col-span-1"></div>
                  <div className="col-span-2 flex items-center justify-center">
                    <div className={`px-6 py-3 rounded-full border-2 transition-all ${
                      currentStepData.activeApps.includes('ledger') && currentStepData.activeApps.includes('claimsiq')
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-slate-700 text-slate-600'
                    }`}>
                      ← Claims Verification Query
                    </div>
                  </div>
                  <div className="col-span-1">
                    <AppCard 
                      {...appConfigs.claimsiq}
                      status={currentStepData.activeApps.includes('claimsiq') ? 'active' : 'idle'}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Event Display */}
          {currentStepData.event && (
            <div className="max-w-2xl mx-auto mb-12">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm text-slate-400 ml-2 font-mono">Event Bus</span>
                </div>
                <div className="p-6 font-mono text-sm">
                  <p className="text-slate-500 mb-2">// Real-time event</p>
                  <p className="text-purple-400">topic: <span className="text-green-400">"{currentStepData.event.type}"</span></p>
                  <p className="text-purple-400 mt-2">payload: {'{'}</p>
                  {Object.entries(currentStepData.event.data).map(([key, value]) => (
                    <p key={key} className="pl-4">
                      <span className="text-blue-400">{key}</span>: <span className="text-yellow-400">{typeof value === 'object' ? JSON.stringify(value) : JSON.stringify(value)}</span>,
                    </p>
                  ))}
                  <p className="text-purple-400">{'}'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Final Slide - The MOAT */}
          {currentStep === steps.length - 1 && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-12">
                <h3 className="text-3xl font-bold mb-8 text-center">Why This Can't Be Replicated</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-electric-blue/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-electric-blue font-bold">1</span>
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Network Effects</h4>
                        <p className="text-slate-400 text-sm">2.4M items registered. Each scan makes the Optical Genome smarter. Competitors start at zero.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-400 font-bold">2</span>
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Data Lock-In</h4>
                        <p className="text-slate-400 text-sm">47M immutable events. This provenance history can't be exported or recreated.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-400 font-bold">3</span>
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Integration Depth</h4>
                        <p className="text-slate-400 text-sm">Four apps sharing one truth layer. Building one app is easy. Building the ecosystem is hard.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-yellow-400 font-bold">4</span>
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Time Advantage</h4>
                        <p className="text-slate-400 text-sm">Every day we operate, the gap widens. Provenance compounds over time.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold mb-6">
                    This is infrastructure that
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-purple-500"> decides what is real</span>.
                  </p>
                  <div className="flex justify-center gap-4">
                    <button className="bg-white text-black font-bold py-4 px-8 rounded-full hover:bg-slate-200 transition-all">
                      Schedule Pilot Program
                    </button>
                    <button className="border-2 border-slate-600 text-white font-bold py-4 px-8 rounded-full hover:border-slate-400 transition-all">
                      Technical Deep-Dive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-slate-800 px-8 py-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {/* Step Dots */}
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep ? 'w-8 bg-electric-blue' : 
                  i < currentStep ? 'bg-green-500' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
            disabled={currentStep === steps.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EcosystemDemoScreen;
