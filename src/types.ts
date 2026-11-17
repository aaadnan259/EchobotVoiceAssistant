export enum OrbState {
  IDLE = 'IDLE',
  TRACKING = 'TRACKING',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  RESPONDING = 'RESPONDING',
  ERROR = 'ERROR',
}

/** A tool call made while producing a reply (only present when the backend runs tools). */
export interface ToolCallInfo {
  id: string;
  name: string;
  status: 'running' | 'ok' | 'failed';
  /** Short server-provided result summary; shown as a tooltip. */
  summary?: string;
}

/** Tool events from the SSE stream (mirrors web/backend/tool_loop.py). */
export type ToolStreamEvent =
  | { type: 'tool_call'; id: string; name: string }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; summary?: string };

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
  /** True when this bot message is an error notice rather than a real reply. */
  isError?: boolean;
  /** Tool calls made for this reply. Absent unless tool events arrived. */
  toolCalls?: ToolCallInfo[];
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
  voiceSettings: VoiceSettings;
  theme: string;
}

export interface VoiceOption {
  name: string;
  uri: string;
  lang: string;
}