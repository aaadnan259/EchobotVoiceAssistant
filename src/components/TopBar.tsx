import { Settings, Mic, MicOff, Sun, Moon } from 'lucide-react';

interface TopBarProps {
  isMicActive: boolean;
  onMicToggle: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

export function TopBar({ isMicActive, onMicToggle, theme, onThemeToggle }: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 h-[70px] z-50">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-xl border-b border-white/5" />
      
      <div className="relative h-full px-6 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <div className="w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm" />
          </div>
          <span className="text-white tracking-wide">EchoBot</span>
        </div>

        {/* Right: Action Icons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onThemeToggle}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-white/70" />
            ) : (
              <Moon className="w-5 h-5 text-white/70" />
            )}
          </button>

          <button
            onClick={onMicToggle}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${
              isMicActive 
                ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40' 
                : 'bg-white/5 hover:bg-white/10'
            }`}
            aria-label="Toggle microphone"
          >
            {isMicActive ? (
              <Mic className="w-5 h-5 text-white" />
            ) : (
              <MicOff className="w-5 h-5 text-white/70" />
            )}
          </button>

          <button
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
}