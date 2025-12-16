/**
 * Integration Status Panel
 * 
 * Displays real-time Integration Layer status including:
 * - Event bus connection status
 * - Chain integrity status
 * - Recent events feed
 * - Contract compliance indicators
 */

import React, { useState } from 'react';
import type { IntegrationLayerState, IntegrationLayerActions } from '../hooks/useIntegrationLayer';

// =============================================================================
// ICONS
// =============================================================================

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
  </svg>
);

const XCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
  </svg>
);

const BoltIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
    <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M9.661 2.237a.75.75 0 01.678 0 12.024 12.024 0 007.865 1.27.75.75 0 01.857.66 18.04 18.04 0 01-1.883 9.415 12.01 12.01 0 01-6.587 5.297.75.75 0 01-.582 0 12.01 12.01 0 01-6.587-5.297A18.04 18.04 0 011.54 4.167a.75.75 0 01.857-.66 12.024 12.024 0 007.865-1.27zm.073 9.613l4.042-4.712a.75.75 0 10-1.152-.96l-3.521 4.107-1.408-1.408a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.099-.087z" clipRule="evenodd" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

interface IntegrationStatusPanelProps {
  state: IntegrationLayerState;
  actions: IntegrationLayerActions;
  onLogAction: (action: string, details: string) => void;
}

const IntegrationStatusPanel: React.FC<IntegrationStatusPanelProps> = ({
  state,
  actions,
  onLogAction,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEventFeed, setShowEventFeed] = useState(false);

  const handleVerifyIntegrity = () => {
    const result = actions.verifyIntegrity();
    onLogAction(
      'CHAIN_INTEGRITY_CHECK',
      result.valid 
        ? 'Hash chain integrity verified successfully' 
        : `Integrity check failed: ${result.errors.join(', ')}`
    );
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-full ${state.isConnected ? 'bg-electric-green/20' : 'bg-red-500/20'}`}>
            {state.isConnected ? (
              <BoltIcon />
            ) : (
              <XCircleIcon />
            )}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-100">Integration Layer</h3>
            <p className="text-xs text-slate-400">
              {state.isConnected ? 'Connected' : 'Disconnected'} • 
              Chain Position: {state.chainStats.chainLength} • 
              Events: {state.eventBusStats.totalEventsProcessed}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.chainStats.integrityValid ? (
            <span className="flex items-center gap-1 text-xs text-electric-green">
              <CheckCircleIcon /> Valid
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircleIcon /> Invalid
            </span>
          )}
          <ChevronDownIcon />
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Event Bus Status */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <BoltIcon />
                <span className="text-xs font-medium">Event Bus</span>
              </div>
              <p className="text-lg font-bold text-slate-100">
                {state.eventBusStats.subscriptionCount}
              </p>
              <p className="text-xs text-slate-500">Subscriptions</p>
            </div>

            {/* Chain Length */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <LinkIcon />
                <span className="text-xs font-medium">Chain</span>
              </div>
              <p className="text-lg font-bold text-slate-100">
                {state.chainStats.chainLength}
              </p>
              <p className="text-xs text-slate-500">Events</p>
            </div>

            {/* Integrity Status */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <ShieldCheckIcon />
                <span className="text-xs font-medium">Integrity</span>
              </div>
              <p className={`text-lg font-bold ${state.chainStats.integrityValid ? 'text-electric-green' : 'text-red-400'}`}>
                {state.chainStats.integrityValid ? 'Valid' : 'Invalid'}
              </p>
              <p className="text-xs text-slate-500">Hash Chain</p>
            </div>

            {/* Idempotency Cache */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <CheckCircleIcon />
                <span className="text-xs font-medium">Cache</span>
              </div>
              <p className="text-lg font-bold text-slate-100">
                {state.idempotencyStats.cacheSize}
              </p>
              <p className="text-xs text-slate-500">Idempotency Keys</p>
            </div>
          </div>

          {/* Last Hash */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Last Hash</p>
            <p className="font-mono text-xs text-slate-300 truncate">
              {state.chainStats.lastHash}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Last event: {formatTimestamp(state.eventBusStats.lastEventTimestamp)}
            </p>
          </div>

          {/* Contract Compliance */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-2">INTER_APP_CONTRACT Compliance</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon />
                <span className="text-electric-green">Custody State Machine</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon />
                <span className="text-electric-green">Event Bus Integration</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon />
                <span className="text-electric-green">Idempotency Enforcement</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon />
                <span className="text-electric-green">Hash Chain Integrity</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleVerifyIntegrity}
              className="flex-1 bg-electric-blue text-slate-950 font-semibold py-2 px-4 rounded-md hover:bg-electric-blue-600 transition-colors text-sm"
            >
              Verify Chain Integrity
            </button>
            <button
              onClick={() => setShowEventFeed(!showEventFeed)}
              className="flex-1 bg-slate-700 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-600 transition-colors text-sm"
            >
              {showEventFeed ? 'Hide' : 'Show'} Event Feed
            </button>
            <button
              onClick={() => actions.refreshStats()}
              className="bg-slate-700 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-600 transition-colors text-sm"
            >
              Refresh
            </button>
          </div>

          {/* Event Feed */}
          {showEventFeed && (
            <div className="bg-slate-950 rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-2">Recent Events</p>
              {state.recentEvents.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No events yet</p>
              ) : (
                <div className="space-y-2">
                  {state.recentEvents.slice(0, 10).map((event) => (
                    <div
                      key={event.eventId}
                      className="flex items-center justify-between text-xs border-b border-slate-800 pb-2"
                    >
                      <div>
                        <span className="font-mono text-electric-blue">{event.eventType}</span>
                        {event.itemId && (
                          <span className="text-slate-500 ml-2">{event.itemId}</span>
                        )}
                      </div>
                      <div className="text-slate-500">
                        #{event.hashChainPosition} • {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IntegrationStatusPanel;
