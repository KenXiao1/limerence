import { useState } from "react";
import { useAui, type ThreadHistoryAdapter, type MessageFormatAdapter } from "@assistant-ui/react";
import type { StorageBackend } from "../../lib/indexed-db";

export const THREADS_V2_MESSAGES_STORE = "limerence:threads:v2:messages";

type PersistedMessage<TContent = unknown> = {
  id: string;
  parent_id: string | null;
  format: string;
  content: TContent;
  updatedAt: string;
};

type ThreadIdResolver = () => string | null | undefined;

export class IndexedDbThreadHistoryAdapter implements ThreadHistoryAdapter {
  constructor(
    private readonly backend: StorageBackend,
    private readonly getCurrentThreadId: ThreadIdResolver,
  ) {}

  async load() {
    return { messages: [] };
  }

  async append() {
    // The ai-sdk runtime uses withFormat() for persistence.
  }

  withFormat<TMessage, TStorageFormat>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ) {
    return {
      load: async () => {
        const threadId = this.getCurrentThreadId();
        if (!threadId) return { messages: [] };

        const persisted =
          (await this.backend.get<PersistedMessage<TStorageFormat>[]>(
            THREADS_V2_MESSAGES_STORE,
            threadId,
          )) ?? [];

        const messages = persisted
          .filter((entry) => entry.format === formatAdapter.format)
          .map((entry) =>
            formatAdapter.decode({
              id: entry.id,
              parent_id: entry.parent_id,
              format: entry.format,
              content: entry.content,
            }),
          );

        return {
          headId: messages.length > 0
            ? formatAdapter.getId(messages[messages.length - 1]!.message)
            : undefined,
          messages,
        };
      },

      append: async (item: { parentId: string | null; message: TMessage }) => {
        const threadId = this.getCurrentThreadId();
        if (!threadId) return;

        const persisted =
          (await this.backend.get<PersistedMessage<TStorageFormat>[]>(
            THREADS_V2_MESSAGES_STORE,
            threadId,
          )) ?? [];

        const id = formatAdapter.getId(item.message);
        const next: PersistedMessage<TStorageFormat> = {
          id,
          parent_id: item.parentId,
          format: formatAdapter.format,
          content: formatAdapter.encode(item),
          updatedAt: new Date().toISOString(),
        };

        const idx = persisted.findIndex((entry) => entry.id === id);
        if (idx >= 0) {
          persisted[idx] = next;
        } else {
          persisted.push(next);
        }

        await this.backend.set(THREADS_V2_MESSAGES_STORE, threadId, persisted);
      },
    };
  }
}

export function useIndexedDbThreadHistoryAdapter(
  backend: StorageBackend,
): ThreadHistoryAdapter {
  const aui = useAui();
  const [adapter] = useState(
    () =>
      new IndexedDbThreadHistoryAdapter(
        backend,
        () => aui.threadListItem().getState().remoteId,
      ),
  );
  return adapter;
}

