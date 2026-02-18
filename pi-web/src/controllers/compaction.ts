/**
 * Compaction controller — pure functions for token estimation
 * and message compaction. No global state references.
 */

import type { ChatMessage } from "../types/chat-message";
import { countTokens } from "../lib/tokenizer";

// ── Token estimation ────────────────────────────────────────────

/** Count tokens using precise tiktoken (with fallback to estimation). */
export function estimateTokens(text: string): number {
  return countTokens(text);
}

function messageText(msg: ChatMessage): string {
  const content = (msg as any).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block: any) => {
      if (block?.type === "text") return block.text ?? "";
      if (block?.type === "thinking") return block.thinking ?? "";
      if (block?.type === "toolCall") return JSON.stringify(block.arguments ?? {});
      return "";
    })
    .join("\n");
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(messageText(msg));
  }
  return total;
}

// ── Compaction ──────────────────────────────────────────────────

const COMPACTION_THRESHOLD = 0.8;
const KEEP_RECENT = 10;

/** Optional LLM summarizer — given conversation text, returns a coherent summary. */
export type Summarizer = (text: string) => Promise<string>;

/** Threshold (fraction of context) at which memory flush should trigger, before compaction. */
export const FLUSH_THRESHOLD_OFFSET = 4000;

/**
 * Check whether memory flush should run before compaction.
 * Returns true when token usage is within FLUSH_THRESHOLD_OFFSET of compaction threshold.
 */
export function shouldFlushMemory(
  messages: ChatMessage[],
  contextWindow: number,
  lastFlushAt: number,
): boolean {
  if (messages.length <= KEEP_RECENT + 1) return false;
  const threshold = Math.floor(contextWindow * COMPACTION_THRESHOLD);
  const totalTokens = estimateMessagesTokens(messages);
  const flushLine = threshold - FLUSH_THRESHOLD_OFFSET;
  if (totalTokens < flushLine) return false;
  // Only flush once per compaction cycle — check if we already flushed recently
  const latestMsgTs = (messages[messages.length - 1] as any).timestamp ?? 0;
  return lastFlushAt < latestMsgTs - 60_000; // at least 1 min since last flush
}

/** The prompt injected for the silent memory flush turn. */
export const FLUSH_PROMPT = `你的上下文即将被压缩。请立即用 memory_write 工具将以下重要信息保存到 memory/YYYY-MM-DD.md（用今天的日期）：
1. 用户偏好和个人信息
2. 关键事实和决定
3. 重要的情感时刻
4. 进行中的话题和待办事项

只保存本次对话中新出现的、尚未保存的信息。用简洁的要点格式。如果没有需要保存的新信息，直接回复"无需保存"。`;

/**
 * Returns compacted messages if token estimate exceeds threshold,
 * or null if no compaction needed. Accepts optional LLM summarizer.
 */
export async function compactMessages(
  messages: ChatMessage[],
  contextWindow: number,
  summarizer?: Summarizer,
): Promise<ChatMessage[] | null> {
  if (messages.length <= KEEP_RECENT + 1) return null;

  const threshold = Math.floor(contextWindow * COMPACTION_THRESHOLD);
  const totalTokens = estimateMessagesTokens(messages);

  if (totalTokens <= threshold) return null;

  const first = messages[0];
  const kept = messages.slice(-KEEP_RECENT);
  const trimmedCount = messages.length - KEEP_RECENT - 1;
  const trimmedMessages = messages.slice(1, messages.length - KEEP_RECENT);

  let summaryText: string;

  if (summarizer) {
    const conversationText = buildConversationText(trimmedMessages);
    try {
      const llmSummary = await summarizer(conversationText);
      summaryText = `[系统提示：${trimmedCount} 条较早的消息已被压缩。以下是AI生成的摘要：]\n\n${llmSummary}`;
    } catch {
      summaryText = buildFallbackSummary(trimmedMessages, trimmedCount);
    }
  } else {
    summaryText = buildFallbackSummary(trimmedMessages, trimmedCount);
  }

  const summaryMessage: ChatMessage = {
    role: "assistant",
    content: [{ type: "text", text: summaryText }],
    api: (first as any).api ?? "openai-completions",
    provider: (first as any).provider ?? "unknown",
    model: (first as any).model ?? "unknown",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop",
    timestamp: Date.now(),
  } as any;

  return [first, summaryMessage, ...kept];
}

function buildConversationText(messages: ChatMessage[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    const role = (msg as any).role;
    if (role !== "user" && role !== "assistant") continue;
    const text = messageText(msg).trim();
    if (!text) continue;
    const label = role === "user" ? "用户" : "助手";
    parts.push(`${label}: ${text.length > 500 ? text.slice(0, 500) + "..." : text}`);
  }
  return parts.join("\n");
}

function buildFallbackSummary(trimmedMessages: ChatMessage[], trimmedCount: number): string {
  const summaryParts: string[] = [];
  for (const msg of trimmedMessages) {
    const role = (msg as any).role;
    if (role === "user" || role === "assistant") {
      const text = messageText(msg).trim();
      if (text) {
        const label = role === "user" ? "用户" : "助手";
        const snippet = text.length > 100 ? text.slice(0, 100) + "..." : text;
        summaryParts.push(`${label}: ${snippet}`);
      }
    }
  }
  return [
    `[系统提示：为节省上下文空间，${trimmedCount} 条较早的消息已被压缩。以下是摘要：]`,
    "",
    ...summaryParts.slice(0, 20),
    summaryParts.length > 20 ? `...（还有 ${summaryParts.length - 20} 条）` : "",
  ].filter(Boolean).join("\n");
}

// ── Display helpers ─────────────────────────────────────────────

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

export function tokenUsagePercent(tokens: number, contextWindow: number): number {
  if (contextWindow <= 0) return 0;
  return Math.min(100, Math.round((tokens / contextWindow) * 100));
}

