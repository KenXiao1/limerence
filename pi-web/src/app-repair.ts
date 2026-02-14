import type { AgentMessage } from "@mariozechner/pi-agent-core";

/**
 * Repair a session transcript by fixing orphaned tool_use / tool_result pairs.
 *
 * Handles three cases:
 * 1. Assistant message with toolCall blocks that have no matching toolResult → inject synthetic error result
 * 2. ToolResult messages with no matching toolCall in any prior assistant message → remove them
 * 3. Assistant messages with toolCall blocks missing required fields → remove those blocks
 */
export function repairTranscript(messages: AgentMessage[]): AgentMessage[] {
  if (!messages.length) return messages;

  // Collect all toolCall IDs from assistant messages
  const toolCallIds = new Set<string>();
  for (const msg of messages) {
    if ((msg as any).role !== "assistant") continue;
    const content = (msg as any).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "toolCall" && block.id) {
        toolCallIds.add(block.id);
      }
    }
  }

  // Collect all toolResult IDs
  const toolResultIds = new Set<string>();
  for (const msg of messages) {
    if ((msg as any).role !== "toolResult") continue;
    const id = (msg as any).toolCallId;
    if (id) toolResultIds.add(id);
  }

  const repaired: AgentMessage[] = [];

  for (const msg of messages) {
    const role = (msg as any).role;

    // Case 2: Remove orphaned toolResult (no matching toolCall)
    if (role === "toolResult") {
      const callId = (msg as any).toolCallId;
      if (!callId || !toolCallIds.has(callId)) {
        continue; // drop orphaned result
      }
      repaired.push(msg);
      continue;
    }

    // Case 1: Assistant with toolCalls that have no result → inject synthetic results after
    if (role === "assistant") {
      const content = (msg as any).content;
      if (Array.isArray(content)) {
        // Case 3: Filter out malformed toolCall blocks
        const cleanedContent = content.filter((block: any) => {
          if (block?.type === "toolCall") {
            return block.id && block.name;
          }
          return true;
        });

        if (cleanedContent.length !== content.length) {
          repaired.push({ ...msg, content: cleanedContent } as any);
        } else {
          repaired.push(msg);
        }

        // Find toolCalls without matching results and inject synthetic error results
        for (const block of cleanedContent) {
          if (block?.type === "toolCall" && block.id && !toolResultIds.has(block.id)) {
            repaired.push({
              role: "toolResult",
              toolCallId: block.id,
              toolName: block.name ?? "unknown",
              content: [{ type: "text", text: "[会话修复] 此工具调用因中断未完成。" }],
              isError: true,
              timestamp: (msg as any).timestamp ?? Date.now(),
            } as any);
            toolResultIds.add(block.id); // mark as handled
          }
        }
        continue;
      }
    }

    repaired.push(msg);
  }

  return repaired;
}
