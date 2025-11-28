import React, { useState, useEffect, useCallback } from 'react';
import { Block, Anomaly, FraudScore, Annotation, AuditLogEntry, ComplianceViolation, User } from './types';
import { MOCK_LEDGER, getNextBlock } from './constants';
import { detectAnomalies, calculateFraudScores } from './services/aiRiskAnalysisService';
import { logAction } from './services/auditLogService';
import { checkAllBlocksCompliance } from './services/complianceService';
import { getCurrentUser, switchUser, MOCK_USERS } from './services/authService';

import LandingScreen from './components/screens/LandingScreen';
import LedgerScreen from './components/screens/LedgerScreen';
import BlockDetailScreen from './components/screens/BlockDetailScreen';
import Header from './components/Header';
import DashboardScreen from './components/screens/DashboardScreen';
import AuditTrailScreen from './components/screens/AuditTrailScreen';

type AppView = 'landing' | 'ledger' | 'dashboard' | 'audit_trail';

const App: React.FC = () => {
    const [view, setView] = useState<AppView>('landing');
    const [ledger, setLedger] = useState<Block[]>(MOCK_LEDGER);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isLiveMode, setIsLiveMode] = useState(false);

    // New feature states
    const [currentUser, setCurrentUser] = useState<User>(getCurrentUser());
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [fraudScores, setFraudScores] = useState<Record<string, FraudScore>>({});
    const [complianceViolations, setComplianceViolations] = useState<Record<string, ComplianceViolation[]>>({});
    const [annotations, setAnnotations] = useState<Record<string, Annotation[]>>({});
    const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleLogAction = useCallback((action: string, details: string) => {
        setAuditLog(prevLog => [...prevLog, logAction(action, details)]);
    }, []);

    const handleSwitchUser = (userId: string) => {
        const newUser = switchUser(userId);
        setCurrentUser(newUser);
        handleLogAction('USER_SWITCH', `Session switched to user ${newUser.email} (${newUser.role}).`);
    };

    const enterPortal = () => {
        setView('ledger');
        handleLogAction('PORTAL_ENTERED', `User ${currentUser.email} entered the secure portal.`);
    };

    const selectBlock = (id: string) => {
        setSelectedBlockId(id);
        handleLogAction('BLOCK_VIEWED', `Viewed details for block ${id}.`);
    };
    const deselectBlock = () => setSelectedBlockId(null);
    
    const addAnnotation = (transactionId: string, comment: string) => {
        if (currentUser.role === 'Viewer') return; // Security check
        const newAnnotation: Annotation = {
            id: `AN-${Date.now()}`,
            transactionId,
            user: currentUser.email,
            timestamp: new Date().toISOString(),
            comment,
        };
        setAnnotations(prev => ({
            ...prev,
            [transactionId]: [...(prev[transactionId] || []), newAnnotation]
        }));
        handleLogAction('ANNOTATION_ADDED', `Added annotation to transaction ${transactionId}.`);
    };

    const addNewBlock = useCallback(() => {
        setLedger(prevLedger => {
            const lastBlock = prevLedger[prevLedger.length - 1];
            const newBlock = getNextBlock(lastBlock, prevLedger);
            // In a real app, you'd also run analysis on the new block here
            return [...prevLedger, newBlock];
        });
    }, []);

    useEffect(() => {
        const runInitialAnalysis = async () => {
            if (view !== 'landing') {
                setIsAnalyzing(true);
                // Run analyses in parallel
                const [anomalyResults, fraudScoreResults, complianceResults] = await Promise.all([
                    detectAnomalies(ledger),
                    calculateFraudScores(ledger),
                    checkAllBlocksCompliance(ledger)
                ]);

                setAnomalies(anomalyResults);
                
                const scoresMap = fraudScoreResults.reduce((acc, score) => {
                    acc[score.blockId] = score;
                    return acc;
                }, {} as Record<string, FraudScore>);
                setFraudScores(scoresMap);
                setComplianceViolations(complianceResults);
                setIsAnalyzing(false);
                handleLogAction('SYSTEM_ANALYSIS', 'Initial AI analysis and compliance checks completed.');
            }
        };
        runInitialAnalysis();
    }, [view, ledger, handleLogAction]);


    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        if (isLiveMode) {
            const randomInterval = Math.floor(Math.random() * (10000 - 7000 + 1)) + 7000;
            intervalId = setInterval(addNewBlock, randomInterval);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isLiveMode, addNewBlock]);

    const selectedBlock = ledger.find(block => block.id === selectedBlockId) || null;

    if (view === 'landing') {
        return <LandingScreen onEnterPortal={enterPortal} />;
    }

    const renderContent = () => {
        if (selectedBlock) {
            return (
                <BlockDetailScreen
                    block={selectedBlock}
                    onBack={deselectBlock}
                    annotations={annotations}
                    onAddAnnotation={addAnnotation}
                    complianceViolations={complianceViolations[selectedBlock.id] || []}
                    onLogAction={handleLogAction}
                    currentUser={currentUser}
                />
            );
        }
        switch (view) {
            case 'dashboard':
                return <DashboardScreen blocks={ledger} onLogAction={handleLogAction} />;
            case 'audit_trail':
                return <AuditTrailScreen log={auditLog} />;
            case 'ledger':
            default:
                return (
                    <LedgerScreen
                        blocks={ledger}
                        onSelectBlock={selectBlock}
                        anomalies={anomalies}
                        fraudScores={fraudScores}
                        complianceViolations={complianceViolations}
                        isAnalyzing={isAnalyzing}
                        onLogAction={handleLogAction}
                        currentUser={currentUser}
                    />
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans">
            <Header
                isLiveMode={isLiveMode}
                setIsLiveMode={setIsLiveMode}
                currentView={view}
                setView={setView}
                currentUser={currentUser}
                users={MOCK_USERS}
                onSwitchUser={handleSwitchUser}
            />
            <main className="pt-24 px-4 sm:px-6 lg:px-8">
                {renderContent()}
            </main>
        </div>
    );
};

export default App;