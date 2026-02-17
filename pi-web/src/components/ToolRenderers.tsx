/**
 * Tool renderers — custom UI for each Limerence tool call.
 * Uses assistant-ui's useAssistantToolUI to register renderers.
 */

import { useAssistantToolUI } from "@assistant-ui/react";
import { Search, PenLine, FileText, Globe, BookOpen, FolderOpen, Brain } from "lucide-react";

// ── Shared components ───────────────────────────────────────────

function ToolCard({
  title,
  icon: Icon,
  isRunning,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isRunning: boolean;
  children?: React.ReactNode;
}) {
  return (
    <details className="my-2 rounded-lg border border-border bg-muted/30 overflow-hidden" open={isRunning}>
      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm font-medium">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span>{title}</span>
        {isRunning && (
          <span className="ml-auto text-xs text-muted-foreground animate-pulse">执行中...</span>
        )}
      </summary>
      {children && (
        <div className="px-3 py-2 text-sm border-t border-border">
          {children}
        </div>
      )}
    </details>
  );
}

// ── Helper ──────────────────────────────────────────────────────

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  if (result == null) return "";
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

// ── Registration component ──────────────────────────────────────

export function ToolRenderers() {
  useAssistantToolUI({
    toolName: "memory_search",
    render: ({ args, result, status }) => (
      <ToolCard title={`记忆搜索: ${(args as any)?.query ?? ""}`} icon={Search} isRunning={status.type === "running"}>
        {result !== undefined && <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{formatResult(result)}</pre>}
      </ToolCard>
    ),
  });

  useAssistantToolUI({
    toolName: "memory_write",
    render: ({ args, result, status }) => (
      <ToolCard title={`写入记忆: ${(args as any)?.path ?? ""}`} icon={Brain} isRunning={status.type === "running"}>
        {result !== undefined && <p className="text-xs text-muted-foreground">{formatResult(result)}</p>}
      </ToolCard>
    ),
  });

  useAssistantToolUI({
    toolName: "memory_get",
    render: ({ args, result, status }) => (
      <ToolCard title={`读取记忆: ${(args as any)?.path ?? ""}`} icon={BookOpen} isRunning={status.type === "running"}>
        {result !== undefined && <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-48 overflow-auto">{formatResult(result)}</pre>}
      </ToolCard>
    ),
  });

  useAssistantToolUI({
    toolName: "web_search",
    render: ({ args, result, status }) => (
      <ToolCard title={`网络搜索: ${(args as any)?.query ?? ""}`} icon={Globe} isRunning={status.type === "running"}>
        {result !== undefined && <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-48 overflow-auto">{formatResult(result)}</pre>}
      </ToolCard>
    ),
  });

  useAssistantToolUI({
    toolName: "note_write",
    render: ({ args, result, status }) => (
      <ToolCard title={`写笔记: ${(args as any)?.title ?? ""}`} icon={PenLine} isRunning={status.type === "running"}>
        {result !== undefined && <p className="text-xs text-muted-foreground">{formatResult(result)}</p>}
      </ToolCard>
    ),
  });

  useAssistantToolUI({
    toolName: "note_read",
    render: ({ args, result, status }) => (
      <ToolCard title={`读笔记: ${(args as any)?.title || "列表"}`} icon={FileText} isRunning={status.type === "running"}>
        {result !== undefined && <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-48 overflow-auto">{formatResult(result)}</pre>}
      </ToolCard>
    ),
  });

  useAssistantToolUI({
    toolName: "file_read",
    render: ({ args, result, status }) => (
      <ToolCard title={`读文件: ${(args as any)?.path ?? ""}`} icon={FolderOpen} isRunning={status.type === "running"}>
        {result !== undefined && <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-48 overflow-auto">{formatResult(result)}</pre>}
      </ToolCard>
    ),
  });

  useAssistantToolUI({
    toolName: "file_write",
    render: ({ args, result, status }) => (
      <ToolCard title={`写文件: ${(args as any)?.path ?? ""}`} icon={PenLine} isRunning={status.type === "running"}>
        {result !== undefined && <p className="text-xs text-muted-foreground">{formatResult(result)}</p>}
      </ToolCard>
    ),
  });

  return null;
}
