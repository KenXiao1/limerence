import { type FC, type PropsWithChildren } from "react";
import {
  RuntimeAdapterProvider,
  type unstable_RemoteThreadListAdapter as RemoteThreadListAdapter,
} from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";
import type { StorageBackend } from "../../lib/indexed-db";
import {
  THREADS_V2_MESSAGES_STORE,
  useIndexedDbThreadHistoryAdapter,
} from "./thread-history-adapter";

export const THREADS_V2_META_STORE = "limerence:threads:v2:meta";

export interface ThreadMetaRecord {
  remoteId: string;
  externalId?: string;
  status: "regular" | "archived";
  title?: string;
  createdAt: string;
  lastModified: string;
}

function createNewThreadRecord(threadId: string): ThreadMetaRecord {
  const now = new Date().toISOString();
  return {
    remoteId: threadId,
    status: "regular",
    createdAt: now,
    lastModified: now,
  };
}

async function loadRecord(
  backend: StorageBackend,
  threadId: string,
): Promise<ThreadMetaRecord | null> {
  return backend.get<ThreadMetaRecord>(THREADS_V2_META_STORE, threadId);
}

async function saveRecord(
  backend: StorageBackend,
  record: ThreadMetaRecord,
): Promise<void> {
  await backend.set(THREADS_V2_META_STORE, record.remoteId, record);
}

async function updateRecord(
  backend: StorageBackend,
  threadId: string,
  patch: Partial<ThreadMetaRecord>,
): Promise<void> {
  const current = await loadRecord(backend, threadId);
  if (!current) throw new Error("Thread not found");
  await saveRecord(backend, {
    ...current,
    ...patch,
    remoteId: current.remoteId,
    lastModified: new Date().toISOString(),
  });
}

function extractFirstUserText(messages: readonly any[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const content = message.content;
    if (Array.isArray(content)) {
      const text = content
        .filter((part: any) => part?.type === "text")
        .map((part: any) => String(part.text ?? ""))
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

function createThreadTitle(messages: readonly any[]): string {
  const text = extractFirstUserText(messages);
  if (!text) return "New Chat";
  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
}

export function createThreadListAdapter(
  backend: StorageBackend,
): RemoteThreadListAdapter {
  const unstable_Provider: FC<PropsWithChildren> = ({ children }) => {
    const history = useIndexedDbThreadHistoryAdapter(backend);
    return (
      <RuntimeAdapterProvider adapters={{ history }}>
        {children}
      </RuntimeAdapterProvider>
    );
  };

  return {
    async list() {
      const keys = await backend.keys(THREADS_V2_META_STORE);
      const records: ThreadMetaRecord[] = [];

      for (const key of keys) {
        const record = await loadRecord(backend, key);
        if (record) records.push(record);
      }

      records.sort((a, b) => b.lastModified.localeCompare(a.lastModified));

      return {
        threads: records.map((record) => ({
          remoteId: record.remoteId,
          externalId: record.externalId,
          status: record.status,
          title: record.title,
        })),
      };
    },

    async initialize(threadId) {
      const existing = await loadRecord(backend, threadId);
      if (existing) {
        return {
          remoteId: existing.remoteId,
          externalId: existing.externalId,
        };
      }

      const record = createNewThreadRecord(threadId);
      await saveRecord(backend, record);

      return {
        remoteId: record.remoteId,
        externalId: record.externalId,
      };
    },

    async rename(remoteId, newTitle) {
      await updateRecord(backend, remoteId, { title: newTitle });
    },

    async archive(remoteId) {
      await updateRecord(backend, remoteId, { status: "archived" });
    },

    async unarchive(remoteId) {
      await updateRecord(backend, remoteId, { status: "regular" });
    },

    async delete(remoteId) {
      await Promise.all([
        backend.delete(THREADS_V2_META_STORE, remoteId),
        backend.delete(THREADS_V2_MESSAGES_STORE, remoteId),
      ]);
    },

    async fetch(threadId) {
      const record = await loadRecord(backend, threadId);
      if (!record) throw new Error("Thread not found");
      return {
        remoteId: record.remoteId,
        externalId: record.externalId,
        status: record.status,
        title: record.title,
      };
    },

    async generateTitle(remoteId, messages) {
      const title = createThreadTitle(messages);
      await updateRecord(backend, remoteId, { title });
      return createAssistantStream(async (controller) => {
        controller.appendText(title);
      });
    },

    unstable_Provider,
  };
}
