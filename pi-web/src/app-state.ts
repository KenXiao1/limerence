import type { Agent } from "@mariozechner/pi-agent-core";
import type { Usage } from "@mariozechner/pi-ai";
import {
  AppStorage,
  ChatPanel,
  CustomProvidersStore,
  IndexedDBStorageBackend,
  ProviderKeysStore,
  SessionsStore,
  SettingsStore,
  setAppStorage,
} from "@mariozechner/pi-web-ui";
import type { CharacterCard } from "./lib/character";
import { MemoryIndex } from "./lib/memory";
import { getLimerenceStoreConfigs, LimerenceStorage } from "./lib/storage";
import type { FileOperation } from "./lib/tools";

// ── Types ──────────────────────────────────────────────────────────

export type ViewMode = "intro" | "chat";
export type WorkspaceEventSource = "agent" | "user";
export type WorkspaceEvent = FileOperation & {
  id: string;
  source: WorkspaceEventSource;
};
export type DiffLine = {
  type: "added" | "removed";
  text: string;
};
export type DiffPreview = {
  lines: DiffLine[];
  added: number;
  removed: number;
  truncated: boolean;
};

// ── Constants ──────────────────────────────────────────────────────

export const DB_NAME = "limerence-pi-web";
export const DB_VERSION = 1;
export const PROXY_MODE_KEY = "limerence.proxy_mode";
export const ROOT_PATH = "/";
export const CHAT_PATH = "/chat";
export const MAX_WORKSPACE_EVENTS = 80;
export const MAX_DIFF_MATRIX = 160_000;
export const MAX_DIFF_PREVIEW_LINES = 260;

// ── Stores ─────────────────────────────────────────────────────────

export const settings = new SettingsStore();
export const providerKeys = new ProviderKeysStore();
export const sessions = new SessionsStore();
export const customProviders = new CustomProvidersStore();

export const backend = new IndexedDBStorageBackend({
  dbName: DB_NAME,
  version: DB_VERSION,
  stores: [
    settings.getConfig(),
    SessionsStore.getMetadataConfig(),
    providerKeys.getConfig(),
    customProviders.getConfig(),
    sessions.getConfig(),
    ...getLimerenceStoreConfigs(),
  ],
});

settings.setBackend(backend);
providerKeys.setBackend(backend);
customProviders.setBackend(backend);
sessions.setBackend(backend);

export const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
setAppStorage(storage);

export const limerenceStorage = new LimerenceStorage(backend);
export const memoryIndex = new MemoryIndex();

// ── Render callback (set by main.ts to break circular deps) ────────

export let renderCurrentView: () => void = () => {};
export function setRenderCallback(fn: () => void) {
  renderCurrentView = fn;
}

// ── Reactive state (Proxy auto-triggers renderCurrentView) ─────────

let _renderScheduled = false;

function scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  queueMicrotask(() => {
    _renderScheduled = false;
    renderCurrentView();
  });
}

const _rawState = {
  appRoot: null as HTMLElement | null,
  chatHost: null as HTMLElement | null,
  introHost: null as HTMLElement | null,
  appView: "intro" as ViewMode,
  chatRuntimeReady: false,

  character: undefined as CharacterCard | undefined,
  chatPanel: undefined as ChatPanel | undefined,
  agent: undefined as Agent | undefined,
  agentUnsubscribe: undefined as (() => void) | undefined,

  currentSessionId: undefined as string | undefined,
  currentSessionCreatedAt: new Date().toISOString(),
  currentTitle: "",
  isEditingTitle: false,
  proxyModeEnabled: false,
  switchingToChat: false,

  // workspace
  workspacePanelOpen: false,
  workspacePanelWidth: Number(localStorage.getItem("limerence-ws-width")) || 420,
  workspaceResizing: false,
  workspaceFiles: [] as string[],
  workspaceSelectedPath: "",
  workspaceDraftPath: "notes/daily.md",
  workspaceEditorContent: "",
  workspaceBaseContent: "",
  workspaceEditorDirty: false,
  workspaceLoadingFile: false,
  workspaceMessage: "",
  workspaceEvents: [] as WorkspaceEvent[],

  // message queue (send when agent finishes)
  messageQueue: [] as string[],

  // active tool calls (for progress display)
  activeToolCalls: [] as Array<{ id: string; name: string; label: string }>,

  // token usage tracking
  estimatedTokens: 0,
  contextWindow: 128000,

  // focus mode
  focusMode: false,
};

export type AppState = typeof _rawState;

export const state: AppState = new Proxy(_rawState, {
  set(target, prop, value) {
    const key = prop as keyof AppState;
    if (target[key] === value) return true;
    (target as any)[key] = value;
    scheduleRender();
    return true;
  },
});

// ── Helpers ─────────────────────────────────────────────────────────

export function defaultUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}
