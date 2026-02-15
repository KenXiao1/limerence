import { useI18n } from "../../hooks/useI18n";

interface LandingNavProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onStartChat: () => void;
  startingChat?: boolean;
  onLogin?: () => void;
  authEmail?: string | null;
  onLogout?: () => void;
}

export default function LandingNav({
  isDark,
  onToggleTheme,
  onStartChat,
  startingChat = false,
  onLogin,
  authEmail,
  onLogout,
}: LandingNavProps) {
  const { t, toggle } = useI18n();

  return (
    <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <span
        className="font-serif text-xl tracking-wide"
      >
        <span className={isDark ? "text-magenta-light" : "text-magenta-dark"}>Limerence</span>
      </span>

      <div className="flex items-center gap-3">
        <a
          href="https://github.com/KenXiao1/limerence"
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-full p-2 transition-colors ${
            isDark
              ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
          }`}
          aria-label="GitHub"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>

        <button
          onClick={toggle}
          className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
            isDark
              ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
          }`}
          aria-label={t("lang.tooltip")}
        >
          {t("lang.switch")}
        </button>

        <button
          onClick={onToggleTheme}
          className={`rounded-full p-2 transition-colors ${
            isDark
              ? "text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
              : "text-zinc-500 hover:bg-zinc-200 hover:text-indigo-600"
          }`}
          aria-label={isDark ? t("landing.themeLight") : t("landing.themeDark")}
        >
          {isDark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {authEmail ? (
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${isDark ? "bg-zinc-800/60" : "bg-zinc-100"}`}>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 4px rgba(16,185,129,0.4)" }} />
              <span className={`text-xs truncate max-w-[120px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                {authEmail}
              </span>
            </div>
            <button
              onClick={onLogout}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                isDark
                  ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
              }`}
            >
              {t("auth.logout")}
            </button>
          </div>
        ) : onLogin ? (
          <button
            onClick={onLogin}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all ${
              isDark
                ? "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100"
            }`}
          >
            {t("auth.login")}
          </button>
        ) : null}

        <button
          onClick={onStartChat}
          disabled={startingChat}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            startingChat ? "cursor-not-allowed opacity-70" : ""
          } ${
            isDark
              ? "bg-magenta/15 text-magenta-light hover:bg-magenta/25"
              : "bg-magenta-dark/10 text-magenta-dark hover:bg-magenta-dark/20"
          }`}
        >
          {t("landing.startChatNav")}
        </button>
      </div>
    </nav>
  );
}
