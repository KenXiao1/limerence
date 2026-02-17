/**
 * Agent loop — LLM streaming + tool execution cycle.
 * Replaces @mariozechner/pi-agent-core's Agent class.
 *
 * Flow:
 * 1. Build messages array (system prompt + history)
 * 2. Call pi-ai stream() to get EventStream
 * 3. Iterate stream events → accumulate text delta + tool calls
 * 4. Stream ends → check for tool calls
 * 5. Has tool calls → execute sequentially, append results, go to step 2
 * 6. No tool calls → done
 */

import { stream as piAiStream } from "@mariozechner/pi-ai";
import type { AgentMessage, AgentContentBlock } from "./message-converter";
import type { AgentTool } from "../lib/tools";

// ── Types ───────────────────────────────────────────────────────

export interface AgentLoopOptions {
  model: any;
  apiKey: string;
  systemPrompt: string;
  messages: AgentMessage[];
  tools: AgentTool<any, any>[];
  thinkingLevel?: string;
  maxIterations?: number;

  // Callbacks for real-time UI updates
  onTextDelta?: (text: string, fullText: string) => void;
  onToolCallStart?: (toolCallId: string, toolName: string) => void;
  onToolCallEnd?: (toolCallId: string, toolName: string, result: string) => void;
  onMessageComplete?: (message: AgentMessage) => void;
  onError?: (error: Error) => void;

  // Abort signal
  signal?: AbortSignal;
}

export interface AgentLoopResult {
  messages: AgentMessage[];
  aborted: boolean;
}

// ── Tool definitions for pi-ai ──────────────────────────────────

function buildToolDefs(tools: AgentTool<any, any>[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

// ── Message conversion for pi-ai Context ────────────────────────

function messagesToPiAi(messages: AgentMessage[]): any[] {
  const result: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (msg.role === "user" || msg.role === "user-with-attachments") {
      if (typeof msg.content === "string") {
        result.push({ role: "user", content: msg.content, timestamp: msg.timestamp ?? Date.now() });
      } else if (Array.isArray(msg.content)) {
        const parts: any[] = [];
        for (const block of msg.content) {
          if (block.type === "text") {
            parts.push({ type: "text", text: block.text });
          } else if (block.type === "image_url") {
            parts.push({ type: "image", data: (block as any).image_url?.url ?? "", mimeType: "image/png" });
          }
        }
        result.push({ role: "user", content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts, timestamp: msg.timestamp ?? Date.now() });
      }
      continue;
    }

    if (msg.role === "assistant") {
      if (Array.isArray(msg.content)) {
        const content: any[] = [];
        for (const block of msg.content) {
          if (block.type === "text") {
            content.push({ type: "text", text: block.text });
          } else if (block.type === "tool_use") {
            content.push({
              type: "toolCall",
              id: block.id,
              name: block.name,
              arguments: block.input,
            });
          }
        }
        result.push({
          role: "assistant",
          content,
          api: msg.api ?? "openai-completions",
          provider: msg.provider ?? "limerence-proxy",
          model: msg.model ?? "",
          usage: msg.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          stopReason: msg.stopReason ?? "stop",
          timestamp: msg.timestamp ?? Date.now(),
        });
      }
      continue;
    }

    if (msg.role === "tool_result") {
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.filter((c) => c.type === "text").map((c) => (c as any).text).join("\n")
          : "";
      result.push({
        role: "toolResult",
        toolCallId: msg.tool_use_id,
        toolName: msg.tool_name ?? "",
        content: [{ type: "text", text }],
        isError: false,
        timestamp: msg.timestamp ?? Date.now(),
      });
    }
  }

  return result;
}

// ── Main agent loop ─────────────────────────────────────────────

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    model,
    apiKey,
    systemPrompt,
    tools,
    maxIterations = 10,
    onTextDelta,
    onToolCallStart,
    onToolCallEnd,
    onMessageComplete,
    onError,
    signal,
  } = options;

  let currentMessages = [...options.messages];
  let iteration = 0;

  while (iteration < maxIterations) {
    if (signal?.aborted) {
      return { messages: currentMessages, aborted: true };
    }

    iteration++;

    try {
      const { assistantMessage, toolCalls } = await streamOneIteration({
        model,
        apiKey,
        systemPrompt,
        messages: currentMessages,
        tools,
        onTextDelta,
        signal,
      });

      currentMessages.push(assistantMessage);
      onMessageComplete?.(assistantMessage);

      // No tool calls → agent is done
      if (toolCalls.length === 0) {
        return { messages: currentMessages, aborted: false };
      }

      // Execute tool calls sequentially
      for (const tc of toolCalls) {
        if (signal?.aborted) {
          return { messages: currentMessages, aborted: true };
        }

        onToolCallStart?.(tc.id, tc.name);

        const tool = tools.find((t) => t.name === tc.name);
        let resultText: string;

        if (!tool) {
          resultText = `工具 "${tc.name}" 不存在。`;
        } else {
          try {
            const result = await tool.execute(tc.id, tc.input);
            resultText = result.content
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n");
          } catch (err) {
            resultText = `工具执行失败：${err instanceof Error ? err.message : String(err)}`;
          }
        }

        onToolCallEnd?.(tc.id, tc.name, resultText);

        // Append tool result message
        const toolResultMsg: AgentMessage = {
          role: "tool_result",
          content: resultText,
          tool_use_id: tc.id,
          tool_name: tc.name,
          timestamp: Date.now(),
        };
        currentMessages.push(toolResultMsg);
      }

      // Loop back to get next LLM response
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      return { messages: currentMessages, aborted: false };
    }
  }

  // Max iterations reached
  return { messages: currentMessages, aborted: false };
}

// ── Single streaming iteration ──────────────────────────────────

interface StreamResult {
  assistantMessage: AgentMessage;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

async function streamOneIteration(options: {
  model: any;
  apiKey: string;
  systemPrompt: string;
  messages: AgentMessage[];
  tools: AgentTool<any, any>[];
  onTextDelta?: (text: string, fullText: string) => void;
  signal?: AbortSignal;
}): Promise<StreamResult> {
  const { model, apiKey, systemPrompt, messages, tools, onTextDelta, signal } = options;

  const piAiMessages = messagesToPiAi(messages);
  const toolDefs = tools.length > 0 ? buildToolDefs(tools) : undefined;

  const streamModel = { ...model };
  if (apiKey && apiKey !== "__PROXY__") {
    streamModel.apiKey = apiKey;
  }

  const eventStream = piAiStream(streamModel, {
    systemPrompt,
    messages: piAiMessages,
    tools: toolDefs,
  } as any, {
    signal,
  });

  let fullText = "";
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  let usage: AgentMessage["usage"] = undefined;
  let stopReason = "stop";

  // Accumulate tool call arguments as they stream in
  const toolCallArgBuffers = new Map<number, { id: string; name: string; args: string }>();

  for await (const event of eventStream) {
    if (signal?.aborted) break;

    if (event.type === "text_delta") {
      fullText += event.delta;
      onTextDelta?.(event.delta, fullText);
    } else if (event.type === "toolcall_start") {
      toolCallArgBuffers.set(event.contentIndex, {
        id: `call_${crypto.randomUUID().slice(0, 8)}`,
        name: "",
        args: "",
      });
    } else if (event.type === "toolcall_delta") {
      const buf = toolCallArgBuffers.get(event.contentIndex);
      if (buf) {
        buf.args += event.delta;
      }
    } else if (event.type === "toolcall_end") {
      // toolcall_end provides the finalized toolCall object
      const tc = event.toolCall;
      toolCalls.push({
        id: tc.id,
        name: tc.name,
        input: tc.arguments ?? {},
      });
      toolCallArgBuffers.delete(event.contentIndex);
    } else if (event.type === "done") {
      stopReason = event.reason;
      const msg = event.message;
      if (msg.usage) {
        usage = {
          input: msg.usage.input,
          output: msg.usage.output,
          cacheRead: msg.usage.cacheRead,
          cacheWrite: msg.usage.cacheWrite,
          totalTokens: msg.usage.totalTokens,
          cost: msg.usage.cost,
        };
      }
    }
  }

  // Finalize any remaining buffered tool calls (shouldn't happen normally)
  for (const [, buf] of toolCallArgBuffers) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(buf.args || "{}"); } catch { /* ignore */ }
    toolCalls.push({ id: buf.id, name: buf.name, input });
  }

  // Build assistant message
  const content: AgentContentBlock[] = [];
  if (fullText) {
    content.push({ type: "text", text: fullText });
  }
  for (const tc of toolCalls) {
    content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
  }

  const assistantMessage: AgentMessage = {
    role: "assistant",
    content,
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage,
    stopReason: toolCalls.length > 0 ? "tool_use" : stopReason,
    timestamp: Date.now(),
  };

  return { assistantMessage, toolCalls };
}
