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
        <div className="flex items-center gap-3">

          {/* Task 2: Search Bar */}
          <div className="relative flex items-center mr-2">
            <div className={`
                flex items-center transition-all duration-300 ease-in-out overflow-hidden
                ${isSearchOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'}
            `}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search history..."
                className="w-full h-9 pl-3 pr-8 rounded-full bg-gray-100 dark:bg-white/10 border border-transparent dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
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
              className={`p-2 rounded-full transition-colors ${isSearchOpen ? 'bg-purple-500/10 text-purple-500' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}
              title="Search messages (Ctrl+F)"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1 hidden sm:block" />

          {/* Core Actions Group */}
          <button
            onClick={onReset}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors hidden md:block"
            title="Reset Chat"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={onSaveChat}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors hidden md:block"
            title="Quick Save"
          >
            <Save className="w-5 h-5" />
          </button>

          <button
            onClick={onExportClick}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
            title="Export"
          >
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={onImportClick}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
            title="Import"
          >
            <Upload className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1 hidden sm:block" />

          {/* Settings & System */}
          <button
            onClick={onShortcutsClick}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors hidden sm:block"
            title="Shortcuts"
          >
            <Keyboard className="w-5 h-5" />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1" />

          {/* Voice Controls */}
          <button
            onClick={onVoiceToggle}
            className={`p-2 rounded-full transition-colors ${!isVoiceEnabled ? 'text-red-500 bg-red-500/10' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            title={isVoiceEnabled ? "Mute Voice" : "Enable Voice"}
          >
            {isVoiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={onMicToggle}
            className={`p-2 rounded-full transition-all duration-300 transform hover:scale-105 ${isMicActive
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30'
              }`}
            title={isMicActive ? "Stop Listening" : "Start Listening"}
          >
            {isMicActive ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}