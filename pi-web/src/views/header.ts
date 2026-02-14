/**
 * Chat header — pure view function.
 * Renders the top bar with navigation, title, status indicators, and action buttons.
 */

import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { SessionListDialog } from "@mariozechner/pi-web-ui";
import { FileText, History, Maximize2, Minimize2, Moon, Plus, Server, Settings, Sun } from "lucide";
import { html } from "lit";
import { renderTokenUsage } from "./token-usage";
import { renderToolCalls } from "./tool-calls";

export interface HeaderState {
  currentTitle: string;
  characterName: string;
  isEditingTitle: boolean;
  focusMode: boolean;
  proxyModeEnabled: boolean;
  workspacePanelOpen: boolean;
  estimatedTokens: number;
  contextWindow: number;
  activeToolCalls: Array<{ id: string; name: string; label: string }>;
  currentSessionId: string | undefined;
  preferredTheme: "light" | "dark";
}

export interface HeaderActions {
  onShowIntro: () => void;
  onLoadSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  onTitleChange: (title: string) => void;
  onStartEditTitle: () => void;
  onToggleProxy: () => void;
  onToggleWorkspace: () => void;
  onToggleTheme: (e: MouseEvent) => void;
  onToggleFocus: () => void;
  onOpenSettings: () => void;
}

export function renderHeader(s: HeaderState, actions: HeaderActions) {
  const headerTitle = s.currentTitle || s.characterName || "Limerence Pi Web";

  return html`
    <div class="limerence-header flex items-center justify-between border-b border-border shrink-0">
      <div class="flex items-center gap-2 px-4 py-2 min-w-0">
        ${Button({
          variant: "ghost",
          size: "sm",
          children: html`<span class="text-xs">Intro</span>`,
          onClick: actions.onShowIntro,
          title: "返回首页",
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(History, "sm"),
          onClick: () => {
            SessionListDialog.open(
              async (sessionId) => { await actions.onLoadSession(sessionId); },
              (deletedSessionId) => { actions.onDeleteSession(deletedSessionId); },
            );
          },
          title: "会话列表",
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(Plus, "sm"),
          onClick: actions.onNewSession,
          title: "新会话",
        })}

        ${s.isEditingTitle
          ? Input({
              type: "text",
              value: headerTitle,
              className: "text-sm w-64",
              onChange: async (e: Event) => {
                const next = (e.target as HTMLInputElement).value.trim();
                if (next) actions.onTitleChange(next);
              },
            })
          : html`<button
              class="px-2 py-1 text-sm text-foreground hover:bg-secondary rounded transition-colors truncate max-w-[24rem]"
              @click=${actions.onStartEditTitle}
              title="点击编辑标题"
            >
              ${headerTitle}
            </button>`
        }
      </div>

      <div class="flex items-center gap-1 px-2">
        ${renderToolCalls(s.activeToolCalls)}
        ${renderTokenUsage(s.estimatedTokens, s.contextWindow)}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: html`<span class="inline-flex items-center gap-1">${icon(Server, "sm")}<span class="text-xs limerence-header-label">Proxy ${s.proxyModeEnabled ? "ON" : "OFF"}</span></span>`,
          onClick: actions.onToggleProxy,
          title: "切换 Netlify 代理模式",
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: html`<span class="inline-flex items-center gap-1">${icon(FileText, "sm")}<span class="text-xs limerence-header-label">${s.workspacePanelOpen ? "工作区 ON" : "工作区"}</span></span>`,
          onClick: actions.onToggleWorkspace,
          title: "打开 Markdown 工作区",
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(s.preferredTheme === "dark" ? Sun : Moon, "sm"),
          onClick: (e: Event) => actions.onToggleTheme(e as MouseEvent),
          title: "切换主题",
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(s.focusMode ? Minimize2 : Maximize2, "sm"),
          onClick: actions.onToggleFocus,
          title: "专注模式 (Ctrl+Shift+F)",
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(Settings, "sm"),
          onClick: actions.onOpenSettings,
          title: "设置",
        })}
      </div>
    </div>
  `;
}
