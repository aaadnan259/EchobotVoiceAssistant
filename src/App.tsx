import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { AssistantAvatar } from './components/AssistantAvatar';
import { ChatArea } from './components/ChatArea';
import { InputBar } from './components/InputBar';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

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

  const handleSendMessage = (text: string) => {
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
    }, 1000);
  };

  const toggleMic = () => {
    setIsMicActive(prev => !prev);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background with gradient and noise */}
      <div 
        className="fixed inset-0 bg-gradient-to-br from-[#000000] via-[#0d0821] to-[#120b28]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 80% 20%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")
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
            <AssistantAvatar isActive={isMicActive} />
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