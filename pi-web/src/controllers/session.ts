/**
 * Session controller — pure functions for session data operations.
 * No global state references; all dependencies passed as parameters.
 */

import type { AgentMessage } from "../runtime/message-converter";
import type { Usage } from "@mariozechner/pi-ai";

// ── Title generation ───────────────────────────────────────────

export function generateTitle(messages: AgentMessage[]): string {
  const firstUser = messages.find((m) => {
    const role = (m as any).role;
    return role === "user" || role === "user-with-attachments";
  });

  if (!firstUser) return "";

  const content = (firstUser as any).content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => String(c.text ?? ""))
      .join(" ");
  }

  text = text.trim();
  if (!text) return "";

  const sentenceEnd = text.search(/[.!?。！？]/);
  if (sentenceEnd > 0 && sentenceEnd <= 50) {
    return text.slice(0, sentenceEnd + 1);
  }

  return text.length <= 50 ? text : `${text.slice(0, 47)}...`;
}

// ── Message inspection ─────────────────────────────────────────

function hasRealAssistantText(message: AgentMessage): boolean {
  if ((message as any).role !== "assistant") return false;
  const content = (message as any).content;
  if (!Array.isArray(content)) return false;
  return content.some((c: any) => c?.type === "text" && String(c.text ?? "").trim().length > 0);
}

export function shouldSaveSession(messages: AgentMessage[]): boolean {
  const hasUser = messages.some((m) => {
    const role = (m as any).role;
    return role === "user" || role === "user-with-attachments";
  });

  const hasAssistant = messages.some((m) => hasRealAssistantText(m));
  return hasUser && hasAssistant;
}

export function extractPlainText(message: AgentMessage): string {
  const role = (message as any).role;
  const content = (message as any).content;

  if (role === "user" || role === "user-with-attachments") {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => String(c.text ?? ""))
        .join("\n")
        .trim();
    }
    return "";
  }

  if (role === "assistant") {
    if (!Array.isArray(content)) return "";
    return content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => String(c.text ?? ""))
      .join("\n")
      .trim();
  }

  return "";
}

// ── Usage aggregation ──────────────────────────────────────────

export function summarizeUsage(messages: AgentMessage[], defaultUsage: Usage): Usage {
  const usage = { ...defaultUsage, cost: { ...defaultUsage.cost } };

  for (const msg of messages) {
    if ((msg as any).role !== "assistant") continue;
    const u = (msg as any).usage as Usage | undefined;
    if (!u) continue;

    usage.input += u.input;
    usage.output += u.output;
    usage.cacheRead += u.cacheRead;
    usage.cacheWrite += u.cacheWrite;
    usage.totalTokens += u.totalTokens;
    usage.cost.input += u.cost.input;
    usage.cost.output += u.cost.output;
    usage.cost.cacheRead += u.cost.cacheRead;
    usage.cost.cacheWrite += u.cost.cacheWrite;
    usage.cost.total += u.cost.total;
  }

  return usage;
}

// ── Memory entry creation ──────────────────────────────────────

export interface MemoryEntryData {
  session_id: string;
  timestamp: string;
  role: string;
  content: string;
}

/**
 * Creates a memory entry from a message, or null if the message
 * is not suitable for memory indexing.
 */
export function createMemoryEntry(
  message: AgentMessage,
  sessionId: string,
): MemoryEntryData | null {
  const role = (message as any).role;
  if (role !== "user" && role !== "assistant") return null;

  const text = extractPlainText(message);
  if (!text) return null;

  return {
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    role,
    content: text,
  };
}

// ── Session data building ──────────────────────────────────────

export interface SessionSaveParams {
  sessionId: string;
  title: string;
  createdAt: string;
  messages: AgentMessage[];
  model: any;
  thinkingLevel: any;
}

export function buildSessionData(params: SessionSaveParams) {
  const now = new Date().toISOString();
  const title = params.title || generateTitle(params.messages) || "未命名会话";

  const sessionData = {
    id: params.sessionId,
    title,
    model: params.model,
    thinkingLevel: params.thinkingLevel,
    messages: params.messages,
    createdAt: params.createdAt,
    lastModified: now,
  };

  const metadata = {
    id: params.sessionId,
    title,
    createdAt: params.createdAt,
    lastModified: now,
    messageCount: params.messages.length,
    modelId: params.model?.id ?? null,
    thinkingLevel: params.thinkingLevel,
    preview: generateTitle(params.messages),
  };

  return { sessionData, metadata, title };
}
