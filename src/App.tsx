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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [botState, setBotState] = useState<BotState>('idle');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  // Theme Persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('echobot_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('echobot_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // WebSocket Connection
  useEffect(() => {
    const connectWebSocket = () => {
      // Assuming backend is running on port 8000
      const socket = new WebSocket('ws://localhost:8000/ws');

      socket.onopen = () => {
        console.log('Connected to WebSocket');
        toast.success('Connected to EchoBot Brain');
      };

      socket.onmessage = (event) => {
        const text = event.data;

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

        // Text-to-Speech (Frontend)
        if ('speechSynthesis' in window) {
          // Cancel any ongoing speech
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(text);
          // Optional: Select a specific voice if desired, or let browser default
          // const voices = window.speechSynthesis.getVoices();
          // utterance.voice = voices.find(v => v.name.includes('Google US English')) || null;

          // Get speed from settings (default 1.0)
          const savedSettings = localStorage.getItem('echobot_settings');
          if (savedSettings) {
            const { voice_speed } = JSON.parse(savedSettings);
            utterance.rate = voice_speed || 1.0;
          }

          window.speechSynthesis.speak(utterance);
        }
      };

      socket.onclose = () => {
        console.log('Disconnected from WebSocket');
        // toast.error('Disconnected from server');
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
    <div className={`relative min-h-screen overflow-hidden font-sans text-slate-200 selection:bg-cyan-400/30 ${theme === 'light' ? 'bg-slate-100 text-slate-900' : ''}`}>
      {/* Background Noise Texture */}
      <div className="bg-noise pointer-events-none" />
      <Toaster position="top-center" />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen max-w-5xl mx-auto">

        {/* Header */}
        <div className="p-4">
          <TopBar
            isMicActive={isMicActive}
            onMicToggle={toggleMic}
            theme={theme}
            onThemeToggle={toggleTheme}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-between pb-6">

          {/* Avatar Section - Floating in center-top */}
          <div className="flex-shrink-0 mt-8 mb-4 transform hover:scale-105 transition-transform duration-500">
            <BotCharacter state={botState} />
          </div>

          {/* Chat Area - Scrollable */}
          <div className="w-full max-w-2xl flex-1 min-h-0 px-4 mb-4">
            {/* We pass a custom class to ChatArea if supported, or wrap it */}
            <div className="h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <ChatArea messages={messages} />
            </div>
          </div>

          {/* Input Bar - Floating at bottom */}
          <div className="w-full max-w-2xl px-4">
            <div className="glass-panel rounded-full p-2 pl-6 pr-2 flex items-center gap-2">
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