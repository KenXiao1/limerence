/**
 * Session hook — React context for session CRUD operations.
 * Replaces app-session.ts with React-managed state.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useStorageContext } from "./use-storage";
import type { AgentMessage } from "../runtime/message-converter";
import {
  generateTitle as _generateTitle,
  shouldSaveSession as _shouldSaveSession,
  createMemoryEntry,
  buildSessionData,
  summarizeUsage,
} from "../controllers/session";

// ── Store names (backward-compatible) ───────────────────────────

const SESSIONS_STORE = "pi-web-ui:sessions";
const SESSION_METADATA_STORE = "pi-web-ui:session-metadata";

// ── Types ───────────────────────────────────────────────────────

export interface SessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  lastModified: string;
  messageCount: number;
  modelId: string | null;
  preview: string;
}

export interface SessionData {
  id: string;
  title: string;
  model: any;
  thinkingLevel: any;
  messages: AgentMessage[];
  createdAt: string;
  lastModified: string;
}

// ── Context ─────────────────────────────────────────────────────

export interface SessionContextValue {
  currentSessionId: string | undefined;
  currentTitle: string;
  currentCreatedAt: string;
  messages: AgentMessage[];

  setCurrentTitle: (title: string) => void;
  setMessages: (msgs: AgentMessage[]) => void;

  newSession: () => void;
  loadSession: (sessionId: string) => Promise<boolean>;
  saveSession: (model: any, thinkingLevel: any) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  listSessions: () => Promise<SessionMetadata[]>;
  updateTitle: (sessionId: string, title: string) => Promise<void>;

  indexMessageIntoMemory: (message: AgentMessage) => Promise<void>;
  generateTitle: (messages: AgentMessage[]) => string;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ── Default usage ───────────────────────────────────────────────

function defaultUsage() {
  return {
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

// ── Provider ────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: ReactNode }) {
  const { backend, storage: limerenceStorage, memoryIndex } = useStorageContext();

  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(() => {
    // Check URL for session ID
    const params = new URLSearchParams(window.location.search);
    return params.get("session") ?? crypto.randomUUID();
  });
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentCreatedAt, setCurrentCreatedAt] = useState(() => new Date().toISOString());
  const [messages, setMessages] = useState<AgentMessage[]>([]);

  const updateUrl = useCallback((sessionId: string) => {
    const url = new URL(window.location.href);
    url.pathname = "/chat";
    url.searchParams.set("session", sessionId);
    window.history.replaceState({}, "", url.toString());
  }, []);

  const newSession = useCallback(() => {
    const id = crypto.randomUUID();
    setCurrentSessionId(id);
    setCurrentTitle("");
    setCurrentCreatedAt(new Date().toISOString());
    setMessages([]);
    updateUrl(id);
  }, [updateUrl]);

  const loadSession = useCallback(async (sessionId: string): Promise<boolean> => {
    const data = await backend.get<SessionData>(SESSIONS_STORE, sessionId);
    if (!data) return false;

    setCurrentSessionId(sessionId);
    setCurrentTitle(data.title ?? "");
    setCurrentCreatedAt(data.createdAt);
    setMessages(data.messages ?? []);
    updateUrl(sessionId);
    return true;
  }, [backend, updateUrl]);

  const saveSession = useCallback(async (model: any, thinkingLevel: any) => {
    if (!currentSessionId) return;
    if (!_shouldSaveSession(messages as any)) return;

    const { sessionData, metadata, title } = buildSessionData({
      sessionId: currentSessionId,
      title: currentTitle,
      createdAt: currentCreatedAt,
      messages: messages as any,
      model,
      thinkingLevel,
    });

    if (!currentTitle && title) {
      setCurrentTitle(title);
    }

    const usage = summarizeUsage(messages as any, defaultUsage());
    await backend.set(SESSIONS_STORE, currentSessionId, sessionData);
    await backend.set(SESSION_METADATA_STORE, currentSessionId, { ...metadata, usage });
  }, [backend, currentSessionId, currentTitle, currentCreatedAt, messages]);

  const deleteSession = useCallback(async (sessionId: string) => {
    await backend.delete(SESSIONS_STORE, sessionId);
    await backend.delete(SESSION_METADATA_STORE, sessionId);
  }, [backend]);

  const listSessions = useCallback(async (): Promise<SessionMetadata[]> => {
    const keys = await backend.keys(SESSION_METADATA_STORE);
    const results: SessionMetadata[] = [];
    for (const key of keys) {
      const meta = await backend.get<SessionMetadata>(SESSION_METADATA_STORE, key);
      if (meta) results.push(meta);
    }
    // Sort by lastModified descending
    results.sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));
    return results;
  }, [backend]);

  const updateTitle = useCallback(async (sessionId: string, title: string) => {
    if (sessionId === currentSessionId) {
      setCurrentTitle(title);
    }
    // Update metadata
    const meta = await backend.get<SessionMetadata>(SESSION_METADATA_STORE, sessionId);
    if (meta) {
      await backend.set(SESSION_METADATA_STORE, sessionId, { ...meta, title });
    }
    // Update session data
    const data = await backend.get<SessionData>(SESSIONS_STORE, sessionId);
    if (data) {
      await backend.set(SESSIONS_STORE, sessionId, { ...data, title });
    }
  }, [backend, currentSessionId]);

  const indexMessageIntoMemory = useCallback(async (message: AgentMessage) => {
    const entry = createMemoryEntry(message as any, currentSessionId ?? "");
    if (!entry) return;
    memoryIndex.add(entry);
    await limerenceStorage.addMemoryEntry(entry);
  }, [memoryIndex, limerenceStorage, currentSessionId]);

  const value: SessionContextValue = {
    currentSessionId,
    currentTitle,
    currentCreatedAt,
    messages,
    setCurrentTitle,
    setMessages,
    newSession,
    loadSession,
    saveSession,
    deleteSession,
    listSessions,
    updateTitle,
    indexMessageIntoMemory,
    generateTitle: _generateTitle as any,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
