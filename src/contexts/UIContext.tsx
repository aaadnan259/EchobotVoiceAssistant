import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface UIContextType {
    isSettingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    isExportOpen: boolean;
    setExportOpen: (open: boolean) => void;
    isImportOpen: boolean;
    setImportOpen: (open: boolean) => void;
    isSummaryOpen: boolean;
    setSummaryOpen: (open: boolean) => void;
    isShortcutsOpen: boolean;
    setShortcutsOpen: (open: boolean) => void;
    isOnline: boolean;
    isDragging: boolean;
    setDragging: (dragging: boolean) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [isExportOpen, setExportOpen] = useState(false);
    const [isImportOpen, setImportOpen] = useState(false);
    const [isSummaryOpen, setSummaryOpen] = useState(false);
    const [isShortcutsOpen, setShortcutsOpen] = useState(false);
    const [isDragging, setDragging] = useState(false);

    const isOnline = useOnlineStatus();

    const value = {
        isSettingsOpen,
        setSettingsOpen,
        isExportOpen,
        setExportOpen,
        isImportOpen,
        setImportOpen,
        isSummaryOpen,
        setSummaryOpen,
        isShortcutsOpen,
        setShortcutsOpen,
        isOnline,
        isDragging,
        setDragging
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
};

export function useUI() {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
}
