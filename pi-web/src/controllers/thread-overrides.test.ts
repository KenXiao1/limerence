import { describe, expect, it } from "vitest";
import { mergeOverrides, thinkingBudgetTokens } from "./thread-overrides";

describe("thinkingBudgetTokens", () => {
  it("maps thinking levels to token budgets", () => {
    expect(thinkingBudgetTokens("off")).toBe(0);
    expect(thinkingBudgetTokens("low")).toBe(1024);
    expect(thinkingBudgetTokens("medium")).toBe(4096);
    expect(thinkingBudgetTokens("high")).toBe(16384);
  });
});

describe("mergeOverrides", () => {
  const global = {
    modelId: "gpt-4o-mini",
    providerId: "openai",
    baseUrl: "https://api.openai.com/v1",
  };

  it("falls back to global config when thread overrides are absent", () => {
    expect(mergeOverrides(global)).toEqual({
      ...global,
      thinkingLevel: "off",
    });
  });

  it("lets thread overrides win and keeps thinking level default", () => {
    expect(
      mergeOverrides(global, {
        modelId: "claude-3-5-sonnet",
        providerId: "anthropic",
      }),
    ).toEqual({
      modelId: "claude-3-5-sonnet",
      providerId: "anthropic",
      baseUrl: "https://api.openai.com/v1",
      thinkingLevel: "off",
    });
  });

  it("accepts explicit thinking level overrides", () => {
    expect(
      mergeOverrides(global, {
        thinkingLevel: "high",
      }),
    ).toEqual({
      ...global,
      thinkingLevel: "high",
    });
  });
});
