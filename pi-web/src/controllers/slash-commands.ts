/**
 * Slash commands controller — lightweight command system.
 * Extends the existing chat command parser.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { t } from "../lib/i18n";

export type SlashCommandResult =
  | { type: "handled" }
  | { type: "stop" }
  | { type: "new" }
  | { type: "retry" }
  | { type: "clear" }
  | { type: "export" }
  | { type: "help"; text: string }
  | null;

/**
 * Parse a slash command from user input.
 * Returns the command result or null if not a command.
 */
export function parseSlashCommand(text: string): SlashCommandResult {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed.startsWith("/")) return null;

  const cmd = trimmed.split(/\s+/)[0];

  switch (cmd) {
    case "/stop":
    case "/abort":
      return { type: "stop" };
    case "/new":
    case "/reset":
      return { type: "new" };
    case "/retry":
    case "/regenerate":
    case "/regen":
      return { type: "retry" };
    case "/clear":
      return { type: "clear" };
    case "/export":
      return { type: "export" };
    case "/help":
    case "/?":
      return { type: "help", text: t("slash.help") };
    default:
      return null;
  }
}
