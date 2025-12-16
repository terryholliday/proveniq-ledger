import React, { useState } from 'react';
import { Block, Annotation, ComplianceViolation, User } from '../../types';
import { getAISummary } from '../../services/geminiService';
import { CustodyService } from '../../services/custodyService';
import type { CustodyState } from '../../types/integration';

// --- Icons ---
const UserCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-5.5-2.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM10 12a5.99 5.99 0 00-4.793 2.39A6.483 6.483 0 0010 16.5a6.483 6.483 0 004.793-2.11A5.99 5.99 0 0010 12z" clipRule="evenodd" /></svg>;
const CpuChipIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M16.5 5.5h-13a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h13a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5zM15 7H5v7h10V7z" clipRule="evenodd" /><path d="M8.5 4.5H9V3a1 1 0 10-2 0v1.5h.5V5h1V4.5zM11.5 4.5H11V3a1 1 0 10-2 0v1.5h.5V5h1V4.5zM8.5 15.5H9V17a1 1 0 102 0v-1.5h-.5V15h-1v.5zM11.5 15.5H11V17a1 1 0 102 0v-1.5h-.5V15h-1v.5zM4.5 8.5H5V9a1 1 0 102 0V8.5h-.5V8h-1v.5zM4.5 11.5H5V11a1 1 0 102 0v.5h-.5V12h-1v-.5zM15.5 8.5H15V9a1 1 0 102 0V8.5h-.5V8h-1v.5zM15.5 11.5H15V11a1 1 0 102 0v.5h-.5V12h-1v-.5z" /></svg>;
const ClipboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 01-2.25 2.25h-1.5a2.25 2.25 0 01-2.25-2.25v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
const ExclamationTriangleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-400"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.39-3.453 3.348c-.646.626-.333 1.735.43 1.966l5.243 1.258 2.37.948 2.37-.948 5.243-1.258c.762-.232 1.075-1.34.43-1.966l-3.452-3.348-4.753-.39-1.83-4.401zM15 12a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg>;
const TruckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.5 9a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM11 2a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H11zM5.5 9a.5.5 0 11-1 0 .5.5 0 011 0zm9.5.5a.5.5 0 100-1 .5.5 0 000 1z" /></svg>;

const CUSTODY_STATE_CONFIG: Record<CustodyState, { label: string; color: string; bgColor: string }> = {
  HOME: { label: 'At Home', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' },
  VAULT: { label: 'In Vault', color: 'text-purple-400', bgColor: 'bg-purple-900/30' },
  RETURNED: { label: 'Returned', color: 'text-slate-400', bgColor: 'bg-slate-800/50' },
  SOLD: { label: 'Sold', color: 'text-electric-green', bgColor: 'bg-green-900/30' },
};

const CustodyStateBadge: React.FC<{ itemId?: string }> = ({ itemId }) => {
  if (!itemId) return null;
  
  const record = CustodyService.getCustodyState(itemId);
  const state = record?.currentState || 'HOME';
  const config = CUSTODY_STATE_CONFIG[state];
  const validTransitions = CustodyService.getValidTransitions(state);
  
  return (
    <div className={`${config.bgColor} border border-slate-700 rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">Custody State</p>
          <div className="flex items-center gap-2">
            <TruckIcon />
            <span className={`font-semibold ${config.color}`}>{config.label}</span>
          </div>
        </div>
        {validTransitions.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Valid transitions:</p>
            <p className="text-xs text-slate-400">
              {validTransitions.map(t => CUSTODY_STATE_CONFIG[t].label).join(' → ')}
            </p>
          </div>
        )}
      </div>
      {record?.transitionHistory && record.transitionHistory.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-2">Recent History</p>
          <div className="space-y-1">
            {record.transitionHistory.slice(-3).map((t, i) => (
              <div key={i} className="text-xs flex justify-between">
                <span className="text-slate-400">
                  {CUSTODY_STATE_CONFIG[t.from].label} → {CUSTODY_STATE_CONFIG[t.to].label}
                </span>
                <span className="text-slate-500">
                  {new Date(t.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const HashDisplay: React.FC<{ label: string; hash: string }> = ({ label, hash }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">{label}</p>
            <div className="flex items-center justify-between">
                <p className="font-mono text-sm text-electric-green break-all">{hash}</p>
                <button onClick={handleCopy} className="ml-4 text-slate-400 hover:text-white transition-colors flex-shrink-0">
                    {copied ? <CheckIcon /> : <ClipboardIcon />}
                </button>
            </div>
        </div>
    );
};

interface BlockDetailScreenProps {
    block: Block;
    onBack: () => void;
    annotations: Record<string, Annotation[]>;
    onAddAnnotation: (transactionId: string, comment: string) => void;
    complianceViolations: ComplianceViolation[];
    onLogAction: (action: string, details: string) => void;
    currentUser: User;
}

const AnnotationSection: React.FC<{
    transactionId: string;
    annotations: Annotation[];
    onAddAnnotation: (transactionId: string, comment: string) => void;
    canAnnotate: boolean;
}> = ({ transactionId, annotations, onAddAnnotation, canAnnotate }) => {
    const [newComment, setNewComment] = useState('');
    const [showForm, setShowForm] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        onAddAnnotation(transactionId, newComment);
        setNewComment('');
        setShowForm(false);
    };

    return (
        <div className="mt-3 pl-10 border-t border-slate-800/50 pt-3">
            {annotations.map(anno => (
                <div key={anno.id} className="text-xs mb-2 p-2 bg-slate-800/50 rounded-md">
                    <p className="text-slate-300">{anno.comment}</p>
                    <p className="text-slate-500 mt-1">-- {anno.user} on {new Date(anno.timestamp).toLocaleString()}</p>
                </div>
            ))}
            {canAnnotate && (
                showForm ? (
                     <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
                        <input
                            type="text"
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            placeholder="Add your note..."
                            className="flex-grow bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-white"
                        />
                        <button type="submit" className="text-xs bg-electric-blue text-slate-950 font-semibold px-3 rounded-md">Save</button>
                        <button type="button" onClick={() => setShowForm(false)} className="text-xs bg-slate-600 text-white font-semibold px-3 rounded-md">Cancel</button>
                    </form>
                ) : (
                    <button onClick={() => setShowForm(true)} className="text-xs text-electric-blue hover:underline">+ Add Annotation</button>
                )
            )}
        </div>
    );
};

const BlockDetailScreen: React.FC<BlockDetailScreenProps> = ({ block, onBack, annotations, onAddAnnotation, complianceViolations, onLogAction, currentUser }) => {
    
    const [summary, setSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    
    const handlePrint = () => {
        onLogAction('PDF_EXPORTED', `Exported report for block ${block.id}.`);
        window.print();
    };

    const handleGenerateSummary = async () => {
        setIsSummaryLoading(true);
        setSummary('');
        onLogAction('AI_SUMMARY_REQUESTED', `Requested AI summary for block ${block.id}.`);
        const result = await getAISummary(block);
        setSummary(result);
        setIsSummaryLoading(false);
    };
    
    const formatResponse = (text: string) => {
        return text.split('\n').map((line, i) => (
            <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        ));
    };

    const canAnnotate = currentUser.role !== 'Viewer';

    return (
        <div className="max-w-4xl mx-auto pb-16 animate-zoomIn">
             <div id="printable-area">
                <div className="no-print mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <button onClick={onBack} className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
                        <span>Back to Ledger</span>
                    </button>
                    <div className="flex items-center gap-4">
                         <button onClick={handleGenerateSummary} disabled={isSummaryLoading} className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-slate-600 transition-colors flex items-center gap-2 disabled:opacity-50">
                            <SparklesIcon/> {isSummaryLoading ? "Generating..." : "Generate AI Summary"}
                        </button>
                        <button onClick={handlePrint} className="bg-electric-blue text-slate-950 font-bold py-2 px-4 rounded-lg text-sm hover:bg-electric-blue-600 transition-colors">
                            Export as Secure PDF
                        </button>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-1">Claim Details: {block.id}</h2>
                    <p className="text-slate-400">Timestamp: {new Date(block.timestamp).toUTCString()}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <HashDisplay label="Digital Fingerprint (Hash)" hash={block.hash} />
                        <HashDisplay label="Chain Link (Previous Hash)" hash={block.previousHash} />
                    </div>
                    {block.caseId && (
                      <div className="mt-4">
                        <CustodyStateBadge itemId={`item_${block.caseId.toLowerCase().replace(/[^a-z0-9]/g, '')}`} />
                      </div>
                    )}
                </div>

                {(isSummaryLoading || summary) && (
                     <div className="mb-8 p-6 bg-slate-900 border border-slate-800 rounded-lg">
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2"><SparklesIcon/> AI Generated Summary</h3>
                         {isSummaryLoading && <p className="text-slate-400">The AI assistant is analyzing the claim...</p>}
                         {summary && <div className="text-slate-300 space-y-2 prose prose-invert prose-sm max-w-none">{formatResponse(summary)}</div>}
                    </div>
                )}


                <div>
                    <h3 className="text-xl font-semibold text-white mb-6">Transaction Timeline</h3>
                    <div className="relative">
                        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-700" aria-hidden="true"></div>
                        {block.transactions.map((tx) => {
                            const violation = complianceViolations.find(v => v.transactionId === tx.id);
                            return(
                            <div key={tx.id} className="relative pl-12 pb-8">
                                <div className="absolute left-0 top-3">
                                    <span className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center ring-4 ring-slate-950 text-electric-blue">
                                        {tx.user === 'System' ? <CpuChipIcon /> : <UserCircleIcon />}
                                    </span>
                                </div>
                                <div className={`border rounded-lg ${violation ? 'border-red-500/50 bg-red-900/10' : 'border-slate-800 bg-slate-900'}`}>
                                    <div className="p-4">
                                        <p className="text-sm text-slate-400">{new Date(tx.timestamp).toLocaleString()}</p>
                                        <p className="font-semibold text-slate-200 mt-1">{tx.action} by <span className="text-electric-blue">{tx.user}</span></p>
                                        <p className="text-slate-300 mt-2 text-sm">{tx.details}</p>
                                        {violation && (
                                            <div className="mt-3 p-2 bg-red-900/30 rounded-md text-xs flex items-center gap-2">
                                                <ExclamationTriangleIcon />
                                                <span className="text-red-300 font-medium">Compliance Violation:</span>
                                                <span className="text-red-400">{violation.message}</span>
                                            </div>
                                        )}
                                    </div>
                                    <AnnotationSection 
                                        transactionId={tx.id} 
                                        annotations={annotations[tx.id] || []} 
                                        onAddAnnotation={onAddAnnotation}
                                        canAnnotate={canAnnotate} 
                                    />
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BlockDetailScreen;