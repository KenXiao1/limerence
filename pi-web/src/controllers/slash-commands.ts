/**
 * Slash commands controller — lightweight command system.
 * Extends the existing chat command parser.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

export type SlashCommandResult =
  | { type: "handled" }
  | { type: "stop" }
  | { type: "new" }
  | { type: "retry" }
  | { type: "clear" }
  | { type: "export" }
  | { type: "help"; text: string }
  | null;

const HELP_TEXT = `可用命令：
/help — 显示此帮助
/stop — 停止当前生成
/new — 新建会话
/retry — 重新生成最后一条回复
/clear — 清空当前会话消息
/export — 导出当前会话为 JSON
/model — 显示当前模型信息`;

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
      return { type: "help", text: HELP_TEXT };
    default:
      return null;
  }
}
