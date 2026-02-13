import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import {
  ProvidersModelsTab,
  ProxyTab,
  SessionListDialog,
  SettingsDialog,
} from "@mariozechner/pi-web-ui";
import { FileText, History, Plus, Server, Settings } from "lucide";
import { html, render } from "lit";
import { state, storage, renderCurrentView } from "./app-state";
import { getDefaultModel, isProxyModeEnabled, setProxyModeEnabled, setRoute } from "./app-agent";
import { ROOT_PATH } from "./app-state";
import { loadSession, newSession } from "./app-session";
import { renderWorkspacePanel, toggleWorkspacePanel } from "./app-workspace";
import { mountLegacyIntro, unmountLegacyIntro } from "./legacy-intro/mount";

// ── Lit render helpers ─────────────────────────────────────────────

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

// ── Theme ──────────────────────────────────────────────────────────

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

// ── Chat view ──────────────────────────────────────────────────────

export function renderChatView() {
  if (!state.chatHost || !state.introHost || !state.chatPanel) return;
  unmountLegacyIntro();
  state.introHost.style.display = "none";
  state.chatHost.style.display = "block";

  const headerTitle = state.currentTitle || state.character?.data.name || "Limerence Pi Web";

  const appHtml = html`
    <div class="w-full h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div class="flex items-center justify-between border-b border-border shrink-0">
        <div class="flex items-center gap-2 px-4 py-2 min-w-0">
          ${Button({
            variant: "ghost",
            size: "sm",
            children: html`<span class="text-xs">Intro</span>`,
            onClick: () => {
              showIntro(true);
            },
            title: "返回首页",
          })}

          ${Button({
            variant: "ghost",
            size: "sm",
            children: icon(History, "sm"),
            onClick: () => {
              SessionListDialog.open(
                async (sessionId) => {
                  await loadSession(sessionId);
                },
                (deletedSessionId) => {
                  if (deletedSessionId === state.currentSessionId) {
                    void newSession();
                  }
                },
              );
            },
            title: "会话列表",
          })}

          ${Button({
            variant: "ghost",
            size: "sm",
            children: icon(Plus, "sm"),
            onClick: () => {
              void newSession();
            },
            title: "新会话",
          })}

          ${
            state.isEditingTitle
              ? Input({
                  type: "text",
                  value: headerTitle,
                  className: "text-sm w-64",
                  onChange: async (e: Event) => {
                    const next = (e.target as HTMLInputElement).value.trim();
                    if (next) {
                      state.currentTitle = next;
                      if (state.currentSessionId) {
                        await storage.sessions.updateTitle(state.currentSessionId, next);
                      }
                    }
                    state.isEditingTitle = false;
                    renderCurrentView();
                  },
                })
              : html`<button
                  class="px-2 py-1 text-sm text-foreground hover:bg-secondary rounded transition-colors truncate max-w-[24rem]"
                  @click=${() => {
                    state.isEditingTitle = true;
                    renderCurrentView();
                  }}
                  title="点击编辑标题"
                >
                  ${headerTitle}
                </button>`
          }
        </div>

        <div class="flex items-center gap-1 px-2">
          ${Button({
            variant: "ghost",
            size: "sm",
            children: html`<span class="inline-flex items-center gap-1">${icon(Server, "sm")}<span class="text-xs">Proxy ${state.proxyModeEnabled ? "ON" : "OFF"}</span></span>`,
            onClick: async () => {
              state.proxyModeEnabled = !state.proxyModeEnabled;
              await setProxyModeEnabled(state.proxyModeEnabled);
              if (state.proxyModeEnabled) {
                await storage.providerKeys.set("limerence-proxy", "__PROXY__");
              }
              state.agent!.setModel(await getDefaultModel());
              renderCurrentView();
            },
            title: "切换 Netlify 代理模式",
          })}

          ${Button({
            variant: "ghost",
            size: "sm",
            children: html`<span class="inline-flex items-center gap-1">${icon(FileText, "sm")}<span class="text-xs">${state.workspacePanelOpen ? "工作区 ON" : "工作区"}</span></span>`,
            onClick: () => {
              void toggleWorkspacePanel();
            },
            title: "打开 Markdown 工作区",
          })}

          <theme-toggle></theme-toggle>

          ${Button({
            variant: "ghost",
            size: "sm",
            children: icon(Settings, "sm"),
            onClick: () => SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab()]),
            title: "设置",
          })}
        </div>
      </div>

      <div class="limerence-chat-shell">
        <div class="limerence-chat-main">${state.chatPanel}</div>
        ${state.workspacePanelOpen ? renderWorkspacePanel() : null}
      </div>
    </div>
  `;

  renderWithRecovery(appHtml, state.chatHost);
}

// ── View dispatcher ────────────────────────────────────────────────

export function doRenderCurrentView() {
  if (!state.chatHost || !state.introHost) return;

  if (state.appView === "intro") {
    resetLitContainer(state.chatHost);
    state.chatHost.style.display = "none";
    state.introHost.style.display = "block";
    mountLegacyIntro(state.introHost, () => {
      // showChat is imported from main.ts via the callback set during init
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
