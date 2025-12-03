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
      className="h-full max-h-[60vh] overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
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
              className={`max-w-[80%] p-4 rounded-2xl backdrop-blur-md shadow-lg border ${msg.sender === 'user'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-white/10 rounded-br-none'
                : 'bg-gray-200 text-gray-900 border-gray-300 dark:bg-white/5 dark:text-white/90 dark:border-white/10 rounded-bl-none'
                }`}
            >
              <p className="leading-relaxed">{msg.text}</p>
              <span className={`text-xs mt-2 block ${msg.sender === 'user' ? 'text-white/60' : 'text-gray-500 dark:text-white/40'
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