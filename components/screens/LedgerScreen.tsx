import React, { useState, useMemo, useEffect } from 'react';
import { Block, Anomaly, FraudScore, ComplianceViolation, User } from '../../types';
import { verifyLedger, VerificationResult } from '../../services/verificationService';
import AIAssistant from '../AIAssistant';
import ChainViewScreen from './ChainViewScreen';

// --- Icons ---
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" /></svg>;
const DocumentTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3.5a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5zM3 3.5A1.5 1.5 0 014.5 2h11A1.5 1.5 0 0117 3.5v13A1.5 1.5 0 0115.5 18H4.5A1.5 1.5 0 013 16.5v-13z" clipRule="evenodd" /></svg>;
const ClipboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 01-2.25 2.25h-1.5a2.25 2.25 0 01-2.25-2.25v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
const ExclamationTriangleIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className || "w-5 h-5"}><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;

// --- Helper Components for BlockCard ---
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
    <div className="group relative flex">
        {children}
        <span className="absolute bottom-full mb-2 w-max max-w-xs scale-0 transition-all rounded bg-slate-950 p-2 text-xs text-white group-hover:scale-100 border border-slate-700 z-10 shadow-lg">
            {text}
        </span>
    </div>
);

const RiskBadge: React.FC<{ score?: FraudScore }> = ({ score }) => {
    if (!score) return <div className="text-xs font-medium text-slate-400">Risk: N/A</div>;
    const colors = {
        Low: 'text-electric-green bg-green-900/50',
        Medium: 'text-yellow-400 bg-yellow-900/50',
        High: 'text-red-400 bg-red-900/50',
    };
    return (
        <Tooltip text={score.justification}>
            <div className={`text-xs font-bold px-2 py-1 rounded-full ${colors[score.level]}`}>{score.level} Risk</div>
        </Tooltip>
    );
};

// --- BlockCard Component ---
interface BlockCardProps {
    block: Block;
    onSelect: (id: string) => void;
    isFailing: boolean;
    isVerifying: boolean;
    anomaly?: Anomaly;
    fraudScore?: FraudScore;
    complianceViolations: ComplianceViolation[];
}

const BlockCard: React.FC<BlockCardProps> = ({ block, onSelect, isFailing, isVerifying, anomaly, fraudScore, complianceViolations }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(block.hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const hasComplianceIssue = complianceViolations && complianceViolations.length > 0;

    const borderClass = isFailing ? 'border-red-500' 
        : isVerifying ? 'border-electric-blue animate-pulseVerify' 
        : anomaly ? 'border-yellow-500/80 animate-pulse'
        : 'border-slate-800';

    return (
        <div className={`bg-slate-900 rounded-lg border transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-electric-blue/20 ${borderClass} ${isVerifying ? 'shadow-lg shadow-electric-blue/30' : ''}`}>
          <div className="p-5">
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-slate-100">{block.id}</h3>
                <div className="flex items-center gap-2">
                    {hasComplianceIssue && (
                       <Tooltip text={`${complianceViolations.length} compliance violation(s). ${complianceViolations[0].message}`}>
                           <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                       </Tooltip>
                    )}
                    {anomaly && (
                        <Tooltip text={`Anomaly: ${anomaly.reason}`}>
                            <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                                <ExclamationTriangleIcon className="w-3 h-3 text-slate-900" />
                            </div>
                        </Tooltip>
                    )}
                    <RiskBadge score={fraudScore} />
                </div>
            </div>
            <div className="mt-2 flex items-center space-x-4 text-sm text-slate-400">
                <div className="flex items-center space-x-1.5"><ClockIcon /><p>{new Date(block.timestamp).toLocaleString()}</p></div>
                <div className="flex items-center space-x-1.5"><DocumentTextIcon /><p>{block.transactions.length} Transactions</p></div>
            </div>
            <div className="mt-4 flex items-center justify-between bg-slate-950 p-2 rounded-md">
                <p className="font-mono text-xs text-slate-400 truncate pr-2">{block.hash}</p>
                <button onClick={handleCopy} className="text-slate-400 hover:text-electric-blue transition-colors flex-shrink-0">
                    {copied ? <CheckIcon /> : <ClipboardIcon />}
                </button>
            </div>
          </div>
          <div className="bg-slate-800/50 px-5 py-3 rounded-b-lg">
            <button onClick={() => onSelect(block.id)} className="w-full text-center font-semibold text-electric-blue hover:text-electric-blue-600 transition-colors">View Details</button>
          </div>
        </div>
    );
};


// --- LedgerScreen Component ---
interface LedgerScreenProps {
    blocks: Block[];
    onSelectBlock: (id: string) => void;
    anomalies: Anomaly[];
    fraudScores: Record<string, FraudScore>;
    complianceViolations: Record<string, ComplianceViolation[]>;
    isAnalyzing: boolean;
    onLogAction: (action: string, details: string) => void;
    currentUser: User;
}

const LedgerScreen: React.FC<LedgerScreenProps> = ({ blocks, onSelectBlock, anomalies, fraudScores, complianceViolations, isAnalyzing, onLogAction, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [minTx, setMinTx] = useState('');
    const [maxTx, setMaxTx] = useState('');
    const [verificationState, setVerificationState] = useState<{ status: 'idle' | 'verifying' | 'done', result: VerificationResult | null }>({ status: 'idle', result: null });
    const [verifyingBlockId, setVerifyingBlockId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'chain'>('grid');

    const filteredBlocks = useMemo(() => {
        return blocks.filter(block => {
            const searchTermLower = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                block.id.toLowerCase().includes(searchTermLower) ||
                block.transactions.some(tx => tx.user.toLowerCase().includes(searchTermLower));

            const min = minTx ? parseInt(minTx, 10) : -Infinity;
            const max = maxTx ? parseInt(maxTx, 10) : Infinity;
            const matchesTxCount = block.transactions.length >= min && block.transactions.length <= max;

            return matchesSearch && matchesTxCount;
        }).reverse(); // Show newest first
    }, [blocks, searchTerm, minTx, maxTx]);
    
    const [animatedBlocks, setAnimatedBlocks] = useState(filteredBlocks);

    useEffect(() => {
        setAnimatedBlocks(filteredBlocks);
    }, [filteredBlocks]);

    const handleVerify = async () => {
        if (currentUser.role === 'Viewer') return;
        setVerificationState({ status: 'verifying', result: null });
        onLogAction('VERIFICATION_STARTED', 'Ledger integrity verification process initiated.');
        const result = await verifyLedger(blocks, setVerifyingBlockId);
        setVerificationState({ status: 'done', result });
        onLogAction('VERIFICATION_COMPLETED', `Result: ${result.success ? 'Success' : 'Failure'}. ${result.message}`);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setMinTx('');
        setMaxTx('');
    };
    
     const anomaliesMap = useMemo(() => new Map(anomalies.map(a => [a.blockId, a])), [anomalies]);

    const VerificationModal: React.FC<{ result: VerificationResult, onClose: () => void }> = ({ result, onClose }) => {
        const Icon = result.success 
            ? <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-electric-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 max-w-md w-full text-center">
                    {Icon}
                    <h3 className={`mt-4 text-2xl font-semibold ${result.success ? 'text-slate-100' : 'text-red-400'}`}>
                        {result.success ? 'Verification Successful' : 'Verification Failed'}
                    </h3>
                    <p className="mt-2 text-slate-400">{result.message}</p>
                    <button onClick={onClose} className="mt-6 bg-electric-blue text-slate-950 font-bold py-2 px-6 rounded-lg hover:bg-electric-blue-600 transition-colors">Close</button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-16">
            {verificationState.status === 'done' && verificationState.result && (
                <VerificationModal result={verificationState.result} onClose={() => setVerificationState({ status: 'idle', result: null })} />
            )}
            
            <AIAssistant ledger={blocks} onLogAction={onLogAction} currentUser={currentUser} />

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-grow">
                        <input type="text" placeholder="Search by Claim ID or User..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-electric-blue focus:border-electric-blue" />
                        <input type="number" placeholder="Min Transactions" value={minTx} onChange={e => setMinTx(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-electric-blue focus:border-electric-blue" />
                        <input type="number" placeholder="Max Transactions" value={maxTx} onChange={e => setMaxTx(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-electric-blue focus:border-electric-blue" />
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={clearFilters} className="bg-slate-700 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-600 transition-colors">Clear Filters</button>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center justify-between">
                <div className="flex items-center p-1 bg-slate-800 rounded-lg">
                    <button onClick={() => setViewMode('grid')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'grid' ? 'bg-electric-blue text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}>Grid View</button>
                    <button onClick={() => setViewMode('chain')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'chain' ? 'bg-electric-blue text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}>Chain View</button>
                </div>
                {isAnalyzing ? (
                    <div className="text-electric-blue font-semibold flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Analyzing Ledger...</span>
                    </div>
                ) : (
                    <button onClick={handleVerify} disabled={currentUser.role === 'Viewer' || verificationState.status === 'verifying'} className="bg-electric-green text-slate-950 font-bold py-2 px-6 rounded-lg hover:bg-electric-green-600 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {verificationState.status === 'verifying' && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        <span>{verificationState.status === 'verifying' ? 'Verifying...' : 'Verify Ledger Integrity'}</span>
                    </button>
                )}
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-500">
                    {animatedBlocks.map(block => (
                         <BlockCard
                            key={block.id}
                            block={block}
                            onSelect={onSelectBlock}
                            isFailing={verificationState.result?.failedBlockId === block.id}
                            isVerifying={verifyingBlockId === block.id}
                            anomaly={anomaliesMap.get(block.id)}
                            fraudScore={fraudScores[block.id]}
                            complianceViolations={complianceViolations[block.id] || []}
                        />
                    ))}
                </div>
            ) : (
                <ChainViewScreen 
                    blocks={blocks}
                    onSelectBlock={onSelectBlock}
                    verifyingBlockId={verifyingBlockId}
                    failedBlockId={verificationState.result?.failedBlockId}
                />
            )}
        </div>
    );
};

export default LedgerScreen;