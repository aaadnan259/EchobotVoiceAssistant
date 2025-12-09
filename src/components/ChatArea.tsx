import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Message } from '../App';

interface ChatAreaProps {
  messages: Message[];
}

export function ChatArea({ messages }: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto px-4 no-scrollbar"
    >
      <div className="space-y-6">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-2xl backdrop-blur-md shadow-lg border transition-colors duration-300 ${msg.sender === 'user'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-white/10 rounded-br-none'
                : 'bg-muted text-foreground dark:bg-white/5 dark:text-white border-border rounded-bl-none'
                }`}
            >
              <p className="leading-relaxed">{msg.text}</p>
              <span className={`text-xs mt-2 block ${msg.sender === 'user' ? 'text-white/60' : 'text-muted-foreground dark:text-white/40'
                }`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}