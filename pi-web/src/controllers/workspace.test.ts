import { describe, it, expect } from "vitest";
import {
  isMarkdownPath,
  summarizeText,
  formatTime,
  createDiffPreview,
  pushEvent,
} from "./workspace";
import type { WorkspaceEvent } from "../app-state";

// ── isMarkdownPath ──────────────────────────────────────────────

describe("isMarkdownPath", () => {
  it("returns true for .md files", () => {
    expect(isMarkdownPath("notes/daily.md")).toBe(true);
    expect(isMarkdownPath("README.MD")).toBe(true);
  });

  it("returns false for non-md files", () => {
    expect(isMarkdownPath("file.txt")).toBe(false);
    expect(isMarkdownPath("file.ts")).toBe(false);
    expect(isMarkdownPath("")).toBe(false);
  });
});

// ── summarizeText ───────────────────────────────────────────────

describe("summarizeText", () => {
  it("returns short text as-is", () => {
    expect(summarizeText("hello")).toBe("hello");
  });

  it("truncates long text", () => {
    const long = "a".repeat(200);
    const result = summarizeText(long, 90);
    expect(result.length).toBeLessThanOrEqual(90);
    expect(result).toContain("...");
  });

  it("returns placeholder for empty text", () => {
    expect(summarizeText("")).toBe("空内容");
    expect(summarizeText("   ")).toBe("空内容");
  });

  it("collapses whitespace", () => {
    expect(summarizeText("hello   world\n\nfoo")).toBe("hello world foo");
  });
});

// ── formatTime ──────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats valid ISO timestamp", () => {
    const result = formatTime("2024-01-15T10:30:45Z");
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("returns something for invalid timestamp", () => {
    const result = formatTime("not-a-date");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── createDiffPreview ───────────────────────────────────────────

describe("createDiffPreview", () => {
  it("returns empty diff for identical text", () => {
    const diff = createDiffPreview("hello", "hello", 160000, 260);
    expect(diff.lines).toHaveLength(0);
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.truncated).toBe(false);
  });

  it("detects added lines", () => {
    const diff = createDiffPreview("line1", "line1\nline2", 160000, 260);
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(0);
  });

  it("detects removed lines", () => {
    const diff = createDiffPreview("line1\nline2", "line1", 160000, 260);
    expect(diff.removed).toBe(1);
    expect(diff.added).toBe(0);
  });

  it("detects changed lines", () => {
    const diff = createDiffPreview("old line", "new line", 160000, 260);
    expect(diff.added).toBeGreaterThan(0);
    expect(diff.removed).toBeGreaterThan(0);
  });

  it("truncates when exceeding max preview lines", () => {
    const base = Array.from({ length: 300 }, (_, i) => `line ${i}`).join("\n");
    const next = Array.from({ length: 300 }, (_, i) => `changed ${i}`).join("\n");
    const diff = createDiffPreview(base, next, 160000, 10);
    expect(diff.truncated).toBe(true);
    expect(diff.lines.length).toBeLessThanOrEqual(10);
  });

  it("uses simple diff for large matrices", () => {
    // Create texts that would exceed maxMatrix
    const base = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
    const next = Array.from({ length: 500 }, (_, i) => `changed ${i}`).join("\n");
    // maxMatrix = 100 forces simple diff (500*500 > 100)
    const diff = createDiffPreview(base, next, 100, 260);
    expect(diff.added + diff.removed).toBeGreaterThan(0);
  });
});

// ── pushEvent ───────────────────────────────────────────────────

describe("pushEvent", () => {
  it("prepends new event", () => {
    const events: WorkspaceEvent[] = [];
    const result = pushEvent(events, {
      source: "user",
      action: "read",
      path: "test.md",
      timestamp: new Date().toISOString(),
      success: true,
      summary: "test",
    }, 80);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("test.md");
    expect(result[0].id).toBeDefined();
  });

  it("limits to maxEvents", () => {
    const events: WorkspaceEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `id-${i}`,
      source: "user" as const,
      action: "read" as const,
      path: `file-${i}.md`,
      timestamp: new Date().toISOString(),
      success: true,
      summary: `event ${i}`,
    }));

    const result = pushEvent(events, {
      source: "agent",
      action: "write",
      path: "new.md",
      timestamp: new Date().toISOString(),
      success: true,
      summary: "new event",
    }, 3);

    expect(result).toHaveLength(3);
    expect(result[0].path).toBe("new.md");
  });
});
