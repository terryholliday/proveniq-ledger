import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
  query, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Block, Transaction, Anomaly, FraudScore, Annotation, AuditLogEntry, ComplianceViolation, User } from '../types';

// =============================================================================
// CLAIMS (BLOCKS) OPERATIONS
// =============================================================================

export async function getClaims(): Promise<Block[]> {
  const claimsRef = collection(db, 'claims');
  const q = query(claimsRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  
  const claims: Block[] = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    
    // Get transactions subcollection
    const transactionsRef = collection(db, 'claims', docSnap.id, 'transactions');
    const transactionsSnap = await getDocs(query(transactionsRef, orderBy('timestamp', 'asc')));
    const transactions: Transaction[] = transactionsSnap.docs.map(t => ({
      id: t.id,
      ...t.data()
    } as Transaction));
    
    claims.push({
      id: docSnap.id,
      timestamp: data.timestamp,
      hash: data.hash,
      previousHash: data.previousHash,
      caseId: data.caseId,
      transactions
    });
  }
  
  return claims;
}

export async function addClaim(claim: Block): Promise<void> {
  const batch = writeBatch(db);
  
  // Add the claim document
  const claimRef = doc(db, 'claims', claim.id);
  batch.set(claimRef, {
    id: claim.id,
    timestamp: claim.timestamp,
    hash: claim.hash,
    previousHash: claim.previousHash,
    caseId: claim.caseId || null
  });
  
  // Add transactions as subcollection
  for (const transaction of claim.transactions) {
    const transactionRef = doc(db, 'claims', claim.id, 'transactions', transaction.id);
    batch.set(transactionRef, transaction);
  }
  
  await batch.commit();
}

export function subscribeToClaimsCount(callback: (count: number) => void): () => void {
  const claimsRef = collection(db, 'claims');
  return onSnapshot(claimsRef, (snapshot) => {
    callback(snapshot.size);
  });
}

// =============================================================================
// ANOMALIES OPERATIONS
// =============================================================================

export async function getAnomalies(): Promise<Anomaly[]> {
  const anomaliesRef = collection(db, 'anomalies');
  const snapshot = await getDocs(anomaliesRef);
  return snapshot.docs.map(doc => ({
    blockId: doc.data().blockId,
    reason: doc.data().reason
  }));
}

export async function addAnomaly(anomaly: Anomaly): Promise<void> {
  const anomaliesRef = collection(db, 'anomalies');
  await addDoc(anomaliesRef, {
    ...anomaly,
    detectedAt: Timestamp.now(),
    status: 'OPEN'
  });
}

// =============================================================================
// FRAUD SCORES OPERATIONS
// =============================================================================

export async function getFraudScores(): Promise<Record<string, FraudScore>> {
  const scoresRef = collection(db, 'fraudScores');
  const snapshot = await getDocs(scoresRef);
  
  const scores: Record<string, FraudScore> = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    scores[data.blockId] = {
      blockId: data.blockId,
      score: data.score,
      level: data.level,
      justification: data.justification
    };
  });
  return scores;
}

export async function addFraudScore(score: FraudScore): Promise<void> {
  const scoresRef = collection(db, 'fraudScores');
  await addDoc(scoresRef, {
    ...score,
    assessedAt: Timestamp.now(),
    modelVersion: 'fraud_model_v1.0'
  });
}

// =============================================================================
// ANNOTATIONS OPERATIONS
// =============================================================================

export async function getAnnotations(): Promise<Record<string, Annotation[]>> {
  const annotationsRef = collection(db, 'annotations');
  const snapshot = await getDocs(annotationsRef);
  
  const annotations: Record<string, Annotation[]> = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const annotation: Annotation = {
      id: doc.id,
      transactionId: data.transactionId,
      user: data.user,
      timestamp: data.timestamp,
      comment: data.comment
    };
    
    if (!annotations[data.transactionId]) {
      annotations[data.transactionId] = [];
    }
    annotations[data.transactionId].push(annotation);
  });
  return annotations;
}

export async function addAnnotation(annotation: Annotation): Promise<void> {
  const annotationsRef = collection(db, 'annotations');
  await addDoc(annotationsRef, annotation);
}

// =============================================================================
// COMPLIANCE VIOLATIONS OPERATIONS
// =============================================================================

export async function getComplianceViolations(): Promise<Record<string, ComplianceViolation[]>> {
  const violationsRef = collection(db, 'complianceViolations');
  const snapshot = await getDocs(violationsRef);
  
  const violations: Record<string, ComplianceViolation[]> = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const violation: ComplianceViolation = {
      transactionId: data.transactionId,
      ruleId: data.ruleId,
      message: data.message
    };
    
    // Group by blockId (we'll need to add blockId to the schema)
    const blockId = data.blockId || data.transactionId.split('-')[0];
    if (!violations[blockId]) {
      violations[blockId] = [];
    }
    violations[blockId].push(violation);
  });
  return violations;
}

// =============================================================================
// AUDIT LOG OPERATIONS
// =============================================================================

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const logRef = collection(db, 'auditLog');
  const q = query(logRef, orderBy('timestamp', 'desc'), limit(100));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    timestamp: doc.data().timestamp,
    user: doc.data().user,
    action: doc.data().action,
    details: doc.data().details
  }));
}

export async function addAuditLogEntry(entry: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry> {
  const logRef = collection(db, 'auditLog');
  const docRef = await addDoc(logRef, {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString()
  });
  return { id: docRef.id, ...entry } as AuditLogEntry;
}

// =============================================================================
// USERS OPERATIONS
// =============================================================================

export async function getUser(userId: string): Promise<User | null> {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);
  
  if (!snapshot.exists()) return null;
  
  const data = snapshot.data();
  return {
    id: snapshot.id,
    email: data.email,
    role: data.role
  };
}

export async function createUser(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.id);
  await setDoc(userRef, {
    email: user.email,
    role: user.role,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
}

// =============================================================================
// SEED DATA FUNCTION
// =============================================================================

export async function seedInitialData(claims: Block[]): Promise<void> {
  const batch = writeBatch(db);
  
  for (const claim of claims) {
    const claimRef = doc(db, 'claims', claim.id);
    batch.set(claimRef, {
      id: claim.id,
      timestamp: claim.timestamp,
      hash: claim.hash,
      previousHash: claim.previousHash,
      caseId: claim.caseId || null
    });
    
    for (const transaction of claim.transactions) {
      const transactionRef = doc(db, 'claims', claim.id, 'transactions', transaction.id);
      batch.set(transactionRef, transaction);
    }
  }
  
  await batch.commit();
  console.log(`Seeded ${claims.length} claims to Firestore`);
}

// =============================================================================
// CHECK IF DATA EXISTS
// =============================================================================

export async function hasExistingData(): Promise<boolean> {
  const claimsRef = collection(db, 'claims');
  const q = query(claimsRef, limit(1));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}
