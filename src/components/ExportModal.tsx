import React, { useState } from 'react';
import { X, Download, FileJson, FileType, Code } from 'lucide-react';
import { ExportFormat } from '../utils/exportImport';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (format: ExportFormat, options: { includeImages: boolean }) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport }) => {
    const [format, setFormat] = useState<ExportFormat>('markdown');
    const [includeImages, setIncludeImages] = useState(true);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-[#1C1F2E] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-black/10 dark:border-white/10">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Download className="w-5 h-5 text-indigo-500" />
                        Export Conversation
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Format Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Format</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => setFormat('json')}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${format === 'json'
                                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                        : 'border-gray-200 dark:border-white/10 hover:border-indigo-400/50 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                            >
                                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-600">
                                    <FileJson className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold">JSON (Backup)</div>
                                    <div className="text-xs opacity-70">Complete history with all branches and metadata.</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setFormat('markdown')}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${format === 'markdown'
                                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                        : 'border-gray-200 dark:border-white/10 hover:border-indigo-400/50 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                            >
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                                    <FileType className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold">Markdown</div>
                                    <div className="text-xs opacity-70">Readable text file for the current conversation path.</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setFormat('html')}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${format === 'html'
                                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                        : 'border-gray-200 dark:border-white/10 hover:border-indigo-400/50 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                            >
                                <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600">
                                    <Code className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold">HTML</div>
                                    <div className="text-xs opacity-70">Web page format with styled messages and layout.</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Include Images</label>
                        <button
                            onClick={() => setIncludeImages(!includeImages)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeImages ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeImages ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onExport(format, { includeImages });
                            onClose();
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                        Download Export
                    </button>
                </div>

            </div>
        </div>
    );
};
