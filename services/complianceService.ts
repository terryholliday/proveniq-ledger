import { Block, ComplianceViolation, Transaction } from '../types';

interface ComplianceRule {
    id: string;
    description: string;
    validate: (tx: Transaction, block: Block) => boolean;
}

const RULES: ComplianceRule[] = [
    {
        id: 'PAYMENT_REASON_REQUIRED',
        description: 'Payments issued must contain a clear reason in the details.',
        validate: (tx) => {
            if (tx.action === 'PAYMENT_ISSUED') {
                return tx.details.toLowerCase().includes('reason:');
            }
            return true;
        },
    },
    {
        id: 'DOC_UPLOAD_BY_NON_SYSTEM',
        description: 'Documents must be uploaded by a named user, not "System".',
        validate: (tx) => {
             if (tx.action === 'DOCUMENT_UPLOADED') {
                return tx.user.toLowerCase() !== 'system';
            }
            return true;
        }
    },
    {
        id: 'ASSESSMENT_BY_SYSTEM',
        description: 'Damage assessments should be performed by the "System".',
        validate: (tx) => {
            if (tx.action === 'ASSESSMENT_COMPLETE') {
                return tx.user.toLowerCase() === 'system';
            }
            return true;
        }
    }
];

export const checkBlockCompliance = (block: Block): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    for (const tx of block.transactions) {
        for (const rule of RULES) {
            if (!rule.validate(tx, block)) {
                violations.push({
                    transactionId: tx.id,
                    ruleId: rule.id,
                    message: rule.description,
                });
            }
        }
    }
    return violations;
};

export const checkAllBlocksCompliance = (blocks: Block[]): Record<string, ComplianceViolation[]> => {
    const allViolations: Record<string, ComplianceViolation[]> = {};
    for (const block of blocks) {
        const blockViolations = checkBlockCompliance(block);
        if (blockViolations.length > 0) {
            allViolations[block.id] = blockViolations;
        }
    }
    return allViolations;
}
