/**
 * Slash commands controller — lightweight command system.
 * Extends the existing chat command parser.
 */

import { t } from "../lib/i18n";
import { normalizeCommand } from "../lib/normalize";
import { findSkillByCommand, normalizeSkillCommand, type Skill } from "./skills";

export type SlashCommandResult =
  | { type: "handled" }
  | { type: "stop" }
  | { type: "new" }
  | { type: "retry" }
  | { type: "clear" }
  | { type: "export" }
  | { type: "help"; text: string }
  | { type: "prompt"; command: string; promptTemplate: string }
  | null;

const COMMAND_ALIASES: Record<string, string> = {
  "/abort": "/stop",
  "/reset": "/new",
  "/regenerate": "/retry",
  "/regen": "/retry",
  "/?": "/help",
};

/**
 * Parse a slash command from user input.
 * Returns the command result or null if not a command.
 */
export function parseSlashCommand(text: string, customSkills: Skill[] = []): SlashCommandResult {
  const trimmed = normalizeCommand(text);
  if (!trimmed.startsWith("/")) return null;

  const rawCommand = normalizeSkillCommand(trimmed.split(/\s+/)[0]);
  const command = COMMAND_ALIASES[rawCommand] ?? rawCommand;
  const skill = findSkillByCommand(command, customSkills);
  if (!skill) return null;

  if (skill.type === "prompt") {
    return {
      type: "prompt",
      command,
      promptTemplate: skill.promptTemplate ?? "",
    };
  }

  switch (command) {
    case "/stop":
      return { type: "stop" };
    case "/new":
      return { type: "new" };
    case "/retry":
      return { type: "retry" };
    case "/clear":
      return { type: "clear" };
    case "/export":
      return { type: "export" };
    case "/help":
      return { type: "help", text: t("slash.help") };
    default:
      return null;
  }
}
