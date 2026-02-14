import { describe, it, expect } from "vitest";
import { normalizePath } from "./storage";

describe("normalizePath", () => {
  it("normalizes forward slashes", () => {
    expect(normalizePath("a/b/c")).toBe("a/b/c");
  });

  it("converts backslashes", () => {
    expect(normalizePath("a\\b\\c")).toBe("a/b/c");
  });

  it("resolves parent references", () => {
    expect(normalizePath("a/b/../c")).toBe("a/c");
  });

  it("strips current-dir dots", () => {
    expect(normalizePath("./a/./b")).toBe("a/b");
  });

  it("handles empty string", () => {
    expect(normalizePath("")).toBe("");
  });

  it("handles multiple parent refs", () => {
    expect(normalizePath("a/b/c/../../d")).toBe("a/d");
  });

  it("handles leading slash removal", () => {
    expect(normalizePath("/a/b")).toBe("a/b");
  });
});
