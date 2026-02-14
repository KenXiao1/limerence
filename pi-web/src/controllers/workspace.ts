/**
 * Workspace controller — pure functions for diff computation,
 * file path utilities, and event management.
 * No global state references.
 */

import type { DiffLine, DiffPreview, WorkspaceEvent } from "../app-state";
import type { FileOperation } from "../lib/tools";

// ── Constants ─────────────────────────────────────────────────

export const WS_MIN_WIDTH = 280;
export const WS_MAX_WIDTH = 700;
export const WS_WIDTH_KEY = "limerence-ws-width";

// ── Path utilities ────────────────────────────────────────────

export function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

export function summarizeText(text: string, maxLength = 90): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "空内容";
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3)}...`;
}

export function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return timestamp;
  }
}

// ── Diff computation ──────────────────────────────────────────

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

export function createDiffPreview(
  baseText: string,
  nextText: string,
  maxMatrix: number,
  maxPreviewLines: number,
): DiffPreview {
  if (baseText === nextText) {
    return { lines: [], added: 0, removed: 0, truncated: false };
  }

  const baseLines = splitLines(baseText);
  const nextLines = splitLines(nextText);

  const rawLines =
    baseLines.length * nextLines.length > maxMatrix
      ? computeSimpleLineDiff(baseLines, nextLines)
      : computeLcsDiff(baseLines, nextLines);

  const added = rawLines.filter((line) => line.type === "added").length;
  const removed = rawLines.length - added;
  const truncated = rawLines.length > maxPreviewLines;

  return {
    lines: rawLines.slice(0, maxPreviewLines),
    added,
    removed,
    truncated,
  };
}

// ── Event management ──────────────────────────────────────────

export function pushEvent(
  events: WorkspaceEvent[],
  event: Omit<WorkspaceEvent, "id">,
  maxEvents: number,
): WorkspaceEvent[] {
  return [{ id: crypto.randomUUID(), ...event }, ...events].slice(0, maxEvents);
}

export function createFileEvent(
  operation: FileOperation,
  source: "agent" | "user",
  normalizePath: (p: string) => string,
): Omit<WorkspaceEvent, "id"> {
  return {
    ...operation,
    path: normalizePath(operation.path) || operation.path,
    source,
  };
}
