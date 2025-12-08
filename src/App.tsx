import { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { BotCharacter } from './components/BotCharacter';
import { ChatArea } from './components/ChatArea';
import { InputBar } from './components/InputBar';
import { SettingsModal } from './components/SettingsModal';
import { toast, Toaster } from 'sonner';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

type BotState = 'idle' | 'typing' | 'processing' | 'listening' | 'happy';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m EchoBot. How can I help you today?',
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [isMicActive, setIsMicActive] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('echobot_theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });
  const [botState, setBotState] = useState<BotState>('idle');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const ws = useRef<WebSocket | null>(null);
  const hasConnected = useRef(false);

  // Theme & Settings Persistence
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('echobot_theme', theme);
  }, [theme]);

  useEffect(() => {
    // Initial load logic if needed, or just let the main effect handle it.
    // We already init state so the effect above runs on mount.

    // Load Voice Settings
    const savedSettings = localStorage.getItem('echobot_settings');
    if (savedSettings) {
      const { voice_enabled } = JSON.parse(savedSettings);
      if (voice_enabled !== undefined) {
        setIsVoiceEnabled(voice_enabled);
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const toggleVoice = () => {
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);

    // Update localStorage for persistence and for the receive handler to see
    const savedSettings = localStorage.getItem('echobot_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    settings.voice_enabled = newState;
    localStorage.setItem('echobot_settings', JSON.stringify(settings));

    if (!newState) {
      window.speechSynthesis.cancel();
    }
    toast.info(newState ? 'Voice output enabled' : 'Voice output disabled');
  };

  // WebSocket Connection
  useEffect(() => {
    const connectWebSocket = () => {
      // Dynamic WebSocket URL based on current host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      // In development, we might be on port 5173 (Vite) but backend is 8000
      // In production, they are likely on the same port/domain
      const wsUrl = import.meta.env.DEV
        ? `ws://${host}:8000/ws`
        : `${protocol}//${host}${port}/ws`;

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (!hasConnected.current) {
          toast.success('Connected to EchoBot Brain');
          hasConnected.current = true;
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'error') {
            toast.error(payload.text);
            return;
          }

          const text = payload.text;
          const audioBase64 = payload.audio;

          // Add bot message
          const assistantMessage: Message = {
            id: Date.now().toString(),
            text,
            sender: 'assistant',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);

          // Trigger happy animation
          setBotState('happy');
          setTimeout(() => setBotState('idle'), 2000);

          // Audio Playback (Server-Side TTS)
          if (audioBase64) {
            const savedSettings = localStorage.getItem('echobot_settings');
            let shouldSpeak = true;

            if (savedSettings) {
              const settings = JSON.parse(savedSettings);
              if (settings.voice_enabled !== undefined) {
                shouldSpeak = settings.voice_enabled;
              }
            }

            if (shouldSpeak) {
              try {
                const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
                audio.play();
              } catch (err) {
                console.error("Audio playback failed", err);
              }
            }
          }

        } catch (e) {
          // Fallback for plain text messages (legacy/testing)
          const text = event.data;
          const assistantMessage: Message = {
            id: Date.now().toString(),
            text,
            sender: 'assistant',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      };

      socket.onclose = () => {
        // Try to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        toast.error('Connection Error');
      };

      ws.current = socket;
    };

    connectWebSocket();

    return () => {
      ws.current?.close();
      window.speechSynthesis.cancel(); // Cleanup speech on unmount
    };
  }, []);

  // Auto-idle logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (botState === 'typing') {
      timeout = setTimeout(() => {
        setBotState('idle');
      }, 1500);
    }
    return () => clearTimeout(timeout);
  }, [botState]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    // Set to processing state
    setBotState('processing');

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Send to backend
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(text);
    } else {
      toast.error('Not connected to server');
      setBotState('idle');
    }
  };

  const toggleMic = () => {
    const newState = !isMicActive;
    setIsMicActive(newState);
    setBotState(newState ? 'listening' : 'idle');
    if (newState) {
      toast.info('Listening...');
    } else {
      // If manually stopped, we might want to stop recognition (handled in InputBar)
    }
  };

  const handleTypingStateChange = (isTyping: boolean) => {
    if (isTyping) {
      setBotState('typing');
    }
  };

  return (
    <div className={`relative min-h-screen overflow-hidden font-sans text-slate-200 selection:bg-cyan-400/30 ${theme === 'light'
      ? 'bg-gradient-to-br from-gray-50 to-gray-200 text-slate-900'
      : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B1120] to-black'
      }`}>
      {/* Background Noise Texture */}
      <div className="bg-noise pointer-events-none" />
      <Toaster position="top-center" />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen max-w-5xl mx-auto overflow-hidden">

        {/* Header - Fixed Height */}
        <div className="flex-shrink-0 p-4">
          <TopBar
            isMicActive={isMicActive}
            onMicToggle={toggleMic}
            theme={theme}
            onThemeToggle={toggleTheme}
            isVoiceEnabled={isVoiceEnabled}
            onVoiceToggle={toggleVoice}
          />
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col items-center min-h-0">

          {/* Avatar Section - Floating in center-top */}
          <div className="flex-shrink-0 mt-4 mb-4 transform hover:scale-105 transition-transform duration-500">
            <BotCharacter state={botState} />
          </div>

          {/* Chat Area - Flexible & Scrollable */}
          <div className="w-full max-w-2xl flex-1 min-h-0 px-4 mb-4 relative">
            <ChatArea messages={messages} />
          </div>

          {/* Input Bar - Fixed at Bottom */}
          <div className="w-full max-w-2xl px-4 pb-6 flex-shrink-0">
            <div className="chat-input flex items-center gap-2">
              <InputBar
                onSendMessage={handleSendMessage}
                onMicClick={toggleMic}
                isMicActive={isMicActive}
                onTypingStateChange={handleTypingStateChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}