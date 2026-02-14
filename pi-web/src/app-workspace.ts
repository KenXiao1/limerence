import { icon } from "@mariozechner/mini-lit";
import { FileText, RefreshCw, Save, X } from "lucide";
import { html } from "lit";
import {
  state,
  limerenceStorage,
  MAX_WORKSPACE_EVENTS,
  MAX_DIFF_MATRIX,
  MAX_DIFF_PREVIEW_LINES,
  type WorkspaceEvent,
  type DiffLine,
  type DiffPreview,
} from "./app-state";
import { normalizePath } from "./lib/storage";
import type { FileOperation } from "./lib/tools";

// ── Constants ─────────────────────────────────────────────────────

const WS_MIN_WIDTH = 280;
const WS_MAX_WIDTH = 700;
const WS_WIDTH_KEY = "limerence-ws-width";

// ── Utilities ──────────────────────────────────────────────────────

export function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function summarizeWorkspaceText(text: string, maxLength = 90): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "空内容";
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3)}...`;
}

function formatWorkspaceTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return timestamp;
  }
}

// ── Diff ───────────────────────────────────────────────────────────

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function computeSimpleLineDiff(baseLines: string[], nextLines: string[]): DiffLine[] {
  const lines: DiffLine[] = [];
  const maxLen = Math.max(baseLines.length, nextLines.length);
  for (let i = 0; i < maxLen; i += 1) {
    const oldLine = baseLines[i];
    const newLine = nextLines[i];
    if (oldLine === newLine) continue;
    if (oldLine !== undefined) {
      lines.push({ type: "removed", text: oldLine });
    }
    if (newLine !== undefined) {
      lines.push({ type: "added", text: newLine });
    }
  }
  return lines;
}

function computeLcsDiff(baseLines: string[], nextLines: string[]): DiffLine[] {
  const n = baseLines.length;
  const m = nextLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        baseLines[i] === nextLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (baseLines[i] === nextLines[j]) {
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: "removed", text: baseLines[i] });
      i += 1;
    } else {
      lines.push({ type: "added", text: nextLines[j] });
      j += 1;
    }
  }

  while (i < n) {
    lines.push({ type: "removed", text: baseLines[i] });
    i += 1;
  }

  while (j < m) {
    lines.push({ type: "added", text: nextLines[j] });
    j += 1;
  }

  return lines;
}

export function createDiffPreview(baseText: string, nextText: string): DiffPreview {
  if (baseText === nextText) {
    return { lines: [], added: 0, removed: 0, truncated: false };
  }

  const baseLines = splitLines(baseText);
  const nextLines = splitLines(nextText);

  const rawLines =
    baseLines.length * nextLines.length > MAX_DIFF_MATRIX
      ? computeSimpleLineDiff(baseLines, nextLines)
      : computeLcsDiff(baseLines, nextLines);

  const added = rawLines.filter((line) => line.type === "added").length;
  const removed = rawLines.length - added;
  const truncated = rawLines.length > MAX_DIFF_PREVIEW_LINES;

  return {
    lines: rawLines.slice(0, MAX_DIFF_PREVIEW_LINES),
    added,
    removed,
    truncated,
  };
}

// ── Workspace event tracking ───────────────────────────────────────

export function pushWorkspaceEvent(event: Omit<WorkspaceEvent, "id">) {
  state.workspaceEvents = [{ id: crypto.randomUUID(), ...event }, ...state.workspaceEvents].slice(
    0,
    MAX_WORKSPACE_EVENTS,
  );
}

// ── File operations ────────────────────────────────────────────────

export async function refreshWorkspaceFiles(autoSelect = false) {
  state.workspaceFiles = await limerenceStorage.listWorkspaceFiles();
  if (state.workspaceSelectedPath && !state.workspaceFiles.includes(state.workspaceSelectedPath)) {
    state.workspaceSelectedPath = "";
    state.workspaceEditorContent = "";
    state.workspaceBaseContent = "";
    state.workspaceEditorDirty = false;
  }

  if (autoSelect && !state.workspaceSelectedPath) {
    const fallback = state.workspaceFiles.find((f) => isMarkdownPath(f)) ?? state.workspaceFiles[0];
    if (fallback) {
      await openWorkspaceFile(fallback, false);
    }
  }
}

export async function openWorkspaceFile(path: string, addUserReadEvent = true) {
  const normalized = normalizePath(path.trim());
  if (!normalized) {
    state.workspaceMessage = "文件路径无效。";
    return;
  }

  if (state.workspaceEditorDirty && state.workspaceSelectedPath && state.workspaceSelectedPath !== normalized) {
    const confirmed = window.confirm("当前文件有未保存改动，确认切换并丢弃改动吗？");
    if (!confirmed) return;
  }

  state.workspaceSelectedPath = normalized;
  state.workspaceDraftPath = normalized;
  state.workspaceLoadingFile = true;
  state.workspaceMessage = "";

  const content = await limerenceStorage.readWorkspaceFile(normalized);
  state.workspaceEditorContent = content ?? "";
  state.workspaceBaseContent = content ?? "";
  state.workspaceEditorDirty = false;
  state.workspaceLoadingFile = false;

  if (addUserReadEvent) {
    pushWorkspaceEvent({
      source: "user",
      action: "read",
      path: normalized,
      timestamp: new Date().toISOString(),
      success: content !== null,
      summary: content === null ? "文件不存在" : summarizeWorkspaceText(content),
    });
  }
}

export async function saveWorkspaceFile(pathInput?: string) {
  const basePath = pathInput ?? state.workspaceDraftPath ?? state.workspaceSelectedPath;
  let normalized = normalizePath((basePath ?? "").trim());
  if (!normalized) {
    state.workspaceMessage = "请输入有效文件路径。";
    return;
  }

  if (!isMarkdownPath(normalized)) {
    normalized = `${normalized}.md`;
  }

  const writeResult = await limerenceStorage.fileWrite(normalized, state.workspaceEditorContent);
  state.workspaceSelectedPath = normalized;
  state.workspaceDraftPath = normalized;
  state.workspaceBaseContent = state.workspaceEditorContent;
  state.workspaceEditorDirty = false;
  state.workspaceMessage = writeResult;

  pushWorkspaceEvent({
    source: "user",
    action: "write",
    path: normalized,
    timestamp: new Date().toISOString(),
    success: true,
    summary: summarizeWorkspaceText(state.workspaceEditorContent),
  });

  await refreshWorkspaceFiles(false);
}

export async function toggleWorkspacePanel() {
  state.workspacePanelOpen = !state.workspacePanelOpen;
  if (state.workspacePanelOpen) {
    await refreshWorkspaceFiles(true);
  }
}

export function handleAgentFileOperation(event: FileOperation) {
  const normalizedPath = normalizePath(event.path);
  pushWorkspaceEvent({
    ...event,
    path: normalizedPath || event.path,
    source: "agent",
  });

  if (
    event.action === "write" &&
    normalizedPath &&
    normalizedPath === state.workspaceSelectedPath &&
    !state.workspaceEditorDirty
  ) {
    void limerenceStorage.readWorkspaceFile(normalizedPath).then((content) => {
      if (content !== null) {
        state.workspaceEditorContent = content;
        state.workspaceBaseContent = content;
      }
    });
  }

  void refreshWorkspaceFiles(false);
}

// ── Resize handle ─────────────────────────────────────────────────

export function startWorkspaceResize(e: MouseEvent) {
  e.preventDefault();
  state.workspaceResizing = true;
  const startX = e.clientX;
  const startWidth = state.workspacePanelWidth;

  const onMove = (ev: MouseEvent) => {
    const delta = startX - ev.clientX;
    const next = Math.min(WS_MAX_WIDTH, Math.max(WS_MIN_WIDTH, startWidth + delta));
    state.workspacePanelWidth = next;
  };

  const onUp = () => {
    state.workspaceResizing = false;
    localStorage.setItem(WS_WIDTH_KEY, String(state.workspacePanelWidth));
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

// ── Workspace panel rendering ──────────────────────────────────────

export function renderWorkspacePanel() {
  const markdownFiles = state.workspaceFiles.filter((path) => isMarkdownPath(path));
  const diff = createDiffPreview(state.workspaceBaseContent, state.workspaceEditorContent);
  const panelWidth = state.workspacePanelWidth;

  return html`
    <div
      class="limerence-resize-handle ${state.workspaceResizing ? "is-dragging" : ""}"
      @mousedown=${(e: Event) => startWorkspaceResize(e as MouseEvent)}
    ></div>
    <aside class="limerence-workspace-panel border-l border-border bg-background" style="width:${panelWidth}px;min-width:${WS_MIN_WIDTH}px;max-width:${WS_MAX_WIDTH}px">
      <div class="limerence-workspace-head">
        <div>
          <div class="limerence-workspace-title">Markdown 工作区</div>
          <div class="limerence-workspace-subtitle">
            ${markdownFiles.length} 个 .md 文件 · ${state.workspaceEvents.length} 条读写记录
          </div>
        </div>
        <div class="limerence-workspace-head-actions">
          <button
            class="limerence-workspace-icon-button"
            @click=${() => {
              void refreshWorkspaceFiles(true);
            }}
            title="刷新文件列表"
          >
            ${icon(RefreshCw, "sm")}
          </button>
          <button
            class="limerence-workspace-icon-button"
            @click=${() => {
              state.workspacePanelOpen = false;
            }}
            title="关闭面板"
          >
            ${icon(X, "sm")}
          </button>
        </div>
      </div>

      <div class="limerence-workspace-content">
        <section class="limerence-workspace-section">
          <div class="limerence-workspace-section-title">路径</div>
          <div class="limerence-workspace-row">
            <input
              class="limerence-workspace-input"
              type="text"
              .value=${state.workspaceDraftPath}
              placeholder="notes/today.md"
              @input=${(e: Event) => {
                state.workspaceDraftPath = (e.target as HTMLInputElement).value;
              }}
            />
            <button
              class="limerence-workspace-action"
              @click=${() => {
                void saveWorkspaceFile(state.workspaceDraftPath);
              }}
              title="保存到该路径"
            >
              ${icon(Save, "sm")}<span>保存</span>
            </button>
          </div>
          ${state.workspaceMessage
            ? html`<div class="limerence-workspace-message">${state.workspaceMessage}</div>`
            : html`<div class="limerence-workspace-message limerence-workspace-message-muted">
                Agent 的 file_read / file_write 会在下方自动记录。
              </div>`}
        </section>

        <section class="limerence-workspace-section">
          <div class="limerence-workspace-section-title">Markdown 文件</div>
          <div class="limerence-workspace-file-list">
            ${markdownFiles.length === 0
              ? html`<div class="limerence-workspace-empty">当前没有 .md 文件，输入路径后点击保存即可创建。</div>`
              : markdownFiles.map(
                  (path) => html`
                    <button
                      class="limerence-workspace-file ${path === state.workspaceSelectedPath ? "is-active" : ""}"
                      title=${path}
                      @click=${() => {
                        void openWorkspaceFile(path);
                      }}
                    >
                      <span class="limerence-workspace-file-icon">${icon(FileText, "sm")}</span>
                      <span class="limerence-workspace-file-path">${path}</span>
                    </button>
                  `,
                )}
          </div>
        </section>

        <section class="limerence-workspace-section limerence-workspace-editor-section">
          <div class="limerence-workspace-section-title">
            <span>${state.workspaceSelectedPath || "未选择文件"}</span>
            <span class="limerence-workspace-dirty ${state.workspaceEditorDirty ? "is-dirty" : ""}">
              ${state.workspaceEditorDirty ? "未保存" : "已保存"}
            </span>
          </div>
          ${state.workspaceLoadingFile
            ? html`<div class="limerence-workspace-empty">正在加载文件...</div>`
            : html`
                <textarea
                  class="limerence-workspace-editor"
                  .value=${state.workspaceEditorContent}
                  placeholder="在这里编辑 Markdown 内容..."
                  @input=${(e: Event) => {
                    state.workspaceEditorContent = (e.target as HTMLTextAreaElement).value;
                    state.workspaceEditorDirty = true;
                    state.workspaceMessage = "";
                  }}
                ></textarea>
              `}
        </section>

        <section class="limerence-workspace-section limerence-workspace-diff-section">
          <div class="limerence-workspace-section-title">
            <span>变更预览</span>
            <span class="limerence-workspace-diff-stats">
              <span class="limerence-workspace-diff-badge is-added">+${diff.added}</span>
              <span class="limerence-workspace-diff-badge is-removed">-${diff.removed}</span>
            </span>
          </div>
          <div class="limerence-workspace-diff-list">
            ${!state.workspaceSelectedPath
              ? html`<div class="limerence-workspace-empty">先选择或创建一个 Markdown 文件。</div>`
              : diff.lines.length === 0
                ? html`<div class="limerence-workspace-empty">当前内容与已保存版本一致。</div>`
                : diff.lines.map(
                    (line) => html`
                      <div class="limerence-workspace-diff-line ${line.type === "added" ? "is-added" : "is-removed"}">
                        <span class="limerence-workspace-diff-sign">${line.type === "added" ? "+" : "-"}</span>
                        <span class="limerence-workspace-diff-text">${line.text || " "}</span>
                      </div>
                    `,
                  )}
            ${diff.truncated
              ? html`<div class="limerence-workspace-diff-truncated">
                  仅展示前 ${MAX_DIFF_PREVIEW_LINES} 行变更。
                </div>`
              : null}
          </div>
        </section>

        <section class="limerence-workspace-section limerence-workspace-events-section">
          <div class="limerence-workspace-section-title">读写流程</div>
          <div class="limerence-workspace-event-list">
            ${state.workspaceEvents.length === 0
              ? html`<div class="limerence-workspace-empty">暂无读写记录。</div>`
              : state.workspaceEvents.map(
                  (event) => html`
                    <div class="limerence-workspace-event ${event.success ? "" : "is-error"}">
                      <div class="limerence-workspace-event-meta">
                        <span class="limerence-workspace-pill">${event.source === "agent" ? "Agent" : "User"}</span>
                        <span class="limerence-workspace-pill">${event.action === "read" ? "READ" : "WRITE"}</span>
                        <span class="limerence-workspace-time">${formatWorkspaceTime(event.timestamp)}</span>
                      </div>
                      <div class="limerence-workspace-event-path">${event.path}</div>
                      <div class="limerence-workspace-event-summary">${event.summary}</div>
                    </div>
                  `,
                )}
          </div>
        </section>
      </div>
    </aside>
  `;
}
