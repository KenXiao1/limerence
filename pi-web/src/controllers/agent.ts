/**
 * Agent controller — pure functions for chat commands,
 * model factories, and message building.
 * No global state references.
 */

import { getModel, type AssistantMessage, type Model } from "@mariozechner/pi-ai";
import type { Usage } from "@mariozechner/pi-ai";
import type { CharacterCard } from "../lib/character";

// ── Chat commands ──────────────────────────────────────────────

const STOP_COMMANDS = new Set(["/stop", "stop", "esc", "abort", "/abort"]);
const NEW_COMMANDS = new Set(["/new", "/reset"]);

export type ChatCommandResult = "stop" | "new" | null;

/**
 * Parse a chat command from user input.
 * Returns the command type or null if not a command.
 */
export function parseChatCommand(text: string): ChatCommandResult {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  if (STOP_COMMANDS.has(trimmed)) return "stop";
  if (NEW_COMMANDS.has(trimmed)) return "new";
  return null;
}

// ── Model factories ────────────────────────────────────────────

export function createProxyModel(): Model<"openai-completions"> {
  return {
    id: "deepseek-chat",
    name: "deepseek-chat (Netlify Proxy)",
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

export function createDirectModel(): Model<any> {
  try {
    return getModel("openai", "gpt-4o-mini");
  } catch {
    return getModel("openai", "gpt-4.1-mini");
  }
}

// ── Greeting message ───────────────────────────────────────────

export function buildGreetingMessage(
  character: CharacterCard | undefined,
  model: Model<any>,
  defaultUsage: Usage,
): AssistantMessage | null {
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
