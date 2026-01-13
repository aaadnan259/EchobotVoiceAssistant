import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sun, Moon, Volume2, VolumeX, Download, Upload, Keyboard, RotateCcw, Save, Trash2, Settings, Search, X } from 'lucide-react';
import { playSound } from '../constants';

interface TopBarProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  onReset: () => void;
  onSaveChat: () => void;
  onClearChat: () => void;
  onOpenSettings: () => void;

  isMicActive: boolean;
  onMicToggle: () => void;
  isVoiceEnabled: boolean;
  onVoiceToggle: () => void;

  onExportClick: () => void;
  onImportClick: () => void;
  onShortcutsClick: () => void;
  onSummarizeClick: () => void;

  // Search Props
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TopBar({
  isDarkMode,
  toggleTheme,
  onReset,
  onSaveChat,
  onClearChat,
  onOpenSettings,
  isMicActive,
  onMicToggle,
  isVoiceEnabled,
  onVoiceToggle,
  onExportClick,
  onImportClick,
  onShortcutsClick,
  onSummarizeClick,
  searchQuery,
  onSearchChange
}: TopBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleLogoClick = () => {
    window.location.reload();
  };

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 10);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        if (searchQuery) {
          onSearchChange(''); // Clear query first
        } else {
          setIsSearchOpen(false); // Then close
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, searchQuery, onSearchChange]);

  return (
    <div className="fixed top-0 left-0 right-0 h-[70px] z-50">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-background/80 dark:bg-[#0B0D18]/80 backdrop-blur-xl border-b border-white/10 transition-colors duration-300" />

      <div className="relative h-full px-6 flex items-center justify-between">
        {/* Left: Logo & Title */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
          title="Reload Application"
        >
          {/* Task 1: Fixed Logo - No white circle */}
          <div className="w-10 h-10 rounded-full shadow-lg shadow-purple-500/40 overflow-hidden relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <radialGradient id="logoGradient" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#d8b4fe" />
                  <stop offset="50%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#4c1d95" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="50" fill="url(#logoGradient)" />
              <ellipse cx="35" cy="45" rx="6" ry="10" fill="white" transform="rotate(-10 35 45)" />
              <ellipse cx="65" cy="45" rx="6" ry="10" fill="white" transform="rotate(10 65 45)" />
            </svg>
          </div>
          <span className="text-gray-900 dark:text-white font-medium tracking-wide text-lg hidden sm:block">EchoBot</span>
        </div>

        {/* Right: Action Icons */}
        <div className="flex items-center gap-1">
          {/* Search - Collapsible */}
           <div className="relative flex items-center mr-2">
            <div className={`
                flex items-center transition-all duration-300 ease-in-out overflow-hidden
                ${isSearchOpen ? 'w-48 opacity-100' : 'w-0 opacity-0'}
            `}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search messages..."
                className="w-full h-8 px-3 text-sm rounded-lg bg-gray-100 dark:bg-white/10 border border-transparent dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
               {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
               onClick={() => {
                if (isSearchOpen && !searchQuery) setIsSearchOpen(false);
                else {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 10);
                }
              }}
              className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors group"
              title="Search messages (Ctrl+F)"
            >
              <Search className="w-5 h-5 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Save */}
          <button
            onClick={onSaveChat}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors group"
            title="Save chat"
          >
            <Download className="w-5 h-5 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
          </button>

          {/* Clear */}
          <button
            onClick={onClearChat}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors group"
            title="Clear chat"
          >
            <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
          </button>

           {/* Theme Toggle */}
           <button
            onClick={toggleTheme}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors group"
            title="Toggle theme"
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-gray-400 group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors" />
            ) : (
              <Moon className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
            )}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors group"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}