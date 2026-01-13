import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';

const { SETTINGS: STORAGE_KEY } = STORAGE_KEYS;

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Migration: If voiceSettings is missing, create it from legacy voiceURI or defaults
                if (!parsed.voiceSettings) {
                    parsed.voiceSettings = {
                        ...DEFAULT_SETTINGS.voiceSettings,
                        voiceURI: parsed.voiceURI || null
                    };
                    // Clean up legacy
                    delete parsed.voiceURI;
                }
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
            return DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    // Apply theme and persist settings
    useEffect(() => {
        // Apply theme to document
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Persist to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to persist settings:', e);
        }
    }, [settings]);

    const toggleTheme = useCallback(() => {
        setSettings(prev => ({
            ...prev,
            theme: prev.theme === 'dark' ? 'light' : 'dark'
        }));
    }, []);

    const updateSettings = useCallback((updates: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
    }, []);

    return {
        settings,
        setSettings,
        toggleTheme,
        updateSettings,
        resetSettings,
        isDarkMode: settings.theme === 'dark'
    };
}
