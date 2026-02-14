/**
 * Regex text processing controller — post-processing rules for AI output.
 * No global state references.
 */

export interface RegexRule {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  flags: string;
  enabled: boolean;
  /** Apply to: "output" (AI responses) or "input" (user messages) or "both" */
  scope: "output" | "input" | "both";
}

export const REGEX_RULES_KEY = "limerence.regex_rules";

/**
 * Apply regex rules to text.
 */
export function applyRegexRules(
  text: string,
  rules: RegexRule[],
  scope: "output" | "input",
): string {
  let result = text;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.scope !== "both" && rule.scope !== scope) continue;

    try {
      const regex = new RegExp(rule.pattern, rule.flags);
      result = result.replace(regex, rule.replacement);
    } catch {
      // Skip invalid regex patterns
    }
  }

  return result;
}

/**
 * Create a new regex rule.
 */
export function createRegexRule(
  name: string,
  pattern: string,
  replacement: string,
  flags = "g",
  scope: RegexRule["scope"] = "output",
): RegexRule {
  return {
    id: crypto.randomUUID(),
    name,
    pattern,
    replacement,
    flags,
    enabled: true,
    scope,
  };
}

/**
 * Validate a regex pattern.
 */
export function validateRegex(pattern: string, flags: string): string | null {
  try {
    new RegExp(pattern, flags);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "无效的正则表达式";
  }
}
