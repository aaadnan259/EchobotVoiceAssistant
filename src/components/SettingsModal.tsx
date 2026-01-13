import React, { useEffect, useState } from 'react';
import { ThemePicker } from './ThemePicker';
import { VoiceSettings } from './VoiceSettings';
import { AppSettings, VoiceOption } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const avail = window.speechSynthesis.getVoices().map(v => ({
        name: v.name,
        uri: v.voiceURI,
        lang: v.lang
      }));
      setVoices(avail);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (isOpen) setLocalSettings(settings);
  }, [isOpen, settings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-white dark:bg-[#131625] w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Model Display (Read Only) */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Model</label>
            <div className="w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 text-sm font-mono">
              {localSettings.model}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">System Prompt</label>
            <textarea
              value={localSettings.systemPrompt}
              onChange={(e) => setLocalSettings({ ...localSettings, systemPrompt: e.target.value })}
              className="w-full h-32 p-3 bg-gray-50 dark:bg-[#0B0D18] border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
              placeholder="How should EchoBot behave?"
            />
          </div>

          {/* Theme */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Appearance</h3>
            <ThemePicker
              currentThemeId={localSettings.theme}
              onSelect={(id) => setLocalSettings(prev => ({ ...prev, theme: id }))}
            />
          </section>

          {/* Voice Selection */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Voice & Speech</h3>
            <VoiceSettings
              settings={localSettings.voiceSettings}
              onChange={(vs) => setLocalSettings(prev => ({ ...prev, voiceSettings: vs }))}
            />
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg shadow-purple-500/30 transition-all transform active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;