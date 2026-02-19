import { describe, it, expect } from "vitest";
import {
  ThinkingTracker,
  parseThinkingTags,
  hasThinkingTags,
} from "./think-tag-parser";

describe("ThinkingTracker", () => {
  it("separates think and content in a single chunk", () => {
    const tracker = new ThinkingTracker();
    const result = tracker.push("<think>reasoning here</think>visible response");
    expect(result.thinking).toBe("reasoning here");
    expect(result.content).toBe("visible response");
  });

  it("handles streaming across chunks", () => {
    const tracker = new ThinkingTracker();
    const r1 = tracker.push("<think>first part of ");
    expect(r1.thinking).toBe("first part of ");
    expect(r1.content).toBe("");

    const r2 = tracker.push("reasoning</think>now ");
    expect(r2.thinking).toBe("reasoning");
    expect(r2.content).toBe("now ");

    const r3 = tracker.push("visible");
    expect(r3.content).toBe("visible");
    expect(r3.thinking).toBe("");
  });

  it("handles <thinking> variant", () => {
    const tracker = new ThinkingTracker();
    tracker.push("<thinking>deep thoughts</thinking>answer");
    expect(tracker.getThinking()).toBe("deep thoughts");
    expect(tracker.getContent()).toBe("answer");
  });

  it("handles <thought> variant", () => {
    const tracker = new ThinkingTracker();
    tracker.push("<thought>my thought</thought>reply");
    expect(tracker.getThinking()).toBe("my thought");
    expect(tracker.getContent()).toBe("reply");
  });

  it("handles <antthinking> variant", () => {
    const tracker = new ThinkingTracker();
    tracker.push("<antthinking>analysis</antthinking>output");
    expect(tracker.getThinking()).toBe("analysis");
    expect(tracker.getContent()).toBe("output");
  });

  it("handles tag split across chunks", () => {
    const tracker = new ThinkingTracker();
    tracker.push("hello <thi");
    // The partial tag is buffered
    tracker.push("nk>secret</think>world");
    // After both pushes
    expect(tracker.getContent()).toContain("hello");
    expect(tracker.getContent()).toContain("world");
    expect(tracker.getThinking()).toContain("secret");
  });

  it("strips <final> tags", () => {
    const tracker = new ThinkingTracker();
    tracker.push("<think>reasoning</think><final>actual response</final>");
    expect(tracker.getThinking()).toBe("reasoning");
    expect(tracker.getContent()).toBe("actual response");
  });

  it("handles no think tags", () => {
    const tracker = new ThinkingTracker();
    tracker.push("just normal text");
    expect(tracker.getContent()).toBe("just normal text");
    expect(tracker.getThinking()).toBe("");
  });

  it("handles multiple think blocks", () => {
    const tracker = new ThinkingTracker();
    tracker.push("<think>first</think>mid<think>second</think>end");
    expect(tracker.getThinking()).toBe("firstsecond");
    expect(tracker.getContent()).toBe("midend");
  });

  it("reset clears state", () => {
    const tracker = new ThinkingTracker();
    tracker.push("<think>stuff</think>content");
    tracker.reset();
    expect(tracker.getThinking()).toBe("");
    expect(tracker.getContent()).toBe("");
    expect(tracker.isThinking).toBe(false);
  });
});

describe("parseThinkingTags", () => {
  it("one-shot parses complete text", () => {
    const result = parseThinkingTags("<think>Let me think about this...</think>Here is my answer.");
    expect(result.thinking).toBe("Let me think about this...");
    expect(result.content).toBe("Here is my answer.");
    expect(result.isThinking).toBe(false);
  });

  it("returns content only when no tags", () => {
    const result = parseThinkingTags("No thinking here.");
    expect(result.content).toBe("No thinking here.");
    expect(result.thinking).toBe("");
  });
});

describe("hasThinkingTags", () => {
  it("detects think tags", () => {
    expect(hasThinkingTags("<think>")).toBe(true);
    expect(hasThinkingTags("<thinking>")).toBe(true);
    expect(hasThinkingTags("<thought>")).toBe(true);
    expect(hasThinkingTags("<antthinking>")).toBe(true);
  });

  it("returns false for no tags", () => {
    expect(hasThinkingTags("just text")).toBe(false);
  });
});
