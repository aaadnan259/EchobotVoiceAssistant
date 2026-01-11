import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { SafeImage, SafeLink } from './SafeContent';

interface MessageBubbleProps {
  message: Message;
  onSpeak: (text: string) => void;
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

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onSpeak }) => {
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
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.3s_ease-out]`}>
      <div
        className={`relative max-w-[85%] md:max-w-[75%] p-4 rounded-2xl shadow-sm border
        ${isUser
            ? 'bg-purple-100 dark:bg-[#1A1D2D] text-gray-800 dark:text-purple-100 border-purple-200 dark:border-purple-900/50 rounded-br-none'
            : 'bg-white dark:bg-[#131625] text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-800 rounded-bl-none'
          }
        `}
      >
        {/* Render Image if exists */}
        {message.image && (
          <div className="mb-3 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
            <SafeImage src={message.image} alt="User upload" className="max-w-full h-auto max-h-[300px] object-cover" />
          </div>
        )}

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
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
            <p className="text-[10px] font-semibold opacity-60 mb-1.5 uppercase tracking-wide">Sources</p>
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

        {/* Footer: Timestamp & Actions */}
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5 dark:border-white/5">
          <span className="text-[10px] opacity-50 uppercase tracking-widest">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {!isUser && message.text && (
            <button
              onClick={() => onSpeak(message.text)}
              className="ml-2 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
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
    </div>
  );
};

export default MessageBubble;