import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
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
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-6 py-4 ${
                message.sender === 'user'
                  ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-white/5 backdrop-blur-sm text-white/90 border border-white/5'
              }`}
            >
              <p className="break-words">{message.text}</p>
              <p className={`mt-2 ${message.sender === 'user' ? 'text-white/50' : 'text-white/30'}`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}