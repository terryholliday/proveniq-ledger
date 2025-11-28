
import { Block } from '../types';
import { mockSha256Sync } from '../constants';

export interface VerificationResult {
    success: boolean;
    failedBlockId?: string;
    message: string;
}

// A helper function to introduce a small delay to visualize the verification process
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const verifyLedger = async (
    blocks: Block[],
    onProgressCallback: (blockId: string | null) => void
): Promise<VerificationResult> => {
    // Iterate from the newest block to the oldest
    for (let i = blocks.length - 1; i >= 0; i--) {
        const block = blocks[i];
        onProgressCallback(block.id);
        await delay(150); // Simulate work

        // 1. Integrity Check: Recalculate hash and compare
        const { hash: storedHash, ...blockContent } = block;
        const hashableString = JSON.stringify({
            id: blockContent.id,
            timestamp: blockContent.timestamp,
            transactions: blockContent.transactions,
        }) + blockContent.previousHash;
        
        const recalculatedHash = mockSha256Sync(hashableString);

        if (recalculatedHash !== storedHash) {
            onProgressCallback(null);
            return {
                success: false,
                failedBlockId: block.id,
                message: `Data Tampering Detected! Block ${block.id} has been altered. The calculated hash does not match the stored hash.`,
            };
        }

        // 2. Chain Check: Compare previousHash with the previous block's actual hash
        if (i > 0) {
            const previousBlock = blocks[i - 1];
            const previousBlockActualHash = previousBlock.hash;
            if (block.previousHash !== previousBlockActualHash) {
                onProgressCallback(null);
                return {
                    success: false,
                    failedBlockId: block.id,
                    message: `Chain Broken! The 'previousHash' of block ${block.id} does not match the actual hash of block ${previousBlock.id}.`,
                };
            }
        } else {
            // Check Genesis block's previousHash
            if (block.previousHash !== '0'.repeat(64)) {
                onProgressCallback(null);
                return {
                    success: false,
                    failedBlockId: block.id,
                    message: 'Invalid Genesis Block! The first block in the chain has an incorrect "previousHash".',
                };
            }
        }
    }

    onProgressCallback(null);
    return {
        success: true,
        message: 'Ledger Integrity Verified. All blocks are cryptographically linked and untampered.',
    };
};
