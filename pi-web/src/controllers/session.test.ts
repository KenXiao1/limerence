import { describe, it, expect } from "vitest";
import {
  generateTitle,
  shouldSaveSession,
  extractPlainText,
  createMemoryEntry,
  buildSessionData,
} from "./session";

// ── Helper to create mock messages ──────────────────────────────

function mockUser(text: string): any {
  return { role: "user", content: [{ type: "text", text }], timestamp: Date.now() };
}

function mockAssistant(text: string): any {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: "test",
    model: "test-model",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

function mockToolResult(): any {
  return {
    role: "toolResult",
    toolCallId: "tc-1",
    toolName: "test",
    content: [{ type: "text", text: "result" }],
    isError: false,
    timestamp: Date.now(),
  };
}

// ── generateTitle ───────────────────────────────────────────────

describe("generateTitle", () => {
  it("extracts title from first user message", () => {
    const messages = [mockAssistant("hi"), mockUser("你好世界")];
    expect(generateTitle(messages)).toBe("你好世界");
  });

  it("truncates long text to 50 chars", () => {
    const longText = "a".repeat(100);
    const messages = [mockUser(longText)];
    const title = generateTitle(messages);
    expect(title.length).toBeLessThanOrEqual(50);
    expect(title).toContain("...");
  });

  it("cuts at sentence end if within 50 chars", () => {
    const messages = [mockUser("这是第一句话。这是第二句话。")];
    const title = generateTitle(messages);
    expect(title).toBe("这是第一句话。");
  });

  it("returns empty string for no user messages", () => {
    const messages = [mockAssistant("hello")];
    expect(generateTitle(messages)).toBe("");
  });

  it("returns empty string for empty messages", () => {
    expect(generateTitle([])).toBe("");
  });

  it("handles user message with string content", () => {
    const messages = [{ role: "user", content: "plain text", timestamp: Date.now() } as any];
    expect(generateTitle(messages)).toBe("plain text");
  });
});

// ── shouldSaveSession ───────────────────────────────────────────

describe("shouldSaveSession", () => {
  it("returns true when has user and assistant messages", () => {
    expect(shouldSaveSession([mockUser("hi"), mockAssistant("hello")])).toBe(true);
  });

  it("returns false when only user messages", () => {
    expect(shouldSaveSession([mockUser("hi")])).toBe(false);
  });

  it("returns false when only assistant messages", () => {
    expect(shouldSaveSession([mockAssistant("hello")])).toBe(false);
  });

  it("returns false for empty messages", () => {
    expect(shouldSaveSession([])).toBe(false);
  });

  it("returns false when assistant has no real text", () => {
    const emptyAssistant = { ...mockAssistant(""), content: [{ type: "text", text: "  " }] };
    expect(shouldSaveSession([mockUser("hi"), emptyAssistant])).toBe(false);
  });
});

// ── extractPlainText ────────────────────────────────────────────

describe("extractPlainText", () => {
  it("extracts text from user message", () => {
    expect(extractPlainText(mockUser("hello world"))).toBe("hello world");
  });

  it("extracts text from assistant message", () => {
    expect(extractPlainText(mockAssistant("response text"))).toBe("response text");
  });

  it("returns empty for tool result", () => {
    expect(extractPlainText(mockToolResult())).toBe("");
  });

  it("handles string content in user message", () => {
    const msg = { role: "user", content: "plain string" } as any;
    expect(extractPlainText(msg)).toBe("plain string");
  });

  it("joins multiple text blocks", () => {
    const msg = {
      role: "user",
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    } as any;
    expect(extractPlainText(msg)).toBe("first\nsecond");
  });
});

// ── createMemoryEntry ───────────────────────────────────────────

describe("createMemoryEntry", () => {
  it("creates entry for user message", () => {
    const entry = createMemoryEntry(mockUser("test content"), "session-1");
    expect(entry).not.toBeNull();
    expect(entry!.role).toBe("user");
    expect(entry!.content).toBe("test content");
    expect(entry!.session_id).toBe("session-1");
  });

  it("creates entry for assistant message", () => {
    const entry = createMemoryEntry(mockAssistant("response"), "session-2");
    expect(entry).not.toBeNull();
    expect(entry!.role).toBe("assistant");
  });

  it("returns null for tool result", () => {
    expect(createMemoryEntry(mockToolResult(), "session-1")).toBeNull();
  });

  it("returns null for empty text", () => {
    const msg = { role: "user", content: [{ type: "text", text: "" }] } as any;
    expect(createMemoryEntry(msg, "session-1")).toBeNull();
  });
});

// ── buildSessionData ────────────────────────────────────────────

describe("buildSessionData", () => {
  it("builds session data with provided title", () => {
    const messages = [mockUser("hi"), mockAssistant("hello")];
    const result = buildSessionData({
      sessionId: "s-1",
      title: "My Session",
      createdAt: "2024-01-01T00:00:00Z",
      messages,
      model: { id: "gpt-4" },
      thinkingLevel: "off",
    });

    expect(result.sessionData.id).toBe("s-1");
    expect(result.sessionData.title).toBe("My Session");
    expect(result.metadata.messageCount).toBe(2);
    expect(result.title).toBe("My Session");
  });

  it("generates title when not provided", () => {
    const messages = [mockUser("你好世界"), mockAssistant("hello")];
    const result = buildSessionData({
      sessionId: "s-2",
      title: "",
      createdAt: "2024-01-01T00:00:00Z",
      messages,
      model: null,
      thinkingLevel: "off",
    });

    expect(result.title).toBe("你好世界");
  });

  it("falls back to default title", () => {
    const messages = [mockAssistant("hello")];
    const result = buildSessionData({
      sessionId: "s-3",
      title: "",
      createdAt: "2024-01-01T00:00:00Z",
      messages,
      model: null,
      thinkingLevel: "off",
    });

    expect(result.title).toBe("未命名会话");
  });
});
