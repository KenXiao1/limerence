import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@mariozechner/pi-ai";
import { MemoryIndex } from "./memory";
import { LimerenceStorage } from "./storage";
import { t } from "./i18n";

const memorySearchSchema = Type.Object({
  query: Type.String({ description: "搜索关键词" }),
  limit: Type.Optional(Type.Integer({ default: 5, minimum: 1, maximum: 20 })),
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
type WebSearchParams = Static<typeof webSearchSchema>;
type NoteWriteParams = Static<typeof noteWriteSchema>;
type NoteReadParams = Static<typeof noteReadSchema>;
type FileReadParams = Static<typeof fileReadSchema>;
type FileWriteParams = Static<typeof fileWriteSchema>;

export type FileOperation = {
  action: "read" | "write";
  path: string;
  timestamp: string;
  success: boolean;
  summary: string;
};

type LimerenceToolHooks = {
  onFileOperation?: (event: FileOperation) => void;
};

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

export function createLimerenceTools(
  memory: MemoryIndex,
  storage: LimerenceStorage,
  hooks: LimerenceToolHooks = {},
): AgentTool<any>[] {
  const memorySearchTool: AgentTool<typeof memorySearchSchema, { query: string }> = {
    label: t("tool.memorySearch"),
    name: "memory_search",
    description: "搜索与用户的历史对话记忆。用于回忆用户之前提到的事情。",
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

      const results = memory.search(query, limit);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: "没有找到相关记忆。" }],
          details: { query },
        };
      }

      const text = results
        .map((r, i) => {
          const time = r.timestamp.slice(0, 16).replace("T", " ");
          const role = r.role === "user" ? "用户" : r.role === "assistant" ? "助手" : r.role;
          const content = r.content.length > 200 ? `${r.content.slice(0, 200)}...` : r.content;
          return `[${i + 1}] [${time}] ${role}：${content}`;
        })
        .join("\n");

      return {
        content: [{ type: "text", text }],
        details: { query },
      };
    },
  };

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

  const fileWriteTool: AgentTool<typeof fileWriteSchema, { path: string }> = {
    label: t("tool.fileWrite"),
    name: "file_write",
    description: "在工作区创建或写入文件。路径相对于工作区根目录，自动创建子目录。",
    parameters: fileWriteSchema,
    async execute(_toolCallId, args: FileWriteParams) {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
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

  const allTools = [
    memorySearchTool,
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
