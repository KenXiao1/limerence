import {
  ProvidersModelsTab,
  ProxyTab,
  SettingsDialog,
} from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { state, storage } from "./app-state";
import { getDefaultModel, setProxyModeEnabled, setRoute } from "./app-agent";
import { ROOT_PATH } from "./app-state";
import { loadSession, newSession } from "./app-session";
import { renderWorkspacePanel, toggleWorkspacePanel } from "./app-workspace";
import { mountLegacyIntro, unmountLegacyIntro } from "./legacy-intro/mount";
import { startThemeTransition } from "./theme-transition";
import { renderHeader, type HeaderState, type HeaderActions } from "./views/header";

// ── Lit render helpers ─────────────────────────────────────────

const LIT_PART_KEY = "_$litPart$";

function resetLitContainer(container: HTMLElement) {
  container.replaceChildren();
  const litPart = (container as any)[LIT_PART_KEY];
  if (litPart) {
    delete (container as any)[LIT_PART_KEY];
  }
}

export function renderWithRecovery(view: unknown, container: HTMLElement) {
  try {
    render(view, container);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("insertBefore")) {
      throw error;
    }
  }

  resetLitContainer(container);
  render(view, container);
}

// ── Theme ──────────────────────────────────────────────────────

export function getPreferredTheme(): "light" | "dark" {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  localStorage.setItem("limerence-theme", theme);
}

// ── Chat view ──────────────────────────────────────────────────

export function renderChatView() {
  if (!state.chatHost || !state.introHost || !state.chatPanel) return;
  unmountLegacyIntro();
  state.introHost.style.display = "none";
  state.chatHost.style.display = "block";

  const headerState: HeaderState = {
    currentTitle: state.currentTitle,
    characterName: state.character?.data.name ?? "",
    isEditingTitle: state.isEditingTitle,
    focusMode: state.focusMode,
    proxyModeEnabled: state.proxyModeEnabled,
    workspacePanelOpen: state.workspacePanelOpen,
    estimatedTokens: state.estimatedTokens,
    contextWindow: state.contextWindow,
    activeToolCalls: state.activeToolCalls,
    currentSessionId: state.currentSessionId,
    preferredTheme: getPreferredTheme(),
  };

  const headerActions: HeaderActions = {
    onShowIntro: () => showIntro(true),
    onLoadSession: async (sessionId) => { await loadSession(sessionId); },
    onDeleteSession: (deletedSessionId) => {
      if (deletedSessionId === state.currentSessionId) {
        void newSession();
      }
    },
    onNewSession: () => { void newSession(); },
    onTitleChange: async (title) => {
      state.currentTitle = title;
      if (state.currentSessionId) {
        await storage.sessions.updateTitle(state.currentSessionId, title);
      }
      state.isEditingTitle = false;
    },
    onStartEditTitle: () => { state.isEditingTitle = true; },
    onToggleProxy: async () => {
      state.proxyModeEnabled = !state.proxyModeEnabled;
      await setProxyModeEnabled(state.proxyModeEnabled);
      if (state.proxyModeEnabled) {
        await storage.providerKeys.set("limerence-proxy", "__PROXY__");
      }
      state.agent!.setModel(await getDefaultModel());
    },
    onToggleWorkspace: () => { void toggleWorkspacePanel(); },
    onToggleTheme: (e) => {
      startThemeTransition(e, () => {
        const next = getPreferredTheme() === "dark" ? "light" : "dark";
        applyTheme(next);
        doRenderCurrentView();
      });
    },
    onToggleFocus: () => { state.focusMode = !state.focusMode; },
    onOpenSettings: () => SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab()]),
  };

  const appHtml = html`
    <div class="w-full h-screen flex flex-col bg-background text-foreground overflow-hidden ${state.focusMode ? "limerence-focus-mode" : ""}">
      ${renderHeader(headerState, headerActions)}
      ${state.focusMode ? html`
        <button
          class="limerence-focus-exit"
          @click=${() => { state.focusMode = false; }}
          title="退出专注模式 (Esc)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
          </svg>
        </button>
      ` : null}
      <div class="limerence-chat-shell">
        <div class="limerence-chat-main">${state.chatPanel}</div>
        ${state.workspacePanelOpen ? renderWorkspacePanel() : null}
      </div>
    </div>
  `;

  renderWithRecovery(appHtml, state.chatHost);
}

// ── View dispatcher ────────────────────────────────────────────

export function doRenderCurrentView() {
  if (!state.chatHost || !state.introHost) return;

  if (state.appView === "intro") {
    resetLitContainer(state.chatHost);
    state.chatHost.style.display = "none";
    state.introHost.style.display = "block";
    mountLegacyIntro(state.introHost, () => {
      void _showChatCallback(true);
    });
    return;
  }

  renderChatView();
}

// showIntro is used by renderChatView's Intro button
export function showIntro(pushHistory: boolean) {
  state.appView = "intro";
  if (pushHistory) {
    setRoute(ROOT_PATH);
  }
  doRenderCurrentView();
}

// Callback for showChat — set by main.ts to avoid circular import
let _showChatCallback: (pushHistory: boolean) => Promise<void> = async () => {};
export function setShowChatCallback(fn: (pushHistory: boolean) => Promise<void>) {
  _showChatCallback = fn;
}
