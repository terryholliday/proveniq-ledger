import React, { useState } from 'react';
import { Block, User } from '../types';
import { getAIAssistantResponse } from '../services/geminiService';

interface AIAssistantProps {
    ledger: Block[];
    onLogAction: (action: string, details: string) => void;
    currentUser: User;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ ledger, onLogAction, currentUser }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const isViewer = currentUser.role === 'Viewer';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isViewer) return;

        setIsLoading(true);
        setResponse('');
        onLogAction('AI_ASSISTANT_QUERY', `Query: "${query}"`);
        const aiResponse = await getAIAssistantResponse(ledger, query);
        setResponse(aiResponse);
        setIsLoading(false);
    };
    
    // A simple markdown-like parser for bolding text between **
    const formatResponse = (text: string) => {
        return text.split('\n').map((line, i) => (
            <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        ));
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 text-left flex justify-between items-center"
            >
                <div className="flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-electric-blue"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201-4.42 5.5 5.5 0 011.663-4.42 5.5 5.5 0 019.201 4.42 5.5 5.5 0 01-1.663 4.42zM12.5 6a.5.5 0 00-1 0v1h-1a.5.5 0 000 1h1v1a.5.5 0 001 0v-1h1a.5.5 0 000-1h-1V6z" clipRule="evenodd" /><path d="M5.105 15.657a.75.75 0 01.037.96 6.5 6.5 0 00-.756 7.627.75.75 0 11-1.25-.783 5 5 0 01.58-5.864.75.75 0 01.961-.037zM14.895 15.657a.75.75 0 00-.037.96 6.5 6.5 0 01.756 7.627.75.75 0 101.25-.783 5 5 0 00-.58-5.864.75.75 0 00-.961-.037z" /></svg>
                    <h2 className="text-xl font-semibold text-slate-100">AI Audit Assistant</h2>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-6 border-t border-slate-800">
                    <form onSubmit={handleSubmit}>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={isViewer ? "Querying is disabled for Viewers" : "Ask about the ledger... e.g., 'Which claim has the most transactions?'"}
                                className="flex-grow bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-electric-blue focus:border-electric-blue disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isLoading || isViewer}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || isViewer}
                                className="bg-electric-blue text-slate-950 font-bold py-2 px-6 rounded-lg hover:bg-electric-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Thinking...' : 'Ask'}
                            </button>
                        </div>
                    </form>
                    {(isLoading || response) && (
                        <div className="mt-4 p-4 bg-slate-950 rounded-md">
                            {isLoading && <p className="text-slate-400">The AI assistant is analyzing the ledger...</p>}
                            {response && <div className="text-slate-300 space-y-2">{formatResponse(response)}</div>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIAssistant;