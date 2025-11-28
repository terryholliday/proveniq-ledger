import React, { useMemo, useState } from 'react';
import { Block } from '../../types';

interface DashboardProps {
    blocks: Block[];
    onLogAction: (action: string, details: string) => void;
}

const KPICard: React.FC<{ title: string; value: string; subtext?: string; children?: React.ReactNode }> = ({ title, value, subtext, children }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
        {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        {children}
    </div>
);


const DashboardScreen: React.FC<DashboardProps> = ({ blocks, onLogAction }) => {
    const [selectedCase, setSelectedCase] = useState<string>('all');

    const { cases, filteredBlocks } = useMemo(() => {
        const caseSet = new Set<string>();
        blocks.forEach(b => b.caseId && caseSet.add(b.caseId));
        const filtered = selectedCase === 'all' ? blocks : blocks.filter(b => b.caseId === selectedCase);
        return { cases: Array.from(caseSet), filteredBlocks: filtered };
    }, [blocks, selectedCase]);

    const stats = useMemo(() => {
        const totalClaims = filteredBlocks.length;
        if (totalClaims === 0) return {
            totalClaims: 0,
            totalValue: 0,
            avgProcessingTime: 0,
            actionCounts: {},
        };

        let totalValue = 0;
        let totalProcessingSeconds = 0;
        const actionCounts: Record<string, number> = {};

        for (const block of filteredBlocks) {
            block.transactions.forEach(tx => {
                actionCounts[tx.action] = (actionCounts[tx.action] || 0) + 1;

                if (tx.action === 'PAYMENT_ISSUED') {
                    const match = tx.details.match(/\$(\d{1,3}(,\d{3})*(\.\d{2})?)/);
                    if (match) {
                        totalValue += parseFloat(match[0].replace(/[$,]/g, ''));
                    }
                }
            });

            if (block.transactions.length > 1) {
                const startTime = new Date(block.transactions[0].timestamp).getTime();
                const endTime = new Date(block.transactions[block.transactions.length - 1].timestamp).getTime();
                totalProcessingSeconds += (endTime - startTime) / 1000;
            }
        }
        
        const avgProcessingTime = totalProcessingSeconds / totalClaims;
        return { totalClaims, totalValue, avgProcessingTime, actionCounts };
    }, [filteredBlocks]);

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
        return `${(seconds / 86400).toFixed(1)}d`;
    };
    
    const handleCaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const caseId = e.target.value;
        setSelectedCase(caseId);
        onLogAction('DASHBOARD_FILTER_CHANGED', `Filtered dashboard by Case ID: ${caseId}`);
    };

    return (
        <div className="animate-zoomIn space-y-8 pb-16">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
                <div className="flex items-center gap-2">
                    <label htmlFor="case-filter" className="text-sm font-medium text-slate-300">Filter by Case:</label>
                    <select
                        id="case-filter"
                        value={selectedCase}
                        onChange={handleCaseChange}
                        className="bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-electric-blue focus:border-electric-blue"
                    >
                        <option value="all">All Cases</option>
                        {cases.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <KPICard title="Total Claims" value={stats.totalClaims.toString()} subtext="Number of claims in the selected period" />
                <KPICard title="Total Paid Value" value={`$${stats.totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} subtext="Sum of all issued payments" />
                <KPICard title="Avg. Processing Time" value={formatDuration(stats.avgProcessingTime)} subtext="From creation to last transaction" />
                
                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-sm font-medium text-slate-400 mb-4">Activity Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(stats.actionCounts).sort(([,a],[,b]) => b-a).map(([action, count]) => (
                            <div key={action} className="bg-slate-800/50 p-3 rounded-md">
                                <p className="text-lg font-bold text-electric-blue">{count}</p>
                                <p className="text-xs text-slate-300 truncate">{action.replace(/_/g, ' ')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardScreen;
