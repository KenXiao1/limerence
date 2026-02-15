/**
 * Workspace Memory tab — pure view function.
 * Renders memory file tree, file preview, and operation log.
 */

import { icon } from "@mariozechner/mini-lit";
import { FileText, Search, PenLine, BookOpen } from "lucide";
import { html } from "lit";
import { t } from "../lib/i18n";
import type { MemoryOp } from "../app-state";

export interface WorkspaceMemoryState {
  memoryFiles: string[];
  memoryPreviewPath: string;
  memoryPreviewContent: string;
  memoryOps: MemoryOp[];
}

export interface WorkspaceMemoryActions {
  onSelectFile: (path: string) => void;
  onOpenInEditor: (path: string) => void;
}

/** Sort memory files: PROFILE.md and MEMORY.md first, then date logs descending. */
function sortMemoryFiles(files: string[]): string[] {
  const priority = ["memory/PROFILE.md", "memory/MEMORY.md"];
  const top = priority.filter((p) => files.includes(p));
  const rest = files
    .filter((f) => !priority.includes(f))
    .sort((a, b) => b.localeCompare(a)); // reverse chronological
  return [...top, ...rest];
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function getOpIcon(tool: MemoryOp["tool"]) {
  switch (tool) {
    case "memory_search": return Search;
    case "memory_write": return PenLine;
    case "memory_get": return FileText;
  }
}

function getOpIconClass(tool: MemoryOp["tool"]): string {
  switch (tool) {
    case "memory_search": return "is-search";
    case "memory_write": return "is-write";
    case "memory_get": return "is-get";
  }
}

export function renderWorkspaceMemoryTab(
  s: WorkspaceMemoryState,
  actions: WorkspaceMemoryActions,
) {
  const sorted = sortMemoryFiles(s.memoryFiles);

  return html`
    <section class="limerence-workspace-section">
      <div class="limerence-workspace-section-title">${t("ws.memoryFiles")}</div>
      <div class="limerence-memory-file-list">
        ${sorted.length === 0
          ? html`<div class="limerence-workspace-empty">${t("ws.noMemoryFiles")}</div>`
          : sorted.map(
              (path) => html`
                <button
                  class="limerence-memory-file ${path === s.memoryPreviewPath ? "is-active" : ""}"
                  title=${path}
                  @click=${() => actions.onSelectFile(path)}
                >
                  <span class="limerence-memory-file-icon">${icon(BookOpen, "sm")}</span>
                  <span class="limerence-memory-file-name">${path.replace("memory/", "")}</span>
                </button>
              `,
            )}
      </div>
    </section>

    <section class="limerence-workspace-section">
      <div class="limerence-workspace-section-title">
        <span>${t("ws.memoryPreview")}</span>
        ${s.memoryPreviewPath
          ? html`<button
              class="limerence-workspace-icon-button"
              style="width:auto;height:auto;padding:2px 6px;font-size:var(--font-size-xs)"
              @click=${() => actions.onOpenInEditor(s.memoryPreviewPath)}
              title="${t("memory.openInEditor")}"
            >${t("memory.openInEditor")}</button>`
          : null}
      </div>
      ${s.memoryPreviewContent
        ? html`<div class="limerence-memory-preview">${s.memoryPreviewContent}</div>`
        : html`<div class="limerence-workspace-empty">${s.memoryPreviewPath ? "" : t("ws.noMemoryFiles")}</div>`}
    </section>

    <section class="limerence-workspace-section">
      <div class="limerence-workspace-section-title">${t("ws.memoryOps")}</div>
      <div class="limerence-workspace-event-list">
        ${s.memoryOps.length === 0
          ? html`<div class="limerence-workspace-empty">${t("ws.noMemoryOps")}</div>`
          : s.memoryOps.map(
              (op) => html`
                <div class="limerence-memory-op">
                  <span class="limerence-memory-op-icon ${getOpIconClass(op.tool)}">${icon(getOpIcon(op.tool), "sm")}</span>
                  <div class="limerence-memory-op-body">
                    <div class="limerence-memory-op-summary">
                      ${op.path ?? op.query ?? op.tool}
                      <span style="opacity:0.6"> · ${op.summary}</span>
                    </div>
                    <div class="limerence-memory-op-time">${formatTime(op.timestamp)}</div>
                  </div>
                </div>
              `,
            )}
      </div>
    </section>
  `;
}
