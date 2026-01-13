import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { SafeImage, SafeLink } from './SafeContent';
import { MessageReactions } from './MessageReactions';
import { BranchSelector } from './BranchSelector';
import { Bot, User } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onSpeak: (text: string) => void;
  onReaction?: (messageId: string, reaction: 'thumbsUp' | 'thumbsDown' | 'starred') => void;
  siblingInfo?: { current: number; total: number; hasPrev: boolean; hasNext: boolean };
  onNavigateBranch?: (direction: 'prev' | 'next') => void;
  onBranchCreate?: () => void;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 transition-all z-10"
      title="Copy code"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      )}
    </button>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSpeak,
  onReaction,
  siblingInfo,
  onNavigateBranch,
  onBranchCreate
}) => {
  const isUser = message.role === 'user';

  // Extract sources if available
  const sources = message.groundingMetadata?.groundingChunks?.map((chunk, idx) => {
    if (chunk.web) {
      return {
        title: chunk.web.title,
        uri: chunk.web.uri,
        key: idx
      };
    }
    return null;
  }).filter(Boolean);

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>

      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
          <Bot size={16} className="text-indigo-500" />
        </div>
      )}

      <div
        className={`relative max-w-[85%] md:max-w-[75%] p-4 rounded-2xl shadow-sm border
        ${isUser
            ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-transparent rounded-br-sm'
            : 'bg-white dark:bg-[#1E2335] text-gray-800 dark:text-gray-100 border-gray-100 dark:border-white/5 rounded-bl-sm'
          }
        `}
      >
        {/* Render Image Grid or Single Image */}
        {(message.images && message.images.length > 0) ? (
          <div className={`mb-3 grid gap-2 ${message.images.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {message.images.map((img, idx) => (
              <div key={idx} className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10 relative group">
                <SafeImage src={img} alt={`Attachment ${idx + 1}`} className="w-full h-auto object-cover max-h-[300px]" />
              </div>
            ))}
          </div>
        ) : message.image ? (
          // Legacy / Single fallback
          <div className="mb-3 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
            <SafeImage src={message.image} alt="User upload" className="max-w-full h-auto max-h-[300px] object-cover" />
          </div>
        ) : null}

        {/* Render Markdown Content */}
        <div className="markdown-body text-sm md:text-base leading-relaxed break-words">
          <ReactMarkdown
            components={{
              a(props) {
                return <SafeLink href={props.href || '#'} className="text-blue-500 hover:underline">{props.children}</SafeLink>;
              },
              code(props) {
                const { children, className, node, ...rest } = props
                const match = /language-(\w+)/.exec(className || '')
                const codeText = String(children).replace(/\n$/, '');

                return match ? (
                  <div className="relative group rounded-md overflow-hidden my-2 border border-white/10 shadow-lg">
                    <CopyButton text={codeText} />
                    <SyntaxHighlighter
                      {...rest}
                      PreTag="div"
                      children={codeText}
                      language={match[1]}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, fontSize: '0.85rem' }}
                    />
                  </div>
                ) : (
                  <code {...rest} className={className}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        {/* Grounding Sources */}
        {sources && sources.length > 0 && (
          <div className={`mt-3 pt-3 border-t ${isUser ? 'border-white/20' : 'border-black/5 dark:border-white/5'}`}>
            <p className={`text-[10px] font-semibold opacity-60 mb-1.5 uppercase tracking-wide ${isUser ? 'text-white/80' : ''}`}>Sources</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source: any) => (
                <a
                  key={source.key}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs px-2 py-1 rounded-full transition-colors truncate max-w-[200px]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  <span className="truncate">{source.title || new URL(source.uri).hostname}</span>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer Actions */}
      <div className={`flex items-center justify-between mt-2 pt-1 border-t ${isUser ? 'border-white/20' : 'border-black/5 dark:border-white/5'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] opacity-50 uppercase tracking-widest ${isUser ? 'text-white/70' : ''}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {/* Branch Selector */}
          {siblingInfo && siblingInfo.total > 1 && onNavigateBranch && (
            <BranchSelector
              currentBranch={siblingInfo.current}
              totalBranches={siblingInfo.total}
              onPrev={() => onNavigateBranch('prev')}
              onNext={() => onNavigateBranch('next')}
            />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Regenerate Button (Create Branch) */}
          {!isUser && onBranchCreate && (
            <button
              onClick={onBranchCreate}
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100 mr-1"
              title="Regenerate response"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" /></svg>
            </button>
          )}

          {!isUser && message.text && (
            <button
              onClick={() => onSpeak(message.text)}
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
              title="Read aloud"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Reactions - Separate row */}
      {onReaction && (
        <MessageReactions message={message} onReaction={onReaction} />
      )}
    </div>

  );
};

export default MessageBubble;