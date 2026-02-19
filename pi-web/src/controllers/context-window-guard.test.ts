import { describe, it, expect } from "vitest";
import {
  evaluateContextWindowGuard,
  getEffectiveContextWindow,
} from "./context-window-guard";

describe("evaluateContextWindowGuard", () => {
  it("uses known model context window", () => {
    const result = evaluateContextWindowGuard("gpt-4o");
    expect(result.contextWindow).toBe(128_000);
    expect(result.source).toBe("model-known");
    expect(result.shouldWarn).toBe(false);
    expect(result.shouldBlock).toBe(false);
  });

  it("uses thread override when provided", () => {
    const result = evaluateContextWindowGuard("gpt-4o", 8_000);
    expect(result.contextWindow).toBe(8_000);
    expect(result.source).toBe("thread-override");
  });

  it("falls back to default for unknown model", () => {
    const result = evaluateContextWindowGuard("unknown-model-xyz");
    expect(result.contextWindow).toBe(128_000);
    expect(result.source).toBe("default");
  });

  it("warns when context window is small", () => {
    const result = evaluateContextWindowGuard("gpt-4o", 24_000);
    expect(result.shouldWarn).toBe(true);
    expect(result.shouldBlock).toBe(false);
    expect(result.warningMessage).toBeTruthy();
  });

  it("blocks when context window is very small", () => {
    const result = evaluateContextWindowGuard("gpt-4o", 8_000);
    expect(result.shouldBlock).toBe(true);
    expect(result.shouldWarn).toBe(false);
    expect(result.warningMessage).toBeTruthy();
  });

  it("no warning for large context", () => {
    const result = evaluateContextWindowGuard("gemini-2.5-pro");
    expect(result.contextWindow).toBe(1_000_000);
    expect(result.shouldWarn).toBe(false);
    expect(result.shouldBlock).toBe(false);
    expect(result.warningMessage).toBeUndefined();
  });
});

describe("getEffectiveContextWindow", () => {
  it("returns number directly", () => {
    expect(getEffectiveContextWindow("gpt-4o")).toBe(128_000);
  });

  it("respects thread override", () => {
    expect(getEffectiveContextWindow("gpt-4o", 64_000)).toBe(64_000);
  });
});
