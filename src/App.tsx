import React, { useState, useEffect, useRef } from 'react';
import { OrbState, Message, AppSettings } from './types';
import { DEFAULT_SYSTEM_PROMPT, MODEL_NAME, INITIAL_GREETING, playSound } from './constants';
import { streamGeminiResponse } from './services/geminiService';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import Orb from './components/Orb';
import MessageBubble from './components/MessageBubble';
import SettingsModal from './components/SettingsModal';
import { toast, Toaster } from 'sonner';

const App: React.FC = () => {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>(() => {
    // Using v3 to ensure clean slate for hybrid testing
    const saved = localStorage.getItem('echoBotMessages_v3');
    return saved ? JSON.parse(saved) : [{ id: '1', role: 'model', text: INITIAL_GREETING, timestamp: Date.now() }];
  });
  const [inputValue, setInputValue] = useState('');
  const [orbState, setOrbState] = useState<OrbState>(OrbState.IDLE);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // Track generation status

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('echoBotSettings');
    return saved ? JSON.parse(saved) : {
      model: MODEL_NAME,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      voiceURI: null,
      theme: 'dark'
    };
  });

  // --- WebSocket Refs (For Backend "Wake Word" & Events) ---
  const ws = useRef<WebSocket | null>(null);
  const hasConnected = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Audio Analyzer Hook ---
  // Calculates volume level for the orb visualization
  const audioLevel = useAudioAnalyzer(orbState === OrbState.LISTENING, orbState === OrbState.RESPONDING);

  // --- Refs ---
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const stopGenerationRef = useRef(false); // To signal stop

  // --- Effects ---

  // Persist Messages
  useEffect(() => {
    localStorage.setItem('echoBotMessages_v3', JSON.stringify(messages));
  }, [messages]);

  // Theme Application
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('echoBotSettings', JSON.stringify(settings));
  }, [settings]);

  // WebSocket Connection (Backend-First Control)
  useEffect(() => {
    const connectWebSocket = () => {
      // Dynamic WebSocket URL based on current host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      // In development, we might be on port 5173 (Vite) but backend is 8000
      // In production/docker, backend might be on same port or routed via proxy
      // The user prompt says "connects to ws://localhost:8000" explicitly
      const wsUrl = (import.meta as any).env.DEV
        ? `ws://${window.location.hostname}:8000/ws`
        : `${protocol}//${host}${port}/ws`;

      console.log('Connecting to WebSocket:', wsUrl);
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

          // Handle Status Updates ("Wake Word Detected", "Listening", etc)
          if (payload.status) {
            if (payload.status === 'listening') setOrbState(OrbState.LISTENING);
            if (payload.status === 'processing') setOrbState(OrbState.THINKING);
            if (payload.status === 'speaking') setOrbState(OrbState.RESPONDING);
            if (payload.status === 'idle') setOrbState(OrbState.IDLE);
            return;
          }

          // Handle Server Audio (Legacy TTS) or Text messages from Python
          // Note: We prioritize Client-side Gemini for interactions initiated via UI
          // But if Python sends a message (e.g. from Wake Word), we display it.
          const text = payload.text;
          const audioBase64 = payload.audio;

          if (text) {
            const assistantMessage: Message = {
              id: Date.now().toString(),
              role: 'model',
              text,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            playSound('receive');
          }

          if (audioBase64) {
            setOrbState(OrbState.RESPONDING);
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
            audioRef.current = audio;
            audio.onplay = () => setOrbState(OrbState.RESPONDING);
            audio.onended = () => setOrbState(OrbState.IDLE);
            audio.play().catch(console.error);
          }

        } catch (e) {
          console.error("WebSocket message error:", e);
        }
      };

      socket.onclose = () => {
        setTimeout(connectWebSocket, 5000); // Reconnect loop
      };

      ws.current = socket;
    };

    connectWebSocket();

    return () => {
      ws.current?.close();
    };
  }, []);


  // Initialize Speech Recognition (Client Side - Assisted Input)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setOrbState(OrbState.LISTENING);
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setOrbState(OrbState.IDLE);
      };

      recognitionRef.current.onend = () => {
        setOrbState(OrbState.IDLE);
      };
    }
  }, []);

  // Scroll Handling
  useEffect(() => {
    const handleScroll = () => {
      if (!chatContainerRef.current) return;
      const scrollTop = chatContainerRef.current.scrollTop;
      const progress = Math.min(1, scrollTop / 200);
      setScrollProgress(progress);
    };

    const container = chatContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);


  // --- Handlers ---

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    if (orbState === OrbState.LISTENING) {
      recognitionRef.current.stop();
    } else {
      setInputValue('');
      recognitionRef.current.start();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat history?")) {
      setMessages([{ id: Date.now().toString(), role: 'model', text: INITIAL_GREETING, timestamp: Date.now() }]);
      setOrbState(OrbState.IDLE);
    }
  };

  const handleSaveChat = () => {
    try {
      const data = JSON.stringify(messages, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `echobot_history_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Chat saved to device');
    } catch (e) {
      console.error('Save failed', e);
      toast.error('Failed to save chat');
    }
  };

  const handleStopGeneration = () => {
    stopGenerationRef.current = true;
    setIsGenerating(false);
    setOrbState(OrbState.IDLE);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() && !selectedImage) return;

    // Frontend-First Intelligence
    const userText = inputValue.trim();
    const userImage = selectedImage || undefined;

    setInputValue('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // UI Update (User Message)
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      image: userImage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    playSound('send');

    // Check API Key
    if (!process.env.API_KEY && !(import.meta as any).env.VITE_GEMINI_API_KEY) {
      // Fallback: If no Client Key, maybe send to Backend? 
      // For now, strict Hybrid Check as per design requirement (Client Gemini)
      // Actually, we should check import.meta.env.VITE_GEMINI_API_KEY as per standard Vite
    }

    setOrbState(OrbState.THINKING);
    setIsGenerating(true);
    stopGenerationRef.current = false;

    // Create placeholder bot message
    const botMsgId = (Date.now() + 1).toString();
    const botMsgPlaceholder: Message = {
      id: botMsgId,
      role: 'model',
      text: '', // Start empty
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, botMsgPlaceholder]);

    try {
      // Get Stream (Client-Side Intelligence)
      const stream = await streamGeminiResponse(
        settings.model,
        settings.systemPrompt,
        messages,
        userText,
        userImage
      );

      setOrbState(OrbState.RESPONDING);
      playSound('receive');

      let fullText = '';
      let groundingMetadata = undefined;

      for await (const chunk of stream) {
        if (stopGenerationRef.current) break;

        const chunkText = chunk.text || '';
        fullText += chunkText;

        if (chunk.candidates?.[0]?.groundingMetadata) {
          groundingMetadata = chunk.candidates[0].groundingMetadata;
        }

        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId
            ? { ...msg, text: fullText, groundingMetadata: groundingMetadata || msg.groundingMetadata }
            : msg
        ));
      }

      setOrbState(OrbState.IDLE);
      setIsGenerating(false);

    } catch (error: any) {
      console.error(error);
      if (!stopGenerationRef.current) {
        setOrbState(OrbState.ERROR);
        playSound('error');

        let errorMessage = "My neural pathways are a bit jammed right now. Can you try that again?";
        if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }

        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId
            ? { ...msg, text: errorMessage }
            : msg
        ));

        setTimeout(() => setOrbState(OrbState.IDLE), 3000);
      } else {
        setOrbState(OrbState.IDLE);
      }
      setIsGenerating(false);
    }
  };

  const handleSpeak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Robust Voice Loading Logic
    const loadAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      if (settings.voiceURI) {
        const selected = voices.find(v => v.voiceURI === settings.voiceURI);
        if (selected) {
          utterance.voice = selected;
          console.log("Using voice:", selected.name);
        } else {
          console.warn("Selected voice not found:", settings.voiceURI);
        }
      }

      setOrbState(OrbState.RESPONDING);
      utterance.onend = () => setOrbState(OrbState.IDLE);
      utterance.onerror = (e) => {
        console.error("Speech error:", e);
        setOrbState(OrbState.IDLE);
      };

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        loadAndSpeak();
        window.speechSynthesis.onvoiceschanged = null; // Clean up
      };
    } else {
      loadAndSpeak();
    }
  };

  const toggleTheme = () => {
    setSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  };

  return (
    <div className="relative flex flex-col h-screen bg-gray-50 dark:bg-[#0B0D18] transition-colors duration-300 text-gray-900 dark:text-white overflow-hidden">
      <Toaster position="top-center" />

      {/* Background Texture/Gradient for Dark Mode */}
      <div className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e1b4b] via-[#0B0D18] to-[#000000]"></div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      {/* --- Top Bar --- */}
      <header className="flex items-center justify-between px-6 py-4 z-20 backdrop-blur-sm bg-white/50 dark:bg-black/20 border-b border-gray-200/50 dark:border-white/5 sticky top-0">
        <div className="flex items-center gap-3">
          {/* Logo Orb */}
          <div className="w-8 h-8 rounded-full shadow-lg shadow-purple-500/40 overflow-hidden transition-transform hover:scale-110">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <radialGradient id="logoGradient" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#d8b4fe" />
                  <stop offset="50%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#4c1d95" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="50" fill="url(#logoGradient)" />
              <ellipse cx="30" cy="30" rx="15" ry="8" fill="white" opacity="0.3" transform="rotate(-45 30 30)" />
              <ellipse cx="38" cy="50" rx="5" ry="9" fill="white" />
              <ellipse cx="62" cy="50" rx="5" ry="9" fill="white" />
            </svg>
          </div>
          <h1 className="font-semibold text-lg tracking-tight">EchoBot</h1>
        </div>

        <div className="flex items-center gap-2">

          {/* Save Chat */}
          <button
            onClick={handleSaveChat}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors border border-white/10"
            title="Save Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>Save Chat</span>
          </button>

          {/* Clear Chat */}
          <button
            onClick={handleClearChat}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors border border-white/10 text-gray-500 hover:text-red-400 dark:text-gray-400"
            title="Clear Chat History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span className="hidden md:inline">Clear</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            {settings.theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </div>
      </header>

      {/* --- Main Chat Area --- */}
      <main
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center pt-8 pb-40 md:pb-48 px-4 z-10"
      >
        <div className="sticky top-0 z-0 w-full flex justify-center h-0 pointer-events-none">
          <div className="absolute top-0 transform -translate-y-4">
            <Orb state={orbState} scrollProgress={scrollProgress} audioLevel={audioLevel} />
          </div>
        </div>

        <div className="h-[200px] w-full shrink-0" />

        <div className="w-full max-w-2xl flex flex-col">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} onSpeak={handleSpeak} />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* --- Input Area --- */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-[#0B0D18] dark:via-[#0B0D18] dark:to-transparent z-20 flex justify-center flex-col items-center">

        {/* Image Preview */}
        {selectedImage && (
          <div className="w-full max-w-2xl mb-2 flex justify-start animate-[fadeIn_0.2s]">
            <div className="relative group">
              <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-purple-500 shadow-lg" />
              <button
                onClick={() => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:scale-110 transition-transform"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-2xl bg-gray-100/80 dark:bg-[#1A1D2D]/80 backdrop-blur-md border border-white/20 dark:border-white/10 p-2 rounded-[2rem] shadow-xl flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-purple-500/30 ring-offset-2 dark:ring-offset-[#0B0D18]">

          {/* File Input (Hidden) */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-all flex-shrink-0"
            title="Upload Image"
            disabled={isGenerating}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleSendMessage()}
            placeholder={orbState === OrbState.LISTENING ? "Listening..." : "Type a message..."}
            disabled={isGenerating}
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder-gray-400/70 text-base px-2 h-10 min-w-0"
          />

          <div className="flex items-center gap-1 pr-1">
            {/* Mic Button */}
            <button
              onClick={handleMicClick}
              disabled={isGenerating}
              className={`p-2.5 rounded-full transition-all duration-300 flex-shrink-0 ${orbState === OrbState.LISTENING ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-white/10'}`}
              title="Voice Input"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            </button>

            {/* Send / Stop Button */}
            {isGenerating ? (
              <button
                onClick={handleStopGeneration}
                className="p-2.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-md hover:shadow-lg active:scale-95 flex-shrink-0"
                title="Stop Generation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() && !selectedImage}
                className="p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-all shadow-md hover:shadow-lg active:scale-95 flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* --- Settings Modal --- */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </div>
  );
};

export default App;