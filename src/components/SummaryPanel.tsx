import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { summarizeConversation, SummaryLength, SummaryFocus } from '../services/summarizeService';
import { Message, AppSettings } from '../types';

interface SummaryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    messages: Message[];
    settings: AppSettings;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ isOpen, onClose, messages, settings }) => {
    const [summary, setSummary] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [length, setLength] = useState<SummaryLength>('medium');
    const [focus, setFocus] = useState<SummaryFocus>('general');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if (isOpen && !summary && !isLoading) {
            // Optional: Auto-generate on open? 
            // Let's wait for user action to avoid accidental API calls, 
            // or maybe auto-generate if empty.
            // Let's strictly require user button press for now to give them chance to set options.
        }
    }, [isOpen, summary, isLoading]);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await summarizeConversation(messages, { length, focus }, settings.model);
            setSummary(result);
        } catch (err: any) {
            setError(err.message || 'Failed to generate summary');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white/80 dark:bg-[#131625]/90 backdrop-blur-xl border-l border-white/20 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
                    Summary
                </h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Controls */}
            <div className="p-4 space-y-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Length</label>
                        <select
                            value={length}
                            onChange={(e) => setLength(e.target.value as SummaryLength)}
                            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        >
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="long">Detailed</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Focus</label>
                        <select
                            value={focus}
                            onChange={(e) => setFocus(e.target.value as SummaryFocus)}
                            className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        >
                            <option value="general">Overview</option>
                            <option value="action-items">Action Items</option>
                            <option value="decisions">Decisions</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all
                ${isLoading
                            ? 'bg-purple-500/50 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 active:scale-[0.98]'
                        }
            `}
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
                            {summary ? 'Regenerate Summary' : 'Generate Summary'}
                        </>
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {error ? (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                        {error}
                    </div>
                ) : summary ? (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                        <div className="prose dark:prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{summary}</ReactMarkdown>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <p className="text-sm">Select options and generate a summary</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            {summary && (
                <div className="p-4 border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md">
                    <button
                        onClick={handleCopy}
                        className="w-full py-2 px-4 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        {copied ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Copy to Clipboard
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SummaryPanel;
