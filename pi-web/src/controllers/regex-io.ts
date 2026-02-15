/**
 * Regex rules import/export + SillyTavern format conversion.
 * Pure functions, no global state references.
 */

import type { RegexRule } from "./regex-rules";
import { createRegexRule } from "./regex-rules";

// ── Export ───────────────────────────────────────────────────

export function exportRegexRules(rules: RegexRule[]): object {
  return {
    version: 1,
    format: "limerence",
    rules,
  };
}

// ── Import ───────────────────────────────────────────────────

/**
 * Auto-detect format (pi-web / ST single / ST array) and return RegexRule[].
 */
export function importRegexRules(data: unknown): { rules?: RegexRule[]; error?: string } {
  if (!data || typeof data !== "object") {
    return { error: "无效的正则数据" };
  }

  // pi-web format: { format: "limerence", rules: [...] }
  const obj = data as Record<string, unknown>;
  if (obj.format === "limerence" && Array.isArray(obj.rules)) {
    return { rules: obj.rules as RegexRule[] };
  }

  // ST array format
  if (Array.isArray(data)) {
    const rules = data.map(convertSTRegex).filter(Boolean) as RegexRule[];
    return rules.length > 0 ? { rules } : { error: "无法解析正则数组" };
  }

  // ST single regex object (has findRegex + scriptName)
  if (typeof obj.findRegex === "string" && typeof obj.scriptName === "string") {
    const rule = convertSTRegex(obj);
    return rule ? { rules: [rule] } : { error: "无法解析 ST 正则格式" };
  }

  return { error: "无法识别的正则格式" };
}

// ── ST conversion ────────────────────────────────────────────

const ST_REGEX_PATTERN = /^\/(.+)\/([gimsuy]*)$/s;

/**
 * Convert a single SillyTavern regex object to a pi-web RegexRule.
 */
export function convertSTRegex(st: unknown): RegexRule | null {
  if (!st || typeof st !== "object") return null;
  const obj = st as Record<string, unknown>;

  const findRegex = String(obj.findRegex ?? "");
  const match = ST_REGEX_PATTERN.exec(findRegex);
  if (!match) return null;

  const [, pattern, flags] = match;
  const replacement = String(obj.replaceString ?? "");
  const name = String(obj.scriptName ?? "ST Rule");
  const _disabled = obj.disabled === true;

  // placement mapping: [1] → input, [2] → output, [1,2] → both
  const placement = Array.isArray(obj.placement) ? obj.placement : [];
  const scope = mapPlacement(placement);

  return createRegexRule(name, pattern, replacement, flags || "g", scope);
}

function mapPlacement(placement: unknown[]): RegexRule["scope"] {
  const has1 = placement.includes(1);
  const has2 = placement.includes(2);
  if (has1 && has2) return "both";
  if (has1) return "input";
  return "output"; // default to output (placement [2] or empty)
}
