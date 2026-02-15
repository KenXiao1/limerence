/**
 * App lifecycle — centralized initialization, cleanup, and resource tracking.
 * All disposable resources (listeners, timers, observers) are tracked here.
 */

import { state, syncEngine, limerenceStorage } from "./app-state";
import { getSessionUser, onAuthStateChange, touchActive } from "./lib/auth";
import { isConfigured } from "./lib/supabase";
import { doRenderCurrentView } from "./app-render";

// ── Resource tracking ──────────────────────────────────────────

const _cleanupFns: Array<() => void> = [];

/**
 * Register a window event listener that will be automatically cleaned up.
 */
export function addGlobalListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (ev: WindowEventMap[K]) => void,
) {
  window.addEventListener(type, handler);
  _cleanupFns.push(() => window.removeEventListener(type, handler));
}

/**
 * Register a document event listener that will be automatically cleaned up.
 */
export function addDocumentListener<K extends keyof DocumentEventMap>(
  type: K,
  handler: (ev: DocumentEventMap[K]) => void,
) {
  document.addEventListener(type, handler);
  _cleanupFns.push(() => document.removeEventListener(type, handler));
}

/**
 * Register a timer (setInterval) that will be automatically cleaned up.
 */
export function addInterval(callback: () => void, ms: number): number {
  const id = window.setInterval(callback, ms);
  _cleanupFns.push(() => clearInterval(id));
  return id;
}

/**
 * Register an arbitrary cleanup function.
 */
export function onCleanup(fn: () => void) {
  _cleanupFns.push(fn);
}

// ── Cleanup ────────────────────────────────────────────────────

/**
 * Run all registered cleanup functions and clear the list.
 * Also cleans up agent subscription if active.
 */
export function cleanupApp() {
  for (const fn of _cleanupFns) {
    try { fn(); } catch { /* ignore cleanup errors */ }
  }
  _cleanupFns.length = 0;

  if (state.agentUnsubscribe) {
    state.agentUnsubscribe();
    state.agentUnsubscribe = undefined;
  }
}

// ── DOM setup ──────────────────────────────────────────────────

/**
 * Create the app's DOM containers (chatHost + introHost) inside #app.
 */
export function createAppContainers(): { chatHost: HTMLElement; introHost: HTMLElement } {
  const appRoot = document.getElementById("app");
  if (!appRoot) throw new Error("App container not found");
  appRoot.innerHTML = "";

  const chatHost = document.createElement("div");
  const introHost = document.createElement("div");
  const dialogHost = document.createElement("div");
  chatHost.style.width = "100%";
  chatHost.style.height = "100%";
  introHost.style.width = "100%";
  introHost.style.height = "100%";
  appRoot.append(chatHost, introHost, dialogHost);

  state.appRoot = appRoot;
  state.chatHost = chatHost;
  state.introHost = introHost;
  state.dialogHost = dialogHost;

  return { chatHost, introHost };
}

// ── Auth initialization ────────────────────────────────────────

const TOUCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Initialize auth: check existing session, set up onAuthStateChange listener,
 * wire up SyncEngine status callback, and start touchActive timer.
 */
export async function initAuth(): Promise<void> {
  if (!isConfigured()) return;

  // Wire sync engine status → app state
  syncEngine.setStatusCallback((status) => {
    state.syncStatus = status;
  });
  syncEngine.setRemoteChangeCallback(() => {
    doRenderCurrentView();
  });

  // Wire storage sync hooks
  limerenceStorage.setSyncHook({
    onMemoryAdd: (entry) => { void syncEngine.pushMemory(entry); },
    onNoteWrite: (key, content) => { void syncEngine.pushNoteData(key, content); },
    onFileWrite: (path, content) => { void syncEngine.pushFileData(path, content); },
    onCharactersSave: (chars) => { void syncEngine.pushCharacterData(chars); },
    onCharacterRemove: (id) => { void syncEngine.pushCharacterRemove(id); },
    onLorebookSave: (entries) => { void syncEngine.pushLorebookData(entries); },
  });

  // Check existing session
  const user = await getSessionUser();
  if (user) {
    state.authUser = user;
    void syncEngine.start(user.id);
  }

  // Listen for auth state changes
  const unsub = onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      state.authUser = session.user;
      void syncEngine.start(session.user.id);
    } else if (event === "SIGNED_OUT") {
      syncEngine.stop();
      state.authUser = null;
      state.syncStatus = "idle";
    }
  });
  if (unsub) onCleanup(unsub);

  // touchActive timer (10 min)
  addInterval(() => {
    if (state.authUser) {
      void touchActive();
    }
  }, TOUCH_INTERVAL_MS);

  // Cleanup sync engine on app teardown
  onCleanup(() => syncEngine.stop());
}
