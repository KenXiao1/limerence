import type { Agent } from "@mariozechner/pi-agent-core";
import type { Usage } from "@mariozechner/pi-ai";
import type { SwipeState } from "./controllers/message-actions";
import type { RegexRule } from "./controllers/regex-rules";
import type { GenerationPreset } from "./controllers/presets";
import type { CharacterEntry } from "./controllers/character";
import type { SettingsTab } from "./views/settings-panels";
import type { PromptPresetConfig } from "./controllers/prompt-presets";
import type { GroupChatConfig } from "./controllers/group-chat";
import { DEFAULT_GROUP_CONFIG } from "./controllers/group-chat";
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
import type { User } from "@supabase/supabase-js";
import type { CharacterCard, Persona } from "./lib/character";
import type { LorebookEntry } from "./lib/storage";
import { MemoryIndex } from "./lib/memory";
import { getLimerenceStoreConfigs, LimerenceStorage } from "./lib/storage";
import type { FileOperation } from "./lib/tools";
import { SyncEngine, type SyncStatus } from "./lib/sync-engine";
import type { AuthTab } from "./views/auth-dialog";

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

export const SYNC_META_STORE = "limerence-sync-meta";

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
    { name: SYNC_META_STORE },
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
export const syncEngine = new SyncEngine(backend);

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
  persona: undefined as Persona | undefined,
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

  // message actions (swipe / edit / delete)
  swipeData: new Map() as Map<number, SwipeState>,
  editMode: false,
  editingIndex: -1,
  editText: "",
  editRole: "" as string,

  // character selector
  characterSelectorOpen: false,
  characterList: [] as CharacterEntry[],
  characterImportError: "",

  // lorebook
  lorebookEntries: [] as LorebookEntry[],

  // generation presets
  activePreset: undefined as GenerationPreset | undefined,

  // regex rules
  regexRules: [] as RegexRule[],

  // limerence settings panel
  limerenceSettingsOpen: false,
  limerenceSettingsTab: "persona" as SettingsTab,
  lorebookDraftKeywords: "",
  lorebookDraftContent: "",
  customPresets: [] as GenerationPreset[],
  regexDraftName: "",
  regexDraftPattern: "",
  regexDraftReplacement: "",
  regexDraftScope: "output" as RegexRule["scope"],
  regexError: "",

  // prompt presets
  promptPresets: [] as PromptPresetConfig[],
  activePromptPreset: undefined as PromptPresetConfig | undefined,
  promptPresetImportError: "",

  // group chat
  groupChat: { ...DEFAULT_GROUP_CONFIG } as GroupChatConfig,
  groupChatLastSpeakerId: null as string | null,
  groupChatManualPickOpen: false,

  // auth & sync
  authUser: null as User | null,
  syncStatus: "idle" as SyncStatus,
  authDialogOpen: false,
  authDialogTab: "login" as AuthTab,
  authDialogLoading: false,
  authDialogError: "",
  authSignupSuccess: false,
  supabaseConfigDialogOpen: false,
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
