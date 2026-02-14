import { describe, it, expect } from "vitest";
import { estimateTokens, formatTokenCount, tokenUsagePercent } from "./app-compaction";

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
});

describe("formatTokenCount", () => {
  it("formats small numbers as-is", () => {
    expect(formatTokenCount(500)).toBe("500");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokenCount(1500)).toBe("1.5K");
    expect(formatTokenCount(128000)).toBe("128.0K");
  });
});

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
});
