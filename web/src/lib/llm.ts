import type { Message, StreamEvent, Settings, ToolDef } from "./types";

/**
 * Stream chat completion from an OpenAI-compatible API.
 * Ported from Rust client.rs + stream.rs.
 *
 * Supports two modes:
 * - Direct: browser → LLM API (user provides API key)
 * - Proxy: browser → Edge Function → LLM API
 */
export async function* streamChat(
  messages: Message[],
  tools: ToolDef[],
  settings: Settings,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const openaiMessages = messages.map(messageToOpenai);
  const openaiTools = tools.length > 0 ? tools.map(toolToOpenai) : undefined;

  let url: string;
  let headers: Record<string, string>;

  if (settings.proxyMode) {
    // Proxy mode: send to our Edge Function
    url = "/api/chat";
    headers = { "Content-Type": "application/json" };
  } else {
    // Direct mode: browser → LLM API
    url = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    };
  }

  const body = JSON.stringify({
    model: settings.modelId,
    messages: openaiMessages,
    tools: openaiTools,
    stream: true,
    ...(settings.proxyMode ? { base_url: settings.baseUrl } : {}),
  });

  const resp = await fetch(url, { method: "POST", headers, body, signal });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    yield { type: "error", message: `${resp.status}: ${text}` };
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    yield { type: "error", message: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    // Keep the last incomplete line in buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const event = parseSseLine(trimmed);
      if (event) yield event;
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const event = parseSseLine(buffer.trim());
    if (event) yield event;
  }

  yield { type: "done" };
}

/** Parse a single SSE data line, ported from Rust stream.rs */
function parseSseLine(line: string): StreamEvent | null {
  const data = line.startsWith("data: ") ? line.slice(6) : null;
  if (!data) return null;
  if (data === "[DONE]") return { type: "done" };

  let json: any;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }

  if (json.error) {
    return { type: "error", message: JSON.stringify(json.error) };
  }

  const choice = json.choices?.[0];
  if (!choice) return null;
  const delta = choice.delta;
  if (!delta) return null;

  // Text content
  if (delta.content) {
    return { type: "text_delta", text: delta.content };
  }

  // Tool calls
  if (delta.tool_calls) {
    for (const tc of delta.tool_calls) {
      const index = tc.index ?? 0;

      // Tool call start
      if (tc.id && tc.function?.name) {
        return {
          type: "tool_call_start",
          index,
          id: tc.id,
          name: tc.function.name,
        };
      }

      // Tool call delta
      if (tc.function?.arguments) {
        return {
          type: "tool_call_delta",
          index,
          arguments: tc.function.arguments,
        };
      }
    }
  }

  // Finish reason
  if (choice.finish_reason === "stop" || choice.finish_reason === "tool_calls") {
    return { type: "done" };
  }

  return null;
}

function messageToOpenai(msg: Message): Record<string, unknown> {
  switch (msg.role) {
    case "system":
      return { role: "system", content: msg.content };
    case "user":
      return { role: "user", content: msg.content };
    case "assistant": {
      const obj: Record<string, unknown> = {
        role: "assistant",
        content: msg.content,
      };
      if (msg.tool_calls?.length) {
        obj.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }));
      }
      return obj;
    }
    case "tool":
      return {
        role: "tool",
        tool_call_id: msg.tool_call_id,
        content: msg.content,
      };
  }
}

function toolToOpenai(tool: ToolDef): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
