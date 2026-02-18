/**
 * Agent controller — pure helpers for command parsing, model selection gates,
 * route handling, and greeting message building.
 */

import type { CharacterCard } from "../lib/character";
import { normalizeCommand } from "../lib/normalize";
import type { ChatMessage, Usage } from "../types/chat-message";
import { DEFAULT_FREE_MODEL_ID } from "./free-model-quota";

// ── Chat commands ──────────────────────────────────────────────

const STOP_COMMANDS = new Set(["/stop", "stop", "esc", "abort", "/abort"]);
const NEW_COMMANDS = new Set(["/new", "/reset"]);

export type ChatCommandResult = "stop" | "new" | null;

export function parseChatCommand(text: string): ChatCommandResult {
  const trimmed = normalizeCommand(text);
  if (!trimmed) return null;
  if (STOP_COMMANDS.has(trimmed)) return "stop";
  if (NEW_COMMANDS.has(trimmed)) return "new";
  return null;
}

// ── Model helpers ──────────────────────────────────────────────

export interface ChatModelConfig {
  id: string;
  name: string;
  api: "openai-completions";
  provider: string;
  baseUrl?: string;
  reasoning: boolean;
  input: string[];
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
}

export function createProxyModel(): ChatModelConfig {
  return {
    id: DEFAULT_FREE_MODEL_ID,
    name: `${DEFAULT_FREE_MODEL_ID} (Netlify Proxy)`,
    api: "openai-completions",
    provider: "limerence-proxy",
    baseUrl: "/api/llm/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

export function createDirectModel(): ChatModelConfig {
  return {
    id: "gpt-4o-mini",
    name: "gpt-4o-mini",
    api: "openai-completions",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

export function hasDirectProviderKeys(providers: string[]): boolean {
  return providers.some((provider) => provider !== "limerence-proxy");
}

export function shouldUseProxyModel(
  proxyModeEnabled: boolean,
  hasDirectKey: boolean,
): boolean {
  if (!hasDirectKey) return true;
  return proxyModeEnabled;
}

export function shouldEnableModelSelector(hasDirectKey: boolean): boolean {
  return hasDirectKey;
}

// ── Greeting message ───────────────────────────────────────────

export function buildGreetingMessage(
  character: CharacterCard | undefined,
  model: ChatModelConfig,
  defaultUsage: Usage,
): ChatMessage | null {
  const text = character?.data.first_mes?.trim();
  if (!text) return null;

  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: defaultUsage,
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

// ── Tool labels ────────────────────────────────────────────────

export const TOOL_LABELS: Record<string, string> = {
  memory_search: "记忆搜索",
  web_search: "网络搜索",
  note_write: "写笔记",
  note_read: "读笔记",
  file_read: "读文件",
  file_write: "写文件",
};

export function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

// ── Routing helpers ────────────────────────────────────────────

export function buildRouteUrl(
  currentHref: string,
  pathname: string,
  sessionId?: string,
): string {
  const url = new URL(currentHref);
  url.pathname = pathname;
  if (sessionId) {
    url.searchParams.set("session", sessionId);
  } else {
    url.searchParams.delete("session");
  }
  return url.toString();
}

