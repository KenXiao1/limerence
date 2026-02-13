import { Link } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import ParticleLenia from "../components/ParticleLenia";
import FourierHeart from "../components/FourierHeart";

const features = [
  {
    title: "对话记忆",
    desc: "BM25 搜索引擎，跨会话记住你说过的每一句话",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    heartVariant: 0,
  },
  {
    title: "工具调用",
    desc: "搜索互联网、读写笔记和文件，不只是聊天",
    icon: "M11.42 15.17l-5.1-5.1a1 1 0 0 1 0-1.42l.71-.71a1 1 0 0 1 1.41 0L12 11.5l5.17-5.17a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1 0 1.42l-5.1 5.1M3.34 19a10 10 0 1 1 17.32 0",
    heartVariant: 1,
  },
  {
    title: "角色卡",
    desc: "SillyTavern V2 兼容，自定义你的 AI 伙伴",
    icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z",
    heartVariant: 2,
  },
  {
    title: "隐私优先",
    desc: "数据存储在浏览器本地，API Key 不经过服务器",
    icon: "M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z",
    heartVariant: 3,
  },
];


export default function Landing() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`min-h-dvh transition-colors duration-500 ${
        isDark ? "bg-[#09090b] text-zinc-100" : "bg-[#faf8f6] text-zinc-900"
      }`}
    >
      {/* ── Nav ── */}
      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span
          className="font-serif text-xl tracking-wide"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          <span className={isDark ? "text-magenta-light" : "text-magenta-dark"}>
            Limerence
          </span>
        </span>

        <div className="flex items-center gap-3">
          {/* GitHub */}
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

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className={`rounded-full p-2 transition-colors ${
              isDark
                ? "text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
                : "text-zinc-500 hover:bg-zinc-200 hover:text-indigo-600"
            }`}
            aria-label={isDark ? "切换到亮色模式" : "切换到暗色模式"}
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

          {/* CTA */}
          <Link
            to="/chat"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isDark
                ? "bg-magenta/15 text-magenta-light hover:bg-magenta/25"
                : "bg-magenta-dark/10 text-magenta-dark hover:bg-magenta-dark/20"
            }`}
          >
            开始聊天
          </Link>
        </div>
      </nav>

      {/* ── Hero with Particle Lenia background ── */}
      <section className="relative overflow-hidden">
        {/* Lenia canvas */}
        <div className="absolute inset-0 z-0">
          <ParticleLenia theme={theme} />
        </div>

        {/* Gradient overlay for readability */}
        <div
          className={`absolute inset-0 z-[1] ${
            isDark
              ? "bg-gradient-to-b from-[#09090b]/60 via-transparent to-[#09090b]"
              : "bg-gradient-to-b from-[#faf8f6]/70 via-transparent to-[#faf8f6]"
          }`}
        />

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-32 pt-24 sm:pt-32 sm:pb-40">
          <div className="max-w-2xl">
            <p
              className={`mb-4 font-mono text-xs uppercase tracking-[0.3em] ${
                isDark ? "text-magenta/70" : "text-magenta-dark/60"
              }`}
            >
              Open Source AI Companion
            </p>
            <h1
              className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-6xl"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              有记忆的
              <br />
              <span className={isDark ? "text-magenta" : "text-magenta-dark"}>
                AI 伙伴
              </span>
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
              <Link
                to="/chat"
                className={`inline-block rounded-xl px-7 py-3.5 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  isDark
                    ? "bg-magenta shadow-lg shadow-magenta/20 hover:shadow-magenta/30"
                    : "bg-magenta-dark shadow-lg shadow-magenta-dark/20 hover:shadow-magenta-dark/30"
                }`}
              >
                开始对话
              </Link>
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

      {/* ── Features with Fourier Hearts ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 text-center">
          <h2
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            核心能力
          </h2>
          <p className={`mt-2 text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            数学驱动的生命体，守护你的每一段记忆
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition-all hover:scale-[1.01] ${
                isDark
                  ? "border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm hover:border-zinc-700"
                  : "border-zinc-200 bg-white/60 backdrop-blur-sm hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/50"
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Fourier heart in corner */}
              <div className="absolute -right-4 -top-4 opacity-30 transition-opacity group-hover:opacity-60">
                <FourierHeart theme={theme} variant={f.heartVariant} size={140} />
              </div>

              <div className="relative z-10">
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
                    isDark ? "bg-magenta/10" : "bg-magenta-dark/8"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={`h-5 w-5 ${isDark ? "text-magenta" : "text-magenta-dark"}`}
                  >
                    <path d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold tracking-wide">{f.title}</h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 text-center">
          <h2
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            架构
          </h2>
          <p className={`mt-2 text-sm ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            浏览器端完整运行，Edge Functions 按需代理
          </p>
        </div>

        <div
          className={`relative overflow-hidden rounded-2xl border p-6 sm:p-10 ${
            isDark
              ? "border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm"
              : "border-zinc-200 bg-white/60 backdrop-blur-sm"
          }`}
        >
          {/* Decorative grid dots */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle, ${isDark ? "#fff" : "#000"} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:gap-6">
            {/* ── Browser column ── */}
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  isDark ? "bg-magenta/15" : "bg-magenta-dark/10"
                }`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${isDark ? "text-magenta" : "text-magenta-dark"}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25" />
                  </svg>
                </div>
                <div>
                  <span className={`text-xs font-semibold tracking-wide ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    浏览器
                  </span>
                  <span className={`ml-2 font-mono text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    React + TypeScript
                  </span>
                </div>
              </div>

              {/* Agent core node */}
              <div className={`rounded-xl border p-4 ${
                isDark
                  ? "border-magenta/20 bg-magenta/[0.04]"
                  : "border-magenta-dark/15 bg-magenta-dark/[0.03]"
              }`}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-magenta" : "bg-magenta-dark"}`}
                    style={{ boxShadow: isDark ? "0 0 6px #e040a0" : "0 0 6px #a02070" }}
                  />
                  <span className={`font-mono text-[11px] font-medium ${isDark ? "text-magenta-light" : "text-magenta-dark"}`}>
                    Agent Loop
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "LLM 流式客户端", sub: "SSE stream" },
                    { label: "BM25 记忆搜索", sub: "CJK tokenizer" },
                    { label: "笔记 & 文件系统", sub: "IndexedDB" },
                    { label: "会话管理", sub: "JSONL 持久化" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={`rounded-lg px-3 py-2 ${
                        isDark ? "bg-zinc-800/60" : "bg-zinc-100/80"
                      }`}
                    >
                      <div className={`text-[11px] font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                        {m.label}
                      </div>
                      <div className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                        {m.sub}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ── Connection arrows (center) ── */}
            <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-4 lg:px-2">
              {/* stream arrow */}
              <div className="flex flex-col items-center gap-1">
                <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>stream</span>
                <div className="relative flex items-center">
                  <div className={`h-px w-16 ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
                  {/* Animated pulse dot */}
                  <div
                    className={`absolute h-1.5 w-1.5 rounded-full ${isDark ? "bg-magenta" : "bg-magenta-dark"}`}
                    style={{
                      animation: "archPulse 2s ease-in-out infinite",
                      left: 0,
                    }}
                  />
                  <svg viewBox="0 0 8 8" className={`h-2 w-2 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                    <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
              {/* fetch arrow */}
              <div className="flex flex-col items-center gap-1">
                <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>fetch</span>
                <div className="relative flex items-center">
                  <div className={`h-px w-16 ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
                  <div
                    className={`absolute h-1.5 w-1.5 rounded-full ${isDark ? "bg-cyan" : "bg-cyan-dark"}`}
                    style={{
                      animation: "archPulse 2s ease-in-out infinite 0.8s",
                      left: 0,
                    }}
                  />
                  <svg viewBox="0 0 8 8" className={`h-2 w-2 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                    <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Mobile arrows */}
            <div className="flex items-center justify-center gap-2 lg:hidden">
              <div className={`h-8 w-px ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
              <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                stream / fetch
              </span>
              <div className={`h-8 w-px ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
            </div>

            {/* ── Edge Functions column ── */}
            <div className="lg:w-64">
              <div className="mb-4 flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  isDark ? "bg-cyan/15" : "bg-cyan-dark/10"
                }`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${isDark ? "text-cyan" : "text-cyan-dark"}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                  </svg>
                </div>
                <div>
                  <span className={`text-xs font-semibold tracking-wide ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    Edge Functions
                  </span>
                  <span className={`ml-2 font-mono text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    Netlify · Deno
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className={`rounded-xl border px-4 py-3 ${
                  isDark ? "border-cyan/15 bg-cyan/[0.03]" : "border-cyan-dark/12 bg-cyan-dark/[0.03]"
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-cyan" : "bg-cyan-dark"}`}
                      style={{ boxShadow: isDark ? "0 0 6px #22d3ee" : "0 0 6px #0891b2" }}
                    />
                    <span className={`font-mono text-[11px] font-medium ${isDark ? "text-cyan-light" : "text-cyan-dark"}`}>
                      chat-proxy.ts
                    </span>
                  </div>
                  <p className={`mt-1 text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    转发 LLM API，服务端注入密钥
                  </p>
                </div>

                <div className={`rounded-xl border px-4 py-3 ${
                  isDark ? "border-cyan/15 bg-cyan/[0.03]" : "border-cyan-dark/12 bg-cyan-dark/[0.03]"
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-cyan" : "bg-cyan-dark"}`}
                      style={{ boxShadow: isDark ? "0 0 6px #22d3ee" : "0 0 6px #0891b2" }}
                    />
                    <span className={`font-mono text-[11px] font-medium ${isDark ? "text-cyan-light" : "text-cyan-dark"}`}>
                      web-search.ts
                    </span>
                  </div>
                  <p className={`mt-1 text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    搜索代理，绕过浏览器 CORS
                  </p>
                </div>

                {/* Data store indicator */}
                <div className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 ${
                  isDark ? "bg-zinc-800/40" : "bg-zinc-100/60"
                }`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className={`font-mono text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    数据不经过服务器 — 仅代理 API 请求
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Keyframes for architecture pulse animation */}
      <style>{`
        @keyframes archPulse {
          0%, 100% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(60px); opacity: 0; }
        }
      `}</style>

      {/* ── Footer ── */}
      <footer
        className={`relative z-10 border-t py-8 text-center text-xs ${
          isDark ? "border-zinc-800 text-zinc-600" : "border-zinc-200 text-zinc-400"
        }`}
      >
        <div className="flex items-center justify-center gap-3">
          <span>Limerence</span>
          <span className={isDark ? "text-zinc-800" : "text-zinc-300"}>·</span>
          <a
            href="https://github.com/KenXiao1/limerence"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-magenta"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
