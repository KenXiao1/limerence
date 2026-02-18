import { describe, expect, it } from "vitest";
import {
  THREADS_V2_META_STORE,
  createThreadListAdapter,
} from "./thread-list-adapter";
import { THREADS_V2_MESSAGES_STORE } from "./thread-history-adapter";
import type { StorageBackend } from "../../lib/indexed-db";

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

describe("createThreadListAdapter", () => {
  it("initializes and lists threads", async () => {
    const backend = createMemoryBackend();
    const adapter = createThreadListAdapter(backend);

    await adapter.initialize("thread-a");
    const list = await adapter.list();

    expect(list.threads).toHaveLength(1);
    expect(list.threads[0]?.remoteId).toBe("thread-a");
    expect(list.threads[0]?.status).toBe("regular");
  });

  it("renames / archives / unarchives thread metadata", async () => {
    const backend = createMemoryBackend();
    const adapter = createThreadListAdapter(backend);
    await adapter.initialize("thread-a");

    await adapter.rename("thread-a", "First Thread");
    let meta = await backend.get<{ title?: string; status: string }>(
      THREADS_V2_META_STORE,
      "thread-a",
    );
    expect(meta?.title).toBe("First Thread");
    expect(meta?.status).toBe("regular");

    await adapter.archive("thread-a");
    meta = await backend.get<{ status: string }>(THREADS_V2_META_STORE, "thread-a");
    expect(meta?.status).toBe("archived");

    await adapter.unarchive("thread-a");
    meta = await backend.get<{ status: string }>(THREADS_V2_META_STORE, "thread-a");
    expect(meta?.status).toBe("regular");
  });

  it("fetches and deletes thread metadata", async () => {
    const backend = createMemoryBackend();
    const adapter = createThreadListAdapter(backend);
    await adapter.initialize("thread-a");
    await backend.set(THREADS_V2_MESSAGES_STORE, "thread-a", [{ id: "m1" }]);

    const fetched = await adapter.fetch("thread-a");
    expect(fetched.remoteId).toBe("thread-a");

    await adapter.delete("thread-a");
    const list = await adapter.list();
    expect(list.threads).toHaveLength(0);
    const messages = await backend.get(THREADS_V2_MESSAGES_STORE, "thread-a");
    expect(messages).toBeNull();
  });
});
