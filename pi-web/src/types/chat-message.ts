export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export type ChatContentBlock =
  | { type: "text"; text: string }
  | { type: string; [key: string]: unknown };

export interface ChatMessage {
  role: string;
  content: string | ChatContentBlock[];
  timestamp?: number;
  api?: string;
  provider?: string;
  model?: string;
  usage?: Usage;
  stopReason?: string;
  [key: string]: unknown;
}

