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
  image?: string; // Base64 data URI
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

export interface AppSettings {
  model: string;
  systemPrompt: string;
  voiceURI: string | null;
  theme: 'light' | 'dark';
}

export interface VoiceOption {
  name: string;
  uri: string;
  lang: string;
}