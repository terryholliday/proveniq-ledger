import React, { useState, useEffect, useCallback } from 'react';
import { Block, Anomaly, FraudScore, Annotation, AuditLogEntry, ComplianceViolation, User } from './types';
import { MOCK_LEDGER, getNextBlock } from './constants';
import { detectAnomalies, calculateFraudScores } from './services/aiRiskAnalysisService';
import { logAction } from './services/auditLogService';
import { checkAllBlocksCompliance } from './services/complianceService';
import { getCurrentUser, switchUser, MOCK_USERS } from './services/authService';
import { 
    getClaims, 
    addClaim, 
    getAnnotations, 
    addAnnotation as addAnnotationToFirestore,
    addAuditLogEntry,
    seedInitialData,
    hasExistingData 
} from './services/firestoreService';

import LandingScreen from './components/screens/LandingScreen';
import LedgerScreen from './components/screens/LedgerScreen';
import BlockDetailScreen from './components/screens/BlockDetailScreen';
import Header from './components/Header';
import Footer from './components/Footer';
import DashboardScreen from './components/screens/DashboardScreen';
import AuditTrailScreen from './components/screens/AuditTrailScreen';

type AppView = 'landing' | 'ledger' | 'dashboard' | 'audit_trail';

const App: React.FC = () => {
    const [view, setView] = useState<AppView>('landing');
    const [ledger, setLedger] = useState<Block[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [useFirestore, setUseFirestore] = useState(true);

    // New feature states
    const [currentUser, setCurrentUser] = useState<User>(getCurrentUser());
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [fraudScores, setFraudScores] = useState<Record<string, FraudScore>>({});
    const [complianceViolations, setComplianceViolations] = useState<Record<string, ComplianceViolation[]>>({});
    const [annotations, setAnnotations] = useState<Record<string, Annotation[]>>({});
    const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Load data from Firestore on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const hasData = await hasExistingData();
                if (!hasData) {
                    // Seed with mock data if Firestore is empty
                    console.log('Seeding initial data to Firestore...');
                    await seedInitialData(MOCK_LEDGER);
                }
                
                // Load claims from Firestore
                const claims = await getClaims();
                setLedger(claims.length > 0 ? claims : MOCK_LEDGER);
                
                // Load annotations
                const storedAnnotations = await getAnnotations();
                setAnnotations(storedAnnotations);
                
                setUseFirestore(true);
            } catch (error) {
                console.warn('Firestore unavailable, using mock data:', error);
                setLedger(MOCK_LEDGER);
                setUseFirestore(false);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleLogAction = useCallback(async (action: string, details: string) => {
        const entry = logAction(action, details);
        setAuditLog(prevLog => [...prevLog, entry]);
        
        // Also persist to Firestore if available
        if (useFirestore) {
            try {
                await addAuditLogEntry({
                    timestamp: entry.timestamp,
                    user: currentUser.email,
                    action: entry.action,
                    details: entry.details
                });
            } catch (error) {
                console.warn('Failed to persist audit log:', error);
            }
        }
    }, [useFirestore, currentUser.email]);

    const handleSwitchUser = (userId: string) => {
        const newUser = switchUser(userId);
        setCurrentUser(newUser);
        handleLogAction('USER_SWITCH', `Session switched to user ${newUser.email} (${newUser.role}).`);
    };

    const selectBlock = (id: string) => {
        setSelectedBlockId(id);
        handleLogAction('BLOCK_VIEWED', `Viewed details for block ${id}.`);
    };
    const deselectBlock = () => setSelectedBlockId(null);
    
    const addAnnotation = async (transactionId: string, comment: string) => {
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
        
        // Persist to Firestore
        if (useFirestore) {
            try {
                await addAnnotationToFirestore(newAnnotation);
            } catch (error) {
                console.warn('Failed to persist annotation:', error);
            }
        }
        
        handleLogAction('ANNOTATION_ADDED', `Added annotation to transaction ${transactionId}.`);
    };

    const addNewBlock = useCallback(async () => {
        setLedger(prevLedger => {
            const lastBlock = prevLedger[prevLedger.length - 1];
            const newBlock = getNextBlock(lastBlock, prevLedger);
            
            // Persist to Firestore asynchronously
            if (useFirestore) {
                addClaim(newBlock).catch(err => 
                    console.warn('Failed to persist new block:', err)
                );
            }
            
            return [...prevLedger, newBlock];
        });
    }, [useFirestore]);

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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-electric-blue mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading ledger data...</p>
                </div>
            </div>
        );
    }

    const enterPortal = () => {
        setView('ledger');
        handleLogAction('PORTAL_ENTERED', `User ${currentUser.email} entered the secure portal.`);
    };

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
        <div className="min-h-screen bg-slate-950 font-sans flex flex-col">
            <Header
                isLiveMode={isLiveMode}
                setIsLiveMode={setIsLiveMode}
                currentView={view}
                setView={setView}
                currentUser={currentUser}
                users={MOCK_USERS}
                onSwitchUser={handleSwitchUser}
            />
            <main className="pt-24 px-4 sm:px-6 lg:px-8 flex-grow">
                {renderContent()}
            </main>
            <Footer />
        </div>
    );
};

export default App;