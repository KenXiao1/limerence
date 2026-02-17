/**
 * Chat component — main chat view using assistant-ui primitives.
 */

import { useState, useCallback } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { ToolRenderers } from "./ToolRenderers";
import { Header } from "./Header";
import { SessionListDialog } from "./SessionListDialog";
import { CharacterSelector } from "./CharacterSelector";
import { Workspace } from "./Workspace";
import { Settings } from "./Settings";
import { useSession } from "../hooks/use-session";
import { useSettings } from "../hooks/use-settings";
import { buildExportData, downloadJson, readFileAsJson, validateImportData } from "../controllers/session-io";
import { loadCharacterFromFile } from "../controllers/character";

export function Chat({ onShowIntro }: { onShowIntro: () => void }) {
  const session = useSession();
  const settings = useSettings();

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [charSelectorOpen, setCharSelectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const handleExport = useCallback(() => {
    if (!session.currentSessionId) return;
    const data = buildExportData(
      session.currentSessionId,
      session.currentTitle || "Limerence",
      session.currentCreatedAt,
      null,
      "off",
      session.messages as any,
    );
    downloadJson(data, `limerence-${session.currentSessionId.slice(0, 8)}.json`);
  }, [session]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const raw = await readFileAsJson(file);
      const { session: imported, error } = validateImportData(raw);
      if (error || !imported) {
        console.error("[Import]", error);
        return;
      }
      session.setMessages(imported.messages as any);
      if (imported.title) session.setCurrentTitle(imported.title);
    } catch (err) {
      console.error("[Import] Failed:", err);
    }
  }, [session]);

  const handleCharImport = useCallback(async (file: File) => {
    try {
      const entry = await loadCharacterFromFile(file);
      if (entry) {
        settings.setCharacterList([...settings.characterList, entry]);
      }
    } catch (err) {
      console.error("[CharImport]", err);
    }
  }, [settings]);

  return (
    <div className="w-full h-screen flex bg-background text-foreground overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <ToolRenderers />

        {!focusMode && (
          <Header
            currentTitle={session.currentTitle}
            characterName={settings.character?.data?.name ?? ""}
            isStreaming={false}
            focusMode={focusMode}
            proxyModeEnabled={settings.proxyModeEnabled}
            workspacePanelOpen={workspaceOpen}
            estimatedTokens={0}
            contextWindow={128000}
            activeToolCalls={[]}
            authEmail={null}
            syncStatus="idle"
            onShowIntro={onShowIntro}
            onOpenSessions={() => setSessionsOpen(true)}
            onNewSession={session.newSession}
            onTitleChange={session.setCurrentTitle}
            onToggleProxy={() => settings.setProxyModeEnabled(!settings.proxyModeEnabled)}
            onToggleWorkspace={() => setWorkspaceOpen((v) => !v)}
            onToggleFocus={() => setFocusMode((v) => !v)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenCharacterSelector={() => setCharSelectorOpen(true)}
            onOpenLimerenceSettings={() => setSettingsOpen(true)}
            onExportSession={handleExport}
            onImportSession={handleImport}
            onLoginClick={() => {/* TODO: auth */}}
            onLogout={() => {/* TODO: auth */}}
          />
        )}

        <div className="flex-1 overflow-hidden">
          <ThreadPrimitive.Root>
            <ThreadPrimitive.Viewport>
              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  AssistantMessage,
                }}
              />
              <ThreadPrimitive.ViewportFooter>
                <Composer />
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
        </div>
      </div>

      {/* Workspace side panel */}
      {workspaceOpen && (
        <Workspace open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
      )}

      {/* Dialogs */}
      {sessionsOpen && (
        <SessionListDialog
          onClose={() => setSessionsOpen(false)}
          onLoadSession={async (id) => {
            await session.loadSession(id);
            setSessionsOpen(false);
          }}
          onDeleteSession={session.deleteSession}
          listSessions={session.listSessions}
        />
      )}

      <CharacterSelector
        open={charSelectorOpen}
        characters={settings.characterList}
        defaultCharacterName={settings.character?.data?.name ?? "Default"}
        importError=""
        onSelect={(entry) => {
          if (entry) {
            settings.setCharacter(entry.card);
          }
          // null = use default, already loaded
        }}
        onImport={handleCharImport}
        onDelete={(id) => {
          settings.setCharacterList(settings.characterList.filter((c) => c.id !== id));
        }}
        onExportJson={(entry) => {
          downloadJson(entry.card, `${entry.name}.json`);
        }}
        onClose={() => setCharSelectorOpen(false)}
      />

      {settingsOpen && (
        <Settings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2">
          <MessagePrimitive.Content
            components={{ Text: ({ text }) => <p>{text}</p> }}
          />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function MarkdownText() {
  return <MarkdownTextPrimitive />;
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <div className="flex justify-start px-4 py-2">
        <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2">
          <MessagePrimitive.Content
            components={{ Text: MarkdownText }}
          />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 p-4 border-t border-border">
      <ComposerPrimitive.Input
        placeholder="输入消息..."
        className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <ComposerPrimitive.Send className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
        发送
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
}
