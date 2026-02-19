import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { StorageProvider } from "./hooks/use-storage";
import { SettingsProvider } from "./hooks/use-settings";
import { getPreferredTheme, applyTheme } from "./lib/theme";
import { onLocaleChange } from "./lib/i18n";

const Chat = lazy(() =>
  import("./components/Chat").then((module) => ({ default: module.Chat })),
);

const ChatRuntimeProvider = lazy(() =>
  import("./chat/runtime/RuntimeProvider").then((module) => ({
    default: module.ChatRuntimeProvider,
  })),
);

const Landing = lazy(() => import("./legacy-intro/pages/Landing"));

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
    return (
      <Suspense fallback={<RouteLoading />}>
        <IntroView onStartChat={() => showChat(true)} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <ChatView onShowIntro={() => showIntro(true)} />
    </Suspense>
  );
}

// ── Chat view with runtime ─────────────────────────────────────

function ChatView({ onShowIntro }: { onShowIntro: () => void }) {
  return (
    <ChatRuntimeProvider>
      <Chat onShowIntro={onShowIntro} />
    </ChatRuntimeProvider>
  );
}

// ── Intro view (uses legacy-intro Landing page) ─────────────────

function IntroView({ onStartChat }: { onStartChat: () => void }) {
  return <Landing onStartChat={onStartChat} />;
}

function RouteLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center text-muted-foreground text-sm">
      Loading...
    </div>
  );
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
