export interface LandingFeature {
  title: string;
  desc: string;
  icon: string;
  heartVariant: number;
}

export const LANDING_FEATURES: LandingFeature[] = [
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

export interface RustCrateCard {
  name: string;
  title: string;
  sub: string;
}

export const RUST_CRATES: RustCrateCard[] = [
  { name: "limerence-ai", title: "LLM 抽象层", sub: "OpenAI 协议 · SSE 流式" },
  { name: "limerence-core", title: "Agent 运行时", sub: "BM25 · 工具 · 会话 · 记忆" },
  { name: "limerence-tui", title: "终端界面", sub: "ratatui · 文件系统持久化" },
];

export interface AgentModuleCard {
  label: string;
  sub: string;
}

export const AGENT_MODULES: AgentModuleCard[] = [
  { label: "LLM 流式客户端", sub: "SSE stream" },
  { label: "BM25 记忆搜索", sub: "CJK tokenizer" },
  { label: "笔记 & 文件系统", sub: "IndexedDB" },
  { label: "会话管理", sub: "JSONL 持久化" },
];
