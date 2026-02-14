/**
 * Lorebook controller — pure functions for keyword-triggered context injection.
 * No global state references.
 */

import type { LorebookEntry } from "../lib/storage";

/**
 * Scan recent messages for lorebook keyword matches.
 * Returns the content of all matched entries, joined by newlines.
 */
export function scanLorebook(
  entries: LorebookEntry[],
  recentText: string,
  characterId: string | null,
): string[] {
  const matched: string[] = [];
  const lowerText = recentText.toLowerCase();

  for (const entry of entries) {
    if (!entry.enabled) continue;
    // Skip entries bound to a different character
    if (entry.characterId && entry.characterId !== characterId) continue;

    const hasMatch = entry.keywords.some((kw) =>
      lowerText.includes(kw.toLowerCase()),
    );

    if (hasMatch) {
      matched.push(entry.content);
    }
  }

  return matched;
}

/**
 * Build lorebook injection text for the system prompt.
 */
export function buildLorebookInjection(matchedContents: string[]): string {
  if (matchedContents.length === 0) return "";
  return `[世界设定补充信息]\n${matchedContents.join("\n\n")}`;
}

/**
 * Extract recent conversation text for lorebook scanning.
 * Scans the last N messages.
 */
export function extractRecentText(
  messages: Array<{ role?: string; content?: any }>,
  scanDepth = 10,
): string {
  const recent = messages.slice(-scanDepth);
  const parts: string[] = [];

  for (const msg of recent) {
    const content = (msg as any).content;
    if (typeof content === "string") {
      parts.push(content);
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === "text" && block.text) {
          parts.push(block.text);
        }
      }
    }
  }

  return parts.join("\n");
}

/**
 * Create a new lorebook entry.
 */
export function createLorebookEntry(
  keywords: string[],
  content: string,
  characterId: string | null = null,
): LorebookEntry {
  return {
    id: crypto.randomUUID(),
    keywords: keywords.filter((k) => k.trim()),
    content,
    enabled: true,
    characterId,
  };
}
