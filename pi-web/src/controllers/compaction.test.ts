import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateMessagesTokens,
  compactMessages,
  formatTokenCount,
  tokenUsagePercent,
} from "./compaction";

// ── Helper to create mock messages ──────────────────────────────

function mockMsg(role: string, text: string, opts?: { api?: string; provider?: string; model?: string }): any {
  if (role === "user") {
    return { role: "user", content: [{ type: "text", text }], timestamp: Date.now() };
  }
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: opts?.api ?? "openai-completions",
    provider: opts?.provider ?? "test",
    model: opts?.model ?? "test-model",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

// ── estimateTokens ──────────────────────────────────────────────

describe("estimateTokens", () => {
  it("estimates English text", () => {
    const tokens = estimateTokens("hello world");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("estimates CJK text higher per char", () => {
    const en = estimateTokens("abcd");
    const cjk = estimateTokens("你好世界");
    expect(cjk).toBeGreaterThan(en);
  });

  it("handles empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("handles mixed CJK and English", () => {
    const mixed = estimateTokens("hello 你好");
    expect(mixed).toBeGreaterThan(0);
  });
});

// ── estimateMessagesTokens ──────────────────────────────────────

describe("estimateMessagesTokens", () => {
  it("sums tokens across messages", () => {
    const messages = [
      mockMsg("user", "hello"),
      mockMsg("assistant", "world"),
    ];
    const total = estimateMessagesTokens(messages);
    expect(total).toBeGreaterThan(0);
  });

  it("returns 0 for empty array", () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });
});

// ── compactMessages ─────────────────────────────────────────────

describe("compactMessages", () => {
  it("returns null when under threshold", () => {
    const messages = [
      mockMsg("assistant", "greeting"),
      mockMsg("user", "hi"),
      mockMsg("assistant", "hello"),
    ];
    expect(compactMessages(messages, 128000)).toBeNull();
  });

  it("returns null when too few messages", () => {
    const messages = Array.from({ length: 5 }, (_, i) =>
      i % 2 === 0 ? mockMsg("user", "x".repeat(5000)) : mockMsg("assistant", "y".repeat(5000)),
    );
    // Even with large text, if <= KEEP_RECENT+1 messages, no compaction
    expect(compactMessages(messages, 100)).toBeNull();
  });

  it("compacts when over threshold with enough messages", () => {
    // Create 20 messages with enough text to exceed 80% of a small context window
    const messages = [
      mockMsg("assistant", "greeting"),
      ...Array.from({ length: 19 }, (_, i) =>
        i % 2 === 0 ? mockMsg("user", "x".repeat(200)) : mockMsg("assistant", "y".repeat(200)),
      ),
    ];
    const result = compactMessages(messages, 200);
    expect(result).not.toBeNull();
    // Should keep first message + summary + last 10
    expect(result!.length).toBeLessThan(messages.length);
    expect(result![0]).toBe(messages[0]); // first message preserved
    // Summary message should contain compaction note
    const summaryText = (result![1] as any).content[0].text;
    expect(summaryText).toContain("压缩");
  });
});

// ── formatTokenCount ────────────────────────────────────────────

describe("formatTokenCount", () => {
  it("formats small numbers as-is", () => {
    expect(formatTokenCount(500)).toBe("500");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokenCount(1500)).toBe("1.5K");
    expect(formatTokenCount(128000)).toBe("128.0K");
  });

  it("formats zero", () => {
    expect(formatTokenCount(0)).toBe("0");
  });
});

// ── tokenUsagePercent ───────────────────────────────────────────

describe("tokenUsagePercent", () => {
  it("calculates percentage", () => {
    expect(tokenUsagePercent(64000, 128000)).toBe(50);
  });

  it("caps at 100", () => {
    expect(tokenUsagePercent(200000, 128000)).toBe(100);
  });

  it("handles zero context window", () => {
    expect(tokenUsagePercent(100, 0)).toBe(0);
  });

  it("handles zero tokens", () => {
    expect(tokenUsagePercent(0, 128000)).toBe(0);
  });
});
