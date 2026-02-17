/**
 * Message format converter.
 *
 * Converts between the pi-agent-core AgentMessage format (used in IndexedDB sessions)
 * and assistant-ui's ThreadMessageLike format (used for rendering).
 *
 * Key difference: pi-agent-core stores tool_result as separate messages,
 * while assistant-ui inlines tool results into the assistant message's tool-call parts.
 */

import type { ThreadMessageLike } from "@assistant-ui/react";

// ── pi-agent-core message types (replicated locally) ────────────

/** Content block in an AgentMessage */
export type AgentContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string | Array<{ type: string; text: string }> };

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "user-with-attachments" | "tool_result";
  content: string | AgentContentBlock[];
  // assistant-specific fields
  api?: string;
  provider?: string;
  model?: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  };
  stopReason?: string;
  timestamp?: number;
  // tool_result-specific fields
  tool_use_id?: string;
  tool_name?: string;
}

// ── Conversion ──────────────────────────────────────────────────

/**
 * Convert an array of AgentMessages to ThreadMessageLike[].
 *
 * Two-pass approach:
 * 1. First pass: collect tool results into a map keyed by tool_use_id
 * 2. Second pass: build ThreadMessageLike[], inlining tool results into
 *    the preceding assistant message's tool-call parts
 */
export function convertMessages(messages: AgentMessage[]): ThreadMessageLike[] {
  // Pass 1: collect tool results
  const toolResults = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role === "tool_result" && msg.tool_use_id) {
      const text = extractToolResultText(msg);
      toolResults.set(msg.tool_use_id, text);
      continue;
    }
    // Also handle inline tool_result content blocks
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "tool_result" && "tool_use_id" in block) {
          const text = typeof block.content === "string"
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c) => c.text).join("\n")
              : "";
          toolResults.set(block.tool_use_id, text);
        }
      }
    }
  }

  // Pass 2: build ThreadMessageLike[]
  const result: ThreadMessageLike[] = [];

  for (const msg of messages) {
    // Skip standalone tool_result messages (already collected)
    if (msg.role === "tool_result") continue;

    if (msg.role === "system") continue; // system messages handled via systemPrompt

    if (msg.role === "user" || msg.role === "user-with-attachments") {
      result.push(convertUserMessage(msg));
      continue;
    }

    if (msg.role === "assistant") {
      result.push(convertAssistantMessage(msg, toolResults));
      continue;
    }
  }

  return result;
}

function convertUserMessage(msg: AgentMessage): ThreadMessageLike {
  const parts: any[] = [];

  if (typeof msg.content === "string") {
    parts.push({ type: "text", text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "text") {
        parts.push({ type: "text", text: block.text });
      } else if (block.type === "image_url") {
        parts.push({ type: "image", image: block.image_url.url });
      }
    }
  }

  return {
    role: "user",
    content: parts,
    id: msg.timestamp ? `user-${msg.timestamp}` : undefined,
    createdAt: msg.timestamp ? new Date(msg.timestamp) : undefined,
  };
}

function convertAssistantMessage(
  msg: AgentMessage,
  toolResults: Map<string, string>,
): ThreadMessageLike {
  const parts: any[] = [];

  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "text") {
        parts.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        const toolCallResult = toolResults.get(block.id);
        parts.push({
          type: "tool-call",
          toolCallId: block.id,
          toolName: block.name,
          args: block.input,
          result: toolCallResult,
        });
      }
    }
  }

  return {
    role: "assistant",
    content: parts,
    id: msg.timestamp ? `assistant-${msg.timestamp}` : undefined,
    createdAt: msg.timestamp ? new Date(msg.timestamp) : undefined,
    status: { type: "complete", reason: "stop" },
    metadata: {
      custom: {
        model: msg.model,
        provider: msg.provider,
        usage: msg.usage,
      },
    },
  };
}

function extractToolResultText(msg: AgentMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
  }
  return "";
}

// ── Reverse conversion (ThreadMessageLike → AgentMessage) ───────

/**
 * Convert a user's AppendMessage text to an AgentMessage for storage.
 */
export function createUserAgentMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  };
}

/**
 * Create an assistant AgentMessage from streaming results.
 */
export function createAssistantAgentMessage(
  textContent: string,
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  model: { api?: string; provider?: string; id?: string },
  usage: AgentMessage["usage"],
  stopReason: string,
): AgentMessage {
  const content: AgentContentBlock[] = [];

  if (textContent) {
    content.push({ type: "text", text: textContent });
  }

  for (const tc of toolCalls) {
    content.push({
      type: "tool_use",
      id: tc.id,
      name: tc.name,
      input: tc.input,
    });
  }

  return {
    role: "assistant",
    content,
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage,
    stopReason,
    timestamp: Date.now(),
  };
}

/**
 * Create a tool_result AgentMessage for storage.
 */
export function createToolResultAgentMessage(
  toolUseId: string,
  resultText: string,
): AgentMessage {
  return {
    role: "tool_result",
    content: resultText,
    tool_use_id: toolUseId,
    timestamp: Date.now(),
  };
}
