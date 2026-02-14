import { html } from "lit";
import "./app.css";
import { state, setRenderCallback, CHAT_PATH } from "./app-state";
import { ensureChatRuntime, setRoute, updateUrl } from "./app-agent";
import { loadSession, newSession } from "./app-session";
import {
  renderWithRecovery,
  getPreferredTheme,
  applyTheme,
  doRenderCurrentView,
  showIntro,
  setShowChatCallback,
} from "./app-render";

// ── Wire up the render callback ────────────────────────────────────

setRenderCallback(doRenderCurrentView);

// ── Routing ────────────────────────────────────────────────────────

function isChatRoute(): boolean {
  const url = new URL(window.location.href);
  return url.pathname === CHAT_PATH || url.searchParams.has("session");
}

async function showChat(pushHistory: boolean) {
  if (state.switchingToChat) return;
  state.switchingToChat = true;

  try {
    if (pushHistory) {
      setRoute(CHAT_PATH);
    }

    state.appView = "chat";
    await ensureChatRuntime();

    if (state.currentSessionId) {
      updateUrl(state.currentSessionId);
      doRenderCurrentView();
      return;
    }

    const sessionId = new URLSearchParams(window.location.search).get("session");
    if (sessionId) {
      const ok = await loadSession(sessionId);
      if (ok) return;
    }

    await newSession();
  } finally {
    state.switchingToChat = false;
  }
}

// Let app-render call showChat without circular imports
setShowChatCallback(showChat);

async function routeByLocation() {
  if (isChatRoute()) {
    await showChat(false);
  } else {
    showIntro(false);
  }
}

// ── Init ───────────────────────────────────────────────────────────

// Track listeners for cleanup (#12)
const _cleanupFns: Array<() => void> = [];

function addGlobalListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (ev: WindowEventMap[K]) => void,
) {
  window.addEventListener(type, handler);
  _cleanupFns.push(() => window.removeEventListener(type, handler));
}

export function cleanupApp() {
  for (const fn of _cleanupFns) fn();
  _cleanupFns.length = 0;
  if (state.agentUnsubscribe) {
    state.agentUnsubscribe();
    state.agentUnsubscribe = undefined;
  }
}

async function initApp() {
  state.appRoot = document.getElementById("app");
  if (!state.appRoot) throw new Error("App container not found");
  state.appRoot.innerHTML = "";

  state.chatHost = document.createElement("div");
  state.introHost = document.createElement("div");
  state.chatHost.style.width = "100%";
  state.chatHost.style.height = "100%";
  state.introHost.style.width = "100%";
  state.introHost.style.height = "100%";
  state.appRoot.append(state.chatHost, state.introHost);

  applyTheme(getPreferredTheme());

  renderWithRecovery(
    html`<div class="w-full h-screen flex items-center justify-center bg-background text-foreground">
      <div class="text-muted-foreground">Loading...</div>
    </div>`,
    state.chatHost,
  );
  state.introHost.style.display = "none";

  // Popstate for routing
  addGlobalListener("popstate", () => {
    void routeByLocation();
  });

  // Focus mode shortcut: Ctrl+Shift+F
  addGlobalListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      e.preventDefault();
      state.focusMode = !state.focusMode;
    }
  });

  await routeByLocation();
}

void initApp();
