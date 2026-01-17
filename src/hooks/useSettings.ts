import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppSettings } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
import { getThemeById } from '../utils/themes';

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

    // Persist settings to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to persist settings:', e);
        }
    }, [settings]);

    const toggleTheme = useCallback(() => {
        setSettings(prev => ({
            ...prev,
            theme: prev.theme === 'light' ? 'dark' : 'light'
        }));
    }, []);

    const updateSettings = useCallback((updates: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
    }, []);

    // Check if current theme is a dark theme (forest, sunset, ocean, dark, etc.)
    const isDarkMode = useMemo(() => {
        const theme = getThemeById(settings.theme);
        return theme.type === 'dark';
    }, [settings.theme]);

    return {
        settings,
        setSettings,
        toggleTheme,
        updateSettings,
        resetSettings,
        isDarkMode
    };
}
