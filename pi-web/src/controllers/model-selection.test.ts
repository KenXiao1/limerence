import { describe, it, expect } from "vitest";
import {
  parseModelRef,
  formatModelRef,
  normalizeProviderId,
  resolveModelInput,
  getModelContextWindow,
} from "./model-selection";

describe("normalizeProviderId", () => {
  it("normalizes known aliases", () => {
    expect(normalizeProviderId("z.ai")).toBe("zai");
    expect(normalizeProviderId("Qwen")).toBe("qwen-portal");
    expect(normalizeProviderId("Gemini")).toBe("google");
    expect(normalizeProviderId("DashScope")).toBe("qwen-portal");
  });

  it("passes through unknown providers", () => {
    expect(normalizeProviderId("custom-provider")).toBe("custom-provider");
  });
});

describe("parseModelRef", () => {
  it("parses provider/model format", () => {
    expect(parseModelRef("openai/gpt-4o")).toEqual({ provider: "openai", model: "gpt-4o" });
  });

  it("resolves default aliases", () => {
    expect(parseModelRef("opus")).toEqual({ provider: "anthropic", model: "claude-opus-4" });
    expect(parseModelRef("fast")).toEqual({ provider: "google", model: "gemini-2.5-flash" });
    expect(parseModelRef("sonnet")).toEqual({ provider: "anthropic", model: "claude-sonnet-4-5" });
  });

  it("resolves custom aliases over defaults", () => {
    const custom = { fast: "deepseek/deepseek-chat" };
    expect(parseModelRef("fast", custom)).toEqual({ provider: "deepseek", model: "deepseek-chat" });
  });

  it("returns bare model for unknown input", () => {
    expect(parseModelRef("some-unknown-model")).toEqual({ provider: "", model: "some-unknown-model" });
  });

  it("handles empty input", () => {
    expect(parseModelRef("")).toEqual({ provider: "", model: "" });
  });

  it("is case-insensitive for aliases", () => {
    expect(parseModelRef("OPUS")).toEqual({ provider: "anthropic", model: "claude-opus-4" });
    expect(parseModelRef("Sonnet")).toEqual({ provider: "anthropic", model: "claude-sonnet-4-5" });
  });
});

describe("formatModelRef", () => {
  it("formats provider/model", () => {
    expect(formatModelRef({ provider: "openai", model: "gpt-4o" })).toBe("openai/gpt-4o");
  });

  it("formats bare model", () => {
    expect(formatModelRef({ provider: "", model: "gpt-4o" })).toBe("gpt-4o");
  });
});

describe("resolveModelInput", () => {
  it("resolves alias with default provider", () => {
    const { providerId, modelId } = resolveModelInput("opus");
    expect(providerId).toBe("anthropic");
    expect(modelId).toBe("claude-opus-4");
  });

  it("uses default provider for bare model", () => {
    const { providerId, modelId } = resolveModelInput("my-custom-model", {}, "limerence-proxy");
    expect(providerId).toBe("limerence-proxy");
    expect(modelId).toBe("my-custom-model");
  });
});

describe("getModelContextWindow", () => {
  it("returns known context window", () => {
    expect(getModelContextWindow("gpt-4o")).toBe(128_000);
    expect(getModelContextWindow("claude-sonnet-4-5")).toBe(200_000);
    expect(getModelContextWindow("gemini-2.5-pro")).toBe(1_000_000);
  });

  it("returns undefined for unknown model", () => {
    expect(getModelContextWindow("unknown-model")).toBeUndefined();
  });
});
