import { describe, it, expect } from "vitest";
import { LimerenceStorage, normalizePath } from "./storage";
import type { StorageBackend } from "./indexed-db";

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

function createMemoryBackend(): StorageBackend {
  const stores = new Map<string, Map<string, unknown>>();

  const ensure = (store: string) => {
    let map = stores.get(store);
    if (!map) {
      map = new Map<string, unknown>();
      stores.set(store, map);
    }
    return map;
  };

  return {
    async get<T>(store: string, key: string): Promise<T | null> {
      const map = ensure(store);
      return (map.get(key) as T | undefined) ?? null;
    },
    async set(store: string, key: string, value: unknown): Promise<void> {
      ensure(store).set(key, value);
    },
    async delete(store: string, key: string): Promise<void> {
      ensure(store).delete(key);
    },
    async keys(store: string, prefix?: string): Promise<string[]> {
      const keys = [...ensure(store).keys()];
      if (!prefix) return keys;
      return keys.filter((k) => k.startsWith(prefix));
    },
  };
}

describe("LimerenceStorage recycle bin", () => {
  it("moves deleted files to recycle bin when softDelete is enabled", async () => {
    const storage = new LimerenceStorage(createMemoryBackend());
    await storage.fileWrite("notes/daily.md", "hello");

    const result = await storage.deleteWorkspaceFile("notes/daily.md", { softDelete: true });

    expect(result).toContain("回收站");
    expect(await storage.readWorkspaceFile("notes/daily.md")).toBeNull();
    expect(await storage.listWorkspaceFiles()).toEqual([]);

    const recycle = await storage.listWorkspaceRecycleEntries();
    expect(recycle).toHaveLength(1);
    expect(recycle[0]?.originalPath).toBe("notes/daily.md");
    expect(recycle[0]?.contentLength).toBe(5);
  });

  it("restores file from recycle bin", async () => {
    const storage = new LimerenceStorage(createMemoryBackend());
    await storage.fileWrite("notes/daily.md", "content");
    await storage.deleteWorkspaceFile("notes/daily.md", { softDelete: true });

    const recycle = await storage.listWorkspaceRecycleEntries();
    expect(recycle).toHaveLength(1);

    const result = await storage.restoreWorkspaceRecycleEntry(recycle[0]!.key);
    expect(result).toContain("已恢复文件");
    expect(await storage.readWorkspaceFile("notes/daily.md")).toBe("content");
    expect(await storage.listWorkspaceRecycleEntries()).toHaveLength(0);
  });

  it("deletes permanently when softDelete is disabled", async () => {
    const storage = new LimerenceStorage(createMemoryBackend());
    await storage.fileWrite("notes/daily.md", "to delete");

    const result = await storage.deleteWorkspaceFile("notes/daily.md", { softDelete: false });

    expect(result).toContain("已删除文件");
    expect(await storage.readWorkspaceFile("notes/daily.md")).toBeNull();
    expect(await storage.listWorkspaceRecycleEntries()).toHaveLength(0);
  });
});
