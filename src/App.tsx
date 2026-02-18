import React from 'react';
import { SettingsProvider } from './contexts/SettingsContext';
import { UIProvider } from './contexts/UIContext';
import { ChatProvider } from './contexts/ChatContext';
import { MainLayout } from './components/Layout/MainLayout';
import { ChatInterface } from './components/Chat/ChatInterface';
import { ModalManager } from './components/Modals/ModalManager';
import { AppErrorBoundary } from './components/ErrorBoundaries';

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <UIProvider>
        <ChatProvider>
          <MainLayout>
            <ChatInterface />
            <ModalManager />
          </MainLayout>
        </ChatProvider>
      </UIProvider>
    </SettingsProvider>
  );
};

const AppWithErrorBoundary: React.FC = () => (
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

export default AppWithErrorBoundary;
