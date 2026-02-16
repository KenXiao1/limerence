/**
 * Extract regex_scripts and persistent scripts from a SillyTavern character card.
 */

import type { CharacterCard } from "../lib/character";
import type { RegexScriptData, ScriptConfig } from "./types";

/**
 * Extract enabled regex_scripts from a character card's extensions.
 * Returns only scripts that are not disabled.
 */
export function extractRegexScripts(card: CharacterCard): RegexScriptData[] {
  const ext = card.data.extensions;
  const raw = ext?.regex_scripts;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((s: any) => s && typeof s === "object" && !s.disabled)
    .map((s: any, i: number) => ({
      id: s.id ?? `regex-${i}`,
      scriptName: s.scriptName ?? `Script ${i}`,
      findRegex: String(s.findRegex ?? ""),
      replaceString: String(s.replaceString ?? ""),
      placement: Array.isArray(s.placement) ? s.placement : [],
      disabled: false,
      trimStrings: Array.isArray(s.trimStrings) ? s.trimStrings : [],
    }));
}

/**
 * Extract all regex_scripts (including disabled) for settings display.
 */
export function extractAllRegexScripts(card: CharacterCard): RegexScriptData[] {
  const ext = card.data.extensions;
  const raw = ext?.regex_scripts;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((s: any) => s && typeof s === "object")
    .map((s: any, i: number) => ({
      id: s.id ?? `regex-${i}`,
      scriptName: s.scriptName ?? `Script ${i}`,
      findRegex: String(s.findRegex ?? ""),
      replaceString: String(s.replaceString ?? ""),
      placement: Array.isArray(s.placement) ? s.placement : [],
      disabled: !!s.disabled,
      trimStrings: Array.isArray(s.trimStrings) ? s.trimStrings : [],
    }));
}

/**
 * Extract persistent scripts from character card extensions.
 * These are scripts meant to run in hidden iframes for the lifetime of the chat.
 */
export function extractPersistentScripts(card: CharacterCard): ScriptConfig[] {
  const ext = card.data.extensions;
  if (!ext) return [];

  const scripts: ScriptConfig[] = [];

  // Check for persistent_scripts array (custom extension field)
  const persistent = ext.persistent_scripts;
  if (Array.isArray(persistent)) {
    for (let i = 0; i < persistent.length; i++) {
      const s = persistent[i];
      if (s && typeof s === "object" && typeof (s as any).content === "string") {
        scripts.push({
          id: (s as any).id ?? `persistent-${i}`,
          name: (s as any).name ?? `Persistent Script ${i}`,
          content: (s as any).content,
          enabled: (s as any).enabled !== false,
          source: "character",
        });
      }
    }
  }

  return scripts;
}
