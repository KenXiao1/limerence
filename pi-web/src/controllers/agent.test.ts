import { describe, it, expect } from "vitest";
import {
  parseChatCommand,
  buildGreetingMessage,
  getToolLabel,
  buildRouteUrl,
  createProxyModel,
  hasDirectProviderKeys,
  shouldUseProxyModel,
  shouldEnableModelSelector,
} from "./agent";

// ── parseChatCommand ────────────────────────────────────────────

describe("parseChatCommand", () => {
  it("recognizes stop commands", () => {
    expect(parseChatCommand("/stop")).toBe("stop");
    expect(parseChatCommand("stop")).toBe("stop");
    expect(parseChatCommand("esc")).toBe("stop");
    expect(parseChatCommand("abort")).toBe("stop");
    expect(parseChatCommand("/abort")).toBe("stop");
  });

  it("recognizes new commands", () => {
    expect(parseChatCommand("/new")).toBe("new");
    expect(parseChatCommand("/reset")).toBe("new");
  });

  it("returns null for regular text", () => {
    expect(parseChatCommand("hello")).toBeNull();
    expect(parseChatCommand("how are you")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseChatCommand("")).toBeNull();
    expect(parseChatCommand("   ")).toBeNull();
  });

  it("is case insensitive", () => {
    expect(parseChatCommand("/STOP")).toBe("stop");
    expect(parseChatCommand("/New")).toBe("new");
  });
});

// ── buildGreetingMessage ────────────────────────────────────────

describe("buildGreetingMessage", () => {
  const mockModel: any = {
    id: "test-model",
    api: "openai-completions",
    provider: "test",
  };

  const mockUsage: any = {
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };

  it("returns null when no character", () => {
    expect(buildGreetingMessage(undefined, mockModel, mockUsage)).toBeNull();
  });

  it("returns null when no first_mes", () => {
    const card = { data: { name: "Test" } } as any;
    expect(buildGreetingMessage(card, mockModel, mockUsage)).toBeNull();
  });

  it("returns null when first_mes is empty", () => {
    const card = { data: { name: "Test", first_mes: "   " } } as any;
    expect(buildGreetingMessage(card, mockModel, mockUsage)).toBeNull();
  });

  it("builds greeting message", () => {
    const card = { data: { name: "Test", first_mes: "Hello there!" } } as any;
    const msg = buildGreetingMessage(card, mockModel, mockUsage);
    expect(msg).not.toBeNull();
    expect(msg!.role).toBe("assistant");
    expect((msg!.content as any)[0].text).toBe("Hello there!");
    expect(msg!.model).toBe("test-model");
  });
});

// ── getToolLabel ────────────────────────────────────────────────

describe("getToolLabel", () => {
  it("returns Chinese label for known tools", () => {
    expect(getToolLabel("memory_search")).toBe("记忆搜索");
    expect(getToolLabel("web_search")).toBe("网络搜索");
    expect(getToolLabel("file_write")).toBe("写文件");
  });

  it("returns tool name for unknown tools", () => {
    expect(getToolLabel("custom_tool")).toBe("custom_tool");
  });
});

// ── buildRouteUrl ───────────────────────────────────────────────

describe("buildRouteUrl", () => {
  it("builds URL with pathname", () => {
    const url = buildRouteUrl("http://localhost:3000/", "/chat");
    expect(url).toContain("/chat");
    expect(url).not.toContain("session=");
  });

  it("builds URL with session parameter", () => {
    const url = buildRouteUrl("http://localhost:3000/", "/chat", "abc-123");
    expect(url).toContain("/chat");
    expect(url).toContain("session=abc-123");
  });

  it("removes session parameter when not provided", () => {
    const url = buildRouteUrl("http://localhost:3000/chat?session=old", "/chat");
    expect(url).not.toContain("session=");
  });
});

// ── createProxyModel ────────────────────────────────────────────

describe("createProxyModel", () => {
  it("uses gemini-3-flash-preview as the default proxy model", () => {
    const model = createProxyModel();
    expect(model.id).toBe("gemini-3-flash-preview");
    expect(model.provider).toBe("limerence-proxy");
    expect(model.baseUrl).toBe("/api/llm/v1");
  });
});

// ── Provider key / model gating helpers ────────────────────────

describe("hasDirectProviderKeys", () => {
  it("returns false when no providers are configured", () => {
    expect(hasDirectProviderKeys([])).toBe(false);
  });

  it("returns false when only proxy sentinel key exists", () => {
    expect(hasDirectProviderKeys(["limerence-proxy"])).toBe(false);
  });

  it("returns true when at least one direct provider key exists", () => {
    expect(hasDirectProviderKeys(["limerence-proxy", "openai"])).toBe(true);
    expect(hasDirectProviderKeys(["anthropic"])).toBe(true);
  });
});

describe("shouldUseProxyModel", () => {
  it("always uses proxy model when user has no direct provider keys", () => {
    expect(shouldUseProxyModel(true, false)).toBe(true);
    expect(shouldUseProxyModel(false, false)).toBe(true);
  });

  it("follows proxy mode switch when direct provider keys are available", () => {
    expect(shouldUseProxyModel(true, true)).toBe(true);
    expect(shouldUseProxyModel(false, true)).toBe(false);
  });
});

describe("shouldEnableModelSelector", () => {
  it("disables model selector without direct provider keys", () => {
    expect(shouldEnableModelSelector(false)).toBe(false);
  });

  it("enables model selector when direct provider keys exist", () => {
    expect(shouldEnableModelSelector(true)).toBe(true);
  });
});
