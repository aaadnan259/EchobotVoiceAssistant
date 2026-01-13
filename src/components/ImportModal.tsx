import React, { useRef, useState } from 'react';
import { X, Upload, FileJson, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (content: string) => Promise<boolean>;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [previewName, setPreviewName] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        validateAndReadFile(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) validateAndReadFile(file);
    };

    const validateAndReadFile = (file: File) => {
        if (!file.name.endsWith('.json')) {
            toast.error('Only JSON files are supported for import');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setFileContent(result);
            setPreviewName(file.name);
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = async () => {
        if (!fileContent) return;

        setIsImporting(true);
        const success = await onImport(fileContent);
        setIsImporting(false);

        if (success) {
            toast.success('Conversation imported successfully');
            onClose();
        } else {
            toast.error('Invalid import file format');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-[#1C1F2E] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-black/10 dark:border-white/10">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-indigo-500" />
                        Import Conversation
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-3 text-sm text-yellow-700 dark:text-yellow-400">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p>Importing will replace your current conversation. Make sure to back up (Export JSON) first!</p>
                    </div>

                    {!fileContent ? (
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragOver
                                    ? 'border-indigo-500 bg-indigo-500/5'
                                    : 'border-gray-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400">
                                <FileJson className="w-6 h-6" />
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white mb-1">Click to upload or drag & drop</p>
                            <p className="text-sm text-gray-500">Only .json files supported</p>
                        </div>
                    ) : (
                        <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <FileJson className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{previewName}</div>
                                    <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Ready to import
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setFileContent(null);
                                    setPreviewName(null);
                                }}
                                className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-gray-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

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
                        onClick={handleConfirmImport}
                        disabled={!fileContent || isImporting}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                        {isImporting ? 'Importing...' : 'Import Conversation'}
                    </button>
                </div>

            </div>
        </div>
    );
};
