
import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ShortcutItem {
    id: string;
    keys: string[];
    description: string;
}

const SHORTCUTS: Record<string, ShortcutItem[]> = {
    'General': [
        { id: 'help', keys: ['Mod', '/'], description: 'Show keyboard shortcuts' },
        { id: 'settings', keys: ['Mod', ','], description: 'Open settings' },
        { id: 'theme', keys: ['Mod', 'J'], description: 'Toggle theme' },
        { id: 'close', keys: ['Esc'], description: 'Close modals' },
    ],
    'Chat': [
        { id: 'send', keys: ['Mod', 'Enter'], description: 'Send message' },
        { id: 'clear', keys: ['Mod', 'K'], description: 'Clear chat conversation' },
        { id: 'search', keys: ['Mod', 'F'], description: 'Search messages' },
        { id: 'voice', keys: ['Mod', 'Shift', 'V'], description: 'Toggle voice input' },
    ],
    'Export & Import': [
        { id: 'export', keys: ['Mod', 'E'], description: 'Export conversation' },
        { id: 'import', keys: ['Mod', 'I'], description: 'Import conversation' },
    ]
};

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-2xl bg-white dark:bg-[#1C1F2E] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
                role="dialog"
                aria-labelledby="shortcuts-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <Keyboard size={20} />
                        </div>
                        <h2 id="shortcuts-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                            Keyboard Shortcuts
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                        aria-label="Close shortcuts"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid gap-8 sm:grid-cols-2">
                        {Object.entries(SHORTCUTS).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="mb-4 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {category}
                                </h3>
                                <div className="space-y-3">
                                    {items.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between group">
                                            <span className="text-gray-700 dark:text-gray-300">
                                                {item.description}
                                            </span>
                                            <div className="flex gap-1">
                                                {item.keys.map((key, i) => (
                                                    <kbd
                                                        key={i}
                                                        className="min-w-[24px] h-6 px-1.5 flex items-center justify-center text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 rounded border border-gray-200 dark:border-white/10 shadow-sm font-sans"
                                                    >
                                                        {key === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : key}
                                                    </kbd>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 text-center text-sm text-gray-500 dark:text-gray-400">
                    Press <kbd className="font-sans font-medium px-1">Esc</kbd> to close
                </div>
            </div>
        </div>
    );
};
