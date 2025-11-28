import { Block, Transaction } from './types';

// A simple, *non-secure* hash function for demonstration purposes.
const mockSha256Sync = (data: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += ('00000000' + ((hash * (i + 1) * 31) >>> 0).toString(16)).slice(-8);
  }
  return result.slice(0, 64);
};

const ZERO_HASH = '0'.repeat(64);

const createBlock = (id: string, timestamp: string, transactions: Transaction[], previousHash: string, caseId?: string): Block => {
    const blockContent = { id, timestamp, transactions, caseId };
    const hashableString = JSON.stringify({id, timestamp, transactions, caseId}) + previousHash;
    const hash = mockSha256Sync(hashableString);
    return { ...blockContent, hash, previousHash };
};

const buildChain = (): Block[] => {
    const chain: Block[] = [];

    // Genesis Block
    const genesisTransactions: Transaction[] = [
        { id: 'T001', timestamp: '2024-07-28T10:00:00Z', user: 'System', action: 'CLAIM_CREATED', details: 'Initial claim filed for policy #P12345.' },
        { id: 'T002', timestamp: '2024-07-28T10:05:00Z', user: 'j.doe', action: 'DOCUMENT_UPLOADED', details: 'Uploaded photo_of_damage.jpg.' },
    ];
    const genesisBlock = createBlock('CLM-2024-0751', '2024-07-28T10:05:00Z', genesisTransactions, ZERO_HASH, 'CASE-HUR-24-01');
    chain.push(genesisBlock);

    // Second Block
    const block2Transactions: Transaction[] = [
        { id: 'T003', timestamp: '2024-07-28T11:30:00Z', user: 'System', action: 'CLAIM_CREATED', details: 'Initial claim filed for policy #P67890.' },
        { id: 'T004', timestamp: '2024-07-28T11:32:00Z', user: 'a.smith', action: 'DOCUMENT_UPLOADED', details: 'Uploaded police_report.pdf.' },
        { id: 'T005', timestamp: '2024-07-28T12:00:00Z', user: 'System', action: 'ASSESSMENT_COMPLETE', details: 'Automated damage assessment calculated at $1,500.' },
    ];
    const block2 = createBlock('CLM-2024-0752', '2024-07-28T12:00:00Z', block2Transactions, chain[0].hash);
    chain.push(block2);

    // Third Block
    const block3Transactions: Transaction[] = [
        { id: 'T006', timestamp: '2024-07-29T09:15:00Z', user: 'System', action: 'CLAIM_CREATED', details: 'Initial claim filed for policy #P54321.' },
    ];
    const block3 = createBlock('CLM-2024-0753', '2024-07-29T09:15:00Z', block3Transactions, chain[1].hash, 'CASE-HUR-24-01');
    chain.push(block3);
    
    // Fourth Block
    const block4Transactions: Transaction[] = [
        { id: 'T007', timestamp: '2024-07-29T14:00:00Z', user: 'System', action: 'CLAIM_CREATED', details: 'Initial claim filed for policy #P98765.' },
        { id: 'T008', timestamp: '2024-07-29T14:05:00Z', user: 'm.jones', action: 'DOCUMENT_UPLOADED', details: 'Uploaded invoice_1.pdf.' },
        { id: 'T009', timestamp: '2024-07-29T14:06:00Z', user: 'm.jones', action: 'DOCUMENT_UPLOADED', details: 'Uploaded invoice_2.pdf.' },
        { id: 'T010', timestamp: '2024-07-29T15:00:00Z', user: 'System', action: 'PAYMENT_ISSUED', details: 'Payment of $5,250 issued to claimant. Reason: Approved repair costs.' },
    ];
    const block4 = createBlock('CLM-2024-0754', '2024-07-29T15:00:00Z', block4Transactions, chain[2].hash);
    chain.push(block4);

    return chain;
};

export const MOCK_LEDGER = buildChain();

export const getNextBlock = (previousBlock: Block, currentLedger: Block[]): Block => {
    const newClaimIdNumber = 754 + (currentLedger.length - 3);
    const newClaimId = `CLM-2024-0${newClaimIdNumber}`;
    const now = new Date();
    const timestamp = now.toISOString();
    const newTransactionId = `T${String(currentLedger.flatMap(b => b.transactions).length + 1).padStart(3, '0')}`;

    const newTransactions: Transaction[] = [
        { id: newTransactionId, timestamp, user: 'System', action: 'CLAIM_CREATED', details: `Live claim filed for policy #P${Math.floor(Math.random() * 90000) + 10000}.` },
    ];

    return createBlock(newClaimId, timestamp, newTransactions, previousBlock.hash);
};

// Re-export mockSha256Sync for use in verification service
export { mockSha256Sync };
