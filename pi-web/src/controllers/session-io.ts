/**
 * Session export/import controller — pure functions.
 * No global state references.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { t } from "../lib/i18n";

export interface ExportedSession {
  version: 1;
  exportedAt: string;
  session: {
    id: string;
    title: string;
    createdAt: string;
    model: any;
    thinkingLevel: string;
    messages: AgentMessage[];
  };
}

/**
 * Build an exportable session object.
 */
export function buildExportData(
  sessionId: string,
  title: string,
  createdAt: string,
  model: any,
  thinkingLevel: string,
  messages: AgentMessage[],
): ExportedSession {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      id: sessionId,
      title,
      createdAt,
      model,
      thinkingLevel,
      messages,
    },
  };
}

/**
 * Validate an imported session JSON.
 */
export function validateImportData(
  data: unknown,
): { session: ExportedSession["session"]; error: null } | { session: null; error: string } {
  if (!data || typeof data !== "object") {
    return { session: null, error: t("data.invalidJson") };
  }

  const obj = data as Record<string, unknown>;

  // Our export format
  if (obj.version === 1 && obj.session && typeof obj.session === "object") {
    const s = obj.session as Record<string, unknown>;
    if (!Array.isArray(s.messages)) {
      return { session: null, error: t("data.missingMessages") };
    }
    return { session: s as ExportedSession["session"], error: null };
  }

  // Direct session data (from pi-web-ui SessionsStore)
  if (Array.isArray(obj.messages)) {
    return {
      session: {
        id: String(obj.id ?? crypto.randomUUID()),
        title: String(obj.title ?? t("data.importedSession")),
        createdAt: String(obj.createdAt ?? new Date().toISOString()),
        model: obj.model ?? null,
        thinkingLevel: String(obj.thinkingLevel ?? "off"),
        messages: obj.messages as AgentMessage[],
      },
      error: null,
    };
  }

  return { session: null, error: t("data.unknownFormat") };
}

/**
 * Trigger a file download in the browser.
 */
export function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Read a File as JSON.
 */
export async function readFileAsJson(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}
