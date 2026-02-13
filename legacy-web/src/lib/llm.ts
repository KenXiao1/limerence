import type { Message, StreamEvent, Settings, ToolDef, ModelInfo } from "./types";

/**
 * Resolve the effective base URL, considering reverse proxy settings.
 * Priority: reverseProxyUrl (if enabled) > baseUrl
 */
function resolveBaseUrl(settings: Settings): string {
  if (settings.reverseProxyEnabled && settings.reverseProxyUrl) {
    return settings.reverseProxyUrl.replace(/\/+$/, "");
  }
  return settings.baseUrl.replace(/\/+$/, "");
}

/**
 * Build URL and headers for an API request based on settings.
 */
function buildRequest(settings: Settings, path: string): { url: string; headers: Record<string, string> } {
  if (settings.proxyMode) {
    return {
      url: `/api${path}`,
      headers: { "Content-Type": "application/json" },
    };
  }
  return {
    url: `${resolveBaseUrl(settings)}${path}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
  };
}

/**
 * Test API connection. Returns { ok, message, latencyMs }.
 */
export async function testConnection(
  settings: Settings,
): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = performance.now();
  try {
    const { url, headers } = buildRequest(settings, "/models");

    const resp = settings.proxyMode
      ? await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ base_url: resolveBaseUrl(settings) }),
        })
      : await fetch(url, { headers });

    const latencyMs = Math.round(performance.now() - start);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, message: `${resp.status}: ${text}`, latencyMs };
    }

    return { ok: true, message: "连接成功", latencyMs };
  } catch (e: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg, latencyMs };
  }
}

/**
 * Fetch available models from the API.
 */
export async function fetchModels(settings: Settings): Promise<ModelInfo[]> {
  const { url, headers } = buildRequest(settings, "/models");

  const resp = settings.proxyMode
    ? await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ base_url: resolveBaseUrl(settings) }),
      })
    : await fetch(url, { headers });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status}: ${text}`);
  }

  const json = await resp.json();
  const data: unknown[] = json.data ?? json;

  return data
    .filter((m: any) => m.id)
    .map((m: any) => ({ id: m.id, owned_by: m.owned_by }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Stream chat completion from an OpenAI-compatible API.
 * Ported from Rust client.rs + stream.rs.
 *
 * Supports two modes:
 * - Direct: browser → LLM API (user provides API key)
 * - Proxy: browser → Edge Function → LLM API
 *
 * When reverse proxy is enabled, all requests go through the reverse proxy URL.
 */
export async function* streamChat(
  messages: Message[],
  tools: ToolDef[],
  settings: Settings,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const openaiMessages = messages.map(messageToOpenai);
  const openaiTools = tools.length > 0 ? tools.map(toolToOpenai) : undefined;

  const { url, headers } = buildRequest(settings, "/chat/completions");

  const body = JSON.stringify({
    model: settings.modelId,
    messages: openaiMessages,
    tools: openaiTools,
    stream: true,
    ...(settings.proxyMode ? { base_url: resolveBaseUrl(settings) } : {}),
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
