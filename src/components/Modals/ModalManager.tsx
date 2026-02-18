import React, { useCallback } from 'react';
import { toast } from 'sonner';
import {
    SettingsModal,
    ExportModal,
    ImportModal,
    ShortcutsModal,
    SummaryPanel,
    SettingsErrorBoundary
} from '..';
import { useUI } from '../../contexts/UIContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useChatContext } from '../../contexts/ChatContext';
import { ExportFormat } from '../../utils/exportImport';

export const ModalManager: React.FC = () => {
    const {
        isSettingsOpen,
        setSettingsOpen,
        isExportOpen,
        setExportOpen,
        isImportOpen,
        setImportOpen,
        isSummaryOpen,
        setSummaryOpen,
        isShortcutsOpen,
        setShortcutsOpen
    } = useUI();

    const { settings, setSettings } = useSettingsContext(); // Assuming setSettings is exposed or updateSettings
    // useSettingsState returns setSettings.

    const {
        messages,
        exportData,
        importData
    } = useChatContext();

    const handleExport = useCallback(async (format: ExportFormat, options: { includeImages: boolean }) => {
        try {
            const blob = await exportData(format, options);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.download = `echobot-export-${timestamp}.${format === 'markdown' ? 'md' : format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(`Exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error(error);
            toast.error('Export failed');
        }
    }, [exportData]);

    const handleImport = useCallback(async (content: string) => {
        return await importData(content);
    }, [importData]);

    return (
        <>
            <SettingsErrorBoundary onClose={() => setSettingsOpen(false)}>
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    settings={settings}
                    onSave={setSettings}
                />
            </SettingsErrorBoundary>

            <ExportModal
                isOpen={isExportOpen}
                onClose={() => setExportOpen(false)}
                onExport={handleExport}
            />

            <ImportModal
                isOpen={isImportOpen}
                onClose={() => setImportOpen(false)}
                onImport={handleImport}
            />

            <ShortcutsModal
                isOpen={isShortcutsOpen}
                onClose={() => setShortcutsOpen(false)}
            />

            <SummaryPanel
                isOpen={isSummaryOpen}
                onClose={() => setSummaryOpen(false)}
                messages={messages}
                settings={settings}
            />
        </>
    );
};
