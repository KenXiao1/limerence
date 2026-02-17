/**
 * Header component — top navigation bar.
 * Ported from views/header.ts (Lit) to React.
 */

import { useState, useCallback, useRef } from "react";
import {
  History,
  Plus,
  Server,
  FileText,
  Settings,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Download,
  Upload,
  Users,
  SlidersHorizontal,
  Cloud,
  LogOut,
} from "lucide-react";
import { t, getLocale, setLocale } from "../lib/i18n";
import { getPreferredTheme, toggleTheme, type Theme } from "../lib/theme";
import type { SyncStatus } from "../lib/sync-engine";

export interface HeaderProps {
  currentTitle: string;
  characterName: string;
  isStreaming: boolean;
  focusMode: boolean;
  proxyModeEnabled: boolean;
  workspacePanelOpen: boolean;
  estimatedTokens: number;
  contextWindow: number;
  activeToolCalls: Array<{ id: string; name: string }>;
  authEmail: string | null;
  syncStatus: SyncStatus;

  onShowIntro: () => void;
  onOpenSessions: () => void;
  onNewSession: () => void;
  onTitleChange: (title: string) => void;
  onToggleProxy: () => void;
  onToggleWorkspace: () => void;
  onToggleFocus: () => void;
  onOpenSettings: () => void;
  onOpenCharacterSelector: () => void;
  onOpenLimerenceSettings: () => void;
  onExportSession: () => void;
  onImportSession: (file: File) => void;
  onLoginClick: () => void;
  onLogout: () => void;
}

export function Header(props: HeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [theme, setTheme] = useState<Theme>(getPreferredTheme);
  const importRef = useRef<HTMLInputElement>(null);

  const headerTitle = props.currentTitle || props.characterName || "Limerence";

  const handleToggleTheme = useCallback(() => {
    const next = toggleTheme();
    setTheme(next);
  }, []);

  const handleTitleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed) props.onTitleChange(trimmed);
      setIsEditingTitle(false);
    },
    [props.onTitleChange],
  );

  const tokenPct = props.contextWindow > 0
    ? Math.round((props.estimatedTokens / props.contextWindow) * 100)
    : 0;

  return (
    <div className="flex items-center justify-between border-b border-border shrink-0 bg-background/80 backdrop-blur-sm">
      {/* Left side */}
      <div className="flex items-center gap-1 px-3 py-1.5 min-w-0">
        <IconBtn icon={null} label="Intro" onClick={props.onShowIntro} title={t("header.intro")}>
          <span className="text-xs font-medium">Intro</span>
        </IconBtn>
        <IconBtn icon={History} onClick={props.onOpenSessions} title={t("header.sessions")} />
        <IconBtn icon={Plus} onClick={props.onNewSession} title={t("header.new")} />

        {isEditingTitle ? (
          <input
            autoFocus
            defaultValue={headerTitle}
            className="text-sm w-64 px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            onBlur={(e) => handleTitleSubmit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSubmit((e.target as HTMLInputElement).value);
              if (e.key === "Escape") setIsEditingTitle(false);
            }}
          />
        ) : (
          <button
            className="px-2 py-1 text-sm text-foreground hover:bg-secondary rounded transition-colors truncate max-w-[24rem]"
            onClick={() => setIsEditingTitle(true)}
            title={t("header.editTitle")}
          >
            {headerTitle}
          </button>
        )}

        {props.isStreaming && (
          <span className="text-xs text-muted-foreground animate-pulse ml-1">
            {t("tool.typing")}...
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-0.5 px-2">
        {/* Active tool calls */}
        {props.activeToolCalls.length > 0 && (
          <span className="text-xs text-muted-foreground mr-1">
            {props.activeToolCalls.map((tc) => tc.name).join(", ")}
          </span>
        )}

        {/* Token usage */}
        {props.estimatedTokens > 0 && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              tokenPct > 80 ? "text-red-500" : tokenPct > 50 ? "text-yellow-500" : "text-muted-foreground"
            }`}
            title={`${props.estimatedTokens.toLocaleString()} / ${props.contextWindow.toLocaleString()} tokens`}
          >
            {tokenPct}%
          </span>
        )}

        <IconBtn icon={Users} onClick={props.onOpenCharacterSelector} title={t("header.characters")} />
        <IconBtn icon={Download} onClick={props.onExportSession} title={t("header.export")} />

        {/* Import */}
        <IconBtn
          icon={Upload}
          onClick={() => importRef.current?.click()}
          title={t("header.import")}
        />
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) props.onImportSession(file);
            e.target.value = "";
          }}
        />

        <IconBtn
          icon={Server}
          onClick={props.onToggleProxy}
          title={t("header.proxy")}
          label={`Proxy ${props.proxyModeEnabled ? "ON" : "OFF"}`}
        />

        <IconBtn
          icon={FileText}
          onClick={props.onToggleWorkspace}
          title={t("header.workspaceTooltip")}
          label={props.workspacePanelOpen ? t("header.workspaceOn") : t("header.workspace")}
        />

        <IconBtn icon={SlidersHorizontal} onClick={props.onOpenLimerenceSettings} title={t("header.limerenceSettings")} />

        <IconBtn
          icon={null}
          onClick={() => setLocale(getLocale() === "zh" ? "en" : "zh")}
          title={t("lang.tooltip")}
        >
          <span className="text-xs font-medium">{t("lang.switch")}</span>
        </IconBtn>

        <IconBtn
          icon={theme === "dark" ? Sun : Moon}
          onClick={handleToggleTheme}
          title={t("header.theme")}
        />

        <IconBtn
          icon={props.focusMode ? Minimize2 : Maximize2}
          onClick={props.onToggleFocus}
          title={t("header.focus")}
        />

        <IconBtn icon={Settings} onClick={props.onOpenSettings} title={t("header.settings")} />

        {/* Auth / Sync */}
        {props.authEmail ? (
          <>
            <span className="inline-flex items-center gap-1 px-1">
              <Cloud className="w-4 h-4" />
              <span
                className={`w-2 h-2 rounded-full ${
                  props.syncStatus === "synced"
                    ? "bg-green-500"
                    : props.syncStatus === "syncing"
                      ? "bg-yellow-500 animate-pulse"
                      : props.syncStatus === "error"
                        ? "bg-red-500"
                        : "bg-zinc-400"
                }`}
              />
            </span>
            <IconBtn icon={LogOut} onClick={props.onLogout} title={t("auth.logout")} label={props.authEmail} />
          </>
        ) : (
          <IconBtn icon={Cloud} onClick={props.onLoginClick} title={t("sync.login")} label={t("sync.login")} />
        )}
      </div>
    </div>
  );
}

// ── Icon button helper ──────────────────────────────────────────

function IconBtn({
  icon: Icon,
  onClick,
  title,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }> | null;
  onClick: () => void;
  title?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      className="inline-flex items-center gap-1 px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
      onClick={onClick}
      title={title}
    >
      {children ?? (
        <>
          {Icon && <Icon className="w-4 h-4" />}
          {label && <span className="text-xs max-w-[80px] truncate">{label}</span>}
        </>
      )}
    </button>
  );
}
