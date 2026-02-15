/**
 * Custom tool renderers for memory_search, memory_write, memory_get.
 * Renders Claude Code-style collapsible cards with color-coded left borders.
 */

import type { ToolResultMessage } from "@mariozechner/pi-ai";
import {
  registerToolRenderer,
  renderCollapsibleHeader,
} from "@mariozechner/pi-web-ui";
import type { ToolRenderer, ToolRenderResult } from "@mariozechner/pi-web-ui";
import { html } from "lit";
import { createRef } from "lit/directives/ref.js";
import { icon } from "@mariozechner/mini-lit";
import { Search, PenLine, FileText } from "lucide";
import { t, tf } from "../lib/i18n";

// ── Helpers ──────────────────────────────────────────────────────

function extractText(result: ToolResultMessage<any> | undefined): string {
  if (!result?.content) return "";
  return result.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");
}

function getState(result: ToolResultMessage<any> | undefined): "inprogress" | "complete" | "error" {
  if (!result) return "inprogress";
  return result.isError ? "error" : "complete";
}

function dispatchMemoryFileClick(path: string) {
  const event = new CustomEvent("memory-file-click", {
    detail: { path },
    bubbles: true,
    composed: true,
  });
  document.dispatchEvent(event);
}

function renderFilePath(path: string) {
  return html`<button
    class="text-xs underline underline-offset-2 decoration-dotted opacity-70 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-none p-0"
    @click=${(e: Event) => { e.stopPropagation(); dispatchMemoryFileClick(path); }}
  >${path}</button>`;
}

// ── MemorySearchRenderer ─────────────────────────────────────────

interface MemorySearchParams { query: string; limit?: number }

class MemorySearchRenderer implements ToolRenderer<MemorySearchParams, { query: string }> {
  render(
    params: MemorySearchParams | undefined,
    result: ToolResultMessage<{ query: string }> | undefined,
  ): ToolRenderResult {
    const state = getState(result);
    const query = params?.query ?? result?.details?.query ?? "";
    const contentRef = createRef<HTMLElement>();
    const chevronRef = createRef<HTMLElement>();

    const headerText = query
      ? html`<span>${tf("memory.searchHeader", query)}</span>`
      : html`<span>${t("tool.memorySearch")}</span>`;

    // Parse result text into sections
    const text = extractText(result);
    const resultCount = text ? text.split("\n").filter((l) => l.startsWith("[")).length : 0;

    const badge = result && !result.isError
      ? html`<span class="ml-2 text-xs px-1.5 py-0.5 rounded-full border border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">${tf("memory.resultCount", resultCount)}</span>`
      : null;

    const header = renderCollapsibleHeader(
      state,
      Search,
      html`${headerText}${badge}`,
      contentRef,
      chevronRef,
      false,
    );

    // Parse sections from result text
    let persistentLines: string[] = [];
    let conversationLines: string[] = [];
    if (text) {
      let currentSection = "";
      for (const line of text.split("\n")) {
        if (line.includes("持久记忆")) { currentSection = "persistent"; continue; }
        if (line.includes("对话历史")) { currentSection = "conversation"; continue; }
        if (line.trim() === "") continue;
        if (currentSection === "persistent") persistentLines.push(line);
        else if (currentSection === "conversation") conversationLines.push(line);
        else persistentLines.push(line); // fallback
      }
    }

    const renderResultLine = (line: string) => {
      // Extract path from [记忆:path:Lx-Ly] pattern
      const pathMatch = line.match(/\[记忆:([^:]+):/);
      const path = pathMatch ? `memory/${pathMatch[1]}` : null;
      return html`<div class="py-1 text-xs leading-relaxed border-b border-border/50 last:border-b-0">
        ${path ? html`<span class="mr-1">${renderFilePath(path)}</span>` : null}
        <span class="text-muted-foreground">${line.replace(/^\[\d+\]\s*/, "").replace(/\[记忆:[^\]]+\]\s*/, "")}</span>
      </div>`;
    };

    const content = html`
      <div class="border-l-2 border-l-blue-500 pl-3 space-y-2">
        ${header}
        <div class="overflow-hidden transition-all duration-200 max-h-0" ${contentRef}>
          ${result?.isError
            ? html`<div class="text-xs text-destructive">${text}</div>`
            : text
              ? html`
                ${persistentLines.length > 0 ? html`
                  <div class="mb-2">
                    <div class="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">${t("memory.persistentSection")}</div>
                    ${persistentLines.map(renderResultLine)}
                  </div>
                ` : null}
                ${conversationLines.length > 0 ? html`
                  <div>
                    <div class="text-xs font-medium text-muted-foreground mb-1">${t("memory.conversationSection")}</div>
                    ${conversationLines.map(renderResultLine)}
                  </div>
                ` : null}
                ${persistentLines.length === 0 && conversationLines.length === 0
                  ? html`<div class="text-xs text-muted-foreground">${t("memory.noResults")}</div>`
                  : null}
              `
              : null
          }
        </div>
      </div>
    `;

    return { content, isCustom: false };
  }
}

// ── MemoryWriteRenderer ──────────────────────────────────────────

interface MemoryWriteParams { path: string; content: string; append?: boolean }

class MemoryWriteRenderer implements ToolRenderer<MemoryWriteParams, { path: string }> {
  render(
    params: MemoryWriteParams | undefined,
    result: ToolResultMessage<{ path: string }> | undefined,
  ): ToolRenderResult {
    const state = getState(result);
    const path = params?.path ?? result?.details?.path ?? "";
    const isAppend = params?.append !== false;
    const writeContent = params?.content ?? "";
    const contentRef = createRef<HTMLElement>();
    const chevronRef = createRef<HTMLElement>();

    const statusText = result && !result.isError
      ? (isAppend ? t("memory.appended") : t("memory.written"))
      : "";

    const headerText = path
      ? html`<span>${tf("memory.writeHeader", path)}</span>`
      : html`<span>${t("tool.memoryWrite")}</span>`;

    const badge = statusText
      ? html`<span class="ml-2 text-xs px-1.5 py-0.5 rounded-full border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">${statusText}</span>`
      : null;

    const header = renderCollapsibleHeader(
      state,
      PenLine,
      html`${headerText}${badge}`,
      contentRef,
      chevronRef,
      false,
    );

    const content = html`
      <div class="border-l-2 border-l-emerald-500 pl-3 space-y-2">
        ${header}
        <div class="overflow-hidden transition-all duration-200 max-h-0" ${contentRef}>
          ${result?.isError
            ? html`<div class="text-xs text-destructive">${extractText(result)}</div>`
            : html`
              ${path ? html`<div class="text-xs">${renderFilePath(path)}</div>` : null}
              ${writeContent ? html`
                <pre class="text-xs leading-relaxed p-2 rounded border border-border bg-muted/30 whitespace-pre-wrap break-words max-h-48 overflow-auto font-mono">${writeContent}</pre>
              ` : null}
            `
          }
        </div>
      </div>
    `;

    return { content, isCustom: false };
  }
}

// ── MemoryGetRenderer ────────────────────────────────────────────

interface MemoryGetParams { path: string; from?: number; lines?: number }

class MemoryGetRenderer implements ToolRenderer<MemoryGetParams, { path: string }> {
  render(
    params: MemoryGetParams | undefined,
    result: ToolResultMessage<{ path: string }> | undefined,
  ): ToolRenderResult {
    const state = getState(result);
    const path = params?.path ?? result?.details?.path ?? "";
    const contentRef = createRef<HTMLElement>();
    const chevronRef = createRef<HTMLElement>();

    const headerText = path
      ? html`<span>${tf("memory.getHeader", path)}</span>`
      : html`<span>${t("tool.memoryGet")}</span>`;

    const text = extractText(result);
    // Extract line count from header like "[path] 共 N 行，显示 Lx-Ly："
    const lineMatch = text.match(/共 (\d+) 行/);
    const badge = lineMatch
      ? html`<span class="ml-2 text-xs px-1.5 py-0.5 rounded-full border border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/10">${tf("memory.lines", lineMatch[1])}</span>`
      : null;

    const header = renderCollapsibleHeader(
      state,
      FileText,
      html`${headerText}${badge}`,
      contentRef,
      chevronRef,
      false,
    );

    // Strip the header line from content for display
    const lines = text.split("\n");
    const bodyText = lines.length > 1 ? lines.slice(1).join("\n") : text;

    const content = html`
      <div class="border-l-2 border-l-violet-500 pl-3 space-y-2">
        ${header}
        <div class="overflow-hidden transition-all duration-200 max-h-0" ${contentRef}>
          ${result?.isError
            ? html`<div class="text-xs text-destructive">${text}</div>`
            : html`
              ${path ? html`<div class="text-xs">${renderFilePath(path)}</div>` : null}
              ${bodyText ? html`
                <pre class="text-xs leading-relaxed p-2 rounded border border-border bg-muted/30 whitespace-pre-wrap break-words max-h-64 overflow-auto font-mono">${bodyText}</pre>
              ` : null}
            `
          }
        </div>
      </div>
    `;

    return { content, isCustom: false };
  }
}

// ── Registration ─────────────────────────────────────────────────

export function registerMemoryRenderers(): void {
  registerToolRenderer("memory_search", new MemorySearchRenderer());
  registerToolRenderer("memory_write", new MemoryWriteRenderer());
  registerToolRenderer("memory_get", new MemoryGetRenderer());
}
