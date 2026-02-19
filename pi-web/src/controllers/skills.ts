/**
 * Skills controller — data-driven command/skill system.
 * Pure functions, no React imports.
 */

import { normalizeCommand } from "../lib/normalize";

export interface Skill {
  id: string;
  command: string;
  name: string;
  description: string;
  type: "builtin" | "prompt";
  promptTemplate?: string;
  enabled: boolean;
}

export const SKILLS_STORE_KEY = "limerence.skills";

/** Built-in skills migrated from slash-commands.ts */
export const BUILTIN_SKILLS: Skill[] = [
  { id: "builtin:stop", command: "/stop", name: "停止", description: "停止当前生成", type: "builtin", enabled: true },
  { id: "builtin:new", command: "/new", name: "新会话", description: "新建会话", type: "builtin", enabled: true },
  { id: "builtin:retry", command: "/retry", name: "重试", description: "重新生成最后一条回复", type: "builtin", enabled: true },
  { id: "builtin:clear", command: "/clear", name: "清空", description: "清空当前会话消息", type: "builtin", enabled: true },
  { id: "builtin:export", command: "/export", name: "导出", description: "导出当前会话为 JSON", type: "builtin", enabled: true },
  { id: "builtin:help", command: "/help", name: "帮助", description: "显示帮助信息", type: "builtin", enabled: true },
];

export function normalizeSkillCommand(command: string): string {
  const normalized = normalizeCommand(command);
  if (!normalized) return "";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

/** Look up a skill by command string. Custom skills checked first. */
export function findSkillByCommand(command: string, customSkills: Skill[]): Skill | undefined {
  const cmd = normalizeSkillCommand(command);
  if (!cmd) return undefined;

  return customSkills.find((s) => s.enabled && normalizeSkillCommand(s.command) === cmd)
    ?? BUILTIN_SKILLS.find((s) => s.enabled && normalizeSkillCommand(s.command) === cmd);
}

/** Create a new prompt-type skill. */
export function createPromptSkill(command: string, name: string, description: string, promptTemplate: string): Skill {
  return {
    id: `custom:${crypto.randomUUID()}`,
    command: normalizeSkillCommand(command),
    name,
    description,
    type: "prompt",
    promptTemplate,
    enabled: true,
  };
}
