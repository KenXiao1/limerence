import type { ToolDef } from "./types";
import { MemoryIndex } from "./memory";
import * as storage from "./storage";

/** All tool definitions, ported from Rust tool.rs */
export function allToolDefs(): ToolDef[] {
  return [
    {
      name: "memory_search",
      description: "搜索与用户的历史对话记忆。用于回忆用户之前提到的事情。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
          limit: {
            type: "integer",
            description: "返回结果数量上限，默认5",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "web_search",
      description: "搜索互联网获取实时信息。用于回答时事、事实性问题等。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索查询" },
        },
        required: ["query"],
      },
    },
    {
      name: "note_write",
      description: "写入持久化笔记。用于记录用户的重要信息、偏好、经历等。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "笔记标题" },
          content: { type: "string", description: "笔记内容" },
          append: {
            type: "boolean",
            description: "是否追加到已有笔记，默认false",
            default: false,
          },
        },
        required: ["title", "content"],
      },
    },
    {
      name: "note_read",
      description: "读取笔记。传入标题读取指定笔记，留空列出所有笔记。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "笔记标题，留空则列出所有笔记",
            default: "",
          },
        },
      },
    },
    {
      name: "file_read",
      description:
        "读取工作区文件内容。可以读取文件或列出目录。路径相对于工作区根目录。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径（相对于工作区）" },
        },
        required: ["path"],
      },
    },
    {
      name: "file_write",
      description:
        "在工作区创建或写入文件。路径相对于工作区根目录，自动创建子目录。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径（相对于工作区）" },
          content: { type: "string", description: "文件内容" },
        },
        required: ["path", "content"],
      },
    },
  ];
}

/** Execute a tool call, ported from Rust tool.rs */
export async function executeTool(
  name: string,
  argsStr: string,
  memory: MemoryIndex,
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    args = {};
  }

  switch (name) {
    case "memory_search": {
      const query = String(args.query ?? "");
      const limit = Number(args.limit ?? 5);
      if (!query) return "请提供搜索关键词。";

      const results = memory.search(query, limit);
      if (results.length === 0) return "没有找到相关记忆。";

      return results
        .map((r, i) => {
          const time = r.timestamp.slice(0, 16).replace("T", " ");
          const role = r.role === "user" ? "用户" : r.role === "assistant" ? "助手" : r.role;
          const content =
            r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content;
          return `[${i + 1}] [${time}] ${role}：${content}`;
        })
        .join("\n");
    }

    case "web_search": {
      const query = String(args.query ?? "");
      if (!query) return "请提供搜索查询。";
      try {
        const resp = await fetch(
          `/api/web-search?q=${encodeURIComponent(query)}`,
        );
        if (!resp.ok) return `搜索请求失败：${resp.status}`;
        const data = await resp.json();
        if (!data.results?.length) return "没有搜索结果。";
        return data.results
          .slice(0, 5)
          .map(
            (r: { title: string; url: string; snippet: string }, i: number) =>
              `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`,
          )
          .join("\n\n");
      } catch (e: any) {
        return `搜索请求失败：${e.message}`;
      }
    }

    case "note_write": {
      const title = String(args.title ?? "untitled");
      const content = String(args.content ?? "");
      const append = Boolean(args.append);
      return storage.writeNote(title, content, append);
    }

    case "note_read": {
      const title = String(args.title ?? "");
      return storage.readNote(title);
    }

    case "file_read": {
      const path = String(args.path ?? "");
      return storage.fileRead(path);
    }

    case "file_write": {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path) return "请提供文件路径。";
      return storage.fileWrite(path, content);
    }

    default:
      return `未知工具：${name}`;
  }
}
