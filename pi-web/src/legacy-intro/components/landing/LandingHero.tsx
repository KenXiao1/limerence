import type { Theme } from "../../hooks/useTheme";
import ParticleLenia from "../ParticleLenia";

interface LandingHeroProps {
  isDark: boolean;
  theme: Theme;
  onStartChat: () => void;
}

export default function LandingHero({ isDark, theme, onStartChat }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <ParticleLenia theme={theme} />
      </div>

      <div
        className={`absolute inset-0 z-[1] ${
          isDark
            ? "bg-gradient-to-b from-[#09090b]/60 via-transparent to-[#09090b]"
            : "bg-gradient-to-b from-[#faf8f6]/70 via-transparent to-[#faf8f6]"
        }`}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-32 pt-24 sm:pb-40 sm:pt-32">
        <div className="max-w-2xl">
          <p
            className={`mb-4 font-mono text-xs uppercase tracking-[0.3em] ${
              isDark ? "text-magenta/70" : "text-magenta-dark/60"
            }`}
          >
            Open Source AI Companion
          </p>
          <h1
            className="font-serif text-4xl font-bold leading-[1.15] tracking-tight sm:text-6xl"
          >
            有记忆的
            <br />
            <span className={isDark ? "text-magenta" : "text-magenta-dark"}>AI 伙伴</span>
          </h1>
          <p
            className={`mt-6 max-w-lg text-base leading-relaxed sm:text-lg ${
              isDark ? "text-zinc-400" : "text-zinc-600"
            }`}
          >
            Limerence 是一个开源的 AI 对话框架，支持长期记忆、工具调用和自定义角色。
            所有数据存储在你的浏览器中，由数学驱动的生命体守护。
          </p>
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={onStartChat}
              className={`inline-block rounded-xl px-7 py-3.5 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${
                isDark
                  ? "bg-magenta shadow-lg shadow-magenta/20 hover:shadow-magenta/30"
                  : "bg-magenta-dark shadow-lg shadow-magenta-dark/20 hover:shadow-magenta-dark/30"
              }`}
            >
              开始对话
            </button>
            <a
              href="https://github.com/KenXiao1/limerence"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 text-sm transition-colors ${
                isDark
                  ? "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  : "border-zinc-300 text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
