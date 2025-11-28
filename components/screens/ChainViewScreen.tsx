
import React from 'react';
import { Block } from '../../types';

interface ChainViewScreenProps {
    blocks: Block[];
    onSelectBlock: (id: string) => void;
    verifyingBlockId: string | null;
    failedBlockId?: string | null;
}

const ChainViewScreen: React.FC<ChainViewScreenProps> = ({ blocks, onSelectBlock, verifyingBlockId, failedBlockId }) => {
    return (
        <div className="w-full overflow-x-auto pb-8">
            <div className="flex items-center space-x-4 p-4 min-w-max">
                {blocks.map((block, index) => {
                    const isVerifying = verifyingBlockId === block.id;
                    const isFailing = failedBlockId === block.id;

                    return (
                        <React.Fragment key={block.id}>
                            <div
                                onClick={() => onSelectBlock(block.id)}
                                className={`cursor-pointer flex-shrink-0 w-64 h-40 bg-slate-900 border-2 rounded-lg p-4 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-electric-blue/20
                                ${isFailing ? 'border-red-500' : isVerifying ? 'border-electric-blue animate-pulseVerify shadow-lg shadow-electric-blue/30' : 'border-slate-800'}`
                                }
                            >
                                <div>
                                    <h4 className="font-bold text-slate-100 truncate">{block.id}</h4>
                                    <p className="text-xs text-slate-400 mt-1">{block.transactions.length} Transactions</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Hash</p>
                                    <p className="font-mono text-xs text-electric-green truncate">{block.hash}</p>
                                </div>
                            </div>
                            {index < blocks.length - 1 && (
                                <div className="flex-shrink-0 w-16 h-1 bg-slate-700 rounded-full"></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default ChainViewScreen;
