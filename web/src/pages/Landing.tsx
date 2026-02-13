import { Link } from "react-router-dom";

const features = [
  {
    title: "对话记忆",
    desc: "BM25 搜索引擎，跨会话记住你说过的每一句话",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    title: "工具调用",
    desc: "搜索互联网、读写笔记和文件，不只是聊天",
    icon: "M11.42 15.17l-5.1-5.1a1 1 0 0 1 0-1.42l.71-.71a1 1 0 0 1 1.41 0L12 11.5l5.17-5.17a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1 0 1.42l-5.1 5.1M3.34 19a10 10 0 1 1 17.32 0",
  },
  {
    title: "角色卡",
    desc: "SillyTavern V2 兼容，自定义你的 AI 伙伴",
    icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z",
  },
  {
    title: "隐私优先",
    desc: "数据存储在浏览器本地，API Key 不经过服务器",
    icon: "M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z",
  },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-zinc-950">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-medium text-magenta">Limerence</span>
        <Link
          to="/chat"
          className="rounded-lg bg-magenta/15 px-4 py-2 text-sm text-magenta hover:bg-magenta/25"
        >
          开始聊天
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
          有记忆的 AI 伙伴
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-500">
          Limerence 是一个开源的 AI 对话框架，支持长期记忆、工具调用和自定义角色。
          所有数据存储在你的浏览器中。
        </p>
        <div className="mt-8">
          <Link
            to="/chat"
            className="inline-block rounded-lg bg-magenta px-6 py-3 text-sm font-medium text-white hover:bg-magenta-light"
          >
            开始对话
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-magenta/10">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5 text-magenta"
                >
                  <path d={f.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-zinc-200">{f.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-6 text-center text-xl font-medium text-zinc-200">
          架构
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <pre className="overflow-x-auto text-xs leading-relaxed text-zinc-500">
{`浏览器（React）                    Netlify Edge Functions
┌─────────────────────┐           ┌──────────────────┐
│  Agent Loop (TS)    │           │  chat-proxy.ts   │
│  ├─ LLM 流式客户端  │──stream──→│  (转发 LLM API)  │
│  ├─ BM25 记忆搜索   │           │                  │
│  ├─ 笔记系统        │           │  web-search.ts   │
│  ├─ 会话管理        │──fetch───→│  (搜索代理)      │
│  └─ IndexedDB 持久化│           └──────────────────┘
└─────────────────────┘`}
          </pre>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 text-center text-xs text-zinc-600">
        Limerence — MIT License
      </footer>
    </div>
  );
}
