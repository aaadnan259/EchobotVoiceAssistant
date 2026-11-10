import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
    isDownloadsOpen: boolean;
    setDownloadsOpen: (open: boolean) => void;
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
    // a shared link to the site ending in #downloads opens the downloads straight away
    const [isDownloadsOpen, setDownloadsOpenState] = useState(
        () => typeof window !== 'undefined' && window.location.hash === '#downloads'
    );
    useEffect(() => {
        const onHash = () => { if (window.location.hash === '#downloads') setDownloadsOpenState(true); };
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);
    const setDownloadsOpen = (open: boolean) => {
        setDownloadsOpenState(open);
        if (!open && typeof window !== 'undefined' && window.location.hash === '#downloads') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    };

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
        isDownloadsOpen,
        setDownloadsOpen,
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
