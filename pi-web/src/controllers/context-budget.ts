/**
 * Context budget controller — layered token budget management.
 * Implements smarter compaction with lossless strategies before lossy compression.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { estimateTokens } from "./compaction";

// ── Types ──────────────────────────────────────────────────────

export interface TokenBudget {
  /** Total context window */
  contextWindow: number;
  /** Tokens used by system prompt (fixed) */
  systemPrompt: number;
  /** Tokens used by lorebook injections */
  lorebook: number;
  /** Tokens used by chat history */
  history: number;
  /** Tokens reserved for model output */
  outputReserve: number;
  /** Available tokens for new content */
  available: number;
}

export interface BudgetConfig {
  /** Fraction of context window reserved for output (default: 0.15) */
  outputReserveFraction: number;
  /** Maximum fraction of context for history before compaction (default: 0.80) */
  historyThreshold: number;
  /** Number of recent messages to always keep (default: 10) */
  keepRecent: number;
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  outputReserveFraction: 0.15,
  historyThreshold: 0.80,
  keepRecent: 10,
};

// ── Budget calculation ─────────────────────────────────────────

/**
 * Calculate the current token budget breakdown.
 */
export function calculateBudget(
  contextWindow: number,
  systemPromptText: string,
  lorebookText: string,
  messages: AgentMessage[],
  config: BudgetConfig = DEFAULT_BUDGET_CONFIG,
): TokenBudget {
  const systemPrompt = estimateTokens(systemPromptText);
  const lorebook = estimateTokens(lorebookText);
  const outputReserve = Math.floor(contextWindow * config.outputReserveFraction);

  let history = 0;
  for (const msg of messages) {
    history += estimateMessageTokens(msg);
  }

  const used = systemPrompt + lorebook + history + outputReserve;
  const available = Math.max(0, contextWindow - used);

  return {
    contextWindow,
    systemPrompt,
    lorebook,
    history,
    outputReserve,
    available,
  };
}

/**
 * Estimate tokens for a single message.
 */
function estimateMessageTokens(msg: AgentMessage): number {
  const content = (msg as any).content;
  if (typeof content === "string") return estimateTokens(content);
  if (!Array.isArray(content)) return 0;

  let total = 0;
  for (const block of content) {
    if (block?.type === "text") total += estimateTokens(block.text ?? "");
    else if (block?.type === "thinking") total += estimateTokens(block.thinking ?? "");
    else if (block?.type === "toolCall") total += estimateTokens(JSON.stringify(block.arguments ?? {}));
  }
  return total + 4; // overhead per message
}

// ── Smart compaction ───────────────────────────────────────────

/**
 * Apply layered compaction strategies, from lossless to lossy.
 * Returns compacted messages or null if no compaction needed.
 */
export function smartCompact(
  messages: AgentMessage[],
  contextWindow: number,
  systemPromptTokens: number,
  config: BudgetConfig = DEFAULT_BUDGET_CONFIG,
): AgentMessage[] | null {
  const maxHistoryTokens = Math.floor(
    contextWindow * config.historyThreshold - systemPromptTokens,
  );

  let currentTokens = 0;
  for (const msg of messages) {
    currentTokens += estimateMessageTokens(msg);
  }

  if (currentTokens <= maxHistoryTokens) return null;
  if (messages.length <= config.keepRecent + 1) return null;

  // Strategy 1: Remove tool call details from old messages (lossless-ish)
  let compacted = truncateOldToolOutputs(messages, config.keepRecent);
  let newTokens = 0;
  for (const msg of compacted) {
    newTokens += estimateMessageTokens(msg);
  }
  if (newTokens <= maxHistoryTokens) return compacted;

  // Strategy 2: Remove thinking blocks from old messages
  compacted = removeOldThinkingBlocks(compacted, config.keepRecent);
  newTokens = 0;
  for (const msg of compacted) {
    newTokens += estimateMessageTokens(msg);
  }
  if (newTokens <= maxHistoryTokens) return compacted;

  // Strategy 3: Lossy compaction — summarize old messages
  return lossyCompact(compacted, config.keepRecent);
}

/**
 * Truncate tool outputs in old messages to save tokens.
 */
function truncateOldToolOutputs(
  messages: AgentMessage[],
  keepRecent: number,
): AgentMessage[] {
  const cutoff = messages.length - keepRecent;
  return messages.map((msg, i) => {
    if (i >= cutoff) return msg;
    const role = (msg as any).role;
    if (role !== "toolResult" && role !== "tool-result") return msg;

    const content = (msg as any).content;
    if (!Array.isArray(content)) return msg;

    const truncated = content.map((block: any) => {
      if (block?.type === "text" && block.text && block.text.length > 200) {
        return { ...block, text: block.text.slice(0, 200) + "...[已截断]" };
      }
      return block;
    });

    return { ...msg, content: truncated } as AgentMessage;
  });
}

/**
 * Remove thinking blocks from old messages.
 */
function removeOldThinkingBlocks(
  messages: AgentMessage[],
  keepRecent: number,
): AgentMessage[] {
  const cutoff = messages.length - keepRecent;
  return messages.map((msg, i) => {
    if (i >= cutoff) return msg;
    if ((msg as any).role !== "assistant") return msg;

    const content = (msg as any).content;
    if (!Array.isArray(content)) return msg;

    const filtered = content.filter((block: any) => block?.type !== "thinking");
    if (filtered.length === content.length) return msg;

    return { ...msg, content: filtered } as AgentMessage;
  });
}

/**
 * Lossy compaction: summarize old messages into a single summary message.
 */
function lossyCompact(
  messages: AgentMessage[],
  keepRecent: number,
): AgentMessage[] {
  if (messages.length <= keepRecent + 1) return messages;

  const first = messages[0];
  const kept = messages.slice(-keepRecent);
  const trimmed = messages.slice(1, messages.length - keepRecent);
  const trimmedCount = trimmed.length;

  const summaryParts: string[] = [];
  for (const msg of trimmed) {
    const role = (msg as any).role;
    if (role !== "user" && role !== "assistant") continue;

    const content = (msg as any).content;
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
    if (!text) continue;

    const label = role === "user" ? "用户" : "助手";
    const snippet = text.length > 100 ? text.slice(0, 100) + "..." : text;
    summaryParts.push(`${label}: ${snippet}`);
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

// ── Display helpers ────────────────────────────────────────────

/**
 * Format a token budget for display.
 */
export function formatBudget(budget: TokenBudget): string {
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  return [
    `系统: ${fmt(budget.systemPrompt)}`,
    budget.lorebook > 0 ? `世界书: ${fmt(budget.lorebook)}` : null,
    `历史: ${fmt(budget.history)}`,
    `预留: ${fmt(budget.outputReserve)}`,
    `可用: ${fmt(budget.available)}`,
  ].filter(Boolean).join(" · ");
}
