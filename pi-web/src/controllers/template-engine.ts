/**
 * Template engine for prompt skills — {{Placeholder}} variable substitution.
 * Pure functions, no React imports.
 */

// ── Types ──────────────────────────────────────────────────────

export type TemplateContext = Record<string, string | number | boolean | null | undefined>;

// ── Core engine ────────────────────────────────────────────────

const TEMPLATE_RE = /\{\{(\w+)\}\}/g;

/**
 * Apply template substitution to a string.
 * Replaces {{variableName}} with values from context.
 * Unknown variables are left as-is.
 */
export function applyTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(TEMPLATE_RE, (match, key: string) => {
    const value = ctx[key];
    if (value === null || value === undefined) return match; // leave unknown as-is
    return String(value);
  });
}

/**
 * Extract all template variable names from a template string.
 */
export function extractTemplateVariables(template: string): string[] {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(TEMPLATE_RE.source, "g");
  while ((match = re.exec(template)) !== null) {
    vars.add(match[1]);
  }
  return [...vars];
}

// ── Built-in variable builders ─────────────────────────────────

export interface TemplateContextDeps {
  characterName?: string;
  persona?: string;
  userName?: string;
  date?: string;
  time?: string;
  threadId?: string;
  modelId?: string;
  providerId?: string;
  locale?: string;
}

/**
 * Build a template context from common runtime values.
 * These are the built-in variables available in all prompt skills.
 */
export function buildTemplateContext(deps: TemplateContextDeps): TemplateContext {
  const now = new Date();
  return {
    // Character info
    characterName: deps.characterName ?? "",
    char: deps.characterName ?? "",
    // User info
    persona: deps.persona ?? "",
    user: deps.userName ?? "",
    userName: deps.userName ?? "",
    // Date & time
    date: deps.date ?? now.toISOString().slice(0, 10),
    time: deps.time ?? now.toTimeString().slice(0, 5),
    datetime: deps.date
      ? `${deps.date} ${deps.time ?? now.toTimeString().slice(0, 5)}`
      : now.toISOString().slice(0, 16).replace("T", " "),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
    weekday: ["日", "一", "二", "三", "四", "五", "六"][now.getDay()],
    // Runtime info
    threadId: deps.threadId ?? "",
    modelId: deps.modelId ?? "",
    providerId: deps.providerId ?? "",
    locale: deps.locale ?? "zh-CN",
  };
}

/**
 * Get a description of all available template variables (for display in settings).
 */
export function getBuiltinTemplateVariables(): Array<{ name: string; description: string }> {
  return [
    { name: "characterName", description: "当前角色名" },
    { name: "char", description: "当前角色名（简写）" },
    { name: "persona", description: "用户人设描述" },
    { name: "user", description: "用户名" },
    { name: "userName", description: "用户名" },
    { name: "date", description: "当前日期 (YYYY-MM-DD)" },
    { name: "time", description: "当前时间 (HH:MM)" },
    { name: "datetime", description: "当前日期时间" },
    { name: "year", description: "当前年份" },
    { name: "month", description: "当前月份" },
    { name: "day", description: "当前日期" },
    { name: "weekday", description: "星期几（中文）" },
    { name: "threadId", description: "当前线程 ID" },
    { name: "modelId", description: "当前模型 ID" },
    { name: "providerId", description: "当前 provider ID" },
    { name: "locale", description: "语言区域" },
  ];
}
