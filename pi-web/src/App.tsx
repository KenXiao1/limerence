import { useState, useEffect, useCallback } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Chat } from "./components/Chat";
import { useLimerenceRuntime } from "./runtime/use-limerence-runtime";
import { StorageProvider, useStorageContext } from "./hooks/use-storage";
import { SettingsProvider } from "./hooks/use-settings";
import { SessionProvider } from "./hooks/use-session";
import { getPreferredTheme, applyTheme } from "./lib/theme";
import { getLocale, onLocaleChange } from "./lib/i18n";
import Landing from "./legacy-intro/pages/Landing";

// ── Types ──────────────────────────────────────────────────────

type ViewMode = "intro" | "chat";

// ── Inner app (needs storage context) ──────────────────────────

function AppInner() {
  const [view, setView] = useState<ViewMode>(() =>
    isChatRoute() ? "chat" : "intro",
  );
  const [, forceUpdate] = useState(0);

  // Theme
  useEffect(() => {
    applyTheme(getPreferredTheme());
  }, []);

  // i18n re-render
  useEffect(() => {
    return onLocaleChange(() => forceUpdate((n) => n + 1));
  }, []);

  // Popstate routing
  useEffect(() => {
    const handler = () => {
      setView(isChatRoute() ? "chat" : "intro");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const showChat = useCallback((pushHistory: boolean) => {
    setView("chat");
    if (pushHistory) {
      window.history.pushState({}, "", "/chat");
    }
  }, []);

  const showIntro = useCallback((pushHistory: boolean) => {
    setView("intro");
    if (pushHistory) {
      window.history.pushState({}, "", "/");
    }
  }, []);

  if (view === "intro") {
    return <IntroView onStartChat={() => showChat(true)} />;
  }

  return (
    <SessionProvider>
      <ChatView onShowIntro={() => showIntro(true)} />
    </SessionProvider>
  );
}

// ── Chat view with runtime ─────────────────────────────────────

function ChatView({ onShowIntro }: { onShowIntro: () => void }) {
  const runtime = useLimerenceRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Chat onShowIntro={onShowIntro} />
    </AssistantRuntimeProvider>
  );
}

// ── Intro view (uses legacy-intro Landing page) ─────────────────

function IntroView({ onStartChat }: { onStartChat: () => void }) {
  return <Landing onStartChat={onStartChat} />;
}

// ── Root app ───────────────────────────────────────────────────

export function App() {
  return (
    <StorageProvider>
      <SettingsProvider>
        <AppInner />
      </SettingsProvider>
    </StorageProvider>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function isChatRoute(): boolean {
  const url = new URL(window.location.href);
  return url.pathname === "/chat" || url.searchParams.has("session");
}
