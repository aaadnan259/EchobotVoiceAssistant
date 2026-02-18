import React, { createContext, useContext, ReactNode } from 'react';
import { useSettingsState } from '../hooks/internal/useSettingsState';

// Return type of useSettingsState
type SettingsContextType = ReturnType<typeof useSettingsState>;

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const settingsState = useSettingsState();

    return (
        <SettingsContext.Provider value={settingsState}>
            {children}
        </SettingsContext.Provider>
    );
};

export function useSettingsContext() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettingsContext must be used within a SettingsProvider');
    }
    return context;
}
