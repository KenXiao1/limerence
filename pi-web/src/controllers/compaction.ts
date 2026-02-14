/**
 * Compaction controller — pure functions for token estimation
 * and message compaction. No global state references.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Token estimation ────────────────────────────────────────────

const CJK_RANGE = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g;

/** Rough token estimate: CJK chars ~ 1.5 tok each, other chars ~ 0.25 tok each. */
export function estimateTokens(text: string): number {
  const cjkCount = (text.match(CJK_RANGE) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount * 1.5 + otherCount * 0.25);
}

function messageText(msg: AgentMessage): string {
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

export function estimateMessagesTokens(messages: AgentMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(messageText(msg));
  }
  return total;
}

// ── Compaction ──────────────────────────────────────────────────

const COMPACTION_THRESHOLD = 0.8;
const KEEP_RECENT = 10;

/**
 * Returns compacted messages if token estimate exceeds threshold,
 * or null if no compaction needed.
 */
export function compactMessages(
  messages: AgentMessage[],
  contextWindow: number,
): AgentMessage[] | null {
  const threshold = Math.floor(contextWindow * COMPACTION_THRESHOLD);
  const totalTokens = estimateMessagesTokens(messages);

  if (totalTokens <= threshold) return null;
  if (messages.length <= KEEP_RECENT + 1) return null;

  const first = messages[0];
  const kept = messages.slice(-KEEP_RECENT);
  const trimmedCount = messages.length - KEEP_RECENT - 1;

  const trimmedMessages = messages.slice(1, messages.length - KEEP_RECENT);
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

  const summaryText = [
    `[系统提示：为节省上下文空间，${trimmedCount} 条较早的消息已被压缩。以下是摘要：]`,
    "",
    ...summaryParts.slice(0, 20),
    summaryParts.length > 20 ? `...（还有 ${summaryParts.length - 20} 条）` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const summaryMessage: AgentMessage = {
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

// ── Display helpers ─────────────────────────────────────────────

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

export function tokenUsagePercent(tokens: number, contextWindow: number): number {
  if (contextWindow <= 0) return 0;
  return Math.min(100, Math.round((tokens / contextWindow) * 100));
}
