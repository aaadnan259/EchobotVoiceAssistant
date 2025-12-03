import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { BotCharacter } from './components/BotCharacter';
import { ChatArea } from './components/ChatArea';
import { InputBar } from './components/InputBar';

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
      text: 'Hello! I\'m EchoBot, your AI assistant. How can I help you today?',
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [isMicActive, setIsMicActive] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [botState, setBotState] = useState<BotState>('idle');

  const handleSendMessage = (text: string) => {
    // Set to processing state
    setBotState('processing');

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I understand your message. This is a demo response from EchoBot.',
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Show happy state briefly, then return to idle
      setBotState('happy');
      setTimeout(() => {
        setBotState('idle');
      }, 500);
    }, 1000);
  };

  const toggleMic = () => {
    setIsMicActive(prev => !prev);
    setBotState(prev => prev === 'listening' ? 'idle' : 'listening');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleTypingStateChange = (isTyping: boolean) => {
    if (isTyping && botState === 'idle') {
      setBotState('typing');
    } else if (!isTyping && botState === 'typing') {
      setBotState('idle');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background with gradient and noise */}
      <div 
        className="fixed inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 25%, rgba(59, 130, 246, 0.15) 0%, transparent 40%),
            radial-gradient(
              circle at 40% 30%,
              #04060A 0%,
              #0A0F1B 25%,
              #111C35 45%,
              #1A2A55 65%,
              #3B1F44 80%,
              #5A0E32 100%
            )
          `,
        }}
      />

      {/* Floating particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${10 + Math.random() * 20}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen">
        <TopBar 
          isMicActive={isMicActive}
          onMicToggle={toggleMic}
          theme={theme}
          onThemeToggle={toggleTheme}
        />

        <div className="flex-1 flex flex-col items-center justify-between py-8 px-4">
          {/* Avatar Section */}
          <div className="flex-shrink-0 pt-12">
            <BotCharacter state={botState} />
          </div>

          {/* Chat Area */}
          <div className="w-full max-w-3xl flex-1 my-8">
            <ChatArea messages={messages} />
          </div>

          {/* Input Bar */}
          <div className="w-full max-w-3xl flex-shrink-0">
            <InputBar 
              onSendMessage={handleSendMessage}
              onMicClick={toggleMic}
              isMicActive={isMicActive}
              onTypingStateChange={handleTypingStateChange}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-20px) translateX(10px);
          }
          50% {
            transform: translateY(-40px) translateX(-10px);
          }
          75% {
            transform: translateY(-20px) translateX(5px);
          }
        }
      `}</style>
    </div>
  );
}