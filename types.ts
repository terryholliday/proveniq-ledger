export interface Transaction {
    id: string;
    timestamp: string;
    user: string; // Could be a username or "System"
    action: string;
    details: string;
}

export interface Block {
    id: string; // Claim ID
    timestamp: string;
    transactions: Transaction[];
    hash: string;
    previousHash: string;
    caseId?: string;
}

export interface Anomaly {
    blockId: string;
    reason: string;
}

export interface FraudScore {
    blockId: string;
    score: number; // 0-100
    level: 'Low' | 'Medium' | 'High';
    justification: string;
}

export interface Annotation {
    id: string;
    transactionId: string;
    user: string;
    timestamp: string;
    comment: string;
}

export interface ComplianceViolation {
    transactionId: string;
    ruleId: string;
    message: string;
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    details: string;
}

// --- NEW: RBAC Types ---
export type UserRole = 'Administrator' | 'Auditor' | 'Viewer';

export interface User {
    id: string;
    email: string;
    role: UserRole;
}