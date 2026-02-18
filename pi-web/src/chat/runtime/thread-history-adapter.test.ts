import { describe, expect, it } from "vitest";
import type { StorageBackend } from "../../lib/indexed-db";
import type { MessageFormatAdapter } from "@assistant-ui/react";
import {
  THREADS_V2_MESSAGES_STORE,
  IndexedDbThreadHistoryAdapter,
} from "./thread-history-adapter";

type TestMessage = { id: string; text: string };
type TestStoragePayload = { text: string };

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
    async keys(store: string): Promise<string[]> {
      return [...ensure(store).keys()];
    },
  };
}

describe("IndexedDbThreadHistoryAdapter", () => {
  it("appends and loads messages in storage format", async () => {
    const backend = createMemoryBackend();
    let currentThreadId = "thread-a";

    const adapter = new IndexedDbThreadHistoryAdapter(
      backend,
      () => currentThreadId,
    );

    const formatAdapter: MessageFormatAdapter<TestMessage, TestStoragePayload> = {
      format: "test-format",
      encode: (item) => ({
        text: item.message.text,
      }),
      decode: (stored) => ({
        parentId: stored.parent_id,
        message: { id: stored.id, text: stored.content.text },
      }),
      getId: (message) => message.id,
    };

    const formatted = adapter.withFormat(formatAdapter);
    await formatted.append({
      parentId: null,
      message: { id: "m1", text: "hello" },
    });
    await formatted.append({
      parentId: "m1",
      message: { id: "m2", text: "world" },
    });

    const loaded = await formatted.load();
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.headId).toBe("m2");

    const persisted = await backend.get<Array<{ id: string }>>(
      THREADS_V2_MESSAGES_STORE,
      "thread-a",
    );
    expect(persisted?.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("updates existing message when appending same id", async () => {
    const backend = createMemoryBackend();
    const adapter = new IndexedDbThreadHistoryAdapter(backend, () => "thread-a");

    const formatAdapter: MessageFormatAdapter<TestMessage, TestStoragePayload> = {
      format: "test-format",
      encode: (item) => ({
        text: item.message.text,
      }),
      decode: (stored) => ({
        parentId: stored.parent_id,
        message: { id: stored.id, text: stored.content.text },
      }),
      getId: (message) => message.id,
    };

    const formatted = adapter.withFormat(formatAdapter);

    await formatted.append({
      parentId: null,
      message: { id: "m1", text: "draft" },
    });
    await formatted.append({
      parentId: null,
      message: { id: "m1", text: "final" },
    });

    const loaded = await formatted.load();
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]?.message.text).toBe("final");
  });

  it("isolates histories by thread id", async () => {
    const backend = createMemoryBackend();
    let currentThreadId = "thread-a";
    const adapter = new IndexedDbThreadHistoryAdapter(
      backend,
      () => currentThreadId,
    );

    const formatAdapter: MessageFormatAdapter<TestMessage, TestStoragePayload> = {
      format: "test-format",
      encode: (item) => ({
        text: item.message.text,
      }),
      decode: (stored) => ({
        parentId: stored.parent_id,
        message: { id: stored.id, text: stored.content.text },
      }),
      getId: (message) => message.id,
    };

    const formatted = adapter.withFormat(formatAdapter);
    await formatted.append({
      parentId: null,
      message: { id: "a1", text: "thread-a-msg" },
    });

    currentThreadId = "thread-b";
    await formatted.append({
      parentId: null,
      message: { id: "b1", text: "thread-b-msg" },
    });

    let loaded = await formatted.load();
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]?.message.id).toBe("b1");

    currentThreadId = "thread-a";
    loaded = await formatted.load();
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]?.message.id).toBe("a1");
  });
});
