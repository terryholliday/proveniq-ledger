import React from 'react';
import { AuditLogEntry } from '../../types';

interface AuditTrailProps {
    log: AuditLogEntry[];
}

const AuditTrailScreen: React.FC<AuditTrailProps> = ({ log }) => {
    // Show newest first
    const reversedLog = [...log].reverse();

    return (
        <div className="animate-zoomIn pb-16">
            <h1 className="text-3xl font-bold text-white mb-8">Auditor's Audit Trail</h1>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Timestamp</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">User</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Action</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="bg-slate-900 divide-y divide-slate-800">
                            {reversedLog.map(entry => (
                                <tr key={entry.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">{new Date(entry.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-electric-blue">{entry.user}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-200">{entry.action.replace(/_/g, ' ')}</td>
                                    <td className="px-6 py-4 text-sm text-slate-300 max-w-md truncate">{entry.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 {log.length === 0 && <p className="p-8 text-center text-slate-500">No actions have been logged yet.</p>}
            </div>
        </div>
    );
};

export default AuditTrailScreen;
