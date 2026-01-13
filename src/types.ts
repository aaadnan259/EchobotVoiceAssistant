export enum OrbState {
  IDLE = 'IDLE',
  TRACKING = 'TRACKING',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  RESPONDING = 'RESPONDING',
  ERROR = 'ERROR',
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  image?: string; // Base64 data URI (Legacy / Single)
  images?: string[]; // Multiple images support
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: { uri: string; title: string };
    }>;
  };
  reactions?: {
    thumbsUp?: boolean;
    thumbsDown?: boolean;
    starred?: boolean;
  };
  feedback?: string;
  parentId?: string | null;
  branchId?: string;
}

export interface Branch {
  id: string;
  name: string;
  createdAt: number;
  parentMessageId: string | null;
}

export interface Conversation {
  id: string;
  branches: Record<string, Branch>;
  activeBranchId: string;
  messages: Record<string, Message>;
}

export interface Theme {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    error: string;
    success: string;
  };
  orb: {
    gradient: string[];
    glowColor: string;
  };
}

export interface VoiceSettings {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
}

export interface AppSettings {
  model: string;
  systemPrompt: string;
  // voiceURI moved to voiceSettings, kept for temporary compat or removed?
  // User request said "Update settings to include". Usually means structure change.
  // But to avoid breaking valid code immediately, I'll keep it or map it.
  // Implementation plan said: "Update AppSettings to include voiceSettings".
  voiceSettings: VoiceSettings;
  theme: string;
}

export interface VoiceOption {
  name: string;
  uri: string;
  lang: string;
}