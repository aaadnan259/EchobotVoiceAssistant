import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SettingsData {
    openai_api_key: string;
    voice_speed: number;
    wake_word_sensitivity: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<SettingsData>({
        openai_api_key: '',
        voice_speed: 1.0,
        wake_word_sensitivity: 0.5,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load settings from backend on mount (or when modal opens)
    useEffect(() => {
        if (isOpen) {
            // In a real app, fetch from /api/settings
            // For now, load from localStorage or defaults
            const savedSettings = localStorage.getItem('echobot_settings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            }
        }
    }, [isOpen]);

    const handleChange = (field: keyof SettingsData, value: string | number) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // 1. Save to Backend
            const response = await fetch('http://localhost:8000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (!response.ok) throw new Error('Failed to save settings');

            // 2. Save to LocalStorage (for persistence across reloads if backend is slow)
            localStorage.setItem('echobot_settings', JSON.stringify(settings));

            onClose();
        } catch (err) {
            setError('Failed to save settings. Is the backend running?');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                    <h2 className="text-xl font-semibold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 text-sm text-red-200 bg-red-900/30 border border-red-500/30 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* API Key */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">OpenAI API Key</label>
                        <input
                            type="password"
                            value={settings.openai_api_key}
                            onChange={(e) => handleChange('openai_api_key', e.target.value)}
                            className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            placeholder="sk-..."
                        />
                    </div>

                    {/* Voice Speed */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium text-slate-400">Voice Speed</label>
                            <span className="text-xs text-slate-500">{settings.voice_speed}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={settings.voice_speed}
                            onChange={(e) => handleChange('voice_speed', parseFloat(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    {/* Wake Word Sensitivity */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium text-slate-400">Wake Word Sensitivity</label>
                            <span className="text-xs text-slate-500">{Math.round(settings.wake_word_sensitivity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={settings.wake_word_sensitivity}
                            onChange={(e) => handleChange('wake_word_sensitivity', parseFloat(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
