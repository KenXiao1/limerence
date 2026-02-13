// --- Messages ---

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

// --- Tool Definitions ---

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// --- Stream Events (from LLM SSE) ---

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; index: number; id: string; name: string }
  | { type: "tool_call_delta"; index: number; arguments: string }
  | { type: "done" }
  | { type: "error"; message: string };

// --- Agent Events (to UI) ---

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; name: string }
  | { type: "tool_call_result"; name: string; result: string }
  | { type: "done" }
  | { type: "error"; message: string };

// --- Settings ---

export interface Settings {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  proxyMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  modelId: "deepseek-chat",
  proxyMode: false,
};

// --- Character Card (SillyTavern V2) ---

export interface CharacterCard {
  spec: string;
  spec_version: string;
  data: CharacterData;
}

export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  system_prompt: string;
  mes_example: string;
  extensions: Record<string, unknown>;
}

// --- Session ---

export interface SessionHeader {
  id: string;
  timestamp: string;
  character: string;
  model: string;
}

export interface SessionData {
  header: SessionHeader;
  messages: Message[];
}

// --- Memory ---

export interface MemoryEntry {
  session_id: string;
  timestamp: string;
  role: string;
  content: string;
}
