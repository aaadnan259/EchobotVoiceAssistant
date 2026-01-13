import React, { useEffect, useState } from 'react';
import { Play, Square, Mic } from 'lucide-react';
import { VoiceSettings as VoiceSettingsType } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface VoiceSettingsProps {
    settings: VoiceSettingsType;
    onChange: (settings: VoiceSettingsType) => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ settings, onChange }) => {
    const { speak, stop, isSpeaking, getVoices } = useSpeechSynthesis();
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const load = () => {
            setVoices(window.speechSynthesis.getVoices());
        };
        load();
        window.speechSynthesis.onvoiceschanged = load;
    }, []);

    const handleChange = (key: keyof VoiceSettingsType, value: any) => {
        onChange({ ...settings, [key]: value });
    };

    const handleTest = () => {
        if (isSpeaking) {
            stop();
        } else {
            speak("Hello! I am EchoBot. This is how I sound.", {
                voiceURI: settings.voiceURI,
                rate: settings.rate,
                pitch: settings.pitch,
                volume: settings.volume
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Voice Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Theme Voice</label>
                <select
                    value={settings.voiceURI || ''}
                    onChange={(e) => handleChange('voiceURI', e.target.value)}
                    className="w-full p-2 bg-gray-50 dark:bg-[#0B0D18] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                    <option value="">Default System Voice</option>
                    {voices.map(v => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                        </option>
                    ))}
                </select>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Rate */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                        <span>Speed</span>
                        <span>{settings.rate}x</span>
                    </label>
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={settings.rate}
                        onChange={(e) => handleChange('rate', parseFloat(e.target.value))}
                        className="w-full accent-purple-600"
                    />
                </div>

                {/* Pitch */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                        <span>Pitch</span>
                        <span>{settings.pitch}</span>
                    </label>
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={settings.pitch}
                        onChange={(e) => handleChange('pitch', parseFloat(e.target.value))}
                        className="w-full accent-purple-600"
                    />
                </div>

                {/* Volume */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                        <span>Volume</span>
                        <span>{Math.round(settings.volume * 100)}%</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.volume}
                        onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
                        className="w-full accent-purple-600"
                    />
                </div>
            </div>

            {/* Test and Auto-Speak */}
            <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={settings.autoSpeak}
                        onChange={(e) => handleChange('autoSpeak', e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Auto-read responses
                </label>

                <button
                    onClick={handleTest}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSpeaking
                            ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}
                >
                    {isSpeaking ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    {isSpeaking ? 'Stop' : 'Test Voice'}
                </button>
            </div>

        </div>
    );
};
