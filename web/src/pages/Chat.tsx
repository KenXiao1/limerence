import { useState, useEffect } from "react";
import { useSettings } from "../hooks/useSettings";
import { useAgent } from "../hooks/useAgent";
import Sidebar from "../components/Sidebar";
import MessageList from "../components/MessageList";
import InputBar from "../components/InputBar";
import SettingsDialog from "../components/SettingsDialog";

export default function Chat() {
  const {
    settings,
    updateSettings,
    character,
    setCharacter,
    resetCharacter,
    isReady,
  } = useSettings();

  const {
    messages,
    isStreaming,
    streamingText,
    currentSessionId,
    sessions,
    toolStatus,
    sendMessage,
    abort,
    newSession,
    loadSession,
    deleteSession,
  } = useAgent(settings, character);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Prompt for API key on first visit if not set
  useEffect(() => {
    if (isReady && !settings.apiKey && !settings.proxyMode) {
      setSettingsOpen(true);
    }
  }, [isReady, settings.apiKey, settings.proxyMode]);

  const needsApiKey = !settings.apiKey && !settings.proxyMode;

  return (
    <div className="flex h-dvh bg-zinc-950">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-3 top-3 z-40 rounded-lg bg-zinc-900 p-2 text-zinc-400 hover:text-zinc-200 md:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5"
        >
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transform transition-transform md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          characterName={character?.data.name ?? "加载中..."}
          onNewSession={() => {
            newSession();
            setSidebarOpen(false);
          }}
          onSelectSession={(id) => {
            loadSession(id);
            setSidebarOpen(false);
          }}
          onDeleteSession={deleteSession}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          toolStatus={toolStatus}
        />
        <InputBar
          onSend={sendMessage}
          onAbort={abort}
          isStreaming={isStreaming}
          disabled={!isReady || needsApiKey}
        />
      </div>

      {/* Settings dialog */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onUploadCharacter={setCharacter}
        onResetCharacter={resetCharacter}
        characterName={character?.data.name ?? ""}
      />
    </div>
  );
}
