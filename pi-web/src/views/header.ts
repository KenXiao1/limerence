/**
 * Chat header — pure view function.
 * Renders the top bar with navigation, title, status indicators, and action buttons.
 */

import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { SessionListDialog } from "@mariozechner/pi-web-ui";
import { FileText, History, Maximize2, Minimize2, Moon, Plus, Server, Settings, Sun, Download, Upload, Users, SlidersHorizontal, Cloud, LogOut } from "lucide";
import { html } from "lit";
import { t, getLocale, setLocale } from "../lib/i18n";
import { renderTokenUsage } from "./token-usage";
import { renderToolCalls } from "./tool-calls";

import type { SyncStatus } from "../lib/sync-engine";

export interface HeaderState {
  currentTitle: string;
  characterName: string;
  isEditingTitle: boolean;
  isStreaming: boolean;
  focusMode: boolean;
  proxyModeEnabled: boolean;
  workspacePanelOpen: boolean;
  estimatedTokens: number;
  contextWindow: number;
  activeToolCalls: Array<{ id: string; name: string; label: string }>;
  currentSessionId: string | undefined;
  preferredTheme: "light" | "dark";
  authEmail: string | null;
  syncStatus: SyncStatus;
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
  onOpenCharacterSelector: () => void;
  onOpenLimerenceSettings: () => void;
  onExportSession: () => void;
  onImportSession: (file: File) => void;
  onLoginClick: () => void;
  onLogout: () => void;
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
          title: t("header.intro"),
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
          title: t("header.sessions"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(Plus, "sm"),
          onClick: actions.onNewSession,
          title: t("header.new"),
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
              title="${t("header.editTitle")}"
            >
              ${headerTitle}
            </button>`
        }
        ${s.isStreaming ? html`<span class="limerence-typing-indicator">${t("tool.typing")}<span class="limerence-typing-dots"></span></span>` : null}
      </div>

      <div class="flex items-center gap-1 px-2">
        ${renderToolCalls(s.activeToolCalls)}
        ${renderTokenUsage(s.estimatedTokens, s.contextWindow)}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(Users, "sm"),
          onClick: actions.onOpenCharacterSelector,
          title: t("header.characters"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(Download, "sm"),
          onClick: actions.onExportSession,
          title: t("header.export"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: html`<label style="cursor:pointer;display:flex;align-items:center">
            ${icon(Upload, "sm")}
            <input type="file" accept=".json" style="display:none" @change=${(e: Event) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) actions.onImportSession(file);
              (e.target as HTMLInputElement).value = "";
            }} />
          </label>`,
          onClick: () => {},
          title: t("header.import"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: html`<span class="inline-flex items-center gap-1">${icon(Server, "sm")}<span class="text-xs limerence-header-label">Proxy ${s.proxyModeEnabled ? "ON" : "OFF"}</span></span>`,
          onClick: actions.onToggleProxy,
          title: t("header.proxy"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: html`<span class="inline-flex items-center gap-1">${icon(FileText, "sm")}<span class="text-xs limerence-header-label">${s.workspacePanelOpen ? t("header.workspaceOn") : t("header.workspace")}</span></span>`,
          onClick: actions.onToggleWorkspace,
          title: t("header.workspaceTooltip"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(SlidersHorizontal, "sm"),
          onClick: actions.onOpenLimerenceSettings,
          title: t("header.limerenceSettings"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: html`<span class="text-xs font-medium">${t("lang.switch")}</span>`,
          onClick: () => { setLocale(getLocale() === "zh" ? "en" : "zh"); },
          title: t("lang.tooltip"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(s.preferredTheme === "dark" ? Sun : Moon, "sm"),
          onClick: (e: Event) => actions.onToggleTheme(e as MouseEvent),
          title: t("header.theme"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(s.focusMode ? Minimize2 : Maximize2, "sm"),
          onClick: actions.onToggleFocus,
          title: t("header.focus"),
        })}

        ${Button({
          variant: "ghost",
          size: "sm",
          children: icon(Settings, "sm"),
          onClick: actions.onOpenSettings,
          title: t("header.settings"),
        })}

        ${s.authEmail
          ? html`
            <span class="inline-flex items-center gap-1 px-1">
              ${icon(Cloud, "sm")}
              <span class="w-2 h-2 rounded-full ${
                s.syncStatus === "synced" ? "bg-green-500" :
                s.syncStatus === "syncing" ? "bg-yellow-500 animate-pulse" :
                s.syncStatus === "error" ? "bg-red-500" :
                "bg-zinc-400"
              }"></span>
            </span>
            ${Button({
              variant: "ghost",
              size: "sm",
              children: html`<span class="inline-flex items-center gap-1">${icon(LogOut, "sm")}<span class="text-xs limerence-header-label truncate max-w-[80px]">${s.authEmail}</span></span>`,
              onClick: actions.onLogout,
              title: t("auth.logout"),
            })}`
          : Button({
              variant: "ghost",
              size: "sm",
              children: html`<span class="inline-flex items-center gap-1">${icon(Cloud, "sm")}<span class="text-xs limerence-header-label">${t("sync.login")}</span></span>`,
              onClick: actions.onLoginClick,
              title: t("sync.login"),
            })
        }
      </div>
    </div>
  `;
}
