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
import { addGlobalListener, cleanupApp, createAppContainers } from "./app-lifecycle";
import { regenerateLastResponse } from "./app-message-actions";
import { getLocale, onLocaleChange } from "./lib/i18n";
import { setTranslations, defaultEnglish } from "@mariozechner/mini-lit";
import { miniLitChinese } from "./lib/mini-lit-zh";

// ── Sync mini-lit i18n with our locale system ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
setTranslations({ en: defaultEnglish, zh: miniLitChinese } as any);
try { localStorage.setItem("language", getLocale()); } catch { /* ignore */ }

// ── Wire up the render callback ────────────────────────────────

setRenderCallback(doRenderCurrentView);

// ── Routing ────────────────────────────────────────────────────

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

// ── Init ───────────────────────────────────────────────────────

export { cleanupApp };

async function initApp() {
  const { introHost } = createAppContainers();

  applyTheme(getPreferredTheme());

  renderWithRecovery(
    html`<div class="w-full h-screen flex items-center justify-center bg-background text-foreground">
      <div class="text-muted-foreground">Loading...</div>
    </div>`,
    state.chatHost!,
  );
  introHost.style.display = "none";

  // Re-render on locale change
  onLocaleChange(() => doRenderCurrentView());

  // Popstate for routing
  addGlobalListener("popstate", () => {
    void routeByLocation();
  });

  // Focus mode shortcut: Ctrl+Shift+F to toggle, Escape to exit
  // Regenerate shortcut: Ctrl+Shift+R
  addGlobalListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      e.preventDefault();
      state.focusMode = !state.focusMode;
    } else if (e.ctrlKey && e.shiftKey && e.key === "R") {
      e.preventDefault();
      void regenerateLastResponse();
    } else if (e.key === "Escape" && state.focusMode) {
      state.focusMode = false;
    }
  });

  await routeByLocation();
}

void initApp();
