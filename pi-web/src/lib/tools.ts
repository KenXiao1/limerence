import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@mariozechner/pi-ai";
import { MemoryIndex } from "./memory";
import { MemoryDB, type SearchResult as MemoryDBSearchResult } from "./memory-db";
import { LimerenceStorage, normalizePath } from "./storage";
import { t } from "./i18n";

// ── Schemas ─────────────────────────────────────────────────────

const memorySearchSchema = Type.Object({
  query: Type.String({ description: "搜索关键词" }),
  limit: Type.Optional(Type.Integer({ default: 5, minimum: 1, maximum: 20 })),
});

const memoryWriteSchema = Type.Object({
  path: Type.String({ description: "记忆文件路径，如 memory/PROFILE.md, memory/MEMORY.md, memory/2025-01-01.md" }),
  content: Type.String({ description: "要写入的内容" }),
  append: Type.Optional(Type.Boolean({ default: true, description: "是否追加（默认追加）" })),
});

const memoryGetSchema = Type.Object({
  path: Type.String({ description: "记忆文件路径" }),
  from: Type.Optional(Type.Integer({ description: "起始行号（1-based）" })),
  lines: Type.Optional(Type.Integer({ default: 50, description: "读取行数" })),
});

const webSearchSchema = Type.Object({
  query: Type.String({ description: "搜索查询" }),
});

const noteWriteSchema = Type.Object({
  title: Type.String({ description: "笔记标题" }),
  content: Type.String({ description: "笔记内容" }),
  append: Type.Optional(Type.Boolean({ default: false })),
});

const noteReadSchema = Type.Object({
  title: Type.Optional(Type.String({ default: "" })),
});

const fileReadSchema = Type.Object({
  path: Type.String({ description: "文件路径（相对于工作区）" }),
});

const fileWriteSchema = Type.Object({
  path: Type.String({ description: "文件路径（相对于工作区）" }),
  content: Type.String({ description: "文件内容" }),
});

type MemorySearchParams = Static<typeof memorySearchSchema>;
type MemoryWriteParams = Static<typeof memoryWriteSchema>;
type MemoryGetParams = Static<typeof memoryGetSchema>;
type WebSearchParams = Static<typeof webSearchSchema>;
type NoteWriteParams = Static<typeof noteWriteSchema>;
type NoteReadParams = Static<typeof noteReadSchema>;
type FileReadParams = Static<typeof fileReadSchema>;
type FileWriteParams = Static<typeof fileWriteSchema>;

// ── Types ───────────────────────────────────────────────────────

export type FileOperation = {
  action: "read" | "write";
  path: string;
  timestamp: string;
  success: boolean;
  summary: string;
};

export type LimerenceToolHooks = {
  onFileOperation?: (event: FileOperation) => void;
  onMemoryFileWrite?: (path: string, content: string) => Promise<void>;
};

// ── Helpers ─────────────────────────────────────────────────────

const TOOL_OUTPUT_CHAR_LIMIT = 50_000;

function truncateToolOutput(text: string): string {
  if (text.length <= TOOL_OUTPUT_CHAR_LIMIT) return text;
  return text.slice(0, TOOL_OUTPUT_CHAR_LIMIT) + `\n\n[输出已截断，原始长度 ${text.length} 字符，上限 ${TOOL_OUTPUT_CHAR_LIMIT}]`;
}

function summarizeText(text: string, maxLength = 120): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3)}...`;
}

function isMemoryPath(path: string): boolean {
  return LimerenceStorage.isMemoryPath(path);
}

function formatMemoryDBResult(r: MemoryDBSearchResult, index: number): string {
  const pathName = r.path.replace(/^memory\//, "");
  const content = r.text.length > 300 ? `${r.text.slice(0, 300)}...` : r.text;
  return `[${index + 1}] [记忆:${pathName}:L${r.startLine}-L${r.endLine}] ${content}`;
}

// ── Main factory ────────────────────────────────────────────────

export function createLimerenceTools(
  memory: MemoryIndex,
  memoryDB: MemoryDB,
  storage: LimerenceStorage,
  hooks: LimerenceToolHooks = {},
): AgentTool<any>[] {

  // ── memory_search ─────────────────────────────────────────────

  const memorySearchTool: AgentTool<typeof memorySearchSchema, { query: string }> = {
    label: t("tool.memorySearch"),
    name: "memory_search",
    description: "搜索持久记忆文件和历史对话。用于回忆之前的事情。返回带来源标记的结果。",
    parameters: memorySearchSchema,
    async execute(_toolCallId, args: MemorySearchParams) {
      const query = String(args.query ?? "").trim();
      const limit = Number(args.limit ?? 5);

      if (!query) {
        return {
          content: [{ type: "text", text: "请提供搜索关键词。" }],
          details: { query },
        };
      }

      const parts: string[] = [];

      // 1. Search persistent memory files via SQLite FTS5
      if (memoryDB.ready) {
        const dbResults = memoryDB.searchHybrid(query, undefined, limit);
        if (dbResults.length > 0) {
          parts.push("── 持久记忆 ──");
          parts.push(...dbResults.map((r, i) => formatMemoryDBResult(r, i)));
        }
      }

      // 2. Fallback: search conversation history via BM25 in-memory index
      const convResults = memory.search(query, limit);
      if (convResults.length > 0) {
        parts.push("── 对话历史 ──");
        parts.push(
          ...convResults.map((r, i) => {
            const time = r.timestamp.slice(0, 16).replace("T", " ");
            const role = r.role === "user" ? "用户" : r.role === "assistant" ? "助手" : r.role;
            const content = r.content.length > 200 ? `${r.content.slice(0, 200)}...` : r.content;
            return `[${i + 1}] [${time}] ${role}：${content}`;
          }),
        );
      }

      if (parts.length === 0) {
        return {
          content: [{ type: "text", text: "没有找到相关记忆。" }],
          details: { query },
        };
      }

      return {
        content: [{ type: "text", text: parts.join("\n") }],
        details: { query },
      };
    },
  };

  // ── memory_write ──────────────────────────────────────────────

  const memoryWriteTool: AgentTool<typeof memoryWriteSchema, { path: string }> = {
    label: t("tool.memoryWrite"),
    name: "memory_write",
    description: "写入持久记忆文件。路径必须以 memory/ 开头。支持 PROFILE.md（用户档案）、MEMORY.md（长期记忆）、YYYY-MM-DD.md（每日日志）。默认追加模式。",
    parameters: memoryWriteSchema,
    async execute(_toolCallId, args: MemoryWriteParams) {
      const rawPath = String(args.path ?? "").trim();
      const content = String(args.content ?? "");
      const append = args.append !== false; // default true

      if (!rawPath) {
        return {
          content: [{ type: "text", text: "请提供记忆文件路径。" }],
          details: { path: rawPath },
        };
      }

      const path = normalizePath(rawPath);
      if (!isMemoryPath(path)) {
        return {
          content: [{ type: "text", text: "记忆文件路径必须以 memory/ 开头。" }],
          details: { path },
        };
      }

      if (append) {
        const existing = await storage.readWorkspaceFile(path);
        const merged = existing ? `${existing}\n${content}` : content;
        await storage.fileWrite(path, merged);
        await hooks.onMemoryFileWrite?.(path, merged);
        return {
          content: [{ type: "text", text: `已追加内容到记忆文件：${path}` }],
          details: { path },
        };
      }

      await storage.fileWrite(path, content);
      await hooks.onMemoryFileWrite?.(path, content);
      return {
        content: [{ type: "text", text: `已写入记忆文件：${path}` }],
        details: { path },
      };
    },
  };

  // ── memory_get ────────────────────────────────────────────────

  const memoryGetTool: AgentTool<typeof memoryGetSchema, { path: string }> = {
    label: t("tool.memoryGet"),
    name: "memory_get",
    description: "读取记忆文件的指定行范围。搜索后用此工具获取完整内容。路径必须以 memory/ 开头。",
    parameters: memoryGetSchema,
    async execute(_toolCallId, args: MemoryGetParams) {
      const rawPath = String(args.path ?? "").trim();
      const from = Number(args.from ?? 1);
      const lineCount = Number(args.lines ?? 50);

      if (!rawPath) {
        // List memory files
        const files = await storage.listMemoryFiles();
        if (files.length === 0) {
          return {
            content: [{ type: "text", text: "暂无记忆文件。" }],
            details: { path: rawPath },
          };
        }
        return {
          content: [{ type: "text", text: `记忆文件列表：\n${files.join("\n")}` }],
          details: { path: rawPath },
        };
      }

      const path = normalizePath(rawPath);
      if (!isMemoryPath(path)) {
        return {
          content: [{ type: "text", text: "记忆文件路径必须以 memory/ 开头。" }],
          details: { path },
        };
      }

      const content = await storage.readWorkspaceFile(path);
      if (content === null) {
        return {
          content: [{ type: "text", text: `记忆文件不存在：${path}` }],
          details: { path },
        };
      }

      const allLines = content.split("\n");
      const startIdx = Math.max(0, from - 1); // convert 1-based to 0-based
      const endIdx = Math.min(allLines.length, startIdx + lineCount);
      const slice = allLines.slice(startIdx, endIdx);

      const header = `[${path}] 共 ${allLines.length} 行，显示 L${startIdx + 1}-L${endIdx}：`;
      return {
        content: [{ type: "text", text: `${header}\n${slice.join("\n")}` }],
        details: { path },
      };
    },
  };

  // ── web_search ────────────────────────────────────────────────

  const webSearchTool: AgentTool<typeof webSearchSchema, { query: string }> = {
    label: t("tool.webSearch"),
    name: "web_search",
    description: "搜索互联网获取实时信息。用于回答时事、事实性问题等。",
    parameters: webSearchSchema,
    async execute(_toolCallId, args: WebSearchParams) {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return {
          content: [{ type: "text", text: "请提供搜索查询。" }],
          details: { query },
        };
      }

      try {
        const resp = await fetch(`/api/web-search?q=${encodeURIComponent(query)}`);
        if (!resp.ok) {
          return {
            content: [{ type: "text", text: `搜索请求失败：${resp.status}` }],
            details: { query },
          };
        }

        const data = (await resp.json()) as {
          results?: Array<{ title: string; url: string; snippet: string }>;
        };

        if (!data.results?.length) {
          return {
            content: [{ type: "text", text: "没有搜索结果。" }],
            details: { query },
          };
        }

        const text = data.results
          .slice(0, 5)
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
          .join("\n\n");

        return {
          content: [{ type: "text", text }],
          details: { query },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `搜索请求失败：${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { query },
        };
      }
    },
  };

  // ── note_write ────────────────────────────────────────────────

  const noteWriteTool: AgentTool<typeof noteWriteSchema, { title: string }> = {
    label: t("tool.noteWrite"),
    name: "note_write",
    description: "写入持久化笔记。用于记录用户的重要信息、偏好、经历等。",
    parameters: noteWriteSchema,
    async execute(_toolCallId, args: NoteWriteParams) {
      const title = String(args.title ?? "untitled");
      const content = String(args.content ?? "");
      const append = Boolean(args.append);
      const result = await storage.writeNote(title, content, append);
      return {
        content: [{ type: "text", text: result }],
        details: { title },
      };
    },
  };

  // ── note_read ─────────────────────────────────────────────────

  const noteReadTool: AgentTool<typeof noteReadSchema, { title: string }> = {
    label: t("tool.noteRead"),
    name: "note_read",
    description: "读取笔记。传入标题读取指定笔记，留空列出所有笔记。",
    parameters: noteReadSchema,
    async execute(_toolCallId, args: NoteReadParams) {
      const title = String(args.title ?? "");
      const result = await storage.readNote(title);
      return {
        content: [{ type: "text", text: result }],
        details: { title },
      };
    },
  };

  // ── file_read ─────────────────────────────────────────────────

  const fileReadTool: AgentTool<typeof fileReadSchema, { path: string }> = {
    label: t("tool.fileRead"),
    name: "file_read",
    description: "读取工作区文件内容。可以读取文件或列出目录。路径相对于工作区根目录。",
    parameters: fileReadSchema,
    async execute(_toolCallId, args: FileReadParams) {
      const path = String(args.path ?? "");
      const result = await storage.fileRead(path);
      hooks.onFileOperation?.({
        action: "read",
        path: path || ".",
        timestamp: new Date().toISOString(),
        success: !result.startsWith("文件不存在"),
        summary: summarizeText(result),
      });
      return {
        content: [{ type: "text", text: result }],
        details: { path },
      };
    },
  };

  // ── file_write ────────────────────────────────────────────────

  const fileWriteTool: AgentTool<typeof fileWriteSchema, { path: string }> = {
    label: t("tool.fileWrite"),
    name: "file_write",
    description: "在工作区创建或写入文件。路径相对于工作区根目录，自动创建子目录。不可写入 memory/ 目录（请用 memory_write）。",
    parameters: fileWriteSchema,
    async execute(_toolCallId, args: FileWriteParams) {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");

      // Block memory/ paths — must use memory_write instead
      if (isMemoryPath(path)) {
        return {
          content: [{ type: "text", text: "memory/ 目录下的文件请使用 memory_write 工具写入。" }],
          details: { path },
        };
      }

      const result = await storage.fileWrite(path, content);
      hooks.onFileOperation?.({
        action: "write",
        path: path || ".",
        timestamp: new Date().toISOString(),
        success: result.startsWith("已写入文件："),
        summary: `写入 ${content.length} 字符`,
      });
      return {
        content: [{ type: "text", text: result }],
        details: { path },
      };
    },
  };

  // ── Assemble & wrap ───────────────────────────────────────────

  const allTools = [
    memorySearchTool,
    memoryWriteTool,
    memoryGetTool,
    webSearchTool,
    noteWriteTool,
    noteReadTool,
    fileReadTool,
    fileWriteTool,
  ];

  // Wrap all tools with output truncation
  return allTools.map((tool) => ({
    ...tool,
    async execute(toolCallId: string, args: any) {
      const result = await tool.execute(toolCallId, args);
      return {
        ...result,
        content: result.content.map((block: any) =>
          block?.type === "text" ? { ...block, text: truncateToolOutput(block.text) } : block,
        ),
      };
    },
  }));
}
