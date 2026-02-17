/**
 * Thread list adapter — connects session management to assistant-ui's thread list.
 */

import type { ExternalStoreThreadListAdapter } from "@assistant-ui/react";

export interface ThreadListDeps {
  listSessions: () => Promise<Array<{
    id: string;
    title: string;
    lastModified?: string;
  }>>;
  loadSession: (id: string) => Promise<boolean>;
  deleteSession: (id: string) => Promise<void>;
  newSession: () => void;
  currentSessionId: string | undefined;
}

export function createThreadListAdapter(deps: ThreadListDeps): ExternalStoreThreadListAdapter {
  return {
    onRename: async (threadId: string, newTitle: string) => {
      void threadId;
      void newTitle;
    },

    onArchive: async (threadId: string) => {
      await deps.deleteSession(threadId);
    },

    onDelete: async (threadId: string) => {
      await deps.deleteSession(threadId);
    },

    onUnarchive: async () => {
      // Not supported
    },

    onSwitchToNewThread: async () => {
      deps.newSession();
    },

    onSwitchToThread: async (threadId: string) => {
      await deps.loadSession(threadId);
    },
  };
}
