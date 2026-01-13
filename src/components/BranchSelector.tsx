import React, { memo } from 'react';

interface BranchSelectorProps {
    currentBranch: number;
    totalBranches: number;
    onPrev: () => void;
    onNext: () => void;
}

export const BranchSelector: React.FC<BranchSelectorProps> = memo(({
    currentBranch,
    totalBranches,
    onPrev,
    onNext
}) => {
    if (totalBranches <= 1) return null;

    return (
        <div className="flex items-center gap-2 text-xs text-gray-400 select-none animate-[fadeIn_0.2s_ease-out]">
            <button
                onClick={onPrev}
                disabled={currentBranch <= 1}
                className="p-1 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous branch"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>

            <span className="font-mono opacity-60">
                {currentBranch} / {totalBranches}
            </span>

            <button
                onClick={onNext}
                disabled={currentBranch >= totalBranches}
                className="p-1 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next branch"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        </div>
    );
});
