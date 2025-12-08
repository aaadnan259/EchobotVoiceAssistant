import { Mic, MicOff, Sun, Moon, Volume2, VolumeX } from 'lucide-react';

interface TopBarProps {
  isMicActive: boolean;
  onMicToggle: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  isVoiceEnabled: boolean;
  onVoiceToggle: () => void;
}

export function TopBar({ isMicActive, onMicToggle, theme, onThemeToggle, isVoiceEnabled, onVoiceToggle }: TopBarProps) {
  const handleLogoClick = () => {
    window.location.reload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-[70px] z-50">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-white/50 dark:bg-black/20 backdrop-blur-xl border-b border-black/5 dark:border-white/5" />

      <div className="relative h-full px-6 flex items-center justify-between">
        {/* Left: Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
          title="Reload Application"
        >
          <img
            src="/echobot-logo.png"
            alt="EchoBot Logo"
            className="w-10 h-10 rounded-full shadow-lg shadow-indigo-500/20 object-cover"
          />
          <span className="text-slate-900 dark:text-white font-medium tracking-wide text-lg">EchoBot</span>
        </div>

        {/* Right: Action Icons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onThemeToggle}
            className="w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-gray-600 dark:text-white/70" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600 dark:text-white/70" />
            )}
          </button>

          <button
            onClick={onVoiceToggle}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${isVoiceEnabled
              ? 'bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'
              : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
              }`}
            aria-label="Toggle voice output"
          >
            {isVoiceEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-600 dark:text-white/70" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={onMicToggle}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${isMicActive
              ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40'
              : 'bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
            aria-label="Toggle microphone"
          >
            {isMicActive ? (
              <Mic className="w-5 h-5 text-white" />
            ) : (
              <MicOff className="w-5 h-5 text-gray-600 dark:text-white/70" />
            )}
          </button>


        </div>
      </div>
    </div>
  );
}