import { describe, it, expect } from "vitest";
import { MemoryIndex, type MemoryEntry } from "./memory";

function entry(content: string, role = "user"): MemoryEntry {
  return { session_id: "s1", timestamp: new Date().toISOString(), role, content };
}

describe("MemoryIndex", () => {
  it("returns empty for empty index", () => {
    const idx = new MemoryIndex();
    expect(idx.search("hello")).toEqual([]);
  });

  it("finds exact match", () => {
    const idx = new MemoryIndex();
    idx.load([entry("the quick brown fox"), entry("lazy dog sleeps")]);
    const results = idx.search("fox");
    expect(results.length).toBe(1);
    expect(results[0].content).toBe("the quick brown fox");
  });

  it("ranks by relevance", () => {
    const idx = new MemoryIndex();
    idx.load([
      entry("apple banana cherry"),
      entry("apple apple apple"),
      entry("banana cherry date"),
    ]);
    const results = idx.search("apple", 3);
    expect(results[0].content).toBe("apple apple apple");
  });

  it("handles CJK text", () => {
    const idx = new MemoryIndex();
    idx.load([entry("今天天气很好"), entry("明天要下雨"), entry("hello world")]);
    const results = idx.search("天气");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("天气");
  });

  it("respects limit", () => {
    const idx = new MemoryIndex();
    idx.load(Array.from({ length: 20 }, (_, i) => entry(`message ${i} with keyword`)));
    const results = idx.search("keyword", 3);
    expect(results.length).toBe(3);
  });

  it("add() works incrementally", () => {
    const idx = new MemoryIndex();
    idx.load([entry("first entry")]);
    idx.add(entry("second entry with target"));
    const results = idx.search("target");
    expect(results.length).toBe(1);
    expect(results[0].content).toContain("target");
  });
});
